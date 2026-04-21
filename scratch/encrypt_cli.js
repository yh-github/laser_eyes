
const crypto = require('node:crypto').webcrypto;

async function encryptToken(token, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    
    // Derive key
    const keyMaterial = await crypto.subtle.importKey(
        "raw", 
        encoder.encode(password), 
        { name: "PBKDF2" }, 
        false, 
        ["deriveKey"]
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encoder.encode(token)
    );
    
    const result = {
        salt: Buffer.from(salt).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        ciphertext: Buffer.from(new Uint8Array(encrypted)).toString('base64')
    };
    
    console.log("\nEncrypted Token Object (Copy this to your code):");
    console.log(JSON.stringify(result, null, 2));
    return result;
}

const [token, password] = process.argv.slice(2);

if (!token || !password) {
    console.log("Usage: node encrypt_cli.js <HF_TOKEN> <PASSWORD>");
    process.exit(1);
}

encryptToken(token, password).catch(console.error);
