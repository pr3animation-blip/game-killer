import * as THREE from "three";
import { buildArena, Arena } from "./arena";
import { Bot } from "./bot";
import { LEVEL_DEFINITIONS } from "./levels";
import { PhysicsBody } from "./physics";
import { GameRenderer } from "./renderer";
import { SpawnPoint } from "./types";

const CAMERA_LOOP_DURATION = 8.5;
const MENU_PATROL_ROUTE = [
  new THREE.Vector3(9.8, 0.12, -2.4),
  new THREE.Vector3(11.6, 0.12, -2),
  new THREE.Vector3(10.9, 0.12, -4.1),
  new THREE.Vector3(9.4, 0.12, -3.5),
];
const MENU_PATROL_SPAWN: SpawnPoint = {
  position: MENU_PATROL_ROUTE[0].clone(),
  rotation: -2.8,
};

type FallenArmRig = {
  root: THREE.Group;
  armTube: THREE.Mesh;
  hand: THREE.Mesh;
  fingerSegments: THREE.Mesh[];
  droppedSidearm: THREE.Mesh;
};

function setMeshShadows(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function createFallenArmRig(): FallenArmRig {
  const root = new THREE.Group();
  root.position.set(1.62, -1.07, -2.06);
  root.rotation.set(0.07, -0.05, -0.26);

  const sleeveMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d536f,
    roughness: 0.64,
    metalness: 0.14,
  });
  const gloveMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2127,
    roughness: 0.72,
    metalness: 0.08,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x8ec7ff,
    emissive: 0x1f5086,
    emissiveIntensity: 0.24,
    roughness: 0.36,
    metalness: 0.22,
  });

  const shoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.22, 0.56),
    sleeveMaterial
  );
  shoulder.position.set(0.22, 0.04, 0.08);
  shoulder.rotation.set(0.06, -0.2, 0.12);

  const shoulderPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.07, 0.28),
    accentMaterial
  );
  shoulderPlate.position.set(0.28, 0.11, 0.12);
  shoulderPlate.rotation.set(0.1, -0.22, 0.08);

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.24, 0.08, 0.08),
    new THREE.Vector3(-0.22, 0.075, -0.14),
    new THREE.Vector3(-0.92, 0.07, -0.42),
    new THREE.Vector3(-1.56, 0.065, -0.64),
  ]);
  const armTube = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 28, 0.15, 10, false),
    sleeveMaterial
  );

  const elbowGuard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.08, 0.18),
    accentMaterial
  );
  elbowGuard.position.set(-0.74, 0.12, -0.34);
  elbowGuard.rotation.set(0.08, -0.18, 0.02);

  const wristBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.09, 0.24),
    accentMaterial
  );
  wristBand.position.set(-1.42, 0.12, -0.58);
  wristBand.rotation.set(0.04, -0.16, 0.02);

  const hand = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.08, 0.28),
    gloveMaterial
  );
  hand.position.set(-1.72, 0.12, -0.7);
  hand.rotation.set(0.06, -0.2, 0.02);

  const thumb = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.055, 0.1),
    gloveMaterial
  );
  thumb.position.set(-1.63, 0.13, -0.54);
  thumb.rotation.set(0.12, -0.08, 0.48);

  const fingerSegments: THREE.Mesh[] = [];
  const fingerOffsets = [-0.09, -0.03, 0.03, 0.09];
  for (const offset of fingerOffsets) {
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.045, 0.045),
      gloveMaterial
    );
    finger.position.set(-1.94, 0.11, -0.7 + offset);
    finger.rotation.set(0.04, -0.18, THREE.MathUtils.degToRad(4));
    fingerSegments.push(finger);
  }

  const droppedSidearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.12, 0.58),
    new THREE.MeshStandardMaterial({
      color: 0x151a24,
      roughness: 0.38,
      metalness: 0.64,
    })
  );
  droppedSidearm.position.set(-1.18, 0.04, -0.12);
  droppedSidearm.rotation.set(0.02, -0.74, 0.04);

  const sidearmGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.03, 0.1),
    accentMaterial
  );
  sidearmGlow.position.set(-1.12, 0.09, 0.04);
  sidearmGlow.rotation.copy(droppedSidearm.rotation);

  root.add(
    shoulder,
    shoulderPlate,
    armTube,
    elbowGuard,
    wristBand,
    hand,
    thumb,
    droppedSidearm,
    sidearmGlow,
    ...fingerSegments
  );

  setMeshShadows(root);

  return {
    root,
    armTube,
    hand,
    fingerSegments,
    droppedSidearm,
  };
}

export class MenuScene {
  private readonly renderer: GameRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly arena: Arena;
  private readonly resizeObserver: ResizeObserver;
  private readonly patrolBot: Bot;
  private readonly fallenArm: FallenArmRig;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly idlePlayer = new PhysicsBody(new THREE.Vector3(999, 0, 999));
  private readonly enemyRimLight = new THREE.PointLight(0xe06030, 2.4, 22, 2);
  private readonly enemyFillLight = new THREE.SpotLight(0xffcca2, 1.45, 24, 0.56, 0.7, 1.2);
  private readonly enemyFillTarget = new THREE.Object3D();
  private patrolBiasIndex = 1;

  private running = false;
  private animationId = 0;
  private lastTime = 0;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.renderer = new GameRenderer(canvas);
    this.renderer.renderer.toneMappingExposure = 1.05;
    this.arena = buildArena(this.scene, LEVEL_DEFINITIONS["relay-loop"]);
    this.camera = new THREE.PerspectiveCamera(
      44,
      Math.max(canvas.clientWidth / Math.max(canvas.clientHeight, 1), 1),
      0.08,
      1000
    );
    this.camera.rotation.order = "YXZ";

    this.stageArena();
    this.patrolBot = new Bot(
      "menu-patrol",
      MENU_PATROL_SPAWN,
      MENU_PATROL_ROUTE,
      this.scene,
      "anchor",
      false
    );
    this.patrolBot.mesh.scale.setScalar(1.18);
    this.patrolBot.setObjectiveBias(MENU_PATROL_ROUTE[this.patrolBiasIndex]);
    this.fallenArm = createFallenArmRig();
    this.camera.add(this.fallenArm.root);
    this.addHeroLighting();
    this.scene.add(this.camera);

    this.resizeObserver = new ResizeObserver(() => {
      this.renderer.resize();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width > 0 && height > 0) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    });
    this.resizeObserver.observe(canvas.parentElement || canvas);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  dispose(): void {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }

    this.resizeObserver.disconnect();
    this.patrolBot.dispose();
    this.disposeScene();
    this.renderer.dispose();
  }

  private stageArena(): void {
    for (const wallMesh of this.arena.wallMeshes) {
      const { x, z } = wallMesh.position;
      wallMesh.visible = z < -6 || x > 16 || x < -16;
    }

    for (const interactable of this.arena.interactables) {
      interactable.group.visible = false;
    }
    for (const holdZone of this.arena.holdZones) {
      holdZone.ring.visible = false;
      holdZone.beacon.visible = false;
      holdZone.label.visible = false;
    }
    for (const jumpPad of this.arena.jumpPads) {
      jumpPad.group.visible = false;
    }
    for (const pickup of this.arena.weaponPickups) {
      pickup.group.visible = false;
    }
    this.arena.extraction.group.visible = false;

    this.scene.background = new THREE.Color(0x100e0b);
    this.scene.fog = new THREE.Fog(0x100e0b, 12, 36);
  }

  private addHeroLighting(): void {
    const foregroundWarmLight = new THREE.PointLight(0xffbf88, 3.8, 12, 2);
    foregroundWarmLight.position.set(1.7, 0.45, -1.75);
    this.camera.add(foregroundWarmLight);

    const foregroundCoolFill = new THREE.PointLight(0x4b88cf, 1.4, 11, 2);
    foregroundCoolFill.position.set(-0.4, 1.1, -2.4);
    this.camera.add(foregroundCoolFill);

    this.enemyRimLight.position
      .copy(MENU_PATROL_SPAWN.position)
      .add(new THREE.Vector3(2.8, 4.6, -1.4));
    this.scene.add(this.enemyRimLight);

    this.enemyFillLight.position.set(6.2, 5.8, 2.6);
    this.enemyFillTarget.position
      .copy(MENU_PATROL_SPAWN.position)
      .add(new THREE.Vector3(0, 1.4, 0));
    this.enemyFillLight.target = this.enemyFillTarget;
    this.scene.add(this.enemyFillLight, this.enemyFillTarget);

    const hazeLight = new THREE.DirectionalLight(0xa09080, 0.55);
    hazeLight.position.set(-6, 8, 4);
    this.scene.add(hazeLight);
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    this.animationId = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    this.elapsed += dt;
    this.updateCamera();
    this.updateFallenArm();
    this.updatePatrolBot(dt);
  }

  private updateCamera(): void {
    const loop = (this.elapsed / CAMERA_LOOP_DURATION) * Math.PI * 2;
    const breath = Math.sin(loop);
    const sway = Math.cos(loop * 0.55);

    this.camera.position.set(
      -7.9 + sway * 0.4,
      0.68 + breath * 0.03,
      13.75 + breath * 0.18
    );

    this.cameraTarget.set(
      4.2 + Math.sin(loop * 0.6) * 0.16,
      1.32 + Math.cos(loop * 0.7) * 0.07,
      -4 + sway * 0.18
    );

    this.camera.lookAt(this.cameraTarget);
    this.camera.rotateZ(-0.055 + breath * 0.012);
  }

  private updateFallenArm(): void {
    const armLoop = this.elapsed * 0.72;
    this.fallenArm.root.position.set(
      1.62 + Math.sin(armLoop) * 0.02,
      -1.07 + Math.cos(armLoop * 0.8) * 0.01,
      -2.06 + Math.sin(armLoop * 0.5) * 0.02
    );
    this.fallenArm.root.rotation.set(
      0.07 + Math.sin(armLoop) * 0.004,
      -0.06 + Math.cos(armLoop * 0.7) * 0.006,
      -0.26 + Math.sin(armLoop * 0.6) * 0.008
    );
    this.fallenArm.hand.rotation.x = 0.06 + Math.sin(armLoop * 0.9) * 0.01;
    this.fallenArm.droppedSidearm.rotation.z = 0.04 + Math.cos(armLoop * 0.8) * 0.01;
    for (let i = 0; i < this.fallenArm.fingerSegments.length; i++) {
      const finger = this.fallenArm.fingerSegments[i];
      finger.rotation.x = 0.04 + Math.sin(armLoop + i * 0.35) * 0.008;
    }
  }

  private updatePatrolBot(dt: number): void {
    this.patrolBot.update(
      dt,
      this.idlePlayer,
      false,
      this.arena.colliders,
      this.arena.wallMeshes
    );

    const botPosition = this.patrolBot.mesh.position;
    if (botPosition.distanceTo(MENU_PATROL_ROUTE[this.patrolBiasIndex]) < 0.8) {
      this.patrolBiasIndex = (this.patrolBiasIndex + 1) % MENU_PATROL_ROUTE.length;
      this.patrolBot.setObjectiveBias(MENU_PATROL_ROUTE[this.patrolBiasIndex]);
    }
    this.enemyRimLight.position.copy(botPosition).add(new THREE.Vector3(2.8, 4.6, -1.4));
    this.enemyFillTarget.position.copy(botPosition).add(new THREE.Vector3(0, 1.35, 0));
  }

  private disposeScene(): void {
    this.scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      child.geometry.dispose();

      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          material.dispose();
        }
        return;
      }

      child.material.dispose();
    });

    this.scene.clear();
  }
}
