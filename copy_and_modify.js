const fs = require('fs');

let content = fs.readFileSync('uncle_sam.html', 'utf8');

// Title and splashes
content = content.replace('<title>Uncle Sam - Laser Eyes PoC</title>', '<title>Through The Glass - Laser Eyes PoC</title>');
content = content.replace('Uncle Sam</h1>', 'Through Glass</h1>');
content = content.replace('I want YOUR... nose.', 'Look around the 3D space with your head.');

// Menu toggle replacement
content = content.replace('<div class="menu-header mb-0">Magnetism</div>', '<div class="menu-header mb-0">Shape Options</div>');

// Replace the magnet slider UI with a single select box for Shape
const magnetSlidersRegex = /<label class="menu-label">Sensitivity<\/label>[\s\S]*?<input type="range" id="snap-range" class="snap-slider" min="0" max="100" value="40">/;
const newShapeUI = `
<label class="menu-label">Shape Type</label>
<div class="flex items-center gap-2 mt-2">
    <select id="shape-select" class="w-full bg-gray-800 text-cyan-400 border border-cyan-900 rounded px-2 py-1 text-xs">
        <option value="pole">Protruding Bullseye (Out)</option>
        <option value="tunnel">Deep Tunnel (In)</option>
    </select>
</div>
`;
content = content.replace(magnetSlidersRegex, newShapeUI);

content = content.replace('id="open-magnet-btn"', 'id="open-shape-btn"');
content = content.replace('MAGNETISM SETTINGS', 'SHAPE SETTINGS');
content = content.replace('id="magnet-menu-view"', 'id="shape-menu-view"');
content = content.replace('id="close-magnet-btn"', 'id="close-shape-btn"');

// Replace THREE.js scene logic
const threeSetupRegex = /\/\/ Build a 3D arrow[\s\S]*?scene\.add\(arrowGroup\);/m;
const newThreeSetup = `
        // Create Hologram Bullseye (Protruding)
        const poleGroup = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(15, 15, 300, 32);
        poleGeo.rotateX(Math.PI / 2); // align with Z axis
        const poleMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6, specular: 0xffffff, shininess: 100 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(0, 0, 150);

        const ringsGroup = new THREE.Group();
        const colors = [0xf43f5e, 0xffffff, 0xf43f5e, 0xffffff, 0x3b82f6];
        for(let i=0; i<5; i++) {
            const r = 50 - i*10;
            const c = new THREE.Mesh(
                new THREE.CircleGeometry(r, 32), 
                new THREE.MeshBasicMaterial({color: colors[i]})
            );
            c.position.z = i * 0.5;
            ringsGroup.add(c);
        }
        ringsGroup.position.set(0, 0, 305);
        poleGroup.add(pole);
        poleGroup.add(ringsGroup);

        // Create Deep Tunnel (Inwards)
        const tunnelGroup = new THREE.Group();
        for(let i=0; i<15; i++) {
            // Give tunnel some perspective tapering by making far rings smaller
            const size = 200 - (i * 5); 
            const geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(size, size));
            const color = new THREE.Color().setHSL(0.5 + (i * 0.03), 1.0, 0.5);
            const mat = new THREE.LineBasicMaterial({ color: color });
            const rect = new THREE.LineSegments(geo, mat);
            rect.position.z = -i * 80;
            tunnelGroup.add(rect);
        }
        const coreGeo = new THREE.SphereGeometry(20, 16, 16);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.z = -15 * 80;
        tunnelGroup.add(core);

        scene.add(poleGroup);
        scene.add(tunnelGroup);
        tunnelGroup.visible = false; // default to pole
`;
content = content.replace(threeSetupRegex, newThreeSetup);

// Replace animate logic
const animateRegex = /\/\/ Map cursorX\/cursorY to Normalized Device Coordinates \(-1 to 1\)[\s\S]*?renderer\.render\(scene, camera\);/m;
const newAnimateLogic = `
            if (FaceTracker.cursorX !== -100) {
                // Determine dx and dy representing head offset
                const dx = FaceTracker.cursorX - (w / 2);
                const dy = FaceTracker.cursorY - (h / 2);

                // Multiply by a parallax strength factor
                const strength = 1.0; 
                
                // Pan the camera based on head position
                camera.position.x = dx * strength;
                camera.position.y = -dy * strength; 
                camera.position.z = 500;
                
                // Look statically at the screen center to create off-axis window illusion
                camera.lookAt(0, 0, 0);
            }

            renderer.render(scene, camera);
`;
content = content.replace(animateRegex, newAnimateLogic);

// Fix UI listeners in scripts
content = content.replace("const magnetMenuBtn = document.getElementById('magnet-menu-view');", "const shapeMenuBtn = document.getElementById('shape-menu-view');");
content = content.replace("const openMagnetBtn = document.getElementById('open-magnet-btn');", "const openShapeBtn = document.getElementById('open-shape-btn');");
content = content.replace("const closeMagnetBtn = document.getElementById('close-magnet-btn');", "const closeShapeBtn = document.getElementById('close-shape-btn');");

// Strip the old magnetism snap logic
content = content.replace("const snapStrengthSlider = document.getElementById('snap-strength');", "");
content = content.replace("const snapRangeSlider = document.getElementById('snap-range');", "");

content = content.replace(/magnetMenuBtn\./g, "shapeMenuBtn.");
content = content.replace(/openMagnetBtn\./g, "openShapeBtn.");
content = content.replace(/closeMagnetBtn\./g, "closeShapeBtn.");

content = content.replace("snapStrengthSlider.addEventListener", "// removed");
content = content.replace("snapRangeSlider.addEventListener", "// removed");

// Add shape toggling logic
const shapeToggleLogic = `
        const shapeSelect = document.getElementById('shape-select');
        if (shapeSelect) {
            shapeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'pole') {
                    poleGroup.visible = true;
                    tunnelGroup.visible = false;
                } else {
                    poleGroup.visible = false;
                    tunnelGroup.visible = true;
                }
            });
        }
`;
content = content.replace('</body>', shapeToggleLogic + '\\n</body>');

fs.writeFileSync('glass.html', content);
console.log("Successfully created glass.html");
