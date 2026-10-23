import { cameraBasis, norm } from './math';
import { LIMITS, MAX_BOUNCES, type Scene } from './scene';

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;

#define MAX_SP ${LIMITS.sphere}
#define MAX_PL ${LIMITS.plane}
#define MAX_CY ${LIMITS.cylinder}
#define MAX_L ${LIMITS.light}
#define MAX_BOUNCES ${MAX_BOUNCES}
const float EPS = 1e-4;
const float FAR = 1e9;
const float PI = 3.14159265359;

uniform vec2 uRes;
uniform vec2 uJitter;
uniform float uAlpha;
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalf;
uniform vec3 uAmbient;
uniform float uSpec;
uniform float uShine;
uniform int uBounces;
uniform int uNSp;
uniform int uNPl;
uniform int uNCy;
uniform int uNL;
uniform int uSelType;
uniform int uSelIdx;
uniform vec4 uSp0[MAX_SP];
uniform vec4 uSp1[MAX_SP];
uniform vec4 uPl0[MAX_PL];
uniform vec4 uPl1[MAX_PL];
uniform vec4 uPl2[MAX_PL];
uniform vec4 uCy0[MAX_CY];
uniform vec4 uCy1[MAX_CY];
uniform vec4 uCy2[MAX_CY];
uniform vec4 uL0[MAX_L];
uniform vec4 uL1[MAX_L];

out vec4 outColor;

struct Hit {
  float t;
  vec3 n;
  int type; // 1 sphere, 2 plane, 3 cylinder
  int idx;
};

float iSphere(vec3 o, vec3 d, vec4 s) {
  vec3 oc = o - s.xyz;
  float b = dot(oc, d);
  float c = dot(oc, oc) - s.w * s.w;
  float disc = b * b - c;
  if (disc < 0.0) return FAR;
  float q = sqrt(disc);
  float t0 = -b - q;
  if (t0 > EPS) return t0;
  float t1 = -b + q;
  return t1 > EPS ? t1 : FAR;
}

float iPlane(vec3 o, vec3 d, vec3 p, vec3 n) {
  float den = dot(d, n);
  if (abs(den) < 1e-7) return FAR;
  float t = dot(p - o, n) / den;
  return t > EPS ? t : FAR;
}

float iCyl(vec3 o, vec3 d, vec3 c, vec3 a, float r, float h, out vec3 nrm) {
  float best = FAR;
  nrm = vec3(0.0);
  vec3 oc = o - c;
  float dA = dot(d, a);
  float ocA = dot(oc, a);
  vec3 dp = d - a * dA;
  vec3 op = oc - a * ocA;
  float qa = dot(dp, dp);
  if (qa > 1e-12) {
    float qb = 2.0 * dot(dp, op);
    float qc = dot(op, op) - r * r;
    float disc = qb * qb - 4.0 * qa * qc;
    if (disc >= 0.0) {
      float sq = sqrt(disc);
      float t0 = (-qb - sq) / (2.0 * qa);
      float t1 = (-qb + sq) / (2.0 * qa);
      if (t0 > EPS && abs(ocA + t0 * dA) <= h) {
        best = t0;
        nrm = normalize(oc + d * t0 - a * (ocA + t0 * dA));
      } else if (t1 > EPS && abs(ocA + t1 * dA) <= h) {
        best = t1;
        nrm = normalize(oc + d * t1 - a * (ocA + t1 * dA));
      }
    }
  }
  if (abs(dA) > 1e-7) {
    for (int k = 0; k < 2; k++) {
      float sg = k == 0 ? -1.0 : 1.0;
      float t = (sg * h - ocA) / dA;
      if (t > EPS && t < best) {
        vec3 q = oc + d * t - a * (sg * h);
        if (dot(q, q) <= r * r) {
          best = t;
          nrm = a * sg;
        }
      }
    }
  }
  return best;
}

bool trace(vec3 o, vec3 d, float tmax, bool anyHit, out Hit h) {
  h.t = tmax;
  h.type = 0;
  h.idx = 0;
  h.n = vec3(0.0);
  for (int i = 0; i < MAX_SP; i++) {
    if (i >= uNSp) break;
    float t = iSphere(o, d, uSp0[i]);
    if (t < h.t) {
      h.t = t; h.type = 1; h.idx = i;
      if (anyHit) return true;
    }
  }
  for (int i = 0; i < MAX_PL; i++) {
    if (i >= uNPl) break;
    float t = iPlane(o, d, uPl0[i].xyz, uPl1[i].xyz);
    if (t < h.t) {
      h.t = t; h.type = 2; h.idx = i;
      if (anyHit) return true;
    }
  }
  vec3 cn = vec3(0.0);
  for (int i = 0; i < MAX_CY; i++) {
    if (i >= uNCy) break;
    vec3 n;
    float t = iCyl(o, d, uCy0[i].xyz, uCy1[i].xyz, uCy0[i].w, uCy1[i].w, n);
    if (t < h.t) {
      h.t = t; h.type = 3; h.idx = i; cn = n;
      if (anyHit) return true;
    }
  }
  if (h.type == 0) return false;
  vec3 p = o + d * h.t;
  if (h.type == 1) h.n = normalize(p - uSp0[h.idx].xyz);
  else if (h.type == 2) h.n = normalize(uPl1[h.idx].xyz);
  else h.n = cn;
  return true;
}

float checkerAt(float u, float v) {
  return mod(floor(u) + floor(v), 2.0);
}

vec3 planeBasis(vec3 n, out vec3 t2) {
  vec3 helper = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(n, helper));
  t2 = cross(n, t1);
  return t1;
}

void main() {
  vec2 fc = gl_FragCoord.xy + 0.5 + uJitter;
  float ax = (2.0 * fc.x / uRes.x - 1.0) * uTanHalf;
  float ay = (2.0 * fc.y / uRes.y - 1.0) * uTanHalf * (uRes.y / uRes.x);
  vec3 d = normalize(uCamFwd + uCamRight * ax + uCamUp * ay);
  vec3 o = uCamPos;

  vec3 acc = vec3(0.0);
  vec3 thr = vec3(1.0);

  for (int b = 0; b < MAX_BOUNCES + 1; b++) {
    Hit h;
    if (!trace(o, d, FAR, false, h)) {
      // Primary rays see black, like miniRT. Mirrors get a faint sky so they never read as holes.
      if (b > 0) acc += thr * mix(vec3(0.03, 0.04, 0.09), vec3(0.32, 0.38, 0.55), clamp(d.y * 0.5 + 0.5, 0.0, 1.0));
      break;
    }
    vec3 p = o + d * h.t;
    vec3 n = h.n;
    if (dot(n, d) > 0.0) n = -n;

    vec3 base;
    float mat;
    float chk = 0.0;
    bool selected = b == 0 && h.type == uSelType && h.idx == uSelIdx;
    if (h.type == 1) {
      vec4 s0 = uSp0[h.idx]; vec4 s1 = uSp1[h.idx];
      base = s1.xyz; mat = s1.w;
      if (mat >= 5.0) {
        vec3 l = (p - s0.xyz) / s0.w;
        chk = checkerAt(atan(l.z, l.x) / (2.0 * PI) * 16.0 + 16.0, acos(clamp(l.y, -1.0, 1.0)) / PI * 8.0);
      }
    } else if (h.type == 2) {
      base = uPl2[h.idx].xyz; mat = uPl0[h.idx].w;
      if (mat >= 5.0) {
        vec3 t2; vec3 t1 = planeBasis(h.n, t2);
        vec3 q = p - uPl0[h.idx].xyz;
        chk = checkerAt(dot(q, t1) + 1e4, dot(q, t2) + 1e4);
      }
    } else {
      base = uCy2[h.idx].xyz; mat = uCy2[h.idx].w;
      if (mat >= 5.0) {
        vec3 a = uCy1[h.idx].xyz;
        vec3 t2; vec3 t1 = planeBasis(a, t2);
        vec3 q = p - uCy0[h.idx].xyz;
        if (abs(dot(h.n, a)) > 0.99) chk = checkerAt(dot(q, t1) * 2.0 + 1e4, dot(q, t2) * 2.0 + 1e4);
        else chk = checkerAt(atan(dot(q, t2), dot(q, t1)) / (2.0 * PI) * 12.0 + 12.0, dot(q, a) * 2.0 + 1e4);
      }
    }
    float refl = mat;
    if (mat >= 5.0) { refl = mat - 10.0; base = mix(base, base * 0.3, chk); }

    if (selected) {
      float rim = pow(1.0 - abs(dot(n, d)), 2.2);
      base = mix(base, vec3(1.0, 0.82, 0.4), 0.1 + 0.55 * rim);
    }

    vec3 col = base * uAmbient;
    vec3 po = p + n * 1e-3;
    for (int i = 0; i < MAX_L; i++) {
      if (i >= uNL) break;
      vec3 lp = uL0[i].xyz;
      float br = uL0[i].w;
      vec3 lc = uL1[i].xyz;
      vec3 tl = lp - po;
      float dist = length(tl);
      vec3 l = tl / dist;
      float nl = dot(n, l);
      if (nl <= 0.0) continue;
      Hit sh;
      if (trace(po, l, dist, true, sh)) continue;
      col += base * lc * (br * nl);
      if (uSpec > 0.0) {
        vec3 r = reflect(-l, n);
        col += lc * (br * uSpec * pow(max(dot(r, -d), 0.0), uShine));
      }
    }

    bool cont = b < uBounces && refl > 0.01;
    acc += thr * (cont ? (1.0 - refl) * col : col);
    if (!cont) break;
    thr *= refl;
    o = po;
    d = reflect(d, n);
  }

  outColor = vec4(min(acc, vec3(1.0)), uAlpha);
}`;

export interface RenderOpts {
  selectedId: string | null;
  /** Sub-pixel offset in pixels, for progressive anti-aliasing. */
  jitter: [number, number];
  /** Blend weight of this pass over the previous one. 1 replaces. */
  alpha: number;
}

type Locs = Record<string, WebGLUniformLocation | null>;

export class Renderer {
  private gl!: WebGL2RenderingContext;
  private loc: Locs = {};
  onLost: (() => void) | null = null;
  onRestored: (() => void) | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.onLost?.(); });
    canvas.addEventListener('webglcontextrestored', () => { this.init(); this.onRestored?.(); });
    this.init();
  }

  private compile(type: number, src: string) {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return sh;
  }

  private init() {
    const gl = this.gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, this.compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, this.compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`Shader link failed: ${gl.getProgramInfoLog(prog)}`);
    this.loc = {};
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i)!;
      const name = info.name.replace(/\[0\]$/, '');
      this.loc[name] = gl.getUniformLocation(prog, info.name);
    }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize(w: number, h: number) {
    const c = this.canvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }

  render(scene: Scene, opts: RenderOpts) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const L = this.loc;
    const { fwd, right, up } = cameraBasis(scene.camera.dir);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const sp = scene.shapes.filter((s) => s.kind === 'sphere');
    const pl = scene.shapes.filter((s) => s.kind === 'plane');
    const cy = scene.shapes.filter((s) => s.kind === 'cylinder');
    const code = (m: { reflect: number; checker: boolean }) => m.reflect + (m.checker ? 10 : 0);
    const c01 = (c: number[]) => [c[0] / 255, c[1] / 255, c[2] / 255];

    const sp0 = new Float32Array(LIMITS.sphere * 4), sp1 = new Float32Array(LIMITS.sphere * 4);
    sp.forEach((s, i) => {
      if (s.kind !== 'sphere') return;
      sp0.set([...s.center, s.radius], i * 4);
      sp1.set([...c01(s.mat.color), code(s.mat)], i * 4);
    });
    const pl0 = new Float32Array(LIMITS.plane * 4), pl1 = new Float32Array(LIMITS.plane * 4), pl2 = new Float32Array(LIMITS.plane * 4);
    pl.forEach((s, i) => {
      if (s.kind !== 'plane') return;
      pl0.set([...s.point, code(s.mat)], i * 4);
      pl1.set([...norm(s.normal), 0], i * 4);
      pl2.set([...c01(s.mat.color), 0], i * 4);
    });
    const cy0 = new Float32Array(LIMITS.cylinder * 4), cy1 = new Float32Array(LIMITS.cylinder * 4), cy2 = new Float32Array(LIMITS.cylinder * 4);
    cy.forEach((s, i) => {
      if (s.kind !== 'cylinder') return;
      cy0.set([...s.center, s.radius], i * 4);
      cy1.set([...norm(s.axis), s.height / 2], i * 4);
      cy2.set([...c01(s.mat.color), code(s.mat)], i * 4);
    });
    const l0 = new Float32Array(LIMITS.light * 4), l1 = new Float32Array(LIMITS.light * 4);
    scene.lights.forEach((l, i) => {
      l0.set([...l.pos, l.brightness], i * 4);
      l1.set([...c01(l.color), 0], i * 4);
    });

    let selType = 0, selIdx = -1;
    if (opts.selectedId) {
      let i = sp.findIndex((s) => s.id === opts.selectedId);
      if (i >= 0) { selType = 1; selIdx = i; }
      else if ((i = pl.findIndex((s) => s.id === opts.selectedId)) >= 0) { selType = 2; selIdx = i; }
      else if ((i = cy.findIndex((s) => s.id === opts.selectedId)) >= 0) { selType = 3; selIdx = i; }
    }

    const amb = c01(scene.ambient.color).map((v) => v * scene.ambient.ratio);
    gl.uniform2f(L.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(L.uJitter, opts.jitter[0], opts.jitter[1]);
    gl.uniform1f(L.uAlpha, opts.alpha);
    gl.uniform3fv(L.uCamPos, scene.camera.pos);
    gl.uniform3fv(L.uCamFwd, fwd);
    gl.uniform3fv(L.uCamRight, right);
    gl.uniform3fv(L.uCamUp, up);
    gl.uniform1f(L.uTanHalf, Math.tan((scene.camera.fov * Math.PI) / 360));
    gl.uniform3fv(L.uAmbient, amb);
    gl.uniform1f(L.uSpec, scene.look.specular);
    gl.uniform1f(L.uShine, scene.look.shine);
    gl.uniform1i(L.uBounces, scene.look.bounces);
    gl.uniform1i(L.uNSp, sp.length);
    gl.uniform1i(L.uNPl, pl.length);
    gl.uniform1i(L.uNCy, cy.length);
    gl.uniform1i(L.uNL, scene.lights.length);
    gl.uniform1i(L.uSelType, selType);
    gl.uniform1i(L.uSelIdx, selIdx);
    gl.uniform4fv(L.uSp0, sp0); gl.uniform4fv(L.uSp1, sp1);
    gl.uniform4fv(L.uPl0, pl0); gl.uniform4fv(L.uPl1, pl1); gl.uniform4fv(L.uPl2, pl2);
    gl.uniform4fv(L.uCy0, cy0); gl.uniform4fv(L.uCy1, cy1); gl.uniform4fv(L.uCy2, cy2);
    gl.uniform4fv(L.uL0, l0); gl.uniform4fv(L.uL1, l1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
