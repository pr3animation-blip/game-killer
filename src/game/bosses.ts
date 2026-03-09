import * as THREE from "three";
import { canOccupyBody, raycast, PhysicsBody } from "./physics";
import {
  ArenaCollider,
  BossEncounterDefinition,
  BossId,
  BossState,
  BossWeaponType,
} from "./types";

export interface BossAttackEvent {
  damage: number;
  point: THREE.Vector3;
}

export interface BossUpdateContext {
  dt: number;
  playerBody: PhysicsBody;
  playerAlive: boolean;
  colliders: ArenaCollider[];
  worldMeshes: THREE.Object3D[];
}

export interface BossActor {
  update(context: BossUpdateContext): BossAttackEvent[];
  takeDamage(amount: number): boolean;
  resetForRetry(): void;
  dispose(): void;
  getHitMeshes(): THREE.Object3D[];
  getState(): BossState;
  getPosition(): THREE.Vector3;
}

type ActiveTrace = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  lifetime: number;
};

type PendingImpact = {
  ring: THREE.Mesh;
  core: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  timer: number;
  damage: number;
};

type ActiveReturnSweep = {
  progress: number;
  duration: number;
  startAngle: number;
  endAngle: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const BOSS_COLLISION_HEIGHT = 3.4;
const BOSS_COLLISION_RADIUS = 0.9;
const BOSS_POSITION_SEARCH_RADII = [0, 1.2, 2.4, 3.6, 4.8, 6, 7.2, 8.8, 10.4];

function createInactiveBossState(
  id: BossId,
  name: string,
  weaponType: BossWeaponType,
  maxHealth: number,
  introText: string
): BossState {
  return {
    active: true,
    introActive: true,
    defeated: false,
    id,
    name,
    weaponType,
    health: maxHealth,
    maxHealth,
    phase: 1,
    telegraph: null,
    introText,
  };
}

abstract class BaseBossActor implements BossActor {
  protected readonly scene: THREE.Scene;
  protected readonly encounter: BossEncounterDefinition;
  protected readonly mesh = new THREE.Group();
  protected readonly head: THREE.Mesh;
  protected readonly leftArm: THREE.Mesh;
  protected readonly rightArm: THREE.Mesh;
  protected readonly weaponBody: THREE.Mesh;
  protected readonly weaponBarrel: THREE.Mesh;
  protected readonly accentMaterial: THREE.MeshStandardMaterial;
  protected readonly muzzleAnchor = new THREE.Object3D();
  protected readonly tempVector = new THREE.Vector3();
  protected readonly tempVectorB = new THREE.Vector3();
  protected readonly tempQuaternion = new THREE.Quaternion();
  protected readonly hitMeshes: THREE.Object3D[] = [];
  protected readonly desiredHardpoints: THREE.Vector3[];
  protected readonly state: BossState;
  protected readonly traces: ActiveTrace[] = [];
  protected readonly hardpoints: THREE.Vector3[];
  protected readonly resolvedSpawnPosition: THREE.Vector3;
  protected moveTargetIndex = 0;
  protected moveTimer = 0;
  protected attackCooldown = 1.4;
  protected introTimer = 2.2;
  protected damageTickTimer = 0;
  protected maxHealth: number;
  protected health: number;
  protected alive = true;
  private arenaPositionsResolved = false;

  constructor(
    scene: THREE.Scene,
    encounter: BossEncounterDefinition,
    colors: { body: number; armor: number; accent: number },
    hardpoints: THREE.Vector3[]
  ) {
    this.scene = scene;
    this.encounter = encounter;
    this.desiredHardpoints = hardpoints.map((point) => point.clone());
    this.hardpoints = this.desiredHardpoints.map((point) => point.clone());
    this.resolvedSpawnPosition = encounter.spawn.position.clone();
    this.maxHealth = encounter.health;
    this.health = encounter.health;
    this.state = createInactiveBossState(
      encounter.bossId,
      encounter.displayName,
      encounter.weaponType,
      encounter.health,
      encounter.introText
    );

    const bodyMat = new THREE.MeshStandardMaterial({
      color: colors.body,
      roughness: 0.42,
      metalness: 0.34,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: colors.armor,
      roughness: 0.58,
      metalness: 0.48,
    });
    this.accentMaterial = new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: colors.accent,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.25,
    });

    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.4, 0.8),
      armorMat
    );
    legs.position.y = 0.72;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.8, 1.1),
      bodyMat
    );
    torso.position.y = 2;

    const shoulderLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.52, 0.92),
      armorMat
    );
    shoulderLeft.position.set(-1.02, 2.62, 0);
    const shoulderRight = shoulderLeft.clone();
    shoulderRight.position.x = 1.02;

    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 16),
      this.accentMaterial
    );
    this.head.position.set(0, 3.15, 0.15);

    this.leftArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.86, 6, 12),
      bodyMat
    );
    this.leftArm.position.set(-0.84, 2.18, 0.28);
    this.leftArm.rotation.z = -0.25;
    this.leftArm.rotation.x = -0.4;

    this.rightArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 1.08, 6, 12),
      armorMat
    );
    this.rightArm.position.set(0.88, 2.1, 0.42);
    this.rightArm.rotation.z = 0.22;
    this.rightArm.rotation.x = -1.02;

    this.weaponBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 2),
      armorMat
    );
    this.weaponBody.position.set(0.78, 1.96, 1.2);
    this.weaponBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 1.7, 12),
      this.accentMaterial
    );
    this.weaponBarrel.rotation.x = Math.PI / 2;
    this.weaponBarrel.position.set(0.82, 2.04, 2.04);
    this.muzzleAnchor.position.set(0.82, 2.04, 2.9);

    const spineGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 1.1, 0.14),
      this.accentMaterial
    );
    spineGlow.position.set(0, 2, -0.54);

    this.mesh.add(
      legs,
      torso,
      shoulderLeft,
      shoulderRight,
      this.head,
      this.leftArm,
      this.rightArm,
      this.weaponBody,
      this.weaponBarrel,
      this.muzzleAnchor,
      spineGlow
    );
    this.mesh.position.copy(encounter.spawn.position);
    this.mesh.rotation.y = encounter.spawn.rotation;
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.__boss = true;
      this.hitMeshes.push(child);
    });
    this.head.userData.hitZone = "head";
    this.scene.add(this.mesh);
  }

  update(context: BossUpdateContext): BossAttackEvent[] {
    this.ensureArenaPositions(context.colliders);
    this.updateTraces(context.dt);
    if (!this.alive) return [];

    this.introTimer = Math.max(0, this.introTimer - context.dt);
    this.state.introActive = this.introTimer > 0;
    this.attackCooldown = Math.max(0, this.attackCooldown - context.dt);
    this.damageTickTimer = Math.max(0, this.damageTickTimer - context.dt);
    this.moveTimer = Math.max(0, this.moveTimer - context.dt);

    if (this.health <= this.maxHealth * this.getPhaseThreshold()) {
      this.state.phase = 2;
    }

    if (context.playerAlive) {
      this.facePlayer(context.playerBody.getEyePosition());
    }

    return this.performUpdate(context);
  }

  takeDamage(amount: number): boolean {
    if (!this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.state.health = this.health;
    if (this.health > 0) return false;
    this.alive = false;
    this.state.defeated = true;
    this.state.active = false;
    this.state.telegraph = null;
    this.mesh.visible = false;
    return true;
  }

  resetForRetry(): void {
    this.health = this.maxHealth;
    this.alive = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.encounter.spawn.position);
    this.mesh.rotation.y = this.encounter.spawn.rotation;
    this.attackCooldown = 1.4;
    this.introTimer = 0;
    this.moveTimer = 0;
    this.damageTickTimer = 0;
    this.state.active = true;
    this.state.defeated = false;
    this.state.health = this.maxHealth;
    this.state.phase = 1;
    this.state.telegraph = null;
    this.clearTransientVisuals();
    this.resetInternalState();
  }

  dispose(): void {
    this.clearTransientVisuals();
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    });
  }

  getHitMeshes(): THREE.Object3D[] {
    return this.alive ? this.hitMeshes : [];
  }

  getState(): BossState {
    return {
      ...this.state,
      health: this.health,
      maxHealth: this.maxHealth,
    };
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  protected abstract performUpdate(context: BossUpdateContext): BossAttackEvent[];

  protected resetInternalState(): void {}

  protected getPhaseThreshold(): number {
    return 0.5;
  }

  protected facePlayer(playerEye: THREE.Vector3): void {
    const toPlayer = this.tempVector.subVectors(playerEye, this.mesh.position);
    toPlayer.y = 0;
    if (toPlayer.lengthSq() <= 0.001) return;
    this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
  }

  protected moveToward(
    index: number,
    dt: number,
    colliders: ArenaCollider[],
    speed = 5.2
  ): void {
    if (!this.hardpoints[index]) return;
    const target = this.hardpoints[index];
    const toTarget = this.tempVector.subVectors(target, this.mesh.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance <= 0.08) {
      this.mesh.position.copy(target);
      return;
    }
    toTarget.normalize().multiplyScalar(Math.min(distance, speed * dt));
    this.moveOnPlane(toTarget, colliders);
  }

  protected pickNextHardpoint(): number {
    this.moveTargetIndex = (this.moveTargetIndex + 1) % this.hardpoints.length;
    return this.moveTargetIndex;
  }

  protected getMuzzlePosition(): THREE.Vector3 {
    this.mesh.updateMatrixWorld(true);
    return this.muzzleAnchor.getWorldPosition(new THREE.Vector3());
  }

  protected snapToHardpoint(index: number): void {
    const hardpoint = this.hardpoints[index];
    if (!hardpoint) return;
    this.mesh.position.copy(hardpoint);
  }

  protected showTrace(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    width = 0.1,
    opacity = 0.95,
    lifetime = 0.12
  ): void {
    const direction = this.tempVectorB.subVectors(end, start);
    const length = direction.length();
    if (length <= 0.01) return;

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const trace = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.52, width, 1, 10, 1, true),
      material
    );
    trace.renderOrder = 999;
    trace.frustumCulled = false;
    trace.scale.set(1, length, 1);
    trace.quaternion.setFromUnitVectors(UP, direction.normalize());
    trace.position.copy(start).addScaledVector(direction, length * 0.5);
    this.scene.add(trace);
    this.traces.push({ mesh: trace, material, life: lifetime, lifetime });
  }

  protected damagePlayerWithRay(
    playerBody: PhysicsBody,
    worldMeshes: THREE.Object3D[],
    direction: THREE.Vector3,
    maxDistance: number,
    damage: number,
    color: number
  ): BossAttackEvent[] {
    const muzzle = this.getMuzzlePosition();
    const normalized = direction.clone().normalize();
    const playerHit = intersectRayAABB(muzzle, normalized, playerBody.getAABB(), maxDistance);
    const worldHit = raycast(muzzle, normalized, worldMeshes, maxDistance);
    const hitPlayer =
      playerHit && (!worldHit || playerHit.distance <= worldHit.distance)
        ? playerHit
        : null;
    const point =
      hitPlayer?.point ??
      worldHit?.point ??
      muzzle.clone().addScaledVector(normalized, maxDistance);
    this.showTrace(muzzle, point, color, 0.08, 0.95, 0.18);
    if (!hitPlayer) return [];
    return [{ damage, point: hitPlayer.point.clone() }];
  }

  private updateTraces(dt: number): void {
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const entry = this.traces[i];
      entry.life -= dt;
      if (entry.life <= 0) {
        this.scene.remove(entry.mesh);
        entry.mesh.geometry.dispose();
        entry.material.dispose();
        this.traces.splice(i, 1);
        continue;
      }
      entry.material.opacity = Math.max(0.18, entry.life / entry.lifetime);
    }
  }

  protected clearTransientVisuals(): void {
    for (let i = this.traces.length - 1; i >= 0; i--) {
      const entry = this.traces[i];
      this.scene.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.material.dispose();
    }
    this.traces.length = 0;
  }

  private ensureArenaPositions(colliders: ArenaCollider[]): void {
    if (this.arenaPositionsResolved) return;

    this.resolvedSpawnPosition.copy(
      resolveBossPosition(this.encounter.spawn.position, colliders, this.mesh.position)
    );
    for (let i = 0; i < this.desiredHardpoints.length; i++) {
      this.hardpoints[i].copy(
        resolveBossPosition(
          this.desiredHardpoints[i],
          colliders,
          i === 0 ? this.resolvedSpawnPosition : this.hardpoints[i - 1]
        )
      );
    }

    if (!canBossOccupy(this.mesh.position, colliders)) {
      this.mesh.position.copy(this.resolvedSpawnPosition);
    }

    this.arenaPositionsResolved = true;
  }

  private moveOnPlane(movement: THREE.Vector3, colliders: ArenaCollider[]): void {
    this.moveAlongAxis("x", movement.x, colliders);
    this.moveAlongAxis("z", movement.z, colliders);
  }

  private moveAlongAxis(
    axis: "x" | "z",
    amount: number,
    colliders: ArenaCollider[]
  ): void {
    if (Math.abs(amount) <= 0.0001) return;

    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.18));
    const delta = amount / steps;
    for (let step = 0; step < steps; step++) {
      const candidate = this.mesh.position.clone();
      candidate[axis] += delta;
      if (!canBossOccupy(candidate, colliders)) {
        break;
      }
      this.mesh.position.copy(candidate);
    }
  }
}

class RelayWardenBoss extends BaseBossActor {
  private telegraphMesh: THREE.Mesh | null = null;
  private sweepProgress = 0;
  private sweepDuration = 0;
  private sweepStartAngle = 0;
  private sweepEndAngle = 0;
  private activeReturnSweep: ActiveReturnSweep | null = null;
  private beamLength = 20;

  constructor(scene: THREE.Scene, encounter: BossEncounterDefinition) {
    super(
      scene,
      encounter,
      { body: 0x3b506b, armor: 0x152030, accent: 0x7bd4ff },
      [
        new THREE.Vector3(0, 0.1, 0),
        new THREE.Vector3(8.5, 0.1, -7.5),
        new THREE.Vector3(-8.5, 0.1, 7.5),
      ]
    );
  }

  protected performUpdate(context: BossUpdateContext): BossAttackEvent[] {
    const events: BossAttackEvent[] = [];
    if (this.sweepDuration > 0) {
      this.sweepProgress += context.dt;
      const ratio = Math.min(1, this.sweepProgress / this.sweepDuration);
      const angle = THREE.MathUtils.lerp(this.sweepStartAngle, this.sweepEndAngle, ratio);
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const start = this.getMuzzlePosition();
      const end = start.clone().addScaledVector(direction, this.beamLength);
      this.showTrace(start, end, 0x8df0ff, 0.12, 0.85, 0.06);
      const playerPoint = closestPointOnSegment(context.playerBody.getEyePosition(), start, end);
      if (playerPoint.distanceTo(context.playerBody.getEyePosition()) <= 0.7 && this.damageTickTimer <= 0) {
        this.damageTickTimer = 0.12;
        events.push({ damage: 18, point: playerPoint });
      }
      if (ratio >= 1) {
        this.sweepDuration = 0;
        this.sweepProgress = 0;
        if (this.state.phase === 2 && !this.activeReturnSweep) {
          this.activeReturnSweep = {
            progress: 0,
            duration: 1.6,
            startAngle: this.sweepEndAngle,
            endAngle: this.sweepStartAngle,
          };
        } else {
          this.attackCooldown = 2.2;
          this.pickNextHardpoint();
        }
      }
      this.state.telegraph = "Conductor sweep";
      return events;
    }

    if (this.activeReturnSweep) {
      this.activeReturnSweep.progress += context.dt;
      const ratio = Math.min(1, this.activeReturnSweep.progress / this.activeReturnSweep.duration);
      const angle = THREE.MathUtils.lerp(
        this.activeReturnSweep.startAngle,
        this.activeReturnSweep.endAngle,
        ratio
      );
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const start = this.getMuzzlePosition();
      const end = start.clone().addScaledVector(direction, this.beamLength);
      this.showTrace(start, end, 0xc7f7ff, 0.11, 0.84, 0.06);
      const playerPoint = closestPointOnSegment(context.playerBody.getEyePosition(), start, end);
      if (playerPoint.distanceTo(context.playerBody.getEyePosition()) <= 0.7 && this.damageTickTimer <= 0) {
        this.damageTickTimer = 0.12;
        events.push({ damage: 18, point: playerPoint });
      }
      if (ratio >= 1) {
        this.activeReturnSweep = null;
        this.attackCooldown = 2.6;
        this.pickNextHardpoint();
      }
      this.state.telegraph = "Return sweep";
      return events;
    }

    this.moveToward(this.moveTargetIndex, context.dt, context.colliders, 5.8);
    if (this.attackCooldown > 0) {
      this.state.telegraph = "Pivoting beam array";
      return events;
    }

    const playerEye = context.playerBody.getEyePosition();
    const toPlayer = playerEye.clone().sub(this.mesh.position);
    const angle = Math.atan2(toPlayer.x, toPlayer.z);
    this.sweepStartAngle = angle - Math.PI * 0.42;
    this.sweepEndAngle = angle + Math.PI * 0.42;
    this.sweepDuration = 2.0;
    this.sweepProgress = 0;
    this.attackCooldown = 999;
    this.state.telegraph = "Beam grid arming";
    return events;
  }
}

class UplinkOverseerBoss extends BaseBossActor {
  private impacts: PendingImpact[] = [];
  private leapArcTime = 0;
  private leapStart = new THREE.Vector3();
  private leapEnd = new THREE.Vector3();
  private shockwaveCooldown = 0;

  constructor(scene: THREE.Scene, encounter: BossEncounterDefinition) {
    super(
      scene,
      encounter,
      { body: 0x5f4c7a, armor: 0x251d35, accent: 0xaff2ff },
      [
        new THREE.Vector3(0, 2.9, 0),
        new THREE.Vector3(-10, 0.1, 6),
        new THREE.Vector3(10, 0.1, -6),
      ]
    );
  }

  protected resetInternalState(): void {
    this.clearImpacts();
    this.leapArcTime = 0;
    this.shockwaveCooldown = 0;
  }

  protected getPhaseThreshold(): number {
    return 0.55;
  }

  protected performUpdate(context: BossUpdateContext): BossAttackEvent[] {
    const events: BossAttackEvent[] = [];
    this.shockwaveCooldown = Math.max(0, this.shockwaveCooldown - context.dt);
    this.updateImpacts(context, events);

    if (this.leapArcTime > 0) {
      this.leapArcTime = Math.max(0, this.leapArcTime - context.dt);
      const t = 1 - this.leapArcTime / 0.52;
      this.mesh.position.lerpVectors(this.leapStart, this.leapEnd, t);
      this.mesh.position.y = THREE.MathUtils.lerp(this.leapStart.y, this.leapEnd.y, t) + Math.sin(t * Math.PI) * 1.8;
      if (this.leapArcTime === 0) {
        this.snapToHardpoint(this.moveTargetIndex);
        if (this.state.phase === 2 && this.shockwaveCooldown <= 0) {
          const distance = this.mesh.position.distanceTo(context.playerBody.position);
          if (distance <= 2.3) {
            events.push({ damage: 16, point: context.playerBody.getEyePosition() });
          }
          this.shockwaveCooldown = 1.4;
        }
      }
      this.state.telegraph = "Siege relocation";
      return events;
    }

    if (this.attackCooldown > 0) {
      this.state.telegraph = this.impacts.length > 0 ? "Mortar lock" : "Tracking target";
      return events;
    }

    const volleyCount = this.state.phase === 2 ? 5 : 3;
    for (let i = 0; i < volleyCount; i++) {
      const offset = new THREE.Vector3(
        (i - (volleyCount - 1) * 0.5) * 1.2,
        0,
        (Math.random() - 0.5) * 2.4
      );
      const target = context.playerBody.position
        .clone()
        .addScaledVector(context.playerBody.velocity, 0.12 * i)
        .add(offset);
      this.spawnImpactRing(target, 2.8, 26, 1.0 + i * 0.08);
    }
    this.attackCooldown = 3.1;
    this.pickNextHardpoint();
    this.leapStart.copy(this.mesh.position);
    this.leapEnd.copy(this.hardpoints[this.moveTargetIndex]);
    this.leapArcTime = 0.52;
    this.state.telegraph = "Siege battery live";
    return events;
  }

  private spawnImpactRing(position: THREE.Vector3, radius: number, damage: number, timer: number): void {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x9ff7ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.16, radius, 32),
      ringMaterial
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(0.04);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xcfffff,
        transparent: true,
        opacity: 0.65,
      })
    );
    core.position.copy(position).setY(0.35);
    this.scene.add(ring, core);
    this.impacts.push({ ring, core, position: position.clone(), radius, timer, damage });
  }

  private updateImpacts(context: BossUpdateContext, events: BossAttackEvent[]): void {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const impact = this.impacts[i];
      impact.timer -= context.dt;
      const ratio = Math.max(0, impact.timer / 1.2);
      (impact.ring.material as THREE.MeshBasicMaterial).opacity = 0.18 + (1 - ratio) * 0.36;
      (impact.core.material as THREE.MeshBasicMaterial).opacity = 0.15 + (1 - ratio) * 0.5;
      impact.core.position.y = 0.35 + (1 - ratio) * 0.28;
      if (impact.timer > 0) continue;

      const distance = impact.position.distanceTo(context.playerBody.position);
      if (distance <= impact.radius) {
        events.push({ damage: impact.damage, point: impact.position.clone().setY(1) });
      }
      this.showTrace(
        impact.position.clone().setY(2.2),
        impact.position.clone().setY(0.1),
        0xaef9ff,
        0.18,
        0.9,
        0.22
      );
      this.scene.remove(impact.ring, impact.core);
      impact.ring.geometry.dispose();
      (impact.ring.material as THREE.Material).dispose();
      impact.core.geometry.dispose();
      (impact.core.material as THREE.Material).dispose();
      this.impacts.splice(i, 1);
    }
  }

  private clearImpacts(): void {
    for (const impact of this.impacts) {
      this.scene.remove(impact.ring, impact.core);
      impact.ring.geometry.dispose();
      (impact.ring.material as THREE.Material).dispose();
      impact.core.geometry.dispose();
      (impact.core.material as THREE.Material).dispose();
    }
    this.impacts.length = 0;
  }
}

class BlackoutHunterBoss extends BaseBossActor {
  private chargeTimer = 0;
  private queuedFollowup = 0;
  private aimDirection = new THREE.Vector3();

  constructor(scene: THREE.Scene, encounter: BossEncounterDefinition) {
    super(
      scene,
      encounter,
      { body: 0x2f405c, armor: 0x121927, accent: 0xc2e1ff },
      [
        new THREE.Vector3(0, 0.1, -18),
        new THREE.Vector3(-8, 0.1, -14),
        new THREE.Vector3(8, 0.1, -10),
        new THREE.Vector3(-8, 0.1, -2),
        new THREE.Vector3(8, 0.1, 4),
      ]
    );
  }

  protected getPhaseThreshold(): number {
    return 0.45;
  }

  protected resetInternalState(): void {
    this.chargeTimer = 0;
    this.queuedFollowup = 0;
    this.aimDirection.set(0, 0, 1);
  }

  protected performUpdate(context: BossUpdateContext): BossAttackEvent[] {
    const events: BossAttackEvent[] = [];
    const playerEye = context.playerBody.getEyePosition();
    this.aimDirection.copy(playerEye).sub(this.getMuzzlePosition()).normalize();

    if (this.chargeTimer > 0) {
      this.chargeTimer = Math.max(0, this.chargeTimer - context.dt);
      const muzzle = this.getMuzzlePosition();
      const end = muzzle.clone().addScaledVector(this.aimDirection, 40);
      this.showTrace(muzzle, end, 0xd8edff, 0.07, 0.75, 0.08);
      this.state.telegraph = this.queuedFollowup > 0 ? "Quick rail follow-up" : "Rail charge";
      if (this.chargeTimer === 0) {
        events.push(
          ...this.damagePlayerWithRay(
            context.playerBody,
            context.worldMeshes,
            this.aimDirection,
            42,
            42,
            0xe6f6ff
          )
        );
        if (this.state.phase === 2 && this.queuedFollowup === 0) {
          this.queuedFollowup = 0.35;
        } else {
          this.pickNextHardpoint();
          this.snapToHardpoint(this.moveTargetIndex);
          this.attackCooldown = 1.8;
          this.queuedFollowup = 0;
        }
      }
      return events;
    }

    if (this.queuedFollowup > 0) {
      this.queuedFollowup = Math.max(0, this.queuedFollowup - context.dt);
      this.state.telegraph = "Reacquiring rail line";
      if (this.queuedFollowup === 0) {
        this.chargeTimer = 0.5;
      }
      return events;
    }

    if (this.attackCooldown > 0) {
      this.state.telegraph = "Phase drifting";
      return events;
    }

    this.chargeTimer = 1.1;
    this.attackCooldown = 999;
    this.state.telegraph = "Rail line charging";
    return events;
  }
}

export function createBossActor(
  scene: THREE.Scene,
  encounter: BossEncounterDefinition
): BossActor {
  switch (encounter.bossId) {
    case "relay-warden":
      return new RelayWardenBoss(scene, encounter);
    case "uplink-overseer":
      return new UplinkOverseerBoss(scene, encounter);
    case "blackout-hunter":
      return new BlackoutHunterBoss(scene, encounter);
  }
}

function closestPointOnSegment(point: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(point.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 0.0001), 0, 1);
  return a.clone().addScaledVector(ab, t);
}

function intersectRayAABB(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  bounds: { min: THREE.Vector3; max: THREE.Vector3 },
  maxDistance: number
): { distance: number; point: THREE.Vector3 } | null {
  let tMin = 0;
  let tMax = maxDistance;

  for (const axis of ["x", "y", "z"] as const) {
    const dir = direction[axis];
    const start = origin[axis];
    const min = bounds.min[axis];
    const max = bounds.max[axis];

    if (Math.abs(dir) < 1e-6) {
      if (start < min || start > max) {
        return null;
      }
      continue;
    }

    let t1 = (min - start) / dir;
    let t2 = (max - start) / dir;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }

    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return null;
    }
  }

  return {
    distance: tMin,
    point: origin.clone().addScaledVector(direction, tMin),
  };
}

function canBossOccupy(
  position: THREE.Vector3,
  colliders: ArenaCollider[]
): boolean {
  return canOccupyBody(
    position,
    BOSS_COLLISION_HEIGHT,
    BOSS_COLLISION_RADIUS,
    colliders
  );
}

function resolveBossPosition(
  desiredPosition: THREE.Vector3,
  colliders: ArenaCollider[],
  fallbackPosition: THREE.Vector3
): THREE.Vector3 {
  if (canBossOccupy(desiredPosition, colliders)) {
    return desiredPosition.clone();
  }

  const angleSeed =
    fallbackPosition.distanceToSquared(desiredPosition) > 0.0001
      ? Math.atan2(
          fallbackPosition.z - desiredPosition.z,
          fallbackPosition.x - desiredPosition.x
        )
      : 0;

  for (let ringIndex = 0; ringIndex < BOSS_POSITION_SEARCH_RADII.length; ringIndex++) {
    const radius = BOSS_POSITION_SEARCH_RADII[ringIndex];
    const samples = ringIndex === 0 ? 1 : 10 + ringIndex * 6;

    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
      const angle = angleSeed + (sampleIndex / samples) * Math.PI * 2;
      const candidate = new THREE.Vector3(
        desiredPosition.x + Math.cos(angle) * radius,
        desiredPosition.y,
        desiredPosition.z + Math.sin(angle) * radius
      );

      if (canBossOccupy(candidate, colliders)) {
        return candidate;
      }
    }
  }

  return fallbackPosition.clone();
}
