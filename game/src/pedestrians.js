// Pedestrians: sidewalk walkers who stroll between corners, flee when
// scared (a punch, a speeding car, a police chase nearby) and drop cash
// when punched. Each one is a small two-box figure with a coloured
// shirt; a little bob makes the walk read from a distance.

import * as THREE from 'three';
import { PED_COUNT, PED_WALK_SPEED } from './config.js';

const SHIRT_COLORS = [
  0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6,
  0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8, 0x00cec9,
];
const SKIN_COLORS = [0xe8b88a, 0xc98d5e, 0x8a5a3b, 0xf0c8a0];

const BODY_GEO = new THREE.BoxGeometry(0.55, 0.85, 0.32);
const HEAD_GEO = new THREE.BoxGeometry(0.36, 0.36, 0.36);
const LEG_GEO = new THREE.BoxGeometry(0.2, 0.55, 0.2);
const CASH_GEO = new THREE.BoxGeometry(0.4, 0.08, 0.28);
const CASH_MAT = new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x0a4418 });

export function makePedMesh(shirt, skin) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(BODY_GEO, new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(HEAD_GEO, new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.6;
  group.add(head);
  const legL = new THREE.Mesh(LEG_GEO, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legL.position.set(-0.14, 0.28, 0);
  group.add(legL);
  const legR = new THREE.Mesh(LEG_GEO, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
  legR.position.set(0.14, 0.28, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

class Ped {
  constructor(scene, rng, points) {
    this.rng = rng;
    this.points = points;
    this.mesh = makePedMesh(rng.pick(SHIRT_COLORS), rng.pick(SKIN_COLORS));
    scene.add(this.mesh);
    const start = rng.pick(points);
    this.mesh.position.set(start.x, 0, start.z);
    this.target = rng.pick(points);
    this.speed = PED_WALK_SPEED * rng.range(0.8, 1.3);
    this.fleeing = false;
    this.fleeTime = 0;
    this.walkPhase = rng.range(0, Math.PI * 2);
    this.cash = rng.int(40, 180);
  }

  _face(dx, dz) {
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  update(dt, danger) {
    // Danger is {x, z, radius} or null: a punch, a fast car or a chase.
    if (danger) {
      const dx = this.mesh.position.x - danger.x;
      const dz = this.mesh.position.z - danger.z;
      const d = Math.hypot(dx, dz);
      if (d < danger.radius) {
        this.fleeing = true;
        this.fleeTime = 3;
        this.fleeX = danger.x;
        this.fleeZ = danger.z;
      }
    }
    let speed = this.speed;
    let tx;
    let tz;
    if (this.fleeing) {
      this.fleeTime -= dt;
      if (this.fleeTime <= 0) this.fleeing = false;
      // Run directly away from the danger point.
      const dx = this.mesh.position.x - this.fleeX;
      const dz = this.mesh.position.z - this.fleeZ;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      tx = this.mesh.position.x + (dx / d) * 10;
      tz = this.mesh.position.z + (dz / d) * 10;
      speed = this.speed * 2.6;
    } else {
      tx = this.target.x;
      tz = this.target.z;
    }
    const dx = tx - this.mesh.position.x;
    const dz = tz - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.2 && !this.fleeing) {
      this.target = this.rng.pick(this.points);
    } else if (d > 0.01) {
      const step = Math.min(d, speed * dt);
      this.mesh.position.x += (dx / d) * step;
      this.mesh.position.z += (dz / d) * step;
      this._face(dx, dz);
      this.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(this.walkPhase) * 0.45;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
    }
  }

  get x() {
    return this.mesh.position.x;
  }

  get z() {
    return this.mesh.position.z;
  }
}

export class Pedestrians {
  constructor(scene, rng, points) {
    this.scene = scene;
    this.rng = rng;
    this.points = points;
    this.peds = [];
    this.cashDrops = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      this.peds.push(new Ped(scene, rng, points));
    }
  }

  update(dt, danger) {
    for (const ped of this.peds) ped.update(dt, danger);
    // Cash drops spin gently so they catch the eye.
    for (const drop of this.cashDrops) {
      drop.mesh.rotation.y += dt * 2.5;
      drop.mesh.position.y = 0.25 + Math.sin(drop.spin * 3 + performance.now() / 400) * 0.08;
    }
  }

  // The nearest pedestrian to a point, within range.
  nearest(x, z, range) {
    let best = null;
    let bestDist = range;
    for (const ped of this.peds) {
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = ped;
      }
    }
    return best;
  }

  // Punch a pedestrian: they flee and drop their cash on the ground.
  punch(ped) {
    const mesh = new THREE.Mesh(CASH_GEO, CASH_MAT);
    mesh.position.set(ped.x, 0.25, ped.z);
    this.scene.add(mesh);
    this.cashDrops.push({ mesh, amount: ped.cash, spin: Math.random() * 10 });
    ped.fleeing = true;
    ped.fleeTime = 4;
    ped.fleeX = ped.x;
    ped.fleeZ = ped.z;
    // A fresh pedestrian wanders in to replace them shortly after.
    ped.cash = this.rng.int(40, 180);
  }

  // Pick up a cash drop near a point; returns the amount, or 0.
  collectCash(x, z, range) {
    for (let i = 0; i < this.cashDrops.length; i += 1) {
      const drop = this.cashDrops[i];
      if (Math.hypot(drop.mesh.position.x - x, drop.mesh.position.z - z) < range) {
        this.scene.remove(drop.mesh);
        this.cashDrops.splice(i, 1);
        return drop.amount;
      }
    }
    return 0;
  }
}
