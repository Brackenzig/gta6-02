# SOLMAR — Open-World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Brackenzig/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Brackenzig/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game on the sun-soaked coast. Solmar is an 8×8 coastal city — downtown towers, old-town streets, a beach and a marina — with traffic, pedestrians, cars to steal and drive, a five-star wanted level with pursuing police, four story jobs for fixer Mara Voss, combat, cash pickups, ranks, a live minimap and synthesised sound. The city, characters, vehicles and story are all original.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: the game is plain static files under `game/`, with three.js vendored at `game/vendor/three.module.min.js`.

## Play

- **Enter** — start
- **WASD** — move on foot / drive
- **Shift** — run
- **E** — steal a car / exit a car
- **F** — punch (pedestrians drop cash)
- **J** — take the next job from Mara Voss
- **C** — change camera (chase / high / front)
- **P** — pause, **M** — mute

## Jobs

1. **Courier Run** — pick up a package in Old Town, deliver it to the Marina.
2. **Getaway Driver** — grab the bag downtown, lose the heat, reach the Northside safehouse.
3. **Grand Theft Solmar** — steal the gold coupe in Beachside, deliver it to the garage.
4. **Marina Heist** — grab the lockbox from the yacht, escape to the Beachside drop.

Payouts scale with your rank, from Street Rat to Kingpin of Solmar. Getting busted or wasted costs a fine and sends you to St. Marina Hospital.

## Structure

- `game/src/city.js` — the 8×8 city, beach, ocean, marina, palms, lights, boats
- `game/src/traffic.js` — lane-following traffic cars (stealable)
- `game/src/pedestrians.js` — sidewalk walkers, fleeing, cash drops
- `game/src/player.js` — walk / run / punch / steal / arcade driving
- `game/src/police.js` — five-star wanted level, cruiser pursuit, officers, busts
- `game/src/missions.js` — the four-job loop, beacons, timers, payouts
- `game/src/hud.js` — cash, rank, stars, health, speed, live minimap
- `game/src/audio.js` — WebAudio synth: engine, sirens, impacts, jingles
- `game/src/input.js` — keyboard state with edge-triggered presses
- `game/src/camera.js` — chase / high / front cameras
- `game/src/shots.js` — deterministic `?shot=` staging for screenshots
- `game/src/main.js` — bootstrap, state machine, game loop, save/load
- `game/src/config.js` — tuning, districts, ranks, jobs
- `game/src/rng.js` — seeded RNG (`?seed=` rebuilds one city)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
