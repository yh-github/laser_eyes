/**
 * Geometric Research: Finding the "Human-Like" Shape Invariants.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;

    console.log(`Analyzing ${records.length} frames for Geometric Invariants...`);

    const candidates = [
        { name: 'Raw Aspect Ratio (60-57 / 44-50)', calc: (r) => {
            const mr = r.mr;
            const w = getDistance(mr[0], mr[1], mr[12], mr[13]);
            const h = getDistance(mr[32], mr[33], mr[26], mr[27]);
            return h / Math.max(w, 1);
        }},
        { name: 'Lip Curvature (Inner Triangle)', calc: (r) => {
            const mr = r.mr;
            // Angle between (Left Corner, Mid Top, Right Corner)
            // As mouth opens, this triangle becomes taller
            const w = getDistance(mr[0], mr[1], mr[12], mr[13]);
            const h = getDistance((mr[0]+mr[12])/2, (mr[1]+mr[13])/2, mr[32], mr[33]);
            return h / Math.max(w, 0.1);
        }},
        { name: 'Nose-to-Chin Stretch', calc: (r) => {
            const rr = r.rr; // 62 (nose), 7 (chin)
            return getDistance(rr[12], rr[13], rr[2], rr[3]);
        }}
    ];

    candidates.forEach(cand => {
        const vals = records.map(r => cand.calc(r));
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        let bestF1 = 0;
        let bestThresh = 0;
        for (let i = 0; i <= 100; i++) {
            const t = min + (i/100) * (max - min);
            let tp = 0, fp = 0, fn = 0;
            for (let j = 0; j < records.length; j++) {
                const pred = vals[j] > t;
                if (pred && records[j].truth) tp++;
                else if (pred && !records[j].truth) fp++;
                else if (!pred && records[j].truth) fn++;
            }
            const p = tp / (tp + fp) || 0;
            const rec = tp / (tp + fn) || 0;
            const f1 = (p + rec) > 0 ? (2 * p * rec) / (p + rec) : 0;
            if (f1 > bestF1) { bestF1 = f1; bestThresh = t; }
        }
        cand.bestF1 = bestF1;
        cand.bestThresh = bestThresh;
    });

    console.log("\n--- INVARIANT PERFORMANCE ---");
    candidates.sort((a,b) => b.bestF1 - a.bestF1).forEach(c => {
        console.log(`${c.name.padEnd(35)} | F1: ${c.bestF1.toFixed(3)} | Threshold: ${c.bestThresh.toFixed(4)}`);
    });
}

analyze();
