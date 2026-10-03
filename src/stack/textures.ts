import * as THREE from 'three';

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

/** A small mono label (process names, chip markings) on a dark plate. */
export function labelTexture(text: string, color = '#ece7df', bg = '#141417', w = 256, h = 128): THREE.CanvasTexture {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(h * 0.38)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Etched code along the front edge of a layer plate. */
export function plateTexture(code: string, name: string, latency: string, color: string): THREE.CanvasTexture {
  return canvasTexture(2048, 96, (ctx, w, h) => {
    ctx.fillStyle = '#0f0f12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 10, h);
    ctx.textBaseline = 'middle';
    ctx.font = `700 48px ${MONO}`;
    ctx.fillText(code, 40, h / 2 + 2);
    ctx.fillStyle = 'rgba(236,231,223,0.6)';
    ctx.font = `500 34px ${MONO}`;
    ctx.fillText(name.toUpperCase(), 230, h / 2 + 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(236,231,223,0.85)';
    ctx.font = `600 40px ${MONO}`;
    ctx.fillText(latency, w - 40, h / 2 + 2);
  });
}
