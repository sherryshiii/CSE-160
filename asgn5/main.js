// ============================================================
// CSE 160 — Assignment 5
// Sherry Shi (Yshi162@ucsc.edu)
//
// Steps:
//   1. Simple Three.js scene  (renderer, scene, perspective camera,
//      directional light, animated cubes).
//   2. Textures (1 cube uses ONE texture on all faces,
//      another cube uses SIX textures, one per face).
//   3. Custom textured 3D model (GLB) loaded with GLTFLoader.
//      Spaceship by Quaternius, CC0, from poly.pizza.
//   4. OrbitControls — drag to rotate, scroll to zoom, right-drag to pan.
//   5. Extra light sources. Four kinds total (>= 3 required):
//      DirectionalLight, AmbientLight, HemisphereLight, PointLight.
//   6. Skybox using CubeTextureLoader (6-face Milky Way cubemap).
//   7. 25 primary shapes assembled into an alien-planet scene
//      (3 textured "relic" cubes, 6 ground rocks, 5 asteroids,
//      4 crystal columns made of cylinder + cone, plus a ringed
//      planet built from 1 sphere + 1 torus).
//   8. "Wow" — a two-layer particle system built with THREE.Points
//      and BufferGeometry: 2500 far white star-dust points drifting,
//      plus 500 near magenta firefly points orbiting the scene.
//
// Following tutorials:
//   https://threejs.org/manual/#en/fundamentals
//   https://threejs.org/manual/#en/textures
//   https://threejs.org/docs/#examples/en/loaders/GLTFLoader
//   https://threejs.org/manual/#en/cameras
//   https://threejs.org/manual/#en/lights
//   https://threejs.org/manual/#en/backgrounds
// ============================================================

import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function main() {
    // ============================================================
    // Renderer + Camera + Controls
    // ============================================================
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });

    const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 1000);
    camera.position.set(0, 4, 14);
    camera.lookAt(0, 1, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controls.update();

    // ============================================================
    // Scene + Skybox (Step 6)
    // ============================================================
    const scene = new THREE.Scene();

    const cubeLoader = new THREE.CubeTextureLoader().setPath('textures/skybox/');
    const skyTexture = cubeLoader.load([
        'px.jpg', 'nx.jpg',
        'py.jpg', 'ny.jpg',
        'pz.jpg', 'nz.jpg',
    ]);
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = skyTexture;

    // ============================================================
    // Lights (Step 5) — Directional, Ambient, Hemisphere, Point
    // ============================================================
    {
        const sun = new THREE.DirectionalLight(0xffffff, 2.0);
        sun.position.set(-3, 6, 4);
        scene.add(sun);
    }
    scene.add(new THREE.AmbientLight(0x4040ff, 0.25));
    scene.add(new THREE.HemisphereLight(0x6a4cff, 0x1a1a40, 0.6));

    const engineLight = new THREE.PointLight(0xff44ff, 30, 18, 2);
    engineLight.position.set(0, 2.0, 0);
    scene.add(engineLight);

    // ============================================================
    // Texture loader (Step 2)
    // ============================================================
    const texLoader = new THREE.TextureLoader();
    function srgb(tex) { tex.colorSpace = THREE.SRGBColorSpace; return tex; }

    // ------------------------------------------------------------
    // 1) Three "relic" cubes from Step 2 — they prove the texturing
    //    rubric: ONE texture across 6 faces, vs SIX textures one per face.
    //    Placed on the ground like ancient artifacts.
    // ------------------------------------------------------------
    const relicGeom = new THREE.BoxGeometry(1, 1, 1);
    const wallTex   = srgb(texLoader.load('textures/crate.jpg'));

    // (a) Single-texture cube
    const relicSingle = new THREE.Mesh(
        relicGeom,
        new THREE.MeshPhongMaterial({ map: wallTex })
    );
    relicSingle.position.set(-3.0, 0.5, 2.5);
    scene.add(relicSingle);

    // (b) Six-texture cube
    const sixFaceMats = [
        'textures/flower-1.jpg', 'textures/flower-2.jpg',
        'textures/flower-3.jpg', 'textures/flower-4.jpg',
        'textures/flower-5.jpg', 'textures/flower-6.jpg',
    ].map(url => new THREE.MeshPhongMaterial({ map: srgb(texLoader.load(url)) }));
    const relicSixFace = new THREE.Mesh(relicGeom, sixFaceMats);
    relicSixFace.position.set(0, 0.5, 3.0);
    scene.add(relicSixFace);

    // (c) Plain Phong cube (un-textured comparison)
    const relicPlain = new THREE.Mesh(
        relicGeom,
        new THREE.MeshPhongMaterial({ color: 0xaa8844 })
    );
    relicPlain.position.set(3.0, 0.5, 2.5);
    scene.add(relicPlain);

    const relicCubes = [relicSingle, relicSixFace, relicPlain];

    // ------------------------------------------------------------
    // 2) Ground rocks — 6 boxes scattered, low-poly alien terrain
    // ------------------------------------------------------------
    const groundRocks = [];
    const rockSpots = [
        [-6, 0.25,  0, 2.0, 0.5, 2.0, 0x2a1840],
        [ 5, 0.30, -2, 2.5, 0.6, 2.0, 0x33205a],
        [-2, 0.20, -5, 3.0, 0.4, 1.8, 0x241640],
        [ 2, 0.35,  5, 1.8, 0.7, 1.8, 0x301a52],
        [-5, 0.20,  4, 1.5, 0.4, 1.5, 0x1f1335],
        [ 6, 0.20,  3, 1.6, 0.4, 2.2, 0x2c1948],
    ];
    for (const [x, y, z, w, h, d, color] of rockSpots) {
        const rock = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshPhongMaterial({ color, flatShading: true })
        );
        rock.position.set(x, y, z);
        scene.add(rock);
        groundRocks.push(rock);
    }

    // ------------------------------------------------------------
    // 3) Asteroids — 5 spheres drifting in the air
    // ------------------------------------------------------------
    const asteroids = [];
    const asteroidSpots = [
        [-7, 4.0,  1, 0.7, 0x6b4cff],
        [ 7, 3.5, -1, 0.5, 0x8866ff],
        [-4, 5.5, -4, 0.9, 0x4a2c80],
        [ 4, 6.0,  4, 0.4, 0x9a7bff],
        [ 0, 7.2, -6, 1.1, 0x553399],
    ];
    for (const [x, y, z, r, color] of asteroidSpots) {
        const ast = new THREE.Mesh(
            new THREE.SphereGeometry(r, 16, 12),
            new THREE.MeshPhongMaterial({ color, flatShading: true })
        );
        ast.position.set(x, y, z);
        // store orbit info on the mesh for the animation loop
        ast.userData.basePos = ast.position.clone();
        ast.userData.spinAxis = new THREE.Vector3(
            Math.random(), Math.random(), Math.random()
        ).normalize();
        ast.userData.spinSpeed = 0.3 + Math.random() * 0.5;
        ast.userData.bobPhase  = Math.random() * Math.PI * 2;
        scene.add(ast);
        asteroids.push(ast);
    }

    // ------------------------------------------------------------
    // 4) Crystal columns — 4 of them; each = cylinder (column) + cone (tip)
    // ------------------------------------------------------------
    const crystals = [];
    const crystalSpots = [
        [-4.5, 0, -2.5, 0xb84cff],
        [ 4.5, 0, -3.0, 0xff5fff],
        [-1.5, 0,  6.0, 0x8a3cff],
        [ 1.8, 0,  6.5, 0xc060ff],
    ];
    for (const [x, _y, z, color] of crystalSpots) {
        const group = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color,
            emissive: new THREE.Color(color).multiplyScalar(0.35),
            shininess: 80,
            flatShading: true,
        });

        const columnHeight = 1.2 + Math.random() * 0.6;
        const column = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.35, columnHeight, 6),
            mat
        );
        column.position.y = columnHeight / 2;
        group.add(column);

        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.30, 0.7, 6),
            mat
        );
        tip.position.y = columnHeight + 0.35;
        group.add(tip);

        group.position.set(x, 0, z);
        group.userData.baseY = 0;
        group.userData.bobPhase = Math.random() * Math.PI * 2;
        scene.add(group);
        crystals.push(group);
    }

    // ------------------------------------------------------------
    // 5) Distant ringed planet — 1 sphere + 1 torus
    // ------------------------------------------------------------
    const ringedPlanet = new THREE.Group();
    const planetBody = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 32, 16),
        new THREE.MeshPhongMaterial({
            color: 0x5a3aaa,
            emissive: 0x150a40,
            shininess: 30,
        })
    );
    ringedPlanet.add(planetBody);

    const planetRing = new THREE.Mesh(
        new THREE.TorusGeometry(3.6, 0.15, 8, 64),
        new THREE.MeshPhongMaterial({
            color: 0xc0a4ff,
            emissive: 0x3a2870,
            side: THREE.DoubleSide,
        })
    );
    planetRing.rotation.x = Math.PI / 2.3;
    ringedPlanet.add(planetRing);

    ringedPlanet.position.set(-14, 7, -22);
    scene.add(ringedPlanet);

    // ------------------------------------------------------------
    // Engine glow bulb (where the PointLight lives)
    // ------------------------------------------------------------
    const engineBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xff88ff })
    );
    engineBulb.position.copy(engineLight.position);
    scene.add(engineBulb);

    // ============================================================
    // Step 8 (Wow): Two-layer particle system using THREE.Points
    // ============================================================

    // ---- Layer A: 2500 star-dust points scattered in a large sphere
    const dustCount = 2500;
    const dustGeom  = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors    = new Float32Array(dustCount * 3);
    const tmpColor = new THREE.Color();
    for (let i = 0; i < dustCount; i++) {
        // Uniform points in a shell of radius 25-60
        const r = 25 + Math.random() * 35;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        dustPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        dustPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        dustPositions[i * 3 + 2] = r * Math.cos(phi);
        // Mix of white / pale blue / soft purple
        tmpColor.setHSL(0.62 + Math.random() * 0.15, 0.4, 0.7 + Math.random() * 0.3);
        tmpColor.toArray(dustColors, i * 3);
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeom.setAttribute('color',    new THREE.BufferAttribute(dustColors,    3));
    const dustMat = new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        depthWrite: false,
    });
    const starDust = new THREE.Points(dustGeom, dustMat);
    scene.add(starDust);

    // ---- Layer B: 500 magenta fireflies orbiting the scene center
    const fireCount = 500;
    const fireGeom  = new THREE.BufferGeometry();
    const firePositions = new Float32Array(fireCount * 3);
    // Store per-particle orbit data so we can animate each
    const fireRadius = new Float32Array(fireCount);
    const fireAngle  = new Float32Array(fireCount);
    const fireSpeed  = new Float32Array(fireCount);
    const fireY      = new Float32Array(fireCount);
    const fireYBob   = new Float32Array(fireCount);
    for (let i = 0; i < fireCount; i++) {
        fireRadius[i] = 4 + Math.random() * 9;
        fireAngle[i]  = Math.random() * Math.PI * 2;
        fireSpeed[i]  = 0.05 + Math.random() * 0.25;
        fireY[i]      = 0.5 + Math.random() * 6;
        fireYBob[i]   = Math.random() * Math.PI * 2;
    }
    fireGeom.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
    const fireMat = new THREE.PointsMaterial({
        color: 0xff66ff,
        size: 0.22,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,   // glow look
        depthWrite: false,
    });
    const fireflies = new THREE.Points(fireGeom, fireMat);
    scene.add(fireflies);

    // ============================================================
    // Step 3: GLTF spaceship
    // ============================================================
    let spaceship = null;
    new GLTFLoader().load(
        'models/spaceship.glb',
        (gltf) => {
            spaceship = gltf.scene;
            spaceship.scale.setScalar(0.3);
            spaceship.position.set(0, 3.0, 0);
            scene.add(spaceship);
            console.log('[Step 3] spaceship.glb loaded');
        },
        undefined,
        (err) => console.error('[Step 3] failed to load spaceship', err)
    );

    // ============================================================
    // Resize handler
    // ============================================================
    function resizeRendererToDisplaySize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const needResize = canvas.width !== w || canvas.height !== h;
        if (needResize) renderer.setSize(w, h, false);
        return needResize;
    }

    // ============================================================
    // Render loop
    // ============================================================
    function render(time) {
        time *= 0.001; // ms -> seconds

        if (resizeRendererToDisplaySize()) {
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        // Step 1 animation: the 3 relic cubes still spin (gentle, in place)
        relicCubes.forEach((cube, ndx) => {
            cube.rotation.y = time * (0.5 + ndx * 0.1);
        });

        // Asteroids: spin + gentle bob
        for (const ast of asteroids) {
            ast.rotateOnAxis(ast.userData.spinAxis, 0.01 * ast.userData.spinSpeed);
            ast.position.y = ast.userData.basePos.y +
                Math.sin(time + ast.userData.bobPhase) * 0.25;
        }

        // Crystals: vertical bob + slow spin
        for (const crystal of crystals) {
            crystal.position.y = Math.sin(time * 0.8 + crystal.userData.bobPhase) * 0.15;
            crystal.rotation.y = time * 0.4;
        }

        // Ringed planet: rotate body + ring
        ringedPlanet.rotation.y = time * 0.06;
        planetBody.rotation.y   = time * 0.10;

        // Spaceship hover + slow yaw
        if (spaceship) {
            spaceship.rotation.y = time * 0.3;
            spaceship.position.y = 3.0 + Math.sin(time * 0.7) * 0.25;
        }

        // Star dust: drift the whole layer very slowly
        starDust.rotation.y = time * 0.01;
        starDust.rotation.x = time * 0.005;

        // Fireflies: each particle orbits independently + vertical bob
        const firePos = fireGeom.attributes.position.array;
        for (let i = 0; i < fireCount; i++) {
            const a = fireAngle[i] + time * fireSpeed[i];
            firePos[i * 3 + 0] = Math.cos(a) * fireRadius[i];
            firePos[i * 3 + 1] = fireY[i] + Math.sin(time * 0.8 + fireYBob[i]) * 0.4;
            firePos[i * 3 + 2] = Math.sin(a) * fireRadius[i];
        }
        fireGeom.attributes.position.needsUpdate = true;

        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
