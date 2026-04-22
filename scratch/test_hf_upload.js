/**
 * Test: Verify the FIXED uploadToHF logic (using 'summary' field).
 * This mirrors exactly what big_mouth.html now does.
 * Run: node scratch/test_hf_upload.js
 */

const fs = require('fs');
const path = require('path');

async function getToken() {
    try {
        const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'auth.json'), 'utf8'));
        if (auth.hf_token) return auth.hf_token;
    } catch {}
    console.error("No token found. Create auth.json with { \"hf_token\": \"hf_...\" }");
    process.exit(1);
}

/** Mirrors the FIXED uploadToHF from big_mouth.html */
async function uploadToHF(token, filePath, content) {
    const repo = "Y3/mouth_status";
    const url = `https://huggingface.co/api/datasets/${repo}/commit/main`;

    const utf8SafeBase64 = Buffer.from(content).toString('base64');

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            actions: [
                {
                    action: "add",
                    path: filePath,
                    content: utf8SafeBase64,
                    encoding: "base64"
                }
            ],
            summary: `Upload ${filePath} via Big Mouth UI`  // FIXED: was 'commit_message'
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Upload failed with status ${res.status}`);
    }
    return await res.json();
}

async function main() {
    const token = await getToken();
    console.log(`Token: ${token.substring(0, 6)}...${token.substring(token.length - 4)}\n`);

    // Test 1: Smoke test upload (same as what happens after first calib point)
    console.log("--- Test: Smoke test upload (mirrors first-point check) ---");
    const smokePath = `data/test/smoke_${Date.now()}.json`;
    const smokeContent = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        version: "test",
        samples: 42
    });
    try {
        const result = await uploadToHF(token, smokePath, smokeContent);
        console.log(`  ✅ PASSED — commit: ${result.commitOid?.substring(0, 8)}`);
    } catch (err) {
        console.log(`  ❌ FAILED — ${err.message}`);
        process.exit(1);
    }

    // Test 2: Raw data upload (same as what happens at end of calibration)
    console.log("\n--- Test: Raw data upload (mirrors end-of-calibration sync) ---");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawPath = `data/raw/${timestamp}_test.json`;
    const rawContent = JSON.stringify({
        metadata: {
            timestamp: new Date().toISOString(),
            device: "test-script",
            version: "test"
        },
        records: [{ timestamp: Date.now(), truth: false, metrics: { mar: 0.1 } }]
    });
    try {
        const result = await uploadToHF(token, rawPath, rawContent);
        console.log(`  ✅ PASSED — commit: ${result.commitOid?.substring(0, 8)}`);
    } catch (err) {
        console.log(`  ❌ FAILED — ${err.message}`);
        process.exit(1);
    }

    // Test 3: Aggregated results upload
    console.log("\n--- Test: Aggregated results upload ---");
    const aggPath = `data/agg/${timestamp}.json`;
    const aggContent = JSON.stringify({
        metadata: { timestamp: new Date().toISOString(), version: "test" },
        results: [{ id: "test-candidate", acc: 0.95, f1: 0.9 }]
    });
    try {
        const result = await uploadToHF(token, aggPath, aggContent);
        console.log(`  ✅ PASSED — commit: ${result.commitOid?.substring(0, 8)}`);
    } catch (err) {
        console.log(`  ❌ FAILED — ${err.message}`);
        process.exit(1);
    }

    console.log("\n🎉 All tests passed! The fix is verified.");
}

main();
