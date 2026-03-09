import * as THREE from "three";
import { InputSnapshot } from "./input";
import { MovementState, WeaponCameraRecoilProfile } from "./types";

const MAX_BOB_OFFSET = 0.035;
const MAX_ROLL = THREE.MathUtils.degToRad(2);
const MAX_FOV_KICK = 4;
const BOB_SMOOTH = 14;
const ROLL_SMOOTH = 12;
const FOV_SMOOTH = 10;
const LANDING_RECOVERY = 12;
const SLIDE_OFFSET_SMOOTH = 14;
const DEFAULT_RECOIL_ATTACK = 34;
const DEFAULT_RECOIL_RECOVER = 15;
const MAX_RECOIL_PITCH = THREE.MathUtils.degToRad(4.5);
const MAX_RECOIL_YAW = THREE.MathUtils.degToRad(1.4);
const MAX_RECOIL_ROLL = THREE.MathUtils.degToRad(1.8);
const MAX_RECOIL_BACK = 0.06;
const MAX_RECOIL_DROP = 0.02;

interface MovementCameraEffects {
  dt: number;
  grounded: boolean;
  horizontalSpeed: number;
  strafeSpeed: number;
  movementState: MovementState;
  landed: boolean;
  landingSpeed: number;
  basePosition: THREE.Vector3;
  effectSpeed: number;
  adsAmount?: number;
}

export class FPSCamera {
  camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0;
  private sensitivity: number;
  private readonly euler = new THREE.Euler(0, 0, 0, "YXZ");
  private readonly localOffset = new THREE.Vector3();
  private readonly worldOffset = new THREE.Vector3();
  private baseFov: number;
  private bobTime = 0;
  private bobX = 0;
  private bobY = 0;
  private movementRoll = 0;
  private landingOffset = 0;
  private slideOffset = 0;
  private recoilPitch = 0;
  private recoilYaw = 0;
  private recoilRoll = 0;
  private recoilBack = 0;
  private recoilDrop = 0;
  private recoilPitchVelocity = 0;
  private recoilYawVelocity = 0;
  private recoilRollVelocity = 0;
  private recoilBackVelocity = 0;
  private recoilDropVelocity = 0;
  private recoilAttack = DEFAULT_RECOIL_ATTACK;
  private recoilRecover = DEFAULT_RECOIL_RECOVER;
  private yawPolarity = 1;
  private shakeMagnitude = 0;
  private shakeDecay = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private breathTime = 0;
  private adsBlend = 0;
  private adsFov = 0;

  constructor(fov: number, aspect: number, sensitivity: number) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
    this.sensitivity = sensitivity;
    this.baseFov = fov;
    this.adsFov = fov * 0.72;
  }

  get adsAmount(): number {
    return this.adsBlend;
  }

  setADSZoom(factor: number): void {
    this.adsFov = this.baseFov * factor;
  }

  updateADS(ads: boolean, dt: number): void {
    const target = ads ? 1 : 0;
    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, target, 14, dt);
    if (Math.abs(this.adsBlend - target) < 0.001) this.adsBlend = target;
  }

  update(input: InputSnapshot, dt: number): void {
    const sensScale = THREE.MathUtils.lerp(1, 0.55, this.adsBlend);
    this.yaw -= input.mouseDeltaX * this.sensitivity * sensScale;
    this.pitch -= input.mouseDeltaY * this.sensitivity * sensScale;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    this.updateShotRecoil(dt);
    this.syncOrientation();
    this.setPosition(this.camera.position);
  }

  setPosition(pos: THREE.Vector3): void {
    this.camera.position.copy(pos);
  }

  applyShotImpulse(profile: WeaponCameraRecoilProfile | null): void {
    if (!profile) return;

    this.recoilAttack = profile.attack;
    this.recoilRecover = profile.recover;

    const yawDirection = this.yawPolarity;
    this.yawPolarity *= -1;

    const pitchAmount = THREE.MathUtils.degToRad(profile.pitchDeg);
    const yawAmount = THREE.MathUtils.degToRad(
      profile.yawDeg * (1 + profile.yawVariance * 0.5)
    );
    const rollAmount = THREE.MathUtils.degToRad(
      profile.rollDeg * (1 + profile.yawVariance * 0.2)
    );

    this.recoilPitch = Math.min(
      MAX_RECOIL_PITCH,
      this.recoilPitch + pitchAmount
    );
    this.recoilYaw = THREE.MathUtils.clamp(
      this.recoilYaw + yawAmount * yawDirection,
      -MAX_RECOIL_YAW,
      MAX_RECOIL_YAW
    );
    this.recoilRoll = THREE.MathUtils.clamp(
      this.recoilRoll - rollAmount * yawDirection,
      -MAX_RECOIL_ROLL,
      MAX_RECOIL_ROLL
    );
    this.recoilBack = Math.min(MAX_RECOIL_BACK, this.recoilBack + profile.backOffset);
    this.recoilDrop = Math.min(MAX_RECOIL_DROP, this.recoilDrop + profile.dropOffset);

    this.recoilPitchVelocity += pitchAmount * profile.attack * 0.08;
    this.recoilYawVelocity += yawAmount * yawDirection * profile.attack * 0.04;
    this.recoilRollVelocity -= rollAmount * yawDirection * profile.attack * 0.05;
    this.recoilBackVelocity += profile.backOffset * profile.attack * 0.08;
    this.recoilDropVelocity += profile.dropOffset * profile.attack * 0.08;
  }

  applyDamageShake(intensity: number): void {
    this.shakeMagnitude = THREE.MathUtils.clamp(intensity * 0.012, 0.01, 0.06);
    this.shakeDecay = 0.25;
  }

  applyMovementEffects({
    dt,
    grounded,
    horizontalSpeed,
    strafeSpeed,
    movementState,
    landed,
    landingSpeed,
    basePosition,
    effectSpeed,
    adsAmount = 0,
  }: MovementCameraEffects): void {
    const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / Math.max(effectSpeed, 0.001), 0, 1.25);
    const shouldBob = grounded && horizontalSpeed > 0.1 && movementState !== "dash";
    const bobAmplitude = shouldBob ? MAX_BOB_OFFSET * speedRatio : 0;

    if (shouldBob) {
      this.bobTime += dt * (4.8 + speedRatio * 5.6);
    }

    this.breathTime += dt;

    if (this.shakeDecay > 0) {
      this.shakeDecay -= dt;
      const t = Math.max(0, this.shakeDecay) / 0.25;
      const mag = this.shakeMagnitude * t;
      const now = performance.now();
      this.shakeOffset.x = Math.sin(now * 0.043) * mag;
      this.shakeOffset.y = Math.sin(now * 0.037) * mag * 0.8;
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    const targetBobX = shouldBob ? Math.sin(this.bobTime) * bobAmplitude * 0.35 : 0;
    const targetBobY = shouldBob ? Math.sin(this.bobTime * 2) * bobAmplitude : 0;
    const bobAlpha = 1 - Math.exp(-BOB_SMOOTH * dt);
    this.bobX = THREE.MathUtils.lerp(this.bobX, targetBobX, bobAlpha);
    this.bobY = THREE.MathUtils.lerp(this.bobY, targetBobY, bobAlpha);

    if (landed) {
      this.landingOffset = Math.max(
        this.landingOffset,
        Math.min(0.05, landingSpeed * 0.0032)
      );
    }
    this.landingOffset = THREE.MathUtils.lerp(
      this.landingOffset,
      0,
      1 - Math.exp(-LANDING_RECOVERY * dt)
    );

    const targetSlideOffset = movementState === "slide" ? -0.04 : 0;
    this.slideOffset = THREE.MathUtils.lerp(
      this.slideOffset,
      targetSlideOffset,
      1 - Math.exp(-SLIDE_OFFSET_SMOOTH * dt)
    );

    const targetRoll = grounded
      ? THREE.MathUtils.clamp(
          -(strafeSpeed / Math.max(effectSpeed, 0.001)) * MAX_ROLL,
          -MAX_ROLL,
          MAX_ROLL
        )
      : 0;
    this.movementRoll = THREE.MathUtils.lerp(
      this.movementRoll,
      targetRoll,
      1 - Math.exp(-ROLL_SMOOTH * dt)
    );

    const dashKick = movementState === "dash" ? 0.8 : 0;
    const hipFov = this.baseFov + speedRatio * MAX_FOV_KICK + dashKick;
    const targetFov = THREE.MathUtils.lerp(hipFov, this.adsFov, this.adsBlend);
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      1 - Math.exp(-FOV_SMOOTH * dt)
    );
    this.camera.updateProjectionMatrix();

    const breathScale = 1 - THREE.MathUtils.clamp(speedRatio * 2, 0, 1);
    const breathX = Math.sin(this.breathTime * 1.6) * 0.0008 * breathScale;
    const breathY = Math.sin(this.breathTime * 1.1) * 0.0012 * breathScale;

    this.localOffset.set(
      this.bobX + this.shakeOffset.x + breathX,
      this.bobY + this.slideOffset - this.landingOffset + this.shakeOffset.y + breathY,
      0
    );
    this.localOffset.y -= this.recoilDrop;
    this.localOffset.z += this.recoilBack;
    this.syncOrientation();
    this.worldOffset.copy(this.localOffset).applyQuaternion(this.camera.quaternion);
    this.camera.position.copy(basePosition).add(this.worldOffset);
  }

  getShotRecoilState(): {
    pitch: number;
    yaw: number;
    roll: number;
    back: number;
    drop: number;
  } {
    return {
      pitch: this.recoilPitch,
      yaw: this.recoilYaw,
      roll: this.recoilRoll,
      back: this.recoilBack,
      drop: this.recoilDrop,
    };
  }

  getForward(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  getRight(): THREE.Vector3 {
    const dir = new THREE.Vector3(1, 0, 0);
    dir.applyQuaternion(this.camera.quaternion);
    return dir;
  }

  applyDeathTilt(dt: number): void {
    this.pitch = THREE.MathUtils.lerp(this.pitch, -0.35, 1 - Math.exp(-1.8 * dt));
    this.movementRoll = THREE.MathUtils.lerp(this.movementRoll, THREE.MathUtils.degToRad(12), 1 - Math.exp(-1.4 * dt));
    this.syncOrientation();
  }

  setSensitivity(s: number): void {
    this.sensitivity = s;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setYaw(yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0;
    this.movementRoll = 0;
    this.syncOrientation();
  }

  resetMotionEffects(): void {
    this.bobTime = 0;
    this.bobX = 0;
    this.bobY = 0;
    this.movementRoll = 0;
    this.landingOffset = 0;
    this.slideOffset = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.recoilRoll = 0;
    this.recoilBack = 0;
    this.recoilDrop = 0;
    this.recoilPitchVelocity = 0;
    this.recoilYawVelocity = 0;
    this.recoilRollVelocity = 0;
    this.recoilBackVelocity = 0;
    this.recoilDropVelocity = 0;
    this.recoilAttack = DEFAULT_RECOIL_ATTACK;
    this.recoilRecover = DEFAULT_RECOIL_RECOVER;
    this.yawPolarity = 1;
    this.shakeMagnitude = 0;
    this.shakeDecay = 0;
    this.shakeOffset.set(0, 0, 0);
    this.breathTime = 0;
    this.adsBlend = 0;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.syncOrientation();
  }

  private updateShotRecoil(dt: number): void {
    [this.recoilPitch, this.recoilPitchVelocity] = this.advanceSpring(
      this.recoilPitch,
      this.recoilPitchVelocity,
      dt
    );
    [this.recoilYaw, this.recoilYawVelocity] = this.advanceSpring(
      this.recoilYaw,
      this.recoilYawVelocity,
      dt
    );
    [this.recoilRoll, this.recoilRollVelocity] = this.advanceSpring(
      this.recoilRoll,
      this.recoilRollVelocity,
      dt
    );
    [this.recoilBack, this.recoilBackVelocity] = this.advanceSpring(
      this.recoilBack,
      this.recoilBackVelocity,
      dt
    );
    [this.recoilDrop, this.recoilDropVelocity] = this.advanceSpring(
      this.recoilDrop,
      this.recoilDropVelocity,
      dt
    );
  }

  private advanceSpring(value: number, velocity: number, dt: number): [number, number] {
    const kicking = velocity > 0 && value > 0;
    const stiffness = kicking ? this.recoilAttack * 1.2 : this.recoilAttack;
    const damping = kicking ? this.recoilRecover * 0.6 : this.recoilRecover * 1.4;
    const acceleration = -value * stiffness - velocity * damping;
    const nextVelocity = velocity + acceleration * dt;
    const nextValue = value + nextVelocity * dt;

    if (Math.abs(nextValue) < 0.00001 && Math.abs(nextVelocity) < 0.00001) {
      return [0, 0];
    }

    return [nextValue, nextVelocity];
  }

  private syncOrientation(): void {
    this.euler.set(
      THREE.MathUtils.clamp(
        this.pitch + this.recoilPitch,
        -Math.PI / 2 + 0.01,
        Math.PI / 2 - 0.01
      ),
      this.yaw + this.recoilYaw,
      this.movementRoll + this.recoilRoll,
      "YXZ"
    );
    this.camera.quaternion.setFromEuler(this.euler);
  }
}
