/**
 * smoke_test.js
 * 
 * RUN THIS AFTER ANY CHANGE TO tracker.js
 * Usage: node smoke_test.js
 */

const fs = require('fs');
const path = require('path');

console.log("🚀 Starting FaceTracker Smoke Test...");

// 1. Syntax Check
const trackerPath = path.join(__dirname, 'tracker.js');
const trackerCode = fs.readFileSync(trackerPath, 'utf8');

try {
    // Check syntax using Node's vm module
    const vm = require('vm');
    const script = new vm.Script(trackerCode);
    console.log("✅ [Syntax] tracker.js is valid Javascript.");
} catch (e) {
    console.error("❌ [Syntax] tracker.js has errors:");
    console.error(e.message);
    process.exit(1);
}

// 2. Unit Testing Core Math
// We need to extract FaceTracker from the code since it's not exported by default
let FaceTracker;
try {
    // Mock window and document for Node environment
    global.window = { saveDataAcrossSessions: true };
    global.document = { 
        getElementById: () => null,
        createElement: () => ({ getContext: () => null, style: {} }),
        body: { appendChild: () => null, clientWidth: 400, clientHeight: 800 }
    };
    global.navigator = { vibrate: () => null };

    // Eval the code to get the object
    const evalCode = trackerCode + "\nFaceTracker;";
    FaceTracker = eval(evalCode);
    console.log("✅ [Load] FaceTracker object initialized.");
} catch (e) {
    console.error("❌ [Load] Failed to initialize FaceTracker in Node:");
    console.error(e.message);
    process.exit(1);
}

// Test getDistance
const d = FaceTracker.getDistance([0,0], [3,4]);
if (d === 5) {
    console.log("✅ [Math] getDistance: Pass");
} else {
    console.error(`❌ [Math] getDistance: Fail (Expected 5, got ${d})`);
    process.exit(1);
}

// Test getPolyArea (Square)
const area = FaceTracker.getPolyArea([[0,0], [10,0], [10,10], [0,10]]);
if (area === 100) {
    console.log("✅ [Math] getPolyArea: Pass");
} else {
    console.error(`❌ [Math] getPolyArea: Fail (Expected 100, got ${area})`);
    process.exit(1);
}

// Test evaluateDetector (Simple Hysteresis)
const detector = FaceTracker.createDetector({
    approach: 'hysteresis',
    hystOpenThreshold: 0.4,
    hystCloseThreshold: 0.2,
    smoothing: 1.0, // no smoothing for test
    marWeight: 1.0, // concentrate on MAR for simplicity
    areaWeight: 0,
    chinWeight: 0
});

// Test Open
FaceTracker.evaluateDetector(detector, { marScore: 0.5, areaScore: 0, chinScore: 0 });
if (detector.isMouthOpen) {
    console.log("✅ [Logic] Hysteresis Open: Pass");
} else {
    console.error("❌ [Logic] Hysteresis Open: Fail");
    process.exit(1);
}

// Test Stay Open
FaceTracker.evaluateDetector(detector, { marScore: 0.3, areaScore: 0, chinScore: 0 });
if (detector.isMouthOpen) {
    console.log("✅ [Logic] Hysteresis Stay Open: Pass");
} else {
    console.error("❌ [Logic] Hysteresis Stay Open: Fail");
    process.exit(1);
}

// Test Close
FaceTracker.evaluateDetector(detector, { marScore: 0.1, areaScore: 0, chinScore: 0 });
if (!detector.isMouthOpen) {
    console.log("✅ [Logic] Hysteresis Close: Pass");
} else {
    console.error("❌ [Logic] Hysteresis Close: Fail");
    process.exit(1);
}

console.log("\n✨ ALL SMOKE TESTS PASSED. The code is fortified.");
