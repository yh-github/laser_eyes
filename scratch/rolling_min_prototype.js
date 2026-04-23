/**
 * Rolling Minimum Prototype: High-end tracking logic.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;

    console.log(`Testing Rolling Baseline on ${records.length} frames...`);

    function evaluate(windowSize, threshold) {
        let tp = 0, fp = 0, fn = 0, tn = 0;
        let history = [];

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const mouthW = getDistance(r.mr[0], r.mr[1], r.mr[12], r.mr[13]);
            const mouthH = getDistance(r.mr[4], r.mr[5], r.mr[18], r.mr[19]);
            const currentMAR = mouthH / Math.max(mouthW, 1);

            // Update local minimum history
            history.push(currentMAR);
            if (history.length > windowSize) history.shift();
            
            const localMin = Math.min(...history);
            const relativeOpenness = currentMAR - localMin;

            const isPredicted = relativeOpenness > threshold;

            if (isPredicted && r.truth) tp++;
            else if (isPredicted && !r.truth) fp++;
            else if (!isPredicted && r.truth) fn++;
            else tn++;
        }

        const p = tp / (tp + fp) || 0;
        const rec = tp / (tp + fn) || 0;
        const f1 = (p + rec) > 0 ? (2 * p * rec) / (p + rec) : 0;
        return { f1, p, rec };
    }

    let best = { f1: 0 };

    console.log("Sweeping Window Sizes and Thresholds...");
    
    for (let w = 30; w <= 300; w += 30) { // 1s to 10s at 30fps
        for (let t = 0.05; t <= 0.4; t += 0.05) {
            const res = evaluate(w, t);
            if (res.f1 > best.f1) {
                best = { ...res, config: { windowSize: w, threshold: t } };
            }
        }
    }

    console.log("\n--- ROLLING MINIMUM RESULTS ---");
    console.log(`F1 SCORE:  ${(best.f1 * 100).toFixed(2)}%`);
    console.log(`Precision: ${(best.p * 100).toFixed(2)}%`);
    console.log(`Recall:    ${(best.rec * 100).toFixed(2)}%`);
    console.log("\nWinning Config:");
    console.log(JSON.stringify(best.config, null, 2));
}

analyze();
