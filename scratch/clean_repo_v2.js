/**
 * Robust cleanup script to wipe legacy data/ folder in HF repo.
 */
const fs = require('fs');

const TOKEN = JSON.parse(fs.readFileSync('auth.json', 'utf8')).hf_token;
const REPO = "Y3/mouth_status";

async function cleanup() {
    // 1. Get the current commit SHA to avoid "does not exist" race conditions
    const repoRes = await fetch(`https://huggingface.co/api/datasets/${REPO}/revision/main`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    const repoInfo = await repoRes.json();
    const parentCommit = repoInfo.sha;
    console.log("Current commit SHA:", parentCommit);

    // 2. Get the tree
    const treeRes = await fetch(`https://huggingface.co/api/datasets/${REPO}/tree/main?recursive=true`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    const files = await treeRes.json();
    const toDelete = files
        .filter(f => f.path.startsWith('data/') && f.type === 'file')
        .map(f => ({ path: f.path }));

    if (toDelete.length === 0) {
        console.log("No data/ files found to delete.");
        return;
    }

    console.log(`Deleting ${toDelete.length} files from commit ${parentCommit.substring(0, 7)}...`);
    
    // 3. Delete in one commit with parent specification
    const commitRes = await fetch(`https://huggingface.co/api/datasets/${REPO}/commit/main`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            summary: "Clean start: Removing legacy test and incomplete data",
            parentCommit: parentCommit,
            deletedEntries: toDelete
        })
    });

    const result = await commitRes.json();
    if (commitRes.ok) {
        console.log("✅ Cleanup successful!", result.commitUrl);
    } else {
        console.error("❌ Cleanup failed:", result);
    }
}

cleanup().catch(console.error);
