import * as THREE from "three";
import {
  ArenaCollider,
  BotSpawnDefinition,
  ExtractionZone,
  HoldZoneDefinition,
  Interactable,
  JumpPad,
  LevelDefinition,
  SpawnPoint,
  WeaponPickupDefinition,
} from "./types";
import { getWeaponDefinition } from "./weapons";
import { createFloorTexture, createWallTexture, createStructureTexture } from "./textures";

export interface ArenaInteractableVisual {
  def: Interactable;
  group: THREE.Group;
  beacon: THREE.Mesh;
  label: THREE.Sprite;
  accent: THREE.MeshStandardMaterial;
}

export interface ArenaHoldZoneVisual {
  def: HoldZoneDefinition;
  ring: THREE.Mesh;
  beacon: THREE.Mesh;
  label: THREE.Sprite;
  material: THREE.MeshBasicMaterial;
}

export interface ArenaJumpPadVisual {
  def: JumpPad;
  group: THREE.Group;
  glow: THREE.Mesh;
  label: THREE.Sprite;
  material: THREE.MeshStandardMaterial;
}

export interface ArenaExtractionVisual {
  def: ExtractionZone;
  group: THREE.Group;
  ring: THREE.Mesh;
  beacon: THREE.Mesh;
  label: THREE.Sprite;
  material: THREE.MeshStandardMaterial;
}

export interface ArenaWeaponPickupVisual {
  def: WeaponPickupDefinition;
  group: THREE.Group;
  core: THREE.Mesh;
  ring: THREE.Mesh;
  pedestal: THREE.Mesh;
  beacon: THREE.Mesh;
  label: THREE.Sprite;
  material: THREE.MeshStandardMaterial;
  ringMaterial: THREE.MeshStandardMaterial;
  beaconMaterial: THREE.MeshBasicMaterial;
}

export interface Arena {
  root: THREE.Group;
  colliders: ArenaCollider[];
  spawnPoints: SpawnPoint[];
  botSpawns: BotSpawnDefinition[];
  wallMeshes: THREE.Mesh[];
  navWaypoints: THREE.Vector3[];
  interactables: ArenaInteractableVisual[];
  holdZones: ArenaHoldZoneVisual[];
  jumpPads: ArenaJumpPadVisual[];
  weaponPickups: ArenaWeaponPickupVisual[];
  extraction: ArenaExtractionVisual;
}

type PickupOccupiedArea =
  | THREE.Vector3
  | {
      position: THREE.Vector3;
      radius: number;
    };

const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_PICKUP_CLEARANCE = 1.35;

function createBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  texture?: THREE.Texture
): ArenaCollider {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    ...(texture ? { map: texture } : {}),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  return {
    min: new THREE.Vector3(x - w / 2, y, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h, z + d / 2),
    mesh,
  };
}

export function buildArena(scene: THREE.Scene, level: LevelDefinition): Arena {
  const root = new THREE.Group();
  root.name = `arena-${level.id}`;
  scene.add(root);

  const colliders: ArenaCollider[] = [];
  const wallMeshes: THREE.Mesh[] = [];

  const floorGeo = new THREE.PlaneGeometry(level.floorSize.x, level.floorSize.y);
  const floorTex = createFloorTexture(level.floorColor);
  const tileScale = Math.max(level.floorSize.x, level.floorSize.y) / 8;
  floorTex.repeat.set(tileScale, tileScale);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: level.floorColor,
    roughness: 0.92,
    metalness: 0.08,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  colliders.push({
    min: new THREE.Vector3(-level.floorSize.x / 2, -0.5, -level.floorSize.y / 2),
    max: new THREE.Vector3(level.floorSize.x / 2, 0, level.floorSize.y / 2),
    mesh: floor,
  });

  const wallHeight = 4.4;
  const wallThickness = 0.6;
  const halfX = level.floorSize.x / 2;
  const halfZ = level.floorSize.y / 2;
  const boundaryWalls = [
    { w: level.floorSize.x, h: wallHeight, d: wallThickness, x: 0, z: -halfZ },
    { w: level.floorSize.x, h: wallHeight, d: wallThickness, x: 0, z: halfZ },
    { w: wallThickness, h: wallHeight, d: level.floorSize.y, x: halfX, z: 0 },
    { w: wallThickness, h: wallHeight, d: level.floorSize.y, x: -halfX, z: 0 },
  ];

  const wallTex = createWallTexture(0x5a6477);
  wallTex.repeat.set(2, 1);
  for (const def of boundaryWalls) {
    const wall = createBox(root, def.w, def.h, def.d, def.x, 0, def.z, 0x5a6477, wallTex);
    colliders.push(wall);
    wallMeshes.push(wall.mesh);
  }

  for (let si = 0; si < level.structures.length; si++) {
    const structure = level.structures[si];
    const structTex = createStructureTexture(structure.color, si * 37);
    structTex.repeat.set(
      Math.max(1, Math.round(Math.max(structure.size.x, structure.size.z) / 3)),
      Math.max(1, Math.round(structure.size.y / 2))
    );
    const collider = createBox(
      root,
      structure.size.x,
      structure.size.y,
      structure.size.z,
      structure.position.x,
      structure.position.y,
      structure.position.z,
      structure.color,
      structTex
    );
    colliders.push(collider);
    wallMeshes.push(collider.mesh);
  }

  const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x282018, 0.6);
  root.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xf4f8ff, 1.3);
  dirLight.position.set(12, 18, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -28;
  dirLight.shadow.camera.right = 28;
  dirLight.shadow.camera.top = 28;
  dirLight.shadow.camera.bottom = -28;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.normalBias = 0.04;
  root.add(dirLight);

  const accentLightA = new THREE.PointLight(0x2b72ff, 1.1, 28, 2);
  accentLightA.position.set(-halfX * 0.55, 3.4, -halfZ * 0.4);
  root.add(accentLightA);

  const accentLightB = new THREE.PointLight(0x3fd5ff, 0.9, 30, 2);
  accentLightB.position.set(halfX * 0.6, 3.2, halfZ * 0.42);
  root.add(accentLightB);

  const fillLight = new THREE.DirectionalLight(0xffd4a8, 0.25);
  fillLight.position.set(-8, 6, -10);
  root.add(fillLight);

  scene.background = new THREE.Color(level.backgroundColor);
  scene.fog = new THREE.Fog(level.backgroundColor, 24, level.fogFar);

  const interactables = level.interactables.map((def) =>
    createInteractableVisual(root, def)
  );
  const holdZones = level.holdZones.map((def) => createHoldZoneVisual(root, def));
  const jumpPads = level.jumpPads.map((def) => createJumpPadVisual(root, def));
  const occupiedPickupPoints: PickupOccupiedArea[] = [
    ...level.interactables.map((entry) => ({
      position: entry.position.clone(),
      radius: 1.2,
    })),
    ...level.holdZones.map((entry) => ({
      position: entry.position.clone(),
      radius: entry.radius + 0.9,
    })),
    ...level.jumpPads.map((entry) => ({
      position: entry.position.clone(),
      radius: entry.radius + 0.8,
    })),
    {
      position: level.extractionZone.position.clone(),
      radius: level.extractionZone.radius + 1,
    },
  ];
  const weaponPickups = level.weaponPickups.map((def) => {
    const safePosition = resolveArenaPickupPosition(
      def.position,
      colliders,
      level.floorSize,
      occupiedPickupPoints,
      DEFAULT_PICKUP_CLEARANCE
    );
    occupiedPickupPoints.push(safePosition.clone());
    return createWeaponPickupVisual(root, { ...def, position: safePosition });
  });
  const extraction = createExtractionVisual(root, level.extractionZone);

  return {
    root,
    colliders,
    spawnPoints: level.spawnPoints,
    botSpawns: level.botSpawns,
    wallMeshes,
    navWaypoints: level.navWaypoints,
    interactables,
    holdZones,
    jumpPads,
    weaponPickups,
    extraction,
  };
}

function createInteractableVisual(
  parent: THREE.Object3D,
  def: Interactable
): ArenaInteractableVisual {
  const group = new THREE.Group();
  group.position.copy(def.position);
  group.rotation.y = def.rotation ?? 0;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.5, 0.35),
    new THREE.MeshStandardMaterial({
      color: 0x1d2534,
      roughness: 0.48,
      metalness: 0.54,
    })
  );
  frame.position.y = 0.75;
  frame.castShadow = true;
  frame.receiveShadow = true;

  const accent = new THREE.MeshStandardMaterial({
    color: 0x7ab7ff,
    emissive: 0x235fb7,
    emissiveIntensity: 0.25,
    roughness: 0.28,
    metalness: 0.35,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.78, 0.04), accent);
  screen.position.set(0, 0.88, 0.19);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.34, 5.8, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7ab7ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beacon.position.set(0, 3.3, 0);

  const shortLabel = def.label.replace(/^Terminal\s+/i, "");
  const label = createLabelSprite(
    shortLabel,
    "rgba(122, 183, 255, 0.96)"
  );
  label.position.set(0, 3.6, 0);
  label.scale.set(1.8, 0.72, 1);

  group.add(frame, screen, beacon, label);
  parent.add(group);

  return { def, group, beacon, label, accent };
}

function createHoldZoneVisual(
  parent: THREE.Object3D,
  def: HoldZoneDefinition
): ArenaHoldZoneVisual {
  const material = new THREE.MeshBasicMaterial({
    color: 0x6ed0ff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(def.radius - 0.25, def.radius, 64),
    material
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(def.position).addScaledVector(UP, 0.03);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(def.radius * 0.35, def.radius * 0.5, 4.8, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6ed0ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beacon.position.copy(def.position).add(new THREE.Vector3(0, 2.55, 0));

  const label = createLabelSprite(
    def.label,
    "rgba(110, 208, 255, 0.94)",
    def.hint
  );
  label.position.copy(def.position).add(new THREE.Vector3(0, 3.8, 0));
  label.scale.set(3.9, 1.18, 1);

  parent.add(ring, beacon, label);
  return { def, ring, beacon, label, material };
}

function createJumpPadVisual(
  parent: THREE.Object3D,
  def: JumpPad
): ArenaJumpPadVisual {
  const group = new THREE.Group();
  group.position.copy(def.position);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(def.radius * 0.84, def.radius, 0.18, 24),
    new THREE.MeshStandardMaterial({
      color: 0x20314d,
      metalness: 0.46,
      roughness: 0.42,
    })
  );
  base.position.y = 0.09;
  base.castShadow = true;
  base.receiveShadow = true;

  const material = new THREE.MeshStandardMaterial({
    color: 0x5fd2ff,
    emissive: 0x2a8fe0,
    emissiveIntensity: 0.55,
    roughness: 0.34,
    metalness: 0.28,
  });
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(def.radius * 0.64, def.radius * 0.82, 0.08, 24),
    material
  );
  glow.position.y = 0.2;

  const label = createLabelSprite(def.label, "rgba(95, 210, 255, 0.92)");
  label.position.set(0, 2.3, 0);
  label.scale.set(2.8, 0.72, 1);

  group.add(base, glow, label);
  parent.add(group);

  return { def, group, glow, label, material };
}

export function createWeaponPickupVisual(
  parent: THREE.Object3D,
  def: WeaponPickupDefinition
): ArenaWeaponPickupVisual {
  const group = new THREE.Group();
  group.position.copy(def.position);

  const weaponDef = getWeaponDefinition(def.weaponId);
  const color = weaponDef.color;
  const emissive = weaponDef.emissive;
  const size = 0.44;

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.7,
    roughness: 0.28,
    metalness: 0.36,
  });
  const ringMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.55,
    roughness: 0.32,
    metalness: 0.22,
  });
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.9, size, 0.18, 16),
    new THREE.MeshStandardMaterial({
      color: 0x20283a,
      roughness: 0.48,
      metalness: 0.28,
    })
  );
  pedestal.position.y = 0.09;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;

  const coreGeometry =
    def.weaponId === "rail-lance"
      ? new THREE.CylinderGeometry(size * 0.12, size * 0.12, size * 1.15, 12)
      : def.weaponId === "scattershot"
        ? new THREE.BoxGeometry(size * 0.22, size * 0.22, size * 1.15)
        : def.weaponId === "plasma-lobber"
          ? new THREE.SphereGeometry(size * 0.28, 12, 10)
          : new THREE.BoxGeometry(size * 0.72, 0.22, size * 0.28);
  const core = new THREE.Mesh(coreGeometry, material);
  core.position.y = 0.34;
  core.castShadow = true;
  core.receiveShadow = true;
  if (def.weaponId === "rail-lance") {
    core.rotation.x = Math.PI / 2;
  }

  const accent = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.8, 0.04, 10, 24),
    ringMaterial
  );
  accent.rotation.x = Math.PI / 2;
  accent.position.y = 0.42;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.9, 0.045, 10, 24),
    ringMaterial
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.18;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.5, size * 0.82, 3.6, 18, 1, true),
    beaconMaterial
  );
  beacon.position.y = 2.2;

  const label = createLabelSprite(
    def.label,
    hexToRgba(color, 0.96),
    def.detail
  );
  label.position.set(0, 3.05, 0);
  label.scale.set(3.7, 1, 1);

  group.add(pedestal, core, accent, ring, beacon, label);
  parent.add(group);

  return {
    def,
    group,
    core,
    pedestal,
    ring,
    beacon,
    label,
    material,
    ringMaterial,
    beaconMaterial,
  };
}

export function resolveArenaPickupPosition(
  desiredPosition: THREE.Vector3,
  colliders: ArenaCollider[],
  floorSize: THREE.Vector2,
  occupiedPoints: PickupOccupiedArea[] = [],
  clearance = DEFAULT_PICKUP_CLEARANCE
): THREE.Vector3 {
  const minX = -floorSize.x / 2 + clearance;
  const maxX = floorSize.x / 2 - clearance;
  const minZ = -floorSize.y / 2 + clearance;
  const maxZ = floorSize.y / 2 - clearance;
  const clampedOrigin = new THREE.Vector3(
    THREE.MathUtils.clamp(desiredPosition.x, minX, maxX),
    desiredPosition.y,
    THREE.MathUtils.clamp(desiredPosition.z, minZ, maxZ)
  );

  const ringRadii = [0, clearance, clearance * 1.75, clearance * 2.4, clearance * 3.2];
  const angleSeed = Math.atan2(clampedOrigin.z, clampedOrigin.x);

  for (let ringIndex = 0; ringIndex < ringRadii.length; ringIndex++) {
    const radius = ringRadii[ringIndex];
    const samples = ringIndex === 0 ? 1 : 8 + ringIndex * 4;

    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
      const angle =
        angleSeed + (sampleIndex / samples) * Math.PI * 2 + ringIndex * 0.35;
      const candidate = new THREE.Vector3(
        THREE.MathUtils.clamp(clampedOrigin.x + Math.cos(angle) * radius, minX, maxX),
        desiredPosition.y,
        THREE.MathUtils.clamp(clampedOrigin.z + Math.sin(angle) * radius, minZ, maxZ)
      );

      if (
        hasArenaClearance(candidate, colliders, clearance) &&
        hasOccupiedClearance(candidate, occupiedPoints, clearance)
      ) {
        return candidate;
      }
    }
  }

  return clampedOrigin;
}

function createExtractionVisual(
  parent: THREE.Object3D,
  def: ExtractionZone
): ArenaExtractionVisual {
  const group = new THREE.Group();
  group.position.copy(def.position);

  const material = new THREE.MeshStandardMaterial({
    color: 0x7ef5c5,
    emissive: 0x2d8d68,
    emissiveIntensity: 0.3,
    roughness: 0.35,
    metalness: 0.24,
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(def.radius, 0.14, 12, 48),
    material
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(def.radius * 0.28, def.radius * 0.46, 6.2, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x7ef5c5,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beacon.position.y = 3.3;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(def.radius + 0.48, def.radius + 0.82, 64),
    new THREE.MeshBasicMaterial({
      color: 0x7ef5c5,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
    })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.02;

  const label = createLabelSprite(
    def.label,
    "rgba(126, 245, 197, 0.96)",
    def.hint
  );
  label.position.set(0, 4.55, 0);
  label.scale.set(4.2, 1.24, 1);

  group.add(ring, outerRing, beacon, label);
  parent.add(group);

  return { def, group, ring, beacon, label, material };
}

function createLabelSprite(
  text: string,
  color: string,
  detail?: string
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = detail ? 192 : 128;
  const context = canvas.getContext("2d");
  if (!context) {
    const texture = new THREE.Texture();
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(4, 10, 22, 0.72)";
  roundRect(context, 18, 22, canvas.width - 36, canvas.height - 44, 18);
  context.fill();
  context.strokeStyle = color.replace("0.96", "0.34").replace("0.94", "0.34");
  context.lineWidth = 3;
  roundRect(context, 18, 22, canvas.width - 36, canvas.height - 44, 18);
  context.stroke();
  context.fillStyle = color;
  context.font = "600 42px Geist Mono, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    text.toUpperCase(),
    canvas.width / 2,
    detail ? 64 : canvas.height / 2 + 2
  );

  if (detail) {
    context.fillStyle = "rgba(225, 238, 255, 0.76)";
    context.font = "500 24px Geist Mono, monospace";
    const lines = wrapLabelText(context, detail, canvas.width - 76).slice(0, 2);
    lines.forEach((line, index) => {
      context.fillText(line.toUpperCase(), canvas.width / 2, 112 + index * 28);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    })
  );
  sprite.renderOrder = 10;
  return sprite;
}

function wrapLabelText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate.toUpperCase()).width <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function hasArenaClearance(
  point: THREE.Vector3,
  colliders: ArenaCollider[],
  clearance: number
): boolean {
  return colliders.every((collider) => {
    if (collider.max.y <= 0.2) return true;

    return (
      point.x < collider.min.x - clearance ||
      point.x > collider.max.x + clearance ||
      point.z < collider.min.z - clearance ||
      point.z > collider.max.z + clearance
    );
  });
}

function hasOccupiedClearance(
  point: THREE.Vector3,
  occupiedPoints: PickupOccupiedArea[],
  clearance: number
): boolean {
  return occupiedPoints.every((occupied) => {
    const position = occupied instanceof THREE.Vector3 ? occupied : occupied.position;
    const radius = occupied instanceof THREE.Vector3 ? 0 : occupied.radius;
    const minDistance = clearance + radius;
    return position.distanceToSquared(point) >= minDistance * minDistance;
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function hexToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
