/**
 * F1 Optimizer: Replays raw calibration data to find the BEST detector settings.
 * 
 * Usage: node scratch/optimize_f1.js scratch/latest_raw_data.json
 */

const fs = require('fs');

// Mock a detector for replay
function simulate(records, config) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    
    // Simple EMA smoothing simulation
    let smoothedOpenness = 0;
    const smoothing = config.smoothing || 0.3;

    for (const r of records) {
        const m = r.m; // metrics
        const totalWeight = (config.marWeight || 0.6) + (config.chinWeight || 0.4);
        const target = (m.marScore * (config.marWeight || 0.6) + m.chinScore * (config.chinWeight || 0.4)) / totalWeight;
        
        smoothedOpenness = smoothedOpenness * (1 - smoothing) + target * smoothing;
        
        let isPredicted = false;
        if (config.approach === 'hysteresis') {
            if (isPredicted) {
                if (smoothedOpenness < config.closeThresh) isPredicted = false;
            } else {
                if (smoothedOpenness > config.openThresh) isPredicted = true;
            }
        } else {
            isPredicted = smoothedOpenness > config.threshold;
        }

        if (isPredicted && r.truth) tp++;
        else if (isPredicted && !r.truth) fp++;
        else if (!isPredicted && r.truth) fn++;
        else tn++;
    }

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const acc = (tp + tn) / records.length;

    return { f1, precision, recall, acc, config };
}

async function main() {
    const filePath = process.argv[2] || 'scratch/latest_raw_data.json';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const records = data.records;

    console.log(`Analyzing ${records.length} frames...`);

    let best = { f1: -1 };
    
    // --- Parameter Sweep ---
    // We test a range of weights and thresholds
    const marWeights = [0.4, 0.6, 0.8, 1.0];
    const chinWeights = [0.0, 0.2, 0.4];
    const thresholds = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
    const smoothings = [0.2, 0.4, 0.6];

    console.log("Sweeping parameters...");
    
    for (const mw of marWeights) {
        for (const cw of chinWeights) {
            for (const t of thresholds) {
                for (const s of smoothings) {
                    const res = simulate(records, {
                        marWeight: mw,
                        chinWeight: cw,
                        threshold: t,
                        smoothing: s,
                        approach: 'simple'
                    });
                    if (res.f1 > best.f1) best = res;
                }
            }
        }
    }

    console.log("\n🏆 BEST CONFIGURATION FOUND:");
    console.log(JSON.stringify(best, null, 2));
    
    console.log("\nSuggested FaceTracker.mouthDetection update:");
    console.log(JSON.stringify(best.config, null, 2));
}

main().catch(console.error);
