/**
 * End-to-end test: Verify the FIXED uploadToHF format.
 * Tests all 3 upload paths: smoke test, raw data, aggregated results.
 * Then verifies each file exists in the repo tree.
 * 
 * Run: node scratch/test_hf_e2e.js
 */

const fs = require('fs');

function getToken() {
    try {
        return JSON.parse(fs.readFileSync('auth.json', 'utf8')).hf_token;
    } catch {
        return null;
    }
}

const TOKEN = getToken();
const REPO = "Y3/mouth_status";

async function uploadToHF(path, content) {
    // This mirrors the FIXED function in big_mouth.html
    const url = `https://huggingface.co/api/datasets/${REPO}/commit/main`;
    const utf8SafeBase64 = Buffer.from(content).toString('base64');

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            summary: `Upload ${path} via Big Mouth UI`,
            files: [{
                path: path,
                content: utf8SafeBase64,
                encoding: "base64"
            }]
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Upload failed with status ${res.status}`);
    }

    const result = await res.json();

    // Verify persistence
    const dir = path.split('/').slice(0, -1).join('/');
    const treeUrl = `https://huggingface.co/api/datasets/${REPO}/tree/main/${dir}`;
    const verifyRes = await fetch(treeUrl, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    if (verifyRes.ok) {
        const files = await verifyRes.json();
        const found = files.some(f => f.path === path);
        if (!found) throw new Error(`File "${path}" not found in repo tree after upload!`);
    }

    return result;
}

async function main() {
    if (!TOKEN) { console.error("No token in auth.json"); process.exit(1); }

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rid = Math.random().toString(36).substring(7);

    // Simulate calibration data
    const fakeRecords = Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() + i * 30,
        metrics: {
            marScore: 0.1 + Math.random() * 0.5,
            areaScore: 0.05 + Math.random() * 0.3,
            chinScore: 0.02 + Math.random() * 0.2,
            headVelocity: Math.random() * 2,
            pitchDelta: (Math.random() - 0.5) * 0.2,
            yawFactor: (Math.random() - 0.5) * 0.1
        },
        truth: i % 2 === 0 // alternating open/closed
    }));

    const fakeResults = [
        { id: "hyst-0.38", acc: 0.95, precision: 0.93, recall: 0.97, f1: 0.95, config: {} },
        { id: "hybrid-c0.6", acc: 0.92, precision: 0.90, recall: 0.94, f1: 0.92, config: {} }
    ];

    console.log("=== E2E Test: All 3 Upload Paths ===\n");

    // 1. Smoke test
    console.log("1. Smoke test upload...");
    const smokePath = `data/test/smoke_${Date.now()}.json`;
    await uploadToHF(smokePath, JSON.stringify({ test: true, timestamp: new Date().toISOString() }));
    console.log("   ✅ Smoke test passed\n");

    // 2. Raw data
    console.log("2. Raw data upload...");
    const rawPath = `data/raw/${ts}_${rid}.json`;
    await uploadToHF(rawPath, JSON.stringify({
        metadata: { timestamp: new Date().toISOString(), device: "test-script", version: "test" },
        records: fakeRecords
    }));
    console.log("   ✅ Raw data uploaded and verified\n");

    // 3. Aggregated results
    console.log("3. Aggregated results upload...");
    const aggPath = `data/agg/${ts}.json`;
    await uploadToHF(aggPath, JSON.stringify({
        metadata: { timestamp: new Date().toISOString(), version: "test" },
        results: fakeResults
    }));
    console.log("   ✅ Aggregated results uploaded and verified\n");

    console.log("🎉 ALL 3 TESTS PASSED — Upload fix is working!");
}

main().catch(err => {
    console.error("❌ FAILED:", err.message);
    process.exit(1);
});
