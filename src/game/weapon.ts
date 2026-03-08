import * as THREE from "three";
import { raycast } from "./physics";
import { InputSnapshot } from "./input";
import {
  BotData,
  InventoryState,
  ProjectileState,
  WeaponCameraRecoilProfile,
  WeaponFireMode,
  WeaponId,
  RuntimeModifiers,
} from "./types";
import {
  createWeaponInstance,
  getWeaponDefinition,
  STARTER_WEAPON_ID,
  WEAPON_DEFINITIONS,
} from "./weapons";
import { DEFAULT_RUNTIME_MODIFIERS } from "./progression";

const BASE_VIEWMODEL_OFFSET = new THREE.Vector3(0.32, -0.26, -0.58);
const ADS_VIEWMODEL_OFFSET = new THREE.Vector3(0.0, -0.19, -0.38);
const ADS_LERP_SPEED = 10;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const FLASH_DURATION = 0.05;
const RETICLE_KICK_DAMP = 10;
const TRACE_LIFETIME = 0.38;

type ViewModelEntry = {
  group: THREE.Group;
  anchor: THREE.Object3D;
};

type TracerEffect = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  lifetime: number;
};

type ProjectileRuntime = {
  id: string;
  weaponId: WeaponId;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  velocity: THREE.Vector3;
  radius: number;
  age: number;
  maxAge: number;
  gravity: number;
  directDamage: number;
  splashDamage: number;
  splashRadius: number;
};

export interface WeaponRayCommand {
  weaponId: WeaponId;
  weaponName: string;
  fireMode: WeaponFireMode;
  origin: THREE.Vector3;
  visualOrigin: THREE.Vector3;
  direction: THREE.Vector3;
  range: number;
  damage: number;
  maxPierce: number;
  traceScale: number;
  tracerColor?: number;
}

export interface WeaponDispatchResult {
  fired: boolean;
  weaponId: WeaponId | null;
  weaponName: string | null;
  cameraKick: WeaponCameraRecoilProfile | null;
  commands: WeaponRayCommand[];
}

export interface WeaponProjectileImpact {
  weaponId: WeaponId;
  weaponName: string;
  position: THREE.Vector3;
  radius: number;
  directDamage: number;
  splashDamage: number;
  directEntity: BotData | null;
}

type PickupWeaponResult =
  | { kind: "stored" | "replaced"; slot: number }
  | { kind: "ammo"; slot: number; amount: number }
  | { kind: "full" | "ignored"; slot: number };

export class WeaponSystem {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly viewModels: Record<WeaponId, ViewModelEntry>;
  private readonly muzzleFlash: THREE.PointLight;
  private readonly flashSprite: THREE.Mesh;
  private readonly tracers: TracerEffect[] = [];
  private readonly projectiles: ProjectileRuntime[] = [];
  private readonly tempOffset = new THREE.Vector3();
  private readonly tempEuler = new THREE.Euler();
  private readonly tempRotation = new THREE.Quaternion();
  private readonly tempMidpoint = new THREE.Vector3();
  private readonly tempDirection = new THREE.Vector3();
  private readonly muzzleWorldPosition = new THREE.Vector3();
  private readonly projectileGeometry = new THREE.SphereGeometry(0.12, 14, 14);
  private slots: [ReturnType<typeof createWeaponInstance> | null, ReturnType<typeof createWeaponInstance> | null, ReturnType<typeof createWeaponInstance> | null] = [
    createWeaponInstance(STARTER_WEAPON_ID),
    null,
    null,
  ];
  private activeSlotIndex = 0;
  private fireCooldown = 0;
  private reloading = false;
  private reloadTimer = 0;
  private queuedBurstShots = 0;
  private burstShotTimer = 0;
  private chargeTimer = 0;
  private flashTimer = 0;
  private viewBobTime = 0;
  private recoilKick = 0;
  private reticleKick = 0;
  private sway = new THREE.Vector2();
  private inertiaOffset = new THREE.Vector2();
  private adsProgress = 0;
  private projectileIdCounter = 0;
  private runtimeModifiers: RuntimeModifiers = { ...DEFAULT_RUNTIME_MODIFIERS };
  private goldenChamberReady: [boolean, boolean, boolean] = [false, false, false];

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    this.viewModels = {
      "vanguard-carbine": this.createViewModel("vanguard-carbine"),
      "arc-smg": this.createViewModel("arc-smg"),
      "scattershot": this.createViewModel("scattershot"),
      "helix-burst-rifle": this.createViewModel("helix-burst-rifle"),
      "rail-lance": this.createViewModel("rail-lance"),
      "plasma-lobber": this.createViewModel("plasma-lobber"),
      "phantom-sniper": this.createViewModel("phantom-sniper"),
    };

    this.muzzleFlash = new THREE.PointLight(0xffcc8a, 0, 3.2);
    this.muzzleFlash.castShadow = false;
    this.scene.add(this.muzzleFlash);

    this.flashSprite = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffefc2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.flashSprite.visible = false;
    this.flashSprite.renderOrder = 1001;
    this.scene.add(this.flashSprite);

    this.syncViewModelVisibility();
  }

  get ammo(): number {
    return this.activeWeapon?.ammo ?? 0;
  }

  get reserveAmmo(): number {
    return this.activeWeapon?.reserveAmmo ?? 0;
  }

  get activeWeaponId(): WeaponId | null {
    return this.activeWeapon?.id ?? null;
  }

  get activeSlot(): number {
    return this.activeSlotIndex;
  }

  get isADS(): boolean {
    return this.adsProgress > 0.01;
  }

  get adsAmount(): number {
    return this.adsProgress;
  }

  get adsZoomFactor(): number {
    return this.activeDefinition?.adsZoomFactor ?? 0.72;
  }

  get activeWeaponName(): string | null {
    return this.activeWeapon ? getWeaponDefinition(this.activeWeapon.id).name : null;
  }

  private get activeWeapon() {
    return this.slots[this.activeSlotIndex];
  }

  private get activeDefinition() {
    return this.activeWeapon ? getWeaponDefinition(this.activeWeapon.id) : null;
  }

  applyRuntimeModifiers(modifiers: RuntimeModifiers = DEFAULT_RUNTIME_MODIFIERS): void {
    const previous = this.runtimeModifiers;
    this.runtimeModifiers = { ...modifiers };

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot) continue;

      const oldCapacity = this.getMagazineCapacity(slot.id, previous);
      const newCapacity = this.getMagazineCapacity(slot.id, this.runtimeModifiers);
      if (newCapacity > oldCapacity) {
        slot.ammo = Math.min(newCapacity, slot.ammo + (newCapacity - oldCapacity));
      } else if (slot.ammo > newCapacity) {
        slot.ammo = newCapacity;
      }
    }

    if (!this.runtimeModifiers.goldenChamber) {
      this.goldenChamberReady = [false, false, false];
    }
  }

  update(dt: number, input: InputSnapshot): void {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }
    if (this.burstShotTimer > 0) {
      this.burstShotTimer = Math.max(0, this.burstShotTimer - dt);
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    const activeDef = this.activeDefinition;
    if (
      activeDef?.fireMode === "charge" &&
      input.fire &&
      this.canStartNewShot(activeDef) &&
      !this.reloading
    ) {
      this.chargeTimer = Math.min(
        activeDef.chargeTime ?? 0.65,
        this.chargeTimer + dt
      );
    } else if (activeDef?.fireMode !== "charge" && this.chargeTimer > 0) {
      this.chargeTimer = 0;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.muzzleFlash.intensity = 0;
        this.flashSprite.visible = false;
      } else {
        const amount = this.flashTimer / FLASH_DURATION;
        const fadeCurve = amount * amount;
        this.muzzleFlash.intensity = fadeCurve * 3.2;
        (this.flashSprite.material as THREE.MeshBasicMaterial).opacity = fadeCurve * 0.95;
      }
    }

    this.recoilKick = THREE.MathUtils.damp(this.recoilKick, 0, 16, dt);
    this.reticleKick = THREE.MathUtils.damp(this.reticleKick, 0, RETICLE_KICK_DAMP, dt);
    this.sway.x = THREE.MathUtils.damp(
      this.sway.x,
      THREE.MathUtils.clamp(input.mouseDeltaX * 0.0008, -0.04, 0.04),
      12,
      dt
    );
    this.sway.y = THREE.MathUtils.damp(
      this.sway.y,
      THREE.MathUtils.clamp(input.mouseDeltaY * 0.0008, -0.035, 0.035),
      12,
      dt
    );

    const inertiaTargetX = THREE.MathUtils.clamp(-input.mouseDeltaX * 0.0015, -0.06, 0.06);
    const inertiaTargetY = THREE.MathUtils.clamp(-input.mouseDeltaY * 0.0012, -0.04, 0.04);
    this.inertiaOffset.x = THREE.MathUtils.damp(this.inertiaOffset.x, inertiaTargetX, 8, dt);
    this.inertiaOffset.y = THREE.MathUtils.damp(this.inertiaOffset.y, inertiaTargetY, 8, dt);

    const adsTarget = input.ads && !this.reloading ? 1 : 0;
    this.adsProgress = THREE.MathUtils.damp(this.adsProgress, adsTarget, ADS_LERP_SPEED, dt);
    if (this.adsProgress < 0.001) this.adsProgress = 0;
    if (this.adsProgress > 0.999) this.adsProgress = 1;

    const isMoving = input.forward || input.backward || input.left || input.right;
    this.viewBobTime += dt * (isMoving ? 10 : 3);
    this.updateViewModel(isMoving);
    this.updateTracers(dt);
  }

  updateProjectiles(
    dt: number,
    botMeshes: THREE.Object3D[],
    worldMeshes: THREE.Object3D[]
  ): WeaponProjectileImpact[] {
    const impacts: WeaponProjectileImpact[] = [];

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.age += dt;
      if (projectile.age >= projectile.maxAge) {
        this.removeProjectileAt(i);
        continue;
      }

      const previousPosition = projectile.mesh.position.clone();
      projectile.velocity.y -= projectile.gravity * dt;
      const nextPosition = previousPosition
        .clone()
        .addScaledVector(projectile.velocity, dt);
      const stepDirection = nextPosition.clone().sub(previousPosition);
      const stepDistance = stepDirection.length();

      if (stepDistance > 0.0001) {
        stepDirection.normalize();
        const botHit = raycast(previousPosition, stepDirection, botMeshes, stepDistance);
        const worldHit = raycast(previousPosition, stepDirection, worldMeshes, stepDistance);
        const directHit =
          botHit && (!worldHit || botHit.distance <= worldHit.distance) ? botHit : null;

        if (directHit || worldHit) {
          const impactPoint = (directHit?.point ?? worldHit?.point)?.clone();
          const impactEntity = directHit ? ((directHit.object.userData as BotData) ?? null) : null;
          if (impactPoint) {
            impacts.push({
              weaponId: projectile.weaponId,
              weaponName: getWeaponDefinition(projectile.weaponId).name,
              position: impactPoint,
              radius: projectile.splashRadius,
              directDamage: projectile.directDamage,
              splashDamage: projectile.splashDamage,
              directEntity: impactEntity,
            });
          }
          this.removeProjectileAt(i);
          continue;
        }
      }

      projectile.mesh.position.copy(nextPosition);
    }

    return impacts;
  }

  consumeFireInput(
    input: Pick<InputSnapshot, "fire" | "firePressed" | "fireReleased">,
    origin: THREE.Vector3,
    direction: THREE.Vector3
  ): WeaponDispatchResult {
    const activeDef = this.activeDefinition;
    const activeWeapon = this.activeWeapon;
    if (!activeDef || !activeWeapon) {
      return {
        fired: false,
        weaponId: null,
        weaponName: null,
        cameraKick: null,
        commands: [],
      };
    }

    if (activeDef.fireMode === "burst" && input.firePressed && this.canStartNewShot(activeDef)) {
      this.queuedBurstShots = activeDef.burstCount ?? 3;
      this.burstShotTimer = 0;
    }

    if (
      this.queuedBurstShots > 0 &&
      this.burstShotTimer <= 0 &&
      this.activeWeapon?.id === activeDef.id &&
      activeDef.fireMode === "burst" &&
      this.hasAmmoForShot()
    ) {
      const commands = this.buildHitscanCommands(
        activeDef,
        origin,
        direction,
        this.computeSpread(activeDef)
      );
      return {
        fired: true,
        weaponId: activeDef.id,
        weaponName: activeDef.name,
        cameraKick: activeDef.cameraRecoil,
        commands,
      };
    }

    if (this.reloading || this.fireCooldown > 0 || !this.hasAmmoForShot()) {
      if (activeDef.fireMode === "charge" && input.fireReleased && this.chargeTimer > 0) {
        this.chargeTimer = 0;
      }
      return {
        fired: false,
        weaponId: null,
        weaponName: null,
        cameraKick: null,
        commands: [],
      };
    }

    if (activeDef.fireMode === "semi" && input.firePressed && this.canStartNewShot(activeDef)) {
      const goldenShot = this.consumeGoldenChamber(activeDef);
      const damage = activeDef.damage * this.runtimeModifiers.damageMultiplier * (goldenShot ? 3 : 1);
      return {
        fired: true,
        weaponId: activeDef.id,
        weaponName: activeDef.name,
        cameraKick: activeDef.cameraRecoil,
        commands: [
          this.createRayCommand(
            activeDef,
            origin,
            direction,
            this.computeSpread(activeDef),
            damage,
            goldenShot ? 1.2 : 1,
            goldenShot
          ),
        ],
      };
    }

    if (activeDef.fireMode === "charge") {
      if (!input.fireReleased || this.chargeTimer <= 0) {
        return {
          fired: false,
          weaponId: null,
          weaponName: null,
          cameraKick: null,
          commands: [],
        };
      }

      const chargeRatio = THREE.MathUtils.clamp(
        this.chargeTimer / Math.max(0.001, activeDef.chargeTime ?? 0.65),
        0,
        1
      );
      this.chargeTimer = 0;
      const damage = THREE.MathUtils.lerp(
        activeDef.minChargeDamage ?? activeDef.damage,
        activeDef.maxChargeDamage ?? activeDef.damage,
        chargeRatio
      );
      const goldenShot = this.consumeGoldenChamber(activeDef);
      return {
        fired: true,
        weaponId: activeDef.id,
        weaponName: activeDef.name,
        cameraKick: activeDef.cameraRecoil,
        commands: [
          this.createRayCommand(
            activeDef,
            origin,
            direction,
            0,
            goldenShot ? damage * 3 : damage * this.runtimeModifiers.damageMultiplier,
            Math.max(1.1, 1 + chargeRatio * 0.8),
            goldenShot
          ),
        ],
      };
    }

    if (!input.fire) {
      return {
        fired: false,
        weaponId: null,
        weaponName: null,
        cameraKick: null,
        commands: [],
      };
    }

    if (activeDef.fireMode === "projectile") {
      this.fireProjectile(activeDef, direction);
      this.commitShot(activeDef);
      return {
        fired: true,
        weaponId: activeDef.id,
        weaponName: activeDef.name,
        cameraKick: activeDef.cameraRecoil,
        commands: [],
      };
    }

    if (activeDef.fireMode === "scatter") {
      const commands: WeaponRayCommand[] = [];
      const pellets = activeDef.pellets ?? 1;
      const spread = this.computeSpread(activeDef);
      const goldenShot = this.consumeGoldenChamber(activeDef);
      for (let i = 0; i < pellets; i++) {
        commands.push(
          this.createRayCommand(
            activeDef,
            origin,
            direction,
            spread,
            activeDef.damage * this.runtimeModifiers.damageMultiplier * (goldenShot ? 3 : 1),
            goldenShot ? 1.15 : 1,
            goldenShot
          )
        );
      }
      return {
        fired: true,
        weaponId: activeDef.id,
        weaponName: activeDef.name,
        cameraKick: activeDef.cameraRecoil,
        commands,
      };
    }

    return {
      fired: true,
      weaponId: activeDef.id,
      weaponName: activeDef.name,
      cameraKick: activeDef.cameraRecoil,
      commands: this.buildHitscanCommands(
        activeDef,
        origin,
        direction,
        this.computeSpread(activeDef)
      ),
    };
  }

  finalizeDispatch(result: WeaponDispatchResult): void {
    if (!result.fired || !result.weaponId) return;
    this.commitShot(getWeaponDefinition(result.weaponId));
  }

  startReload(): boolean {
    const activeWeapon = this.activeWeapon;
    const activeDef = this.activeDefinition;
    if (!activeWeapon || !activeDef) return false;
    if (this.reloading) return false;
    if (activeWeapon.ammo >= this.getMagazineCapacity(activeDef.id)) return false;
    if (activeWeapon.reserveAmmo <= 0) return false;

    this.reloading = true;
    this.reloadTimer = activeDef.reloadTime / this.runtimeModifiers.reloadSpeedMultiplier;
    this.chargeTimer = 0;
    return true;
  }

  refillActiveMagazinePercent(percent: number): void {
    const activeWeapon = this.activeWeapon;
    if (!activeWeapon) return;

    const capacity = this.getMagazineCapacity(activeWeapon.id);
    const missing = Math.max(0, capacity - activeWeapon.ammo);
    if (missing <= 0) return;

    const refillAmount = Math.min(
      missing,
      Math.max(1, Math.round(capacity * percent)),
      activeWeapon.reserveAmmo
    );
    if (refillAmount <= 0) return;

    activeWeapon.ammo += refillAmount;
    activeWeapon.reserveAmmo -= refillAmount;
  }

  quickSwap(): boolean {
    for (let i = 1; i <= 2; i++) {
      const nextSlot = (this.activeSlotIndex + i) % 3;
      if (this.slots[nextSlot]) return this.selectSlot(nextSlot);
    }
    return false;
  }

  selectSlot(index: number): boolean {
    if (index < 0 || index > 2) return false;
    if (index === this.activeSlotIndex) return false;
    if (!this.slots[index]) return false;

    this.activeSlotIndex = index;
    this.cancelTransientState();
    this.syncViewModelVisibility();
    return true;
  }

  canAutoCollectWeapon(weaponId: WeaponId): boolean {
    return this.findSlotByWeaponId(weaponId) !== -1 || this.findEmptySlotIndex() !== -1;
  }

  pickupWeapon(weaponId: WeaponId, replaceActive = false): PickupWeaponResult {
    const existingSlot = this.findSlotByWeaponId(weaponId);
    if (existingSlot !== -1) {
      const slot = this.slots[existingSlot];
      if (!slot) {
        return { kind: "ignored", slot: existingSlot };
      }
      const def = getWeaponDefinition(weaponId);
      const ammoAdded = Math.min(
        this.getMagazineCapacity(weaponId),
        Math.max(0, def.maxReserveAmmo - slot.reserveAmmo)
      );
      slot.reserveAmmo += ammoAdded;
      return { kind: "ammo", slot: existingSlot, amount: ammoAdded };
    }

    const emptySlot = this.findEmptySlotIndex();
    if (emptySlot !== -1) {
      this.slots[emptySlot] = createWeaponInstance(weaponId);
      this.goldenChamberReady[emptySlot] = false;
      const slot = this.slots[emptySlot];
      if (slot) {
        slot.ammo = this.getMagazineCapacity(weaponId);
      }
      if (!this.slots[this.activeSlotIndex]) {
        this.activeSlotIndex = emptySlot;
      }
      this.syncViewModelVisibility();
      return { kind: "stored", slot: emptySlot };
    }

    if (!replaceActive) {
      return { kind: "full", slot: this.activeSlotIndex };
    }

    this.slots[this.activeSlotIndex] = createWeaponInstance(weaponId);
    this.goldenChamberReady[this.activeSlotIndex] = false;
    if (this.slots[this.activeSlotIndex]) {
      this.slots[this.activeSlotIndex]!.ammo = this.getMagazineCapacity(weaponId);
    }
    this.cancelTransientState();
    this.syncViewModelVisibility();
    return { kind: "replaced", slot: this.activeSlotIndex };
  }

  clearTransientState(): void {
    this.cancelTransientState();
    this.flashTimer = 0;
    this.muzzleFlash.intensity = 0;
    this.flashSprite.visible = false;
  }

  resetForNewRun(startingWeaponId?: WeaponId): void {
    this.clearTransientState();
    this.removeAllProjectiles();
    this.removeAllTraces();
    this.slots = [createWeaponInstance(startingWeaponId ?? STARTER_WEAPON_ID), null, null];
    this.activeSlotIndex = 0;
    this.runtimeModifiers = { ...DEFAULT_RUNTIME_MODIFIERS };
    this.goldenChamberReady = [false, false, false];
    this.syncViewModelVisibility();
  }

  getInventoryState(): InventoryState {
    const activeDef = this.activeDefinition;
    return {
      slots: this.slots.map((slot, index) => {
        const def = slot ? getWeaponDefinition(slot.id) : null;
        return {
          index,
          weaponId: slot?.id ?? null,
          name: def?.name ?? null,
          shortName: def?.shortName ?? null,
          ammo: slot?.ammo ?? null,
          reserveAmmo: slot?.reserveAmmo ?? null,
        };
      }),
      activeSlot: this.activeSlotIndex,
      activeWeaponId: this.activeWeaponId,
      activeWeaponName: activeDef?.name ?? null,
      fireMode: activeDef?.fireMode ?? null,
      ammo: this.ammo,
      reserveAmmo: this.reserveAmmo,
      isReloading: this.reloading,
      chargeRatio:
        activeDef?.fireMode === "charge" && activeDef.chargeTime
          ? Number((this.chargeTimer / activeDef.chargeTime).toFixed(3))
          : 0,
      reticleSpread: Number(this.getReticleSpread().toFixed(3)),
      isADS: this.isADS,
    };
  }

  getProjectilesState(): ProjectileState[] {
    return this.projectiles.map((projectile) => ({
      id: projectile.id,
      weaponId: projectile.weaponId,
      position: projectile.mesh.position.clone(),
      velocity: projectile.velocity.clone(),
      radius: projectile.radius,
      age: projectile.age,
      maxAge: projectile.maxAge,
    }));
  }

  isReloading(): boolean {
    return this.reloading;
  }

  getTracerCount(): number {
    return this.tracers.length;
  }

  spawnTrace(
    weaponId: WeaponId,
    start: THREE.Vector3,
    end: THREE.Vector3,
    traceScale = 1,
    tracerColor?: number
  ): void {
    const def = getWeaponDefinition(weaponId);
    this.tempDirection.subVectors(end, start);
    const length = this.tempDirection.length();
    if (length < 0.001) return;

    const geometry = new THREE.CylinderGeometry(
      def.tracerWidth * traceScale * 0.45,
      def.tracerWidth * traceScale,
      1,
      10,
      1,
      true
    );
    const material = new THREE.MeshBasicMaterial({
      color: tracerColor ?? def.tracerColor,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const tracer = new THREE.Mesh(geometry, material);
    tracer.frustumCulled = false;
    tracer.renderOrder = 999;
    tracer.scale.set(1, length, 1);
    tracer.quaternion.setFromUnitVectors(UP_AXIS, this.tempDirection.normalize());
    this.tempMidpoint.copy(start).addScaledVector(this.tempDirection, length * 0.5);
    tracer.position.copy(this.tempMidpoint);
    this.scene.add(tracer);
    this.tracers.push({
      mesh: tracer,
      material,
      life: TRACE_LIFETIME,
      lifetime: TRACE_LIFETIME,
    });
  }

  dispose(): void {
    this.removeAllTraces();
    this.removeAllProjectiles();
    this.projectileGeometry.dispose();
    this.scene.remove(this.muzzleFlash);
    this.scene.remove(this.flashSprite);
    (this.flashSprite.geometry as THREE.BufferGeometry).dispose();
    (this.flashSprite.material as THREE.Material).dispose();

    for (const entry of Object.values(this.viewModels)) {
      this.scene.remove(entry.group);
      entry.group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      });
    }
  }

  private createRayCommand(
    def: ReturnType<typeof getWeaponDefinition>,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spread: number,
    damage = def.damage,
    traceScale = 1,
    goldenShot = false
  ): WeaponRayCommand {
    const shotDirection = direction.clone();
    if (spread > 0) {
      shotDirection.x += (Math.random() - 0.5) * spread;
      shotDirection.y += (Math.random() - 0.5) * spread * 0.45;
      shotDirection.z += (Math.random() - 0.5) * spread;
    }
    shotDirection.normalize();

    return {
      weaponId: def.id,
      weaponName: def.name,
      fireMode: def.fireMode,
      origin: origin.clone(),
      visualOrigin: this.getMuzzleWorldPosition(def.id),
      direction: shotDirection,
      range: def.range,
      damage,
      maxPierce: Math.max(
        1,
        (def.maxPierce ?? 1) + this.runtimeModifiers.pierceBonus + (goldenShot ? 1 : 0)
      ),
      traceScale,
      tracerColor: goldenShot ? 0xffd66b : undefined,
    };
  }

  private fireProjectile(
    def: ReturnType<typeof getWeaponDefinition>,
    direction: THREE.Vector3
  ): void {
    const material = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.emissive,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.2,
    });
    const projectile = new THREE.Mesh(this.projectileGeometry, material);
    const muzzle = this.getMuzzleWorldPosition(def.id);
    projectile.position.copy(muzzle);
    projectile.castShadow = false;
    projectile.receiveShadow = false;
    this.scene.add(projectile);

    const velocity = direction.clone().normalize().multiplyScalar(def.projectileSpeed ?? 24);
    this.projectiles.push({
      id: `projectile-${this.projectileIdCounter++}`,
      weaponId: def.id,
      mesh: projectile,
      material,
      velocity,
      radius: 0.18,
      age: 0,
      maxAge: def.projectileLifetime ?? 3.8,
      gravity: def.projectileGravity ?? 13,
      directDamage: def.damage * this.runtimeModifiers.damageMultiplier,
      splashDamage: (def.splashDamage ?? 0) * this.runtimeModifiers.damageMultiplier,
      splashRadius: def.splashRadius ?? 0,
    });
  }

  private commitShot(def: ReturnType<typeof getWeaponDefinition>): void {
    if (!this.activeWeapon || this.activeWeapon.id !== def.id) return;

    this.activeWeapon.ammo = Math.max(0, this.activeWeapon.ammo - 1);
    this.recoilKick = Math.min(
      this.recoilKick + def.recoil * this.runtimeModifiers.recoilMultiplier,
      1.4
    );
    this.reticleKick = Math.min(
      this.reticleKick + def.recoil * 0.22 * this.runtimeModifiers.recoilMultiplier,
      0.95
    );
    this.reloading = false;
    this.reloadTimer = 0;
    this.goldenChamberReady[this.activeSlotIndex] = false;

    if (def.fireMode === "burst") {
      this.queuedBurstShots = Math.max(0, this.queuedBurstShots - 1);
      if (this.queuedBurstShots > 0) {
        this.burstShotTimer = def.burstInterval ?? 0.05;
        this.fireCooldown = 0;
      } else {
        this.fireCooldown = def.fireRate / this.runtimeModifiers.fireRateMultiplier;
      }
    } else {
      this.fireCooldown = def.fireRate / this.runtimeModifiers.fireRateMultiplier;
    }

    const muzzle = this.getMuzzleWorldPosition(def.id);
    this.muzzleFlash.color.setHex(def.color);
    this.muzzleFlash.position.copy(muzzle);
    this.flashSprite.position.copy(muzzle);
    this.flashSprite.visible = true;
    const flashScale = 0.8 + Math.random() * 0.6;
    this.flashSprite.scale.setScalar(flashScale);
    this.flashSprite.rotation.z = Math.random() * Math.PI * 2;
    (this.flashSprite.material as THREE.MeshBasicMaterial).color.setHex(def.color);
    (this.flashSprite.material as THREE.MeshBasicMaterial).opacity = 0.95;
    this.muzzleFlash.intensity = 3.2;
    this.flashTimer = FLASH_DURATION;
  }

  private finishReload(): void {
    const activeWeapon = this.activeWeapon;
    const activeDef = this.activeDefinition;
    if (!activeWeapon || !activeDef) {
      this.reloading = false;
      return;
    }

    const needed = this.getMagazineCapacity(activeDef.id) - activeWeapon.ammo;
    const amount = Math.min(needed, activeWeapon.reserveAmmo);
    activeWeapon.ammo += amount;
    activeWeapon.reserveAmmo -= amount;
    this.reloading = false;
    this.reloadTimer = 0;
    if (this.runtimeModifiers.goldenChamber && amount > 0) {
      this.goldenChamberReady[this.activeSlotIndex] = true;
    }
  }

  private cancelTransientState(): void {
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.queuedBurstShots = 0;
    this.burstShotTimer = 0;
    this.chargeTimer = 0;
  }

  private findSlotByWeaponId(weaponId: WeaponId): number {
    return this.slots.findIndex((slot) => slot?.id === weaponId);
  }

  private findEmptySlotIndex(): number {
    return this.slots.findIndex((slot) => slot === null);
  }

  private hasAmmoForShot(): boolean {
    return Boolean(this.activeWeapon && this.activeWeapon.ammo > 0);
  }

  private canStartNewShot(def: ReturnType<typeof getWeaponDefinition>): boolean {
    return (
      this.activeWeapon?.id === def.id &&
      this.fireCooldown <= 0 &&
      !this.reloading &&
      this.queuedBurstShots === 0 &&
      this.hasAmmoForShot()
    );
  }

  private getReticleSpread(): number {
    const activeDef = this.activeDefinition;
    if (!activeDef) return 0;

    const baseByMode: Record<WeaponFireMode, number> = {
      auto: activeDef.id === "arc-smg" ? 0.4 : 0.18,
      burst: 0.15,
      scatter: 0.85,
      charge: 0.06,
      projectile: 0.24,
      semi: 0.04,
    };

    const base = baseByMode[activeDef.fireMode] + this.reticleKick;
    return base * THREE.MathUtils.lerp(1, 0.3, this.adsProgress);
  }

  private computeSpread(def: ReturnType<typeof getWeaponDefinition>): number {
    const scatterCoreMultiplier =
      this.runtimeModifiers.scatterCore && def.fireMode === "scatter" ? 0.78 : 1;
    const baseSpread =
      ((def.spread ?? 0) + def.moveSpread * (0.5 + this.reticleKick)) *
      this.runtimeModifiers.spreadMultiplier *
      scatterCoreMultiplier;
    // ADS tightens spread by up to 60%
    return baseSpread * THREE.MathUtils.lerp(1, 0.4, this.adsProgress);
  }

  private updateViewModel(isMoving: boolean): void {
    const activeId = this.activeWeaponId ?? STARTER_WEAPON_ID;
    const viewModel = this.viewModels[activeId].group;
    const ads = this.adsProgress;
    const hipFactor = 1 - ads;

    const bobStrength = (isMoving ? 1 : 0.3) * hipFactor;
    const bobX = Math.sin(this.viewBobTime) * 0.014 * bobStrength;
    const bobY = Math.abs(Math.cos(this.viewBobTime * 2)) * 0.01 * bobStrength;

    // Lerp base offset between hip and ADS positions
    this.tempOffset.lerpVectors(BASE_VIEWMODEL_OFFSET, ADS_VIEWMODEL_OFFSET, ads);
    this.tempOffset.x += bobX - this.sway.x * 1.4 * hipFactor + this.inertiaOffset.x * hipFactor;
    this.tempOffset.y += bobY + this.sway.y * 0.8 * hipFactor - this.recoilKick * 0.045 + this.inertiaOffset.y * hipFactor;
    this.tempOffset.z -= this.recoilKick * 0.11;
    this.tempOffset.applyQuaternion(this.camera.quaternion);

    viewModel.position.copy(this.camera.position).add(this.tempOffset);

    // Lerp rotation — ADS straightens the weapon to look down the sights
    const hipPitchBase = -0.08;
    const hipRollBase = -0.18;
    const adsPitchBase = -0.02;
    const adsRollBase = 0;
    this.tempEuler.set(
      THREE.MathUtils.lerp(hipPitchBase, adsPitchBase, ads)
        - this.sway.y * 1.3 * hipFactor + this.recoilKick * 0.14 + bobY * 0.6 * hipFactor + this.inertiaOffset.y * 0.8 * hipFactor,
      (this.sway.x * 0.55 + this.inertiaOffset.x * 0.6) * hipFactor,
      THREE.MathUtils.lerp(hipRollBase, adsRollBase, ads)
        - this.sway.x * 1.8 * hipFactor + bobX * 6 * hipFactor
    );
    this.tempRotation.setFromEuler(this.tempEuler);
    viewModel.quaternion.copy(this.camera.quaternion).multiply(this.tempRotation);
    viewModel.updateMatrixWorld(true);
  }

  private updateTracers(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.life -= dt;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        tracer.material.dispose();
        this.tracers.splice(i, 1);
        continue;
      }
      tracer.material.opacity = Math.max(0.25, tracer.life / tracer.lifetime);
    }
  }

  private removeProjectileAt(index: number): void {
    const [projectile] = this.projectiles.splice(index, 1);
    if (!projectile) return;
    this.scene.remove(projectile.mesh);
    projectile.material.dispose();
  }

  private removeAllProjectiles(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.removeProjectileAt(i);
    }
  }

  private removeAllTraces(): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      this.scene.remove(tracer.mesh);
      tracer.mesh.geometry.dispose();
      tracer.material.dispose();
    }
    this.tracers.length = 0;
  }

  private getMuzzleWorldPosition(weaponId: WeaponId): THREE.Vector3 {
    const entry = this.viewModels[weaponId];
    entry.group.updateMatrixWorld(true);
    return entry.anchor.getWorldPosition(this.muzzleWorldPosition.clone());
  }

  private syncViewModelVisibility(): void {
    const activeId = this.activeWeaponId;
    for (const [weaponId, entry] of Object.entries(this.viewModels) as Array<
      [WeaponId, ViewModelEntry]
    >) {
      entry.group.visible = weaponId === activeId;
    }
  }

  private buildHitscanCommands(
    def: ReturnType<typeof getWeaponDefinition>,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    spread: number
  ): WeaponRayCommand[] {
    const goldenShot = this.consumeGoldenChamber(def);
    const commands = [
      this.createRayCommand(
        def,
        origin,
        direction,
        spread,
        def.damage * this.runtimeModifiers.damageMultiplier * (goldenShot ? 3 : 1),
        goldenShot ? 1.2 : 1,
        goldenShot
      ),
    ];

    if (
      this.runtimeModifiers.scatterCore &&
      def.fireMode !== "scatter" &&
      def.fireMode !== "projectile"
    ) {
      commands.push(
        this.createRayCommand(
          def,
          origin,
          direction,
          spread + 0.024,
          def.damage * this.runtimeModifiers.damageMultiplier * 0.42,
          0.85,
          false
        )
      );
    }

    return commands;
  }

  private consumeGoldenChamber(def: ReturnType<typeof getWeaponDefinition>): boolean {
    if (!this.runtimeModifiers.goldenChamber) return false;
    if (def.fireMode === "projectile") return false;
    return this.goldenChamberReady[this.activeSlotIndex];
  }

  private getMagazineCapacity(
    weaponId: WeaponId,
    modifiers: RuntimeModifiers = this.runtimeModifiers
  ): number {
    const def = getWeaponDefinition(weaponId);
    return Math.max(1, Math.round(def.magazineSize * modifiers.magazineSizeMultiplier));
  }

  private createViewModel(weaponId: WeaponId): ViewModelEntry {
    const def = WEAPON_DEFINITIONS[weaponId];
    const group = new THREE.Group();
    group.renderOrder = 1000;
    this.scene.add(group);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5d6778,
      metalness: 0.72,
      roughness: 0.35,
      depthTest: false,
      depthWrite: false,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.emissive,
      emissiveIntensity: 0.42,
      metalness: 0.34,
      roughness: 0.42,
      depthTest: false,
      depthWrite: false,
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x161b24,
      metalness: 0.48,
      roughness: 0.48,
      depthTest: false,
      depthWrite: false,
    });
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0x8d674d,
      roughness: 0.88,
      metalness: 0.05,
      depthTest: false,
      depthWrite: false,
    });

    const addMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      position: THREE.Vector3,
      rotation?: THREE.Euler
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      if (rotation) mesh.rotation.copy(rotation);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1000;
      group.add(mesh);
      return mesh;
    };

    switch (weaponId) {
      case "vanguard-carbine":
        addMesh(new THREE.BoxGeometry(0.18, 0.14, 0.42), bodyMaterial, new THREE.Vector3(0.02, 0.02, -0.18));
        addMesh(new THREE.BoxGeometry(0.12, 0.1, 0.26), darkMaterial, new THREE.Vector3(-0.06, -0.01, 0.02));
        addMesh(new THREE.BoxGeometry(0.12, 0.1, 0.3), bodyMaterial, new THREE.Vector3(0.06, 0.02, -0.46));
        addMesh(new THREE.CylinderGeometry(0.026, 0.03, 0.52, 12), darkMaterial, new THREE.Vector3(0.08, 0.015, -0.7), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), accentMaterial, new THREE.Vector3(0.05, 0.12, -0.22));
        break;
      case "arc-smg":
        addMesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), bodyMaterial, new THREE.Vector3(0.01, 0.02, -0.12));
        addMesh(new THREE.BoxGeometry(0.09, 0.18, 0.14), accentMaterial, new THREE.Vector3(0.02, -0.1, -0.02), new THREE.Euler(0.18, 0, 0));
        addMesh(new THREE.CylinderGeometry(0.022, 0.025, 0.34, 10), darkMaterial, new THREE.Vector3(0.08, 0.02, -0.48), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.08, 0.08, 0.16), darkMaterial, new THREE.Vector3(-0.07, -0.01, 0.06));
        addMesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18), accentMaterial, new THREE.Vector3(0.04, 0.1, -0.2), new THREE.Euler(Math.PI / 2, 0, 0));
        break;
      case "scattershot":
        addMesh(new THREE.BoxGeometry(0.2, 0.16, 0.5), bodyMaterial, new THREE.Vector3(0.01, 0.03, -0.18));
        addMesh(new THREE.CylinderGeometry(0.035, 0.04, 0.62, 12), darkMaterial, new THREE.Vector3(0.08, 0.03, -0.74), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.16, 0.08, 0.22), accentMaterial, new THREE.Vector3(0.03, -0.05, -0.32));
        addMesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), darkMaterial, new THREE.Vector3(0.01, -0.17, -0.06), new THREE.Euler(0.38, 0, 0));
        addMesh(new THREE.BoxGeometry(0.13, 0.08, 0.2), darkMaterial, new THREE.Vector3(-0.08, -0.02, 0.04));
        break;
      case "helix-burst-rifle":
        addMesh(new THREE.BoxGeometry(0.18, 0.16, 0.5), bodyMaterial, new THREE.Vector3(0.01, 0.03, -0.22));
        addMesh(new THREE.BoxGeometry(0.12, 0.12, 0.24), accentMaterial, new THREE.Vector3(-0.06, 0.03, 0.08));
        addMesh(new THREE.CylinderGeometry(0.026, 0.03, 0.48, 10), darkMaterial, new THREE.Vector3(0.08, 0.025, -0.68), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.08, 0.06, 0.2), accentMaterial, new THREE.Vector3(0.04, 0.13, -0.18));
        addMesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), darkMaterial, new THREE.Vector3(0.0, -0.15, -0.18), new THREE.Euler(0.2, 0, 0));
        break;
      case "rail-lance":
        addMesh(new THREE.BoxGeometry(0.14, 0.14, 0.58), bodyMaterial, new THREE.Vector3(0.01, 0.03, -0.24));
        addMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.74, 12), accentMaterial, new THREE.Vector3(0.08, 0.04, -0.78), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.TorusGeometry(0.08, 0.016, 10, 20), accentMaterial, new THREE.Vector3(0.08, 0.04, -0.42), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.TorusGeometry(0.08, 0.016, 10, 20), accentMaterial, new THREE.Vector3(0.08, 0.04, -0.6), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.08, 0.24, 0.1), darkMaterial, new THREE.Vector3(0.01, -0.16, -0.04), new THREE.Euler(0.32, 0, 0));
        break;
      case "plasma-lobber":
        addMesh(new THREE.BoxGeometry(0.16, 0.16, 0.42), bodyMaterial, new THREE.Vector3(0.01, 0.03, -0.18));
        addMesh(new THREE.SphereGeometry(0.11, 12, 10), accentMaterial, new THREE.Vector3(0.06, 0.06, -0.48));
        addMesh(new THREE.CylinderGeometry(0.03, 0.04, 0.34, 12), darkMaterial, new THREE.Vector3(0.08, 0.02, -0.7), new THREE.Euler(Math.PI / 2, 0, 0));
        addMesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), accentMaterial, new THREE.Vector3(-0.02, -0.08, -0.12));
        addMesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), darkMaterial, new THREE.Vector3(0.01, -0.18, -0.02), new THREE.Euler(0.28, 0, 0));
        break;
      case "phantom-sniper":
        // Long sleek body
        addMesh(new THREE.BoxGeometry(0.12, 0.12, 0.62), bodyMaterial, new THREE.Vector3(0.02, 0.03, -0.26));
        // Long barrel
        addMesh(new THREE.CylinderGeometry(0.022, 0.026, 0.82, 12), darkMaterial, new THREE.Vector3(0.08, 0.03, -0.86), new THREE.Euler(Math.PI / 2, 0, 0));
        // Scope mount
        addMesh(new THREE.BoxGeometry(0.06, 0.04, 0.18), darkMaterial, new THREE.Vector3(0.02, 0.1, -0.22));
        // Scope tube
        addMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12), accentMaterial, new THREE.Vector3(0.02, 0.14, -0.22), new THREE.Euler(Math.PI / 2, 0, 0));
        // Bolt handle
        addMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.08, 8), accentMaterial, new THREE.Vector3(0.1, 0.06, -0.12), new THREE.Euler(0, 0, Math.PI / 2));
        // Stock
        addMesh(new THREE.BoxGeometry(0.1, 0.14, 0.22), darkMaterial, new THREE.Vector3(0.02, 0.0, 0.08));
        // Grip
        addMesh(new THREE.BoxGeometry(0.08, 0.22, 0.1), darkMaterial, new THREE.Vector3(0.02, -0.15, -0.08), new THREE.Euler(0.24, 0, 0));
        break;
    }

    addMesh(new THREE.BoxGeometry(0.09, 0.12, 0.22), handMaterial, new THREE.Vector3(0.1, -0.16, -0.34), new THREE.Euler(0.28, 0.08, -0.24));
    addMesh(new THREE.BoxGeometry(0.1, 0.14, 0.24), handMaterial, new THREE.Vector3(-0.08, -0.19, 0.02), new THREE.Euler(0.2, -0.12, 0.36));

    const anchor = new THREE.Object3D();
    anchor.position.set(0.08, 0.02, -0.92);
    if (weaponId === "scattershot") {
      anchor.position.set(0.08, 0.03, -0.98);
    }
    if (weaponId === "arc-smg") {
      anchor.position.set(0.08, 0.02, -0.62);
    }
    if (weaponId === "plasma-lobber") {
      anchor.position.set(0.08, 0.04, -0.82);
    }
    if (weaponId === "phantom-sniper") {
      anchor.position.set(0.08, 0.03, -1.22);
    }
    group.add(anchor);

    return { group, anchor };
  }
}
