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
import { Hud } from "./ui/hud";

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
  onLockChange: () => hud?.update(rig.mode, rig.isLocked),
});

hud = new Hud({
  onEnterFirstPerson: () => rig.enterFirstPerson(),
  onExitToOrbit: () => rig.exitToOrbit(),
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

engine.add((delta) => {
  room.update(delta);
  rig.update(delta);
  wiringTool.update(delta);
});

engine.start();

// Dev-only handle for debugging / automated screenshots (stripped from builds).
if (import.meta.env.DEV) {
  (window as unknown as { lab?: unknown }).lab = { engine, kit, rig, table, wiring, wiringTool };
}
