"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CLASS_PRESETS,
  getClassUpgradeName,
  getClassWeaponName,
  type ClassPreset,
  type ClassPresetId,
} from "@/game/classes";

interface ClassPreviewStageProps {
  presetId: ClassPresetId;
}

type PreviewBlueprint = {
  callSign: string;
  specialty: string;
  primary: number;
  secondary: number;
  accent: number;
  glow: number;
  visor: number;
  chestScale: [number, number, number];
  shoulderScale: [number, number, number];
  backpackScale: [number, number, number];
  weapon: {
    length: number;
    thickness: number;
    stock: number;
    barrel: number;
    muzzle: number;
  };
  accessory: "standard" | "shield" | "antenna" | "fins" | "payload" | "halo";
  orbitRadius: number;
  pose: {
    bodyTilt: number;
    leftArmX: number;
    leftArmZ: number;
    rightArmX: number;
    rightArmZ: number;
  };
};

const PRESET_BY_ID = new Map(CLASS_PRESETS.map((preset) => [preset.id, preset]));

const PREVIEW_BLUEPRINTS: Record<ClassPresetId, PreviewBlueprint> = {
  recruit: {
    callSign: "Baseline chassis",
    specialty: "Balanced starter rig with a clean standard carbine profile.",
    primary: 0x5d7995,
    secondary: 0x1d2b3d,
    accent: 0x89d8ff,
    glow: 0x4ec8ff,
    visor: 0xcff7ff,
    chestScale: [1, 1, 1],
    shoulderScale: [1, 1, 1],
    backpackScale: [1, 1, 1],
    weapon: {
      length: 1,
      thickness: 1,
      stock: 1,
      barrel: 1,
      muzzle: 1,
    },
    accessory: "standard",
    orbitRadius: 1.55,
    pose: {
      bodyTilt: -0.04,
      leftArmX: -0.35,
      leftArmZ: 0.18,
      rightArmX: -0.92,
      rightArmZ: -0.18,
    },
  },
  assault: {
    callSign: "Pressure frame",
    specialty: "Bulked shoulders and a hotter core tuned for sustained fire.",
    primary: 0x567ab8,
    secondary: 0x17253b,
    accent: 0xffb14c,
    glow: 0xff8b38,
    visor: 0xdaf2ff,
    chestScale: [1.15, 1.08, 1.08],
    shoulderScale: [1.32, 1.2, 1.28],
    backpackScale: [1.1, 1.15, 1.1],
    weapon: {
      length: 1.12,
      thickness: 1.14,
      stock: 1.12,
      barrel: 0.94,
      muzzle: 1.08,
    },
    accessory: "shield",
    orbitRadius: 1.72,
    pose: {
      bodyTilt: -0.08,
      leftArmX: -0.48,
      leftArmZ: 0.28,
      rightArmX: -1.05,
      rightArmZ: -0.2,
    },
  },
  recon: {
    callSign: "Specter sightline",
    specialty: "Long silhouette with a sensor mast and surgical rifle reach.",
    primary: 0x4b667d,
    secondary: 0x122031,
    accent: 0x83efff,
    glow: 0x70d8ff,
    visor: 0xe4fdff,
    chestScale: [0.88, 0.98, 0.88],
    shoulderScale: [0.86, 0.9, 0.9],
    backpackScale: [0.92, 1.18, 0.86],
    weapon: {
      length: 1.55,
      thickness: 0.82,
      stock: 1.05,
      barrel: 1.35,
      muzzle: 0.86,
    },
    accessory: "antenna",
    orbitRadius: 1.9,
    pose: {
      bodyTilt: 0.02,
      leftArmX: -0.24,
      leftArmZ: 0.1,
      rightArmX: -0.84,
      rightArmZ: -0.14,
    },
  },
  breacher: {
    callSign: "Shock entry rig",
    specialty: "Forward-leaning breach frame with compact blast profile.",
    primary: 0x4d7671,
    secondary: 0x17272a,
    accent: 0xffbf66,
    glow: 0xff9650,
    visor: 0xf1fff7,
    chestScale: [1.08, 0.94, 1.16],
    shoulderScale: [1.12, 0.98, 1.12],
    backpackScale: [0.92, 0.96, 1.32],
    weapon: {
      length: 0.82,
      thickness: 1.24,
      stock: 0.9,
      barrel: 0.72,
      muzzle: 1.14,
    },
    accessory: "fins",
    orbitRadius: 1.48,
    pose: {
      bodyTilt: -0.14,
      leftArmX: -0.62,
      leftArmZ: 0.32,
      rightArmX: -1.18,
      rightArmZ: -0.28,
    },
  },
  demolitionist: {
    callSign: "Payload carrier",
    specialty: "Heavy launcher geometry backed by unstable charge canisters.",
    primary: 0x716b57,
    secondary: 0x241d19,
    accent: 0xff8a4d,
    glow: 0xff5a36,
    visor: 0xffead8,
    chestScale: [1.22, 1.12, 1.2],
    shoulderScale: [1.22, 1.08, 1.18],
    backpackScale: [1.2, 1.28, 1.28],
    weapon: {
      length: 1.08,
      thickness: 1.36,
      stock: 1.04,
      barrel: 0.88,
      muzzle: 1.36,
    },
    accessory: "payload",
    orbitRadius: 1.84,
    pose: {
      bodyTilt: -0.12,
      leftArmX: -0.58,
      leftArmZ: 0.26,
      rightArmX: -1.12,
      rightArmZ: -0.22,
    },
  },
  operator: {
    callSign: "Command lattice",
    specialty: "Fast tactical frame with a hovering command halo and burst rifle.",
    primary: 0x416a80,
    secondary: 0x142232,
    accent: 0xa5f06a,
    glow: 0x6de0c8,
    visor: 0xe1fff3,
    chestScale: [0.98, 1.02, 1.02],
    shoulderScale: [1, 1, 1],
    backpackScale: [1.02, 1.08, 1.04],
    weapon: {
      length: 1.12,
      thickness: 0.96,
      stock: 1,
      barrel: 1.02,
      muzzle: 0.96,
    },
    accessory: "halo",
    orbitRadius: 2.02,
    pose: {
      bodyTilt: -0.05,
      leftArmX: -0.42,
      leftArmZ: 0.2,
      rightArmX: -0.96,
      rightArmZ: -0.16,
    },
  },
};

type Rig = {
  root: THREE.Group;
  avatarPivot: THREE.Group;
  body: THREE.Group;
  chest: THREE.Mesh;
  chestCore: THREE.Mesh;
  visor: THREE.Mesh;
  shoulders: [THREE.Mesh, THREE.Mesh];
  backpack: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  weaponBody: THREE.Mesh;
  weaponBarrel: THREE.Mesh;
  weaponMuzzle: THREE.Mesh;
  weaponStock: THREE.Mesh;
  orbiters: THREE.Mesh[];
  baseRing: THREE.Mesh;
  baseCore: THREE.Mesh;
  standardBlades: THREE.Mesh[];
  shield: THREE.Group;
  antenna: THREE.Group;
  fins: THREE.Mesh[];
  payloadPods: THREE.Mesh[];
  halo: THREE.Mesh;
  primaryMaterial: THREE.MeshStandardMaterial;
  secondaryMaterial: THREE.MeshStandardMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  glowMaterial: THREE.MeshStandardMaterial;
  visorMaterial: THREE.MeshStandardMaterial;
};

function createMaterial(color: number, emissive = 0x000000, intensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.34,
    metalness: 0.48,
  });
}

function setShadowRecursive(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function createOrbiters(material: THREE.MeshStandardMaterial): THREE.Mesh[] {
  return Array.from({ length: 3 }, (_, index) => {
    const orbiter = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), material);
    orbiter.rotation.set(index * 0.4, index * 0.7, index * 0.3);
    orbiter.castShadow = true;
    orbiter.receiveShadow = true;
    return orbiter;
  });
}

function createRig(): Rig {
  const root = new THREE.Group();
  const avatarPivot = new THREE.Group();
  const body = new THREE.Group();
  root.add(avatarPivot);
  avatarPivot.add(body);
  body.position.y = 0.48;

  const primaryMaterial = createMaterial(0x567089);
  const secondaryMaterial = createMaterial(0x132130);
  const accentMaterial = createMaterial(0x86daff, 0x17486d, 0.34);
  const glowMaterial = createMaterial(0x66d8ff, 0x1c6189, 1.2);
  glowMaterial.transparent = true;
  glowMaterial.opacity = 0.96;
  const visorMaterial = createMaterial(0xe7ffff, 0x4ca9c7, 0.75);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.48, 0.7), primaryMaterial);
  pelvis.position.set(0, 0.62, 0);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.2, 0.92), primaryMaterial);
  chest.position.set(0, 1.44, 0);

  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.5, 1), accentMaterial);
  chestTrim.position.set(0, 1.42, 0.05);

  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), glowMaterial);
  chestCore.position.set(0, 1.34, 0.54);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.74, 0.78), secondaryMaterial);
  head.position.set(0, 2.38, 0);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.2, 0.12), visorMaterial);
  visor.position.set(0, 2.38, 0.42);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.22, 12), secondaryMaterial);
  neck.position.set(0, 2.0, 0);

  const shoulders: [THREE.Mesh, THREE.Mesh] = [
    new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.62), primaryMaterial),
    new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.62), primaryMaterial),
  ];
  shoulders[0].position.set(-0.94, 1.72, 0);
  shoulders[1].position.set(0.94, 1.72, 0);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-1.08, 1.58, 0.02);
  const leftUpperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.62, 6, 10),
    primaryMaterial
  );
  leftUpperArm.rotation.z = Math.PI / 2;
  leftUpperArm.position.set(-0.35, 0, 0);
  const leftForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.54, 6, 10),
    secondaryMaterial
  );
  leftForearm.rotation.z = Math.PI / 2;
  leftForearm.position.set(-0.88, -0.04, 0.06);
  const leftPalm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.18), accentMaterial);
  leftPalm.position.set(-1.26, -0.06, 0.08);
  leftArmPivot.add(leftUpperArm, leftForearm, leftPalm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(1.08, 1.56, 0.02);
  const rightUpperArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.62, 6, 10),
    primaryMaterial
  );
  rightUpperArm.rotation.z = Math.PI / 2;
  rightUpperArm.position.set(0.35, 0, 0);
  const rightForearm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.56, 6, 10),
    secondaryMaterial
  );
  rightForearm.rotation.z = Math.PI / 2;
  rightForearm.position.set(0.88, -0.08, 0.06);
  const rightPalm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.18), accentMaterial);
  rightPalm.position.set(1.26, -0.12, 0.08);
  rightArmPivot.add(rightUpperArm, rightForearm, rightPalm);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.88, 6, 10), primaryMaterial);
  leftLeg.position.set(-0.34, -0.18, 0);
  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.88, 6, 10), primaryMaterial);
  rightLeg.position.set(0.34, -0.18, 0);
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.58), secondaryMaterial);
  leftFoot.position.set(-0.34, -0.84, 0.12);
  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.58), secondaryMaterial);
  rightFoot.position.set(0.34, -0.84, 0.12);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.88, 0.4), secondaryMaterial);
  backpack.position.set(0, 1.42, -0.58);

  const weaponBody = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.22, 0.32), secondaryMaterial);
  weaponBody.position.set(1.36, 1.04, 0.34);
  weaponBody.rotation.set(0.14, 0.06, -0.18);
  const weaponBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.1), primaryMaterial);
  weaponBarrel.position.set(1.92, 1.04, 0.38);
  weaponBarrel.rotation.copy(weaponBody.rotation);
  const weaponMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 12), glowMaterial);
  weaponMuzzle.position.set(2.32, 1.03, 0.39);
  weaponMuzzle.rotation.set(Math.PI / 2, 0.04, -0.18);
  const weaponStock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.2), accentMaterial);
  weaponStock.position.set(0.92, 1.02, 0.28);
  weaponStock.rotation.copy(weaponBody.rotation);

  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.08, 10, 48),
    createMaterial(0xe06030, 0x702810, 0.8)
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -0.74;

  const baseCore = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 0.14, 20), glowMaterial);
  baseCore.position.set(0, -0.74, 0);

  const orbiters = createOrbiters(accentMaterial);
  for (const orbiter of orbiters) {
    root.add(orbiter);
  }

  const standardBlades = [-0.52, 0.52].map((x) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.86, 0.34), accentMaterial);
    blade.position.set(x, 1.42, -0.74);
    blade.rotation.set(0.3, 0, x < 0 ? 0.28 : -0.28);
    return blade;
  });

  const shield = new THREE.Group();
  const shieldRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.08, 6, 1, true),
    accentMaterial
  );
  shieldRing.rotation.z = Math.PI / 2;
  const shieldCore = new THREE.Mesh(new THREE.CircleGeometry(0.42, 6), glowMaterial);
  shieldCore.rotation.y = -Math.PI / 2;
  shieldCore.position.x = -0.03;
  shield.add(shieldRing, shieldCore);
  shield.position.set(-1.8, 1.02, 0.12);

  const antenna = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.96, 10), accentMaterial);
  mast.position.set(0.18, 2.98, -0.12);
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), glowMaterial);
  sensor.position.set(0.18, 3.48, -0.08);
  antenna.add(mast, sensor);

  const fins = [-0.44, 0.44].map((x) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.08, 0.62), accentMaterial);
    fin.position.set(x, 1.12, -0.82);
    fin.rotation.set(x < 0 ? 0.32 : -0.32, 0, x < 0 ? 0.14 : -0.14);
    return fin;
  });

  const payloadPods = [-0.54, 0, 0.54].map((x) => {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), glowMaterial);
    pod.position.set(x, 1, 0.58);
    return pod;
  });

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.04, 8, 40),
    createMaterial(0x92efbc, 0x2d8169, 0.95)
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.set(0, 3.02, 0);

  body.add(
    pelvis,
    chest,
    chestTrim,
    chestCore,
    neck,
    head,
    visor,
    shoulders[0],
    shoulders[1],
    leftArmPivot,
    rightArmPivot,
    leftLeg,
    rightLeg,
    leftFoot,
    rightFoot,
    backpack,
    weaponBody,
    weaponBarrel,
    weaponMuzzle,
    weaponStock,
    baseRing,
    baseCore,
    shield,
    antenna,
    halo,
    ...standardBlades,
    ...fins,
    ...payloadPods
  );

  setShadowRecursive(root);

  return {
    root,
    avatarPivot,
    body,
    chest,
    chestCore,
    visor,
    shoulders,
    backpack,
    leftArmPivot,
    rightArmPivot,
    weaponBody,
    weaponBarrel,
    weaponMuzzle,
    weaponStock,
    orbiters,
    baseRing,
    baseCore,
    standardBlades,
    shield,
    antenna,
    fins,
    payloadPods,
    halo,
    primaryMaterial,
    secondaryMaterial,
    accentMaterial,
    glowMaterial,
    visorMaterial,
  };
}

function applyBlueprint(rig: Rig, blueprint: PreviewBlueprint): void {
  rig.primaryMaterial.color.setHex(blueprint.primary);
  rig.secondaryMaterial.color.setHex(blueprint.secondary);
  rig.accentMaterial.color.setHex(blueprint.accent);
  rig.accentMaterial.emissive.setHex(blueprint.accent);
  rig.glowMaterial.color.setHex(blueprint.glow);
  rig.glowMaterial.emissive.setHex(blueprint.glow);
  rig.visorMaterial.color.setHex(blueprint.visor);
  rig.visorMaterial.emissive.setHex(blueprint.accent);

  rig.chest.scale.set(...blueprint.chestScale);
  rig.chestCore.scale.setScalar(0.9 + (blueprint.orbitRadius - 1.4) * 0.18);
  rig.shoulders[0].scale.set(...blueprint.shoulderScale);
  rig.shoulders[1].scale.set(...blueprint.shoulderScale);
  rig.backpack.scale.set(...blueprint.backpackScale);

  rig.weaponBody.scale.set(blueprint.weapon.length, blueprint.weapon.thickness, 1);
  rig.weaponBarrel.scale.set(blueprint.weapon.barrel, 1, 1);
  rig.weaponMuzzle.scale.setScalar(blueprint.weapon.muzzle);
  rig.weaponStock.scale.set(blueprint.weapon.stock, 1, 1);
  rig.weaponBarrel.position.x = 1.72 + blueprint.weapon.length * 0.42;
  rig.weaponMuzzle.position.x = 1.98 + blueprint.weapon.length * 0.62;
  rig.weaponStock.position.x = 0.98 + (blueprint.weapon.stock - 1) * 0.18;

  rig.body.rotation.z = blueprint.pose.bodyTilt;
  rig.leftArmPivot.rotation.set(blueprint.pose.leftArmX, 0, blueprint.pose.leftArmZ);
  rig.rightArmPivot.rotation.set(blueprint.pose.rightArmX, 0.06, blueprint.pose.rightArmZ);

  rig.standardBlades.forEach((blade) => {
    blade.visible = blueprint.accessory === "standard";
  });
  rig.shield.visible = blueprint.accessory === "shield";
  rig.antenna.visible = blueprint.accessory === "antenna";
  rig.fins.forEach((fin) => {
    fin.visible = blueprint.accessory === "fins";
  });
  rig.payloadPods.forEach((pod) => {
    pod.visible = blueprint.accessory === "payload";
  });
  rig.halo.visible = blueprint.accessory === "halo";
}

class PreviewScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private readonly resizeObserver: ResizeObserver;
  private readonly rig = createRig();
  private readonly keyLight = new THREE.SpotLight(0xdff4ff, 5.8, 30, 0.58, 0.55, 1.4);
  private readonly fillLight = new THREE.PointLight(0xe06030, 2.6, 18, 2);
  private readonly rimLight = new THREE.PointLight(0xff9452, 2.1, 16, 2);
  private readonly target = new THREE.Object3D();
  private activeBlueprint: PreviewBlueprint;
  private animationFrame = 0;
  private lastTime = 0;
  private elapsed = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    presetId: ClassPresetId
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.fog = new THREE.FogExp2(0x100e0b, 0.085);
    this.camera.position.set(0, 1.5, 7.4);
    this.camera.lookAt(0, 1.35, 0);

    const ambient = new THREE.AmbientLight(0xd0c0a0, 1.6);
    this.scene.add(ambient);

    this.keyLight.position.set(4.2, 6.4, 6.2);
    this.keyLight.target = this.target;
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.fillLight.position.set(-4.4, 2.4, 5.6);
    this.rimLight.position.set(-2.8, 3.8, -4.6);
    this.target.position.set(0, 1.24, 0);

    const overheadHalo = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.04, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xe06030,
        transparent: true,
        opacity: 0.18,
      })
    );
    overheadHalo.rotation.x = Math.PI / 2;
    overheadHalo.position.set(0, 2.96, 0);

    const backdrop = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 48),
      new THREE.MeshBasicMaterial({
        color: 0x1e1a14,
        transparent: true,
        opacity: 0.38,
      })
    );
    backdrop.position.set(0, 1.06, -2.6);

    this.scene.add(
      this.rig.root,
      overheadHalo,
      backdrop,
      this.keyLight,
      this.fillLight,
      this.rimLight,
      this.target
    );

    this.activeBlueprint = PREVIEW_BLUEPRINTS[presetId];
    applyBlueprint(this.rig, this.activeBlueprint);
    this.updateSize();

    this.resizeObserver = new ResizeObserver(() => {
      this.updateSize();
    });
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
  }

  setPreset(presetId: ClassPresetId): void {
    this.activeBlueprint = PREVIEW_BLUEPRINTS[presetId];
    applyBlueprint(this.rig, this.activeBlueprint);
  }

  start(): void {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  dispose(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }
    this.resizeObserver.disconnect();
    this.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
        return;
      }
      child.material.dispose();
    });
    this.renderer.dispose();
    this.scene.clear();
  }

  private tick = (now: number): void => {
    this.animationFrame = window.requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsed += dt;
    this.update();
    this.renderer.render(this.scene, this.camera);
  };

  private update(): void {
    const hoverBob = Math.sin(this.elapsed * 1.45);
    const accentPulse = Math.sin(this.elapsed * 2.2) * 0.18 + 0.82;
    const orbitLift = Math.cos(this.elapsed * 1.3) * 0.08;

    this.rig.avatarPivot.position.y = hoverBob * 0.1 + 0.08;
    this.rig.avatarPivot.rotation.y = Math.sin(this.elapsed * 0.32) * 0.42;
    this.rig.avatarPivot.rotation.x = Math.cos(this.elapsed * 0.32) * 0.04;
    this.rig.chestCore.rotation.y += 0.03;
    this.rig.baseRing.rotation.z += 0.01;
    this.rig.baseCore.scale.y = 0.86 + accentPulse * 0.12;
    this.rig.glowMaterial.emissiveIntensity = 1 + accentPulse * 0.5;
    this.rig.visorMaterial.emissiveIntensity = 0.75 + accentPulse * 0.25;

    if (this.rig.halo.visible) {
      this.rig.halo.rotation.z = this.elapsed * 0.9;
    }

    this.rig.payloadPods.forEach((pod, index) => {
      if (!pod.visible) return;
      pod.position.y = 1 + Math.sin(this.elapsed * 2 + index * 0.5) * 0.08;
    });

    this.rig.fins.forEach((fin, index) => {
      if (!fin.visible) return;
      fin.rotation.y = Math.sin(this.elapsed * 1.2 + index * 0.7) * 0.16;
    });

    this.rig.orbiters.forEach((orbiter, index) => {
      const angle = this.elapsed * 0.82 + index * ((Math.PI * 2) / this.rig.orbiters.length);
      orbiter.position.set(
        Math.cos(angle) * this.activeBlueprint.orbitRadius,
        1.18 + Math.sin(angle * 1.8) * 0.22 + orbitLift,
        Math.sin(angle) * this.activeBlueprint.orbitRadius * 0.42
      );
      orbiter.rotation.x += 0.02;
      orbiter.rotation.y += 0.03;
    });

    this.camera.position.x = Math.sin(this.elapsed * 0.35) * 0.24;
    this.camera.position.y = 1.5 + Math.cos(this.elapsed * 0.42) * 0.1;
    this.camera.lookAt(0, 1.35, 0);
  }

  private updateSize(): void {
    const host = this.canvas.parentElement ?? this.canvas;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function getPreset(id: ClassPresetId): ClassPreset {
  return PRESET_BY_ID.get(id) ?? CLASS_PRESETS[0];
}

export function ClassPreviewStage({ presetId }: ClassPreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PreviewScene | null>(null);
  const initialPresetIdRef = useRef(presetId);
  const preset = getPreset(presetId);
  const blueprint = PREVIEW_BLUEPRINTS[presetId];
  const upgradeName = getClassUpgradeName(preset);
  const weaponName = getClassWeaponName(preset);

  useEffect(() => {
    if (!canvasRef.current) return;
    const previewScene = new PreviewScene(canvasRef.current, initialPresetIdRef.current);
    sceneRef.current = previewScene;
    previewScene.start();

    return () => {
      previewScene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setPreset(presetId);
  }, [presetId]);

  return (
    <div className="tac-panel relative overflow-hidden border border-primary/22 bg-background/42">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(224,96,48,0.14),transparent_30%),radial-gradient(circle_at_50%_70%,rgba(160,120,80,0.14),transparent_52%),linear-gradient(180deg,rgba(16,14,11,0.08),rgba(16,14,11,0.42))]" />
      <div className="absolute inset-x-[14%] top-6 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="relative grid h-full grid-rows-[min-content_1fr_min-content] p-4 sm:p-5 lg:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="tac-fade-in flex flex-col gap-1" style={{ animationDelay: "180ms" }}>
            <span className="font-mono text-[0.52rem] uppercase tracking-[0.42em] text-primary/40">
              Live Hover Preview
            </span>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold uppercase tracking-[0.28em] text-primary/92 sm:text-xl">
                {preset.name}
              </span>
              <span className="tac-chip px-2.5 py-0.5 text-[0.5rem] tracking-[0.32em]">
                {blueprint.callSign}
              </span>
            </div>
          </div>
          <div
            className="tac-fade-in hidden items-end gap-3 sm:flex"
            style={{ animationDelay: "220ms" }}
          >
            <div className="text-right">
              <div className="font-mono text-[0.5rem] uppercase tracking-[0.36em] text-primary/36">
                Specialty
              </div>
              <div className="max-w-[15rem] text-[0.62rem] uppercase tracking-[0.18em] text-primary/74">
                {blueprint.specialty}
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-[12rem] sm:min-h-[14rem]">
          <div className="absolute inset-0 mx-auto w-full max-w-[34rem]">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 h-28 w-[72%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle,rgba(224,96,48,0.12),transparent_62%)] blur-3xl" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.95fr)]">
          <div className="border border-primary/12 bg-background/30 p-3">
            <div className="font-mono text-[0.5rem] uppercase tracking-[0.34em] text-primary/34">
              Profile
            </div>
            <p className="mt-2 text-sm leading-relaxed text-primary/80 sm:text-[0.7rem]">
              {preset.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-primary/12 bg-background/30 p-3">
              <div className="font-mono text-[0.5rem] uppercase tracking-[0.34em] text-primary/34">
                Weapon
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-primary/84">
                {weaponName}
              </div>
            </div>
            <div className="border border-primary/12 bg-background/30 p-3">
              <div className="font-mono text-[0.5rem] uppercase tracking-[0.34em] text-primary/34">
                Upgrade
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-primary/84">
                {upgradeName ?? "Standard Loadout"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
