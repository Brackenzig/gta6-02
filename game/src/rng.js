// Seeded random number generation for SOLMAR.
// One deterministic stream per city seed so `?seed=` rebuilds the same
// streets, buildings and traffic every time. Mulberry32 is small, fast
// and good enough for placement, colours and traffic variation.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small helper object wrapping one stream with the calls the city
// builder and the traffic/pedestrian systems actually need.
export class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.next = mulberry32(this.seed);
  }

  // Float in [0, 1).
  float() {
    return this.next();
  }

  // Float in [min, max).
  range(min, max) {
    return min + (max - min) * this.next();
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of an array, uniformly.
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  // Fisher-Yates shuffle, in place, on a copy.
  shuffled(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // A pastel-ish colour as a hex number, for cars and shirts.
  color(palette) {
    return this.pick(palette);
  }
}

// Parse `?seed=` from the page URL. Falls back to 1 so the default city
// is always the same one.
export function seedFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seed');
    if (raw === null || raw === '') return 1;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value >>> 0 : 1;
  } catch {
    return 1;
  }
}
