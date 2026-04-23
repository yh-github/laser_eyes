/**
 * Timeline Audit: Visualizing the Signal vs Truth to find lag or sync issues.
 */
const fs = require('fs');

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function audit() {
    const data = JSON.parse(fs.readFileSync('scratch/latest_raw_data.json', 'utf8'));
    const records = data.records.slice(500, 1000); // Look at a 500-frame slice

    console.log("Timeline (A=Aspect, C=Chin, T=Truth)");
    console.log("------------------------------------");

    records.forEach((r, i) => {
        const mr = r.mr;
        const w = getDistance(mr[0], mr[1], mr[12], mr[13]);
        const h = getDistance(mr[32], mr[33], mr[26], mr[27]);
        const aspect = (h / Math.max(w, 1));
        
        const chin = getDistance(r.rr[12], r.rr[13], r.rr[2], r.rr[3]) / 100;

        const aBar = "#".repeat(Math.floor(aspect * 20));
        const cBar = "*".repeat(Math.floor(chin * 5));
        const truth = r.truth ? "OPEN" : "....";

        if (i % 10 === 0) { // Every 10th frame
            console.log(`${truth} | Aspect: ${aBar.padEnd(20)} | Chin: ${cBar.padEnd(20)}`);
        }
    });
}

audit();
