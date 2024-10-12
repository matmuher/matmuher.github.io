"use strict";

var vertexShaderSource = `#version 300 es

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
in vec4 a_position;
in vec4 a_color;
out vec4 f_color;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  f_color = a_color;
  gl_Position = a_position;
}
`;

var fragmentShaderSource = `#version 300 es

// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

in vec4 f_color;

// we need to declare an output for the fragment shader
out vec4 outColor;

void main() {
  // Just set the output to a constant redish-purple
  outColor = f_color;
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

function prepareDrawing(canvas_elem, positions, colors) {

  let positionSize = positions.length * 4;
  let colorSize = colors.length * 4;
  console.log(`KB used by triangled picture: ${(colorSize + positionSize) / 1024}`);

  // console.log(`pos: ${positions}`)
  // console.log(`colors: ${colors}`)

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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttributeLocation);
  var size = 2;          // 2 components per iteration
  var type = gl.FLOAT;   // the data is 32bit floats
  var normalize = false; // don't normalize the data
  var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0;        // start at the beginning of the buffer
  gl.vertexAttribPointer(
      positionAttributeLocation, size, type, normalize, stride, offset);
  
  var colorAttributeLocation = gl.getAttribLocation(program, "a_color");
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(colorAttributeLocation);
  gl.vertexAttribPointer(
    colorAttributeLocation, 4, type, normalize, stride, offset);

  return {gl: gl, program: program, vao: vao, count: positions.length / 2};
}

function drawTriangles(gl, program, vao, back_color, count, positions, colors) {

  webglUtils.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.clearColor(...back_color);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  var primitiveType = gl.TRIANGLES;
  var offset = 0;
  var count = count;
  gl.drawArrays(primitiveType, offset, count);
}

async function loadAndProcessFile(canvas_elem) {
  const url = canvas_elem.getAttribute("model-url");
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const jsonData = await response.json();
  processData(canvas_elem, jsonData);
}

function processDumpedShapes(data) {

  let back_color = [0, 0, 0, 0]
  let positions = []
  let colors = []
  let is_first = true;

  const width = 688; //data[0].data[2];
  const heigth = 458; //data[0].data[3];
  console.log(`Triangle image: ${width} x ${heigth}`);

  for (const trig_data of data) {

    if (is_first) {
      back_color = trig_data.color.map((elem) => elem / 255)
      console.log(back_color)
      is_first = false;
      continue;
    }

    for (let i = 0; i < trig_data.data.length; ++i) {
      
      let coord = trig_data.data[i]
      
      if (i % 2 == 0) {
        coord /= width;
      } else {
        coord /= heigth;
      }

      coord = -coord * 2 + 1;

      positions.push(coord);
    }

    for (let vertex_id = 0; vertex_id < 3; vertex_id++) {
      for (const comp of trig_data.color) {
        colors.push(comp / 255.)
      }
    }
  }

  return {positions: positions, colors: colors, back_color: back_color};
}

function processData(canvas_elem, data) {
  console.log('Processing data...');

  let fps = canvas_elem.parentElement.querySelector("#time");

  let bufferInfo = processDumpedShapes(data);
  let drawInfo = prepareDrawing(canvas_elem, bufferInfo.positions, bufferInfo.colors);

  drawTriangles(drawInfo.gl, drawInfo.program, drawInfo.vao, bufferInfo.back_color, drawInfo.count);
  
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

    const ITER_NUM = 80;
    for (let iter_id = 0; iter_id < ITER_NUM; iter_id++) {
      drawTriangles(drawInfo.gl, drawInfo.program, drawInfo.vao, bufferInfo.back_color, drawInfo.count);
    }

    requestAnimationFrame(drawScene);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    let canvas_elem = document.querySelector("#c");
    await loadAndProcessFile(canvas_elem);
    console.log('File loaded and processed successfully');
  } catch (error) {
    console.error('Error loading or processing file:', error);
  }
});
