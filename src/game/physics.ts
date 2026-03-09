import * as THREE from "three";
import { ArenaCollider } from "./types";

const GRAVITY = 20;
const JUMP_FORCE = 8;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;

export class PhysicsBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded = false;
  height: number;
  radius: number;

  constructor(
    pos: THREE.Vector3,
    height = PLAYER_HEIGHT,
    radius = PLAYER_RADIUS
  ) {
    this.position = pos.clone();
    this.velocity = new THREE.Vector3();
    this.height = height;
    this.radius = radius;
  }

  getAABB(): { min: THREE.Vector3; max: THREE.Vector3 } {
    return {
      min: new THREE.Vector3(
        this.position.x - this.radius,
        this.position.y,
        this.position.z - this.radius
      ),
      max: new THREE.Vector3(
        this.position.x + this.radius,
        this.position.y + this.height,
        this.position.z + this.radius
      ),
    };
  }

  getEyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + this.height * 0.9,
      this.position.z
    );
  }

  setHeight(height: number): void {
    this.height = height;
  }
}

export function applyGravity(body: PhysicsBody, dt: number): void {
  if (!body.isGrounded) {
    body.velocity.y -= GRAVITY * dt;
  }
}

export function jump(body: PhysicsBody): void {
  if (body.isGrounded) {
    body.velocity.y = JUMP_FORCE;
    body.isGrounded = false;
  }
}

function aabbOverlap(
  a: { min: THREE.Vector3; max: THREE.Vector3 },
  b: { min: THREE.Vector3; max: THREE.Vector3 }
): boolean {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

function createAABBForBody(
  position: THREE.Vector3,
  height: number,
  radius: number
): { min: THREE.Vector3; max: THREE.Vector3 } {
  return {
    min: new THREE.Vector3(position.x - radius, position.y, position.z - radius),
    max: new THREE.Vector3(
      position.x + radius,
      position.y + height,
      position.z + radius
    ),
  };
}

export function canOccupyBody(
  position: THREE.Vector3,
  height: number,
  radius: number,
  colliders: ArenaCollider[]
): boolean {
  const bodyAABB = createAABBForBody(position, height, radius);
  return !colliders.some((collider) => aabbOverlap(bodyAABB, collider));
}

export function moveAndCollide(
  body: PhysicsBody,
  movement: THREE.Vector3,
  colliders: ArenaCollider[],
  dt: number
): { landed: boolean; hitCeiling: boolean } {
  let landed = false;
  let hitCeiling = false;
  const wasGrounded = body.isGrounded;

  // Apply gravity
  applyGravity(body, dt);

  // Add vertical velocity to movement
  const totalMovement = movement.clone();
  totalMovement.y += body.velocity.y * dt;

  // Resolve each axis independently
  const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];

  for (const axis of axes) {
    body.position[axis] += totalMovement[axis];
    const bodyAABB = body.getAABB();

    for (const collider of colliders) {
      if (!aabbOverlap(bodyAABB, collider)) continue;

      // Calculate penetration and push out
      if (totalMovement[axis] > 0) {
        body.position[axis] = collider.min[axis] - body.radius - 0.001;
        if (axis === "y") {
          body.velocity.y = 0;
          hitCeiling = true;
        }
      } else if (totalMovement[axis] < 0) {
        if (axis === "y") {
          body.position.y = collider.max.y + 0.001;
          body.velocity.y = 0;
          body.isGrounded = true;
          landed = true;
        } else {
          body.position[axis] = collider.max[axis] + body.radius + 0.001;
        }
      }
    }
  }

  // Ground check: cast a tiny bit below
  const groundCheck = body.getAABB();
  groundCheck.min.y -= 0.05;
  let onGround = false;
  for (const collider of colliders) {
    if (aabbOverlap(groundCheck, collider)) {
      onGround = true;
      break;
    }
  }
  body.isGrounded = onGround;
  if (!landed && !wasGrounded && onGround && body.velocity.y <= 0) {
    landed = true;
  }

  return { landed, hitCeiling };
}

export function raycast(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  meshes: THREE.Object3D[],
  maxDistance = 100
): THREE.Intersection | null {
  const raycaster = new THREE.Raycaster(origin, direction.normalize(), 0, maxDistance);
  const intersections = raycaster.intersectObjects(meshes, false);
  return intersections.length > 0 ? intersections[0] : null;
}
