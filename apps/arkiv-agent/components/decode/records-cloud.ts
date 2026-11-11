// A dataset's newest records as cards in mid-air: they fly out of the node, circle it slowly, then
// drift up and dissolve. Text is drawn to a canvas, so on-chain values never reach the DOM as HTML.
import * as THREE from "three";

export type CloudRecord = { key: string; status: string; attributes: { name: string; value: string }[] };
type Point = { x?: number; y?: number; z?: number };

const W = 560;
const H = 250;
const CARD_WIDTH = 30;
const RING = 44;
const IN_S = 0.75;
const OUT_S = 1.3;
const STAGGER_S = 0.07;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function cardTexture(r: CloudRecord, color: string): THREE.CanvasTexture {
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.roundRect(3, 3, W - 6, H - 6, 22);
  ctx.fillStyle = "rgba(4,6,11,0.96)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = r.status === "live" ? "#4ade80" : "#8590a6";
  ctx.beginPath();
  ctx.arc(34, 40, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.font = "500 24px 'JetBrains Mono Variable', ui-monospace, monospace";
  ctx.fillStyle = "#8590a6";
  ctx.fillText(`${r.key.slice(0, 10)}…${r.key.slice(-6)}  ·  ${r.status}`, 54, 41);
  // Short values first: they are the ones a card can show whole.
  const rows = [...r.attributes].sort((a, b) => a.value.length - b.value.length || a.name.localeCompare(b.name)).slice(0, 4);
  rows.forEach((a, i) => {
    const y = 92 + i * 40;
    ctx.font = "400 25px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#8590a6";
    const name = clip(a.name, 16);
    ctx.fillText(name, 30, y);
    ctx.fillStyle = "#b9c2d3";
    ctx.fillText(clip(a.value, 26), 30 + Math.min(230, ctx.measureText(name).width + 18), y);
  });
  if (!rows.length) { ctx.fillStyle = "#8590a6"; ctx.font = "400 25px Inter, system-ui, sans-serif"; ctx.fillText("no attributes", 30, 92); }
  return new THREE.CanvasTexture(canvas);
}

const ease = (x: number) => 1 - (1 - x) ** 3;
const unit = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Adds the cards to `scene` around `anchor` and animates them for `holdSeconds`, or until `dismiss`
 * is called; `onGone` fires when the last card has dissolved and everything is disposed.
 */
export function createRecordCloud(o: { scene: THREE.Scene; anchor: Point; records: readonly CloudRecord[]; color: string; holdSeconds: number; isStill: boolean; onGone: () => void }): { dismiss: () => void } {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: 0, depthWrite: false });
  const cards = o.records.map((record, i) => {
    const angle = (i / o.records.length) * Math.PI * 2;
    const target = new THREE.Vector3(Math.cos(angle) * RING, Math.sin(i * 1.9) * 20, Math.sin(angle) * RING);
    const material = new THREE.SpriteMaterial({ map: cardTexture(record, o.color), transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false });
    const sprite = new THREE.Sprite(material);
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geometry, lineMaterial);
    group.add(line, sprite);
    return { sprite, material, target, geometry, delay: i * STAGGER_S };
  });
  o.scene.add(group);

  const started = performance.now();
  let leaveAt: number | null = null;
  let frame = 0;
  const tick = () => {
    const t = (performance.now() - started) / 1000;
    if (leaveAt === null && t > o.holdSeconds) leaveAt = t;
    group.position.set(o.anchor.x ?? 0, o.anchor.y ?? 0, o.anchor.z ?? 0);
    if (!o.isStill) group.rotation.y = t * 0.14;
    let alive = 0;
    let peak = 0;
    for (const c of cards) {
      const a = ease(unit((t - c.delay) / IN_S));
      const u = leaveAt === null ? 0 : ease(unit((t - leaveAt - c.delay * 0.6) / OUT_S));
      if (u < 1) alive++;
      // Out: further from the node and upward, growing a little as it thins.
      c.sprite.position.copy(c.target).multiplyScalar(a * (1 + u * 0.55));
      c.sprite.position.y += u * 26;
      const size = CARD_WIDTH * (0.25 + 0.75 * a) * (1 + u * 0.3);
      c.sprite.scale.set(size, (size * H) / W, 1);
      c.material.opacity = a * (1 - u);
      peak = Math.max(peak, c.material.opacity);
      c.geometry.attributes.position!.setXYZ(1, c.sprite.position.x, c.sprite.position.y, c.sprite.position.z);
      c.geometry.attributes.position!.needsUpdate = true;
    }
    lineMaterial.opacity = peak * 0.3;
    if (alive > 0) { frame = requestAnimationFrame(tick); return; }
    dispose();
    o.onGone();
  };
  const dispose = () => {
    cancelAnimationFrame(frame);
    o.scene.remove(group);
    for (const c of cards) { c.material.map?.dispose(); c.material.dispose(); c.geometry.dispose(); }
    lineMaterial.dispose();
  };
  frame = requestAnimationFrame(tick);
  return { dismiss: () => { if (leaveAt === null) leaveAt = (performance.now() - started) / 1000; } };
}
