/**
 * Consensus Prototype: Fuses Mouth + Chin + Pitch to hit 0.90+ F1.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;

    console.log(`Fusing signals for ${records.length} frames...`);

    function evaluate(wMouth, wChin, baseThresh, pitchMult, hyst) {
        let tp = 0, fp = 0, fn = 0, tn = 0;
        let isOpen = false;

        for (const r of records) {
            // 1. Calculate Raw Metrics
            const mouthW = getDistance(r.mr[0], r.mr[1], r.mr[12], r.mr[13]);
            const mouthH = getDistance(r.mr[4], r.mr[5], r.mr[18], r.mr[19]);
            const mScore = mouthH / Math.max(mouthW, 1);
            
            const chinDist = getDistance(r.rr[12], r.rr[13], r.rr[2], r.rr[3]);
            const cScore = chinDist / 100; // Normalized roughly

            // 2. Fusion + Pitch Compensation
            const pitch = r.m.pitchDelta || 0;
            const adaptiveThresh = baseThresh + (pitch * pitchMult);
            
            const signal = (mScore * wMouth) + (cScore * wChin);

            // 3. Hysteresis State Machine
            if (isOpen) {
                if (signal < adaptiveThresh * hyst) isOpen = false;
            } else {
                if (signal > adaptiveThresh) isOpen = true;
            }

            if (isOpen && r.truth) tp++;
            else if (isOpen && !r.truth) fp++;
            else if (!isOpen && r.truth) fn++;
            else tn++;
        }

        const p = tp / (tp + fp) || 0;
        const rec = tp / (tp + fn) || 0;
        const f1 = (p + rec) > 0 ? (2 * p * rec) / (p + rec) : 0;
        return { f1, p, rec };
    }

    let best = { f1: 0 };

    console.log("Searching for God Mode config...");
    
    // Quick search for best weights and thresholds
    for (let wM = 0.4; wM <= 1.0; wM += 0.2) {
        for (let baseT = 0.1; baseT <= 0.4; baseT += 0.05) {
            for (let pM = 0.1; pM <= 0.5; pM += 0.2) {
                for (let h = 0.6; h <= 0.8; h += 0.1) {
                    const res = evaluate(wM, 1.0 - wM, baseT, pM, h);
                    if (res.f1 > best.f1) {
                        best = { ...res, config: { wM, baseT, pM, h } };
                    }
                }
            }
        }
    }

    console.log("\n--- CONSENSUS ENGINE RESULTS ---");
    console.log(`F1 SCORE:  ${(best.f1 * 100).toFixed(2)}%`);
    console.log(`Precision: ${(best.p * 100).toFixed(2)}%`);
    console.log(`Recall:    ${(best.rec * 100).toFixed(2)}%`);
    console.log("\nWinning Config:");
    console.log(JSON.stringify(best.config, null, 2));
}

analyze();
