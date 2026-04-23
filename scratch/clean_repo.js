/**
 * Cleanup script to wipe legacy data/ folder in HF repo.
 */
const fs = require('fs');

const TOKEN = JSON.parse(fs.readFileSync('auth.json', 'utf8')).hf_token;
const REPO = "Y3/mouth_status";

async function cleanup() {
    console.log("Listing files...");
    const treeRes = await fetch(`https://huggingface.co/api/datasets/${REPO}/tree/main?recursive=true`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    const files = await treeRes.json();
    const toDelete = files.filter(f => f.path.startsWith('data/')).map(f => ({ path: f.path }));

    if (toDelete.length === 0) {
        console.log("No data/ files found to delete.");
        return;
    }

    console.log(`Deleting ${toDelete.length} files...`);
    const commitRes = await fetch(`https://huggingface.co/api/datasets/${REPO}/commit/main`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            summary: "Clean start: Removing legacy test and incomplete data",
            deletedEntries: toDelete
        })
    });

    const result = await commitRes.json();
    console.log("Result:", result);
}

cleanup().catch(console.error);
