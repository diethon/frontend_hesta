// Generates placeholder device models in public/twin-models/ that follow the
// HESTA model contract (see docs/TWIN_MODELS.md). Replace any file with a
// Blender/CC0 model that keeps the same node and material names.
// Usage: node scripts/generate-twin-models.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, Scene, Shape, TorusGeometry, Vector2 } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter needs FileReader, which Node does not ship.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((result) => { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); this.onload?.({ target: this }); }); }
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/twin-models');
// Material names are the contract: the app recolours them from the HESTA palette.
const body = new MeshStandardMaterial({ name: 'body', color: 0xf4f1ea, roughness: .45, metalness: .05 });
const metal = new MeshStandardMaterial({ name: 'metal', color: 0xb9c2c8, roughness: .3, metalness: .8 });
const blade = new MeshStandardMaterial({ name: 'blade', color: 0xa96f3f, roughness: .6 });
const dark = new MeshStandardMaterial({ name: 'dark', color: 0x2b3036, roughness: .55 });
const slatMaterial = new MeshStandardMaterial({ name: 'slat', color: 0xd7dde2, roughness: .4, metalness: .55 });

const named = (object, name) => { object.name = name; return object; };
function roundedRect(width, height, radius) {
  const shape = new Shape(), x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function ceilingFan() {
  // Origin = ceiling mount point; the fan hangs along -Y. Units are metres.
  const fan = new Group();
  fan.name = 'ceiling-fan';
  const canopy = new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(.09, 0), new Vector2(.085, -.03), new Vector2(.05, -.07), new Vector2(0, -.075)], 32), body);
  canopy.name = 'canopy';
  const rod = new Mesh(new CylinderGeometry(.014, .014, .2, 16), metal);
  rod.name = 'downrod';
  rod.position.y = -.17;
  const blades = new Group();
  blades.name = 'blades'; // rotated around Y by the app
  blades.position.y = -.3;
  const motor = new Mesh(new LatheGeometry([new Vector2(0, .06), new Vector2(.1, .05), new Vector2(.13, .02), new Vector2(.13, -.02), new Vector2(.1, -.05), new Vector2(.04, -.07), new Vector2(0, -.075)], 40), body);
  motor.name = 'motor';
  blades.add(motor);
  // Paddle blade: wide rounded tip, narrow root, slight bevel so light catches the edge.
  const outline = new Shape();
  outline.moveTo(0, -.035);
  outline.lineTo(.42, -.075);
  outline.quadraticCurveTo(.56, -.07, .56, 0);
  outline.quadraticCurveTo(.56, .07, .42, .075);
  outline.lineTo(0, .035);
  outline.closePath();
  const bladeGeometry = new ExtrudeGeometry(outline, { depth: .008, bevelEnabled: true, bevelThickness: .003, bevelSize: .004, bevelSegments: 2, curveSegments: 12 });
  bladeGeometry.rotateX(-Math.PI / 2);
  for (let index = 0; index < 5; index += 1) {
    const arm = new Group();
    arm.rotation.y = index * Math.PI * 2 / 5;
    const bracket = new Mesh(new CylinderGeometry(.008, .012, .14, 8), metal);
    bracket.name = `bracket-${index}`;
    bracket.rotation.z = Math.PI / 2;
    bracket.position.set(.16, -.01, 0);
    const paddle = new Mesh(bladeGeometry, blade);
    paddle.name = `blade-${index}`;
    paddle.position.set(.2, -.015, 0);
    paddle.rotation.x = .12; // pitch
    arm.add(bracket, paddle);
    blades.add(arm);
  }
  fan.add(canopy, rod, blades);
  return fan;
}

function standingFan() {
  // Origin = floor centre; head centre at y=1.25, blowing towards +Z.
  const fan = named(new Group(), 'standing-fan');
  const base = named(new Mesh(new LatheGeometry([new Vector2(0, 0), new Vector2(.26, 0), new Vector2(.27, .015), new Vector2(.24, .05), new Vector2(.06, .07), new Vector2(0, .07)], 40), body), 'base');
  const pole = named(new Mesh(new CylinderGeometry(.018, .026, 1.12, 20), metal), 'pole');
  pole.position.y = .63;
  const head = named(new Group(), 'head');
  head.position.y = 1.25;
  const motor = named(new Mesh(new LatheGeometry([new Vector2(0, -.16), new Vector2(.07, -.15), new Vector2(.09, -.08), new Vector2(.085, 0), new Vector2(.05, .03), new Vector2(0, .035)], 32), body), 'motor');
  motor.rotation.x = Math.PI / 2;
  const blades = named(new Group(), 'blades'); // rotated around Z by the app
  blades.position.z = .07;
  const outline = new Shape();
  outline.moveTo(0, -.02); outline.bezierCurveTo(.12, -.09, .3, -.1, .3, 0); outline.bezierCurveTo(.3, .08, .14, .1, 0, .02); outline.closePath();
  const bladeGeometry = new ExtrudeGeometry(outline, { depth: .006, bevelEnabled: true, bevelThickness: .002, bevelSize: .003, bevelSegments: 2, curveSegments: 14 });
  for (let index = 0; index < 3; index += 1) {
    const paddle = named(new Mesh(bladeGeometry, blade), `blade-${index}`);
    paddle.rotation.set(0, .25, index * Math.PI * 2 / 3);
    blades.add(paddle);
  }
  blades.add(named(new Mesh(new CylinderGeometry(.05, .05, .05, 24).rotateX(Math.PI / 2), body), 'hub'));
  const guard = named(new Group(), 'guard');
  guard.position.z = .07;
  for (const [z, radius] of [[-.07, .34], [.07, .34], [.09, .12]]) {
    const ring = new Mesh(new TorusGeometry(radius, .006, 8, 64), metal);
    ring.position.z = z;
    guard.add(ring);
  }
  for (let index = 0; index < 16; index += 1) {
    const angle = index * Math.PI / 8;
    for (const z of [-.07, .07]) {
      const spoke = new Mesh(new CylinderGeometry(.003, .003, .34, 6), metal);
      spoke.rotation.z = angle + Math.PI / 2;
      spoke.position.set(Math.cos(angle) * .17, Math.sin(angle) * .17, z);
      guard.add(spoke);
    }
  }
  const badge = named(new Mesh(new CylinderGeometry(.06, .06, .012, 32).rotateX(Math.PI / 2), body), 'badge');
  badge.position.z = .095;
  guard.add(badge);
  head.add(motor, blades, guard);
  fan.add(base, pole, head);
  return fan;
}

function airConditioner() {
  // Origin = unit centre; back against the wall (-Z), louvre under the front.
  const unit = named(new Group(), 'ac');
  const profile = new Shape(); // side section in (z, y)
  profile.moveTo(-.14, .19); profile.lineTo(.06, .19); profile.quadraticCurveTo(.15, .17, .15, .06);
  profile.lineTo(.15, -.08); profile.quadraticCurveTo(.14, -.15, .1, -.17); profile.lineTo(-.14, -.19); profile.closePath();
  const shell = new ExtrudeGeometry(profile, { depth: 1.12, bevelEnabled: true, bevelThickness: .03, bevelSize: .02, bevelSegments: 3, curveSegments: 16 });
  shell.translate(0, 0, -.56);
  shell.rotateY(Math.PI / 2);
  const casing = named(new Mesh(shell, body), 'casing');
  const outlet = named(new Mesh(new BoxGeometry(1.04, .05, .06), dark), 'outlet');
  outlet.position.set(0, -.15, .1);
  const seam = named(new Mesh(new BoxGeometry(1.1, .004, .004), dark), 'seam');
  seam.position.set(0, .1, .17);
  const flap = named(new Group(), 'flap'); // rotated around X by the app
  flap.position.set(0, -.17, .13);
  const louvre = named(new Mesh(new BoxGeometry(1.05, .012, .1), body), 'louvre');
  louvre.position.z = .04;
  flap.add(louvre);
  unit.add(casing, outlet, seam, flap);
  return unit;
}

function tv() {
  // Origin = screen centre; wall at -Z. The app draws the lit screen in front of the frame.
  const set = named(new Group(), 'tv');
  const frame = new ExtrudeGeometry(roundedRect(1.25, .74, .015), { depth: .035, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2 });
  frame.translate(0, 0, -.02);
  const back = new ExtrudeGeometry(roundedRect(.9, .5, .04), { depth: .04, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 3 });
  back.translate(0, -.03, -.065);
  set.add(named(new Mesh(frame, dark), 'frame'), named(new Mesh(back, dark), 'back'));
  return set;
}

function rollerDoor() {
  // Unit size: 1 m wide (x -0.5..0.5), 1 m tall (y 0..1); the app scales it to the opening.
  // Slats live in `shutter`; the app lifts it and hides slats that reach the housing.
  const door = named(new Group(), 'roller-door');
  const shutter = named(new Group(), 'shutter');
  const slat = new Shape(); // corrugated profile in (z, y)
  slat.moveTo(-.008, 0); slat.lineTo(.008, 0); slat.lineTo(.008, .012); slat.quadraticCurveTo(.016, .025, .008, .038);
  slat.lineTo(.008, .05); slat.lineTo(-.008, .05); slat.lineTo(-.008, .038); slat.quadraticCurveTo(0, .025, -.008, .012); slat.closePath();
  const slatGeometry = new ExtrudeGeometry(slat, { depth: .98, bevelEnabled: false, curveSegments: 6 });
  slatGeometry.translate(0, 0, -.49);
  slatGeometry.rotateY(Math.PI / 2);
  for (let index = 0; index < 20; index += 1) {
    const piece = named(new Mesh(slatGeometry, slatMaterial), `slat-${index}`);
    piece.position.y = index * .05;
    shutter.add(piece);
  }
  const bottomBar = named(new Mesh(new BoxGeometry(.98, .02, .03), metal), 'bottom-bar');
  bottomBar.position.y = .01;
  shutter.add(bottomBar);
  const housing = named(new Mesh(new BoxGeometry(1.04, .12, .2), body), 'housing');
  housing.position.set(0, 1.06, -.03);
  const rails = [-.5, .5].map((x, index) => {
    const rail = named(new Mesh(new BoxGeometry(.03, 1, .05), metal), `rail-${index}`);
    rail.position.set(x, .5, 0);
    return rail;
  });
  door.add(shutter, housing, ...rails);
  return door;
}

async function exportModel(name, object) {
  const scene = new Scene();
  scene.add(object);
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, `${name}.glb`), Buffer.from(glb));
  console.log(`wrote public/twin-models/${name}.glb (${glb.byteLength} bytes)`);
}

await exportModel('ceiling-fan', ceilingFan());
await exportModel('standing-fan', standingFan());
await exportModel('ac', airConditioner());
await exportModel('tv', tv());
await exportModel('roller-door', rollerDoor());
