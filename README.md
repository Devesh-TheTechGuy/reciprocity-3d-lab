# Reciprocity Theorem — 3D First-Person Web Lab

A browser-based, first-person 3D simulation of the school-lab experiment
**"To Verify the Reciprocity Theorem"**. Walk up to a real lab bench, patch the
kit with cords, and read live, physically-accurate values.

Built with **Vite + TypeScript + three.js** (WebGL2).

## The experiment

- **Aim:** To verify the reciprocity theorem.
- **Apparatus (only what the experiment uses):** Reciprocity-theorem kit,
  patch cords, digital multimeter.
- **Circuit (Fig. 1):** a T-network of `R1`, `R2`, `R3`.
  - **(a)** DC source `E` (with voltmeter `V` across it) in the left branch →
    `R1` → centre node; `R3` centre→rail; `R2` → milliammeter `mA` → rail.
    The ammeter reads `I_A`.
  - **(b)** Mirror image: the `mA` moves to the left branch (reads `I_B`) and the
    source moves to the right branch.
- **Verify:** `I_A = I_B = E·R3 / (R1·R2 + R2·R3 + R1·R3)`,
  transfer resistance `R_T = (R1·R2 + R2·R3 + R1·R3) / R3`.

## Kit topology (as modelled)

The kit board already wires the T-network internally; students only patch in the
source, the voltmeter and the milliammeter:

```
T1 (A top) ── R1 ── C1 ── R2 ── T3 (B top)
                     │
                    R3
                     │
T2 (rail) ────────  T5 ────────  T4 (rail)      <- common bottom rail bus
```

- **Fig 1(a):** `E` across `T1(+)/T2(−)` — `V` across `T1/T2` — `mA` across `T3/T4`.
- **Fig 1(b):** `mA` across `T1/T2` — `E` across `T3/T4` — `V` across `T3/T4`.

Fig. 1 shows a voltmeter **and** a milliammeter at the same time, but the apparatus
lists a single *Digital Multimeter*, so the same DMM model is used as both
meters (two instances) — exactly how a school lab reproduces it.

## Controls

| Action | Input |
| --- | --- |
| Orbit / zoom (overview) | drag / scroll |
| Enter first-person | click **Enter the lab** |
| Move | `W A S D` · run with `Shift` |
| Patch a cord | aim at a brass terminal, **left-click**, drag, release on another terminal to snap |
| Unplug | **right-click** a terminal |
| Release cursor | `Esc` |

Multiple cords may share one terminal (the source and the voltmeter both reach
`T1`, as the figure requires).

On a phone or tablet the lab switches to a touch layout: an on-screen **walk pad**
in first-person, **drag to look**, **drag a cord** between terminals to patch it,
and **press and hold** a plugged terminal to unplug it (there is no right-click).
The circuit map, readout and observation table fold into a narrow bottom-sheet
layout, and the renderer drops to the *medium* quality preset automatically.

## Getting started

```powershell
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check (tsc) + production bundle -> dist/
npm run preview  # serve the built bundle
```

> On Windows, if `node`/`npm` are not on `PATH`:
> `$env:Path = 'C:\Program Files\nodejs\;' + $env:Path`

## Project structure

```
src/
  main.ts                  # bootstrap: engine + room + kit + camera rig + HUD
  core/engine.ts           # renderer, scene, camera, animation loop, resize
  scene/                   # room, wooden table, lighting
  interaction/
    cameraRig.ts           # orbit -> first-person transition + WASD walk
    wiringTool.ts          # raycast pick + drag + snap-to-terminal wiring
  ui/hud.ts                # branding, cards, crosshair, control hints
  kit/                     # kit board, resistors, terminals, DC source, DMM, cords
  cords/verletRope.ts      # position-based (Verlet) cord simulation
  state/wiring.ts          # live wiring graph + Fig-1 A/B detection
  physics/                 # circuit model (nodes/branches) + MNA solver
```

## Roadmap

- [x] **M0** scaffold — Vite + TS + three.js.
- [x] **M1** room — walls, windows, lighting, fan, table, orbit → first-person walk.
- [x] **M2** kit + cords — reciprocity kit (R1/R2/R3, terminals, DC source, DMM),
      Verlet patch cords, drag/snap wiring, wiring graph.
- [x] **M3** physics — circuit graph + MNA solver, live `E`, `I_A`, `I_B` readouts.
- [x] **M4** experiment flow — Fig 1(a)→1(b) state machine, observation table, verify.
- [x] **M5** polish — HDRI environment, post-FX (SSAO/bloom), sound cues, 2D circuit
      map, performance pass (quality presets + adaptive governor), mobile/touch
      fallback.

See [`PLAN.md`](./PLAN.md) for the full plan.
