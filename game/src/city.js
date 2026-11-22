// The city of Solmar: an 8x8 coastal grid with a beach, an ocean and a
// marina. Everything is generated from one seed, so `?seed=` rebuilds
// the same city. Textures are painted on offscreen canvases (facades
// with windows, roads with dashes, sand, water) and the ground is a
// single large textured plane, which keeps the draw calls low and the
// screenshots rich.

import * as THREE from 'three';
import { CITY, DISTRICTS, districtAt } from './config.js';
import { Rng } from './rng.js';

// Road centreline positions: -200 .. 200 in steps of 50 (9 roads).
export const ROADS = [];
for (let i = 0; i <= CITY.blocks; i += 1) {
  ROADS.push(CITY.min + i * CITY.roadStep);
}

// Block centres: -175 .. 175 in steps of 50 (8 blocks).
export const BLOCKS = [];
for (let i = 0; i < CITY.blocks; i += 1) {
  BLOCKS.push(CITY.min + CITY.roadStep / 2 + i * CITY.roadStep);
}

function makeTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Facade with a grid of lit and dark windows, for building sides.
function facadeTexture(base, lit) {
  return makeTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const cols = 6;
    const rows = 10;
    const cw = s / cols;
    const rh = s / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const on = ((r * 7 + c * 3) % 5) < 2;
        ctx.fillStyle = on ? lit : '#20262e';
        ctx.fillRect(c * cw + cw * 0.22, r * rh + rh * 0.25, cw * 0.56, rh * 0.5);
      }
    }
    // Subtle floor lines.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let r = 0; r <= rows; r += 1) ctx.fillRect(0, r * rh - 1, s, 2);
  });
}

// One big ground texture: grass, the road grid with dashes, sidewalks,
// the beach and the ocean, painted in world space so the plane maps
// 1:1 onto the city. The plane spans -340..380 in both axes.
function groundTexture() {
  const size = 1024;
  // World extent covered by the texture.
  const W0 = -340;
  const W1 = 380;
  const toPx = (v) => ((v - W0) / (W1 - W0)) * size;
  return makeTexture(size, (ctx, s) => {
    // Grass base.
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(0, 0, s, s);
    // Grass speckle.
    for (let i = 0; i < 2600; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, y, 3, 3);
    }
    // Ocean, far south.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, toPx(CITY.oceanZ0), s, toPx(CITY.oceanZ1) - toPx(CITY.oceanZ0));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = CITY.oceanZ0 + 12; y < CITY.oceanZ1; y += 18) {
      ctx.beginPath();
      for (let x = -340; x <= 380; x += 20) {
        const yy = toPx(y) + Math.sin(x * 0.05 + y) * 3;
        if (x === -340) ctx.moveTo(toPx(x), yy);
        else ctx.lineTo(toPx(x), yy);
      }
      ctx.stroke();
    }
    // Beach sand.
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(0, toPx(CITY.beachZ0), s, toPx(CITY.beachZ1) - toPx(CITY.beachZ0));
    for (let i = 0; i < 500; i += 1) {
      ctx.fillStyle = 'rgba(120,90,40,0.15)';
      ctx.fillRect(Math.random() * s, toPx(CITY.beachZ0) + Math.random() * (toPx(CITY.beachZ1) - toPx(CITY.beachZ0)), 3, 3);
    }
    // Marina basin water, east.
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(toPx(CITY.marinaX0), toPx(CITY.marinaZ0), toPx(CITY.marinaX1) - toPx(CITY.marinaX0), toPx(CITY.marinaZ1) - toPx(CITY.marinaZ0));
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let y = CITY.marinaZ0 + 10; y < CITY.marinaZ1; y += 16) {
      ctx.beginPath();
      ctx.moveTo(toPx(CITY.marinaX0), toPx(y));
      ctx.lineTo(toPx(CITY.marinaX1), toPx(y));
      ctx.stroke();
    }
    // Sidewalk borders around every block.
    ctx.fillStyle = '#b8b2a4';
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        ctx.fillRect(toPx(bx - 21), toPx(bz - 21), toPx(42) - toPx(0), toPx(42) - toPx(0));
      }
    }
    // Roads: asphalt strips with a dashed centre line.
    for (const r of ROADS) {
      // Vertical roads (along z).
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(toPx(r - CITY.roadHalf), toPx(CITY.min), toPx(CITY.roadHalf * 2) - toPx(0), toPx(CITY.max + 7) - toPx(CITY.min));
      // Horizontal roads (along x).
      ctx.fillRect(toPx(CITY.min), toPx(r - CITY.roadHalf), toPx(CITY.max + 7) - toPx(CITY.min), toPx(CITY.roadHalf * 2) - toPx(0));
    }
    // Centre dashes.
    ctx.fillStyle = '#e8c33a';
    for (const r of ROADS) {
      for (let v = CITY.min + 4; v < CITY.max; v += 12) {
        ctx.fillRect(toPx(r) - 1, toPx(v), 2, toPx(6) - toPx(0));
        ctx.fillRect(toPx(v), toPx(r) - 1, toPx(6) - toPx(0), 2);
      }
    }
    // White edge lines on the roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(toPx(r - CITY.roadHalf + 1), toPx(CITY.min));
      ctx.lineTo(toPx(r - CITY.roadHalf + 1), toPx(CITY.max + 7));
      ctx.moveTo(toPx(r + CITY.roadHalf - 1), toPx(CITY.min));
      ctx.lineTo(toPx(r + CITY.roadHalf - 1), toPx(CITY.max + 7));
      ctx.moveTo(toPx(CITY.min), toPx(r - CITY.roadHalf + 1));
      ctx.lineTo(toPx(CITY.max + 7), toPx(r - CITY.roadHalf + 1));
      ctx.moveTo(toPx(CITY.min), toPx(r + CITY.roadHalf - 1));
      ctx.lineTo(toPx(CITY.max + 7), toPx(r + CITY.roadHalf - 1));
      ctx.stroke();
    }
  });
}

// Roof texture: flat grey with a darker border and a vent or two.
function roofTexture() {
  return makeTexture(128, (ctx, s) => {
    ctx.fillStyle = '#6b6f75';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#565a60';
    ctx.fillRect(6, 6, s - 12, s - 12);
    ctx.fillStyle = '#7d8187';
    ctx.fillRect(s * 0.2, s * 0.2, s * 0.18, s * 0.18);
    ctx.fillRect(s * 0.62, s * 0.55, s * 0.14, s * 0.14);
  });
}

// Wooden dock planks.
function dockTexture() {
  return makeTexture(128, (ctx, s) => {
    ctx.fillStyle = '#8a6b45';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    for (let y = 0; y <= s; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }
  });
}

export { facadeTexture, groundTexture, roofTexture, dockTexture };

// ---- City assembly -------------------------------------------------------
// Builds the whole static city into the scene and returns the data the
// gameplay systems need: building colliders, road/sidewalk points,
// spawn points and the water/dock layout.

const FACADE_VARIANTS = [
  { base: '#7d8a99', lit: '#ffd98a' },
  { base: '#a89a7d', lit: '#ffe6a8' },
  { base: '#5f7488', lit: '#9fd8ff' },
  { base: '#8a6f5c', lit: '#ffd98a' },
];

const BUILDING_TINTS = [0xffffff, 0xf2e6d0, 0xdce8f2, 0xf2dcd2, 0xd8e8dc];

export function buildCity(scene, seed) {
  const rng = new Rng(seed);
  const colliders = [];
  const boats = [];
  const palms = [];

  // Sky and light: a warm late-afternoon sun over the coast.
  scene.background = new THREE.Color(0x87b5d9);
  scene.fog = new THREE.Fog(0x9fc3dd, 260, 620);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.9);
  sun.position.set(120, 220, 80);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x5d7a4a, 0.9));

  // Ground: one big textured plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, 0, 10);
  ground.receiveShadow = false;
  scene.add(ground);

  // ---- Buildings ---------------------------------------------------------
  const facadeTex = FACADE_VARIANTS.map((v) => facadeTexture(v.base, v.lit));
  const roofTex = roofTexture();
  const buildingGeoms = [];

  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const district = DISTRICTS.find(
        (d) => bx >= d.x0 && bx < d.x1 && bz >= d.z0 && bz < d.z1,
      ) || DISTRICTS[0];
      // Downtown gets one tall tower per block; elsewhere 2-4 low blocks.
      const count = district.tall ? 1 : rng.int(2, 4);
      for (let n = 0; n < count; n += 1) {
        const w = district.tall ? 26 : rng.range(10, 16);
        const d = district.tall ? 26 : rng.range(10, 16);
        const h = district.tall
          ? rng.range(45, 85)
          : rng.range(8, 22);
        const cx = bx + (count === 1 ? 0 : rng.range(-8, 8));
        const cz = bz + (count === 1 ? 0 : rng.range(-8, 8));
        const tint = rng.pick(BUILDING_TINTS);
        const facade = rng.pick(facadeTex);
        const side = new THREE.MeshLambertMaterial({ map: facade, color: tint });
        const top = new THREE.MeshLambertMaterial({ map: roofTex });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, side, side]);
        mesh.position.set(cx, h / 2, cz);
        scene.add(mesh);
        buildingGeoms.push(mesh);
        colliders.push({
          x0: cx - w / 2 - 0.4,
          z0: cz - d / 2 - 0.4,
          x1: cx + w / 2 + 0.4,
          z1: cz + d / 2 + 0.4,
        });
      }
    }
  }

  // ---- Palms -------------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3d8a3d });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 7, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 1.6, 5);
  function addPalm(x, z) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = rng.range(-0.06, 0.06);
    group.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1, 7.2, Math.sin(a) * 1.1);
      leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      leaf.scale.set(1, 0.45, 1);
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    scene.add(group);
    palms.push(group);
  }
  // A row of palms along the beach, plus a few on the marina promenade.
  for (let x = -190; x <= 190; x += 24) {
    if (rng.chance(0.8)) addPalm(x + rng.range(-4, 4), CITY.beachZ0 + rng.range(4, 14));
  }
  for (let z = -50; z <= 130; z += 30) {
    if (rng.chance(0.7)) addPalm(CITY.marinaX0 - 8, z);
  }
  // A few palms scattered on random blocks.
  for (let i = 0; i < 14; i += 1) {
    const bx = rng.pick(BLOCKS);
    const bz = rng.pick(BLOCKS);
    addPalm(bx + rng.range(-16, 16), bz + rng.range(-16, 16));
  }

  // ---- Street lights -----------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3c4147 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 8, 6);
  const armGeo = new THREE.BoxGeometry(2.6, 0.18, 0.18);
  const headGeo = new THREE.BoxGeometry(1.1, 0.28, 0.5);
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      if ((rx + rz) % 100 !== 0) continue;
      const group = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4;
      group.add(pole);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(1.2, 7.8, 0);
      group.add(arm);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(2.4, 7.7, 0);
      group.add(head);
      group.position.set(rx + CITY.roadHalf + 1.2, 0, rz + CITY.roadHalf + 1.2);
      group.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(group);
    }
  }

  // ---- Marina dock and boats --------------------------------------------
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.6, 8),
    new THREE.MeshLambertMaterial({ map: dockTexture() }),
  );
  dock.position.set(226, 0.4, 40);
  scene.add(dock);
  // The dock is walkable; the water around it is not.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const cabinMat = new THREE.MeshLambertMaterial({ color: 0x2c5f7c });
  const mastMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
  const boatSpots = [
    { x: 250, z: 10, len: 12 },
    { x: 262, z: 70, len: 15 },
    { x: 240, z: 110, len: 10 },
    { x: 285, z: -30, len: 14 },
  ];
  for (const spot of boatSpots) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(spot.len, 2.2, 4), hullMat);
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(spot.len * 0.45, 1.8, 3), cabinMat);
    cabin.position.set(-spot.len * 0.1, 2.4, 0);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), mastMat);
    mast.position.set(spot.len * 0.15, 6, 0);
    boat.add(mast);
    boat.position.set(spot.x, 0, spot.z);
    boat.rotation.y = rng.range(-0.2, 0.2);
    scene.add(boat);
    boats.push(boat);
  }

  // ---- Traffic lights at the four central intersections ------------------
  const lightBoxMat = new THREE.MeshLambertMaterial({ color: 0x22252a });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xd21f1f, emissive: 0x881111 });
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x22c55e, emissive: 0x0a6622 });
  for (const ix of [-25, 25]) {
    for (const iz of [-25, 25]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.5, 6), poleMat);
      pole.position.set(ix + CITY.roadHalf + 1, 3.25, iz + CITY.roadHalf + 1);
      scene.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), lightBoxMat);
      box.position.set(ix + CITY.roadHalf + 1, 6.4, iz + CITY.roadHalf + 1);
      scene.add(box);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), redMat);
      red.position.set(ix + CITY.roadHalf + 1, 7.1, iz + CITY.roadHalf + 1.4);
      scene.add(red);
      const green = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), greenMat);
      green.position.set(ix + CITY.roadHalf + 1, 6.0, iz + CITY.roadHalf + 1.4);
      scene.add(green);
    }
  }

  // ---- Water and bounds (collision) --------------------------------------
  // Ocean and marina basin block movement; the beach is walkable.
  colliders.push({ x0: -400, z0: CITY.oceanZ0, x1: 400, z1: 400 });
  colliders.push({ x0: CITY.marinaX0, z0: CITY.marinaZ0, x1: CITY.marinaX1, z1: CITY.marinaZ1 });
  // The dock carves a walkable strip out of the marina collider.
  const dockGap = { x0: 200, z0: 36, x1: 252, z1: 44 };

  // ---- Spawn and waypoint helpers ---------------------------------------
  const spawn = { x: 0, z: -100 };
  const roadPoints = [];
  for (const r of ROADS) {
    for (let v = CITY.min + 10; v <= CITY.max - 10; v += 25) {
      roadPoints.push({ x: r, z: v, vertical: true });
      roadPoints.push({ x: v, z: r, vertical: false });
    }
  }
  const sidewalkPoints = [];
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      sidewalkPoints.push({ x: bx - 19, z: bz - 19 });
      sidewalkPoints.push({ x: bx + 19, z: bz + 19 });
      sidewalkPoints.push({ x: bx - 19, z: bz + 19 });
      sidewalkPoints.push({ x: bx + 19, z: bz - 19 });
    }
  }

  function isBlocked(x, z, radius) {
    if (x < CITY.min - 30 || x > 340 || z < CITY.min - 30 || z > CITY.oceanZ0 - 1) return true;
    // The dock strip is walkable even though it sits over the marina.
    if (x >= dockGap.x0 - radius && x <= dockGap.x1 + radius && z >= dockGap.z0 - radius && z <= dockGap.z1 + radius) {
      return false;
    }
    for (const c of colliders) {
      if (x + radius > c.x0 && x - radius < c.x1 && z + radius > c.z0 && z - radius < c.z1) return true;
    }
    return false;
  }

  // Gentle boat bob, called from the main loop.
  let time = 0;
  function update(dt) {
    time += dt;
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = Math.sin(time * 0.8 + i * 1.7) * 0.25;
      boats[i].rotation.z = Math.sin(time * 0.6 + i) * 0.02;
    }
    for (let i = 0; i < palms.length; i += 1) {
      palms[i].rotation.z = Math.sin(time * 0.7 + i * 1.3) * 0.02;
    }
  }

  return {
    colliders,
    isBlocked,
    spawn,
    roadPoints,
    sidewalkPoints,
    districtAt,
    dockGap,
    update,
  };
}
