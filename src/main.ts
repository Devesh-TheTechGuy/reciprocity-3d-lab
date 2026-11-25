import "./style.css";
import * as THREE from "three";
import { Engine } from "./core/engine";
import { ROOM, createRoom } from "./scene/room";
import { createLabTable } from "./scene/labTable";
import { createLighting } from "./scene/lighting";
import { createLabKit } from "./kit";
import { WiringState } from "./state/wiring";
import { WiringTool } from "./interaction/wiringTool";
import { CameraRig, type CameraMode } from "./interaction/cameraRig";
import { Hud, type ReadoutView } from "./ui/hud";
import {
  DEFAULT_CIRCUIT,
  solveCircuit,
  theoreticalCurrent,
  type CircuitParams,
} from "./physics";

const container = document.querySelector<HTMLDivElement>("#app");
if (!container) throw new Error("#app container not found");

const engine = new Engine(container);

const room = createRoom();
engine.scene.add(room.group);

const table = createLabTable();
engine.scene.add(table.group);

const kit = createLabKit(table.surfaceY);
engine.scene.add(kit.group);

createLighting(engine.scene, ROOM);

// Look at the centre of the kit board; settle the player just in front of it.
const focus = new THREE.Vector3(0, table.surfaceY + 0.08, -0.04);

let hud: Hud | undefined;
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
  onModeChange: (mode: CameraMode) => hud?.update(mode, rig.isLocked),
  // NOTE: use the value we are handed. PointerLockControls fires 'lock' *before*
  // it flips `isLocked`, so reading rig.isLocked here would report a stale false.
  onLockChange: (locked: boolean) => hud?.update(rig.mode, locked),
  // Pointer lock refused (iframe/embed): keep playing via the drag-to-look fallback.
  onLockUnavailable: () => hud?.update(rig.mode, true),
});

hud = new Hud({
  onEnterFirstPerson: () => rig.enterFirstPerson(),
  onExitToOrbit: () => rig.exitToOrbit(),
  onResume: () => rig.requestLook(),
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
});

// Drag-to-look must not fight the wiring tool: while a cord is being dragged,
// the wiring tool owns the gesture.
rig.isOtherDragging = () => wiringTool.isDragging;

// ---------------------------------------------------------------------------
// M3 — physics. Solve the live circuit and float the meters off the result.
// ---------------------------------------------------------------------------
const circuit: CircuitParams = { ...DEFAULT_CIRCUIT };
let shownEmf = Number.NaN;

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

  hud?.setReadings({
    config,
    emf: `${circuit.E.toFixed(2)} V`,
    volts: `${volts.toFixed(3)} V`,
    amps: `${amps.toFixed(2)} mA`,
    theory: `${(theory * 1000).toFixed(2)} mA`,
  });
}

wiring.onChange(refreshReadings);
refreshReadings();

engine.add((delta) => {
  room.update(delta);
  rig.update(delta);
  wiringTool.update(delta);
});

engine.start();

// Dev-only handle for debugging / automated screenshots (stripped from builds).
if (import.meta.env.DEV) {
  (window as unknown as { lab?: unknown }).lab = {
    engine,
    kit,
    rig,
    table,
    wiring,
    wiringTool,
    circuit,
    solveCircuit,
    theoreticalCurrent,
    refreshReadings,
  };
}
