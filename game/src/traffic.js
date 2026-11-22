// Traffic: lane-following cars that cruise the road grid, stop for
// nothing and get out of the way of no one. A traffic car is also a
// stealable car — walk up to one, press E, and the driver bails out.
// Each car is a small group of boxes (body, cabin, wheels) with a
// per-car colour, built once and reused.

import * as THREE from 'three';
import { CITY, CAR_COLORS, TRAFFIC_COUNT } from './config.js';
import { ROADS } from './city.js';

// Shared geometry — one box per part, scaled per car by the mesh scale.
const BODY_GEO = new THREE.BoxGeometry(2.0, 0.65, 4.2);
const CABIN_GEO = new THREE.BoxGeometry(1.7, 0.55, 2.0);
const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x151515 });

export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(BODY_GEO, paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(CABIN_GEO, new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x223344 }),
    );
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x881111 }),
    );
    red.position.set(-0.3, 1.62, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x111188 }),
    );
    blue.position.set(0.3, 1.62, -0.2);
    group.add(blue);
    group.userData.red = red;
    group.userData.blue = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

// One traffic car: a road, a lane offset, a speed and a direction.
class TrafficCar {
  constructor(scene, rng, color) {
    this.mesh = makeCarMesh(color);
    scene.add(this.mesh);
    this.rng = rng;
    this.speed = rng.range(7, 13);
    this.lane = rng.pick([-3.4, 3.4]);
    this.road = rng.pick(ROADS);
    this.vertical = rng.chance(0.5);
    this.dir = rng.chance(0.5) ? 1 : -1;
    this.pos = rng.range(CITY.min + 10, CITY.max - 10);
    this.stolen = false;
    this.driver = true;
    this._place();
  }

  _place() {
    if (this.vertical) {
      this.mesh.position.set(this.road + this.lane, 0, this.pos);
      this.mesh.rotation.y = this.dir > 0 ? 0 : Math.PI;
    } else {
      this.mesh.position.set(this.pos, 0, this.road + this.lane);
      this.mesh.rotation.y = this.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  // Drive along the road; at the edge of the grid, pick a new road.
  update(dt) {
    if (this.stolen) return;
    this.pos += this.dir * this.speed * dt;
    if (this.pos > CITY.max + 6 || this.pos < CITY.min - 6) {
      this.road = this.rng.pick(ROADS);
      this.vertical = this.rng.chance(0.5);
      this.dir = this.rng.chance(0.5) ? 1 : -1;
      this.lane = this.rng.pick([-3.4, 3.4]);
      this.pos = this.dir > 0 ? CITY.min - 4 : CITY.max + 4;
      this.speed = this.rng.range(7, 13);
    }
    this._place();
    // Rolling wheels.
    for (const wheel of this.mesh.userData.wheels) {
      wheel.rotation.x += (this.speed * dt) / 0.36;
    }
  }

  get x() {
    return this.mesh.position.x;
  }

  get z() {
    return this.mesh.position.z;
  }
}

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      this.cars.push(new TrafficCar(scene, rng, rng.pick(CAR_COLORS)));
    }
  }

  update(dt) {
    for (const car of this.cars) car.update(dt);
  }

  // The nearest driveable car to a point, within range. Used by the
  // player to steal, and by missions to find the marked car.
  nearest(x, z, range) {
    let best = null;
    let bestDist = range;
    for (const car of this.cars) {
      if (car.stolen) continue;
      const dx = car.x - x;
      const dz = car.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  // Mark a car as stolen (it stops being traffic) and hand its mesh to
  // the caller, who drives it.
  steal(car) {
    car.stolen = true;
    car.driver = false;
    return car.mesh;
  }

  // Spawn a parked car at an exact spot (used for the Grand Theft job's
  // gold coupe). It does not drive until stolen.
  spawnAt(x, z, color) {
    const car = new TrafficCar(this.scene, this.rng, color);
    car.road = x;
    car.vertical = true;
    car.dir = 1;
    car.pos = z;
    car.speed = 0;
    car.lane = 0;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = Math.PI / 4;
    this.cars.push(car);
    return car;
  }

  // Spawn a fresh traffic car to keep the streets full.
  respawn() {
    const car = new TrafficCar(this.scene, this.rng, this.rng.pick(CAR_COLORS));
    this.cars.push(car);
    return car;
  }

  // Remove stolen cars that have been abandoned far away, and keep the
  // count topped up.
  maintain() {
    this.cars = this.cars.filter((car) => {
      if (car.stolen) return true;
      return true;
    });
    let rolling = 0;
    for (const car of this.cars) if (!car.stolen) rolling += 1;
    while (rolling < TRAFFIC_COUNT) {
      this.respawn();
      rolling += 1;
    }
  }
}
