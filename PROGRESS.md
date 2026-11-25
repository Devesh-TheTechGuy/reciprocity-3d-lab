# Reciprocity Theorem 3D Lab — Progress & Chat Handoff

> **Purpose of this file:** full state dump so work can resume in a new chat with
> zero context. Read sections 0–6 first; the rest is reference.

---

## 0. TL;DR — where to resume

**Project:** browser first-person 3D simulation of the school-lab experiment
*"To Verify the Reciprocity Theorem"* (Vite + TypeScript + three.js r187).

**Done & pushed:** M0 scaffold, M1 room + camera rig, M2 kit + patch cords +
wiring, the "Paused card never disappears" lock fix (§5), **M3 physics**
(netlist + MNA solver + live E/V/I readouts — §5b), and **M4 experiment flow**
(Fig 1(a)→1(b) state machine, Table 1 + verification, runtime resistor swap — §5c).

**Nothing is half-edited.** `npm run build` is green (32 modules).

**The very next action:** start **M5** (§6.3) — polish: HDRI, post-FX, sound,
perf pass.

---

## 1. Repo / remote / git identity

| Item | Value |
| --- | --- |
| Local project path | `d:\Devesh\Devesh 2\Python\ML\Deepseek end Point\reciprocity-3d-lab` |
| Remote (origin) | `https://github.com/Devesh-TheTechGuy/reciprocity-3d-lab` (**PUBLIC**) |
| Branch | `main` (tracks `origin/main`) |
| git user.name | `Devesh-TheTechGuy` |
| git user.email | `deveshgopal11@gmail.com` |
| GitHub CLI auth | `gh` authed as `Devesh-TheTechGuy` (keyring, scopes: repo, gist, read:org, workflow) |

**Commit history (pushed, newest first):**
```
9f7c33c M4: experiment flow + Table 1 observation table + resistor-value swap
d7dd265 docs: record M3 commit hash (b1919b0) in PROGRESS
b1919b0 M3: physics — netlist + MNA solver + live E/V/I readouts
74fda29 Fix: Paused card stuck on lock (three r187 lock-event order) + drag-to-look fallback
7ebb710 Keep LICENSE from the initial remote repo
1430ac4 Add README (overview, controls, structure, roadmap)
3ff092e M0-M2: scaffold, lab room + first-person camera, reciprocity kit + patch cords + wiring
```

**WARNING — nested repo:** `reciprocity-3d-lab/` has its own `.git` and sits
*inside* another repo rooted at `…\Deepseek end Point`. The outer repo sees this
folder as an untracked/embedded repo. When running git commands, always
`Set-Location` into `reciprocity-3d-lab` first. (Consider adding
`reciprocity-3d-lab/` to the outer repo's `.gitignore`.)

---

## 2. How to run

```powershell
# node/npm are NOT on PATH by default — always prepend:
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location 'd:\Devesh\Devesh 2\Python\ML\Deepseek end Point\reciprocity-3d-lab'

npm run dev      # http://localhost:5173
npm run build    # tsc (strict) + vite build -> dist/
npm run preview  # serve the built bundle
```

`gh` (GitHub CLI) is at `C:\Program Files\GitHub CLI\` and is also not on PATH:
```powershell
$env:Path = 'C:\Program Files\GitHub CLI;' + $env:Path
```

**Dev server state:** stopped, and `vite-dev*.log` deleted, at handoff time. To
bring it back up:
```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location 'd:\Devesh\Devesh 2\Python\ML\Deepseek end Point\reciprocity-3d-lab'
Start-Process npm.cmd -ArgumentList 'run','dev','--','--port','5173','--strictPort' `
  -RedirectStandardOutput 'vite-dev.log' -RedirectStandardError 'vite-dev.err.log' -WindowStyle Hidden
# stop it with:
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select -Expand OwningProcess -Unique | % { Stop-Process -Id $_ -Force }
Remove-Item -LiteralPath 'vite-dev.log','vite-dev.err.log' -Force -ErrorAction SilentlyContinue
```

---

## 3. Environment facts / gotchas

- Windows, PowerShell 5.1. `node` v26.x, npm 11.x, git 2.56.
- `gh` (GitHub CLI) was installed this session via winget (`GitHub.cli` 2.105.0).
- Build gate: `npm run build` (runs `tsc` then `vite build`). Clean = exit 0.
  Vite prints a "chunks > 500 kB" notice to stderr; that is **not** an error.
- **Editor tool** caps a single `new_text` at ~6000 chars → split big files.
- Playwright (**headless**) does **not** support the Pointer Lock API — that is an
  environment limitation, not an app bug. The app now degrades gracefully (§5).
- Playwright screenshots must be written under
  `C:\Users\Devesh Gupta\AppData\Local\Programs\Microsoft VS Code\.playwright-mcp\`
  (that is the allowed root; other paths are rejected).
- three **r187** API notes: `THREE.Clock` deprecated → use `THREE.Timer`
  (`timer.connect(document)`, `timer.update(ts)`, `timer.getElapsed()`);
  `PCFSoftShadowMap` is gone → use `PCFShadowMap`; three ships **no** bundled
  types → `@types/three@0.187.0` is required.

---

## 4. Milestone status

- [x] **M0 scaffold** — Vite + TS + three.js; `index.html`, `vite.config.ts`,
      `tsconfig.json`, `src/main.ts`, `src/style.css`, `src/vite-env.d.ts`, `.gitignore`.
- [x] **M1 room** — `src/core/engine.ts` (renderer/scene/camera + `Timer` loop with an
      `add(updater)` registry), `src/scene/room.ts` (orange walls, windows, tube lights,
      ceiling fan, chalkboard), `src/scene/labTable.ts`, `src/scene/lighting.ts`,
      `src/interaction/cameraRig.ts` (orbit ⇄ first-person), `src/ui/hud.ts`.
- [x] **M2 kit + cords + wiring** — all apparatus built **only** from the experiment's
      own equipment list (Reciprocity kit, patch cords, Digital Multimeter):
  - `src/kit/materials.ts` — palette + cached materials + canvas text/nameplate helpers
    (`makeTextTexture` auto-shrinks the font; `makeNameplate` = unlit plane).
  - `src/kit/terminal.ts` — brass binding post on a bakelite pad → a patchable
    `Terminal { id, label, color, object, worldPosition() }`.
  - `src/kit/resistor.ts` — axial R1/R2/R3 unit (ceramic body, colour bands, brass
    caps/leads, `R1 = 100 Ω` nameplate).
  - `src/kit/kitBase.ts` — the kit board + the Fig-1 T-network + terminals T1..T5.
  - `src/kit/powerSupply.ts` — variable DC source **E** (voltage window, set knob, LED,
    red `+` / black `−` posts).
  - `src/kit/multimeter.ts` — Digital Multimeter (LCD, dial, COM/VΩmA/10A jacks, stand),
    instantiated **twice** (V and mA) because Fig 1 shows both meters at once.
  - `src/kit/patchCord.ts` — patch cord = Verlet cord + banana plugs.
  - `src/kit/index.ts` — `createLabKit(surfaceY)` assembles + places everything and
    returns `{ group, terminals, terminalsById, components }`.
  - `src/cords/verletRope.ts` — position-based cord sim (gravity, damping, table floor).
  - `src/state/wiring.ts` — live wiring graph + `detectConfig()` → `"A" | "B" | null`.
  - `src/interaction/wiringTool.ts` — raycast pick / drag / snap wiring.
- [x] **M3 physics** — circuit graph + MNA solver + live E / V / I readouts:
  - `src/physics/netlist.ts` — the static Fig-1 T-network (rail bus T2–T5–T4,
    R1/R2/R3) plus every patch cord as an ideal wire; a union-find collapses each
    0 Ω group into one electrical node and returns `{ nodeOf, nodeCount,
    resistors, sources, meters }`. Exports `CircuitParams` / `DEFAULT_CIRCUIT`
    (E=6 V, R1=R2=R3=100 Ω — must mirror `kitBase.DEFAULT_RESISTORS`).
  - `src/physics/mna.ts` — Modified Nodal Analysis. Resistors → conductances; the
    supply **and** the milliammeter (an ideal 0 Ω sense branch) each add a branch
    current unknown; the reference node is `E-`; nodes on other islands read 0 V;
    solved with a hand-written Gaussian elimination + partial pivoting (no new
    deps). Returns `null` on a singular system.
  - `src/physics/index.ts` — `solveCircuit(wiring, params)` → `{ config,
    nodeVoltage, voltage, current, sourceCurrent }`; plus closed-form helpers
    `theoreticalCurrent` (`E·R3 / (R1R2+R2R3+R1R3)`) and `theoreticalResistance`.
  - `src/ui/hud.ts` — top-right **Circuit** readout panel (`config` / `emf` /
    `volts` / `amps` / `theory`), `setReadings()`, `.ui-readout--live` glow.
  - `src/main.ts` — `refreshReadings()` runs on `wiring.onChange` and drives
    `supply.setVoltage`, `voltmeter.setReading`, `milliammeter.setReading`; the
    physics API is exposed on `window.lab` for QA.
- [x] **M4 experiment flow** — Fig 1(a)→1(b) state machine, Table 1 + verification,
      runtime resistor swap:
  - `src/experiment/components.ts` — single source of truth for component values:
    `STANDARD_RESISTOR_OHMS`, `ResistorSet`, `DEFAULT_RESISTOR_SET`, `formatOhms`,
    `resistorSignature`. Both the kit board and `physics` now derive from it.
  - `src/experiment/flow.ts` — `ExperimentFlow` state machine (procedure steps 1–5).
    Rows are keyed by `(EMF, resistor set)`, so *changing R1–R3 and repeating* opens
    a new row; `record("A"|"B")` snapshots the reading; `verdict` compares the pair.
  - `src/ui/observationTable.ts` — apparatus R1/R2/R3 `<select>`s + the on-screen
    Table 1 (`S.No | E | I_A | I_B`), a verdict footer and a **Reveal theory** toggle.
  - `src/kit/resistor.ts` / `kitBase.ts` / `index.ts` — resistor units now return a
    `setValue()` hook and `KitBase.setResistors(ResistorSet)` repaints the nameplates
    **in place** (terminals, cords and the wiring graph are untouched → no re-wiring).
  - `src/physics/netlist.ts` — `DEFAULT_CIRCUIT` derives its r1/r2/r3 from
    `DEFAULT_RESISTOR_SET` (the two-place duplication is gone).
  - `src/ui/hud.ts` (`setPrompt`), `src/main.ts` (flow + table wiring, dev hooks),
    `src/style.css` (`.ui-prompt`, `.ui-apparatus`, `.ui-observations`).
- [ ] **M5 polish** (next) — HDRI, post-FX, sound, perf pass.

**Verified for M3 (this session):** `npx tsc --noEmit` clean; `npm run build`
clean (29 modules). With the dev-only `window.lab` hook, driving `wiring.add(...)`
and re-solving gave (all values redisplayed live in the HUD panel):

| wiring | `config` | V | I (mA) | source I (mA) | V(C1) |
| --- | --- | --- | --- | --- | --- |
| (nothing) | `null` | 0.000 | 0.00 | 0 | 0 |
| Fig 1(a) E/V→T1/T2, mA→T3/T4 | `A` | 6.000 | **20.00** | 40 | 2.000 |
| Fig 1(b) mA→T1/T2, E/V→T3/T4 | `B` | 6.000 | **20.00** | 40 | 2.000 |
| asymmetric R1=110, R2=330, R3=220, E=9 (1a) | `A` | 9.000 | **14.876033** | — | 4.909091 |
| asymmetric (1b) | `B` | 9.000 | **14.876033** | — | 1.636364 |

→ the solver's branch current exactly equals `theoreticalCurrent = E·R3/(R1R2+R2R3+R1R3)`
(6·100/30000 = 20 mA; 9·220/133100 = 14.876033 mA) and **I_A = I_B** for both the
balanced and the asymmetric network — reciprocity confirmed numerically. An
incomplete circuit (source only, no meters) returns `config = null`, 0 mA and does
**not** throw. Console: 0 errors / 0 warnings.

**Verified for M4 (this session):** `npx tsc --noEmit` clean; `npm run build` clean
(32 modules); console **0 errors / 0 warnings**. Driving the flow through the
dev-only `window.lab` hook (`recordObservation`, `setResistors`) produced:

| scenario | result |
| --- | --- |
| nothing wired, `recordObservation("A")` | returns **false** (blocked) |
| Fig 1(a) → record I_A; Fig 1(b) → record I_B (R=100, E=6) | row 1 = **20.00 / 20.00 mA**, theory 20.00 → **verified** |
| R={110,330,220}, E=9, repeat (step 5) | row 2 = **14.876 / 14.876 mA**, theory 14.876 → **verified** |
| change E to 12 *after* recording I_A, then record I_B | I_B lands in a **separate** row → **not** verified (guard works) |

→ the flow marks `verified` only when I_A and I_B share the same (EMF, R-set)
condition, and the on-screen Table 1 shows both rows green with a
"I_A = I_B — reciprocity verified" footer. The `Reveal theory` toggle fills the
`Theory` column (= `E·R3/(R1R2+R2R3+R1R3)`) without a re-render.

**Verified for M2 (earlier in this session):** `tsc` clean; `npm run build` clean
(26 modules, ~601 kB / ~151 kB gzip); console 0 errors/0 warnings; 12 terminals
registered; a full **Fig 1(a)** wiring (E±→T1/T2, V±→T1/T2, mA±→T3/T4) registers
all 6 connections and `detectConfig() === "A"`; cords render and drape.

---

## 5. The "Paused card never disappears" fix (COMMITTED — `74fda29`)

**User report:** *"this centre box doesnt go when i start playing and moving."*
The player could walk (WASD) but the centred **"Paused"** card stayed on screen.

### Root cause (important, subtle)
In **three r187**, `PointerLockControls` dispatches its `lock` event *before* it sets
`isLocked = true`:

```js
function onPointerlockChange() {
  if ( document.pointerLockElement === this.domElement ) {
    this.dispatchEvent( _lockEvent );   // our 'lock' handler runs HERE…
    this.isLocked = true;               // …but isLocked is still false
  } else { … }
}
```
`src/main.ts` ignored the argument it was given and re-read the rig:
```ts
onLockChange: () => hud?.update(rig.mode, rig.isLocked),   // ← stale `false`
```
So the HUD was told "not locked" at the exact moment the lock succeeded, and nothing
ever updated it again → **card stuck forever**. (Walking still worked because
`updateWalk()` reads `fp.isLocked` live each frame — hence "I can move but the box
stays".)

### Fix applied (4 files, all still uncommitted)
1. **`src/main.ts`** — use the value handed to the callback:
   `onLockChange: (locked) => hud?.update(rig.mode, locked)`. Added
   `onLockUnavailable: () => hud?.update(rig.mode, true)` and
   `onResume: () => rig.requestLook()`; and `rig.isOtherDragging = () => wiringTool.isDragging`.
2. **`src/interaction/cameraRig.ts`**
   - `onLockChange` now always called with an explicit `true`/`false`.
   - New `onLockUnavailable?` option + a `document` `pointerlockerror` listener →
     pointer lock refused (iframe/embed) no longer strands the user.
   - `requestLook()` wrapped in try/catch.
   - **Walk no longer requires lock** (`if (!fp) return;` instead of `if (!fp || !fp.isLocked)`).
   - **Drag-to-look fallback**: `lookBy(dx, dy)` + `pointerdown/move/up` handlers,
     active only while *not* locked, and yielding to the wiring tool via
     `isOtherDragging()`. `LOOK_SENSITIVITY = 0.0026`, pitch clamped ±(π/2 − 0.02).
3. **`src/ui/hud.ts`** — `update(mode, active)` (2nd param is now "player is driving",
   never a stale lock flag); the **Paused card is clickable** (click = `onResume`),
   button clicks excluded; hint bar now reads
   "WASD move · Shift run · drag to look · Left-click patch a cord · Right-click unplug".
4. **`src/interaction/wiringTool.ts`** — added public `get isDragging()`.

### Verification evidence (just run, via the dev-only `window.lab` hook)
Deterministically simulated the real event order (`document.pointerLockElement` set,
then `pointerlockchange` dispatched):
```
before: { mode:"firstperson", isLocked:false, pausedHidden:false, crosshairHidden:true }
after : { isLocked:true,  pausedHidden:true,  crosshairHidden:false, hintHidden:false }
```
→ the card hides, crosshair + hint appear. `npx tsc --noEmit` = **clean**.

**Status: fixed, verified and committed as `74fda29` (also added `PROGRESS.md`).**

---

## 5b. M3 physics — how the solver models the experiment

```
T1 ──R1── C1 ──R2── T3        terminals  T1 C1 T3 (top)   T2 T5 T4 (bottom rail)
             │                            E+ E-  V+ V-  mA+ mA-
            R3
             │                Static board: rail bus T2–T5–T4 (0 Ω), R1/R2/R3 branches.
T2 ───────── T5 ───────── T4   Patch cords: each cord is a 0 Ω wire → merges nodes.
```

- **Conventions:** voltage source `E` between `E+`(+) and `E-`(−); **milliammeter =
  an ideal 0 Ω sense branch** between `mA+` and `mA-` whose branch current *is* the
  reading; **voltmeter = open** (reading is `V(V+) − V(V-)`, draws no current).
- **Reference node** is `E-`'s node (the rail when wired). Nodes not galvanically
  connected to it are floating → they simply read 0 V (no singular matrix).
- **Why `I_A = I_B`:** with `E` across a port and the ammeter shorting the other
  port, both arrangements reduce to `R1` in series with `R2∥R3`, so the shared
  branch current is `E·R3/(R1R2+R2R3+R1R3)` — independent of which port the source
  drives. That identity is exactly what the solver reproduces (see §4 table).
- `solveCircuit` returns `null` only on a singular system; `main.ts` then shows
  0.000 V / 0.00 mA on the DMMs and "not wired" in the panel.

---

## 5c. M4 experiment flow — how the verification is modelled

```
wire Fig 1(a) ──► record I_A ──┐
                               ├── same (EMF, R-set)? ──► verified (I_A = I_B)
wire Fig 1(b) ──► record I_B ──┘
```

- **One source of truth for values:** `experiment/components.ts` owns the resistor
  numbers. `kitBase` silk-screens them (`formatOhms`) and `physics/netlist` derives
  `DEFAULT_CIRCUIT.r1/r2/r3` from the same `DEFAULT_RESISTOR_SET`, so the displayed
  value and the solved value can never drift (this closes PROGRESS §12's old risk).
- **Rows keyed by `(EMF, resistor set)`:** `ExperimentFlow.record("A"|"B")` snapshots
  `solution.current` into the row for the *current* condition. Procedure **step 5**
  ("change R1–R3 and repeat") is therefore automatic: a new R-set simply opens a new
  row, and I_A/I_B are only ever compared *within* one condition.
- **The guard:** if EMF or the resistor set changes between recording I_A and I_B,
  the two readings fall into different rows → the row never completes → it is **not**
  reported verified. This is what keeps a sloppy A/B pair from fooling the verdict.
- **Tolerance:** two readings match when `|I_A − I_B| ≤ max(0.02 mA, 0.5 %·I)`.
- **Resistor swap is in-place:** `KitBase.setResistors()` repaints the three resistor
  nameplates; the terminal objects, cords and the live wiring graph are untouched, so
  no re-wiring happens when the student changes a value.
- **Caveat:** `flow` requires only that E and mA match the figure; it *prompts* for the
  voltmeter but does not block recording on it (reciprocity needs only E and I).

---

## 6. What I was doing / about to do

### 6.1 Already done this session
`npm run build` (green) → committed the lock fix + `PROGRESS.md` as `74fda29` and
pushed → implemented + verified M3 (§4/§5b) and pushed → implemented + verified
**M4** (§4/§5c) as `9f7c33c`, then updated this file.

### 6.2 M4 — done (as implemented)
The flow + table shipped exactly as described in §4/§5c: `ExperimentFlow` keyed off
`wiring.detectConfig()` + `(EMF, R-set)`, the Table 1 UI with a verdict footer and a
`Reveal theory` toggle, in-place resistor swap via `KitBase.setResistors`, all driven
from `main.ts`'s `refreshReadings()`.

### 6.3 Next: M5 — polish, and the deferred items
- **M5 polish:** HDRI environment, post-FX, sound, perf pass.
- **Deferred:** add `reciprocity-3d-lab/` to the **outer** repo's `.gitignore`
  (nested-repo noise) — not done (would touch a different repo).
- **Optional realism:** give the meters a burden resistance (ammeter ≈1 Ω, voltmeter
  ≈10 MΩ) instead of the current ideal 0 Ω / open model.

---

## 7. World / camera constants (as built)

| Thing | Value |
| --- | --- |
| Table top (`surfaceY`) | **0.95** (true top surface) |
| Table size | 2.6 × 1.5 (top box centred at `surfaceY − 0.05`) |
| Kit board | 1.8 × 0.8, at `surfaceY + 0.03`, board centre `z = −0.04` |
| Supply | `(−0.74, surfaceY, 0.52)`, `rotation.y = 0.14` |
| Voltmeter DMM | `(0.0, surfaceY, 0.54)` |
| Milliammeter DMM | `(0.82, surfaceY, 0.52)`, `rotation.y = −0.16` |
| Orbit start | `ORBIT_POS = (7.2, 5.4, 8.6)` |
| First-person spawn | `(0.42, 1.55, 1.2)` |
| Gaze focus | `(0, surfaceY + 0.08, −0.04)` |
| Eye height / walk / run | 1.55 / 1.9 / 3.8 m·s⁻¹ |
| Walk bounds | room half-extent − 0.5 |
| Kit display scale | ~1.8× real so ~5 cm terminals stay clickable |

## 8. Kit topology & terminal world positions (verified live)

```
T1 (A top) ── R1 ── C1 ── R2 ── T3 (B top)
                     │
                    R3
                     │
T2 (rail) ────────  T5 ────────  T4 (rail)     ← common bottom rail bus
```

| id | label | world (x, y, z) | notes |
| --- | --- | --- | --- |
| `T1` | A top | −0.78, 0.98, −0.30 | source + / R1 left |
| `C1` | centre node | 0.00, 0.98, −0.30 | R1 right, R2 left, R3 top |
| `T3` | B top | 0.78, 0.98, −0.30 | R2 right / ammeter top |
| `T2` | rail left | −0.78, 0.98, +0.22 | source − |
| `T5` | rail centre | 0.00, 0.98, +0.22 | R3 bottom |
| `T4` | rail right | 0.78, 0.98, +0.22 | ammeter bottom |
| `E+` / `E-` | supply +/− | ≈ −0.81 / −0.65, 1.14, 0.56 | red / black posts on top |
| `V+` / `V-` | voltmeter jacks | ≈ +0.05 / −0.02, 1.14, 0.56 | red / black |
| `mA+` / `mA-` | milliammeter jacks | ≈ +0.87 / +0.80, 1.14, 0.54 | red / black |

**Fig 1(a):** `E±→T1/T2`, `V±→T1/T2`, `mA±→T3/T4` → reads `I_A`.
**Fig 1(b):** `mA±→T1/T2` → reads `I_B`, `E±→T3/T4`, `V±→T3/T4`.

## 9. Wiring interaction contract (`WiringTool`)
- Aim the crosshair; **left-click a terminal → new cord** (drag → release near another
  terminal to snap & connect). `GRAB_RADIUS = 0.1`, `SNAP_RADIUS = 0.17`, both measured as
  **ray↔terminal distance** (instrument posts sit ~19 cm above the table, so table-plane
  snapping does NOT work — that was already fixed).
- **Right-click a terminal → unplug** that cord end.
- **Multiple cords per terminal are allowed** (E and V both reach T1).
- Ray source: screen-centre when pointer-locked, otherwise the mouse position.
- Every connect/disconnect flows through `WiringState.add/find/remove` → `detectConfig()`.

## 10. Dev hooks & QA recipes
Dev builds expose
`window.lab = { engine, kit, rig, table, wiring, wiringTool, circuit, solveCircuit,
theoreticalCurrent, refreshReadings, flow, observations, setResistors,
recordObservation }` (stripped from production by `import.meta.env.DEV`). Useful calls:
- `lab.kit.terminalsById['T1'].worldPosition()`, `lab.wiring.list()`, `lab.wiring.detectConfig()`
- **physics:** `lab.solveCircuit(lab.wiring, lab.circuit)` → `{ config, nodeVoltage,
  voltage, current, sourceCurrent }`; `lab.theoreticalCurrent(lab.circuit)`;
  mutate `lab.circuit.E/r1/r2/r3` then `lab.refreshReadings()`.
- **flow / table (M4):** `lab.flow.update(lab.solveCircuit(lab.wiring, lab.circuit),
  lab.circuit)` → `{ state, prompt, canRecordA, canRecordB, rows, verdict }`;
  `lab.recordObservation("A"|"B")`; `lab.setResistors({ r1, r2, r3 })` (also repaints
  the board). Full headless verify:
  `wireA → recordObservation("A") → wireB → recordObservation("B")` → row shows
  20.00 / 20.00 mA and `verdict === "verified"`.
- **Fast Fig-1(a) wiring without dragging:** `lab.wiring.clear()` then
  `lab.wiring.add("E+","T1"); lab.wiring.add("E-","T2"); lab.wiring.add("V+","T1");
  lab.wiring.add("V-","T2"); lab.wiring.add("mA+","T3"); lab.wiring.add("mA-","T4")`
  → `detectConfig() === "A"`, panel shows 6.000 V / 20.00 mA.
- Enter FP in headless: click **"Enter the lab"**, wait ~2.5 s, then set the camera
  manually — `lab.engine.camera.position.set(0,1.95,0.72); lab.engine.camera.lookAt(0,1.0,-0.05)`
  (the rig won't fight you while unlocked). Hide the overlay card by finding
  `button[data-action="exit"]`, walking up to the `.ui-card` ancestor and setting
  `style.display = "none"`.
- Verify the lock fix deterministically (no real pointer lock needed):
  `Object.defineProperty(document,'pointerLockElement',{value:lab.engine.canvas,configurable:true});`
  then `document.dispatchEvent(new Event('pointerlockchange'))` and assert
  `[data-role="paused"]` gets the `hidden` class.
- Simulate wiring: project terminals to screen coords and dispatch `pointerdown` on the
  canvas at terminal A → `pointermove` → `pointerup` on **window** at terminal B.

## 11. Screenshots taken this session
In `C:\Users\Devesh Gupta\AppData\Local\Programs\Microsoft VS Code\.playwright-mcp\`:
`m2-overview.png`, `m2-fp-1.png`, `m2-fp-2.png`, `m2-kit-closeup.png`, `m2-kit-top.png`,
`m2-kit-top-2.png`, `m2-cords-figA.png`, `m2-final-spawn.png`,
`m3-readout-panel.png` (the new Circuit readout panel for Fig 1(a): 6.000 V / 20.00 mA),
`m4-observation-table.png` (full viewport with all four M4 panels) and
`m4-table-revealed.png` (Table 1 with the Theory column revealed, rows green, verified).

## 12. Open decisions / risks
- **Physics values — RESOLVED in M4:** the two-place duplication is gone.
  `src/experiment/components.ts` is the single source (`DEFAULT_RESISTOR_SET`);
  `physics.DEFAULT_CIRCUIT` and the kit board both derive from it, and the runtime
  resistor swap keeps the board and the solver in lock-step via
  `KitBase.setResistors` + `circuit.r1/r2/r3`.
- `solveCircuit` treats the milliammeter as an **ideal 0 Ω** branch and the voltmeter
  as **open** — no meter burden resistance. Fine for this experiment; if realism is
  wanted later, give the ammeter e.g. 1 Ω and the voltmeter e.g. 10 MΩ.
- The voltmeter reading is **signed** (`V(V+) − V(V-)`); a reversed connection shows a
  negative value, like a real DMM. Only the ammeter is reported as a magnitude.
- The GitHub repo is **PUBLIC** (the user's pre-existing one). Make it private with
  `gh repo edit Devesh-TheTechGuy/reciprocity-3d-lab --visibility private` if desired.
- Pointer lock inside VS Code *Simple Browser / Live Preview* iframes can be refused — the
  drag-to-look fallback covers that, but the preferred surface is a normal browser tab
  at `http://localhost:5173`.
- `docs/reference/*.py` (PDF extractors) + `pdf_content.txt` + `figures/fig1a.jpg`,
  `fig1b.jpg` are committed as the source-of-truth for the experiment — do not delete.

---

