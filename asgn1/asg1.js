// Vertex shader: clip position and point size.
var VERTEX_SHADER =
  'attribute vec3 a_Position;\n' +
  'uniform float u_Size;\n' +
  'void main() {\n' +
  '  gl_Position = vec4(a_Position, 1.0);\n' +
  '  gl_PointSize = u_Size;\n' +
  '}\n';

// Fragment shader: one RGBA color.
var FRAGMENT_SHADER =
  'precision mediump float;\n' +
  'uniform vec3 u_Color;\n' +
  'void main() {\n' +
  '  gl_FragColor = vec4(u_Color, 1.0);\n' +
  '}\n';

// All shapes to draw each frame.
var shapesList = [];

// Brush: RGB, pixel size, circle segments, active tool.
var g_color = [1.0, 0.0, 0.0];
var g_pointSizePx = 10.0;
var g_circleSegments = segmentSliderToCount(16);
var g_drawMode = 'point';

// WebGL context, buffer, shader locations.
var g_gl = null;
var g_vertexBuffer = null;
var g_aPosition = null;
var g_uColor = null;
var g_uSize = null;

// Same GL state for Triangle.js / Circle.js.
window.g_gl = null;
window.g_vertexBuffer = null;
window.g_aPosition = null;
window.g_uColor = null;
window.g_uSize = null;

// Point brush: one screen-space square via GL_POINTS.
function Point(cx, cy, r, g, b, sizePx) {
  this.cx = cx;
  this.cy = cy;
  this.color = [r, g, b];
  this.sizePx = sizePx;
}

// Push one vertex; set size and color; draw POINTS.
Point.prototype.render = function () {
  var gl = g_gl;
  var data = new Float32Array([this.cx, this.cy, 0.0]);
  gl.uniform1f(g_uSize, this.sizePx);
  gl.uniform3f(g_uColor, this.color[0], this.color[1], this.color[2]);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(g_aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(g_aPosition);
  gl.drawArrays(gl.POINTS, 0, 1);
};

// Create WebGL context (keep buffer when dragging) and one ARRAY_BUFFER.
function setupWebGL() {
  var canvas = document.getElementById('webgl');
  g_gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!g_gl) {
    console.log('Failed to get WebGL context.');
    return false;
  }
  window.g_gl = g_gl;
  g_vertexBuffer = g_gl.createBuffer();
  window.g_vertexBuffer = g_vertexBuffer;
  return true;
}

// Build shader program; store a_Position, u_Color, u_Size.
function connectVariablesToGLSL() {
  if (!initShaders(g_gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
    console.log('Failed to init shaders.');
    return false;
  }
  g_aPosition = g_gl.getAttribLocation(g_gl.program, 'a_Position');
  g_uColor = g_gl.getUniformLocation(g_gl.program, 'u_Color');
  g_uSize = g_gl.getUniformLocation(g_gl.program, 'u_Size');
  window.g_aPosition = g_aPosition;
  window.g_uColor = g_uColor;
  window.g_uSize = g_uSize;
  return true;
}

// Black clear; redraw whole list.
function renderAllShapes() {
  if (!g_gl) return;
  g_gl.clearColor(0.0, 0.0, 0.0, 1.0);
  g_gl.clear(g_gl.COLOR_BUFFER_BIT);
  for (var i = 0; i < shapesList.length; i++) {
    shapesList[i].render();
  }
}

// Mouse position in canvas pixels to clip space [-1, 1].
function eventToClip(ev) {
  var canvas = ev.target;
  var rect = canvas.getBoundingClientRect();
  var x = ev.clientX - rect.left;
  var y = ev.clientY - rect.top;
  var cx = (x - canvas.width / 2) / (canvas.width / 2);
  var cy = (canvas.height / 2 - y) / (canvas.height / 2);
  return { x: cx, y: cy };
}

// Add point, triangle, or circle at event using current brush.
function addShapeAtEvent(ev) {
  var p = eventToClip(ev);
  var r = g_color[0];
  var g = g_color[1];
  var b = g_color[2];

  if (g_drawMode === 'point') {
    shapesList.push(new Point(p.x, p.y, r, g, b, g_pointSizePx));
    return;
  }

  if (g_drawMode === 'triangle') {
    // Equilateral triangle around click; scale from size slider.
    var canvas = document.getElementById('webgl');
    var s = (g_pointSizePx / Math.min(canvas.width, canvas.height)) * 2.0 * 0.6;
    var x0 = p.x;
    var y0 = p.y + s;
    var x1 = p.x - s * 0.866;
    var y1 = p.y - s * 0.5;
    var x2 = p.x + s * 0.866;
    var y2 = p.y - s * 0.5;
    var buf = new Float32Array([x0, y0, 0.0, x1, y1, 0.0, x2, y2, 0.0]);
    shapesList.push(new Triangle(r, g, b, buf));
    return;
  }

  if (g_drawMode === 'circle') {
    var canvas2 = document.getElementById('webgl');
    var rad = (g_pointSizePx / Math.min(canvas2.width, canvas2.height)) * 2.0 * 0.55;
    shapesList.push(
      new Circle(p.x, p.y, rad, g_circleSegments, r, g, b)
    );
  }
}

// Paint on mousedown; on mousemove only if left button down.
function handleClicks(ev) {
  if (ev.type === 'mousemove' && ev.buttons !== 1) {
    return;
  }
  addShapeAtEvent(ev);
  renderAllShapes();
}

// Empty shapes; redraw black canvas.
function clearCanvas() {
  shapesList = [];
  renderAllShapes();
}

// Map slider 3..64 to segment count (power curve for visible low end).
function segmentSliderToCount(sliderVal) {
  var minS = 3;
  var maxS = 64;
  var v = Math.max(minS, Math.min(maxS, sliderVal));
  var p = (v - minS) / (maxS - minS);
  var exp = 1.3;
  return Math.round(minS + Math.pow(p, exp) * (maxS - minS));
}

// Append axis-aligned rect as two triangles.
function pushQuadAsTwoTriangles(list, x, y, w, h, r, g, b) {
  var T = Triangle;
  list.push(new T(r, g, b, drawTriangle([x, y, x + w, y, x + w, y + h])));
  list.push(new T(r, g, b, drawTriangle([x, y, x + w, y + h, x, y + h])));
}

// Append diamond (two triangles).
function pushDiamond(list, cx, cy, rx, ry, r, g, b) {
  var T = Triangle;
  list.push(new T(r, g, b, drawTriangle([cx, cy + ry, cx + rx, cy, cx, cy - ry])));
  list.push(new T(r, g, b, drawTriangle([cx, cy + ry, cx, cy - ry, cx - rx, cy])));
}

// Append one triangle.
function pushTriangle(list, x1, y1, x2, y2, x3, y3, r, g, b) {
  list.push(new Triangle(r, g, b, drawTriangle([x1, y1, x2, y2, x3, y3])));
}

// Drop last shape; redraw.
function undoLast() {
  if (shapesList.length > 0) {
    shapesList.pop();
    renderAllShapes();
  }
}

// Replace list with demo: flower grid, tips, S stem.
function loadDemoPainting() {
  shapesList = [];

  var rx = 0.05;
  var ry = 0.05;
  var step = 2 * rx;
  var yTop = 0.5;
  var petalR = 0.92;
  var petalG = 0.72;
  var petalB = 0.82;
  var centerR = 1.0;
  var centerG = 0.92;
  var centerB = 0.45;

  // 3x3 diamonds; center cell different color.
  var rr;
  var cc;
  for (rr = 0; rr < 3; rr++) {
    for (cc = 0; cc < 3; cc++) {
      var cxi = (cc - 1) * step;
      var cyi = yTop - rr * step;
      var isMid = rr === 1 && cc === 1;
      if (isMid) {
        pushDiamond(shapesList, cxi, cyi, rx, ry, centerR, centerG, centerB);
      } else {
        pushDiamond(shapesList, cxi, cyi, rx, ry, petalR, petalG, petalB);
      }
    }
  }

  // Four outward triangles on flower edges.
  var tip = 0.055;
  var tw = rx * 0.95;
  pushTriangle(shapesList, 0, yTop + ry + tip, -tw, yTop + ry, tw, yTop + ry, petalR, petalG, petalB);
  var yBot = yTop - 2 * step;
  pushTriangle(shapesList, 0, yBot - ry - tip, -tw, yBot - ry, tw, yBot - ry, petalR, petalG, petalB);
  var yMid = yTop - step;
  var leftX = -step - rx;
  var rightX = step + rx;
  pushTriangle(shapesList, leftX - tip, yMid, leftX, yMid + tw, leftX, yMid - tw, petalR, petalG, petalB);
  pushTriangle(shapesList, rightX + tip, yMid, rightX, yMid + tw, rightX, yMid - tw, petalR, petalG, petalB);

  // Stem: stacked horizontal and vertical quads (S shape).
  var sR = 0.18;
  var sG = 0.62;
  var sB = 0.28;
  var t = 0.05;
  var xl = -0.23;
  var xr = 0.025;
  var xMidL = -t / 2;
  var yJoin = yBot - ry;
  var y1 = 0.08;
  pushQuadAsTwoTriangles(shapesList, xMidL, y1, t, yJoin - y1, sR, sG, sB);
  pushQuadAsTwoTriangles(shapesList, xl, y1, xr - xl, t, sR, sG, sB);
  var y2 = -0.07;
  pushQuadAsTwoTriangles(shapesList, xl - t / 2, y2, t, y1 + t - y2, sR, sG, sB);
  pushQuadAsTwoTriangles(shapesList, xl, y2 - t / 2, xr - xl, t, sR, sG, sB);
  var y3 = -0.32;
  pushQuadAsTwoTriangles(shapesList, xMidL, y3, t, y2 - t / 2 - y3, sR, sG, sB);
  pushQuadAsTwoTriangles(shapesList, xl, y3 - t / 2, xr - xl, t, sR, sG, sB);

  renderAllShapes();
}

// Init GL and shaders; bind UI; first redraw.
function main() {
  if (!setupWebGL()) return;
  if (!connectVariablesToGLSL()) return;

  var canvas = document.getElementById('webgl');
  canvas.onmousedown = handleClicks;
  canvas.onmousemove = handleClicks;

  document.getElementById('btnClear').onclick = clearCanvas;
  document.getElementById('btnPoint').onclick = function () {
    g_drawMode = 'point';
  };
  document.getElementById('btnTriangle').onclick = function () {
    g_drawMode = 'triangle';
  };
  document.getElementById('btnCircle').onclick = function () {
    g_drawMode = 'circle';
  };
  document.getElementById('btnDemo').onclick = loadDemoPainting;
  document.getElementById('btnUndo').onclick = undoLast;

  // RGB sliders -> g_color (0..1).
  function syncColorFromSliders() {
    g_color[0] = document.getElementById('redS').value / 255;
    g_color[1] = document.getElementById('greenS').value / 255;
    g_color[2] = document.getElementById('blueS').value / 255;
  }

  document.getElementById('redS').addEventListener('input', syncColorFromSliders);
  document.getElementById('greenS').addEventListener('input', syncColorFromSliders);
  document.getElementById('blueS').addEventListener('input', syncColorFromSliders);

  document.getElementById('sizeS').addEventListener('input', function () {
    g_pointSizePx = parseFloat(this.value, 10);
  });

  document.getElementById('segS').addEventListener('input', function () {
    g_circleSegments = segmentSliderToCount(parseInt(this.value, 10));
  });

  syncColorFromSliders();
  g_pointSizePx = parseFloat(document.getElementById('sizeS').value, 10);
  g_circleSegments = segmentSliderToCount(parseInt(document.getElementById('segS').value, 10));

  renderAllShapes();
}
