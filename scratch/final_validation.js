/**
 * Final Validation: Replaying the session through the NEW production math.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;
    const baselines = data.metadata.baselines;

    console.log(`Replaying ${records.length} frames through the NEW logic...`);

    // We simulate the "Self-Healing" starting from the captured baseline
    let currentBaseMAR = baselines.baseMAR;
    let tp = 0, fp = 0, fn = 0, tn = 0;

    for (const r of records) {
        const mr = r.mr;
        const w = getDistance(mr[0], mr[1], mr[12], mr[13]);
        const h = getDistance(mr[32], mr[33], mr[26], mr[27]);
        const currentMAR = h / Math.max(w, 1);
        
        const pitchDelta = r.m.pitchDelta || 0;

        // 1. New Tilt-Proof Logic
        const pitchComp = 1.0 + Math.abs(pitchDelta) * 1.2;

        // 2. Self-Healing Logic
        if (currentMAR < currentBaseMAR) {
            currentBaseMAR = currentBaseMAR * 0.5 + currentMAR * 0.5;
        }

        // 3. New Physical Safeguard
        let marScore = Math.min(Math.max((currentMAR * pitchComp) - currentBaseMAR, 0) / 0.35, 1);
        if (currentMAR > 0.45) marScore = Math.max(marScore, 0.8);

        // 4. Threshold Detection (Optimal from previous sweep was ~0.25)
        const isPredicted = marScore > 0.25;

        if (isPredicted && r.truth) tp++;
        else if (isPredicted && !r.truth) fp++;
        else if (!isPredicted && r.truth) fn++;
        else tn++;
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    console.log("\n--- NEW PRODUCTION LOGIC PERFORMANCE ---");
    console.log(`F1 SCORE:  ${(f1 * 100).toFixed(2)}%`);
    console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
    console.log(`Recall:    ${(recall * 100).toFixed(2)}%`);
    
    if (f1 >= 0.95) {
        console.log("\n✅ TARGET ACHIEVED: This logic is production-ready.");
    } else {
        console.log("\n⚠️ Almost there, but still below 95%. Analyzing remaining errors...");
    }
}

analyze();
