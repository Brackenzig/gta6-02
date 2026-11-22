// SOLMAR — bootstrap, state machine and game loop.
// States: menu → playing ⇄ paused, plus busted / wasted interludes
// that respawn the player at the hospital with a fine. The loop runs
// the world, the HUD and the minimap every frame, and keeps the
// `?shot=` staging path separate so screenshots are deterministic.

import * as THREE from 'three';
import { CITY, SAVE_KEY, PLAYER, POLICE } from './config.js';
import { Rng, seedFromUrl } from './rng.js';
import { buildCity } from './city.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { CameraRig } from './camera.js';
import { shotFromUrl, stageShot } from './shots.js';

const HOSPITAL = { x: 25, z: -175 };

export class Game {
  constructor() {
    this.state = 'menu';
    this.seed = seedFromUrl();
    this.rng = new Rng(this.seed);
    this.shot = shotFromUrl();
    this.shotSettle = 0;
    this.shotDeadline = 0;
    this.shotReady = false;

    // Renderer and scene.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.cameraRig = new CameraRig(this.camera);

    // World systems.
    this.city = buildCity(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.rng);
    this.pedestrians = new Pedestrians(this.scene, this.rng, this.city.sidewalkPoints);
    this.player = new Player(this.scene, this.city.spawn, this.city.isBlocked);
    this.police = new Police(this.scene, this.city.isBlocked, this.city.roadPoints);
    this.missions = new Missions(this.scene, this.traffic, this.player);
    this.hud = new HUD();
    this.audio = new AudioSys();
    this.input = new Input();
    this.district = 'Downtown';
    this._loadSave();

    // Wire the mission and police callbacks.
    this.missions.onStart = (job) => {
      this.hud.showBanner(job.name, `${job.fixer}: ${job.brief}`);
      const heat = this.missions.startingHeat;
      if (heat > 0) this.police.addHeat(heat);
      this.audio.click();
    };
    this.missions.onComplete = (job, pay) => {
      this.hud.showBanner('Job complete', `${job.name} — paid $${pay.toLocaleString('en-US')}`);
      this.audio.fanfare();
      this._save();
    };
    this.missions.onFail = (job) => {
      this.hud.showBanner('Job failed', `${job.name} — Mara is not pleased. Press J to try the next one.`);
      this.audio.sting();
    };
    this.police.onBusted = () => this._busted();
    this.police.onWasted = () => this._wasted();

    // Pause / resume and mute keys.
    this._onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'p' || key === 'escape') this._togglePause();
      if (key === 'm') {
        const muted = this.audio.toggleMute();
        this.hud.showBanner(muted ? 'Sound off' : 'Sound on');
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', () => this._resize());

    // Screenshot staging runs before the first frame. The deadline is
    // wall-clock time, not accumulated frame dt: under SwiftShader a
    // frame can take seconds, and the settle is about the scene being
    // rendered, not about how many frames ran.
    if (this.shot) {
      this.shotSettle = stageShot(this.shot, this);
      this.shotDeadline = performance.now() + this.shotSettle * 1000;
    }
    // Expose the instance for debugging and automated play tests.
    window.__game = this;
    this.hud.setMenuVisible(!this.shot);
    this.hud.setObjective(this.missions.objective);
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ---- Save / load -------------------------------------------------------
  _save() {
    try {
      const data = {
        cash: this.player.cash,
        totalEarned: this.player.totalEarned,
        jobsDone: this.missions.completedCount,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Private mode or no storage — the game still plays.
    }
  }

  _loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') this.player.cash = data.cash;
      if (typeof data.totalEarned === 'number') this.player.totalEarned = data.totalEarned;
      if (typeof data.jobsDone === 'number') this.missions.completedCount = data.jobsDone;
    } catch {
      // Corrupt save — start fresh.
    }
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showBanner('Paused', 'Press P to resume');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.showBanner('Back on the streets');
    }
  }

  _busted() {
    this.state = 'busted';
    const fine = Math.min(this.player.cash, PLAYER.bustedFine);
    this.player.addCash(-fine);
    this.audio.sting();
    this.hud.setEndVisible(true, 'BUSTED', `The Solmar PD caught up with you. Fine: $${fine}. Mara Voss is already lining up the next job.`);
    this._save();
    window.setTimeout(() => {
      this.player.respawn(HOSPITAL);
      this.hud.setEndVisible(false);
      this.state = 'playing';
    }, 2600);
  }

  _wasted() {
    this.state = 'wasted';
    const fine = Math.min(this.player.cash, PLAYER.wastedFine);
    this.player.addCash(-fine);
    this.audio.sting();
    this.hud.setEndVisible(true, 'WASTED', `You woke up at St. Marina Hospital, $${fine} lighter. The city is still out there.`);
    this._save();
    window.setTimeout(() => {
      this.player.respawn(HOSPITAL);
      this.hud.setEndVisible(false);
      this.state = 'playing';
    }, 2600);
  }

  // ---- Per-frame actions -------------------------------------------------
  _actions() {
    const input = this.input;
    const player = this.player;
    if (input.wasPressed('enter') && this.state === 'menu') {
      this.state = 'playing';
      this.hud.setMenuVisible(false);
      this.hud.showBanner('Welcome to Solmar', 'Steal a car with E • Punch with F • Take a job with J');
      this.audio.unlock();
      this.audio.click();
    }
    if (this.state !== 'playing') return;
    this.audio.unlock();
    if (input.wasPressed('e')) {
      if (player.driving) {
        player.exitCar();
        this.audio.click();
      } else {
        const car = player.tryEnterCar(this.traffic);
        if (car) {
          this.police.addHeat(POLICE.heatSteal);
          this.missions.onCarStolen(car);
          this.audio.thud(0.6);
          this.hud.showBanner('Car stolen', 'The heat is on — lose the cops or lay low.');
        }
      }
    }
    if (input.wasPressed('f')) {
      const ped = player.tryPunch(this.pedestrians);
      if (ped) {
        this.pedestrians.punch(ped);
        this.police.addHeat(POLICE.heatPunch);
        this.audio.thud(0.8);
      }
    }
    if (input.wasPressed('j')) {
      const job = this.missions.startJob();
      if (job) this.hud.showBanner(job.name, job.brief);
    }
    if (input.wasPressed('c')) {
      const mode = this.cameraRig.cycle();
      this.hud.showBanner(`Camera: ${mode}`);
    }
  }

  _frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this._actions();
    if (this.state === 'playing') {
      const player = this.player;
      player.update(dt, this.input);
      this.traffic.update(dt);
      // Danger for pedestrians: the player punching, or a fast car.
      const danger = player.driving && Math.abs(player.carSpeed) > 12
        ? { x: player.x, z: player.z, radius: 14 }
        : null;
      this.pedestrians.update(dt, danger);
      this.police.update(dt, player, this.audio);
      this.missions.update(dt);
      this.city.update(dt);
      // Cash pickups.
      const got = this.pedestrians.collectCash(player.x, player.z, 2.2);
      if (got > 0) {
        player.addCash(got);
        this.audio.cash();
      }
      // Slow health regen when the heat is off.
      if (this.police.wanted === 0 && player.health < PLAYER.health) {
        player.heal(dt * 2);
      }
      this.district = this.city.districtAt(player.x, player.z);
      this.audio.setEngine(player.driving ? Math.abs(player.carSpeed) / 42 : 0, player.driving);
      this.cameraRig.update(dt, player.x, player.z, player.driving ? player.carHeading : player.heading, player.driving);
      this.traffic.maintain();
    }
    // The HUD and minimap update in every state so the menu still
    // shows the city behind it.
    this.hud.update(dt, {
      player: this.player,
      police: this.police,
      missions: this.missions,
      traffic: this.traffic,
      pedestrians: this.pedestrians,
      district: this.district,
    });
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    // Screenshot readiness: once the wall-clock settle has passed and
    // at least one frame has rendered the staged scene, flag it.
    if (this.shot && !this.shotReady && performance.now() >= this.shotDeadline) {
      this.shotReady = true;
      window.__shotReady = true;
    }
  }
}

// Boot the game once the page is ready.
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
