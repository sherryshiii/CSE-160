// Filled disk: many triangles around center.
function Circle(cx, cy, radius, segments, r, g, b) {
  this.cx = cx;
  this.cy = cy;
  this.radius = radius;
  this.segments = Math.max(3, Math.floor(segments));
  this.color = [r, g, b];
}

// Build wedge list; upload; draw all triangles.
Circle.prototype.render = function () {
  var gl = window.g_gl;
  if (!gl) return;

  var n = this.segments;
  var verts = [];
  var cx = this.cx;
  var cy = this.cy;
  var rad = this.radius;

  // One triangle per wedge: center, rim i, rim i+1.
  for (var i = 0; i < n; i++) {
    var a0 = (i / n) * Math.PI * 2;
    var a1 = ((i + 1) / n) * Math.PI * 2;
    verts.push(cx, cy, 0.0);
    verts.push(cx + rad * Math.cos(a0), cy + rad * Math.sin(a0), 0.0);
    verts.push(cx + rad * Math.cos(a1), cy + rad * Math.sin(a1), 0.0);
  }

  var arr = new Float32Array(verts);

  gl.uniform1f(window.g_uSize, 1.0);
  gl.uniform3f(window.g_uColor, this.color[0], this.color[1], this.color[2]);

  gl.bindBuffer(gl.ARRAY_BUFFER, window.g_vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
  gl.vertexAttribPointer(window.g_aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(window.g_aPosition);

  gl.drawArrays(gl.TRIANGLES, 0, arr.length / 3);
};
