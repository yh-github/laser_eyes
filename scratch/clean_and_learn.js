/**
 * Data Sanitizer: Strips transition frames to find the "Steady State" truth.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;

    console.log(`Original: ${records.length} frames.`);

    // 1. Sanitize: Skip the first 45 frames (1.5s) of every state change
    const cleanRecords = [];
    let lastTruth = null;
    let framesInState = 0;

    for (const r of records) {
        if (r.truth !== lastTruth) {
            lastTruth = r.truth;
            framesInState = 0;
        }
        framesInState++;
        
        // Only keep frames after the "Transition Period" (1.5 seconds)
        if (framesInState > 45) {
            cleanRecords.push(r);
        }
    }

    console.log(`Sanitized: ${cleanRecords.length} frames (Steady States Only).`);

    // 2. Re-evaluate the formulas on CLEAN data
    const candidates = [
        { name: 'Outer Aspect', calc: (r) => {
            const mr = r.mr;
            const w = getDistance(mr[0], mr[1], mr[12], mr[13]);
            const h = getDistance(mr[4], mr[5], mr[18], mr[19]);
            return h / Math.max(w, 1);
        }},
        { name: 'Nose-to-Chin', calc: (r) => {
            const rr = r.rr;
            return getDistance(rr[12], rr[13], rr[2], rr[3]);
        }}
    ];

    candidates.forEach(cand => {
        const vals = cleanRecords.map(r => cand.calc(r));
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        let bestF1 = 0;
        let bestThresh = 0;
        for (let i = 0; i <= 100; i++) {
            const t = min + (i/100) * (max - min);
            let tp = 0, fp = 0, fn = 0;
            for (let j = 0; j < cleanRecords.length; j++) {
                const pred = vals[j] > t;
                if (pred && cleanRecords[j].truth) tp++;
                else if (pred && !cleanRecords[j].truth) fp++;
                else if (!pred && cleanRecords[j].truth) fn++;
            }
            const p = tp / (tp + fp) || 0;
            const rec = tp / (tp + fn) || 0;
            const f1 = (p + rec) > 0 ? (2 * p * rec) / (p + rec) : 0;
            if (f1 > bestF1) { bestF1 = f1; bestThresh = t; }
        }
        cand.bestF1 = bestF1;
        cand.bestThresh = bestThresh;
    });

    console.log("\n--- STEADY STATE RESULTS ---");
    candidates.forEach(c => {
        console.log(`${c.name.padEnd(20)} | F1: ${(c.bestF1*100).toFixed(2)}% | Threshold: ${c.bestThresh.toFixed(4)}`);
    });
}

analyze();
