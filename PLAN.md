# Reciprocity Theorem - 3D First-Person Web Lab : PLAN

## 1. Objective
Build a browser-based, first-person 3D simulation of the school-lab experiment
"To Verify the Reciprocity Theorem", matching real lab equipment and procedure:
- Bird's-eye view of a wooden lab table -> click -> transition to first-person.
- In first-person: walk, grab patch cords, wire the kit, set the supply, read the
  digital multimeter, and verify the theorem with live, physically accurate values.
- Smooth, animated rendering (not a static diagram).

## 2. Experiment reference (extracted from Reciprocity theorem.pdf)
- Aim: To verify reciprocity theorem.
- Apparatus: (1) Reciprocity-theorem kit, (2) patch cords, (3) digital multimeter.
- Form I: In a passive, linear, bilateral, time-invariant network, if the single
  voltage source V_A in branch A produces the current response I_B in branch B,
  then removing the source from branch A and inserting it in branch B produces the
  current response I_A in branch A.
- Form II: Interchanging an ideal voltage source and an ideal ammeter in any
  passive linear bilateral time-invariant network does not change the ammeter
  reading.
- Notes: applies to transfer impedances/admittances but NOT to transfer ratios;
  applies only to single-source networks (other sources assumed made ineffective).
- Circuit: T-network of R1, R2, R3 (Fig. 1).
  - Fig 1(a): DC source E (+ voltmeter) in LEFT branch -> R1 -> centre node;
    R3 from centre node to common bottom rail; centre node -> R2 -> milliammeter
    (right) -> rail. Ammeter reads I_A.
  - Fig 1(b): milliammeter moved to the LEFT (reads I_B); source moved to the RIGHT
    branch after R2. Mirror image of (a).
- Procedure: wire (a) -> note E,I_A; wire (b) -> note E,I_B; change resistors; repeat.
- Observation table (Table 1): S.No | E | I_A | I_B.
- Result: I_A and I_B equal within experimental error => theorem verified.
- Viva Qs: single vs multi-source; bilateral network; transfer resistance;
  reciprocal network; limitations.
- Physics: I_A = I_B = E*R3 / (R1R2 + R2R3 + R1R3);
  transfer resistance R_T = (R1R2 + R2R3 + R1R3)/R3.
- Kit topology as built (M2), exactly matching Fig 1:
  - The kit board already wires the T-network internally: R1 (T1-C1), R2 (C1-T3),
    R3 (C1-T5) and the common bottom rail bus (T2-T5-T4). Exposed terminals:
    T1 (A top), T2 (rail left), C1 (centre node), T3 (B top), T4 (rail right),
    T5 (rail centre).
  - Fig 1(a): source E across T1(+)/T2(-); voltmeter V across T1/T2; milliammeter
    mA across T3/T4  -> reads I_A.
  - Fig 1(b): milliammeter mA across T1/T2 -> reads I_B; source E across T3/T4;
    voltmeter V across T3/T4.
  - Apparatus list names a single "Digital Multimeter", so the model is used as
    both V and mA (two instances) - the figure shows V and mA at the same time.

## 3. Environment findings (verified)
- Windows, PowerShell 5.1; Python 3.12.2 present (with Pillow); no PDF libs
  (PDF text/figures were extracted with stdlib zlib).
- Node.js v26.13.1 + npm 11.20.0 installed at C:\Program Files\nodejs\ (restart
  terminal or prepend path so node/npm are on PATH).
- Network OK: npm registry 200; Poly Haven API 200; ambientCG 200.
- No MCP servers configured. No additional MCP required (see section 8).

## 4. Tech decisions
- Language: TypeScript (typed nodes/branches/terminals, wiring graph, MNA solver,
  experiment state machine). Vite compiles TS with no extra config; zero runtime cost.
- Bundler/dev server: Vite (vanilla-ts). node_modules/ is local to the project
  (isolated; the "venv" equivalent).
- 3D: three.js (WebGL2) + EffectComposer, SSAO, Bloom, OutputPass.
- No heavy physics engine: purpose-built raycast + snap + verlet-wire for accurate,
  controllable wiring.
- Rendering: ACES filmic tone mapping, sRGB, PCF soft shadows, HDRI environment
  lighting, post-FX stack, delta-time loop, devicePixelRatio, MSAA.

## 5. Project structure
```
reciprocity-3d-lab/
  index.html                 # Vite entry (mounts /src/main.ts into #app)
  package.json               # scripts: dev / build / preview
  tsconfig.json              # strict TS, bundler resolution, noEmit
  vite.config.ts             # dev server (host, port 5173)
  PLAN.md                    # this file
  docs/reference/            # PDF extraction scripts + recovered text + figures
  public/assets/             # runtime assets (HDRI, textures) served as-is
  src/
    main.ts                  # bootstrap: engine + room + camera rig + HUD
    style.css                # reset, #app mount, overlay UI styles
    core/
      engine.ts              # renderer, scene, camera, animation loop, resize
    scene/
      room.ts                # orange walls, windows, tube lights, ceiling fan (M1)
      labTable.ts            # wooden table; surfaceY is the true top surface (M1/M2)
      lighting.ts            # hemisphere fill + shadow-casting sun (M1)
    interaction/
      cameraRig.ts           # orbit -> first-person transition + WASD walk (M1)
      wiringTool.ts          # raycast pick + drag + snap-to-terminal wiring (M2)
    ui/
      hud.ts                 # branding, intro/paused cards, crosshair, hints (M1)
      (later: DMM readout, supply dial, observation table)
    kit/
      materials.ts           # shared palette + material / text / nameplate helpers (M2)
      terminal.ts            # brass binding post = a patchable Terminal (M2)
      resistor.ts            # axial R1/R2/R3 unit with value plate (M2)
      kitBase.ts             # kit board + R1/R2/R3 T-network + terminals T1..T5 (M2)
      powerSupply.ts         # variable DC source E (M2)
      multimeter.ts          # digital multimeter, used as V and as mA (M2)
      patchCord.ts           # Verlet patch cord with banana plugs (M2)
      index.ts               # createLabKit(): assemble + place on the table (M2)
    cords/
      verletRope.ts          # position-based (Verlet) cord simulation (M2)
    physics/                 # circuit model (nodes/branches), MNA solver, values
    state/
      wiring.ts              # live wiring graph (terminal->terminal) + Fig-1 detect (M2)
      (later: experiment state machine, observation table store)
    utils/                   # math helpers, units, id generation
```

## 6. Milestones
- M0 (scaffold) [done]: Vite + TS project, `npm install`, dev server runs, minimal
  three.js scene renders (floor + table + placeholder kit).
- M1 (room) [done]: orange lab walls, windows, tube lighting, ceiling fan, wooden
  table. Orbit view -> click -> smooth transition to first-person camera + WASD
  walk. Modules: core/engine.ts, scene/{room,labTable,lighting}.ts,
  interaction/cameraRig.ts, ui/hud.ts.
- M2 (kit + cords) [done]: the full apparatus, built only from the experiment's
  own equipment list (kit, patch cords, digital multimeter):
  - kit/materials.ts, terminal.ts, resistor.ts: brass binding posts and axial
    R1/R2/R3 units with value plates.
  - kit/kitBase.ts: the kit board wired as the Fig-1 T-network
    T1-R1-C1-R2-T3 / C1-R3-T5 / rail T2-T5-T4, terminals T1..T5.
  - kit/powerSupply.ts: variable DC source E (red + / black - posts).
  - kit/multimeter.ts: the Digital Multimeter; instantiated twice (VOLTS across
    the source, MILLIAMPS in a branch) to reproduce the simultaneous V and mA of
    Fig 1. One DMM model, used as both meters - as in a real school lab.
  - kit/patchCord.ts + cords/verletRope.ts: Verlet patch cords with banana plugs.
  - interaction/wiringTool.ts + state/wiring.ts: aim at a terminal, left-click to
    run a new cord, drag to another terminal and release to snap; right-click to
    unplug. Stacking cords on one terminal is allowed (E and V both reach T1).
    WiringState.detectConfig() recognises Fig-1 arrangement A / B.
  - M3 (physics) is next.
- M3 (physics): circuit graph from wiring state, MNA solver, live E/I_A/I_B values,
  DMM readout, supply dial.
- M4 (experiment flow): state machine for Fig 1(a) -> 1(b), observation table UI,
  "verify" check, resistor change + repeat, result statement.
- M5 (polish): HDRI environment, post-FX (SSAO/bloom), sound cues, animations,
  performance pass, mobile/touch fallback.

## 7. Asset pipeline
- Figures: fig1a.jpg / fig1b.jpg recovered from the PDF into docs/reference/figures
  (used as wiring references, not runtime textures).
- Textures/HDRI: fetched from Poly Haven / ambientCG (confirmed reachable), cached
  into public/assets/ at build-prep time; kept small (1-2k) for web.
- All runtime assets live under public/assets/ and are served verbatim by Vite.

## 8. MCP decision
- No MCP server is required. Filesystem writes go through the editor tool;
  shell/build/test go through the PowerShell tool with the node PATH prefix.
- Web asset discovery uses plain HTTPS fetches to the (already verified) CDNs.


## 9. Testing
- Type/compile gate: `npm run build` (runs `tsc` with strict + `vite build`).
- Runtime gate: `npm run dev`, load http://localhost:5173, check console is clean
  and the scene renders. Built-in Playwright (headless software WebGL) is used for
  correctness/console assertions + screenshots, NOT for FPS measurement.
- Physics unit checks: closed-form I_A = I_B = E*R3/(R1R2+R2R3+R1R3) vs solver
  output for sample resistor sets.

## 10. Run
```powershell
$env:Path = 'C:\Program Files\nodejs\;' + $env:Path
Set-Location 'd:\Devesh\Devesh 2\Python\ML\Deepseek end Point\reciprocity-3d-lab'
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle -> dist/
npm run preview  # serve the built bundle
```

## 11. Tradeoffs
- Custom raycast/snap/verlet instead of a physics engine: more code, but exact
  control over terminal snapping and stable cable motion (no jitter).
- Full MNA solver instead of hard-coded formulas: covers arbitrary (mis)wiring and
  lets the tutor mode show real node voltages; slightly more code than closed-form.
- Hosted web (Vite dev/preview) instead of packaged desktop: zero install for
  students, instant iteration; relies on a browser with WebGL2.
- HDRI + post-FX for realism vs. payload: assets kept modest (1-2k, few effects)
  to keep first load reasonable on school hardware.

