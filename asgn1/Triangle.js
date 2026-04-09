// Six xy numbers -> Float32Array of 3 vertices (z = 0).
function drawTriangle(verts9) {
  if (verts9.length !== 6) {
    return null;
  }
  return new Float32Array([
    verts9[0], verts9[1], 0.0,
    verts9[2], verts9[3], 0.0,
    verts9[4], verts9[5], 0.0
  ]);
}

// Holds color + vertex buffer; draws one triangle.
function Triangle(r, g, b, vbuf) {
  this.color = [r, g, b];
  this.vertices = vbuf;
}

// Upload buffer; set uniforms; draw TRIANGLES (3 verts).
Triangle.prototype.render = function () {
  var gl = window.g_gl;
  if (!gl) return;

  gl.uniform1f(window.g_uSize, 1.0);
  gl.uniform3f(window.g_uColor, this.color[0], this.color[1], this.color[2]);

  gl.bindBuffer(gl.ARRAY_BUFFER, window.g_vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(window.g_aPosition, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(window.g_aPosition);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
};
