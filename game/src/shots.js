// Screenshot staging: `?shot=<name>&seed=1` puts the game into a
// deterministic scene for each of the four screenshots, then sets
// `window.__shotReady` once the scene has settled so the screenshot
// tool knows when to capture. The four shots are:
//   chase   — front camera: the player's red car with a police cruiser
//             behind it, three wanted stars, minimap, mission objective.
//   street  — on foot at a Downtown intersection: traffic, towers,
//             palms, street lights, mission banner.
//   drive   — coastal drive: ocean, sand, palms, a car at speed.
//   mission — on foot at the Marina pickup under the gold beacon.
// Each shot is a real render of the live game, never a composite.

import { SHOT_NAMES } from './config.js';

// Where each shot places the player and what state it sets up.
const SHOTS = {
  chase: {
    mode: 'front',
    driving: true,
    car: { color: 0xc0392b, x: 0, z: 0, heading: 0, speed: 22 },
    player: { x: 0, z: 0, heading: 0 },
    wanted: 3,
    police: 1,
    mission: true,
    settle: 3.6,
  },
  street: {
    mode: 'chase',
    driving: false,
    player: { x: 2, z: -30, heading: Math.PI * 0.85 },
    wanted: 0,
    police: 0,
    mission: true,
    settle: 3.6,
  },
  drive: {
    mode: 'chase',
    driving: true,
    car: { color: 0x2980b9, x: -40, z: 195, heading: Math.PI / 2, speed: 30 },
    player: { x: -40, z: 195, heading: Math.PI / 2 },
    wanted: 0,
    police: 0,
    mission: false,
    settle: 2.0,
  },
  mission: {
    mode: 'chase',
    driving: false,
    player: { x: 226, z: 40, heading: Math.PI / 2 },
    wanted: 1,
    police: 0,
    mission: true,
    jobIndex: 3,
    settle: 3.6,
  },
};

export function shotFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot && SHOT_NAMES.includes(shot)) return shot;
  } catch {
    // No query string — normal play.
  }
  return null;
}

// Stage a shot: position the player (and a car), set the wanted level,
// start a mission for the beacon/objective, and snap the camera.
// Returns the settle time in seconds before `__shotReady` fires.
export function stageShot(name, game) {
  const def = SHOTS[name];
  if (!def) return 0;
  const { player, traffic, police, missions, cameraRig } = game;
  // Put the player where the shot wants them.
  player.x = def.player.x;
  player.z = def.player.z;
  player.heading = def.player.heading;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  if (def.driving) {
    // Steal a parked car of the shot's colour and drive it.
    const car = traffic.spawnAt(def.car.x, def.car.z, def.car.color);
    traffic.steal(car);
    player.inCar = car.mesh;
    player.carHeading = def.car.heading;
    player.carSpeed = def.car.speed;
    player.x = def.car.x;
    player.z = def.car.z;
    player.mesh.visible = false;
  }
  if (def.wanted > 0) {
    police.wanted = def.wanted;
    police._syncUnits();
    // Pull the nearest cruiser in close behind the player for the chase.
    if (def.police > 0 && police.cruisers.length > 0) {
      const cruiser = police.cruisers[0];
      const back = 14;
      cruiser.mesh.position.set(
        player.x - Math.sin(player.heading) * back,
        0,
        player.z - Math.cos(player.heading) * back,
      );
      cruiser.heading = player.heading;
      cruiser.speed = def.car ? def.car.speed : 20;
    }
  }
  if (def.mission) {
    if (def.jobIndex !== undefined) missions.jobIndex = def.jobIndex;
    if (!missions.isActive) missions.startJob();
  }
  cameraRig.setMode(def.mode);
  cameraRig.snap(player.x, player.z, player.heading, player.driving);
  game.state = 'playing';
  game.hud.setMenuVisible(false);
  return def.settle;
}
