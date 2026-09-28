import * as THREE from 'three';
import { APERTURES, ringFromFocus } from './optics';

const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
const SANS = '"Inter Variable", system-ui, sans-serif';

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  srgb = true
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Distance scale printed around the focus ring. u wraps the circumference;
 * a label for distance d sits at the angle the ring must turn to focus at d.
 */
export function focusScaleTexture(sweep: number): THREE.CanvasTexture {
  return canvasTexture(4096, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, w, h);
    const marks: [number, string, string][] = [
      [Infinity, '∞', '#ece7df'],
      [10000, '10', '#ece7df'],
      [5000, '5', '#ece7df'],
      [3000, '3', '#ece7df'],
      [2000, '2', '#ece7df'],
      [1500, '1.5', '#ece7df'],
      [1000, '1', '#ff7a45'],
      [800, '.8', '#ff7a45'],
      [700, '.7', '#ff7a45'],
      [600, '.6', '#ff7a45'],
      [500, '.5', '#ff7a45'],
      [450, '.45', '#ff7a45'],
    ];
    const toU = (t: number) => (((t * sweep) / (Math.PI * 2)) % 1 + 1) % 1;
    // Fine ticks along the helicoid travel.
    ctx.strokeStyle = 'rgba(236,231,223,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 60; i++) {
      const x = toU(i / 60) * w;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.78);
      ctx.lineTo(x, h * (i % 5 === 0 ? 0.56 : 0.66));
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [d, label, color] of marks) {
      const x = toU(ringFromFocus(d)) * w;
      ctx.fillStyle = color;
      ctx.font = `600 ${label === '∞' ? 58 : 44}px ${MONO}`;
      ctx.fillText(label, x, h * 0.3);
    }
    ctx.fillStyle = 'rgba(236,231,223,0.5)';
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText('m', toU(0.97) * w, h * 0.3);
  });
}

export function apertureScaleTexture(angleFor: (n: number) => number): THREE.CanvasTexture {
  return canvasTexture(2048, 96, (ctx, w, h) => {
    ctx.fillStyle = '#111114';
    ctx.fillRect(0, 0, w, h);
    const stops = [2, 2.8, 4, 5.6, 8, 11, 16];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of stops) {
      const u = (((angleFor(n) / (Math.PI * 2)) % 1) + 1) % 1;
      const major = (APERTURES as readonly number[]).includes(n);
      ctx.fillStyle = major ? '#ece7df' : 'rgba(236,231,223,0.55)';
      ctx.font = `${major ? 600 : 500} 40px ${MONO}`;
      ctx.fillText(String(n), u * w, h * 0.5);
    }
  });
}

/** Ribbed rubber grip, used as a bump map on the focus ring. */
export function knurlTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(
    512,
    64,
    (ctx, w, h) => {
      const grd = ctx.createLinearGradient(0, 0, w / 64, 0);
      grd.addColorStop(0, '#000');
      grd.addColorStop(0.5, '#fff');
      grd.addColorStop(1, '#000');
      ctx.fillStyle = grd;
      for (let i = 0; i < 64; i++) {
        ctx.save();
        ctx.translate((i * w) / 64, 0);
        ctx.fillRect(0, 0, w / 64, h);
        ctx.restore();
      }
    },
    false
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

export function nameRingTexture(): THREE.CanvasTexture {
  return canvasTexture(2048, 2048, (ctx, w, h) => {
    ctx.fillStyle = '#0c0c0e';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    const text = 'NW·OPTIC  50mm  1:2  ·  PLANE OF FOCUS  ·  Ø52  ·  HEILBRONN  ·  ';
    ctx.font = `600 64px ${MONO}`;
    ctx.fillStyle = '#d9d3c9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const radius = w * 0.43;
    const chars = [...text];
    const step = (Math.PI * 2) / chars.length;
    chars.forEach((c, i) => {
      ctx.save();
      ctx.rotate(i * step);
      ctx.translate(0, -radius);
      ctx.fillText(c, 0, 0);
      ctx.restore();
    });
  });
}

export function chipEdgeTexture(base: string): THREE.CanvasTexture {
  const tex = canvasTexture(512, 32, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4efe6';
    for (let i = 0; i < 8; i++) ctx.fillRect((i * w) / 8, 0, w / 24, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function chipFaceTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f4efe6';
    ctx.lineWidth = 10;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f4efe6';
    ctx.font = `700 64px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('42', w / 2, h / 2 + 4);
  });
}

export function cardTexture(rank: string, suit: string, red: boolean): THREE.CanvasTexture {
  return canvasTexture(320, 448, (ctx, w, h) => {
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = red ? '#d23a1c' : '#141414';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 64px ${SANS}`;
    ctx.fillText(rank, 50, 56);
    ctx.font = `400 54px ${SANS}`;
    ctx.fillText(suit, 50, 116);
    ctx.font = `400 200px ${SANS}`;
    ctx.fillText(suit, w / 2, h / 2 + 16);
  });
}

export function podiumTexture(label: string): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1b1a18';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9b65b';
    ctx.font = `600 150px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 8);
  });
}

export function checkerTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    const n = 8;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#2a2826' : '#8f8a82';
        ctx.fillRect((x * w) / n, (y * h) / n, w / n, h / n);
      }
  });
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export function terminalTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 768, (ctx, w, h) => {
    ctx.fillStyle = '#050805';
    ctx.fillRect(0, 0, w, h);
    const lines = [
      ['$ ', 'echo "hello" | tr a-z A-Z'],
      ['', 'HELLO'],
      ['$ ', 'cat << EOF > notes.txt'],
      ['> ', 'fork · execve · dup2'],
      ['> ', 'EOF'],
      ['$ ', 'ls -l | grep .c | wc -l'],
      ['', '42'],
      ['$ ', 'export FOCUS=systems'],
      ['$ ', 'echo $FOCUS'],
      ['', 'systems'],
      ['$ ', '▌'],
    ];
    ctx.font = `500 44px ${MONO}`;
    ctx.textBaseline = 'top';
    lines.forEach(([p, t], i) => {
      const y = 44 + i * 62;
      ctx.fillStyle = '#9be37a';
      ctx.fillText(p, 48, y);
      ctx.fillStyle = p ? '#d8f5c8' : 'rgba(216,245,200,0.62)';
      ctx.fillText(t, 48 + ctx.measureText(p).width, y);
    });
    // Scanlines.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = '#9be37a';
    ctx.font = `600 28px ${MONO}`;
    ctx.fillText('minishell — 80×24', 48, h - 50);
  });
}

/** Distance rule printed along the optical bench rail. */
export function railTexture(
  marks: { x: number; label: string }[],
  x0: number,
  x1: number
): THREE.CanvasTexture {
  const W = 8192;
  return canvasTexture(W, 128, (ctx, w, h) => {
    ctx.fillStyle = '#151517';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(236,231,223,0.35)';
    ctx.fillStyle = 'rgba(236,231,223,0.8)';
    ctx.lineWidth = 3;
    ctx.font = `500 44px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const m of marks) {
      const u = ((m.x - x0) / (x1 - x0)) * w;
      ctx.beginPath();
      ctx.moveTo(u, 0);
      ctx.lineTo(u, h * 0.28);
      ctx.stroke();
      ctx.fillText(m.label, u, h * 0.62);
    }
  });
}

export function floorGridTexture(): THREE.CanvasTexture {
  const tex = canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#0f0f11';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(236,231,223,0.05)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        const p = (i * w) / 8;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
    },
    true
  );
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
