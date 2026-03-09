import * as THREE from "three";
import { PhysicsBody, moveAndCollide, raycast } from "./physics";
import {
  ArenaCollider,
  BalanceSnapshot,
  BotData,
  EnemyArchetype,
  SpawnPoint,
} from "./types";
import { DEFAULT_BALANCE_SNAPSHOT } from "./progression";

type BotState = "idle" | "patrol" | "chase" | "attack" | "dead";

const BOT_WATCH_DOT = Math.cos(THREE.MathUtils.degToRad(55));
const BOT_TRACE_LIFETIME = 0.22;
const BOT_MAX_AIM_PITCH = 0.45;
const RESPAWN_TIME = 3;
const BOT_ATTACK_PREP = 0.6;

const BOT_NAMES = [
  "Reaper",
  "Phantom",
  "Blaze",
  "Venom",
  "Shadow",
  "Striker",
  "Ghost",
  "Havoc",
];

type TrailEffect = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
};

type RayHit = {
  distance: number;
  point: THREE.Vector3;
};

type BotProfile = {
  speed: number;
  health: number;
  fireRate: number;
  damage: number;
  accuracy: number;
  sightRange: number;
  attackRange: number;
  strafeFactor: number;
  primaryColor: number;
  armorColor: number;
  accentColor: number;
};

const BOT_ARCHETYPE_PROFILES: Record<EnemyArchetype, BotProfile> = {
  rusher: {
    speed: 5.15,
    health: 78,
    fireRate: 0.92,
    damage: 7,
    accuracy: 0.44,
    sightRange: 18,
    attackRange: 7.5,
    strafeFactor: 0.2,
    primaryColor: 0xdc6d42,
    armorColor: 0x4c1f18,
    accentColor: 0xffb56f,
  },
  anchor: {
    speed: 3.4,
    health: 112,
    fireRate: 1.28,
    damage: 10,
    accuracy: 0.22,
    sightRange: 23,
    attackRange: 12.5,
    strafeFactor: 0.07,
    primaryColor: 0xc24b5a,
    armorColor: 0x35141c,
    accentColor: 0x86b7ff,
  },
  disruptor: {
    speed: 4.15,
    health: 96,
    fireRate: 1.08,
    damage: 8,
    accuracy: 0.31,
    sightRange: 20,
    attackRange: 10.2,
    strafeFactor: 0.14,
    primaryColor: 0xa453d4,
    armorColor: 0x2f1b45,
    accentColor: 0xb9a0ff,
  },
};

export class Bot {
  data: BotData;
  body: PhysicsBody;
  mesh: THREE.Group;
  private state: BotState = "idle";
  private stateTimer = 0;
  private fireCooldown = 0;
  private patrolTarget: THREE.Vector3 | null = null;
  private respawnTimer = 0;
  private waypoints: THREE.Vector3[];
  private waypointIndex = 0;
  private readonly scene: THREE.Scene;
  private readonly upperBodyPivot = new THREE.Group();
  private readonly weaponPivot = new THREE.Group();
  private readonly muzzleAnchor = new THREE.Object3D();
  private readonly trailGeometry = new THREE.CylinderGeometry(0.024, 0.04, 1, 8, 1, true);
  private readonly activeTrails: TrailEffect[] = [];
  private readonly muzzleWorldPosition = new THREE.Vector3();
  private readonly lookDirection = new THREE.Vector3(0, 0, 1);
  private readonly tempVector = new THREE.Vector3();
  private readonly tempVectorB = new THREE.Vector3();
  private readonly tempQuaternion = new THREE.Quaternion();
  private readonly objectiveBias = new THREE.Vector3();
  private hasObjectiveBias = false;
  private aimPitch = 0;
  private deathTimer = 0;
  private deathDirection = 1;
  private walkPhase = 0;
  private flinchAmount = 0;
  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;
  private readonly archetype: EnemyArchetype;
  private readonly elite: boolean;
  private readonly profile: BotProfile;
  private directorBalance: BalanceSnapshot = DEFAULT_BALANCE_SNAPSHOT;

  constructor(
    id: string,
    spawn: SpawnPoint,
    waypoints: THREE.Vector3[],
    scene: THREE.Scene,
    archetype: EnemyArchetype = "anchor",
    elite = false,
    directorBalance: BalanceSnapshot = DEFAULT_BALANCE_SNAPSHOT
  ) {
    this.directorBalance = directorBalance;
    this.archetype = archetype;
    this.elite = elite;
    const baseProfile = BOT_ARCHETYPE_PROFILES[archetype];
    this.profile = elite
      ? {
          ...baseProfile,
          speed: baseProfile.speed * 1.08,
          health: Math.round(baseProfile.health * 1.55),
          fireRate: Math.max(0.72, baseProfile.fireRate * 0.82),
          damage: Math.round(baseProfile.damage * 1.25),
          accuracy: Math.max(0.16, baseProfile.accuracy * 0.82),
          sightRange: baseProfile.sightRange + 2.5,
          attackRange: baseProfile.attackRange + 1.5,
          primaryColor: 0xf0d585,
          armorColor: 0x5a4123,
          accentColor: 0xfff2a0,
          strafeFactor: baseProfile.strafeFactor + 0.03,
        }
      : baseProfile;

    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.profile.primaryColor,
      roughness: 0.6,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: this.profile.armorColor,
      roughness: 0.72,
      metalness: 0.24,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffccaa,
      roughness: 0.72,
    });
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x20252f,
      roughness: 0.42,
      metalness: 0.58,
    });
    const gunAccentMat = new THREE.MeshStandardMaterial({
      color: this.profile.accentColor,
      emissive: this.profile.accentColor,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.34,
    });

    this.leftLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.54, 6, 16),
      armorMat
    );
    this.leftLeg.position.set(-0.12, 0.42, 0);
    this.rightLeg = this.leftLeg.clone();
    this.rightLeg.position.x = 0.12;

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.3, 0.82, 16),
      bodyMat
    );
    torso.position.y = 0.2;
    torso.rotation.z = 0.04;

    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.4, 0.28, 1, 1, 1),
      armorMat
    );
    chestPlate.position.set(0, 0.16, 0.06);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 20, 16),
      headMat
    );
    head.position.y = 0.76;

    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.28, 16, 1, false, -Math.PI * 0.5, Math.PI),
      gunAccentMat
    );
    visor.rotation.z = Math.PI / 2;
    visor.position.set(0, 0.78, 0.19);

    const armGeometry = new THREE.CapsuleGeometry(0.08, 0.34, 4, 12);
    const leftArm = new THREE.Mesh(armGeometry, bodyMat);
    leftArm.position.set(0.3, 0.08, 0.08);
    leftArm.rotation.x = -0.36;
    leftArm.rotation.z = -0.18;

    const rightArm = new THREE.Mesh(armGeometry, bodyMat);
    rightArm.position.set(-0.24, 0.04, 0.16);
    rightArm.rotation.x = -1.02;
    rightArm.rotation.z = 0.3;

    this.upperBodyPivot.position.y = 0.96;
    this.upperBodyPivot.add(torso, chestPlate, head, visor, leftArm, rightArm);

    const gunBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.72),
      gunMat
    );
    gunBody.position.z = 0.3;

    const gunBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.04, 0.68, 16),
      gunMat
    );
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, 0.024, 0.66);

    const gunStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.1, 0.24),
      armorMat
    );
    gunStock.position.set(0.02, -0.02, -0.1);
    gunStock.rotation.x = 0.16;

    const scope = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.04, 0.14, 4, 12),
      gunAccentMat
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, 0.2);

    this.weaponPivot.position.set(-0.06, 0.06, 0.22);
    this.weaponPivot.rotation.x = -0.08;
    this.weaponPivot.add(gunBody, gunBarrel, gunStock, scope);
    this.muzzleAnchor.position.set(0, 0.02, 1);
    this.weaponPivot.add(this.muzzleAnchor);
    this.upperBodyPivot.add(this.weaponPivot);

    group.add(this.leftLeg, this.rightLeg, this.upperBodyPivot);
    group.position.copy(spawn.position);
    group.rotation.y = spawn.rotation;
    scene.add(group);

    this.mesh = group;
    this.scene = scene;
    this.body = new PhysicsBody(spawn.position.clone());
    this.waypoints = waypoints;
    this.waypointIndex = Math.floor(Math.random() * waypoints.length);
    this.fireCooldown = Math.random() * this.getFireInterval();

    const numericSuffix = Number(id.match(/(\d+)(?!.*\d)/)?.[1] ?? 0);
    const archetypeTitle =
      archetype === "rusher"
        ? "Rusher"
        : archetype === "anchor"
          ? "Anchor"
          : "Disruptor";
    const name =
      BOT_NAMES[numericSuffix % BOT_NAMES.length]
        ? `${BOT_NAMES[numericSuffix % BOT_NAMES.length]} ${archetypeTitle}`
        : `${archetypeTitle} ${numericSuffix || 1}`;
    this.data = {
      id,
      name,
      health: this.getScaledHealth(),
      maxHealth: this.getScaledHealth(),
      position: spawn.position.clone(),
      mesh: group,
      archetype,
      elite,
    };

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData = this.data;
    });

    this.mesh.updateMatrixWorld(true);
    this.updateLookDirection();
  }

  update(
    dt: number,
    playerBody: PhysicsBody,
    playerAlive: boolean,
    colliders: ArenaCollider[],
    worldMeshes: THREE.Object3D[]
  ): { damaged: boolean; damage: number } | null {
    this.updateTrails(dt);

    if (this.state === "dead") {
      this.respawnTimer -= dt;
      if (this.deathTimer > 0) {
        this.deathTimer -= dt;
        const t = 1 - Math.max(0, this.deathTimer);
        const tiltAngle = t * t * (Math.PI / 2.2);
        this.mesh.rotation.x = tiltAngle * this.deathDirection;
        this.mesh.position.y = this.body.position.y - t * 0.5;
        this.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.opacity = Math.max(0, 1 - t * 1.2);
            child.material.transparent = true;
          }
        });
        if (this.deathTimer <= 0) {
          this.mesh.visible = false;
        }
      }
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
      return null;
    }

    this.fireCooldown -= dt;
    this.stateTimer -= dt;

    const playerPos = playerBody.getEyePosition();
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.body.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    const canSeePlayer =
      playerAlive &&
      distToPlayer < this.profile.sightRange &&
      this.hasLineOfSight(playerPos, worldMeshes);

    if (this.hasObjectiveBias && !canSeePlayer) {
      this.state = "patrol";
      this.patrolTarget = this.objectiveBias.clone();
    }

    switch (this.state) {
      case "idle":
        if (canSeePlayer) {
          this.state = "chase";
        } else if (this.stateTimer <= 0) {
          this.state = "patrol";
          this.pickNextWaypoint();
        }
        break;

      case "patrol":
        if (canSeePlayer) {
          this.state = "chase";
        } else if (this.patrolTarget) {
          const dist = this.body.position.distanceTo(this.patrolTarget);
          if (dist < 1) {
            this.state = "idle";
            this.stateTimer = 1 + Math.random() * 2;
          }
        }
        break;

      case "chase":
        if (!canSeePlayer) {
          this.state = "patrol";
          this.pickNextWaypoint();
        } else if (distToPlayer < this.profile.attackRange) {
          this.state = "attack";
          this.fireCooldown = Math.max(
            this.fireCooldown,
            BOT_ATTACK_PREP + Math.random() * 0.2
          );
        }
        break;

      case "attack":
        if (!canSeePlayer) {
          this.state = "patrol";
          this.pickNextWaypoint();
        } else if (distToPlayer > this.profile.attackRange) {
          this.state = "chase";
        }
        break;
    }

    let result: { damaged: boolean; damage: number } | null = null;
    const movement = new THREE.Vector3();

    switch (this.state) {
      case "patrol":
        if (this.patrolTarget) {
          const dir = new THREE.Vector3().subVectors(
            this.patrolTarget,
            this.body.position
          );
          dir.y = 0;
          if (dir.lengthSq() > 0.1) {
            dir.normalize().multiplyScalar(this.profile.speed * dt);
            movement.copy(dir);
          }
        }
        break;

      case "chase":
        movement.copy(toPlayer.normalize().multiplyScalar(this.profile.speed * dt));
        break;

      case "attack":
        this.faceDirection(toPlayer);
        movement.copy(
          new THREE.Vector3(-toPlayer.z, 0, toPlayer.x)
            .normalize()
            .multiplyScalar(this.profile.speed * this.profile.strafeFactor * dt)
        );
        break;
    }

    if (movement.lengthSq() > 0 && this.state !== "attack") {
      this.faceDirection(movement);
    }

    moveAndCollide(this.body, movement, colliders, dt);
    this.mesh.position.copy(this.body.position);
    this.data.position.copy(this.body.position);

    const speed = movement.length() / Math.max(dt, 0.001);
    if (speed > 0.5) {
      this.walkPhase += dt * 10;
      const swing = Math.sin(this.walkPhase) * 0.4;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.upperBodyPivot.position.y = 0.96 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.02;
      // Upper body lateral sway during movement
      const swayCycle = Math.sin(this.walkPhase * 0.5) * 0.035;
      this.upperBodyPivot.rotation.z = THREE.MathUtils.damp(
        this.upperBodyPivot.rotation.z,
        swayCycle,
        8,
        dt
      );
    } else {
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 8, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 8, dt);
      this.upperBodyPivot.position.y = THREE.MathUtils.damp(this.upperBodyPivot.position.y, 0.96, 8, dt);
      this.upperBodyPivot.rotation.z = THREE.MathUtils.damp(this.upperBodyPivot.rotation.z, 0, 8, dt);
    }

    this.updateAimPose(dt, canSeePlayer ? playerPos : null);
    this.mesh.updateMatrixWorld(true);
    this.updateLookDirection();

    if (this.state === "attack") {
      result = this.tryShoot(playerBody, worldMeshes);
    }

    return result;
  }

  private faceDirection(dir: THREE.Vector3): void {
    if (dir.lengthSq() <= 0.0001) return;
    const targetAngle = Math.atan2(dir.x, dir.z);
    let delta = targetAngle - this.mesh.rotation.y;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.mesh.rotation.y += delta * (1 - Math.exp(-12 * (1 / 60)));
  }

  private pickNextWaypoint(): void {
    this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
    this.patrolTarget = this.waypoints[this.waypointIndex].clone();
  }

  private hasLineOfSight(
    target: THREE.Vector3,
    worldMeshes: THREE.Object3D[]
  ): boolean {
    const eyePos = this.body.getEyePosition();
    const dir = new THREE.Vector3().subVectors(target, eyePos).normalize();
    const dist = eyePos.distanceTo(target);
    const hit = raycast(eyePos, dir, worldMeshes, dist);
    return !hit || hit.distance >= dist - 0.5;
  }

  private updateAimPose(dt: number, target: THREE.Vector3 | null): void {
    let desiredPitch = 0;
    if (target) {
      const toTarget = this.tempVector.subVectors(target, this.body.getEyePosition());
      const flatDistance = Math.hypot(toTarget.x, toTarget.z);
      desiredPitch = Math.atan2(toTarget.y, Math.max(0.001, flatDistance));
    }

    this.aimPitch = THREE.MathUtils.damp(
      this.aimPitch,
      THREE.MathUtils.clamp(desiredPitch, -BOT_MAX_AIM_PITCH, BOT_MAX_AIM_PITCH),
      12,
      dt
    );
    this.flinchAmount = THREE.MathUtils.damp(this.flinchAmount, 0, 6, dt);
    const now = performance.now();
    this.upperBodyPivot.rotation.x = -this.aimPitch - this.flinchAmount;
    this.upperBodyPivot.rotation.z = Math.sin(now * 0.03) * this.flinchAmount * 0.4;
    this.weaponPivot.rotation.x = -0.08 - this.aimPitch * 0.18;
    this.weaponPivot.rotation.z = THREE.MathUtils.damp(
      this.weaponPivot.rotation.z,
      this.state === "attack" ? 0.06 : 0,
      12,
      dt
    );
  }

  private updateLookDirection(): void {
    this.weaponPivot.getWorldQuaternion(this.tempQuaternion);
    this.lookDirection.set(0, 0, 1).applyQuaternion(this.tempQuaternion).normalize();
  }

  isWatchingPlayer(
    playerPos: THREE.Vector3,
    worldMeshes: THREE.Object3D[]
  ): boolean {
    if (this.state === "dead") return false;

    const eyePos = this.body.getEyePosition();
    const toPlayer = new THREE.Vector3().subVectors(playerPos, eyePos);
    const dist = toPlayer.length();
    if (dist > this.profile.sightRange) return false;

    const flatToPlayer = toPlayer.clone();
    flatToPlayer.y = 0;
    if (flatToPlayer.lengthSq() === 0) return true;
    flatToPlayer.normalize();

    const forward = this.getLookDirection();
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      forward.set(0, 0, 1);
    } else {
      forward.normalize();
    }

    if (forward.dot(flatToPlayer) < BOT_WATCH_DOT) return false;

    return this.hasLineOfSight(playerPos, worldMeshes);
  }

  private tryShoot(
    playerBody: PhysicsBody,
    worldMeshes: THREE.Object3D[]
  ): { damaged: boolean; damage: number } | null {
    if (this.fireCooldown > 0) return null;
    this.fireCooldown = this.getFireInterval();

    const muzzlePosition = this.getMuzzleWorldPosition();
    const playerPos = playerBody.getEyePosition();
    const dir = new THREE.Vector3().subVectors(playerPos, muzzlePosition).normalize();

    dir.x += (Math.random() - 0.5) * this.profile.accuracy;
    dir.y += (Math.random() - 0.5) * this.profile.accuracy * 0.5;
    dir.z += (Math.random() - 0.5) * this.profile.accuracy;
    dir.normalize();

    const playerHit = intersectRayAABB(
      muzzlePosition,
      dir,
      playerBody.getAABB(),
      this.profile.attackRange
    );
    const worldHit = raycast(
      muzzlePosition,
      dir,
      worldMeshes,
      this.profile.attackRange
    );
    const hitPlayer =
      playerHit &&
      (!worldHit || playerHit.distance <= worldHit.distance);

    const impactPoint = hitPlayer
      ? playerHit.point
      : worldHit?.point ??
        muzzlePosition.clone().addScaledVector(dir, this.profile.attackRange);
    this.showTrail(muzzlePosition, impactPoint);

    if (hitPlayer) {
      return { damaged: true, damage: this.profile.damage };
    }

    return null;
  }

  private getMuzzleWorldPosition(): THREE.Vector3 {
    this.mesh.updateMatrixWorld(true);
    return this.muzzleAnchor.getWorldPosition(this.muzzleWorldPosition);
  }

  private showTrail(from: THREE.Vector3, to: THREE.Vector3): void {
    const distance = from.distanceTo(to);
    if (distance <= 0.05) return;

    const material = new THREE.MeshBasicMaterial({
      color: 0xffb366,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const trail = new THREE.Mesh(this.trailGeometry, material);
    trail.position.copy(from).lerp(to, 0.5);
    trail.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      this.tempVectorB.subVectors(to, from).normalize()
    );
    trail.scale.set(1, distance, 1);
    this.scene.add(trail);
    this.activeTrails.push({
      mesh: trail,
      material,
      life: BOT_TRACE_LIFETIME,
    });
  }

  private updateTrails(dt: number): void {
    for (let i = this.activeTrails.length - 1; i >= 0; i--) {
      const trail = this.activeTrails[i];
      trail.life -= dt;
      if (trail.life <= 0) {
        this.scene.remove(trail.mesh);
        trail.material.dispose();
        this.activeTrails.splice(i, 1);
        continue;
      }

      const ratio = trail.life / BOT_TRACE_LIFETIME;
      trail.material.opacity = ratio * ratio * 0.9;
    }
  }

  takeDamage(amount: number): boolean {
    this.data.health -= amount;
    this.flinchAmount = Math.min(0.35, this.flinchAmount + 0.15);
    if (this.data.health <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.state = "dead";
    this.data.health = 0;
    this.deathTimer = 1.0;
    this.deathDirection = Math.random() > 0.5 ? 1 : -1;
    this.respawnTimer = RESPAWN_TIME;
  }

  private respawn(): void {
    const spawnIdx = Math.floor(Math.random() * this.waypoints.length);
    this.body.position.copy(this.waypoints[spawnIdx]);
    this.body.velocity.set(0, 0, 0);
    this.mesh.position.copy(this.body.position);
    this.mesh.rotation.x = 0;
    this.mesh.visible = true;
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.opacity = 1;
        child.material.transparent = false;
      }
    });
    this.data.health = this.getScaledHealth();
    this.data.maxHealth = this.getScaledHealth();
    this.data.position.copy(this.body.position);
    this.state = "idle";
    this.stateTimer = 1;
    this.aimPitch = 0;
    this.flinchAmount = 0;
    this.walkPhase = 0;
    this.leftLeg.rotation.x = 0;
    this.rightLeg.rotation.x = 0;
    this.mesh.updateMatrixWorld(true);
    this.updateLookDirection();
  }

  isAlive(): boolean {
    return this.state !== "dead";
  }

  getState(): BotState {
    return this.state;
  }

  getLookDirection(): THREE.Vector3 {
    return this.lookDirection.clone();
  }

  getMuzzlePosition(): THREE.Vector3 {
    return this.getMuzzleWorldPosition().clone();
  }

  getArchetype(): EnemyArchetype {
    return this.archetype;
  }

  isElite(): boolean {
    return this.elite;
  }

  setDirectorBalance(balance: BalanceSnapshot): void {
    const previousMaxHealth = this.data.maxHealth;
    this.directorBalance = balance;
    const nextMaxHealth = this.getScaledHealth();
    this.data.maxHealth = nextMaxHealth;
    if (this.state !== "dead") {
      const ratio = previousMaxHealth > 0 ? this.data.health / previousMaxHealth : 1;
      this.data.health = Math.max(1, Math.round(nextMaxHealth * ratio));
    }
  }

  getKillMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  setObjectiveBias(target: THREE.Vector3 | null): void {
    if (!target) {
      this.hasObjectiveBias = false;
      return;
    }

    this.objectiveBias.copy(target);
    this.hasObjectiveBias = true;
    if (this.state !== "attack" && this.state !== "dead") {
      this.patrolTarget = target.clone();
    }
  }

  dispose(): void {
    for (const trail of this.activeTrails) {
      this.scene.remove(trail.mesh);
      trail.material.dispose();
    }
    this.activeTrails.length = 0;
    this.trailGeometry.dispose();
    this.scene.remove(this.mesh);
  }

  private getScaledHealth(): number {
    return Math.max(
      1,
      Math.round(this.profile.health * this.directorBalance.enemyHealthMultiplier)
    );
  }

  private getFireInterval(): number {
    return this.profile.fireRate / this.directorBalance.enemyFireRateMultiplier;
  }
}

function intersectRayAABB(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  bounds: { min: THREE.Vector3; max: THREE.Vector3 },
  maxDistance: number
): RayHit | null {
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

  const distance = Math.max(0, tMin);
  if (distance > maxDistance) {
    return null;
  }

  return {
    distance,
    point: origin.clone().addScaledVector(direction, distance),
  };
}
