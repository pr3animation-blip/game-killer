import * as THREE from "three";
import {
  ArenaCollider,
  BotSpawnDefinition,
  BossLockdownSegmentDefinition,
  ExtractionZone,
  HoldZoneDefinition,
  Interactable,
  JumpPad,
  LevelDefinition,
  OptionalObjectiveDefinition,
  SpawnPoint,
  WeaponPickupDefinition,
} from "./types";
import { getWeaponDefinition } from "./weapons";
import {
  SurfaceTextureSet,
  createDustSpriteTexture,
  createFloorTexture,
  createSkyEnvironmentTexture,
  createStructureTexture,
  createWallTexture,
} from "./textures";

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
  updateDust: (time: number) => void;
}

type PickupOccupiedArea =
  | THREE.Vector3
  | {
      position: THREE.Vector3;
      radius: number;
    };

const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_PICKUP_CLEARANCE = 1.35;
const INTERACTABLE_CLEARANCE = 1.05;
const INTERACTABLE_OCCUPANCY_RADIUS = 1.15;
const HOLD_ZONE_MARGIN = 0.85;
const EXTRACTION_MARGIN = 0.85;
const JUMP_PAD_MARGIN = 0.7;
const OPTIONAL_OBJECTIVE_MARGIN = 0.85;

function createBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: number,
  textures?: SurfaceTextureSet,
  materialOverrides?: Partial<THREE.MeshPhysicalMaterialParameters>
): ArenaCollider {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.76,
    metalness: 0.18,
    bumpScale: 0.08,
    envMapIntensity: 0.42,
    ...(textures
      ? {
          map: textures.map,
          bumpMap: textures.bumpMap,
          roughnessMap: textures.roughnessMap,
        }
      : {}),
    ...materialOverrides,
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

export function createBossLockdownSegment(
  parent: THREE.Object3D,
  def: BossLockdownSegmentDefinition
): ArenaCollider {
  return createBox(
    parent,
    def.size.x,
    def.size.y,
    def.size.z,
    def.position.x,
    def.position.y - def.size.y / 2,
    def.position.z,
    def.color,
    undefined,
    {
      transparent: true,
      opacity: 0.7,
      emissive: def.color,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.38,
      clearcoat: 0.52,
      clearcoatRoughness: 0.2,
    }
  );
}

function addPerimeterGlow(
  parent: THREE.Object3D,
  halfX: number,
  halfZ: number,
  wallHeight: number
): void {
  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a3344,
    roughness: 0.44,
    metalness: 0.72,
  });
  const stripMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8d7ff,
    emissive: 0x6aa6ff,
    emissiveIntensity: 1.3,
    roughness: 0.28,
    metalness: 0.22,
  });

  const positions = [
    new THREE.Vector3(-halfX + 1.3, wallHeight * 0.44, -halfZ + 1.3),
    new THREE.Vector3(halfX - 1.3, wallHeight * 0.44, -halfZ + 1.3),
    new THREE.Vector3(-halfX + 1.3, wallHeight * 0.44, halfZ - 1.3),
    new THREE.Vector3(halfX - 1.3, wallHeight * 0.44, halfZ - 1.3),
  ];

  for (const position of positions) {
    const group = new THREE.Group();
    group.position.copy(position);

    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.8, 0.3),
      pylonMaterial
    );
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.2, 0.08),
      stripMaterial
    );
    strip.position.z = 0.17;

    const light = new THREE.PointLight(0x6ea7ff, 0.95, 14, 2);
    light.position.set(0, 0.22, 0.45);

    pylon.castShadow = true;
    pylon.receiveShadow = true;
    group.add(pylon, strip, light);
    parent.add(group);
  }
}

function addDustField(parent: THREE.Object3D, floorSize: THREE.Vector2): (time: number) => void {
  const count = 120;
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const rand = (() => {
    let seed = 901;
    return () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };
  })();

  for (let i = 0; i < count; i++) {
    const x = (rand() - 0.5) * floorSize.x;
    const y = 0.8 + rand() * 4.2;
    const z = (rand() - 0.5) * floorSize.y;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = y;
    basePositions[i * 3 + 2] = z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    map: createDustSpriteTexture(),
    color: 0xcfe4ff,
    size: 0.24,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const dust = new THREE.Points(geometry, material);
  dust.position.y = 0.15;
  parent.add(dust);

  return (time: number) => {
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const offset = i * 0.73;
      posAttr.setXYZ(
        i,
        basePositions[i * 3] + Math.sin(time * 0.3 + offset) * 0.15,
        basePositions[i * 3 + 1] + Math.sin(time * 0.2 + offset * 1.3) * 0.08,
        basePositions[i * 3 + 2] + Math.cos(time * 0.25 + offset * 0.7) * 0.12
      );
    }
    posAttr.needsUpdate = true;
  };
}

export function buildArena(scene: THREE.Scene, level: LevelDefinition): Arena {
  const root = new THREE.Group();
  root.name = `arena-${level.id}`;
  scene.add(root);

  const skyTexture = createSkyEnvironmentTexture(level.backgroundColor);
  scene.background = skyTexture;
  scene.environment = skyTexture;
  scene.fog = new THREE.Fog(0x101a29, 18, level.fogFar + 10);

  const colliders: ArenaCollider[] = [];
  const wallMeshes: THREE.Mesh[] = [];

  const floorGeo = new THREE.PlaneGeometry(level.floorSize.x, level.floorSize.y);
  const floorTex = createFloorTexture(level.floorColor);
  const tileScale = Math.max(level.floorSize.x, level.floorSize.y) / 8;
  floorTex.map.repeat.set(tileScale, tileScale);
  floorTex.bumpMap.repeat.set(tileScale, tileScale);
  floorTex.roughnessMap.repeat.set(tileScale, tileScale);
  const floorMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    roughnessMap: floorTex.roughnessMap,
    roughness: 0.9,
    metalness: 0.08,
    bumpScale: 0.08,
    clearcoat: 0.12,
    clearcoatRoughness: 0.58,
    envMapIntensity: 0.58,
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
  wallTex.map.repeat.set(2, 1);
  wallTex.bumpMap.repeat.set(2, 1);
  wallTex.roughnessMap.repeat.set(2, 1);
  for (const def of boundaryWalls) {
    const wall = createBox(root, def.w, def.h, def.d, def.x, 0, def.z, 0xffffff, wallTex, {
      roughness: 0.56,
      metalness: 0.2,
      bumpScale: 0.06,
      clearcoat: 0.08,
      clearcoatRoughness: 0.72,
      envMapIntensity: 0.52,
    });
    colliders.push(wall);
    wallMeshes.push(wall.mesh);
  }

  for (let si = 0; si < level.structures.length; si++) {
    const structure = level.structures[si];
    const structTex = createStructureTexture(structure.color, si * 37);
    const repeatX = Math.max(1, Math.round(Math.max(structure.size.x, structure.size.z) / 3));
    const repeatY = Math.max(1, Math.round(structure.size.y / 2));
    structTex.map.repeat.set(
      repeatX,
      repeatY
    );
    structTex.bumpMap.repeat.set(
      repeatX,
      repeatY
    );
    structTex.roughnessMap.repeat.set(
      repeatX,
      repeatY
    );
    const collider = createBox(
      root,
      structure.size.x,
      structure.size.y,
      structure.size.z,
      structure.position.x,
      structure.position.y,
      structure.position.z,
      0xffffff,
      structTex,
      {
        roughness: 0.62,
        metalness: structure.role === "platform" ? 0.32 : 0.18,
        bumpScale: structure.role === "platform" ? 0.085 : 0.06,
        clearcoat: structure.role === "platform" ? 0.14 : 0.05,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.48,
      }
    );
    colliders.push(collider);
    wallMeshes.push(collider.mesh);
  }

  addPerimeterGlow(root, halfX, halfZ, wallHeight);
  const updateDust = addDustField(root, level.floorSize);

  const hemiLight = new THREE.HemisphereLight(0x89aaf8, 0x162033, 0.92);
  root.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xe6f1ff, 1.7);
  dirLight.position.set(14, 18, 9);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -28;
  dirLight.shadow.camera.right = 28;
  dirLight.shadow.camera.top = 28;
  dirLight.shadow.camera.bottom = -28;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.bias = -0.00015;
  dirLight.shadow.normalBias = 0.035;
  root.add(dirLight);

  const accentLightA = new THREE.PointLight(0x2f7fff, 1.55, 32, 2);
  accentLightA.position.set(-halfX * 0.58, 3.8, -halfZ * 0.42);
  root.add(accentLightA);

  const accentLightB = new THREE.PointLight(0x4ee1ff, 1.2, 34, 2);
  accentLightB.position.set(halfX * 0.62, 3.6, halfZ * 0.4);
  root.add(accentLightB);

  const fillLight = new THREE.DirectionalLight(0xffc995, 0.38);
  fillLight.position.set(-8, 7, -10);
  root.add(fillLight);

  resolveArenaLayout(level, colliders);

  const interactables = level.interactables.map((def) =>
    createInteractableVisual(root, def)
  );
  const holdZones = level.holdZones.map((def) => createHoldZoneVisual(root, def));
  const jumpPads = level.jumpPads.map((def) => createJumpPadVisual(root, def));
  const weaponPickups = level.weaponPickups.map((def) =>
    createWeaponPickupVisual(root, def)
  );
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
    updateDust,
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

  let bestCandidate: THREE.Vector3 | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const gridStep = 0.75;

  for (let x = minX; x <= maxX; x += gridStep) {
    for (let z = minZ; z <= maxZ; z += gridStep) {
      const candidate = new THREE.Vector3(x, desiredPosition.y, z);
      if (
        !hasArenaClearance(candidate, colliders, clearance) ||
        !hasOccupiedClearance(candidate, occupiedPoints, clearance)
      ) {
        continue;
      }

      const distance = candidate.distanceToSquared(clampedOrigin);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = candidate;
      }
    }
  }

  return bestCandidate ?? clampedOrigin;
}

export function resolveArenaLayout(
  level: LevelDefinition,
  colliders: ArenaCollider[]
): void {
  const occupiedAreas: PickupOccupiedArea[] = [];

  for (const entry of level.interactables) {
    entry.position.copy(
      resolveArenaPickupPosition(
        entry.position,
        colliders,
        level.floorSize,
        occupiedAreas,
        INTERACTABLE_CLEARANCE
      )
    );
    occupiedAreas.push({
      position: entry.position.clone(),
      radius: INTERACTABLE_OCCUPANCY_RADIUS,
    });
  }

  for (const entry of level.holdZones) {
    entry.position.copy(
      resolveArenaPickupPosition(
        entry.position,
        colliders,
        level.floorSize,
        occupiedAreas,
        entry.radius + HOLD_ZONE_MARGIN
      )
    );
    occupiedAreas.push({
      position: entry.position.clone(),
      radius: entry.radius + HOLD_ZONE_MARGIN,
    });
  }

  level.extractionZone.position.copy(
    resolveArenaPickupPosition(
      level.extractionZone.position,
      colliders,
      level.floorSize,
      occupiedAreas,
      level.extractionZone.radius + EXTRACTION_MARGIN
    )
  );
  occupiedAreas.push({
    position: level.extractionZone.position.clone(),
    radius: level.extractionZone.radius + EXTRACTION_MARGIN,
  });

  for (const entry of level.jumpPads) {
    entry.position.copy(
      resolveArenaPickupPosition(
        entry.position,
        colliders,
        level.floorSize,
        occupiedAreas,
        entry.radius + JUMP_PAD_MARGIN
      )
    );
    occupiedAreas.push({
      position: entry.position.clone(),
      radius: entry.radius + JUMP_PAD_MARGIN,
    });
  }

  for (const entry of level.weaponPickups) {
    entry.position.copy(
      resolveArenaPickupPosition(
        entry.position,
        colliders,
        level.floorSize,
        occupiedAreas,
        DEFAULT_PICKUP_CLEARANCE
      )
    );
    occupiedAreas.push({
      position: entry.position.clone(),
      radius: DEFAULT_PICKUP_CLEARANCE,
    });
  }

  for (const entry of level.optionalObjectives) {
    resolveOptionalObjectivePosition(entry, level, colliders, occupiedAreas);
    occupiedAreas.push({
      position: entry.position.clone(),
      radius: entry.radius + OPTIONAL_OBJECTIVE_MARGIN,
    });
  }
}

function resolveOptionalObjectivePosition(
  objective: OptionalObjectiveDefinition,
  level: LevelDefinition,
  colliders: ArenaCollider[],
  occupiedAreas: PickupOccupiedArea[]
): void {
  objective.position.copy(
    resolveArenaPickupPosition(
      objective.position,
      colliders,
      level.floorSize,
      occupiedAreas,
      objective.radius + OPTIONAL_OBJECTIVE_MARGIN
    )
  );
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
