import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FOCAL, MIN_FOCUS, SENSOR_H, SENSOR_W } from './optics';
import { AXIS_Y, DIORAMA_K, DIORAMA_X0 } from './layout';
import { Lens, STOP_X } from './lens';

/**
 * What the sensor sees: a camera at the lens's principal point, rendered
 * with depth, then blurred per pixel by the thin-lens blur-disc formula.
 * Scene depth is mapped back to real distance through the bench's log
 * scale, so the blur matches the readouts.
 */
const dofShader = {
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uNear: { value: 0.05 },
    uFar: { value: 80 },
    uCamX: { value: STOP_X },
    uFocus: { value: 1000 },
    uN: { value: 2 },
    uTexel: { value: new THREE.Vector2() },
    uWidth: { value: 640 },
    uMaxRadius: { value: 14 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform float uNear, uFar, uCamX, uFocus, uN, uWidth, uMaxRadius;
    uniform vec2 uTexel;
    varying vec2 vUv;

    const float F = ${FOCAL.toFixed(1)};
    const float SENSOR = ${SENSOR_W.toFixed(1)};
    const float X0 = ${DIORAMA_X0.toFixed(4)};
    const float K = ${DIORAMA_K.toFixed(4)};
    const float DMIN = ${MIN_FOCUS.toFixed(1)};
    const float GOLDEN = 2.39996323;
    const int SAMPLES = 56;

    float realDistance(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      if (z >= 0.99999) return 1e9;
      float viewZ = (uNear * uFar) / ((uFar - uNear) * z - uFar);
      return DMIN * exp((uCamX - viewZ - X0) / K);
    }

    // Blur-disc radius in pixels.
    float coc(float d) {
      float c = (F * F * abs(d - uFocus)) / (uN * d * max(uFocus - F, 1.0));
      return min(0.5 * c / SENSOR * uWidth, uMaxRadius);
    }

    void main() {
      float dC = realDistance(vUv);
      float cC = coc(dC);
      vec3 base = texture2D(tColor, vUv).rgb;
      vec3 acc = base;
      float wsum = 1.0;
      for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(SAMPLES)) * uMaxRadius;
        float a = fi * GOLDEN;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
        float dS = realDistance(uv);
        float cS = coc(dS);
        // Sharp background must not bleed over a blurry foreground edge.
        if (dS > dC) cS = min(cS, cC * 2.0);
        float w = smoothstep(r - 1.0, r + 0.5, cS);
        vec3 col = min(texture2D(tColor, uv).rgb, vec3(3.0));
        // Highlights bloom into bokeh discs.
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        w *= 1.0 + lum * lum * 0.9;
        acc += col * w;
        wsum += w;
      }
      vec3 col = mix(base, acc / wsum, smoothstep(0.35, 1.2, cC));
      // Gentle optical vignette.
      vec2 q = vUv - 0.5;
      col *= 1.0 - dot(q, q) * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const outputShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(tDiffuse, vUv);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export class SensorView {
  readonly camera: THREE.PerspectiveCamera;
  private raw: THREE.WebGLRenderTarget;
  readonly output: THREE.WebGLRenderTarget;
  private dof: FullScreenQuad;
  private present: FullScreenQuad;
  private dofMat: THREE.ShaderMaterial;

  constructor(width = 720) {
    const height = Math.round((width * SENSOR_H) / SENSOR_W);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_H / 2 / FOCAL));
    this.camera = new THREE.PerspectiveCamera(fov, SENSOR_W / SENSOR_H, 0.05, 80);
    this.raw = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType),
    });
    this.output = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
    this.dofMat = new THREE.ShaderMaterial({
      ...dofShader,
      uniforms: THREE.UniformsUtils.clone(dofShader.uniforms),
      depthTest: false,
      depthWrite: false,
    });
    this.dofMat.uniforms.tColor.value = this.raw.texture;
    this.dofMat.uniforms.tDepth.value = this.raw.depthTexture;
    this.dofMat.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.dofMat.uniforms.uWidth.value = width;
    this.dofMat.uniforms.uMaxRadius.value = width / 44;
    this.dofMat.uniforms.uNear.value = this.camera.near;
    this.dofMat.uniforms.uFar.value = this.camera.far;
    this.dof = new FullScreenQuad(this.dofMat);
    this.present = new FullScreenQuad(
      new THREE.ShaderMaterial({
        ...outputShader,
        uniforms: { tDiffuse: { value: this.output.texture } },
        depthTest: false,
        depthWrite: false,
      })
    );
  }

  /** Render the sensor image into `output`. `hide` are objects the sensor must not see. */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    state: { focus: number; aperture: number; ring: number },
    hide: THREE.Object3D[]
  ) {
    const x = STOP_X + Lens.travel(state.ring);
    this.camera.position.set(x, AXIS_Y, 0);
    this.camera.lookAt(x + 1, AXIS_Y, 0);
    this.camera.updateMatrixWorld();

    const u = this.dofMat.uniforms;
    u.uCamX.value = x;
    u.uFocus.value = isFinite(state.focus) ? state.focus : 1e9;
    u.uN.value = state.aperture;

    const vis = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.raw);
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(this.output);
    this.dof.render(renderer);
    renderer.setRenderTarget(prevTarget);
    hide.forEach((o, i) => (o.visible = vis[i]));
  }

  /** Draw the sensor image into a rectangle of the canvas (CSS px, origin top-left). */
  draw(renderer: THREE.WebGLRenderer, rect: { x: number; y: number; w: number; h: number }, canvasH: number) {
    const y = canvasH - rect.y - rect.h;
    renderer.setScissorTest(true);
    renderer.setScissor(rect.x, y, rect.w, rect.h);
    renderer.setViewport(rect.x, y, rect.w, rect.h);
    this.present.render(renderer);
    renderer.setScissorTest(false);
  }
}
