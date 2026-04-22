/**
 * Test: Verify correct HF commit API format.
 * 
 * The API uses "files" not "actions"!
 * 
 * Run: node scratch/test_hf_upload_v2.js
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

async function uploadCorrectFormat(path, content, summary) {
    const url = `https://huggingface.co/api/datasets/${REPO}/commit/main`;

    // UTF-8 safe base64
    const base64Content = Buffer.from(content).toString('base64');

    const body = {
        summary: summary,
        files: [{
            path: path,
            content: base64Content,
            encoding: "base64"
        }]
    };

    console.log(`\nUploading to: ${url}`);
    console.log(`File path: ${path}`);
    console.log(`Body keys: ${Object.keys(body)}`);

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log(`HTTP ${res.status}:`, JSON.stringify(result));
    return { ok: res.ok, result };
}

async function verifyFileExists(path) {
    const dir = path.split('/').slice(0, -1).join('/');
    const url = `https://huggingface.co/api/datasets/${REPO}/tree/main/${dir}`;
    
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });

    if (!res.ok) {
        console.log(`  Verify: Directory ${dir} returns HTTP ${res.status}`);
        return false;
    }

    const files = await res.json();
    const found = files.some(f => f.path === path);
    console.log(`  Verify: File "${path}" ${found ? '✅ EXISTS' : '❌ NOT FOUND'} in tree`);
    return found;
}

async function main() {
    if (!TOKEN) {
        console.error("No token found in auth.json");
        process.exit(1);
    }

    const timestamp = Date.now();
    const testPath = `data/test/verify_format_${timestamp}.json`;
    const testContent = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        format: "correct_files_format"
    });

    console.log("=== Test: Upload using CORRECT 'files' format ===");
    const { ok } = await uploadCorrectFormat(
        testPath,
        testContent,
        `Verify correct format at ${timestamp}`
    );

    if (ok) {
        console.log("\n--- Verifying file persistence ---");
        // Small delay for HF to process
        await new Promise(r => setTimeout(r, 2000));
        const exists = await verifyFileExists(testPath);
        
        if (exists) {
            console.log("\n🎉 SUCCESS! File persisted correctly!");
        } else {
            console.log("\n❌ FAILED: File not found in tree despite 200 response.");
        }
    } else {
        console.log("\n❌ Upload returned error.");
    }
}

main().catch(console.error);
