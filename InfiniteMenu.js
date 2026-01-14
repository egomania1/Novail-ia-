import { useEffect, useRef, useState } from './node_modules/gl-matrix/esm/index.js';

const discVertShaderSource = `#version 300 es

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);

    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    if (gl_VertexID > 0) {
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.15, uRotationAxisVelocity.w * 15.);
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    worldPosition.xyz = radius * normalize(worldPosition.xyz);

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = smoothstep(0.5, 1., normalize(worldPosition.xyz).z) * .9 + .1;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}
`;

const discFragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = vInstanceId % uItemCount;
    int cellsPerRow = uAtlasSize;
    int cellX = itemIndex % cellsPerRow;
    int cellY = itemIndex / cellsPerRow;
    vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;

    ivec2 texSize = textureSize(uTex, 0);
    float imageAspect = float(texSize.x) / float(texSize.y);
    float containerAspect = 1.0;
    
    float scale = max(imageAspect / containerAspect, 
                     containerAspect / imageAspect);
    
    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
    st = (st - 0.5) * scale + 0.5;
    
    st = clamp(st, 0.0, 1.0);
    
    st = st * cellSize + cellOffset;
    
    outColor = texture(uTex, st);
    outColor.a *= vAlpha;
}
`;

class Face {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class Vertex {
  constructor(x, y, z) {
    this.position = [x, y, z];
    this.normal = [0, 0, 0];
    this.uv = [0, 0];
  }
}

class Geometry {
  constructor() {
    this.vertices = [];
    this.faces = [];
  }

  addVertex(...args) {
    for (let i = 0; i < args.length; i += 3) {
      this.vertices.push(new Vertex(args[i], args[i + 1], args[i + 2]));
    }
    return this;
  }

  addFace(...args) {
    for (let i = 0; i < args.length; i += 3) {
      this.faces.push(new Face(args[i], args[i + 1], args[i + 2]));
    }
    return this;
  }

  get lastVertex() {
    return this.vertices[this.vertices.length - 1];
  }

  subdivide(divisions = 1) {
    const midPointCache = {};
    let f = this.faces;

    for (let div = 0; div < divisions; ++div) {
      const newFaces = new Array(f.length * 4);

      f.forEach((face, ndx) => {
        const mAB = this.getMidPoint(face.a, face.b, midPointCache);
        const mBC = this.getMidPoint(face.b, face.c, midPointCache);
        const mCA = this.getMidPoint(face.c, face.a, midPointCache);

        const i = ndx * 4;
        newFaces[i + 0] = new Face(face.a, mAB, mCA);
        newFaces[i + 1] = new Face(face.b, mBC, mAB);
        newFaces[i + 2] = new Face(face.c, mCA, mBC);
        newFaces[i + 3] = new Face(mAB, mBC, mCA);
      });

      f = newFaces;
    }

    this.faces = f;
    return this;
  }

  spherize(radius = 1) {
    this.vertices.forEach(vertex => {
      const length = Math.sqrt(
        vertex.position[0] * vertex.position[0] +
        vertex.position[1] * vertex.position[1] +
        vertex.position[2] * vertex.position[2]
      );
      
      if (length > 0) {
        vertex.normal[0] = vertex.position[0] / length;
        vertex.normal[1] = vertex.position[1] / length;
        vertex.normal[2] = vertex.position[2] / length;
        
        vertex.position[0] = vertex.normal[0] * radius;
        vertex.position[1] = vertex.normal[1] * radius;
        vertex.position[2] = vertex.normal[2] * radius;
      }
    });
    return this;
  }

  get data() {
    return {
      vertices: this.vertexData,
      indices: this.indexData,
      normals: this.normalData,
      uvs: this.uvData
    };
  }

  get vertexData() {
    const data = [];
    this.vertices.forEach(v => {
      data.push(...v.position);
    });
    return new Float32Array(data);
  }

  get normalData() {
    const data = [];
    this.vertices.forEach(v => {
      data.push(...v.normal);
    });
    return new Float32Array(data);
  }

  get uvData() {
    const data = [];
    this.vertices.forEach(v => {
      data.push(...v.uv);
    });
    return new Float32Array(data);
  }

  get indexData() {
    const data = [];
    this.faces.forEach(f => {
      data.push(f.a, f.b, f.c);
    });
    return new Uint16Array(data);
  }

  getMidPoint(ndxA, ndxB, cache) {
    const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;
    if (cache.hasOwnProperty(cacheKey)) {
      return cache[cacheKey];
    }
    const a = this.vertices[ndxA].position;
    const b = this.vertices[ndxB].position;
    const ndx = this.vertices.length;
    cache[cacheKey] = ndx;
    this.addVertex(
      (a[0] + b[0]) * 0.5,
      (a[1] + b[1]) * 0.5,
      (a[2] + b[2]) * 0.5
    );
    return ndx;
  }
}

class IcosahedronGeometry extends Geometry {
  constructor() {
    super();
    const t = Math.sqrt(5) * 0.5 + 0.5;
    this.addVertex(
      -1, t, 0,
      1, t, 0,
      -1, -t, 0,
      1, -t, 0,
      0, -1, t,
      0, 1, t,
      0, -1, -t,
      0, 1, -t,
      t, 0, -1,
      t, 0, 1,
      -t, 0, -1,
      -t, 0, 1
    ).addFace(
      0, 11, 5,
      0, 5, 1,
      0, 1, 7,
      0, 7, 10,
      0, 10, 11,
      1, 5, 9,
      5, 11, 4,
      11, 10, 2,
      10, 7, 6,
      7, 1, 8,
      3, 9, 4,
      3, 4, 2,
      3, 2, 6,
      3, 6, 8,
      3, 8, 9,
      4, 9, 5,
      2, 4, 11,
      6, 2, 10,
      8, 6, 7,
      9, 8, 1
    );
  }
}

class DiscGeometry extends Geometry {
  constructor(steps = 4, radius = 1) {
    super();
    steps = Math.max(4, steps);

    const alpha = (2 * Math.PI) / steps;

    this.addVertex(0, 0, 0);
    this.lastVertex.uv[0] = 0.5;
    this.lastVertex.uv[1] = 0.5;

    for (let i = 0; i < steps; ++i) {
      const x = Math.cos(alpha * i);
      const y = Math.sin(alpha * i);
      this.addVertex(radius * x, radius * y, 0);
      this.lastVertex.uv[0] = x * 0.5 + 0.5;
      this.lastVertex.uv[1] = y * 0.5 + 0.5;

      if (i > 0) {
        this.addFace(0, i, i + 1);
      }
    }
    this.addFace(0, steps, 1);
  }
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (success) {
    return shader;
  }

  console.error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl, shaderSources, transformFeedbackVaryings, attribLocations) {
  const program = gl.createProgram();

  [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
    const shader = createShader(gl, type, shaderSources[ndx]);
    if (shader) gl.attachShader(program, shader);
  });

  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.SEPARATE_ATTRIBS);
  }

  if (attribLocations) {
    for (const attrib in attribLocations) {
      gl.bindAttribLocation(program, attribLocations[attrib], attrib);
    }
  }

  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (success) {
    return program;
  }

  console.error(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

function makeVertexArray(gl, bufLocNumElmPairs, indices) {
  const va = gl.createVertexArray();
  gl.bindVertexArray(va);

  for (const [buffer, loc, numElem] of bufLocNumElmPairs) {
    if (loc === -1) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, numElem, gl.FLOAT, false, 0, 0);
  }

  if (indices) {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  gl.bindVertexArray(null);
  return va;
}

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio);
  const displayWidth = Math.round(canvas.clientWidth * dpr);
  const displayHeight = Math.round(canvas.clientHeight * dpr);
  const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  return needResize;
}

function makeBuffer(gl, sizeOrData, usage) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buf;
}

function createAndSetupTexture(gl, minFilter, magFilter, wrapS, wrapT) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  return texture;
}

class ArcballControl {
  isPointerDown = false;
  orientation = [0, 0, 0, 1];
  pointerRotation = [0, 0, 0, 1];
  rotationVelocity = 0;
  rotationAxis = [1, 0, 0];
  snapDirection = [0, 0, -1];
  snapTargetDirection;
  EPSILON = 0.1;
  IDENTITY_QUAT = [0, 0, 0, 1];

  constructor(canvas, updateCallback) {
    this.canvas = canvas;
    this.updateCallback = updateCallback || (() => null);

    this.pointerPos = [0, 0];
    this.previousPointerPos = [0, 0];
    this._rotationVelocity = 0;
    this._combinedQuat = [0, 0, 0, 1];

    canvas.addEventListener('pointerdown', e => {
      this.pointerPos[0] = e.clientX;
      this.pointerPos[1] = e.clientY;
      this.previousPointerPos[0] = e.clientX;
      this.previousPointerPos[1] = e.clientY;
      this.isPointerDown = true;
    });
    canvas.addEventListener('pointerup', () => {
      this.isPointerDown = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.isPointerDown = false;
    });
    canvas.addEventListener('pointermove', e => {
      if (this.isPointerDown) {
        this.pointerPos[0] = e.clientX;
        this.pointerPos[1] = e.clientY;
      }
    });

    canvas.style.touchAction = 'none';
  }

  update(deltaTime, targetFrameDuration = 16) {
    const timeScale = deltaTime / targetFrameDuration + 0.00001;
    let angleFactor = timeScale;
    let snapRotation = [0, 0, 0, 1];

    if (this.isPointerDown) {
      const INTENSITY = 0.3 * timeScale;
      const ANGLE_AMPLIFICATION = 5 / timeScale;

      const midPointerPos = [
        this.pointerPos[0] - this.previousPointerPos[0],
        this.pointerPos[1] - this.previousPointerPos[1]
      ];
      
      midPointerPos[0] *= INTENSITY;
      midPointerPos[1] *= INTENSITY;

      if (midPointerPos[0] * midPointerPos[0] + midPointerPos[1] * midPointerPos[1] > this.EPSILON) {
        const tempX = this.previousPointerPos[0] + midPointerPos[0];
        const tempY = this.previousPointerPos[1] + midPointerPos[1];
        
        const p = this.#project([tempX, tempY]);
        const q = this.#project(this.previousPointerPos);
        
        const pLength = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        const qLength = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]);
        
        const a = [
          p[0] / pLength,
          p[1] / pLength,
          p[2] / pLength
        ];
        
        const b = [
          q[0] / qLength,
          q[1] / qLength,
          q[2] / qLength
        ];

        this.previousPointerPos[0] = tempX;
        this.previousPointerPos[1] = tempY;

        angleFactor *= ANGLE_AMPLIFICATION;

        this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
      } else {
        this.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
      }
    } else {
      const INTENSITY = 0.1 * timeScale;
      this.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);

      if (this.snapTargetDirection) {
        const SNAPPING_INTENSITY = 0.2;
        const a = this.snapTargetDirection;
        const b = this.snapDirection;
        
        const diff = [
          a[0] - b[0],
          a[1] - b[1],
          a[2] - b[2]
        ];
        
        const sqrDist = diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2];
        const distanceFactor = Math.max(0.1, 1 - sqrDist * 10);
        angleFactor *= SNAPPING_INTENSITY * distanceFactor;
        this.quatFromVectors(a, b, snapRotation, angleFactor);
      }
    }

    const combinedQuat = this.multiply(snapRotation, this.pointerRotation);
    this.orientation = this.multiply(combinedQuat, this.orientation);
    
    const length = Math.sqrt(
      this.orientation[0] * this.orientation[0] +
      this.orientation[1] * this.orientation[1] +
      this.orientation[2] * this.orientation[2] +
      this.orientation[3] * this.orientation[3]
    );
    
    if (length > 0) {
      this.orientation[0] /= length;
      this.orientation[1] /= length;
      this.orientation[2] /= length;
      this.orientation[3] /= length;
    }

    this.slerpQuat(this._combinedQuat, this._combinedQuat, combinedQuat, 0.8 * timeScale);
    
    const len = Math.sqrt(
      this._combinedQuat[0] * this._combinedQuat[0] +
      this._combinedQuat[1] * this._combinedQuat[1] +
      this._combinedQuat[2] * this._combinedQuat[2] +
      this._combinedQuat[3] * this._combinedQuat[3]
    );
    
    if (len > 0) {
      this._combinedQuat[0] /= len;
      this._combinedQuat[1] /= len;
      this._combinedQuat[2] /= len;
      this._combinedQuat[3] /= len;
    }

    const rad = Math.acos(this._combinedQuat[3]) * 2.0;
    const s = Math.sin(rad / 2.0);
    let rv = 0;
    if (s > 0.000001) {
      rv = rad / (2 * Math.PI);
      this.rotationAxis[0] = this._combinedQuat[0] / s;
      this.rotationAxis[1] = this._combinedQuat[1] / s;
      this.rotationAxis[2] = this._combinedQuat[2] / s;
    }

    const RV_INTENSITY = 0.5 * timeScale;
    this._rotationVelocity += (rv - this._rotationVelocity) * RV_INTENSITY;
    this.rotationVelocity = this._rotationVelocity / timeScale;

    if (this.updateCallback) this.updateCallback(deltaTime);
  }

  multiply(q1, q2) {
    return [
      q1[0] * q2[3] + q1[3] * q2[0] + q1[1] * q2[2] - q1[2] * q2[1],
      q1[1] * q2[3] + q1[3] * q2[1] + q1[2] * q2[0] - q1[0] * q2[2],
      q1[2] * q2[3] + q1[3] * q2[2] + q1[0] * q2[1] - q1[1] * q2[0],
      q1[3] * q2[3] - q1[0] * q2[0] - q1[1] * q2[1] - q1[2] * q2[2]
    ];
  }

  slerp(out, a, b, t) {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const absDot = Math.abs(dot);
    
    if (absDot >= 1.0) {
      out[0] = a[0];
      out[1] = a[1];
      out[2] = a[2];
      out[3] = a[3];
      return out;
    }
    
    const theta = Math.acos(absDot);
    const sinTheta = Math.sin(theta);
    
    if (sinTheta < 0.001) {
      out[0] = a[0] + t * (b[0] - a[0]);
      out[1] = a[1] + t * (b[1] - a[1]);
      out[2] = a[2] + t * (b[2] - a[2]);
      out[3] = a[3] + t * (b[3] - a[3]);
      return out;
    }
    
    const scale0 = Math.sin((1 - t) * theta) / sinTheta;
    const scale1 = Math.sin(t * theta) / sinTheta;
    
    if (dot < 0) {
      out[0] = scale0 * a[0] - scale1 * b[0];
      out[1] = scale0 * a[1] - scale1 * b[1];
      out[2] = scale0 * a[2] - scale1 * b[2];
      out[3] = scale0 * a[3] - scale1 * b[3];
    } else {
      out[0] = scale0 * a[0] + scale1 * b[0];
      out[1] = scale0 * a[1] + scale1 * b[1];
      out[2] = scale0 * a[2] + scale1 * b[2];
      out[3] = scale0 * a[3] + scale1 * b[3];
    }
    
    return out;
  }

  slerpQuat(out, a, b, t) {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const flip = dot < 0;
    
    const bx = flip ? -b[0] : b[0];
    const by = flip ? -b[1] : b[1];
    const bz = flip ? -b[2] : b[2];
    const bw = flip ? -b[3] : b[3];
    
    const dot2 = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    
    if (Math.abs(dot2) >= 1.0) {
      out[0] = a[0];
      out[1] = a[1];
      out[2] = a[2];
      out[3] = a[3];
      return out;
    }
    
    const theta = Math.acos(dot2);
    const sinTheta = Math.sin(theta);
    
    if (sinTheta < 0.001) {
      out[0] = a[0] + t * (bx - a[0]);
      out[1] = a[1] + t * (by - a[1]);
      out[2] = a[2] + t * (bz - a[2]);
      out[3] = a[3] + t * (bw - a[3]);
      return out;
    }
    
    const scale0 = Math.sin((1 - t) * theta) / sinTheta;
    const scale1 = Math.sin(t * theta) / sinTheta;
    
    out[0] = scale0 * a[0] + scale1 * bx;
    out[1] = scale0 * a[1] + scale1 * by;
    out[2] = scale0 * a[2] + scale1 * bz;
    out[3] = scale0 * a[3] + scale1 * bw;
    
    return out;
  }

  quatFromVectors(a, b, out, angleFactor = 1) {
    const cross = [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
    
    const crossLength = Math.sqrt(
      cross[0] * cross[0] +
      cross[1] * cross[1] +
      cross[2] * cross[2]
    );
    
    if (crossLength > 0) {
      const normalizedCross = [
        cross[0] / crossLength,
        cross[1] / crossLength,
        cross[2] / crossLength
      ];
      
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const clampedDot = Math.max(-1, Math.min(1, dot));
      const angle = Math.acos(clampedDot) * angleFactor;
      
      const halfAngle = angle * 0.5;
      const sinHalfAngle = Math.sin(halfAngle);
      
      out[0] = normalizedCross[0] * sinHalfAngle;
      out[1] = normalizedCross[1] * sinHalfAngle;
      out[2] = normalizedCross[2] * sinHalfAngle;
      out[3] = Math.cos(halfAngle);
    } else {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
    }
    
    return { q: out, axis: cross, angle };
  }

  #project(pos) {
    const r = 2;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = Math.max(w, h) - 1;

    const x = (2 * pos[0] - w - 1) / s;
    const y = (2 * pos[1] - h - 1) / s;
    let z = 0;
    const xySq = x * x + y * y;
    const rSq = r * r;

    if (xySq <= rSq / 2.0) {
      z = Math.sqrt(rSq - xySq);
    } else {
      z = rSq / Math.sqrt(xySq);
    }
    return [-x, y, z];
  }
}

class InfiniteGridMenu {
  TARGET_FRAME_DURATION = 1000 / 60;
  SPHERE_RADIUS = 2;

  #time = 0;
  #deltaTime = 0;
  #deltaFrames = 0;
  #frames = 0;

  camera = {
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    near: 0.1,
    far: 40,
    fov: Math.PI / 4,
    aspect: 1,
    position: [0, 0, 3],
    up: [0, 1, 0],
    matrices: {
      view: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      inversProjection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    }
  };

  nearestVertexIndex = null;
  smoothRotationVelocity = 0;
  scaleFactor = 1.0;
  movementActive = false;

  constructor(canvas, items, onActiveItemChange, onMovementChange, onInit = null) {
    this.canvas = canvas;
    this.items = items || [];
    this.onActiveItemChange = onActiveItemChange || (() => {});
    this.onMovementChange = onMovementChange || (() => {});
    this.#init(onInit);
  }

  resize() {
    this.viewportSize = [this.canvas.clientWidth, this.canvas.clientHeight];

    const gl = this.gl;
    const needsResize = resizeCanvasToDisplaySize(gl.canvas);
    if (needsResize) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    this.#updateProjectionMatrix(gl);
  }

  run(time = 0) {
    this.#deltaTime = Math.min(32, time - this.#time);
    this.#time = time;
    this.#deltaFrames = this.#deltaTime / this.TARGET_FRAME_DURATION;
    this.#frames += this.#deltaFrames;

    this.#animate(this.#deltaTime);
    this.#render();

    requestAnimationFrame(t => this.run(t));
  }

  #init(onInit) {
    this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false });
    const gl = this.gl;
    if (!gl) {
      throw new Error('No WebGL 2 context!');
    }

    this.viewportSize = [this.canvas.clientWidth, this.canvas.clientHeight];
    this.drawBufferSize = [...this.viewportSize];

    this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], null, {
      aModelPosition: 0,
      aModelNormal: 1,
      aModelUvs: 2,
      aInstanceMatrix: 3
    });

    this.discLocations = {
      aModelPosition: gl.getAttribLocation(this.discProgram, 'aModelPosition'),
      aModelUvs: gl.getAttribLocation(this.discProgram, 'aModelUvs'),
      aInstanceMatrix: gl.getAttribLocation(this.discProgram, 'aInstanceMatrix'),
      uWorldMatrix: gl.getUniformLocation(this.discProgram, 'uWorldMatrix'),
      uViewMatrix: gl.getUniformLocation(this.discProgram, 'uViewMatrix'),
      uProjectionMatrix: gl.getUniformLocation(this.discProgram, 'uProjectionMatrix'),
      uCameraPosition: gl.getUniformLocation(this.discProgram, 'uCameraPosition'),
      uScaleFactor: gl.getUniformLocation(this.discProgram, 'uScaleFactor'),
      uRotationAxisVelocity: gl.getUniformLocation(this.discProgram, 'uRotationAxisVelocity'),
      uTex: gl.getUniformLocation(this.discProgram, 'uTex'),
      uFrames: gl.getUniformLocation(this.discProgram, 'uFrames'),
      uItemCount: gl.getUniformLocation(this.discProgram, 'uItemCount'),
      uAtlasSize: gl.getUniformLocation(this.discProgram, 'uAtlasSize')
    };

    this.discGeo = new DiscGeometry(56, 1);
    this.discBuffers = this.discGeo.data;
    this.discVAO = makeVertexArray(
      gl,
      [
        [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
        [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2]
      ],
      this.discBuffers.indices
    );

    this.icoGeo = new IcosahedronGeometry();
    this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
    this.instancePositions = this.icoGeo.vertices.map(v => v.position);
    this.DISC_INSTANCE_COUNT = this.icoGeo.vertices.length;
    this.#initDiscInstances(this.DISC_INSTANCE_COUNT);

    this.worldMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.#initTexture();

    this.control = new ArcballControl(this.canvas, deltaTime => this.#onControlUpdate(deltaTime));

    this.#updateCameraMatrix();
    this.#updateProjectionMatrix(gl);
    this.resize();

    if (onInit) onInit(this);
  }

  #initTexture() {
    const gl = this.gl;
    this.tex = createAndSetupTexture(gl, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);

    const itemCount = Math.max(1, this.items.length);
    this.atlasSize = Math.ceil(Math.sqrt(itemCount));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cellSize = 512;

    canvas.width = this.atlasSize * cellSize;
    canvas.height = this.atlasSize * cellSize;

    const loadImage = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    Promise.all(this.items.map(item => loadImage(item.image)))
      .then(images => {
        images.forEach((img, i) => {
          const x = (i % this.atlasSize) * cellSize;
          const y = Math.floor(i / this.atlasSize) * cellSize;
          ctx.drawImage(img, x, y, cellSize, cellSize);
        });

        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
      })
      .catch(err => {
        console.error('Error loading images:', err);
      });
  }

  #initDiscInstances(count) {
    const gl = this.gl;
    this.discInstances = {
      matricesArray: new Float32Array(count * 16),
      matrices: [],
      buffer: gl.createBuffer()
    };
    
    for (let i = 0; i < count; ++i) {
      const instanceMatrixArray = new Float32Array(this.discInstances.matricesArray.buffer, i * 16 * 4, 16);
      const identityMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];
      instanceMatrixArray.set(identityMatrix);
      this.discInstances.matrices.push(instanceMatrixArray);
    }
    
    gl.bindVertexArray(this.discVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
    const mat4AttribSlotCount = 4;
    const bytesPerMatrix = 16 * 4;
    for (let j = 0; j < mat4AttribSlotCount; ++j) {
      const loc = this.discLocations.aInstanceMatrix + j;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, j * 4 * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  #animate(deltaTime) {
    const gl = this.gl;
    this.control.update(deltaTime, this.TARGET_FRAME_DURATION);

    const positions = this.instancePositions.map(p => {
      const x = p[0];
      const y = p[1];
      const z = p[2];
      
      const qx = this.control.orientation[0];
      const qy = this.control.orientation[1];
      const qz = this.control.orientation[2];
      const qw = this.control.orientation[3];
      
      // Rotate vector by quaternion
      const ix = qw * x + qy * z - qz * y;
      const iy = qw * y + qz * x - qx * z;
      const iz = qw * z + qx * y - qy * x;
      const iw = -qx * x - qy * y - qz * z;
      
      return [
        ix * qw - iw * qx - iy * qz + iz * qy,
        iy * qw - iw * qy - iz * qx + ix * qz,
        iz * qw - iw * qz - ix * qy + iy * qx
      ];
    });
    
    const scale = 0.25;
    const SCALE_INTENSITY = 0.6;
    
    positions.forEach((p, ndx) => {
      const length = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      const s = (Math.abs(p[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY);
      const finalScale = s * scale;
      
      const translationMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        -p[0], -p[1], -p[2], 1
      ];
      
      const targetMatrix = this.targetTo([0, 0, 0], p, [0, 1, 0]);
      
      const scaleMatrix = [
        finalScale, 0, 0, 0,
        0, finalScale, 0, 0,
        0, 0, finalScale, 0,
        0, 0, 0, 1
      ];
      
      const translateMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, -this.SPHERE_RADIUS, 1
      ];
      
      const matrix = this.multiplyMatrices(
        this.multiplyMatrices(
          this.multiplyMatrices(translationMatrix, targetMatrix),
          scaleMatrix
        ),
        translateMatrix
      );
      
      this.discInstances.matrices[ndx].set(matrix);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.smoothRotationVelocity = this.control.rotationVelocity;
  }

  multiplyMatrices(a, b) {
    const result = new Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return result;
  }

  targetTo(eye, target, up) {
    const mz = [
      eye[0] - target[0],
      eye[1] - target[1],
      eye[2] - target[2]
    ];
    
    const mzLength = Math.sqrt(mz[0] * mz[0] + mz[1] * mz[1] + mz[2] * mz[2]);
    if (mzLength > 0) {
      mz[0] /= mzLength;
      mz[1] /= mzLength;
      mz[2] /= mzLength;
    }
    
    const mx = [
      up[1] * mz[2] - up[2] * mz[1],
      up[2] * mz[0] - up[0] * mz[2],
      up[0] * mz[1] - up[1] * mz[0]
    ];
    
    const mxLength = Math.sqrt(mx[0] * mx[0] + mx[1] * mx[1] + mx[2] * mx[2]);
    if (mxLength > 0) {
      mx[0] /= mxLength;
      mx[1] /= mxLength;
      mx[2] /= mxLength;
    }
    
    const my = [
      mz[1] * mx[2] - mz[2] * mx[1],
      mz[2] * mx[0] - mz[0] * mx[2],
      mz[0] * mx[1] - mz[1] * mx[0]
    ];
    
    return [
      mx[0], my[0], mz[0], 0,
      mx[1], my[1], mz[1], 0,
      mx[2], my[2], mz[2], 0,
      0, 0, 0, 1
    ];
  }

  #render() {
    const gl = this.gl;
    gl.useProgram(this.discProgram);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
    gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
    gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
    gl.uniform3f(
      this.discLocations.uCameraPosition,
      this.camera.position[0],
      this.camera.position[1],
      this.camera.position[2]
    );
    gl.uniform4f(
      this.discLocations.uRotationAxisVelocity,
      this.control.rotationAxis[0],
      this.control.rotationAxis[1],
      this.control.rotationAxis[2],
      this.smoothRotationVelocity * 1.1
    );

    gl.uniform1i(this.discLocations.uItemCount, this.items.length);
    gl.uniform1i(this.discLocations.uAtlasSize, this.atlasSize);

    gl.uniform1f(this.discLocations.uFrames, this.#frames);
    gl.uniform1f(this.discLocations.uScaleFactor, this.scaleFactor);
    gl.uniform1i(this.discLocations.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    gl.bindVertexArray(this.discVAO);
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      this.discBuffers.indices.length,
      gl.UNSIGNED_SHORT,
      0,
      this.DISC_INSTANCE_COUNT
    );
  }

  #updateCameraMatrix() {
    const targetMatrix = this.targetTo(this.camera.position, [0, 0, 0], this.camera.up);
    this.camera.matrix = targetMatrix;
    this.camera.matrices.view = this.invertMatrix(targetMatrix);
  }

  invertMatrix(matrix) {
    const a00 = matrix[0], a01 = matrix[1], a02 = matrix[2], a03 = matrix[3];
    const a10 = matrix[4], a11 = matrix[5], a12 = matrix[6], a13 = matrix[7];
    const a20 = matrix[8], a21 = matrix[9], a22 = matrix[10], a23 = matrix[11];
    const a30 = matrix[12], a31 = matrix[13], a32 = matrix[14], a33 = matrix[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;

    det = 1.0 / det;

    return [
      (a11 * b11 - a12 * b10 + a13 * b09) * det,
      (a02 * b10 - a01 * b11 - a03 * b09) * det,
      (a31 * b05 - a32 * b04 + a33 * b03) * det,
      (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det,
      (a00 * b11 - a02 * b08 + a03 * b07) * det,
      (a32 * b02 - a30 * b05 - a33 * b01) * det,
      (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det,
      (a01 * b08 - a00 * b10 - a03 * b06) * det,
      (a30 * b04 - a31 * b02 + a33 * b00) * det,
      (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det,
      (a00 * b09 - a01 * b07 + a02 * b06) * det,
      (a31 * b01 - a30 * b03 - a32 * b00) * det,
      (a20 * b03 - a21 * b01 + a22 * b00) * det
    ];
  }

  #updateProjectionMatrix(gl) {
    this.camera.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const height = this.SPHERE_RADIUS * 0.35;
    const distance = this.camera.position[2];
    if (this.camera.aspect > 1) {
      this.camera.fov = 2 * Math.atan(height / distance);
    } else {
      this.camera.fov = 2 * Math.atan(height / this.camera.aspect / distance);
    }
    
    const f = 1.0 / Math.tan(this.camera.fov / 2);
    const nf = 1 / (this.camera.near - this.camera.far);
    
    this.camera.matrices.projection = [
      f / this.camera.aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (this.camera.far + this.camera.near) * nf, -1,
      0, 0, (2 * this.camera.far * this.camera.near) * nf, 0
    ];
    
    this.camera.matrices.inversProjection = this.invertMatrix(this.camera.matrices.projection);
  }

  #onControlUpdate(deltaTime) {
    const timeScale = deltaTime / this.TARGET_FRAME_DURATION + 0.0001;
    let damping = 5 / timeScale;
    let cameraTargetZ = 3;

    const isMoving = this.control.isPointerDown || Math.abs(this.smoothRotationVelocity) > 0.01;

    if (isMoving !== this.movementActive) {
      this.movementActive = isMoving;
      this.onMovementChange(isMoving);
    }

    if (!this.control.isPointerDown) {
      const nearestVertexIndex = this.#findNearestVertexIndex();
      const itemIndex = nearestVertexIndex % Math.max(1, this.items.length);
      this.onActiveItemChange(itemIndex);
      const snapDirection = this.normalizeVector(this.#getVertexWorldPosition(nearestVertexIndex));
      this.control.snapTargetDirection = snapDirection;
    } else {
      cameraTargetZ += this.control.rotationVelocity * 80 + 2.5;
      damping = 7 / timeScale;
    }

    this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / damping;
    this.#updateCameraMatrix();
  }

  normalizeVector(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length > 0) {
      return [v[0] / length, v[1] / length, v[2] / length];
    }
    return [0, 0, 0];
  }

  #findNearestVertexIndex() {
    const n = this.control.snapDirection;
    
    // Inverse de l'orientation
    const qx = -this.control.orientation[0];
    const qy = -this.control.orientation[1];
    const qz = -this.control.orientation[2];
    const qw = this.control.orientation[3];
    
    const nt = [
      qw * n[0] + qy * n[2] - qz * n[1],
      qw * n[1] + qz * n[0] - qx * n[2],
      qw * n[2] + qx * n[1] - qy * n[0]
    ];
    
    let maxD = -1;
    let nearestVertexIndex;
    for (let i = 0; i < this.instancePositions.length; ++i) {
      const pos = this.instancePositions[i];
      const d = nt[0] * pos[0] + nt[1] * pos[1] + nt[2] * pos[2];
      if (d > maxD) {
        maxD = d;
        nearestVertexIndex = i;
      }
    }
    return nearestVertexIndex;
  }

  #getVertexWorldPosition(index) {
    const nearestVertexPos = this.instancePositions[index];
    
    const qx = this.control.orientation[0];
    const qy = this.control.orientation[1];
    const qz = this.control.orientation[2];
    const qw = this.control.orientation[3];
    
    // Rotate vector by quaternion
    const ix = qw * nearestVertexPos[0] + qy * nearestVertexPos[2] - qz * nearestVertexPos[1];
    const iy = qw * nearestVertexPos[1] + qz * nearestVertexPos[0] - qx * nearestVertexPos[2];
    const iz = qw * nearestVertexPos[2] + qx * nearestVertexPos[1] - qy * nearestVertexPos[0];
    const iw = -qx * nearestVertexPos[0] - qy * nearestVertexPos[1] - qz * nearestVertexPos[2];
    
    return [
      ix * qw - iw * qx - iy * qz + iz * qy,
      iy * qw - iw * qy - iz * qx + ix * qz,
      iz * qw - iw * qz - ix * qy + iy * qx
    ];
  }
}

const defaultItems = [
  {
    image: 'https://picsum.photos/900/900?grayscale',
    link: 'https://google.com/',
    title: '',
    description: ''
  }
];

export default function InfiniteMenu({ items = [] }) {
  const canvasRef = useRef(null);
  const [activeItem, setActiveItem] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    let sketch;

    const handleActiveItem = index => {
      const itemIndex = index % items.length;
      setActiveItem(items[itemIndex]);
    };

    if (canvas) {
      sketch = new InfiniteGridMenu(canvas, items.length ? items : defaultItems, handleActiveItem, setIsMoving, sk =>
        sk.run()
      );
    }

    const handleResize = () => {
      if (sketch) {
        sketch.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [items]);

  const handleButtonClick = () => {
    if (!activeItem?.link) return;
    if (activeItem.link.startsWith('http')) {
      window.open(activeItem.link, '_blank');
    } else {
      console.log('Internal route:', activeItem.link);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas id="infinite-grid-menu-canvas" ref={canvasRef} />

      {activeItem && (
        <>
          <h2 className={`face-title ${isMoving ? 'inactive' : 'active'}`}>{activeItem.title}</h2>

          <p className={`face-description ${isMoving ? 'inactive' : 'active'}`}> {activeItem.description}</p>

          <div onClick={handleButtonClick} className={`action-button ${isMoving ? 'inactive' : 'active'}`}>
            <p className="action-button-icon">&#x2197;</p>
          </div>
        </>
      )}
    </div>
  );
}