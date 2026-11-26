import "./style.css";
import * as THREE from "three";
import { Engine } from "./core/engine";
import { PostFx } from "./core/postfx";
import { PerfGovernor, type QualityTargets } from "./core/perf";
import { ROOM, createRoom } from "./scene/room";
import { createLabTable } from "./scene/labTable";
import { createLighting } from "./scene/lighting";
import { Environment } from "./scene/environment";
import { createLabKit } from "./kit";
import { WiringState } from "./state/wiring";
import { WiringTool } from "./interaction/wiringTool";
import { CameraRig, type CameraMode } from "./interaction/cameraRig";
import { Hud, type ReadoutView } from "./ui/hud";
import { ObservationTable } from "./ui/observationTable";
import { Schematic } from "./ui/schematic";
import { PerfPanel } from "./ui/perfPanel";
import { TouchPad } from "./ui/touchPad";
import { Sfx } from "./audio/sfx";
import { ExperimentFlow } from "./experiment/flow";
import type { ResistorSet } from "./experiment/components";
import {
  DEFAULT_CIRCUIT,
  solveCircuit,
  theoreticalCurrent,
  type CircuitParams,
} from "./physics";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("#app container not found");

/**
 * M5 slice 5 — the primary input is a finger. Touch devices get the on-screen
 * walk pad, bigger hit targets, the phone layout, and start one quality rung
 * lower (the governor still adapts from there).
 */
const COARSE_POINTER = window.matchMedia("(pointer: coarse)").matches;

const engine = new Engine(container);

const room = createRoom();
engine.scene.add(room.group);

const table = createLabTable();
engine.scene.add(table.group);

const kit = createLabKit(table.surfaceY);
engine.scene.add(kit.group);

const lighting = createLighting(engine.scene, ROOM);

// M5 — HDRI environment: a CC0 Poly Haven studio map, PMREM-filtered into
// `scene.environment` so every MeshStandardMaterial gets diffuse + specular IBL.
// Loads asynchronously; the flat background is replaced once the map is decoded.
const environment = new Environment({
  renderer: engine.renderer,
  scene: engine.scene,
  // `BASE_URL` is "/" in dev and "/reciprocity-3d-lab/" on GitHub Pages, so the
  // HDRI resolves under whatever base the build was produced with.
  url: `${import.meta.env.BASE_URL}assets/hdri/studio_small_09_1k.hdr`,
  intensity: 0.45,
  background: true,
  backgroundIntensity: 0.28,
  backgroundBlurriness: 0.7,
});

// M5 — post-FX: SSAO + bloom, tone-mapped and encoded once by the OutputPass.
const postfx = new PostFx({
  renderer: engine.renderer,
  scene: engine.scene,
  camera: engine.camera,
});
engine.setComposer(postfx);

// M5 slice 4 — performance governor. Each preset drives the four knobs that
// actually cost time here: drawing-buffer resolution (quadratic fill cost),
// post-FX passes, the sun's shadow map, and MSAA. In `auto` mode the governor
// steps down when the averaged FPS sags and back up once it recovers.
const qualityTargets: QualityTargets = {
  setPixelRatioCap: (cap) => engine.setPixelRatioCap(cap),
  setShadowMapSize: (size) => {
    lighting.sun.shadow.mapSize.set(size, size);
    // Drop the existing depth texture so three re-allocates it at the new size.
    lighting.sun.shadow.map?.dispose();
    lighting.sun.shadow.map = null;
  },
  setSamples: (samples) => postfx.setSamples(samples),
  setPasses: (passes) => postfx.setPasses(passes),
};

const perf = new PerfGovernor(qualityTargets, { initialTier: COARSE_POINTER ? "medium" : "high" });
const perfPanel = new PerfPanel({ onMode: (mode) => perf.setMode(mode) });
perf.onChange(() => perfPanel.update(perf.fps, perf.qualityMode, perf.tierName));
perfPanel.update(perf.fps, perf.qualityMode, perf.tierName);

// Look at the centre of the kit board; settle the player just in front of it.
const focus = new THREE.Vector3(0, table.surfaceY + 0.08, -0.04);

// M5 slice 3 — synthesized sound cues (WebAudio; no assets, safe when headless).
const sfx = new Sfx();

let hud: Hud | undefined;
let touchPad: TouchPad | undefined;

/**
 * Keep every screen overlay in step with the camera mode. The touch pad only
 * appears while actually walking, so the mode/activity plumbing is shared.
 */
const syncUi = (mode: CameraMode, active: boolean): void => {
  hud?.update(mode, active);
  touchPad?.update(mode, active, COARSE_POINTER);
  // Phone layout hook: while walking, secondary panels get out of the way.
  document.documentElement.classList.toggle("ui-fp", mode === "firstperson");
};

/**
 * "Playing" means the lab is live: either the pointer is locked, or we are on a
 * touch device where lock never arrives and drag-to-look is the control. Never
 * derived from a stale lock flag.
 */
const isActive = (locked: boolean): boolean => COARSE_POINTER || locked;

const rig = new CameraRig({
  camera: engine.camera,
  domElement: engine.canvas,
  focus,
  bounds: {
    minX: -ROOM.width / 2 + 0.5,
    maxX: ROOM.width / 2 - 0.5,
    minZ: -ROOM.depth / 2 + 0.5,
    maxZ: ROOM.depth / 2 - 0.5,
    eyeHeight: 1.55,
  },
  firstPersonPos: new THREE.Vector3(0.42, 1.55, 1.2),
  onModeChange: (mode: CameraMode) => syncUi(mode, isActive(rig.isLocked)),
  // NOTE: use the value we are handed. PointerLockControls fires 'lock' *before*
  // it flips `isLocked`, so reading rig.isLocked here would report a stale false.
  onLockChange: (locked: boolean) => syncUi(rig.mode, isActive(locked)),
  // Pointer lock refused (iframe/embed): keep playing via the drag-to-look fallback.
  onLockUnavailable: () => syncUi(rig.mode, true),
});

hud = new Hud(
  {
    onEnterFirstPerson: () => {
      // The click that enters the lab is the user gesture that unlocks audio.
      sfx.resume();
      rig.enterFirstPerson();
    },
    onExitToOrbit: () => rig.exitToOrbit(),
    onResume: () => rig.requestLook(),
  },
  { touch: COARSE_POINTER },
);

// M5 slice 5 — the on-screen walk pad: a phone has no WASD, and (since the
// touch fallback never opens the paused card) this is also its way back out.
touchPad = new TouchPad({
  onMove: (forward, right) => rig.setMoveInput(forward, right),
  onExit: () => rig.exitToOrbit(),
});

// Clicking the canvas while in first-person (but unlocked) grabs the pointer.
window.addEventListener("click", (event) => {
  if (event.target === engine.canvas && rig.mode === "firstperson" && !rig.isLocked) {
    rig.requestLook();
  }
});

const wiring = new WiringState();
const wiringTool = new WiringTool({
  camera: engine.camera,
  scene: engine.scene,
  domElement: engine.canvas,
  terminals: kit.terminals,
  wiring,
  floorY: table.surfaceY,
  isActive: () => rig.mode === "firstperson",
  // Sound cues: a banana plug snapping home / a cord being pulled off.
  onConnect: () => sfx.plug(),
  onDisconnect: () => sfx.unplug(),
});

// Drag-to-look must not fight the wiring tool: while a cord is being dragged,
// the wiring tool owns the gesture.
rig.isOtherDragging = () => wiringTool.isDragging;

// ---------------------------------------------------------------------------
// M4 — experiment flow. The Fig 1(a)→1(b) state machine + the observation table.
// ---------------------------------------------------------------------------
const flow = new ExperimentFlow();

const observations = new ObservationTable({
  onRecord: (label) => {
    if (flow.record(label)) refreshReadings();
  },
  onClear: () => {
    flow.reset();
    refreshReadings();
  },
  onResistorChange: (values: ResistorSet) => {
    // Re-silk-screen the board and hand the new values to the solver, then start
    // a fresh A/B pair (rows are keyed by the resistor set).
    kit.components.base.setResistors(values);
    circuit.r1 = values.r1;
    circuit.r2 = values.r2;
    circuit.r3 = values.r3;
    refreshReadings();
  },
});

// M5 — live 2D wiring schematic on the side, mirroring the physical kit.
const schematic = new Schematic();
// On a phone the panel would eat most of the screen, so it starts as a title bar.
if (COARSE_POINTER) schematic.setCollapsed(true);

// ---------------------------------------------------------------------------
// M3 — physics. Solve the live circuit and float the meters off the result.
// ---------------------------------------------------------------------------
const circuit: CircuitParams = { ...DEFAULT_CIRCUIT };
let shownEmf = Number.NaN;
// Sound-cue edge detection: the last live figure + last displayed ammeter text.
let lastLiveConfig: "A" | "B" | null = null;
let lastAmpText = "";

// Reflect the board's starting resistor values in the apparatus selectors.
observations.setResistors({ r1: circuit.r1, r2: circuit.r2, r3: circuit.r3 });

function refreshReadings(): void {
  const solution = solveCircuit(wiring, circuit);
  const wired = solution !== null && solution.config !== null;
  const theory = theoreticalCurrent(circuit);

  // The supply's own window always shows its set value.
  if (circuit.E !== shownEmf) {
    kit.components.supply.setVoltage(circuit.E);
    shownEmf = circuit.E;
  }

  if (solution && wired) {
    kit.components.voltmeter.setReading(solution.voltage.toFixed(3));
    kit.components.milliammeter.setReading((solution.current * 1000).toFixed(2));
  } else {
    kit.components.voltmeter.setReading("0.000");
    kit.components.milliammeter.setReading("0.00");
  }

  const config: ReadoutView["config"] =
    solution?.config === "A" ? "Fig 1(a)" : solution?.config === "B" ? "Fig 1(b)" : "not wired";
  const volts = wired && solution ? solution.voltage : 0;
  const amps = wired && solution ? solution.current * 1000 : 0;

  // Sound cues: a relay clack when the circuit closes (or the figure swaps), and a
  // tiny meter blip when a reading settles on a new value. Both are no-ops until
  // audio is unlocked by the "Enter the lab" click.
  const liveCfg = solution?.config ?? null;
  const ampText = amps.toFixed(2);
  if (liveCfg !== lastLiveConfig) {
    if (liveCfg !== null) sfx.switch();
    lastLiveConfig = liveCfg;
    lastAmpText = ampText;
  } else if (wired && ampText !== lastAmpText) {
    sfx.tick();
    lastAmpText = ampText;
  }

  hud?.setReadings({
    config,
    emf: `${circuit.E.toFixed(2)} V`,
    volts: `${volts.toFixed(3)} V`,
    amps: `${amps.toFixed(2)} mA`,
    theory: `${(theory * 1000).toFixed(2)} mA`,
  });

  // M4 — drive the experiment flow + observation table from the same solution.
  const view = flow.update(solution, circuit);
  hud?.setPrompt(view.prompt);
  observations.render(view);

  // M5 — the 2D schematic: show the figure being worked towards while the
  // circuit is open (how to patch), and the live, animated circuit once closed.
  const lastRow = view.rows[view.rows.length - 1];
  const wantB =
    view.state === "recordedA" ||
    view.state === "needsB" ||
    (solution?.config === null && lastRow !== undefined && lastRow.iA !== null && lastRow.iB === null);
  const target: "A" | "B" = solution?.config ?? (wantB ? "B" : "A");
  schematic.render({ params: circuit, solution, cords: wiring.list(), target });
}

wiring.onChange(refreshReadings);
refreshReadings();

engine.add((delta) => {
  room.update(delta);
  rig.update(delta);
  wiringTool.update(delta);
  schematic.tick(delta);
  // Real wall-clock time (not the clamped frame delta) so the FPS average is honest.
  perf.tick();
});

engine.start();

// Dev-only handle for debugging / automated screenshots (stripped from builds).
if (import.meta.env.DEV) {
  (window as unknown as { lab?: unknown }).lab = {
    engine,
    kit,
    postfx,
    environment,
    rig,
    table,
    wiring,
    wiringTool,
    circuit,
    solveCircuit,
    theoreticalCurrent,
    refreshReadings,
    flow,
    observations,
    schematic,
    sfx,
    perf,
    perfPanel,
    hud,
    touchPad,
    coarsePointer: COARSE_POINTER,
    // QA helpers: apply a resistor set / record a reading without the UI.
    setResistors: (values: ResistorSet) => {
      kit.components.base.setResistors(values);
      circuit.r1 = values.r1;
      circuit.r2 = values.r2;
      circuit.r3 = values.r3;
      observations.setResistors(values);
      refreshReadings();
    },
    recordObservation: (label: "A" | "B") => {
      const ok = flow.record(label);
      refreshReadings();
      return ok;
    },
  };
}
