// HUD: cash, rank and district top-left; wanted stars top-right;
// health bottom-left; speed and the live minimap bottom-right; the
// mission banner and objective across the top centre. The minimap is a
// small 2D canvas redrawn every frame: roads, water, the player arrow,
// police dots, traffic dots and the gold mission beacon.

import { CITY, rankFor } from './config.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.cashEl = document.getElementById('hud-cash');
    this.rankEl = document.getElementById('hud-rank');
    this.districtEl = document.getElementById('hud-district');
    this.starsEl = document.getElementById('hud-stars');
    this.healthEl = document.getElementById('hud-health-fill');
    this.speedEl = document.getElementById('hud-speed');
    this.bannerEl = document.getElementById('hud-banner');
    this.objectiveEl = document.getElementById('hud-objective-text');
    this.timerEl = document.getElementById('hud-timer');
    this.menuEl = document.getElementById('menu');
    this.endEl = document.getElementById('end-screen');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this._bannerUntil = 0;
    this._lastCash = -1;
  }

  // A big centre message that fades after a few seconds. Wall-clock
  // timed, so it fades even when frames are slow (SwiftShader).
  showBanner(text, sub = '') {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    this._bannerSub = sub;
    this._bannerUntil = performance.now() + 3200;
  }

  setObjective(text) {
    if (this.objectiveEl.textContent !== text) this.objectiveEl.textContent = text;
  }

  setMenuVisible(visible) {
    this.menuEl.classList.toggle('hidden', !visible);
  }

  setEndVisible(visible, title, body) {
    this.endEl.classList.toggle('hidden', !visible);
    if (visible) {
      document.getElementById('end-title').textContent = title;
      document.getElementById('end-body').textContent = body;
    }
  }

  // Called every frame with the live game state.
  update(dt, state) {
    const { player, police, missions } = state;
    if (this._bannerUntil && performance.now() > this._bannerUntil) {
      this._bannerUntil = 0;
      this.bannerEl.classList.remove('show');
    }
    if (player.cash !== this._lastCash) {
      this._lastCash = player.cash;
      this.cashEl.textContent = `$${player.cash.toLocaleString('en-US')}`;
    }
    this.rankEl.textContent = rankFor(player.totalEarned).name;
    this.districtEl.textContent = state.district;
    // Wanted stars: filled for the current level, empty above it.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < police.wanted ? '★' : '☆';
    if (this.starsEl.textContent !== stars) this.starsEl.textContent = stars;
    this.starsEl.classList.toggle('hot', police.wanted > 0);
    this.healthEl.style.width = `${player.health}%`;
    this.healthEl.classList.toggle('low', player.health <= 30);
    this.speedEl.textContent = player.driving ? `${Math.round(player.speedKmh)} km/h` : '';
    this.setObjective(missions.objective);
    if (missions.isActive) {
      const t = Math.max(0, Math.ceil(missions.timeLeft));
      const mm = Math.floor(t / 60);
      const ss = String(t % 60).padStart(2, '0');
      this.timerEl.textContent = `${mm}:${ss}  •  ${Math.round(missions.distance)}m`;
      this.timerEl.classList.toggle('urgent', t <= 30);
    } else {
      this.timerEl.textContent = '';
    }
    this._drawMinimap(state);
  }

  _drawMinimap(state) {
    const { player, police, missions, traffic, pedestrians } = state;
    const ctx = this.mapCtx;
    const W = this.map.width;
    const H = this.map.height;
    // World extent shown: the whole city plus beach and marina.
    const X0 = -230;
    const X1 = 340;
    const Z0 = -230;
    const Z1 = 380;
    const px = (x) => ((x - X0) / (X1 - X0)) * W;
    const py = (z) => ((z - Z0) / (Z1 - Z0)) * H;
    ctx.clearRect(0, 0, W, H);
    // Land.
    ctx.fillStyle = '#2e4a26';
    ctx.fillRect(0, 0, W, H);
    // Ocean and marina water.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, py(CITY.oceanZ0), W, H - py(CITY.oceanZ0));
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(px(CITY.marinaX0), py(CITY.marinaZ0), px(CITY.marinaX1) - px(CITY.marinaX0), py(CITY.marinaZ1) - py(CITY.marinaZ0));
    // Beach.
    ctx.fillStyle = '#d9c48c';
    ctx.fillRect(0, py(CITY.beachZ0), W, py(CITY.beachZ1) - py(CITY.beachZ0));
    // Roads.
    ctx.strokeStyle = '#565b62';
    ctx.lineWidth = 3;
    for (let x = CITY.min; x <= CITY.max; x += CITY.roadStep) {
      ctx.beginPath();
      ctx.moveTo(px(x), py(CITY.min));
      ctx.lineTo(px(x), py(CITY.max));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px(CITY.min), py(x));
      ctx.lineTo(px(CITY.max), py(x));
      ctx.stroke();
    }
    // Mission beacon.
    if (missions.isActive) {
      const stage = missions.active.target;
      const pulse = 4 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = '#ffc233';
      ctx.beginPath();
      ctx.arc(px(stage.x), py(stage.z), pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic dots.
    ctx.fillStyle = '#c8ccd2';
    for (const car of traffic.cars) {
      if (car.stolen) continue;
      ctx.fillRect(px(car.x) - 1, py(car.z) - 1, 2, 2);
    }
    // Pedestrian dots.
    ctx.fillStyle = '#8a94a0';
    for (const ped of pedestrians.peds) {
      ctx.fillRect(px(ped.x) - 1, py(ped.z) - 1, 2, 2);
    }
    // Police: blue for cruisers, red for officers.
    for (const cruiser of police.cruisers) {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(px(cruiser.x), py(cruiser.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const officer of police.officers) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(px(officer.mesh.position.x), py(officer.mesh.position.z), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, rotated to the heading.
    ctx.save();
    ctx.translate(px(player.x), py(player.z));
    ctx.rotate(Math.PI - player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
