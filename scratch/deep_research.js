/**
 * Deep Research Tool: Evaluates multiple landmark-based formulas 
 * to find the absolute most stable signal for mouth openness.
 */

const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function analyze() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records;
    const baselines = data.metadata.baselines;

    console.log(`Analyzing ${records.length} frames for session ${data.metadata.timestamp}...`);

    const candidates = [
        { name: 'Legacy MAR (from metrics)', calc: (r) => r.m.marScore },
        { name: 'Raw Inner MAR (60-57 / 44-50)', calc: (r) => {
            const mr = r.mr;
            // mr indices: 44 is at [0,1], 50 is at [12,13], 60 is at [32,33], 57 is at [26,27]
            // Note: mr is flat array [x44, y44, x45, y45, ...]
            const width = getDistance(mr[0], mr[1], mr[12], mr[13]);
            const height = getDistance(mr[32], mr[33], mr[26], mr[27]);
            return height / Math.max(width, 1);
        }},
        { name: 'Chin Drop (62-7)', calc: (r) => {
            const rr = r.rr; // rr indices: 7 is at [2,3], 62 is at [12,13]
            return getDistance(rr[12], rr[13], rr[2], rr[3]);
        }},
        { name: 'Outer Mouth Aspect (46-53 / 44-50)', calc: (r) => {
            const mr = r.mr;
            const width = getDistance(mr[0], mr[1], mr[12], mr[13]);
            const height = getDistance(mr[4], mr[5], mr[18], mr[19]);
            return height / Math.max(width, 1);
        }}
    ];

    candidates.forEach(cand => {
        let bestF1 = 0;
        let bestThresh = 0;

        // Sweep thresholds for this metric
        const vals = records.map(r => cand.calc(r));
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        for (let t = min; t <= max; t += (max - min) / 100) {
            let tp = 0, fp = 0, fn = 0, tn = 0;
            records.forEach((r, i) => {
                const isPredicted = vals[i] > t;
                if (isPredicted && r.truth) tp++;
                else if (isPredicted && !r.truth) fp++;
                else if (!isPredicted && r.truth) fn++;
                else tn++;
            });
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
        console.log(`${c.name.padEnd(35)} | F1: ${c.bestF1.toFixed(3)} | Thresh: ${c.bestThresh.toFixed(4)}`);
    });

    // Pitch Bias Check for the best candidate
    const top = candidates[0];
    console.log(`\n--- Pitch Bias Check (${top.name}) ---`);
    const openFrames = records.filter(r => r.truth);
    const closedFrames = records.filter(r => !r.truth);

    const pitchGroups = [-0.15, -0.05, 0.05, 0.15];
    pitchGroups.forEach(pCenter => {
        const group = closedFrames.filter(r => Math.abs(r.m.pitchDelta - pCenter) < 0.05);
        if (group.length > 50) {
            const avgVal = group.reduce((acc, r) => acc + top.calc(r), 0) / group.length;
            console.log(`Pitch ~${pCenter.toFixed(2)} | Avg Closed Value: ${avgVal.toFixed(4)}`);
        }
    });
}

analyze();
