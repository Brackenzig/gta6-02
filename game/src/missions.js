// Missions: four story jobs for fixer Mara Voss. Each job is a short
// chain of stages — go to a beacon, steal a marked car, grab loot —
// with a gold beacon in the world, a timer, and a payout that scales
// with the player's rank. Press J near the job board (or anywhere) to
// take the next job; finishing one unlocks the next, and after the
// fourth the loop starts over with higher pay.

import * as THREE from 'three';
import { JOBS, rankFor } from './config.js';

const BEACON_COLOR = 0xffc233;

export class Missions {
  constructor(scene, traffic, player) {
    this.scene = scene;
    this.traffic = traffic;
    this.player = player;
    this.jobIndex = 0;
    this.active = null; // { job, stageIndex, timeLeft, target }
    this.completedCount = 0;
    this.onComplete = null; // (job, pay) => void
    this.onFail = null; // (job) => void
    this.onStart = null; // (job) => void

    // The beacon: a gold cylinder of light plus a pulsing ring, so the
    // objective is visible from across the city.
    this.beacon = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: BEACON_COLOR, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    beam.position.y = 30;
    this.beacon.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: BEACON_COLOR, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.beacon.userData.ring = ring;
    this.beacon.visible = false;
    scene.add(this.beacon);

    // The marked car for the Grand Theft job: a gold coupe.
    this.markedCar = null;
    this.markedMesh = null;
  }

  get currentJob() {
    return JOBS[this.jobIndex % JOBS.length];
  }

  get isActive() {
    return this.active !== null;
  }

  // Pay scales with rank: a Kingpin earns more per job than a Street Rat.
  payFor(job) {
    const rankIndex = ['Street Rat', 'Hustler', 'Wheelman', 'Enforcer', 'Kingpin of Solmar']
      .indexOf(rankFor(this.player.totalEarned).name);
    const loopBonus = 1 + this.completedCount * 0.25;
    return Math.round(job.basePay * (1 + rankIndex * 0.25) * loopBonus);
  }

  startJob() {
    if (this.active) return null;
    const job = this.currentJob;
    this.active = {
      job,
      stageIndex: 0,
      timeLeft: job.timeLimit,
      target: job.stages[0],
    };
    if (job.startHeat) {
      // The job itself brings heat — the police already know.
      this._heat = job.startHeat;
    }
    this._showBeacon(this.active.target);
    if (job.id === 'grand-theft') this._spawnMarkedCar();
    if (this.onStart) this.onStart(job);
    return job;
  }

  // Heat a job starts with (0 unless the job says otherwise).
  get startingHeat() {
    const heat = this._heat || 0;
    this._heat = 0;
    return heat;
  }

  _spawnMarkedCar() {
    // A gold coupe parked in Beachside, waiting to be taken.
    const stage = this.active.target;
    this.markedCar = this.traffic.spawnAt(stage.x, stage.z, 0xf5c542);
  }

  _showBeacon(stage) {
    this.beacon.position.set(stage.x, 0, stage.z);
    this.beacon.visible = true;
  }

  _hideBeacon() {
    this.beacon.visible = false;
  }

  // The current objective text for the HUD.
  get objective() {
    if (!this.active) return `Press J to take a job from Mara Voss — next: ${this.currentJob.name}`;
    const stage = this.active.target;
    return `${this.active.job.name}: ${stage.label}`;
  }

  get timeLeft() {
    return this.active ? Math.max(0, this.active.timeLeft) : 0;
  }

  // Distance to the current beacon, for the HUD.
  get distance() {
    if (!this.active) return 0;
    const stage = this.active.target;
    return Math.hypot(stage.x - this.player.x, stage.z - this.player.z);
  }

  // Advance a stage, or finish the job.
  _completeStage() {
    const job = this.active.job;
    this.active.stageIndex += 1;
    if (this.active.stageIndex >= job.stages.length) {
      const pay = this.payFor(job);
      this.player.addCash(pay);
      this.completedCount += 1;
      this.jobIndex += 1;
      this.active = null;
      this._hideBeacon();
      if (this.onComplete) this.onComplete(job, pay);
      return;
    }
    this.active.target = job.stages[this.active.stageIndex];
    this._showBeacon(this.active.target);
  }

  update(dt) {
    if (!this.active) {
      this.beacon.visible = false;
      return;
    }
    // Pulse the beacon ring.
    const t = performance.now() / 400;
    this.beacon.userData.ring.scale.setScalar(1 + Math.sin(t) * 0.18);
    this.beacon.rotation.y += dt * 0.6;
    this.active.timeLeft -= dt;
    if (this.active.timeLeft <= 0) {
      const job = this.active.job;
      this.active = null;
      this._hideBeacon();
      if (this.onFail) this.onFail(job);
      return;
    }
    const stage = this.active.target;
    const dist = Math.hypot(stage.x - this.player.x, stage.z - this.player.z);
    if (stage.kind === 'goto' && dist < 4) {
      this._completeStage();
    } else if (stage.kind === 'deliver' && dist < 4 && this.player.driving) {
      this._completeStage();
    }
  }

  // Called when the player steals a car: if the Grand Theft job wants
  // a car near the beacon, the stage completes.
  onCarStolen(car) {
    if (!this.active) return;
    const stage = this.active.target;
    if (stage.kind !== 'steal') return;
    const dist = Math.hypot(stage.x - this.player.x, stage.z - this.player.z);
    if (dist < 12) this._completeStage();
  }
}
