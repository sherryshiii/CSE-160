/*
 * Sherry Shi
 * CSE 160 - Assignment 0
 * asg0.js
 *
 * Implements vector drawing and vector operations on the canvas.
 */



// Get the canvas element
function main() {
  const canvas = document.getElementById('example');
  if (!canvas) {
    console.log('Could not find canvas.');
    return;
  }

// Get the 2D drawing context
  const ctx = canvas.getContext('2d');
  paintBackground(ctx, canvas);
}

// Fill the entire canvas
function paintBackground(ctx, canvas) {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Fill the entire canvas
function drawVector(vector, color) {
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');

  // Use the center of the canvas
  const originX = canvas.width / 2;
  const originY = canvas.height / 2;
  const scaleFactor = 20;

  const endX = originX + vector.elements[0] * scaleFactor;
  const endY = originY - vector.elements[1] * scaleFactor;
  // Draw the vector as a line from the center
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Read a numeric value from an input
function readNumber(id) {
  return parseFloat(document.getElementById(id).value);
}

// Create a 2D vector
function buildVector(x, y) {
  return new Vector3([x, y, 0]);
}

function readVectorsFromInputs() {
  const x1 = readNumber('v1x');
  const y1 = readNumber('v1y');
  const x2 = readNumber('v2x');
  const y2 = readNumber('v2y');

  if ([x1, y1, x2, y2].some(Number.isNaN)) {
    return null;
  }

  return {
    first: buildVector(x1, y1),
    second: buildVector(x2, y2)
  };
}

// Create a copy so the original vector
function cloneVector(v) {
  return new Vector3([v.elements[0], v.elements[1], v.elements[2]]);
}

// Clear the canvas
function resetCanvas() {
  const canvas = document.getElementById('example');
  const ctx = canvas.getContext('2d');
  paintBackground(ctx, canvas);
  return { canvas, ctx };
}

// Draw the original input vectors
function drawOriginalVectors(v1, v2) {
  drawVector(v1, 'red');
  drawVector(v2, 'blue');
}

function handleDrawEvent() {
  resetCanvas();
  // Read the two input vectors
  const pair = readVectorsFromInputs();
  if (!pair) {
    return;
  }

  drawOriginalVectors(pair.first, pair.second);
}

// Compute the magnitudes of the two vectors
function getAngleBetween(v1, v2) {
  const mag1 = v1.magnitude();
  const mag2 = v2.magnitude();

  if (mag1 === 0 || mag2 === 0) {
    return 0;
  }

  let value = Vector3.dot(v1, v2) / (mag1 * mag2);

  if (value > 1) value = 1;
  if (value < -1) value = -1;

  return Math.acos(value) * 180 / Math.PI;
}

// The triangle area
function getTriangleArea(v1, v2) {
  return Vector3.cross(v1, v2).magnitude() / 2;
}

function handleDrawOperationEvent() {
  resetCanvas();

  const pair = readVectorsFromInputs();
  if (!pair) {
    return;
  }

  const v1 = pair.first;
  const v2 = pair.second;

  drawOriginalVectors(v1, v2);

  const operation = document.getElementById('operation').value;
  const scalarValue = parseFloat(document.getElementById('scalar').value);

  switch (operation) {
    case 'add': {
      const result = cloneVector(v1).add(v2);
      drawVector(result, 'green');
      break;
    }

    case 'sub': {
      const result = cloneVector(v1).sub(v2);
      drawVector(result, 'green');
      break;
    }

    case 'mul': {
      if (Number.isNaN(scalarValue)) return;

      const scaled1 = cloneVector(v1).mul(scalarValue);
      const scaled2 = cloneVector(v2).mul(scalarValue);

      drawVector(scaled1, 'green');
      drawVector(scaled2, 'green');
      break;
    }

    case 'div': {
      if (Number.isNaN(scalarValue) || scalarValue === 0) return;

      const scaled1 = cloneVector(v1).div(scalarValue);
      const scaled2 = cloneVector(v2).div(scalarValue);

      drawVector(scaled1, 'green');
      drawVector(scaled2, 'green');
      break;
    }

    case 'magnitude': {
      console.log('Magnitude v1:', v1.magnitude());
      console.log('Magnitude v2:', v2.magnitude());
      break;
    }

    case 'normalize': {
      const unit1 = cloneVector(v1).normalize();
      const unit2 = cloneVector(v2).normalize();

      drawVector(unit1, 'green');
      drawVector(unit2, 'green');
      break;
    }

    case 'angle': {
      console.log('Angle:', getAngleBetween(v1, v2));
      break;
    }

    case 'area': {
      console.log('Area of the triangle:', getTriangleArea(v1, v2));
      break;
    }
  }
}