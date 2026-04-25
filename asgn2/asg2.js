// Shader source.
var VERTEX_SHADER = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec3 a_Color;

    varying vec3 v_Color;

    uniform mat4 u_ModelMatrix;
    uniform mat4 uGlobalRotation;

    void main() {
        v_Color = a_Color;
        gl_Position = uGlobalRotation * u_ModelMatrix * vec4(a_Position, 1.0);
    }
`;

var FRAGMENT_SHADER = `
    precision mediump float;

    varying vec3 v_Color;

    uniform vec3 u_FlatColor;
    uniform float u_UseFlatColor;

    void main() {
        vec3 c = mix(v_Color, u_FlatColor, u_UseFlatColor);
        gl_FragColor = vec4(c, 1.0);
    }
`;

// Global control state.
// Global Y comes from slider.
// Mouse yaw and pitch come from drag.
var gAnimalGlobalRotation = 0;
var gMousePitch = 0;
var gMouseYaw = 0;
var gMouseDragging = false;
var gLastMouseX = 0;
var gLastMouseY = 0;
var MOUSE_ROT_SENS = 0.35;

var gJointThighX = 12;
var gJointCalfX = -10;
var gJointFootX = 0;
var gSliderJointThighX = 12;
var gSliderJointCalfX = -10;
var gSliderJointFootX = 0;

// Time value for animation update.
var g_time = 0;

// Main walk animation toggle.
var g_animationOn = false;

// Shift click starts a short poke animation.
var g_pokeActive = false;
var g_pokeStartMs = 0;
var POKE_ARM_DURATION_MS = 2800;
var gArmCircleXDeg = 0;
var gArmCircleZDeg = 0;

var uLocModelMatrix = null;
var uLocGlobalRotation = null;
var uLocFlatColor = null;
var uLocUseFlatColor = null;

var gUnitCube = null;

var gCubeVertexBuffer = null;
var gCubeVertexCount = 0;

var gBambooVertexBuffer = null;
var gBambooVertexCount = 0;
var gAttribAPosition = -1;
var gAttribAColor = -1;
var gVertexStrideBytes = 6 * Float32Array.BYTES_PER_ELEMENT;

// Bamboo mesh data.
function buildBambooShootVertices() {
  // Vertex format is x, y, z, r, g, b.
  const v = [];
  const pushTri = (ax, ay, az, ar, ag, ab, bx, by, bz, br, bg, bb, cx, cy, cz, cr, cg, cb) => {
    v.push(ax, ay, az, ar, ag, ab, bx, by, bz, br, bg, bb, cx, cy, cz, cr, cg, cb);
  };
  const n = 6;
  // Build one ring of points around Y axis.
  const ring = (y, r) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    return pts;
  };
  // Blend green color from base to tip.
  const colAt = (t) => {
    const dark = [0.07, 0.36, 0.12];
    const mid = [0.14, 0.62, 0.22];
    const light = [0.32, 0.84, 0.4];
    if (t < 0.5) {
      const u = t * 2;
      return [dark[0] + (mid[0] - dark[0]) * u, dark[1] + (mid[1] - dark[1]) * u, dark[2] + (mid[2] - dark[2]) * u];
    }
    const u = (t - 0.5) * 2;
    return [mid[0] + (light[0] - mid[0]) * u, mid[1] + (light[1] - mid[1]) * u, mid[2] + (light[2] - mid[2]) * u];
  };
  // Build one bamboo segment as a frustum.
  const addFrustum = (y0, r0, y1, r1, t0, t1) => {
    const a = ring(y0, r0);
    const b = ring(y1, r1);
    const c0 = colAt(t0);
    const c1 = colAt(t1);
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      pushTri(
        a[i][0], a[i][1], a[i][2], c0[0], c0[1], c0[2],
        a[i2][0], a[i2][1], a[i2][2], c0[0], c0[1], c0[2],
        b[i2][0], b[i2][1], b[i2][2], c1[0], c1[1], c1[2]
      );
      pushTri(
        a[i][0], a[i][1], a[i][2], c0[0], c0[1], c0[2],
        b[i2][0], b[i2][1], b[i2][2], c1[0], c1[1], c1[2],
        b[i][0], b[i][1], b[i][2], c1[0], c1[1], c1[2]
      );
    }
  };
  addFrustum(0.0, 0.064, 0.055, 0.056, 0.0, 0.12);
  addFrustum(0.055, 0.056, 0.11, 0.074, 0.15, 0.28);
  addFrustum(0.11, 0.074, 0.2, 0.05, 0.3, 0.45);
  addFrustum(0.2, 0.05, 0.3, 0.06, 0.48, 0.62);
  addFrustum(0.3, 0.06, 0.44, 0.036, 0.65, 0.82);
  addFrustum(0.44, 0.036, 0.54, 0.014, 0.84, 0.95);
  // Build tip cap.
  const top = ring(0.54, 0.014);
  const ap = [0, 0.63, 0];
  const ct = colAt(1.0);
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    pushTri(ap[0], ap[1], ap[2], ct[0], ct[1], ct[2], top[i][0], top[i][1], top[i][2], ct[0], ct[1], ct[2], top[i2][0], top[i2][1], top[i2][2], ct[0], ct[1], ct[2]);
  }
  return new Float32Array(v);
}

// FPS moving average over many frames.
var g_fpsPrevEnd = 0;
var g_fpsAccum = 0;
var g_fpsFrames = 0;

// Scene draw entry.
function renderScene() {
  if (!gl || !gUnitCube) {
    return;
  }

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const t = g_time * 0.002;
  const animOn = g_animationOn ? 1 : 0;
  // Small "alive" motion when animation is on.
  const bodyBob = animOn * (0.03 * Math.sin(t * 2.0));
  const bodySwayZ = animOn * (3.0 * Math.sin(t));
  const bodySwayX = animOn * (2.0 * Math.sin(t + 0.9));
  const headNodX = animOn * (6.0 * Math.sin(t * 1.4 + 0.4));
  const headTurnY = animOn * (4.0 * Math.sin(t * 0.9 - 0.2));
  const earFlopZ = animOn * (8.0 * Math.sin(t * 1.8));

  // Combine slider rotation and mouse rotation.
  let globalMat = new Matrix4();
  globalMat.setIdentity();
  globalMat.multiply(new Matrix4().setRotate(gAnimalGlobalRotation + gMouseYaw, 0, 1, 0));
  globalMat.multiply(new Matrix4().setRotate(gMousePitch, 1, 0, 0));
  gl.uniformMatrix4fv(uLocGlobalRotation, false, globalMat.elements);

  let M = new Matrix4();

  const colWhite = [1.0, 1.0, 1.0];
  const colBlack = [0.05, 0.05, 0.07];
  const colBeige = [0.93, 0.89, 0.84];
  const colPink = [0.98, 0.62, 0.74];
  const colFootGray = [0.22, 0.22, 0.26];

  // Body is the parent transform.
  const bodySx = 0.22;
  const bodySy = 0.34;
  const bodySz = 0.2;
  M.setIdentity();
  M.multiply(new Matrix4().setTranslate(0, bodyBob, 0));
  M.multiply(new Matrix4().setRotate(bodySwayZ, 0, 0, 1));
  M.multiply(new Matrix4().setRotate(bodySwayX, 1, 0, 0));
  M.multiply(new Matrix4().setScale(bodySx, bodySy, bodySz));
  drawCube(M, gUnitCube, colWhite);

  let body = new Matrix4();
  body.set(M);

  // Draw belly patch on body front.
  M.setIdentity();
  M.multiply(body);
  M.multiply(new Matrix4().setTranslate(0, -0.42, 1.02));
  M.multiply(new Matrix4().setScale(0.52, 0.38, 0.07));
  drawCube(M, gUnitCube, colBeige);

  const headHy = 0.48;
  const headY = 1.0 + headHy;
  const headWx = 0.92;
  const headWz = 0.9;
  M.setIdentity();
  M.multiply(body);
  M.multiply(new Matrix4().setTranslate(0, headY, 0));
  M.multiply(new Matrix4().setRotate(headTurnY, 0, 1, 0));
  M.multiply(new Matrix4().setRotate(headNodX, 1, 0, 0));
  M.multiply(new Matrix4().setScale(headWx, headHy, headWz));
  drawCube(M, gUnitCube, colWhite);

  const headBase = new Matrix4();
  headBase.set(body);
  headBase.multiply(new Matrix4().setTranslate(0, headY, 0));
  headBase.multiply(new Matrix4().setRotate(headTurnY, 0, 1, 0));
  headBase.multiply(new Matrix4().setRotate(headNodX, 1, 0, 0));
  headBase.multiply(new Matrix4().setScale(headWx, headHy, headWz));

  const eyeS = 0.14;
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(-0.32, 0.22, 0.92));
  M.multiply(new Matrix4().setScale(eyeS * 0.55, eyeS * 0.75, 0.09));
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(0.32, 0.22, 0.92));
  M.multiply(new Matrix4().setScale(eyeS * 0.55, eyeS * 0.75, 0.09));
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(-0.32, 0.22, 0.98));
  M.multiply(new Matrix4().setScale(0.04, 0.04, 0.04));
  drawCube(M, gUnitCube, colWhite);
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(0.32, 0.22, 0.98));
  M.multiply(new Matrix4().setScale(0.04, 0.04, 0.04));
  drawCube(M, gUnitCube, colWhite);
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(0, -0.08, 0.94));
  M.multiply(new Matrix4().setScale(0.1, 0.08, 0.08));
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(headBase);
  M.multiply(new Matrix4().setTranslate(0, -0.28, 0.92));
  M.multiply(new Matrix4().setScale(0.14, 0.03, 0.06));
  drawCube(M, gUnitCube, colBlack);

  // Draw two ears with pink inner part.
  const earY = 1.14;
  const earBaseR = new Matrix4();
  earBaseR.set(headBase);
  earBaseR.multiply(new Matrix4().setTranslate(0.78, earY, 0));
  earBaseR.multiply(new Matrix4().setRotate(-earFlopZ, 0, 0, 1));
  earBaseR.multiply(new Matrix4().setScale(0.22, 0.2, 0.18));
  M.setIdentity();
  M.multiply(earBaseR);
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(earBaseR);
  M.multiply(new Matrix4().setTranslate(0, 0, 0.75));
  M.multiply(new Matrix4().setScale(0.45, 0.45, 0.35));
  drawCube(M, gUnitCube, colPink);

  const earBaseL = new Matrix4();
  earBaseL.set(headBase);
  earBaseL.multiply(new Matrix4().setTranslate(-0.78, earY, 0));
  earBaseL.multiply(new Matrix4().setRotate(earFlopZ, 0, 0, 1));
  earBaseL.multiply(new Matrix4().setScale(0.22, 0.2, 0.18));
  M.setIdentity();
  M.multiply(earBaseL);
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(earBaseL);
  M.multiply(new Matrix4().setTranslate(0, 0, 0.75));
  M.multiply(new Matrix4().setScale(0.45, 0.45, 0.35));
  drawCube(M, gUnitCube, colPink);

  // Arm poke uses two-axis circular motion.
  const armSx = 0.16;
  const armSy = 0.38;
  const armSz = 0.15;
  const armTx = 1.0 + armSx + 0.04;
  const armCircleX = gArmCircleXDeg;
  const armCircleZ = gArmCircleZDeg;
  M.setIdentity();
  M.multiply(body);
  M.multiply(new Matrix4().setTranslate(armTx, 0.08, 0));
  M.multiply(new Matrix4().setRotate(armCircleZ, 0, 0, 1));
  M.multiply(new Matrix4().setRotate(armCircleX, 1, 0, 0));
  M.multiply(new Matrix4().setScale(armSx, armSy, armSz));
  drawCube(M, gUnitCube, colBlack);
  M.setIdentity();
  M.multiply(body);
  M.multiply(new Matrix4().setTranslate(-armTx, 0.08, 0));
  M.multiply(new Matrix4().setRotate(-armCircleZ, 0, 0, 1));
  M.multiply(new Matrix4().setRotate(-armCircleX, 1, 0, 0));
  M.multiply(new Matrix4().setScale(armSx, armSy, armSz));
  drawCube(M, gUnitCube, colBlack);

  const legXZ = 0.22;
  const thY = 0.34;
  const cfY = 0.28;
  const footWx = 0.36;
  const footHy = 0.075;
  const footWz = 0.28;
  const RfootFlat = new Matrix4().setRotate(-150, 1, 0, 0);
  const hipY = -1.0 - thY;

  // Draw one leg chain: thigh, calf, foot.
  const drawLegChain = (hipX, hipZ, rotThigh, rotCalf, rotFoot) => {
    const hipT = new Matrix4().setTranslate(hipX, hipY, hipZ);
    const Rth = new Matrix4().setRotate(rotThigh, 1, 0, 0);
    const Sth = new Matrix4().setScale(legXZ, thY, legXZ);

    const thighPivot = new Matrix4();
    thighPivot.setIdentity();
    thighPivot.multiply(body);
    thighPivot.multiply(hipT);
    thighPivot.multiply(Rth);

    M.setIdentity();
    M.multiply(thighPivot);
    M.multiply(Sth);
    drawCube(M, gUnitCube, colBlack);

    const Rcf = new Matrix4().setRotate(rotCalf, 1, 0, 0);
    const Scf = new Matrix4().setScale(legXZ * 0.92, cfY, legXZ * 0.92);
    const calfPivot = new Matrix4();
    calfPivot.set(thighPivot);
    calfPivot.multiply(new Matrix4().setTranslate(0, -thY, 0));
    calfPivot.multiply(Rcf);

    M.setIdentity();
    M.multiply(calfPivot);
    M.multiply(Scf);
    drawCube(M, gUnitCube, colBlack);

    const Rft = new Matrix4().setRotate(rotFoot, 1, 0, 0);
    const Sft = new Matrix4().setScale(footWx, footHy, footWz);
    const footMat = new Matrix4();
    footMat.set(calfPivot);
    footMat.multiply(new Matrix4().setTranslate(0, -cfY, 0));
    footMat.multiply(RfootFlat);
    footMat.multiply(Rft);
    footMat.multiply(Sft);

    M.setIdentity();
    M.multiply(footMat);
    drawCube(M, gUnitCube, colFootGray);

    M.setIdentity();
    M.multiply(footMat);
    M.multiply(new Matrix4().setTranslate(0, -0.92, footWz * 0.35));
    M.multiply(new Matrix4().setScale(0.22, 0.06, 0.16));
    drawCube(M, gUnitCube, colPink);
  };

  const legSpread = 0.34;
  drawLegChain(legSpread, 0, gJointThighX, gJointCalfX, gJointFootX);
  drawLegChain(-legSpread, 0, -gJointThighX, -gJointCalfX, -gJointFootX);

  // Draw four bamboo meshes near both sides.
  if (gBambooVertexBuffer != null && gBambooVertexCount > 0) {
    const bambooY = -0.7;
    const bambooS = 0.46;
    const drawBambooAt = (tx, tz, degY) => {
      M.setIdentity();
      M.multiply(new Matrix4().setTranslate(tx, bambooY, tz));
      const sway = animOn * (6.0 * Math.sin(t * 1.2 + (tx + tz) * 3.0));
      M.multiply(new Matrix4().setRotate(degY + sway, 0, 1, 0));
      M.multiply(new Matrix4().setScale(bambooS, bambooS, bambooS));
      drawBamboo(M);
    };
    drawBambooAt(-0.56, 0.22, 10);
    drawBambooAt(-0.72, 0.16, -6);
    drawBambooAt(0.56, 0.22, -10);
    drawBambooAt(0.72, 0.16, 6);
  }
}

function theNewTime() {
  return performance.now();
}

// Time update for all animation values.
function updateAnimationAngles() {
  // Base arm motion (walk) + optional poke overlay.
  gArmCircleXDeg = 0;
  gArmCircleZDeg = 0;
  if (g_pokeActive) {
    const dt = performance.now() - g_pokeStartMs;
    if (dt >= POKE_ARM_DURATION_MS) {
      g_pokeActive = false;
    } else {
      const fade = 1 - dt / POKE_ARM_DURATION_MS;
      const phase = dt * 0.02;
      const amp = 24 * fade;
      // Sine and cosine produce a circular arm path.
      gArmCircleXDeg = amp * Math.sin(phase);
      gArmCircleZDeg = amp * Math.cos(phase);
    }
  }
  if (!g_animationOn) {
    gJointThighX = gSliderJointThighX;
    gJointCalfX = gSliderJointCalfX;
    gJointFootX = gSliderJointFootX;
    return;
  }
  const t = g_time * 0.002;
  // Walk cycle for leg joints.
  gJointThighX = 12 + 18 * Math.sin(t);
  gJointCalfX = -10 + 14 * Math.sin(t + 1.1);
  gJointFootX = 10 * Math.sin(t + 2.2);

  // Subtle arm swing during main animation. If poke is active, it overlays.
  const baseArmX = 10 * Math.sin(t + 0.6);
  const baseArmZ = 4 * Math.sin(t + 2.0);
  gArmCircleXDeg += baseArmX;
  gArmCircleZDeg += baseArmZ;
}

function updateFpsDisplay() {
  const el = document.getElementById("fpsLabel");
  if (!el) {
    return;
  }
  const t = performance.now();
  if (g_fpsPrevEnd > 0) {
    const dt = t - g_fpsPrevEnd;
    if (dt > 0) {
      g_fpsAccum += 1000 / dt;
      g_fpsFrames += 1;
      if (g_fpsFrames >= 20) {
        el.textContent = (g_fpsAccum / g_fpsFrames).toFixed(1);
        g_fpsAccum = 0;
        g_fpsFrames = 0;
      }
    }
  }
  g_fpsPrevEnd = t;
}

function tick() {
  // Update values, then render, then refresh fps text.
  g_time = theNewTime();
  updateAnimationAngles();
  renderScene();
  updateFpsDisplay();
}

function animate() {
  // Keep render loop running.
  tick();
  requestAnimationFrame(animate);
}

// Cube draw helper.
function drawCube(M, geometry, flatRgb) {
  // flatRgb enables uniform color mode.
  if (uLocFlatColor != null && uLocUseFlatColor != null) {
    if (flatRgb != null && flatRgb.length >= 3) {
      gl.uniform3f(uLocFlatColor, flatRgb[0], flatRgb[1], flatRgb[2]);
      gl.uniform1f(uLocUseFlatColor, 1.0);
    } else {
      gl.uniform1f(uLocUseFlatColor, 0.0);
    }
  }
  gl.uniformMatrix4fv(uLocModelMatrix, false, M.elements);
  if (gCubeVertexBuffer != null) {
    // Rebind cube buffer after any other buffer draw.
    gl.bindBuffer(gl.ARRAY_BUFFER, gCubeVertexBuffer);
    if (gAttribAPosition >= 0 && gAttribAColor >= 0) {
      gl.vertexAttribPointer(gAttribAPosition, 3, gl.FLOAT, false, gVertexStrideBytes, 0);
      gl.vertexAttribPointer(gAttribAColor, 3, gl.FLOAT, false, gVertexStrideBytes, 3 * Float32Array.BYTES_PER_ELEMENT);
    }
    gl.drawArrays(gl.TRIANGLES, 0, gCubeVertexCount);
  } else {
    gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, geometry.vertices.length / 6);
  }
}

function drawBamboo(M) {
  if (!gl || gBambooVertexBuffer == null || gBambooVertexCount <= 0 || gAttribAPosition < 0) {
    return;
  }
  if (uLocUseFlatColor != null) {
    gl.uniform1f(uLocUseFlatColor, 0.0);
  }
  gl.uniformMatrix4fv(uLocModelMatrix, false, M.elements);
  // Bamboo uses per-vertex color from its own VBO.
  gl.bindBuffer(gl.ARRAY_BUFFER, gBambooVertexBuffer);
  gl.vertexAttribPointer(gAttribAPosition, 3, gl.FLOAT, false, gVertexStrideBytes, 0);
  gl.vertexAttribPointer(gAttribAColor, 3, gl.FLOAT, false, gVertexStrideBytes, 3 * Float32Array.BYTES_PER_ELEMENT);
  gl.drawArrays(gl.TRIANGLES, 0, gBambooVertexCount);
}

function main() {
    let canvas = document.getElementById("webgl");

    // Get WebGL context and enable depth test.
    gl = getWebGLContext(canvas);
    if(!gl) {
        console.log("Failed to get WebGL context.")
        return -1;
    }

    gl.enable(gl.DEPTH_TEST);

    // Pink clear color for canvas background.
    gl.clearColor(1.0, 192 / 255, 203 / 255, 1.0);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gUnitCube = new cube();

    // Compile and link shaders.
    if(!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
        console.log("Failed to compile and load shaders.")
        return -1;
    }

    // Get uniform locations from linked program.
    uLocModelMatrix = gl.getUniformLocation(gl.program, "u_ModelMatrix");
    uLocGlobalRotation = gl.getUniformLocation(gl.program, "uGlobalRotation");
    uLocFlatColor = gl.getUniformLocation(gl.program, "u_FlatColor");
    uLocUseFlatColor = gl.getUniformLocation(gl.program, "u_UseFlatColor");
    if (!uLocModelMatrix || !uLocGlobalRotation || !uLocFlatColor || !uLocUseFlatColor) {
        console.log("Failed to get uniform locations (u_ModelMatrix / uGlobalRotation / u_FlatColor / u_UseFlatColor).");
        return -1;
    }

    // Create one shared VBO for cube vertices.
    let vertexBuffer = gl.createBuffer();
    if(!vertexBuffer) {
        console.log("Can't create buffer");
        return -1;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // Set attribute layout: position then color.
    let FLOAT_SIZE = Float32Array.BYTES_PER_ELEMENT;

    let a_Position = gl.getAttribLocation(gl.program, "a_Position");
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 6*FLOAT_SIZE, 0*FLOAT_SIZE);
    gl.enableVertexAttribArray(a_Position);

    let a_Color = gl.getAttribLocation(gl.program, "a_Color");
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, 6*FLOAT_SIZE, 3*FLOAT_SIZE);
    gl.enableVertexAttribArray(a_Color);

    gAttribAPosition = a_Position;
    gAttribAColor = a_Color;

    gCubeVertexBuffer = vertexBuffer;
    gl.bufferData(gl.ARRAY_BUFFER, gUnitCube.vertices, gl.STATIC_DRAW);
    gCubeVertexCount = gUnitCube.vertices.length / 6;

    // Create bamboo VBO once.
    const bambooBuf = gl.createBuffer();
    if (bambooBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bambooBuf);
      const bambooVerts = buildBambooShootVertices();
      gl.bufferData(gl.ARRAY_BUFFER, bambooVerts, gl.STATIC_DRAW);
      gBambooVertexBuffer = bambooBuf;
      gBambooVertexCount = bambooVerts.length / 6;
    }
    // Restore cube VBO as default draw source.
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 6*FLOAT_SIZE, 0*FLOAT_SIZE);
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, 6*FLOAT_SIZE, 3*FLOAT_SIZE);

    // Slider updates only global Y rotation.
    let sliderEl = document.getElementById("sliderGlobalRot");
    let labelEl = document.getElementById("globalRotLabel");
    function syncGlobalRotationFromSlider() {
      gAnimalGlobalRotation = parseFloat(sliderEl.value, 10);
      labelEl.textContent = String(Math.round(gAnimalGlobalRotation));
      renderScene();
    }
    sliderEl.addEventListener("input", syncGlobalRotationFromSlider);
    syncGlobalRotationFromSlider();

    // Reusable slider binding helper.
    function bindJointSlider(id, labelId, setter) {
      const el = document.getElementById(id);
      const lab = document.getElementById(labelId);
      function sync() {
        const v = parseFloat(el.value, 10);
        setter(v);
        if (lab) {
          lab.textContent = String(Math.round(v));
        }
        renderScene();
      }
      el.addEventListener("input", sync);
      sync();
    }

    bindJointSlider("sliderThighX", "thighXLabel", function (v) {
      gSliderJointThighX = v;
      if (!g_animationOn) {
        gJointThighX = v;
      }
    });
    bindJointSlider("sliderCalfX", "calfXLabel", function (v) {
      gSliderJointCalfX = v;
      if (!g_animationOn) {
        gJointCalfX = v;
      }
    });
    bindJointSlider("sliderFootX", "footXLabel", function (v) {
      gSliderJointFootX = v;
      if (!g_animationOn) {
        gJointFootX = v;
      }
    });

    // Toggle walk animation on and off.
    const animBtn = document.getElementById("btnAnimationToggle");
    function syncAnimButtonLabel() {
      animBtn.textContent = g_animationOn ? "Turn animation OFF" : "Turn animation ON";
    }
    animBtn.addEventListener("click", function () {
      g_animationOn = !g_animationOn;
      updateAnimationAngles();
      syncAnimButtonLabel();
      renderScene();
    });
    syncAnimButtonLabel();

    // Mouse drag rotates scene.
    canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) {
        return;
      }
      gMouseDragging = true;
      gLastMouseX = e.clientX;
      gLastMouseY = e.clientY;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!gMouseDragging) {
        return;
      }
      const dx = e.clientX - gLastMouseX;
      const dy = e.clientY - gLastMouseY;
      gLastMouseX = e.clientX;
      gLastMouseY = e.clientY;
      gMouseYaw += dx * MOUSE_ROT_SENS;
      gMousePitch += dy * MOUSE_ROT_SENS;
      gMousePitch = Math.max(-85, Math.min(85, gMousePitch));
      renderScene();
    });
    window.addEventListener("mouseup", function () {
      gMouseDragging = false;
    });

    // Shift click starts poke animation.
    canvas.addEventListener("click", function (e) {
      if (!e.shiftKey) {
        return;
      }
      g_pokeStartMs = performance.now();
      g_pokeActive = true;
      renderScene();
    });

    window.addEventListener("resize", function () {
      updateAnimationAngles();
      renderScene();
    });

    // Draw once, then start animation loop.
    renderScene();
    animate();

}
