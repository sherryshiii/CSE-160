// Shaders

// Input: an array of points comes from javascript.
// In this example, think of this array as the variable a_Position;
// Q: Why a_Position is not an array?
// A: Because the GPU process every vertex in parallel
// The language that we use to write the shaders is called GLSL

// Output: sends "an array of points" to the rasterizer.
var VERTEX_SHADER = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec3 a_Color;
    attribute vec2 a_UV;

    varying vec3 v_Color;
    varying vec2 v_UV;

    uniform mat4 u_ModelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;


    void main() {
        v_Color = a_Color;
        v_UV = a_UV;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
    }
`;

// Input: a fragment (a grid of pixels) comes from the rasterizer.
// It doesn't have vertices as input
// Ouput: a color goes to HTML canvas.
var FRAGMENT_SHADER = `
    precision mediump float;

    varying vec3 v_Color;
    varying vec2 v_UV;

    uniform sampler2D u_Sampler0; // brick
    uniform sampler2D u_Sampler1; // grass
    uniform sampler2D u_Sampler2; // stone
    uniform sampler2D u_Sampler3; // wood
    uniform sampler2D u_Sampler4; // gold

    uniform int   u_textureIndex;
    uniform vec4  u_baseColor;
    uniform float u_texColorWeight;
    uniform float u_ambient;

    void main() {
        vec4 texColor;
        if      (u_textureIndex == 0) texColor = texture2D(u_Sampler0, v_UV);
        else if (u_textureIndex == 1) texColor = texture2D(u_Sampler1, v_UV);
        else if (u_textureIndex == 2) texColor = texture2D(u_Sampler2, v_UV);
        else if (u_textureIndex == 3) texColor = texture2D(u_Sampler3, v_UV);
        else                          texColor = texture2D(u_Sampler4, v_UV);

        float t = u_texColorWeight;
        vec4 c = (1.0 - t) * u_baseColor + t * texColor;
        gl_FragColor = vec4(c.rgb * u_ambient, c.a);
    }
`;

// We will use HTML sliders to set this variable
GlobalRotation = 0;
shapes = [];

const MAP_SIZE = 32;

let mapData = null;

let goldCollected = 0;
let goldTotal     = 0;

// my map: each cell stores a height (0..4) and a texture id
// 0 brick, 1 grass, 2 stone, 3 wood, 4 gold
function buildMap(){
    let height = [];
    let type   = [];
    for (let i = 0; i < MAP_SIZE; i++){
        let hRow = [];
        let tRow = [];
        for (let j = 0; j < MAP_SIZE; j++){
            if (i === 0 || i === MAP_SIZE - 1 || j === 0 || j === MAP_SIZE - 1){
                hRow.push(4);
                tRow.push(2);
            } else {
                hRow.push(0);
                tRow.push(0);
            }
        }
        height.push(hRow);
        type.push(tRow);
    }

    function set(i, j, h, t){ height[i][j] = h; type[i][j] = t; }

    // 4 corner pillars
    set(8,  8,  4, 0);
    set(8,  24, 3, 0);
    set(24, 8,  3, 0);
    set(24, 24, 4, 0);

    // a short wood wall
    for (let j = 5; j <= 10; j++) set(20, j, 2, 3);

    // staircase 1 -> 4
    for (let k = 0; k < 4; k++) set(6 + k, 16, k + 1, 0);

    // some scattered blocks
    set(12, 12, 1, 0);
    set(12, 20, 1, 3);
    set(20, 20, 1, 0);
    set(14, 6,  1, 3);
    set(18, 26, 1, 0);

    // 5 gold blocks for the collect quest
    set(3,  3,  1, 4);
    set(3,  28, 1, 4);
    set(28, 3,  1, 4);
    set(28, 28, 1, 4);
    set(16, 28, 1, 4);

    // open spawn area
    for (let i = 14; i <= 18; i++){
        for (let j = 14; j <= 18; j++){
            set(i, j, 0, 0);
        }
    }

    return { height: height, type: type };
}

// bake N cube positions into one big Float32Array (scale 0.5 + translate)
function mergeCubes(positions){
    let templateVerts = (new cube()).vertices;
    const FLOATS_PER_VERTEX = 8;
    const VERTS_PER_CUBE = templateVerts.length / FLOATS_PER_VERTEX;
    const SCALE = 0.5;
    let merged = new Float32Array(positions.length * templateVerts.length);
    let dst = 0;
    for (let p = 0; p < positions.length; p++){
        let tx = positions[p][0];
        let ty = positions[p][1];
        let tz = positions[p][2];
        for (let v = 0; v < VERTS_PER_CUBE; v++){
            let s = v * FLOATS_PER_VERTEX;
            merged[dst++] = templateVerts[s    ] * SCALE + tx;
            merged[dst++] = templateVerts[s + 1] * SCALE + ty;
            merged[dst++] = templateVerts[s + 2] * SCALE + tz;
            merged[dst++] = templateVerts[s + 3];
            merged[dst++] = templateVerts[s + 4];
            merged[dst++] = templateVerts[s + 5];
            merged[dst++] = templateVerts[s + 6];
            merged[dst++] = templateVerts[s + 7];
        }
    }
    return merged;
}

function buildScene(){
    shapes = [];

    // sky
    let sky = new cube();
    sky.translate(0, 0, 0);
    sky.scale(500, 500, 500);
    sky.texColorWeight = 0.0;
    sky.baseColor = [0.4, 0.65, 1.0, 1.0];
    shapes.push(sky);

    // ground (grass)
    let ground = new cube();
    ground.translate(0, -0.5, 0);
    ground.rotateX(0);
    ground.scale(16, 0.5, 16);
    ground.texColorWeight = 1.0;
    ground.baseColor      = [1.0, 1.0, 1.0, 1.0];
    ground.textureIndex   = 1;
    shapes.push(ground);

    buildWalls(mapData);
}

function checkGoldCollection(){
    const PICKUP_RADIUS = 1.0;
    let ex = camera.eye.elements[0];
    let ez = camera.eye.elements[2];
    let collectedAny = false;
    for (let i = 0; i < MAP_SIZE; i++){
        for (let j = 0; j < MAP_SIZE; j++){
            if (mapData.height[i][j] > 0 && mapData.type[i][j] === 4){
                let wx = i - MAP_SIZE / 2 + 0.5;
                let wz = j - MAP_SIZE / 2 + 0.5;
                let dx = wx - ex;
                let dz = wz - ez;
                if (Math.sqrt(dx*dx + dz*dz) < PICKUP_RADIUS){
                    mapData.height[i][j] = 0;
                    goldCollected++;
                    collectedAny = true;
                }
            }
        }
    }
    if (collectedAny){
        buildScene();
        updateScoreDisplay();
    }
}

function updateScoreDisplay(){
    let el = document.getElementById("score");
    if (!el) return;
    el.innerText = "Gold: " + goldCollected + " / " + goldTotal;
    if (goldTotal > 0 && goldCollected >= goldTotal){
        el.innerText += " — You win!";
        el.style.color = "#1b8800";
    }
}

function countGold(){
    let n = 0;
    for (let i = 0; i < MAP_SIZE; i++){
        for (let j = 0; j < MAP_SIZE; j++){
            if (mapData.height[i][j] > 0 && mapData.type[i][j] === 4) n++;
        }
    }
    return n;
}

// the cell ~1.5 units in front of the camera (x-z only)
function findFrontCell(){
    let fx = camera.at.elements[0] - camera.eye.elements[0];
    let fz = camera.at.elements[2] - camera.eye.elements[2];
    let len = Math.sqrt(fx*fx + fz*fz);
    if (len < 1e-6) return null;
    fx /= len; fz /= len;
    const REACH = 1.5;
    let tx = camera.eye.elements[0] + fx * REACH;
    let tz = camera.eye.elements[2] + fz * REACH;
    let i = Math.floor(tx + MAP_SIZE / 2);
    let j = Math.floor(tz + MAP_SIZE / 2);
    if (i < 0 || i >= MAP_SIZE || j < 0 || j >= MAP_SIZE) return null;
    return { i: i, j: j };
}

function addBlock(){
    let cell = findFrontCell();
    if (!cell) return;
    if (mapData.height[cell.i][cell.j] >= 4) return;
    if (mapData.height[cell.i][cell.j] === 0){
        mapData.type[cell.i][cell.j] = 0; // default new blocks to brick
    }
    mapData.height[cell.i][cell.j]++;
    buildScene();
}

function deleteBlock(){
    let cell = findFrontCell();
    if (!cell) return;
    if (mapData.height[cell.i][cell.j] <= 0) return;
    mapData.height[cell.i][cell.j]--;
    buildScene();
}

// group walls by texture so each texture is one merged drawArrays
function buildWalls(mapData){
    let height = mapData.height;
    let type   = mapData.type;

    let positionsByType = {};
    for (let i = 0; i < MAP_SIZE; i++){
        for (let j = 0; j < MAP_SIZE; j++){
            let h = height[i][j];
            let t = type[i][j];
            if (h === 0) continue;
            if (!positionsByType[t]) positionsByType[t] = [];
            for (let k = 0; k < h; k++){
                positionsByType[t].push([
                    i - MAP_SIZE / 2 + 0.5,
                    k + 0.5,
                    j - MAP_SIZE / 2 + 0.5
                ]);
            }
        }
    }

    for (let t in positionsByType){
        let positions = positionsByType[t];
        let g = new geometry();
        g.vertices = mergeCubes(positions);
        g.texColorWeight = 1.0;
        g.baseColor      = [1.0, 1.0, 1.0, 1.0];
        g.textureIndex   = parseInt(t);
        shapes.push(g);
    }
}

// ---- procedural textures (canvas-drawn, no extra files) ----
function makeCanvas(size, drawFn){
    let cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    drawFn(cv.getContext("2d"), size);
    return cv;
}
function drawGrass(ctx, s){
    ctx.fillStyle = "#3a8c3a"; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++){
        ctx.fillStyle = Math.random() > 0.5 ? "#2d6e2d" : "#5cb85c";
        ctx.fillRect(Math.random()*s, Math.random()*s, 2, 2);
    }
}
function drawStone(ctx, s){
    ctx.fillStyle = "#8a8a8a"; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 30; i++){
        ctx.fillStyle = "#666";
        ctx.beginPath();
        ctx.arc(Math.random()*s, Math.random()*s, Math.random()*8+4, 0, Math.PI*2);
        ctx.fill();
    }
    for (let i = 0; i < 30; i++){
        ctx.fillStyle = "#aaa";
        ctx.beginPath();
        ctx.arc(Math.random()*s, Math.random()*s, Math.random()*4+2, 0, Math.PI*2);
        ctx.fill();
    }
}
function drawWood(ctx, s){
    ctx.fillStyle = "#8b5a2b"; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 12; i++){
        ctx.fillStyle = "#6b4520";
        ctx.fillRect(0, i * s/12 + (Math.random()-0.5)*4, s, 2);
    }
    for (let i = 0; i < 6; i++){
        ctx.fillStyle = "#a0703a";
        ctx.fillRect(0, i * s/6 + (Math.random()-0.5)*3, s, 1);
    }
}
function drawGold(ctx, s){
    ctx.fillStyle = "#ffd700"; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++){
        ctx.fillStyle = "#fffacd";
        ctx.fillRect(Math.random()*s, Math.random()*s, 2, 2);
    }
    ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, s-2, s-2);
}

function bindTexture(unit, source){
    let tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
}

function loadWorld(){
    // unit 0: block.jpg from disk
    let brick = gl.createTexture();
    let img = new Image();
    img.src = "textures/block.jpg";
    img.onload = function(){
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, brick);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        animate();
    };

    // units 1..4: drawn with canvas
    bindTexture(1, makeCanvas(64, drawGrass));
    bindTexture(2, makeCanvas(64, drawStone));
    bindTexture(3, makeCanvas(64, drawWood));
    bindTexture(4, makeCanvas(64, drawGold));

    gl.uniform1i(gl.getUniformLocation(gl.program, "u_Sampler0"), 0);
    gl.uniform1i(gl.getUniformLocation(gl.program, "u_Sampler1"), 1);
    gl.uniform1i(gl.getUniformLocation(gl.program, "u_Sampler2"), 2);
    gl.uniform1i(gl.getUniformLocation(gl.program, "u_Sampler3"), 3);
    gl.uniform1i(gl.getUniformLocation(gl.program, "u_Sampler4"), 4);
}

let uniformLocations = null;
let currentVertices  = null;

// ---- day / night cycle ----
let timeOfDay = 0.30;
const DAY_LENGTH_MS = 45 * 1000;
let currentAmbient = 1.0;
let lastFrameTime = 0;

const SKY_KEYS = [
    { t: 0.00, color: [0.02, 0.02, 0.10, 1], ambient: 0.30 }, // midnight
    { t: 0.20, color: [0.20, 0.15, 0.30, 1], ambient: 0.45 }, // pre-dawn
    { t: 0.28, color: [0.95, 0.55, 0.30, 1], ambient: 0.70 }, // sunrise
    { t: 0.40, color: [0.55, 0.75, 1.00, 1], ambient: 0.95 }, // morning
    { t: 0.50, color: [0.40, 0.65, 1.00, 1], ambient: 1.00 }, // noon
    { t: 0.65, color: [0.55, 0.75, 1.00, 1], ambient: 0.95 }, // afternoon
    { t: 0.72, color: [0.95, 0.45, 0.20, 1], ambient: 0.70 }, // sunset
    { t: 0.85, color: [0.30, 0.20, 0.40, 1], ambient: 0.45 }, // dusk
    { t: 1.00, color: [0.02, 0.02, 0.10, 1], ambient: 0.30 }, // back to midnight
];

function computeSky(t){
    let prev = SKY_KEYS[0], next = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++){
        if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i+1].t){
            prev = SKY_KEYS[i];
            next = SKY_KEYS[i+1];
            break;
        }
    }
    let span = (next.t - prev.t) || 1;
    let a = (t - prev.t) / span;
    return {
        color: [
            prev.color[0] + a * (next.color[0] - prev.color[0]),
            prev.color[1] + a * (next.color[1] - prev.color[1]),
            prev.color[2] + a * (next.color[2] - prev.color[2]),
            1
        ],
        ambient: prev.ambient + a * (next.ambient - prev.ambient)
    };
}

function tick(timestamp){
    if (lastFrameTime === 0) lastFrameTime = timestamp;
    let dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    timeOfDay = (timeOfDay + dt / DAY_LENGTH_MS) % 1;
    let sky = computeSky(timeOfDay);
    currentAmbient = sky.ambient;
    if (shapes.length > 0) shapes[0].baseColor = sky.color;

    animate();
    requestAnimationFrame(tick);
}

function animate(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(uniformLocations.viewMatrix,       false, camera.viewMatrix.elements);
    gl.uniformMatrix4fv(uniformLocations.projectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniform1f(uniformLocations.ambient, currentAmbient);

    for(let s of shapes){
      draw(s);
    }
}

function draw(geometry){

    geometry.modelMatrix.multiply(geometry.translationMatrix);
    geometry.modelMatrix.multiply(geometry.rotationMatrix);
    geometry.modelMatrix.multiply(geometry.scaleMatrix);

    gl.uniformMatrix4fv(uniformLocations.modelMatrix, false, geometry.modelMatrix.elements);
    gl.uniform4f(uniformLocations.baseColor,
                 geometry.baseColor[0], geometry.baseColor[1],
                 geometry.baseColor[2], geometry.baseColor[3]);
    gl.uniform1f(uniformLocations.texColorWeight, geometry.texColorWeight);
    gl.uniform1i(uniformLocations.textureIndex, geometry.textureIndex);

    // skip the bufferData if the same vertex array is already uploaded
    if (geometry.vertices !== currentVertices){
        gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
        currentVertices = geometry.vertices;
    }

    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertices.length / 8);

    geometry.modelMatrix.setIdentity();
}

function keydown(ev) {
    let moved = false;
    if (ev.keyCode == 87) {        // W
      camera.moveForward();   moved = true;
    } else if (ev.keyCode == 83) { // S
      camera.moveBackwards(); moved = true;
    } else if (ev.keyCode == 65) { // A
      camera.moveLeft();      moved = true;
    } else if (ev.keyCode == 68) { // D
      camera.moveRight();     moved = true;
    } else if (ev.keyCode == 81) { // Q
      camera.panLeft();
    } else if (ev.keyCode == 69) { // E
      camera.panRight();
    } else if (ev.keyCode == 70) { // F
      addBlock();
    } else if (ev.keyCode == 71) { // G
      deleteBlock();
    } else {
      return;
    }

    if (moved) checkGoldCollection();

    animate();
}

function main() {
    let canvas = document.getElementById("webgl");

    // Retrieve WebGl rendering context
    gl = getWebGLContext(canvas);
    if(!gl) {
        console.log("Failed to get WebGL context.")
        return -1;
    }

    gl.enable(gl.DEPTH_TEST);

    // A function to do all the drawing task outside of main
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Actually clear screen
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // We need to define a triangle.
    // A triangle is made out of three points: a, b, c.
    // In webGL, we normally define these points together in one array

    mapData = buildMap();
    goldTotal = countGold();
    updateScoreDisplay();
    buildScene();

    // Remember that WebGL uses the GPU to render vertices on the screen.
    // Therefore, we need to send these points to the GPU. Because
    // the GPU is a different processing unit in your computer.

    // We have to compile the vertex and fragment shaders and
    // load them in the GPU
    if(!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
        console.log("Failed to compile and load shaders.")
        return -1;
    }

    // Specify how to read points a, b and c from the triangle array
    // Create a WebGL buffer (an array in GPU memory), which is similar
    // to a javascript Array.
    let vertexBuffer = gl.createBuffer();
    if(!vertexBuffer) {
        console.log("Can't create buffer");
        return -1;
    }

    // We have to bind this new buffer to the a_Position attribute in the
    // vertex shader.
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // To map this ARRAY_BUFFER called vertexBuffer to our attribute a_Position
    // in the vertex shader.
    // To do that, we first need to access the memory location of the
    // attribute a_Position. Remember that a_Position is a variable in
    // the GPU memory. So we need to grab that location.
    let FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;

    let a_Position = gl.getAttribLocation(gl.program, "a_Position");
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 8*FLOAT_SIZE, 0*FLOAT_SIZE);
    gl.enableVertexAttribArray(a_Position);

    let a_Color = gl.getAttribLocation(gl.program, "a_Color");
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, 8*FLOAT_SIZE, 3*FLOAT_SIZE);
    gl.enableVertexAttribArray(a_Color);

    let a_UV = gl.getAttribLocation(gl.program, "a_UV");
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 8*FLOAT_SIZE, 6*FLOAT_SIZE);
    gl.enableVertexAttribArray(a_UV);

    uniformLocations = {
        viewMatrix:       gl.getUniformLocation(gl.program, "u_viewMatrix"),
        projectionMatrix: gl.getUniformLocation(gl.program, "u_projectionMatrix"),
        modelMatrix:      gl.getUniformLocation(gl.program, "u_ModelMatrix"),
        baseColor:        gl.getUniformLocation(gl.program, "u_baseColor"),
        texColorWeight:   gl.getUniformLocation(gl.program, "u_texColorWeight"),
        textureIndex:     gl.getUniformLocation(gl.program, "u_textureIndex"),
        ambient:          gl.getUniformLocation(gl.program, "u_ambient"),
    };

    camera = new Camera(canvas.width/canvas.height, 0.1, 1000);

    // start a bit above ground in the spawn area, facing -z
    camera.eye.elements[0] = 0;
    camera.eye.elements[1] = 1.5;
    camera.eye.elements[2] = 8;
    camera.at.elements[0]  = 0;
    camera.at.elements[1]  = 1.5;
    camera.at.elements[2]  = 7;
    camera.updateView();

    document.onkeydown = function(ev){ keydown(ev); };

    // hold left mouse and drag to look around
    let mouseDown   = false;
    let lastMouseX  = 0;
    let lastMouseY  = 0;
    const MOUSE_SENSITIVITY = 0.3;

    canvas.onmousedown = function(ev){
        mouseDown  = true;
        lastMouseX = ev.clientX;
        lastMouseY = ev.clientY;
    };
    canvas.onmouseup    = function(){ mouseDown = false; };
    canvas.onmouseleave = function(){ mouseDown = false; };
    canvas.onmousemove  = function(ev){
        if (!mouseDown) return;
        let dx = ev.clientX - lastMouseX;
        let dy = ev.clientY - lastMouseY;
        lastMouseX = ev.clientX;
        lastMouseY = ev.clientY;
        camera.pan(-dx * MOUSE_SENSITIVITY);
        camera.tilt(-dy * MOUSE_SENSITIVITY);
        animate();
    };

    loadWorld();

    requestAnimationFrame(tick);
}
