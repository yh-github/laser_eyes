/**
 * Optimized Deep Research Tool
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;

    console.log(`Analyzing ${records.length} frames...`);

    const candidates = [
        { name: 'Inner MAR (60-57)', calc: (r) => getDistance(r.mr[32], r.mr[33], r.mr[26], r.mr[27]) / Math.max(getDistance(r.mr[0], r.mr[1], r.mr[12], r.mr[13]), 1) },
        { name: 'Outer MAR (46-53)', calc: (r) => getDistance(r.mr[4], r.mr[5], r.mr[18], r.mr[19]) / Math.max(getDistance(r.mr[0], r.mr[1], r.mr[12], r.mr[13]), 1) },
        { name: 'Chin Drop (62-7)', calc: (r) => getDistance(r.rr[12], r.rr[13], r.rr[2], r.rr[3]) },
        { name: 'Mouth Area (Approx)', calc: (r) => {
            const w = getDistance(r.mr[0], r.mr[1], r.mr[12], r.mr[13]);
            const h = getDistance(r.mr[32], r.mr[33], r.mr[26], r.mr[27]);
            return w * h;
        }}
    ];

    candidates.forEach(cand => {
        // Pre-calculate values to avoid repeated math
        const vals = records.map(r => cand.calc(r));
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

        console.log(`\nData Check [${cand.name}]: Min=${min.toFixed(4)}, Max=${max.toFixed(4)}, Avg=${avg.toFixed(4)}`);
        
        if (min === max) {
            console.log(`⚠️ Warning: ${cand.name} data is DEAD (no variance).`);
            cand.bestF1 = 0;
            return;
        }

        let bestF1 = 0;
        let bestThresh = 0;
        
        // 50-step sweep is plenty for research
        for (let i = 0; i <= 50; i++) {
            const t = min + (i / 50) * (max - min);
            let tp = 0, fp = 0, fn = 0;
            for (let j = 0; j < records.length; j++) {
                const pred = vals[j] > t;
                const truth = records[j].truth;
                if (pred && truth) tp++;
                else if (pred && !truth) fp++;
                else if (!pred && truth) fn++;
            }
            const p = tp / (tp + fp) || 0;
            const r = tp / (tp + fn) || 0;
            const f1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;
            if (f1 > bestF1) {
                bestF1 = f1;
                bestThresh = t;
            }
        }
        cand.bestF1 = bestF1;
        cand.bestThresh = bestThresh;
    });

    console.log("\n--- Metric Performance Comparison ---");
    candidates.sort((a, b) => b.bestF1 - a.bestF1).forEach(c => {
        console.log(`${c.name.padEnd(20)} | F1: ${c.bestF1.toFixed(3)} | Opt. Threshold: ${c.bestThresh.toFixed(4)}`);
    });

    // Best method Pitch Bias check
    const top = candidates[0];
    if (top.bestF1 > 0) {
        console.log(`\n--- Pitch Bias Audit for ${top.name} ---`);
        const closed = records.filter(r => !r.truth);
        const pitchLow = closed.filter(r => r.m.pitchDelta < -0.1);
        const pitchHigh = closed.filter(r => r.m.pitchDelta > 0.1);
        
        if (pitchLow.length > 0) {
            const avgLow = pitchLow.reduce((a, r) => a + top.calc(r), 0) / pitchLow.length;
            console.log(`Looking DOWN (Closed) | Avg Metric: ${avgLow.toFixed(4)}`);
        }
        if (pitchHigh.length > 0) {
            const avgHigh = pitchHigh.reduce((a, r) => a + top.calc(r), 0) / pitchHigh.length;
            console.log(`Looking UP (Closed)   | Avg Metric: ${avgHigh.toFixed(4)}`);
        }
    }
}

analyze();
