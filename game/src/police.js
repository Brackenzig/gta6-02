// Police and the wanted system: five stars, pursuing cruisers that
// ram, officers on foot who try to bust the player, and a wanted level
// that decays when the player stays clean and out of sight. Crimes
// (stealing a car, punching a pedestrian, speeding past a cruiser)
// add heat; the level is the number of stars shown in the HUD.

import * as THREE from 'three';
import { POLICE, CAR } from './config.js';
import { makeCarMesh } from './traffic.js';
import { makePedMesh } from './pedestrians.js';

const OFFICER_SHIRT = 0x1f3a5f;

class Cruiser {
  constructor(scene, x, z) {
    this.mesh = makeCarMesh(0x111418, true);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.speed = 0;
    this.heading = 0;
    this.ramTimer = 0;
    this.stuckTimer = 0;
  }

  update(dt, px, pz, isBlocked) {
    // Steer toward the player with a little prediction.
    const dx = px - this.mesh.position.x;
    const dz = pz - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const target = Math.atan2(dx, dz);
    let diff = target - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    this.speed = Math.min(POLICE.chaseSpeed, this.speed + 18 * dt);
    const nx = this.mesh.position.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.mesh.position.z + Math.cos(this.heading) * this.speed * dt;
    const r = 1.6;
    if (!isBlocked(nx, this.mesh.position.z, r)) this.mesh.position.x = nx;
    if (!isBlocked(this.mesh.position.x, nz, r)) this.mesh.position.z = nz;
    this.mesh.rotation.y = this.heading;
    for (const wheel of this.mesh.userData.wheels) {
      wheel.rotation.x += (this.speed * dt) / 0.36;
    }
    // Flashing light bar.
    const t = performance.now() / 160;
    const redOn = Math.floor(t) % 2 === 0;
    this.mesh.userData.red.material.emissive.setHex(redOn ? 0xff0000 : 0x220000);
    this.mesh.userData.blue.material.emissive.setHex(redOn ? 0x000022 : 0x0000ff);
    this.ramTimer = Math.max(0, this.ramTimer - dt);
    return dist;
  }

  get x() {
    return this.mesh.position.x;
  }

  get z() {
    return this.mesh.position.z;
  }
}

class Officer {
  constructor(scene, x, z) {
    this.mesh = makePedMesh(OFFICER_SHIRT, 0xe8b88a);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.speed = 7.5;
    this.bustTimer = 0;
    this.walkPhase = 0;
  }

  update(dt, px, pz, isBlocked) {
    const dx = px - this.mesh.position.x;
    const dz = pz - this.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.5) {
      const step = Math.min(dist, this.speed * dt);
      const nx = this.mesh.position.x + (dx / dist) * step;
      const nz = this.mesh.position.z + (dz / dist) * step;
      if (!isBlocked(nx, this.mesh.position.z, 0.6)) this.mesh.position.x = nx;
      if (!isBlocked(this.mesh.position.x, nz, 0.6)) this.mesh.position.z = nz;
      this.mesh.rotation.y = Math.atan2(dx, dz);
      this.walkPhase += dt * this.speed * 2.2;
      const swing = Math.sin(this.walkPhase) * 0.5;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
    }
    // Busting: stand close for a couple of seconds and the player is caught.
    if (dist < POLICE.bustRange) this.bustTimer += dt;
    else this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    return dist;
  }

  get busted() {
    return this.bustTimer >= POLICE.bustTime;
  }
}

export class Police {
  constructor(scene, isBlocked, roadPoints) {
    this.scene = scene;
    this.isBlocked = isBlocked;
    this.roadPoints = roadPoints;
    this.wanted = 0;
    this.cruisers = [];
    this.officers = [];
    this.quietTimer = 0;
    this.onBusted = null; // set by main: () => void
    this.onWasted = null;
  }

  addHeat(amount) {
    this.wanted = Math.min(5, this.wanted + amount);
    this.quietTimer = 0;
    this._syncUnits();
  }

  clearWanted() {
    this.wanted = 0;
    this._syncUnits();
  }

  // Keep the number of cruisers/officers in step with the stars.
  _syncUnits() {
    const wantCruisers = this.wanted === 0 ? 0 : Math.min(POLICE.maxCruisers, this.wanted);
    while (this.cruisers.length < wantCruisers) {
      const spot = this.roadPoints[Math.floor(Math.random() * this.roadPoints.length)];
      this.cruisers.push(new Cruiser(this.scene, spot.x, spot.z));
    }
    while (this.cruisers.length > wantCruisers) {
      const cruiser = this.cruisers.pop();
      this.scene.remove(cruiser.mesh);
    }
    const wantOfficers = this.wanted >= 3 ? Math.min(3, this.wanted - 2) : 0;
    while (this.officers.length < wantOfficers) {
      const spot = this.roadPoints[Math.floor(Math.random() * this.roadPoints.length)];
      this.officers.push(new Officer(this.scene, spot.x, spot.z));
    }
    while (this.officers.length > wantOfficers) {
      const officer = this.officers.pop();
      this.scene.remove(officer.mesh);
    }
  }

  // Remove all units (used when the player is busted / wasted).
  standDown() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cruisers = [];
    this.officers = [];
  }

  update(dt, player, audio) {
    if (this.wanted === 0) return;
    // Wanted decays after a quiet stretch.
    this.quietTimer += dt;
    if (this.quietTimer > POLICE.decayAfter) {
      this.wanted = Math.max(0, this.wanted - 1);
      this.quietTimer = 0;
      this._syncUnits();
      if (this.wanted === 0) return;
    }
    let nearestDist = Infinity;
    for (const cruiser of this.cruisers) {
      const dist = cruiser.update(dt, player.x, player.z, this.isBlocked);
      nearestDist = Math.min(nearestDist, dist);
      // Ramming: a close cruiser damages the player (or their car).
      if (dist < 3.4 && cruiser.ramTimer <= 0) {
        cruiser.ramTimer = POLICE.ramCooldown;
        player.damage(POLICE.ramDamage);
        if (player.driving) player.carSpeed *= 0.4;
        audio.thud(1);
      }
      // Speeding past a cruiser while driving adds heat.
      if (player.driving && player.speedKmh > 110 && dist < 30) {
        this.quietTimer = 0;
      }
    }
    for (const officer of this.officers) {
      officer.update(dt, player.x, player.z, this.isBlocked);
      if (officer.busted) {
        this.standDown();
        this.clearWanted();
        if (this.onBusted) this.onBusted();
        return;
      }
    }
    // Sirens when a cruiser is close.
    audio.setSiren(nearestDist < 60, dt);
    if (player.health <= 0 && this.onWasted) {
      this.standDown();
      this.clearWanted();
      this.onWasted();
    }
  }
}
