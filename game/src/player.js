// The player: on foot (walk / run / punch) and in a car (arcade
// driving with acceleration, steering, handbrake and collisions).
// Stealing a car makes its driver bail out and raises the wanted level.
// The player mesh is a distinct figure — dark jacket, red cap — so it
// reads clearly in screenshots.

import * as THREE from 'three';
import { PLAYER, CAR, POLICE } from './config.js';
import { makePedMesh } from './pedestrians.js';

const PLAYER_SHIRT = 0x2c2c34;
const PLAYER_SKIN = 0xe8b88a;

export class Player {
  constructor(scene, spawn, isBlocked) {
    this.scene = scene;
    this.isBlocked = isBlocked;
    this.mesh = makePedMesh(PLAYER_SHIRT, PLAYER_SKIN);
    // Red cap so the player stands out from the crowd.
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.12, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    cap.position.y = 1.82;
    this.mesh.add(cap);
    this.mesh.position.set(spawn.x, 0, spawn.z);
    this.mesh.scale.setScalar(1.05);
    scene.add(this.mesh);

    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = 0; // radians, 0 = facing +z
    this.health = PLAYER.health;
    this.cash = PLAYER.startCash;
    this.totalEarned = 0;
    this.inCar = null; // the traffic car mesh being driven, or null
    this.carSpeed = 0;
    this.carHeading = 0;
    this.punchTimer = 0;
    this.punchAnim = 0;
    this.hurtTimer = 0;
    this.walkPhase = 0;
  }

  get driving() {
    return this.inCar !== null;
  }

  get speedKmh() {
    return Math.abs(this.carSpeed) * 3.6;
  }

  // Move on foot. Returns nothing; the mesh follows the position.
  _walk(dt, input) {
    const speed = input.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const fwd = input.axisY();
    const strafe = input.axisX();
    if (fwd === 0 && strafe === 0) return;
    // Facing follows the movement direction.
    const len = Math.hypot(fwd, strafe);
    const mx = (strafe / len) * Math.cos(this.heading) + (fwd / len) * Math.sin(this.heading);
    const mz = (-strafe / len) * Math.sin(this.heading) + (fwd / len) * Math.cos(this.heading);
    // Note: heading 0 faces +z, so forward is (sin h, cos h).
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    const dx = (fx * fwd + rx * strafe) / len;
    const dz = (fz * fwd + rz * strafe) / len;
    void mx;
    void mz;
    this.heading = Math.atan2(dx, dz);
    const nx = this.x + dx * speed * dt;
    const nz = this.z + dz * speed * dt;
    this._tryMove(nx, nz);
    this.walkPhase += dt * speed * 1.6;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
  }

  // Axis-separated movement so the player slides along walls.
  _tryMove(nx, nz) {
    const r = PLAYER.radius;
    if (!this.isBlocked(nx, this.z, r)) this.x = nx;
    if (!this.isBlocked(this.x, nz, r)) this.z = nz;
  }

  // Arcade car physics: accelerate, steer by speed, handbrake slides.
  _drive(dt, input) {
    const car = this.inCar;
    const fwd = input.axisY();
    const steer = input.axisX();
    if (fwd > 0) this.carSpeed += CAR.accel * dt;
    else if (fwd < 0) {
      if (this.carSpeed > 0.5) this.carSpeed -= CAR.brake * dt;
      else this.carSpeed -= CAR.reverseAccel * dt;
    } else {
      // Engine braking / drag.
      this.carSpeed -= Math.sign(this.carSpeed) * Math.min(Math.abs(this.carSpeed), 9 * dt);
    }
    if (input.handbrake) this.carSpeed -= Math.sign(this.carSpeed) * Math.min(Math.abs(this.carSpeed), 30 * dt);
    this.carSpeed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.carSpeed));
    // Steering scales with speed and reverses when reversing.
    const steerAmount = steer * CAR.steer * dt * Math.min(1, Math.abs(this.carSpeed) / 8) * Math.sign(this.carSpeed || 1);
    this.carHeading -= steerAmount;
    const nx = this.x + Math.sin(this.carHeading) * this.carSpeed * dt;
    const nz = this.z + Math.cos(this.carHeading) * this.carSpeed * dt;
    const r = CAR.radius;
    const hitX = this.isBlocked(nx, this.z, r);
    const hitZ = this.isBlocked(this.x, nz, r);
    if (!hitX) this.x = nx;
    if (!hitZ) this.z = nz;
    if (hitX || hitZ) this.carSpeed *= 0.55;
    car.position.set(this.x, 0, this.z);
    car.rotation.y = this.carHeading;
    // Rolling wheels.
    for (const wheel of car.userData.wheels) {
      wheel.rotation.x += (this.carSpeed * dt) / 0.36;
    }
  }

  // Try to enter the nearest car. Returns the car, or null.
  tryEnterCar(traffic) {
    if (this.driving) return null;
    const car = traffic.nearest(this.x, this.z, 4.5);
    if (!car) return null;
    traffic.steal(car);
    this.inCar = car.mesh;
    this.carHeading = this.heading;
    this.carSpeed = 0;
    this.mesh.visible = false;
    return car;
  }

  // Step out of the car, to its left side.
  exitCar() {
    if (!this.driving) return;
    const car = this.inCar;
    this.inCar = null;
    this.carSpeed = 0;
    const lx = this.x + Math.cos(this.carHeading) * 2.4;
    const lz = this.z - Math.sin(this.carHeading) * 2.4;
    if (!this.isBlocked(lx, lz, PLAYER.radius)) {
      this.x = lx;
      this.z = lz;
    }
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.heading = this.carHeading;
    return car;
  }

  // Punch: returns the hit pedestrian, or null. Cooldown-gated.
  tryPunch(pedestrians) {
    if (this.punchTimer > 0 || this.driving) return null;
    this.punchTimer = PLAYER.punchCooldown;
    this.punchAnim = 0.28;
    const fx = this.x + Math.sin(this.heading) * 1.4;
    const fz = this.z + Math.cos(this.heading) * 1.4;
    const ped = pedestrians.nearest(fx, fz, PLAYER.punchRange);
    return ped;
  }

  damage(amount) {
    if (this.hurtTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.6;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }

  addCash(amount) {
    this.cash += amount;
    if (amount > 0) this.totalEarned += amount;
  }

  update(dt, input) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.driving) {
      this._drive(dt, input);
    } else {
      this._walk(dt, input);
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      // Punch animation: lean the body forward.
      this.mesh.rotation.x = this.punchAnim > 0 ? 0.22 : 0;
    }
    // Hurt flash: the player blinks red briefly.
    if (this.hurtTimer > 0.3) {
      this.mesh.visible = Math.floor(this.hurtTimer * 12) % 2 === 0;
    } else if (!this.driving) {
      this.mesh.visible = true;
    }
  }

  respawn(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = 0;
    this.health = PLAYER.health;
    if (this.driving) {
      this.inCar = null;
      this.carSpeed = 0;
    }
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }
}
