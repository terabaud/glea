///<reference path="vendor/ella.d.ts"/>

import GLea from '../dist/glea.js';
import * as Ella from './vendor/ella.esm.js';

const { Vec } = Ella;

const glsl = (x) => x[0].trim();

const vert = `
precision highp float;
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0, 1.);
}
`;

const frag = glsl`
precision highp float;
uniform float time;
uniform vec2 resolution;

void main() {
  float vmin = min(resolution.y, resolution.x);
  vec2 p = (gl_FragCoord.xy - .5 * resolution) / vmin;
  float r = .5 + .5 * sin(5. * log(length(p)) - time * 1.2);
  float g = .5 + .5 * sin(5. * log(length(p)) + sin(time + 2. * p.x));  
  float b = .5 + .5 * sin(.2 + 5. * log(length(p)) + sin(time * .4 + 4. * p.y));
  gl_FragColor = vec4(.5 * vec3(r, g, b), 1.0);
}
`;

const vert2 = glsl`
precision highp float;
attribute vec3 position;
varying vec3 vPosition;
varying mat4 vM;
uniform vec2 resolution;
uniform float time;

#define PI 3.141592654

mat4 translate(vec3 p) {
  return mat4(
    vec4(1.0, 0.0, 0.0, 0.0),
    vec4(0.0, 1.0, 0.0, 0.0),
    vec4(0.0, 0.0, 1.0, 0.0),
    vec4(p.x, p.y, p.z, 1.0)
  );
}
mat4 rotX(float angle) {
  float S = sin(angle);
  float C = cos(angle);
  return mat4(
    vec4(1.0, 0, 0, 0),
    vec4(0  , C, S, 0),
    vec4(0  ,-S, C, 0),
    vec4(0  , 0, 0, 1.0)
  );
}
mat4 rotY(float angle) {
  float S = sin(angle);
  float C = cos(angle);
  return mat4(
    vec4(C, 0  ,-S, 0),
    vec4(0, 1.0, 0, 0),
    vec4(S, 0  , C, 0),
    vec4(0, 0  , 0, 1.0)
  );
}
mat4 rotZ(float angle) {
  float S = sin(angle);
  float C = cos(angle);
  return mat4(
    vec4( C, S, 0  , 0),
    vec4(-S, C, 0  , 0),
    vec4( 0, 0, 1.0, 0),
    vec4( 0, 0, 0  , 1.0)
  );
}
// glFrustum(left, right, bottom, top, zNear, zFar)
mat4 frustum(float left, float right, float bottom, float top, float zNear, float zFar) {
  float t1 = 2.0 * zNear;
  float t2 = right - left;
  float t3 = top - bottom;
  float t4 = zFar - zNear;
	return mat4(
    vec4(t1 / t2, 0, 0, 0),
	  vec4(0, t1 / t3, 0, 0),
	  vec4((right + left) / t2, (top + bottom) / t3, (-zFar - zNear) / t4, -1.0),
	  vec4(0, 0, (-t1*zFar) / t4, 0));
}
// gluPerspective(fieldOfView, aspectRatio, zNear, zFar)
mat4 perspective(float fieldOfView, float aspectRatio, float zNear, float zFar) {
  float y = zNear * tan(fieldOfView * PI / 360.0);
  float x = y * aspectRatio;
	return frustum(-x, x, -y, y, zNear, zFar);
}


void main() {
  vPosition = position;

  mat4 pM = perspective(45.0, resolution.x / resolution.y, 0.1, 1000.0);
  mat4 tM = translate(vec3(sin(2.0 * time * .1) * 0.2, sin(3.0 * time * .1) * .1, -1.6 + sin(time * .1)));
  mat4 M = pM * tM * rotX(time * 0.1) * rotY(time * 0.1) * rotZ(time * 0.25);
  vM = M;

  gl_Position = M * vec4(position, 1.);
}
`;

const frag2 = glsl`
precision highp float;
uniform float time;
#define PI 3.141592654

varying vec3 vPosition;
varying mat4 vM;

vec4 palette(float t) {
  float x = t / (2.0 * PI);
  return vec4(
    sin(x * .2), 
    sin(x * 2. + 1.), 
    .5 + .5 * sin(x * 6. + 2.), 1.);
}

void main() {
  vec4 v = vM * vec4(vPosition, 1.0);
  float t = .5 + .5 * cos(v.x * 110. + time * 10.) * sin(v.y * 55. + time * .1);
  gl_FragColor = palette(t+ time);
}
`;

class App {
  constructor() {
    this.projectionMat = Ella.Mat4.identity();
    this.viewMat = Ella.Mat4.identity();
    this.loop = this.loop.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  setProjectionMatrix() {
    const w = document.body.clientWidth;
    const h = document.body.clientHeight;
    this.projectionMat = Ella.perspective(60, w / h, 0.1, 300);
    this.viewMat = Ella.lookAt(
      new Vec(10, 0, 0),
      new Vec(0, 0, 0),
      new Vec(0, 1, 0)
    );
  }

  setup() {
    const sphere = Ella.Geometry.sphere(0.2, 16, 8);
    const sphereTriangles = sphere.toTriangles();
    window.addEventListener('resize', this.onResize, false);

    this.setProjectionMatrix();
    this.prg1 = new GLea({
      shaders: [GLea.vertexShader(vert), GLea.fragmentShader(frag)],
    }).create();

    const gl = this.prg1.gl;

    this.prg2 = this.prg1.add({
      shaders: [GLea.vertexShader(vert2), GLea.fragmentShader(frag2)],
      buffers: {
        position: GLea.buffer(3, sphereTriangles),
      },
    });
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
  }

  loop(time = 0) {
    const { gl, width, height } = this.prg1;
    const { prg1, prg2 } = this;

    prg1.clear();
    gl.disable(gl.DEPTH_TEST);
    prg1.enableAttribs();
    prg1.uniV('resolution', [width, height]);
    prg1.uni('time', time * 1e-3);

    prg1.drawArrays(gl.TRIANGLE_STRIP);
    prg1.disableAttribs();

    gl.enable(gl.DEPTH_TEST);
    prg2.enableAttribs();
    prg2.uniV('resolution', [width, height]);
    prg2.uni('time', time * 1e-3);
    prg2.drawArrays(gl.TRIANGLES);
    prg2.disableAttribs();

    requestAnimationFrame(this.loop);
  }

  onResize() {
    this.prg1.resize();
  }
}

const app = new App();

app.setup();
app.loop();
