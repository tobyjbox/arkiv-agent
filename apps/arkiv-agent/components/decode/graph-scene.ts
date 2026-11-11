// Three.js objects for the Arkiv-Decode map: glowing nodes, name labels and a starfield.
// Textures and geometry are shared, so a thousand nodes cost a thousand small meshes and no more.
import * as THREE from "three";

let glow: THREE.Texture | null = null;
const sphere = new THREE.SphereGeometry(1, 20, 20);

/** A soft white disc that fades out: tinted and added to the scene, it reads as light around a node. */
function glowTexture(): THREE.Texture {
  if (glow) return glow;
  const size = 128;
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.25, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glow = new THREE.CanvasTexture(canvas);
  return glow;
}

/** Text drawn to a canvas, so on-chain names never reach the DOM as HTML. */
function labelSprite(text: string, color: string): THREE.Sprite {
  const font = "500 40px Inter, system-ui, sans-serif";
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + 16;
  const canvas = Object.assign(document.createElement("canvas"), { width, height: 56 });
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, 28);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, depthTest: false, opacity: 0.85, sizeAttenuation: false, fog: false }));
  // Without size attenuation the scale is a share of the view height: names stay one size near and far.
  sprite.scale.set((width / 56) * 0.027, 0.027, 1);
  return sprite;
}

/** `isQuiet`: nothing was decoded about it, so it gets no halo and stays in the background. */
/** A project's ball stands for the project, not for records: a darker shade of its colour sets it apart from its datasets. */
const HUB_SHADE = 0.38;

/**
 * Only a node's ball answers the pointer. Its glow, ring and name are far larger than the ball, and a
 * project's would otherwise catch the hover and the click meant for the datasets inside them.
 */
const noHit = () => {};
const RING_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2.4, 0, 0));

export type NodeLook = { radius: number; color: string; isHub: boolean; isDimmed: boolean; isQuiet: boolean; label: string | null };

/** A bright core with a halo; hubs get a ring and, when asked, their name above them. */
export function nodeObject(look: NodeLook): THREE.Object3D {
  const group = new THREE.Group();
  const color = new THREE.Color(look.color);
  const core = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: look.isDimmed ? color.clone().multiplyScalar(0.09) : look.isHub ? color.clone().multiplyScalar(HUB_SHADE) : color }));
  core.scale.setScalar(look.radius);
  group.add(core);
  if (look.isDimmed) return group;
  if (look.isQuiet && !look.label) return group;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: look.isHub ? 0.26 : 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(look.radius * (look.isHub ? 6 : 4));
  halo.raycast = noHit;
  group.add(halo);
  if (look.isHub) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(look.radius * 1.9, look.radius * 0.035, 8, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    // Always the same tilt towards the viewer: fixed in space it reads as an ellipse from one side and
    // as a full circle around the project from another.
    ring.onBeforeRender = (_renderer, _scene, camera) => { ring.quaternion.copy(camera.quaternion).multiply(RING_TILT); };
    ring.raycast = noHit;
    group.add(ring);
  }
  if (look.label) {
    const label = labelSprite(look.label.length > 22 ? `${look.label.slice(0, 21)}…` : look.label, "#9aa6bc");
    label.position.set(0, look.radius * 2 + 6, 0);
    label.raycast = noHit;
    group.add(label);
  }
  return group;
}

/** Distant points in two tints, far outside the graph, for depth as the view turns. */
export function starfield(count = 2600): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tints = [new THREE.Color("#9fb4ff"), new THREE.Color("#7ff5e3"), new THREE.Color("#ffffff")];
  // A fixed sequence, so the sky is the same on every visit.
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < count; i++) {
    const r = 2600 + random() * 3800;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)], i * 3);
    const c = tints[Math.floor(random() * tints.length)]!.clone().multiplyScalar(0.35 + random() * 0.65);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 5, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
}
