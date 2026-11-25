# Reciprocity Theorem 3D Lab — Progress & Chat Handoff

> **Purpose of this file:** full state dump so work can resume in a new chat with
> zero context. Read sections 0–6 first; the rest is reference.

---

## 0. TL;DR — where to resume

**Project:** browser first-person 3D simulation of the school-lab experiment
*"To Verify the Reciprocity Theorem"* (Vite + TypeScript + three.js r187).

**Done & pushed:** M0 scaffold, M1 room + camera rig, M2 kit + patch cords + wiring.

**Done but NOT committed:** a bug fix for *"the centre Paused card never goes
away when playing"* (4 files modified). It is **verified working** — see §5.
Nothing else is half-edited.

**The very next action:** commit + push those 4 files (§6.1), then start M3.

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

**Commit history (pushed):**
```
7ebb710 (HEAD -> main, origin/main) Keep LICENSE from the initial remote repo
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

**Currently running at handoff time:** the Vite dev server **is still running on
port 5173** (started with `Start-Process npm.cmd … > vite-dev.log`). Temp logs
`vite-dev.log` / `vite-dev.err.log` exist in the project root and are gitignored
(`*.log`). Stop it with:
```powershell
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
- [ ] **M3 physics** (next) — circuit graph + MNA solver, live E / I_A / I_B readouts.
- [ ] **M4 experiment flow** — Fig 1(a)→1(b) state machine, observation table, verify.
- [ ] **M5 polish** — HDRI, post-FX, sound, perf pass.

**Verified for M2 (earlier in this session):** `tsc` clean; `npm run build` clean
(26 modules, ~601 kB / ~151 kB gzip); console 0 errors/0 warnings; 12 terminals
registered; a full **Fig 1(a)** wiring (E±→T1/T2, V±→T1/T2, mA±→T3/T4) registers
all 6 connections and `detectConfig() === "A"`; cords render and drape.

---

## 5. UNCOMMITTED WORK — the "Paused card never disappears" fix (VERIFIED)

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

**Status: fixed & verified, but NOT yet committed/pushed.**

---

## 6. What I was doing / about to do

### 6.1 IMMEDIATE next actions (in order)
```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location 'd:\Devesh\Devesh 2\Python\ML\Deepseek end Point\reciprocity-3d-lab'

npm run build        # reconfirm tsc+build (last tsc run was clean)

git add -A
git commit -m "Fix: Paused card stuck on lock (three r187 lock-event order) + drag-to-look fallback"
git push             # origin/main, already configured
```
Then stop the dev server and delete `vite-dev*.log` (see §2).

*Suggested commit body:* the HUD now uses the lock value passed by the rig
(PointerLockControls fires `lock` before `isLocked` flips); the Paused card is clickable
(resume); added `pointerlockerror` handling, a drag-to-look fallback (`lookBy`) guarded
against the wiring tool, and walking no longer requires pointer lock.

### 6.2 Then: M3 — physics (next milestone)
Goal: live, physically-accurate `E`, `I_A`, `I_B` on the supply + DMMs.
1. `src/physics/netlist.ts` — turn the kit's built-in wiring + `WiringState` edges into a
   node/branch graph (union-find terminal ids into electrical nodes).
2. `src/physics/mna.ts` — Modified Nodal Analysis: voltage source E gets an extra current
   unknown, resistors become conductances, the ammeter is an ideal 0 Ω sense branch; solve
   `G·x = b` with a small hand-written Gaussian elimination (no new deps).
3. `src/physics/index.ts` — `solveCircuit(wiring, { E, R1, R2, R3 })` → node voltages +
   branch currents (`I_A` = mA branch current in config A, else `I_B`).
4. Drive `supply.setVoltage(E)` / `voltmeter.setReading(E)` / `milliammeter.setReading(I)`.
5. Cross-check closed form: `I_A = I_B = E·R3 / (R1R2 + R2R3 + R1R3)`;
   `R_T = (R1R2 + R2R3 + R1R3) / R3`.
6. Sanity value: `E = 6 V`, `R1 = R2 = R3 = 100 Ω` → `I = 6·100/30000 = 0.02 A = 20 mA`.

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
Dev builds expose `window.lab = { engine, kit, rig, table, wiring, wiringTool }` (stripped
from production by `import.meta.env.DEV`). Useful calls:
- `lab.kit.terminalsById['T1'].worldPosition()`, `lab.wiring.list()`, `lab.wiring.detectConfig()`
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
`m2-kit-top-2.png`, `m2-cords-figA.png`, `m2-final-spawn.png`.

## 12. Open decisions / risks
- The GitHub repo is **PUBLIC** (the user's pre-existing one). Make it private with
  `gh repo edit Devesh-TheTechGuy/reciprocity-3d-lab --visibility private` if desired.
- Pointer lock inside VS Code *Simple Browser / Live Preview* iframes can be refused — the
  new drag-to-look fallback covers that, but the preferred surface is a normal browser tab
  at `http://localhost:5173`.
- `docs/reference/*.py` (PDF extractors) + `pdf_content.txt` + `figures/fig1a.jpg`,
  `fig1b.jpg` are committed as the source-of-truth for the experiment — do not delete.
- `PROGRESS.md` (this file) is new and **uncommitted**; commit it together with the fix.



---

