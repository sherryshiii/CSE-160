// Phong calculated based on: https://en.wikipedia.org/wiki/Phong_reflection_model

// Shaders (GLSL)
let VSHADER=`
      precision mediump float;
      attribute vec3 a_Position;
      attribute vec3 a_Normal;

      uniform mat4 u_ModelMatrix;
      uniform mat4 u_ViewMatrix;
      uniform mat4 u_ProjMatrix;

      uniform mat4 u_NormalMatrix;

      varying vec3 n;
      varying vec4 worldPos;

      void main() {
        // Mapping obj coord system to world coord system
        worldPos = u_ModelMatrix * vec4(a_Position, 1.0);

        n = normalize(u_NormalMatrix * vec4(a_Normal, 0.0)).xyz; // Normal

        gl_Position = u_ProjMatrix * u_ViewMatrix * worldPos;
      }
  `;

let FSHADER=`
    precision mediump float;
    uniform vec3 u_Color;
    uniform vec3 u_ambientColor;
    uniform vec3 u_diffuseColor;
    uniform vec3 u_specularColor;

    uniform vec3 u_lightDirection;
    uniform vec3 u_lightLocation;
    uniform vec3 u_eyePosition;

    uniform bool u_NormalViz;
    uniform bool u_LightingOn;
    uniform bool u_PointLightOn;
    uniform bool u_SpotLightOn;

    uniform vec3  u_SpotLightPos;
    uniform vec3  u_SpotLightDir;
    uniform float u_SpotCutoff;

    varying vec3 n;
    varying vec4 worldPos;

    vec3 calcAmbient(){
        return u_ambientColor * u_Color;
    }

    vec3 calcDiffuse(vec3 l, vec3 n, vec3 dColor){
        float nDotL = max(dot(l, n), 0.0);
        return dColor * u_Color * nDotL;
    }

    vec3 calcSpecular(vec3 r, vec3 v){
        float rDotV = max(dot(r,v), 0.0);
        float rDotVPowS = pow(rDotV, 32.0);
        return u_specularColor * u_Color * rDotVPowS;
    }

    void main() {
        if (u_NormalViz) {
            gl_FragColor = vec4(n, 1.0);
            return;
        }

        if (!u_LightingOn) {
            gl_FragColor = vec4(u_Color, 1.0);
            return;
        }

        vec3 v = normalize(u_eyePosition - worldPos.xyz);
        vec3 color = calcAmbient();

        if (u_PointLightOn) {
            vec3 lp = normalize(u_lightLocation - worldPos.xyz);
            vec3 rp = reflect(lp, n);
            color += calcDiffuse(lp, n, u_diffuseColor);
            color += calcSpecular(rp, -v);
        }

        if (u_SpotLightOn) {
            vec3 ls = normalize(u_SpotLightPos - worldPos.xyz);
            vec3 spotDir = normalize(u_SpotLightDir);
            float spotCos = dot(-ls, spotDir);
            if (spotCos > u_SpotCutoff) {
                float intensity = smoothstep(u_SpotCutoff, u_SpotCutoff + 0.05, spotCos);
                vec3 rs = reflect(ls, n);
                color += calcDiffuse(ls, n, u_diffuseColor) * intensity;
                color += calcSpecular(rs, -v) * intensity;
            }
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

let modelMatrix = new Matrix4();
let normalMatrix = new Matrix4();

let models = [];

let lightDirection = new Vector3([1.0, 1.0, 1.0]);
let lightLocation = new Vector3([5.0, 3.0, 5.0]);
let lightRotation = new Matrix4().setRotate(1, 0, 1, 0);

// Uniform locations
let u_ModelMatrix = null;
let u_ViewMatrix = null;
let u_ProjMatrix = null;

let u_NormalMatrix = null;

let u_Color = null;
let u_ambientColor = null;
let u_diffuseColor = null;
let u_specularColor = null;

let u_lightDirection = null;
let u_lightLocation = null;
let u_eyePosition = null;

let u_NormalViz = null;
let u_LightingOn = null;
let u_PointLightOn = null;
let u_SpotLightOn = null;
let u_SpotLightPos = null;
let u_SpotLightDir = null;
let u_SpotCutoff = null;

let normalVizOn = false;
let lightingOn = true;
let pointLightOn = true;
let spotLightOn = true;
let lightColor = [1.0, 1.0, 1.0];

let spotLightPos = new Vector3([0.0, 6.0, 0.0]);
let spotLightDir = new Vector3([0.0, -1.0, 0.0]);
let spotCutoffDeg = 25.0;

function drawModel(model) {
    // Update model matrix combining translate, rotate and scale from cube
    modelMatrix.setIdentity();

    // Apply translation for this part of the animal
    modelMatrix.translate(model.translate[0], model.translate[1], model.translate[2]);

    // Apply rotations for this part of the animal
    modelMatrix.rotate(model.rotate[0], 1, 0, 0);
    modelMatrix.rotate(model.rotate[1], 0, 1, 0);
    modelMatrix.rotate(model.rotate[2], 0, 0, 1);

    // Apply scaling for this part of the animal
    modelMatrix.scale(model.scale[0], model.scale[1], model.scale[2]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    // Compute normal matrix N_mat = (M^-1).T
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    // Set u_Color variable from fragment shader
    gl.uniform3f(u_Color, model.color[0], model.color[1], model.color[2]);

    // Send vertices and indices from model to the shaders
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, model.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, model.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, model.indices, gl.STATIC_DRAW);

    // Draw model
    gl.drawElements(gl.TRIANGLES, model.indices.length, gl.UNSIGNED_SHORT, 0);

    //gl.uniform3f(u_Color, 0.0, 1.0, 0.0);

    //gl.drawElements(gl.LINE_LOOP, model.indices.length, gl.UNSIGNED_SHORT, 0);
}


function initBuffer(attibuteName, n) {
    let shaderBuffer = gl.createBuffer();
    if(!shaderBuffer) {
        console.log("Can't create buffer.")
        return -1;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, shaderBuffer);

    let shaderAttribute = gl.getAttribLocation(gl.program, attibuteName);
    gl.vertexAttribPointer(shaderAttribute, n, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shaderAttribute);

    return shaderBuffer;
}

function draw() {
    // Draw frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1i(u_NormalViz,    normalVizOn  ? 1 : 0);
    gl.uniform1i(u_LightingOn,   lightingOn   ? 1 : 0);
    gl.uniform1i(u_PointLightOn, pointLightOn ? 1 : 0);
    gl.uniform1i(u_SpotLightOn,  spotLightOn  ? 1 : 0);

    gl.uniform3f(u_diffuseColor,  lightColor[0], lightColor[1], lightColor[2]);
    gl.uniform3f(u_specularColor, lightColor[0], lightColor[1], lightColor[2]);

    gl.uniform3fv(u_SpotLightPos, spotLightPos.elements);
    gl.uniform3fv(u_SpotLightDir, spotLightDir.elements);
    gl.uniform1f(u_SpotCutoff, Math.cos(spotCutoffDeg * Math.PI / 180.0));

    lightLocation = lightRotation.multiplyVector3(lightLocation);
    gl.uniform3fv(u_lightLocation, lightLocation.elements);
    pointLightSphere.setTranslate(lightLocation.elements[0], lightLocation.elements[1], lightLocation.elements[2]);

    // Update eye position in the shader
    gl.uniform3fv(u_eyePosition, camera.eye.elements);

    // Update View matrix in the shader
    gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);

    // Update Projection matrix in the shader
    gl.uniformMatrix4fv(u_ProjMatrix, false, camera.projMatrix.elements);

    for(let m of models) {
        drawModel(m);
    }

    requestAnimationFrame(draw);
}

function addModel(color, shapeType) {
    let model = null;
    switch (shapeType) {
        case "cube":
            model = new Cube(color);
            break;
        case "sphere":
            model = new Sphere(color);
            break;
    }

    if(model) {
        models.push(model);
    }

    return model;
}

function buildWorld() {
    // grass ground
    let ground = addModel([0.35, 0.7, 0.25], "cube");
    ground.setScale(10.0, 0.25, 10.0);
    ground.setTranslate(0.0, -0.25, 0.0);

    // back wall
    let backWall = addModel([0.55, 0.27, 0.15], "cube");
    backWall.setScale(10.0, 2.0, 0.25);
    backWall.setTranslate(0.0, 2.0, -10.0);

    // left wall
    let leftWall = addModel([0.55, 0.27, 0.15], "cube");
    leftWall.setScale(0.25, 2.0, 10.0);
    leftWall.setTranslate(-10.0, 2.0, 0.0);

    // right wall
    let rightWall = addModel([0.55, 0.27, 0.15], "cube");
    rightWall.setScale(0.25, 2.0, 10.0);
    rightWall.setTranslate(10.0, 2.0, 0.0);

    // wood staircase
    let woodColor = [0.62, 0.40, 0.18];
    for (let i = 0; i < 4; i++) {
        let b = addModel(woodColor, "cube");
        b.setScale(0.6, 0.6, 0.6);
        b.setTranslate(-5.0 + i * 1.2, 0.5 + i * 1.2, -5.0);
    }

    // stone blocks
    let stoneColor = [0.55, 0.55, 0.60];
    let stonePositions = [
        [-3.0, 0.6, 3.0],
        [-1.5, 0.6, 4.0],
        [ 4.5, 0.6, 3.5],
        [ 5.5, 1.8, 3.5],
    ];
    for (let p of stonePositions) {
        let b = addModel(stoneColor, "cube");
        b.setScale(0.6, 0.6, 0.6);
        b.setTranslate(p[0], p[1], p[2]);
    }

    // gold corner blocks
    let goldColor = [0.95, 0.78, 0.15];
    let goldPositions = [[-8.0, 0.6, -8.0], [8.0, 0.6, 8.0]];
    for (let p of goldPositions) {
        let b = addModel(goldColor, "cube");
        b.setScale(0.6, 0.6, 0.6);
        b.setTranslate(p[0], p[1], p[2]);
    }
}

function onZoomInput(value) {
    console.log(1.0 + value/10);
    camera.zoom(1.0 + value/10);
}

function toggleNormalViz() {
    normalVizOn = !normalVizOn;
    let btn = document.getElementById("normalVizBtn");
    btn.innerText = "Normal Visualization: " + (normalVizOn ? "ON" : "OFF");
}

function toggleLighting() {
    lightingOn = !lightingOn;
    let btn = document.getElementById("lightingBtn");
    btn.innerText = "Lighting: " + (lightingOn ? "ON" : "OFF");
}

function togglePointLight() {
    pointLightOn = !pointLightOn;
    let btn = document.getElementById("pointLightBtn");
    btn.innerText = "Point Light: " + (pointLightOn ? "ON" : "OFF");
}

function toggleSpotLight() {
    spotLightOn = !spotLightOn;
    let btn = document.getElementById("spotLightBtn");
    btn.innerText = "Spot Light: " + (spotLightOn ? "ON" : "OFF");
}

function onLightPosInput() {
    let x = parseFloat(document.getElementById("lightXSlider").value);
    let y = parseFloat(document.getElementById("lightYSlider").value);
    let z = parseFloat(document.getElementById("lightZSlider").value);
    lightLocation = new Vector3([x, y, z]);
}

function onLightColorInput() {
    lightColor[0] = parseFloat(document.getElementById("lightRSlider").value);
    lightColor[1] = parseFloat(document.getElementById("lightGSlider").value);
    lightColor[2] = parseFloat(document.getElementById("lightBSlider").value);
}

window.addEventListener("keydown", function(event) {
    let speed = 1.0;

    switch (event.key) {
        case "w":
            console.log("forward");
            camera.moveForward(speed);
            break;
        case "s":
            console.log("back");
            camera.moveForward(-speed);
            break;
        case "a":
            console.log("pan left");
            camera.pan(5);
            break;
        case "d":
            console.log("pan right");
            camera.pan(-5);
            break;

    }
});

window.addEventListener("mousemove", function(event) {
    // console.log(event.movementX, event.movementY);
})

function main() {
    // Retrieving the canvas tag from html document
    canvas = document.getElementById("canvas");

    // Get the rendering context for 2D drawing (vs WebGL)
    gl = canvas.getContext("webgl");
    if(!gl) {
        console.log("Failed to get webgl context");
        return -1;
    }

    // Clear screen
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compiling both shaders and sending them to the GPU
    if(!initShaders(gl, VSHADER, FSHADER)) {
        console.log("Failed to initialize shaders.");
        return -1;
    }

    // Retrieve uniforms from shaders
    u_ModelMatrix = gl.getUniformLocation(gl.program, "u_ModelMatrix");
    u_ViewMatrix = gl.getUniformLocation(gl.program, "u_ViewMatrix");
    u_ProjMatrix = gl.getUniformLocation(gl.program, "u_ProjMatrix");

    u_NormalMatrix = gl.getUniformLocation(gl.program, "u_NormalMatrix");

    u_Color = gl.getUniformLocation(gl.program, "u_Color");

    u_ambientColor = gl.getUniformLocation(gl.program, "u_ambientColor");
    u_diffuseColor = gl.getUniformLocation(gl.program, "u_diffuseColor");
    u_specularColor = gl.getUniformLocation(gl.program, "u_specularColor");

    u_lightDirection = gl.getUniformLocation(gl.program, "u_lightDirection");
    u_lightLocation = gl.getUniformLocation(gl.program, "u_lightLocation");


    u_eyePosition = gl.getUniformLocation(gl.program, "u_eyePosition");

    u_NormalViz    = gl.getUniformLocation(gl.program, "u_NormalViz");
    u_LightingOn   = gl.getUniformLocation(gl.program, "u_LightingOn");
    u_PointLightOn = gl.getUniformLocation(gl.program, "u_PointLightOn");
    u_SpotLightOn  = gl.getUniformLocation(gl.program, "u_SpotLightOn");
    u_SpotLightPos = gl.getUniformLocation(gl.program, "u_SpotLightPos");
    u_SpotLightDir = gl.getUniformLocation(gl.program, "u_SpotLightDir");
    u_SpotCutoff   = gl.getUniformLocation(gl.program, "u_SpotCutoff");

    buildWorld();

    let redBall = addModel([0.85, 0.2, 0.2], "sphere");
    redBall.setScale(1.0, 1.0, 1.0);
    redBall.setTranslate(0.0, 1.0, 0.0);

    let blueBall = addModel([0.2, 0.4, 0.9], "sphere");
    blueBall.setScale(0.6, 0.6, 0.6);
    blueBall.setTranslate(3.0, 0.6, -1.5);

    // load torus obj
    let torus = new ObjModel([0.9, 0.5, 0.8]);
    torus.setScale(1.2, 1.2, 1.2);
    torus.setTranslate(-3.5, 1.0, 1.5);
    torus.setRotate(20, 0, 0);
    torus.load("models/torus.obj").then(() => {
        models.push(torus);
    });

    // point light marker
    pointLightSphere = new Sphere([1.0, 1.0, 1.0]);
    pointLightSphere.setScale(0.1, 0.1, 0.1);
    pointLightSphere.setTranslate(lightLocation);
    models.push(pointLightSphere);

    // spotlight marker
    spotLightSphere = new Sphere([1.0, 1.0, 0.0]);
    spotLightSphere.setScale(0.15, 0.15, 0.15);
    spotLightSphere.setTranslate(spotLightPos.elements[0], spotLightPos.elements[1], spotLightPos.elements[2]);
    models.push(spotLightSphere);

    vertexBuffer = initBuffer("a_Position", 3);
    normalBuffer = initBuffer("a_Normal", 3);

    indexBuffer = gl.createBuffer();
    if(!indexBuffer) {
        console.log("Can't create buffer.")
        return -1;
    }

    // Set light Data

    gl.uniform3f(u_ambientColor, 0.2, 0.2, 0.2);
    gl.uniform3f(u_diffuseColor, 0.8, 0.8, 0.8);
    gl.uniform3f(u_specularColor, 1.0, 1.0, 1.0);

    gl.uniform3fv(u_lightDirection, lightDirection.elements);

    // Set camera data
    camera = new Camera();

    draw();
}
