"use strict";

var vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec2 a_texture_coords;

out vec2 f_texture_coords;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  f_texture_coords = a_texture_coords;
  gl_Position = a_position;
}
`;

var fragmentShaderSource = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec2 f_texture_coords;
uniform sampler2D f_texture;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  // Just set the output to a constant redish-purple
  outColor = texture(f_texture, f_texture_coords);
}
`;

function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));  // eslint-disable-line
  gl.deleteShader(shader);
  return undefined;
}

function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));  // eslint-disable-line
  gl.deleteProgram(program);
  return undefined;
}

function prepareDrawing(canvas_elem) {

  var canvas = canvas_elem;
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    console.error("Can't get webgl2 context");
    return;
  }

  var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  var program = createProgram(gl, vertexShader, fragmentShader);

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
    [
    -1., -1.,
    -1.,  1.,
     1.,  1.,

     1.,  1.,
     1., -1.,
    -1., -1.
    ]
  ), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);
  
  var textureCoordAttributeLocation = gl.getAttribLocation(program, "a_texture_coords");
  var textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
    [
    1.,  1.,
    1.,  0.,
    0.,  0.,

    0.,  0.,
    0.,  1.,
    1.,  1.
    ]
  ), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(textureCoordAttributeLocation);
  gl.vertexAttribPointer(
    textureCoordAttributeLocation, size, type, normalize, stride, offset);

  // Create a texture.
  let texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + 0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([0, 0, 255, 255]));  
  // Asynchronously load an image
  var image = new Image();
  image.src = canvas_elem.getAttribute("texture-path"); //"./grape1.png";
  image.addEventListener('load', function() {
    // Now that the image has loaded make copy it to the texture.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
  });

  return {gl: gl, program: program, vao: vao, count: 6};
}

function drawTriangles(gl, program, vao, count) {

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = count;
  gl.drawArrays(primitiveType, offset, count);
}

function processData(canvas_elem) {
  console.log('Processing data...');

  let fps = canvas_elem.parentElement.querySelector("#time");

  let drawInfo = prepareDrawing(canvas_elem);

  drawTriangles(drawInfo.gl, drawInfo.program, drawInfo.vao, drawInfo.count);
  
  let lastTime = performance.now();
  let deltaArr = [];
  const FPS_UPDATE_INTERVAL = 500;
  const FPS_WINDOW_SIZE = 10;

  function updateFPS(timestamp) {
    let delta = timestamp - lastTime;
    deltaArr.push(delta);
    while (deltaArr.length > FPS_WINDOW_SIZE) {
      deltaArr.shift();
    }
    let mean_delta = 0;
    deltaArr.forEach((elem) => mean_delta += elem);
    mean_delta /= deltaArr.length;
    lastTime = timestamp;
    return mean_delta;
  }

  let lastFPSUpdate = performance.now();

  requestAnimationFrame(function drawScene(timestamp) {
    let FPS = updateFPS(timestamp);

    if (timestamp - lastFPSUpdate > FPS_UPDATE_INTERVAL) {
      fps.textContent = FPS.toFixed(1); 
      lastFPSUpdate = timestamp;
    }

    const ITER_NUM = 50;
    for (let iter_id = 0; iter_id < ITER_NUM; iter_id++) {
      drawTriangles(drawInfo.gl, drawInfo.program, drawInfo.vao, drawInfo.count);
    }

    requestAnimationFrame(drawScene);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    let canvas_elem = document.querySelector("#c");
    processData(canvas_elem);
    console.log('File loaded and processed successfully');
  } catch (error) {
    console.error('Error loading or processing file:', error);
  }
});
