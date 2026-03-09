import * as THREE from "three";

export interface SurfaceTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgba(r: number, g: number, b: number, a: number): string {
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${a})`;
}

function lighten(hex: number, amount: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r + amount, g + amount, b + amount];
}

function darken(hex: number, amount: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return [r - amount, g - amount, b - amount];
}

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function createCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createCanvasTexture(
  canvas: HTMLCanvasElement,
  color = false
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  if (color) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function paintNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
  step: number,
  amplitude: number,
  alphaScale = 1
): void {
  const rand = seededRandom(seed);
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const value = (rand() - 0.5) * amplitude;
      const shade = value > 0 ? 255 : 0;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${Math.abs(value) / 255 * alphaScale})`;
      ctx.fillRect(x, y, step, step);
    }
  }
}

function drawSoftStain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle: number,
  colorStops: Array<[number, string]>
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [stop, color] of colorStops) {
    gradient.addColorStop(stop, color);
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createFloorTexture(
  baseColor: number,
  size = 1024
): SurfaceTextureSet {
  const colorCanvas = createCanvas(size);
  const bumpCanvas = createCanvas(size);
  const roughnessCanvas = createCanvas(size);
  const colorCtx = colorCanvas.getContext("2d")!;
  const bumpCtx = bumpCanvas.getContext("2d")!;
  const roughCtx = roughnessCanvas.getContext("2d")!;
  const [r, g, b] = hexToRgb(baseColor);
  const [lr, lg, lb] = lighten(baseColor, 18);
  const [dr, dg, db] = darken(baseColor, 18);
  const tileSize = size / 6;
  const subTile = tileSize / 2;

  colorCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  colorCtx.fillRect(0, 0, size, size);

  const floorGradient = colorCtx.createLinearGradient(0, 0, size, size);
  floorGradient.addColorStop(0, rgba(lr + 8, lg + 12, lb + 16, 0.24));
  floorGradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  floorGradient.addColorStop(1, rgba(dr - 8, dg - 10, db - 12, 0.3));
  colorCtx.fillStyle = floorGradient;
  colorCtx.fillRect(0, 0, size, size);

  paintNoise(colorCtx, size, 42, 2, 14);

  colorCtx.strokeStyle = "rgba(255, 255, 255, 0.085)";
  colorCtx.lineWidth = 3;
  for (let i = 0; i <= size / tileSize; i++) {
    const pos = Math.round(i * tileSize);
    colorCtx.beginPath();
    colorCtx.moveTo(pos, 0);
    colorCtx.lineTo(pos, size);
    colorCtx.stroke();
    colorCtx.beginPath();
    colorCtx.moveTo(0, pos);
    colorCtx.lineTo(size, pos);
    colorCtx.stroke();
  }

  colorCtx.strokeStyle = "rgba(255, 255, 255, 0.028)";
  colorCtx.lineWidth = 1;
  for (let i = 1; i < size / subTile; i++) {
    const pos = i * subTile;
    if (pos % tileSize === 0) continue;
    colorCtx.beginPath();
    colorCtx.moveTo(pos, 0);
    colorCtx.lineTo(pos, size);
    colorCtx.stroke();
    colorCtx.beginPath();
    colorCtx.moveTo(0, pos);
    colorCtx.lineTo(size, pos);
    colorCtx.stroke();
  }

  const stainRand = seededRandom(77);
  for (let i = 0; i < 12; i++) {
    drawSoftStain(
      colorCtx,
      stainRand() * size,
      stainRand() * size,
      tileSize * (0.18 + stainRand() * 0.32),
      tileSize * (0.12 + stainRand() * 0.28),
      stainRand() * Math.PI,
      [
        [0, rgba(70, 118, 156, 0.1 + stainRand() * 0.06)],
        [0.5, "rgba(20, 28, 42, 0.04)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]
    );
  }

  const stripeColor = rgba(217, 176, 88, 0.1);
  for (let i = 0; i < 3; i++) {
    const y = size * (0.18 + i * 0.28);
    colorCtx.fillStyle = stripeColor;
    colorCtx.fillRect(size * 0.08, y, size * 0.12, 6);
    colorCtx.fillRect(size * 0.8, y + 14, size * 0.1, 6);
  }

  const scuffRand = seededRandom(91);
  for (let i = 0; i < 26; i++) {
    const sx = scuffRand() * size;
    const sy = scuffRand() * size;
    const len = 18 + scuffRand() * 48;
    const angle = scuffRand() * Math.PI;
    colorCtx.strokeStyle = `rgba(0, 0, 0, ${0.05 + scuffRand() * 0.05})`;
    colorCtx.lineWidth = 1 + scuffRand() * 1.8;
    colorCtx.beginPath();
    colorCtx.moveTo(sx, sy);
    colorCtx.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    colorCtx.stroke();
  }

  roughCtx.fillStyle = "rgb(228, 228, 228)";
  roughCtx.fillRect(0, 0, size, size);
  paintNoise(roughCtx, size, 109, 3, 16, 0.65);
  roughCtx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  roughCtx.lineWidth = 3;
  for (let i = 0; i <= size / tileSize; i++) {
    const pos = Math.round(i * tileSize);
    roughCtx.beginPath();
    roughCtx.moveTo(pos, 0);
    roughCtx.lineTo(pos, size);
    roughCtx.stroke();
    roughCtx.beginPath();
    roughCtx.moveTo(0, pos);
    roughCtx.lineTo(size, pos);
    roughCtx.stroke();
  }
  const wearRand = seededRandom(143);
  for (let i = 0; i < 10; i++) {
    drawSoftStain(
      roughCtx,
      wearRand() * size,
      wearRand() * size,
      tileSize * (0.28 + wearRand() * 0.4),
      tileSize * (0.14 + wearRand() * 0.2),
      wearRand() * Math.PI,
      [
        [0, "rgba(36, 36, 36, 0.5)"],
        [0.55, "rgba(64, 64, 64, 0.18)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]
    );
  }

  bumpCtx.fillStyle = "rgb(128, 128, 128)";
  bumpCtx.fillRect(0, 0, size, size);
  bumpCtx.strokeStyle = "rgba(210, 210, 210, 0.42)";
  bumpCtx.lineWidth = 3;
  for (let i = 0; i <= size / tileSize; i++) {
    const pos = Math.round(i * tileSize);
    bumpCtx.beginPath();
    bumpCtx.moveTo(pos, 0);
    bumpCtx.lineTo(pos, size);
    bumpCtx.stroke();
    bumpCtx.beginPath();
    bumpCtx.moveTo(0, pos);
    bumpCtx.lineTo(size, pos);
    bumpCtx.stroke();
  }
  bumpCtx.strokeStyle = "rgba(82, 82, 82, 0.24)";
  bumpCtx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x = scuffRand() * size;
    const y = scuffRand() * size;
    const len = 14 + scuffRand() * 26;
    const angle = scuffRand() * Math.PI;
    bumpCtx.beginPath();
    bumpCtx.moveTo(x, y);
    bumpCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    bumpCtx.stroke();
  }

  return {
    map: createCanvasTexture(colorCanvas, true),
    bumpMap: createCanvasTexture(bumpCanvas),
    roughnessMap: createCanvasTexture(roughnessCanvas),
  };
}

export function createWallTexture(
  baseColor: number,
  size = 768
): SurfaceTextureSet {
  const colorCanvas = createCanvas(size);
  const bumpCanvas = createCanvas(size);
  const roughnessCanvas = createCanvas(size);
  const colorCtx = colorCanvas.getContext("2d")!;
  const bumpCtx = bumpCanvas.getContext("2d")!;
  const roughCtx = roughnessCanvas.getContext("2d")!;
  const [r, g, b] = hexToRgb(baseColor);
  const [lr, lg, lb] = lighten(baseColor, 20);
  const panelWidth = size / 3;
  const bandHeight = size / 4;

  colorCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  colorCtx.fillRect(0, 0, size, size);

  const verticalShade = colorCtx.createLinearGradient(0, 0, size, 0);
  verticalShade.addColorStop(0, rgba(lr, lg, lb, 0.12));
  verticalShade.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  verticalShade.addColorStop(1, "rgba(0, 0, 0, 0.2)");
  colorCtx.fillStyle = verticalShade;
  colorCtx.fillRect(0, 0, size, size);

  paintNoise(colorCtx, size, 123, 3, 18);

  for (let i = 1; i < 3; i++) {
    const x = i * panelWidth;
    colorCtx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    colorCtx.lineWidth = 3;
    colorCtx.beginPath();
    colorCtx.moveTo(x, 0);
    colorCtx.lineTo(x, size);
    colorCtx.stroke();
    colorCtx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    colorCtx.lineWidth = 1;
    colorCtx.beginPath();
    colorCtx.moveTo(x + 2, 0);
    colorCtx.lineTo(x + 2, size);
    colorCtx.stroke();
  }

  for (let i = 1; i < 4; i++) {
    const y = i * bandHeight;
    colorCtx.strokeStyle = "rgba(0, 0, 0, 0.16)";
    colorCtx.lineWidth = 2;
    colorCtx.beginPath();
    colorCtx.moveTo(0, y);
    colorCtx.lineTo(size, y);
    colorCtx.stroke();
    colorCtx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    colorCtx.beginPath();
    colorCtx.moveTo(0, y + 2);
    colorCtx.lineTo(size, y + 2);
    colorCtx.stroke();
  }

  for (let band = 0; band < 4; band++) {
    const x = panelWidth * 0.16;
    const y = band * bandHeight + bandHeight * 0.18;
    colorCtx.fillStyle = "rgba(118, 182, 255, 0.08)";
    colorCtx.fillRect(x, y, panelWidth * 0.68, 10);
    colorCtx.fillStyle = "rgba(0, 0, 0, 0.14)";
    colorCtx.fillRect(x + 28, y + 34, panelWidth * 0.34, 8);
    colorCtx.fillRect(x + 28, y + 58, panelWidth * 0.34, 8);
  }

  const streakRand = seededRandom(225);
  for (let i = 0; i < 18; i++) {
    const x = streakRand() * size;
    const y = streakRand() * size * 0.4;
    const len = size * (0.08 + streakRand() * 0.22);
    const gradient = colorCtx.createLinearGradient(0, y, 0, y + len);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.08)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    colorCtx.fillStyle = gradient;
    colorCtx.fillRect(x, y, 8 + streakRand() * 8, len);
  }

  const topGlow = colorCtx.createLinearGradient(0, 0, 0, size * 0.14);
  topGlow.addColorStop(0, rgba(lr + 20, lg + 26, lb + 34, 0.16));
  topGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  colorCtx.fillStyle = topGlow;
  colorCtx.fillRect(0, 0, size, size * 0.14);

  roughCtx.fillStyle = "rgb(176, 176, 176)";
  roughCtx.fillRect(0, 0, size, size);
  paintNoise(roughCtx, size, 199, 3, 18, 0.8);
  for (let i = 0; i < 3; i++) {
    const x = i * panelWidth + panelWidth * 0.1;
    roughCtx.fillStyle = "rgba(44, 44, 44, 0.42)";
    roughCtx.fillRect(x, size * 0.14, panelWidth * 0.74, size * 0.08);
  }
  roughCtx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  roughCtx.lineWidth = 3;
  for (let i = 1; i < 3; i++) {
    const x = i * panelWidth;
    roughCtx.beginPath();
    roughCtx.moveTo(x, 0);
    roughCtx.lineTo(x, size);
    roughCtx.stroke();
  }

  bumpCtx.fillStyle = "rgb(128, 128, 128)";
  bumpCtx.fillRect(0, 0, size, size);
  bumpCtx.strokeStyle = "rgba(210, 210, 210, 0.48)";
  bumpCtx.lineWidth = 4;
  for (let i = 1; i < 3; i++) {
    const x = i * panelWidth;
    bumpCtx.beginPath();
    bumpCtx.moveTo(x, 0);
    bumpCtx.lineTo(x, size);
    bumpCtx.stroke();
  }
  for (let i = 1; i < 4; i++) {
    const y = i * bandHeight;
    bumpCtx.beginPath();
    bumpCtx.moveTo(0, y);
    bumpCtx.lineTo(size, y);
    bumpCtx.stroke();
  }
  for (let panel = 0; panel < 3; panel++) {
    for (let band = 0; band < 4; band++) {
      const bx = panel * panelWidth + panelWidth * 0.18;
      const by = band * bandHeight + bandHeight * 0.2;
      bumpCtx.fillStyle = "rgba(208, 208, 208, 0.6)";
      bumpCtx.fillRect(bx, by, 12, 12);
      bumpCtx.fillRect(bx + panelWidth * 0.5, by, 12, 12);
    }
  }

  return {
    map: createCanvasTexture(colorCanvas, true),
    bumpMap: createCanvasTexture(bumpCanvas),
    roughnessMap: createCanvasTexture(roughnessCanvas),
  };
}

export function createStructureTexture(
  baseColor: number,
  seed = 0,
  size = 512
): SurfaceTextureSet {
  const colorCanvas = createCanvas(size);
  const bumpCanvas = createCanvas(size);
  const roughnessCanvas = createCanvas(size);
  const colorCtx = colorCanvas.getContext("2d")!;
  const bumpCtx = bumpCanvas.getContext("2d")!;
  const roughCtx = roughnessCanvas.getContext("2d")!;
  const rand = seededRandom(seed + 200);
  const [r, g, b] = hexToRgb(baseColor);
  const inset = 6;
  const stripeY = size * 0.24 + rand() * size * 0.42;

  colorCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  colorCtx.fillRect(0, 0, size, size);
  paintNoise(colorCtx, size, seed + 201, 2, 18);

  const bodyShade = colorCtx.createLinearGradient(0, 0, size, size);
  bodyShade.addColorStop(0, "rgba(255, 255, 255, 0.06)");
  bodyShade.addColorStop(0.52, "rgba(0, 0, 0, 0)");
  bodyShade.addColorStop(1, "rgba(0, 0, 0, 0.16)");
  colorCtx.fillStyle = bodyShade;
  colorCtx.fillRect(0, 0, size, size);

  colorCtx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  colorCtx.lineWidth = 2;
  colorCtx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  colorCtx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  colorCtx.lineWidth = 1;
  colorCtx.strokeRect(inset + 2, inset + 2, size - (inset + 2) * 2, size - (inset + 2) * 2);

  colorCtx.strokeStyle = "rgba(0, 0, 0, 0.14)";
  colorCtx.lineWidth = 1.5;
  colorCtx.beginPath();
  colorCtx.moveTo(size / 2, inset);
  colorCtx.lineTo(size / 2, size - inset);
  colorCtx.stroke();
  colorCtx.beginPath();
  colorCtx.moveTo(inset, size / 2);
  colorCtx.lineTo(size - inset, size / 2);
  colorCtx.stroke();

  colorCtx.fillStyle = rgba(r + 38, g + 44, b + 56, 0.16);
  colorCtx.fillRect(inset + 4, stripeY, size - (inset + 4) * 2, 5 + rand() * 5);

  if (rand() > 0.45) {
    const stripeWidth = size * 0.16;
    colorCtx.save();
    colorCtx.translate(size * 0.12, size * 0.82);
    colorCtx.rotate(-Math.PI / 4);
    for (let i = 0; i < 4; i++) {
      colorCtx.fillStyle = i % 2 === 0 ? "rgba(224, 176, 84, 0.16)" : "rgba(26, 26, 26, 0.2)";
      colorCtx.fillRect(i * stripeWidth, 0, stripeWidth, size * 0.12);
    }
    colorCtx.restore();
  }

  const rivetPositions = [
    [18, 18],
    [size - 18, 18],
    [18, size - 18],
    [size - 18, size - 18],
    [size / 2 - 6, 18],
    [size / 2 + 6, size - 18],
  ];
  for (const [rx, ry] of rivetPositions) {
    colorCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    colorCtx.beginPath();
    colorCtx.arc(rx, ry, 4, 0, Math.PI * 2);
    colorCtx.fill();
    colorCtx.fillStyle = "rgba(0, 0, 0, 0.16)";
    colorCtx.beginPath();
    colorCtx.arc(rx, ry + 1.5, 3.2, 0, Math.PI * 2);
    colorCtx.fill();
  }

  roughCtx.fillStyle = "rgb(168, 168, 168)";
  roughCtx.fillRect(0, 0, size, size);
  paintNoise(roughCtx, size, seed + 311, 2, 20, 0.9);
  drawSoftStain(
    roughCtx,
    size * 0.5,
    size * 0.5,
    size * 0.36,
    size * 0.22,
    rand() * Math.PI,
    [
      [0, "rgba(36, 36, 36, 0.32)"],
      [0.7, "rgba(64, 64, 64, 0.1)"],
      [1, "rgba(0, 0, 0, 0)"],
    ]
  );

  bumpCtx.fillStyle = "rgb(128, 128, 128)";
  bumpCtx.fillRect(0, 0, size, size);
  bumpCtx.strokeStyle = "rgba(214, 214, 214, 0.42)";
  bumpCtx.lineWidth = 2;
  bumpCtx.strokeRect(inset, inset, size - inset * 2, size - inset * 2);
  bumpCtx.beginPath();
  bumpCtx.moveTo(size / 2, inset);
  bumpCtx.lineTo(size / 2, size - inset);
  bumpCtx.stroke();
  bumpCtx.beginPath();
  bumpCtx.moveTo(inset, size / 2);
  bumpCtx.lineTo(size - inset, size / 2);
  bumpCtx.stroke();
  for (const [rx, ry] of rivetPositions) {
    bumpCtx.fillStyle = "rgba(214, 214, 214, 0.6)";
    bumpCtx.beginPath();
    bumpCtx.arc(rx, ry, 4.5, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  return {
    map: createCanvasTexture(colorCanvas, true),
    bumpMap: createCanvasTexture(bumpCanvas),
    roughnessMap: createCanvasTexture(roughnessCanvas),
  };
}

export function createSkyEnvironmentTexture(
  baseColor: number,
  size = 1024
): THREE.CanvasTexture {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = hexToRgb(baseColor);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, size);
  skyGradient.addColorStop(0, rgba(r * 0.18 + 4, g * 0.22 + 8, b * 0.28 + 12, 1));
  skyGradient.addColorStop(0.42, rgba(r * 0.28 + 8, g * 0.4 + 14, b * 0.52 + 22, 1));
  skyGradient.addColorStop(0.7, "rgba(18, 28, 44, 1)");
  skyGradient.addColorStop(1, "rgba(5, 8, 14, 1)");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, size, size);

  const moonGlow = ctx.createRadialGradient(size * 0.2, size * 0.18, 0, size * 0.2, size * 0.18, size * 0.18);
  moonGlow.addColorStop(0, "rgba(255, 246, 222, 0.82)");
  moonGlow.addColorStop(0.2, "rgba(183, 214, 255, 0.24)");
  moonGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, size, size);

  const horizonGlow = ctx.createLinearGradient(0, size * 0.62, 0, size);
  horizonGlow.addColorStop(0, "rgba(0, 0, 0, 0)");
  horizonGlow.addColorStop(0.55, "rgba(34, 62, 90, 0.38)");
  horizonGlow.addColorStop(1, "rgba(7, 10, 16, 0.9)");
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, size * 0.56, size, size * 0.44);

  const rand = seededRandom(701);
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.58;
    const radius = 0.5 + rand() * 1.6;
    const alpha = 0.14 + rand() * 0.34;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 22; i++) {
    const width = 18 + rand() * 80;
    const x = rand() * size;
    const y = size * (0.78 + rand() * 0.15);
    ctx.fillStyle = i % 3 === 0 ? "rgba(255, 192, 120, 0.22)" : "rgba(122, 190, 255, 0.14)";
    ctx.fillRect(x, y, width, 2 + rand() * 4);
  }

  const texture = createCanvasTexture(canvas, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

export function createDustSpriteTexture(size = 128): THREE.CanvasTexture {
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size * 0.5,
    size * 0.5,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.5
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.88)");
  gradient.addColorStop(0.3, "rgba(215, 234, 255, 0.5)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = createCanvasTexture(canvas, true);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}
