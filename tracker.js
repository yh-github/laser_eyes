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
        if (statusBox && loadingMsg && actionMsg) {
            statusBox.classList.remove('hidden');
            loadingMsg.innerText = title;
            actionMsg.innerText = action;
            const startBtn = document.getElementById('start-btn');
            if(startBtn) startBtn.classList.remove('hidden');
        } else {
            console.error(title, action);
        }
    },

    async init() {
        const statusBox = document.getElementById('status-box');
        const loadingMsg = document.getElementById('loading-msg');
        const actionMsg = document.getElementById('action-msg');
        
        if (statusBox) statusBox.classList.remove('hidden');
        if (loadingMsg) loadingMsg.innerText = "Initializing AI & Camera...";
        if (actionMsg) actionMsg.innerText = "Please accept camera permissions if prompted.";

        try {
            if (window.webgazerLoadError || typeof webgazer === 'undefined') {
                throw new Error("LibraryLoadError");
            }

            webgazer.params.showVideo = true;
            webgazer.params.showPredictionPoints = false;
            webgazer.setGazeListener(() => { });

            if (loadingMsg) loadingMsg.innerText = "Downloading AI Models (15MB)...";
            if (actionMsg) actionMsg.innerText = "This might take 10-20 seconds on first load.";

            await webgazer.begin();

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

            this.isStarted = true;
            if (loadingMsg) loadingMsg.innerText = "AI Ready!";
            if (actionMsg) actionMsg.innerText = "Model loaded and camera active.";
            
            const startBtn = document.getElementById('start-btn');
            const bigMouthBtn = document.getElementById('big-mouth-btn');
            if(startBtn) startBtn.classList.remove('hidden');
            if(bigMouthBtn) bigMouthBtn.classList.remove('hidden');

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
                if (positions && positions.length > 60) {
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
                    console.log("Neutral baselines captured:", this.neutralBaselines);
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

        const currentMouthHeight = this.getDistance(positions[60], positions[57]);
        const currentMouthWidth = this.getDistance(positions[44], positions[50]);
        const currentMAR = currentMouthHeight / Math.max(currentMouthWidth, 1);
        
        const baseMAR = this.neutralBaselines.captured ? this.neutralBaselines.baseMAR : 0.15;
        const targetMouthOpenness = Math.min(Math.max(currentMAR - baseMAR, 0) / 0.35, 1);
        this.mouthOpenness = this.mouthOpenness * 0.7 + targetMouthOpenness * 0.3;

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

        const isEyebrowRaised = this.eyebrowRaise > 0.6;
        const isPuckering = this.puckerStrength > 0.7;
        const isMouthOpen = this.mouthOpenness > 0.3;
        
        this.isRoaring = isMouthOpen || isEyebrowRaised || isPuckering;

        // UI Updates if elements exist
        const gaugeMouth = document.getElementById('gauge-mouth');
        const gaugeEyebrows = document.getElementById('gauge-eyebrows');
        const gaugePucker = document.getElementById('gauge-pucker');
        const gaugeTilt = document.getElementById('gauge-tilt');

        if (gaugeMouth) {
            gaugeMouth.style.width = (this.mouthOpenness * 100) + '%';
            if (isMouthOpen) gaugeMouth.classList.add('active'); else gaugeMouth.classList.remove('active');
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
