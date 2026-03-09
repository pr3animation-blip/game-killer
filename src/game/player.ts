import * as THREE from "three";
import { InputSnapshot } from "./input";
import { FPSCamera } from "./camera";
import { PhysicsBody, canOccupyBody, moveAndCollide, jump } from "./physics";
import { ArenaCollider, MovementState, RuntimeModifiers, SpawnPoint } from "./types";
import { DEFAULT_RUNTIME_MODIFIERS } from "./progression";

const WALK_SPEED = 7.2;
const SPRINT_SPEED = 10.2;
const GROUND_ACCEL = 38;
const GROUND_FRICTION = 7.5;
const STOP_SPEED = 2.5;
const AIR_ACCEL = 10;
const AIR_CONTROL_CAP = 9.2;
const COYOTE_TIME = 0.09;
const JUMP_BUFFER_TIME = 0.12;
const SLIDE_DURATION = 0.5;
const SLIDE_HEIGHT = 1;
const SLIDE_ENTRY_SPEED = 8.8;
const SLIDE_MIN_SPEED = 10.8;
const SLIDE_MAX_SPEED = 12.4;
const SLIDE_EXIT_SPEED = 6.8;
const SLIDE_JUMP_BOOST = 1.2;
const SLIDE_JUMP_MAX_SPEED = 12.8;
const SLIDE_FRICTION = 2.2;
const SLIDE_STEER_ACCEL = 6;
const DASH_DURATION = 0.09;
const DASH_SPEED = 13;
const DASH_COOLDOWN = 1.25;
const DEFAULT_HEIGHT = 1.7;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class Player {
  body: PhysicsBody;
  camera: FPSCamera;
  health = 100;
  maxHealth = 100;
  isAlive = true;
  score = 0;
  deaths = 0;
  movementState: MovementState = "walk";
  dashCooldown = 0;
  slideTimer = 0;
  currentMoveSpeed = 0;
  private targetHeight = DEFAULT_HEIGHT;

  private dashTimer = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpHeld = false;
  private sprintingIntent = false;
  private readonly planarVelocity = new THREE.Vector3();
  private readonly wishDirection = new THREE.Vector3();
  private readonly tempForward = new THREE.Vector3();
  private readonly tempRight = new THREE.Vector3();
  private readonly tempMovement = new THREE.Vector3();
  private readonly tempStart = new THREE.Vector3();
  private readonly tempDir = new THREE.Vector3();
  private readonly dashDirection = new THREE.Vector3();
  private readonly tempLaunch = new THREE.Vector3();
  private dashCooldownScale = 1;
  private dashSpeedScale = 1;
  private moveSpeedScale = 1;
  private airAccelScale = 1;
  private blinkDashEnabled = false;
  private invulnerabilityTimer = 0;
  private dashTriggered = false;

  constructor(spawn: SpawnPoint, fov: number, aspect: number, sensitivity: number) {
    this.body = new PhysicsBody(spawn.position.clone(), DEFAULT_HEIGHT);
    this.camera = new FPSCamera(fov, aspect, sensitivity);
    this.camera.setYaw(spawn.rotation);
    this.camera.resetMotionEffects();
    this.camera.setPosition(this.body.getEyePosition());
  }

  update(input: InputSnapshot, colliders: ArenaCollider[], dt: number): void {
    if (!this.isAlive) return;

    this.dashTriggered = false;
    this.camera.update(input, dt);
    this.tickTimers(dt);
    this.resolveMovementIntent(input);
    this.queueJump(input);
    this.tryStartDash(input);
    this.tryStartSlide(input);
    this.tryJump();

    this.tempStart.copy(this.body.position);
    const landingSpeed = Math.max(0, -this.body.velocity.y);

    this.applyHorizontalMovement(input, dt);

    this.tempMovement.set(
      this.planarVelocity.x * dt,
      0,
      this.planarVelocity.z * dt
    );
    const movementResult = moveAndCollide(this.body, this.tempMovement, colliders, dt);

    this.resolveBlockedAxes();
    if (!this.body.isGrounded && this.slideTimer > 0) {
      this.endSlide();
    }

    if (this.body.isGrounded) {
      this.coyoteTimer = COYOTE_TIME;
    }
    if (this.slideTimer > 0 && this.getHorizontalSpeed() < SLIDE_EXIT_SPEED) {
      this.endSlide();
    }

    this.resolveSlideHeight(colliders);
    // Smooth height transitions using exponential damping
    const heightAlpha = 1 - Math.exp(-14 * dt);
    this.body.setHeight(THREE.MathUtils.lerp(this.body.height, this.targetHeight, heightAlpha));
    this.currentMoveSpeed = this.getHorizontalSpeed();
    this.updateMovementState();
    this.camera.applyMovementEffects({
      dt,
      grounded: this.body.isGrounded,
      horizontalSpeed: this.currentMoveSpeed,
      strafeSpeed: this.planarVelocity.dot(this.tempRight),
      movementState: this.movementState,
      landed: movementResult.landed,
      landingSpeed,
      basePosition: this.body.getEyePosition(),
      effectSpeed: SPRINT_SPEED,
    });
  }

  launch(impulse: THREE.Vector3): void {
    this.tempLaunch.copy(impulse);
    this.planarVelocity.set(this.tempLaunch.x, 0, this.tempLaunch.z);
    this.body.velocity.y = Math.max(this.body.velocity.y, this.tempLaunch.y);
    this.body.isGrounded = false;
    this.coyoteTimer = 0;
    this.dashTimer = 0;
    this.endSlide();
    this.targetHeight = DEFAULT_HEIGHT;
    this.currentMoveSpeed = this.getHorizontalSpeed();
    this.movementState = "air";
  }

  takeDamage(amount: number): boolean {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.isAlive = false;
      this.deaths++;
      return true;
    }
    return false;
  }

  respawn(spawn: SpawnPoint): void {
    this.body.position.copy(spawn.position);
    this.body.velocity.set(0, 0, 0);
    this.body.isGrounded = false;
    this.targetHeight = DEFAULT_HEIGHT;
    this.body.setHeight(DEFAULT_HEIGHT);
    this.planarVelocity.set(0, 0, 0);
    this.slideTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHeld = false;
    this.sprintingIntent = false;
    this.invulnerabilityTimer = 0;
    this.dashTriggered = false;
    this.currentMoveSpeed = 0;
    this.movementState = "walk";
    this.health = this.maxHealth;
    this.isAlive = true;
    this.camera.setYaw(spawn.rotation);
    this.camera.resetMotionEffects();
    this.camera.setPosition(this.body.getEyePosition());
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  getDashCooldown(): number {
    return Number(Math.max(0, this.dashCooldown).toFixed(2));
  }

  isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  consumeDashTriggered(): boolean {
    const triggered = this.dashTriggered;
    this.dashTriggered = false;
    return triggered;
  }

  applyRuntimeModifiers(modifiers: RuntimeModifiers = DEFAULT_RUNTIME_MODIFIERS): void {
    this.dashCooldownScale = THREE.MathUtils.clamp(
      modifiers.dashCooldownMultiplier,
      0.35,
      1.5
    );
    this.dashSpeedScale = Math.max(0.8, modifiers.dashSpeedMultiplier);
    this.moveSpeedScale = Math.max(0.8, modifiers.moveSpeedMultiplier);
    this.airAccelScale = Math.max(0.75, modifiers.airAccelMultiplier);
    this.blinkDashEnabled = modifiers.blinkDash;
  }

  getHorizontalSpeed(): number {
    this.tempDir.copy(this.planarVelocity);
    this.tempDir.y = 0;
    return this.tempDir.length();
  }

  getVerticalSpeed(): number {
    return Number(this.body.velocity.y.toFixed(2));
  }

  private tickTimers(dt: number): void {
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.slideTimer = Math.max(0, this.slideTimer - dt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    if (this.body.isGrounded) {
      this.coyoteTimer = COYOTE_TIME;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
  }

  private resolveMovementIntent(input: InputSnapshot): void {
    this.tempForward.copy(this.camera.getForward());
    this.tempForward.y = 0;
    if (this.tempForward.lengthSq() === 0) {
      this.tempForward.set(0, 0, -1);
    } else {
      this.tempForward.normalize();
    }

    this.tempRight.crossVectors(this.tempForward, WORLD_UP).normalize();

    this.wishDirection.set(0, 0, 0);
    if (input.forward) this.wishDirection.add(this.tempForward);
    if (input.backward) this.wishDirection.sub(this.tempForward);
    if (input.right) this.wishDirection.add(this.tempRight);
    if (input.left) this.wishDirection.sub(this.tempRight);

    if (this.wishDirection.lengthSq() > 0) {
      this.wishDirection.normalize();
    }

    this.sprintingIntent =
      input.sprint &&
      this.wishDirection.lengthSq() > 0 &&
      this.body.isGrounded &&
      this.slideTimer <= 0 &&
      this.dashTimer <= 0;
  }

  private queueJump(input: InputSnapshot): void {
    if (input.jump && !this.jumpHeld) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    }
    this.jumpHeld = input.jump;
  }

  private tryStartDash(input: InputSnapshot): void {
    if (!input.dash || this.dashCooldown > 0 || this.dashTimer > 0) return;

    this.dashDirection.copy(this.wishDirection);
    if (this.dashDirection.lengthSq() === 0) {
      this.dashDirection.copy(this.tempForward);
    }
    this.dashDirection.y = 0;
    if (this.dashDirection.lengthSq() === 0) {
      this.dashDirection.set(0, 0, -1);
    } else {
      this.dashDirection.normalize();
    }

    this.dashTimer = DASH_DURATION;
    this.dashCooldown = DASH_COOLDOWN * this.dashCooldownScale;
    this.endSlide();
    this.targetHeight = DEFAULT_HEIGHT;
    this.planarVelocity
      .copy(this.dashDirection)
      .multiplyScalar(DASH_SPEED * this.dashSpeedScale);
    this.dashTriggered = true;
    if (this.blinkDashEnabled) {
      this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer, DASH_DURATION + 0.05);
    }
  }

  private tryStartSlide(input: InputSnapshot): void {
    const currentSpeed = this.getHorizontalSpeed();
    if (
      !input.slide ||
      !this.body.isGrounded ||
      this.slideTimer > 0 ||
      this.dashTimer > 0 ||
      currentSpeed < SLIDE_ENTRY_SPEED
    ) {
      return;
    }

    this.slideTimer = SLIDE_DURATION;
    this.targetHeight = SLIDE_HEIGHT;

    this.tempDir.copy(this.planarVelocity);
    this.tempDir.y = 0;
    if (this.tempDir.lengthSq() === 0) {
      this.tempDir.copy(this.wishDirection);
    }
    if (this.tempDir.lengthSq() === 0) {
      this.tempDir.copy(this.tempForward);
    }
    this.tempDir.normalize();

    const slideSpeed = THREE.MathUtils.clamp(
      Math.max(currentSpeed * 1.12, SLIDE_MIN_SPEED),
      SLIDE_MIN_SPEED,
      SLIDE_MAX_SPEED
    );
    this.planarVelocity.copy(this.tempDir).multiplyScalar(slideSpeed);
  }

  private tryJump(): void {
    if (this.jumpBufferTimer <= 0) return;
    if (!this.body.isGrounded && this.coyoteTimer <= 0) return;

    const wasSliding = this.slideTimer > 0;
    jump(this.body);
    this.body.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    if (!wasSliding) return;

    const boostedSpeed = Math.min(
      this.getHorizontalSpeed() * SLIDE_JUMP_BOOST,
      SLIDE_JUMP_MAX_SPEED
    );
    if (boostedSpeed > 0) {
      this.planarVelocity.setLength(boostedSpeed);
    }
    this.endSlide();
    this.targetHeight = DEFAULT_HEIGHT;
  }

  private applyHorizontalMovement(input: InputSnapshot, dt: number): void {
    const wishSpeed =
      (this.sprintingIntent ? SPRINT_SPEED : WALK_SPEED) * this.moveSpeedScale;

    if (this.dashTimer > 0) {
      this.planarVelocity
        .copy(this.dashDirection)
        .multiplyScalar(DASH_SPEED * this.dashSpeedScale);
      return;
    }

    if (this.slideTimer > 0) {
      this.applyFriction(SLIDE_FRICTION, 0, dt);
      if (this.wishDirection.lengthSq() > 0) {
        this.accelerate(this.wishDirection, wishSpeed, SLIDE_STEER_ACCEL, dt);
      }
      return;
    }

    if (this.body.isGrounded) {
      this.applyFriction(GROUND_FRICTION, STOP_SPEED * this.moveSpeedScale, dt);
      if (this.wishDirection.lengthSq() > 0) {
        this.accelerate(
          this.wishDirection,
          wishSpeed,
          GROUND_ACCEL * this.moveSpeedScale,
          dt
        );
      }
      return;
    }

    if (this.wishDirection.lengthSq() > 0) {
      this.accelerate(
        this.wishDirection,
        Math.min(wishSpeed, AIR_CONTROL_CAP * this.moveSpeedScale),
        AIR_ACCEL * this.airAccelScale,
        dt
      );
    }
  }

  private applyFriction(friction: number, stopSpeed: number, dt: number): void {
    const speed = this.getHorizontalSpeed();
    if (speed < 0.0001) {
      this.planarVelocity.set(0, 0, 0);
      return;
    }

    const control = Math.max(speed, stopSpeed);
    const drop = control * friction * dt;
    const newSpeed = Math.max(0, speed - drop);

    if (newSpeed === speed) return;
    this.planarVelocity.multiplyScalar(newSpeed / speed);
  }

  private accelerate(
    wishDirection: THREE.Vector3,
    wishSpeed: number,
    accel: number,
    dt: number
  ): void {
    if (wishDirection.lengthSq() === 0 || wishSpeed <= 0) return;

    const currentSpeed = this.planarVelocity.dot(wishDirection);
    const addSpeed = wishSpeed - currentSpeed;
    if (addSpeed <= 0) return;

    const accelSpeed = Math.min(addSpeed, accel * dt * wishSpeed);
    this.planarVelocity.addScaledVector(wishDirection, accelSpeed);
  }

  private resolveBlockedAxes(): void {
    const movedX = this.body.position.x - this.tempStart.x;
    const movedZ = this.body.position.z - this.tempStart.z;
    const blockedX = Math.abs(movedX - this.tempMovement.x) > 0.0005;
    const blockedZ = Math.abs(movedZ - this.tempMovement.z) > 0.0005;

    if (blockedX) this.planarVelocity.x = 0;
    if (blockedZ) this.planarVelocity.z = 0;
  }

  private resolveSlideHeight(colliders: ArenaCollider[]): void {
    if (this.slideTimer > 0) {
      this.targetHeight = SLIDE_HEIGHT;
      return;
    }

    if (
      this.targetHeight < DEFAULT_HEIGHT &&
      canOccupyBody(this.body.position, DEFAULT_HEIGHT, this.body.radius, colliders)
    ) {
      this.targetHeight = DEFAULT_HEIGHT;
    }
  }

  private endSlide(): void {
    this.slideTimer = 0;
  }

  private updateMovementState(): void {
    if (this.dashTimer > 0) {
      this.movementState = "dash";
      return;
    }

    if (this.body.height < DEFAULT_HEIGHT || this.slideTimer > 0) {
      this.movementState = "slide";
      return;
    }

    if (!this.body.isGrounded) {
      this.movementState = "air";
      return;
    }

    if (this.sprintingIntent && this.currentMoveSpeed > 0.1) {
      this.movementState = "sprint";
      return;
    }

    this.movementState = "walk";
  }
}
