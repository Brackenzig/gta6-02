// Camera rig: three modes the player cycles with C.
//   chase — low behind the player/car, the classic third-person view.
//   high  — a high angled view that shows the streets around the player.
//   front — in front of the player looking back, so a chase shot frames
//           the player's car with the police behind it.
// The camera lerps toward its target so turns feel smooth instead of
// snapping, and it never drops below the ground.

import * as THREE from 'three';

const MODES = ['chase', 'high', 'front'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.modeIndex = 0;
    this.pos = new THREE.Vector3(0, 30, -60);
    this.look = new THREE.Vector3(0, 0, 0);
  }

  get mode() {
    return MODES[this.modeIndex];
  }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    return this.mode;
  }

  setMode(name) {
    const i = MODES.indexOf(name);
    if (i >= 0) this.modeIndex = i;
  }

  // Where the camera wants to be and look, given the player's position
  // and heading. `driving` pulls the chase camera further back and lower.
  _desired(px, pz, heading, driving) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const back = driving ? 13 : 9;
    const height = driving ? 4.5 : 6;
    if (this.mode === 'chase') {
      return {
        pos: new THREE.Vector3(px - fx * back, height, pz - fz * back),
        look: new THREE.Vector3(px + fx * 8, 1.4, pz + fz * 8),
      };
    }
    if (this.mode === 'high') {
      return {
        pos: new THREE.Vector3(px - fx * 16, 34, pz - fz * 16),
        look: new THREE.Vector3(px + fx * 6, 0, pz + fz * 6),
      };
    }
    // front: ahead of the player, looking back at them.
    return {
      pos: new THREE.Vector3(px + fx * 12, 3.5, pz + fz * 12),
      look: new THREE.Vector3(px - fx * 6, 1.6, pz - fz * 6),
    };
  }

  update(dt, px, pz, heading, driving) {
    const desired = this._desired(px, pz, heading, driving);
    // Smooth follow: the lerp factor grows with dt so the feel is the
    // same at any frame rate.
    const k = 1 - Math.exp(-6 * dt);
    this.pos.lerp(desired.pos, k);
    this.look.lerp(desired.look, k);
    if (this.pos.y < 1.6) this.pos.y = 1.6;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  // Snap instantly (used when staging a screenshot so the first frame
  // is already framed).
  snap(px, pz, heading, driving) {
    const desired = this._desired(px, pz, heading, driving);
    this.pos.copy(desired.pos);
    this.look.copy(desired.look);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
