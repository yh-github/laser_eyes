// tracker.js

window.saveDataAcrossSessions = true;

const FaceTracker = {
    isStarted: false,
    
    // Tracking outputs
    cursorX: -100,
    cursorY: -100,
    mouthOpenness: 0,
    eyebrowRaise: 0,
    puckerStrength: 0,
    headTilt: 0,
    isRoaring: false,
    
    // Dedicated mouth state (separate from isRoaring)
    isMouthOpen: false,
    mouthVelocity: 0,
    prevMouthOpenness: 0,
    _velocityHoldCounter: 0,
    
    // Mouth Detection Config (exposed to settings UI)
    mouthDetection: {
        approach: 'hysteresis',  // 'multiMetric' | 'velocityGated' | 'hysteresis'
        smoothing: 0.35,
        marWeight: 0.5,
        areaWeight: 0.3,
        chinWeight: 0.2,
        openThreshold: 0.30,
        velocityThreshold: 0.03,
        holdFrames: 10,
        hystOpenThreshold: 0.38,
        hystCloseThreshold: 0.18,
    },

    // --- NEW: Multi-Detector Support ---
    createDetector(config) {
        return {
            config: JSON.parse(JSON.stringify(config || this.mouthDetection)),
            mouthOpenness: 0,
            prevMouthOpenness: 0,
            mouthVelocity: 0,
            isMouthOpen: false,
            _velocityHoldCounter: 0
        };
    },

    evaluateDetector(detector, metrics) {
        const md = detector.config || detector.mouthDetection;
        const { marScore, areaScore, chinScore } = metrics;
        const emaResponsive = md.smoothing;
        const emaSmooth = 1 - md.smoothing;

        const totalWeight = (md.marWeight || 0) + (md.areaWeight || 0) + (md.chinWeight || 0);
        const targetMouthOpenness = (marScore * (md.marWeight || 0) + areaScore * (md.areaWeight || 0) + chinScore * (md.chinWeight || 0)) / Math.max(totalWeight, 0.01);

        detector.prevMouthOpenness = detector.mouthOpenness;
        detector.mouthOpenness = detector.mouthOpenness * emaSmooth + targetMouthOpenness * emaResponsive;
        detector.mouthVelocity = detector.mouthOpenness - detector.prevMouthOpenness;

        if (md.approach === 'multiMetric') {
            detector.isMouthOpen = detector.mouthOpenness > md.openThreshold;
        } else if (md.approach === 'velocityGated') {
            if (detector.mouthOpenness > md.openThreshold && detector.mouthVelocity > md.velocityThreshold) {
                detector.isMouthOpen = true;
                detector._velocityHoldCounter = md.holdFrames;
            } else if (detector._velocityHoldCounter > 0 && detector.mouthOpenness > md.openThreshold * 0.7) {
                detector._velocityHoldCounter--;
                detector.isMouthOpen = true;
            } else {
                detector.isMouthOpen = false;
                detector._velocityHoldCounter = 0;
            }
        } else if (md.approach === 'hysteresis') {
            if (detector.isMouthOpen) {
                if (detector.mouthOpenness < md.hystCloseThreshold) detector.isMouthOpen = false;
            } else {
                if (detector.mouthOpenness > md.hystOpenThreshold) detector.isMouthOpen = true;
            }
        }
        return detector.isMouthOpen;
    },
    
    // Internal state
    noseCenter: { x: 0, y: 0 },
    noseSensitivity: 3.5,
    noseSmoothing: 0.4,
    lastNoseX: -100,
    lastNoseY: -100,
    
    neutralBaselines: {
        faceWidth: 0,
        faceHeight: 0,
        mouthWidth: 0,
        mouthHeight: 0,
        baseMAR: 0,
        eyebrowDist: 0,
        noseToChin: 0,
        baseTiltAngle: 0,
        captured: false
    },
    
    // UI behavior
    suppressAutoUI: false,
    showDebugLandmarks: false,
    
    // Config / Callbacks
    appContainerId: 'app-container',
    onCalibrateFinished: () => {},
    
    debugCanvas: null,

    // Helper
    getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    },

    showError(title, action) {
        const statusBox = document.getElementById('status-box');
        const loadingMsg = document.getElementById('loading-msg');
        const actionMsg = document.getElementById('action-msg');
        
        // Main menu status box (fallback)
        if (statusBox && loadingMsg && actionMsg) {
            statusBox.classList.remove('hidden');
            loadingMsg.innerText = title;
            actionMsg.innerText = action;
        }

        // Intro screen error box
        const introErrorBox = document.getElementById('intro-error-box');
        const introErrorMsg = document.getElementById('intro-error-msg');
        const introStatusBox = document.getElementById('intro-status-box');
        
        if (introErrorBox && introErrorMsg) {
            introErrorBox.classList.remove('hidden');
            introErrorMsg.innerText = title + ": " + action;
            if (introStatusBox) introStatusBox.classList.add('hidden');
        }

        const startBtn = document.getElementById('start-btn');
        if(startBtn) startBtn.classList.remove('hidden');
    },

    async init() {
        const introLoadingMsg = document.getElementById('intro-loading-msg');
        const introActionMsg = document.getElementById('intro-action-msg');
        
        if (introLoadingMsg) introLoadingMsg.innerText = "Initializing AI...";
        if (introActionMsg) introActionMsg.innerText = "Preparing neural engine.";

        try {
            if (window.webgazerLoadError || typeof webgazer === 'undefined') {
                throw new Error("Face tracking library failed to load. Please check your connection.");
            }

            webgazer.params.showVideo = true;
            webgazer.params.showPredictionPoints = false;
            webgazer.setGazeListener(() => { });

            if (introLoadingMsg) introLoadingMsg.innerText = "Awaiting Camera...";
            if (introActionMsg) introActionMsg.innerText = "Please accept camera permissions if prompted.";

            await webgazer.begin();

            if (introLoadingMsg) introLoadingMsg.innerText = "Downloading Models...";
            if (introActionMsg) introActionMsg.innerText = "Initializing neural weights (15MB).";

            const appContainer = document.getElementById(this.appContainerId) || document.body;
            const videoContainer = document.getElementById('webgazerVideoContainer');
            
            this.debugCanvas = document.createElement('canvas');
            this.debugCanvas.id = 'debug-landmark-canvas';
            this.debugCanvas.style.position = 'absolute';
            this.debugCanvas.style.top = '0';
            this.debugCanvas.style.left = '0';
            this.debugCanvas.style.width = '100%';
            this.debugCanvas.style.height = '100%';
            this.debugCanvas.style.zIndex = '5';
            this.debugCanvas.style.pointerEvents = 'none';

            if (videoContainer) {
                appContainer.appendChild(videoContainer);
                videoContainer.appendChild(this.debugCanvas);
            }

            webgazer.showVideoPreview(true).showPredictionPoints(false);

            // Center cursor initially
            this.cursorX = window.innerWidth / 2;
            this.cursorY = window.innerHeight / 2;
            this.lastNoseX = this.cursorX;
            this.lastNoseY = this.cursorY;

            this.isStarted = true;
            
            // Transition to main menu (unless suppressed)
            setTimeout(() => {
                const introOverlay = document.getElementById('intro-overlay');
                const mainMenu = document.getElementById('overlay');
                if (introOverlay) introOverlay.classList.add('hidden');
                
                if (!this.suppressAutoUI) {
                    if (mainMenu) mainMenu.classList.remove('hidden');
                }
                
                const startBtn = document.getElementById('start-btn');
                const bigMouthBtn = document.getElementById('big-mouth-btn');
                const uncleSamBtn = document.getElementById('uncle-sam-btn');
                const glassBtn = document.getElementById('glass-btn');
                const spaceEvadersBtn = document.getElementById('space-evaders-btn');
                const starHordeBtn = document.getElementById('star-horde-btn');
                if(startBtn) startBtn.classList.remove('hidden');
                if(bigMouthBtn) bigMouthBtn.classList.remove('hidden');
                if(uncleSamBtn) uncleSamBtn.classList.remove('hidden');
                if(glassBtn) glassBtn.classList.remove('hidden');
                if(spaceEvadersBtn) spaceEvadersBtn.classList.remove('hidden');
                if(starHordeBtn) starHordeBtn.classList.remove('hidden');
            }, 800);

            return true;
        } catch (err) {
            console.error(err);
            if (typeof webgazer !== 'undefined') webgazer.end();
            this.showError("Initialization Failed", err.message);
            return false;
        }
    },

    startCalibration(onFinishedCallback) {
        if(onFinishedCallback) this.onCalibrateFinished = onFinishedCallback;
        
        const facialHud = document.getElementById('facial-hud');
        if(facialHud) facialHud.style.display = 'none';

        const calibStatus = document.getElementById('calib-status');
        const calibHint = document.getElementById('calib-hint');
        const progressBar = document.getElementById('nose-calib-progress');
        const calibOverlay = document.getElementById('calib-overlay');
        const calibNoseDot = document.getElementById('calib-nose-dot');

        if (progressBar) progressBar.style.width = '0%';
        if (calibStatus) calibStatus.innerText = 'Detecting your face...';
        if (calibHint) calibHint.innerText = 'Position your face in the camera';
        if (calibOverlay) calibOverlay.classList.remove('hidden');
        if (calibNoseDot) calibNoseDot.style.display = 'none';
        
        this.lastNoseX = -100;
        this.lastNoseY = -100;

        const crosshair = document.createElement('div');
        crosshair.className = 'calib-crosshair';
        document.body.appendChild(crosshair);

        let noseCalibFrames = 0;
        const targetFrames = 30;
        let tempX = 0;
        let tempY = 0;
        let faceDetected = false;
        let waitingFrames = 0;

        const skipBtn = document.getElementById('skip-calib-btn');

        const calibInt = setInterval(() => {
            let positions = null;
            try {
                positions = webgazer.getTracker().getPositions();
            } catch (e) { }

            if (positions && positions.length > 60) {
                if (!faceDetected) {
                    faceDetected = true;
                    if (calibStatus) {
                        calibStatus.innerText = '✓ Face detected!';
                        calibStatus.classList.add('fade-in-up');
                    }
                    if (calibHint) calibHint.innerText = 'Look at the crosshair — hold still...';
                    if (calibNoseDot) calibNoseDot.style.display = 'block';
                }

                const nose = positions[62] || positions[37];
                const appContainer = document.getElementById(this.appContainerId) || document.body;
                const screenW = appContainer.clientWidth;
                const screenH = appContainer.clientHeight;
                const liveX = screenW / 2 - (nose[0] - (tempX / Math.max(noseCalibFrames, 1))) * this.noseSensitivity;
                const liveY = screenH / 2 + (nose[1] - (tempY / Math.max(noseCalibFrames, 1))) * this.noseSensitivity;
                
                if (calibNoseDot) {
                    calibNoseDot.style.left = (noseCalibFrames > 0 ? liveX : screenW / 2) + 'px';
                    calibNoseDot.style.top = (noseCalibFrames > 0 ? liveY : screenH / 2) + 'px';
                }

                waitingFrames++;
                if (waitingFrames < 5) return;

                tempX += nose[0];
                tempY += nose[1];
                noseCalibFrames++;

                const pct = Math.round(noseCalibFrames / targetFrames * 100);
                if (progressBar) progressBar.style.width = pct + '%';

                if (noseCalibFrames >= Math.round(targetFrames * 0.5) && calibStatus) {
                    calibStatus.innerText = '⏳ Almost there...';
                }
            }

            if (noseCalibFrames >= targetFrames) {
                finishCalib();
            }
        }, 30);

        const finishCalib = () => {
            clearInterval(calibInt);

            this.noseCenter.x = (noseCalibFrames > 0) ? (tempX / noseCalibFrames) : 320;
            this.noseCenter.y = (noseCalibFrames > 0) ? (tempY / noseCalibFrames) : 240;

            if (calibStatus) calibStatus.innerText = '🎯 Calibrated!';
            if (calibHint) calibHint.innerText = 'Let\'s go!';
            if (progressBar) progressBar.style.width = '100%';

            if (navigator.vibrate) navigator.vibrate(50);

            setTimeout(() => {
                const positions = webgazer.getTracker().getPositions();
                
                // Requirement: 65+ landmarks for full feature set
                if (positions && positions.length > 65) {
                    try {
                        const faceW = this.getDistance(positions[1], positions[13]);
                        const faceH = this.getDistance(positions[33], positions[7]);

                        this.neutralBaselines.faceWidth = faceW;
                        this.neutralBaselines.faceHeight = faceH;
                        this.neutralBaselines.mouthWidth = this.getDistance(positions[44], positions[50]);
                        this.neutralBaselines.mouthHeight = this.getDistance(positions[60], positions[57]);
                        this.neutralBaselines.baseMAR = this.neutralBaselines.mouthHeight / Math.max(this.neutralBaselines.mouthWidth, 1);
                        this.neutralBaselines.eyebrowDist = this.getDistance(positions[16], positions[24]) / faceH;
                        this.neutralBaselines.noseToChin = this.getDistance(positions[62], positions[7]) / faceH;
                        
                        const dy = positions[32][1] - positions[27][1];
                        const dx = positions[32][0] - positions[27][0];
                        this.neutralBaselines.baseTiltAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                        this.neutralBaselines.captured = true;
                        console.log("FaceTracker: Neutral baselines captured successfully.", this.neutralBaselines);
                    } catch (e) {
                        console.error("FaceTracker: Critical error during baseline calculation:", e);
                        if (calibStatus) calibStatus.innerText = "⚠️ Calibration Error: Check Console";
                    }
                } else {
                    const count = positions ? positions.length : 0;
                    console.error(`FaceTracker: Insufficient landmarks (${count}/66 detected). Check lighting and centering.`);
                    if (calibStatus) calibStatus.innerText = "⚠️ Low Tracking Quality";
                }

                crosshair.remove();
                if (calibNoseDot) calibNoseDot.style.display = 'none';
                if (calibOverlay) calibOverlay.classList.add('hidden');
                
                this.onCalibrateFinished();
            }, 500);
        };

        if (skipBtn) {
            skipBtn.onclick = () => finishCalib();
        }
    },

    update() {
        if (!this.isStarted) return;
        this.updateFacialExpressions();
        this.updateNoseTracking();
    },

    // Compute inner mouth area using Shoelace formula on inner lip landmarks
    _computeInnerMouthArea(positions) {
        // Inner lip indices: 56, 57, 58, 59, 60, 61 (varies by model)
        // Using the points we know: 57 (top inner), 61 (bottom inner), 
        // 56 (left inner), 60 (right inner), plus intermediates
        const innerPoints = [56, 57, 58, 59, 60, 61].map(i => positions[i]).filter(Boolean);
        if (innerPoints.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < innerPoints.length; i++) {
            const j = (i + 1) % innerPoints.length;
            area += innerPoints[i][0] * innerPoints[j][1];
            area -= innerPoints[j][0] * innerPoints[i][1];
        }
        return Math.abs(area) / 2;
    },

    updateFacialExpressions() {
        let positions = null;
        try {
            positions = webgazer.getTracker().getPositions();
        } catch (e) { return; }
        if (!positions || positions.length < 65) return;

        if (this.showDebugLandmarks && this.debugCanvas) {
            const ctx = this.debugCanvas.getContext('2d');
            this.debugCanvas.width = this.debugCanvas.clientWidth;
            this.debugCanvas.height = this.debugCanvas.clientHeight;
            ctx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
            ctx.fillStyle = "#00f2ff";
            ctx.font = "6px sans-serif";
            positions.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p[0], p[1], 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillText(i, p[0] + 2, p[1]);
            });
        }

        const faceWidth = this.getDistance(positions[1], positions[13]);
        const faceHeight = this.getDistance(positions[33], positions[7]);
        const md = this.mouthDetection;
        const emaResponsive = md.smoothing;       // higher = more responsive
        const emaSmooth = 1 - md.smoothing;        // complement

        // ─── Compute raw mouth metrics ───
        // 1) Vertical MAR: inner lip vertical / outer lip width
        const innerTop = positions[57];   // top inner lip
        const innerBot = positions[61];   // bottom inner lip
        const outerLeft = positions[44];  // left mouth corner
        const outerRight = positions[50]; // right mouth corner
        
        const currentMouthHeight = this.getDistance(innerTop, innerBot);
        const currentMouthWidth = this.getDistance(outerLeft, outerRight);
        const currentMAR = currentMouthHeight / Math.max(currentMouthWidth, 1);
        
        // 2) Inner mouth area ratio (normalized by face area)
        const innerArea = this._computeInnerMouthArea(positions);
        const faceArea = faceWidth * faceHeight;
        const areaRatio = innerArea / Math.max(faceArea, 1);
        
        // 3) Chin-nose separation (jaw drop indicator)
        const noseTip = positions[62];
        const chin = positions[7];
        const currentNoseToChin = this.getDistance(noseTip, chin) / Math.max(faceHeight, 1);

        // ─── Compute normalized openness for each metric ───
        const baseMAR = this.neutralBaselines.captured ? this.neutralBaselines.baseMAR : 0.15;
        const baseNoseToChin = this.neutralBaselines.captured ? this.neutralBaselines.noseToChin : 0.45;
        
        // Neutral area baseline (captured or estimated)
        if (!this.neutralBaselines._baseAreaRatio && this.neutralBaselines.captured) {
            // Compute on first frame after calibration
            this.neutralBaselines._baseAreaRatio = areaRatio;
        }
        const baseAreaRatio = this.neutralBaselines._baseAreaRatio || 0.005;
        
        const marScore = Math.min(Math.max(currentMAR - baseMAR, 0) / 0.35, 1);
        const areaScore = Math.min(Math.max(areaRatio - baseAreaRatio, 0) / 0.03, 1);
        const chinScore = Math.min(Math.max((currentNoseToChin / baseNoseToChin) - 1, 0) / 0.25, 1);

        // ─── Determine isMouthOpen based on detector logic ───
        const metrics = { marScore, areaScore, chinScore };
        this.evaluateDetector(this, metrics);
        
        // Expose metrics for multi-calibration
        this._lastMetrics = metrics;
        this._lastLandmarks = positions;

        // ─── Eyebrow, pucker, tilt (unchanged) ───
        const currentEyebrowDist = this.getDistance(positions[16], positions[24]) / faceHeight;
        const baseEyebrowDist = this.neutralBaselines.captured ? this.neutralBaselines.eyebrowDist : 0.08;
        const targetEyebrowRaise = Math.min(Math.max((currentEyebrowDist / baseEyebrowDist) - 1, 0) / 0.35, 1);
        this.eyebrowRaise = this.eyebrowRaise * 0.7 + targetEyebrowRaise * 0.3;

        const puckerRatio = currentMouthWidth / faceWidth;
        const basePuckerRatio = this.neutralBaselines.captured ? (this.neutralBaselines.mouthWidth / (this.neutralBaselines.faceWidth || faceWidth)) : 0.35;
        const targetPuckerStrength = Math.min(Math.max(1 - (puckerRatio / basePuckerRatio), 0) / 0.4, 1);
        this.puckerStrength = this.puckerStrength * 0.7 + targetPuckerStrength * 0.3;

        const dy = positions[32][1] - positions[27][1];
        const dx = positions[32][0] - positions[27][0];
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        const relativeAngle = currentAngle - (this.neutralBaselines.captured ? this.neutralBaselines.baseTiltAngle : 0);
        const targetHeadTilt = Math.min(Math.max(Math.abs(relativeAngle) / 20, 0), 1);
        this.headTilt = this.headTilt * 0.8 + targetHeadTilt * 0.2;

        // isRoaring for standard/PoC mode (combines all triggers)
        const isEyebrowRaised = this.eyebrowRaise > 0.6;
        const isPuckering = this.puckerStrength > 0.7;
        this.isRoaring = this.isMouthOpen || isEyebrowRaised || isPuckering;

        // ─── UI gauge updates ───
        const gaugeMouth = document.getElementById('gauge-mouth');
        const gaugeEyebrows = document.getElementById('gauge-eyebrows');
        const gaugePucker = document.getElementById('gauge-pucker');
        const gaugeTilt = document.getElementById('gauge-tilt');

        if (gaugeMouth) {
            gaugeMouth.style.width = (this.mouthOpenness * 100) + '%';
            if (this.isMouthOpen) gaugeMouth.classList.add('active'); else gaugeMouth.classList.remove('active');
        }
        if (gaugeEyebrows) {
            gaugeEyebrows.style.width = (this.eyebrowRaise * 100) + '%';
            if (isEyebrowRaised) gaugeEyebrows.classList.add('active'); else gaugeEyebrows.classList.remove('active');
        }
        if (gaugePucker) {
            gaugePucker.style.width = (this.puckerStrength * 100) + '%';
            if (isPuckering) gaugePucker.classList.add('active'); else gaugePucker.classList.remove('active');
        }
        if (gaugeTilt) {
            gaugeTilt.style.width = (this.headTilt * 100) + '%';
            if (this.headTilt > 0.8) gaugeTilt.classList.add('active'); else gaugeTilt.classList.remove('active');
        }

        // ─── Live debug readout ───
        const debugOpenness = document.getElementById('debug-mouth-openness');
        const debugState = document.getElementById('debug-mouth-state');
        const debugVelocity = document.getElementById('debug-mouth-velocity');
        if (debugOpenness) debugOpenness.textContent = this.mouthOpenness.toFixed(3);
        if (debugState) {
            debugState.textContent = this.isMouthOpen ? 'OPEN' : 'CLOSED';
            debugState.style.color = this.isMouthOpen ? '#f43f5e' : '#22d3ee';
        }
        if (debugVelocity) debugVelocity.textContent = (this.mouthVelocity >= 0 ? '+' : '') + this.mouthVelocity.toFixed(4);
    },

    updateNoseTracking() {
        let positions = null;
        try {
            positions = webgazer.getTracker().getPositions();
        } catch (e) { return; }
        if (!positions || positions.length < 60) return;

        const nose = positions[62] || positions[37];
        const rawX = nose[0];
        const rawY = nose[1];

        const dx = (rawX - this.noseCenter.x);
        const dy = (rawY - this.noseCenter.y);

        const appContainer = document.getElementById(this.appContainerId) || document.body;
        const screenW = appContainer.clientWidth;
        const screenH = appContainer.clientHeight;

        const targetX = (screenW / 2) - (dx * this.noseSensitivity);
        const targetY = (screenH / 2) + (dy * this.noseSensitivity);

        if (this.lastNoseX === -100) {
            this.cursorX = targetX;
            this.cursorY = targetY;
        } else {
            this.cursorX = this.cursorX * (1 - this.noseSmoothing) + targetX * this.noseSmoothing;
            this.cursorY = this.cursorY * (1 - this.noseSmoothing) + targetY * this.noseSmoothing;
        }

        this.lastNoseX = this.cursorX;
        this.lastNoseY = this.cursorY;
    }
};
