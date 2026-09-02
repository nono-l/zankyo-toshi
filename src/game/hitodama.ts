/*
  人魂。罰はない。ゲーミング色の炎で、近くの輪郭を少し返す。
  滑走おばけとは別物。配置は gen.ts、燃え方はここ。
*/
// @ts-nocheck
import * as THREE from "three";

export const GAMING_COLORS = [
  0xff2d95, 0x00f5d4, 0xb8ff00, 0xff6b00, 0xb537f2,
  0xff004d, 0x00b4ff, 0xffee00, 0xff7ae6, 0x39ff14,
  0xff00ea, 0x00ffff, 0xff4500, 0x7b68ee, 0x00ff9f,
  0xff1493, 0x1e90ff, 0xffd700, 0xbf00ff, 0x76ff03,
] as const;

let flameMap: THREE.CanvasTexture | null = null;

function flameTexture() {
  if (flameMap) return flameMap;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 128);
  for (let i = 0; i < 7; i++) {
    const cx = 32 + Math.sin(i * 1.7) * 4;
    const top = 8 + i * 4;
    const grd = ctx.createRadialGradient(cx, 100, 2, cx, 72 - i * 6, 28 - i * 2);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.22, "rgba(255,230,160,0.85)");
    grd.addColorStop(0.55, "rgba(255,120,40,0.45)");
    grd.addColorStop(1, "rgba(255,40,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, 86 - i * 7, 16 - i, 40 - i * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.quadraticCurveTo(cx + 14, 70, cx, 118);
    ctx.quadraticCurveTo(cx - 14, 70, cx, top);
    ctx.fill();
  }
  flameMap = new THREE.CanvasTexture(c);
  flameMap.needsUpdate = true;
  return flameMap;
}

export type SoulFx = {
  group: THREE.Group;
  light: THREE.PointLight;
  sprites: THREE.Sprite[];
  baseY: number;
  phase: number;
};

export function createSoul(color: number, phase: number): SoulFx {
  const map = flameTexture();
  const group = new THREE.Group();
  const tint = new THREE.Color(color);
  const mk = (opacity: number, additive = true) =>
    new THREE.SpriteMaterial({
      map,
      color: tint,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

  const core = new THREE.Sprite(mk(0.95));
  core.scale.set(0.42, 0.55, 1);
  core.position.y = 0.08;
  const mid = new THREE.Sprite(mk(0.7));
  mid.scale.set(0.62, 1.05, 1);
  mid.position.y = 0.22;
  const outer = new THREE.Sprite(mk(0.4));
  outer.scale.set(0.85, 1.45, 1);
  outer.position.y = 0.38;
  const tail = new THREE.Sprite(mk(0.28));
  tail.scale.set(0.35, 0.9, 1);
  tail.position.set(0.08, 0.7, 0);
  group.add(core, mid, outer, tail);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ball.position.y = 0.04;
  group.add(ball);

  const light = new THREE.PointLight(color, 1.45, 6.4, 2);
  light.position.y = 0.2;
  group.add(light);

  return { group, light, sprites: [core, mid, outer, tail], baseY: 1.22, phase };
}

export function tickSoul(fx: SoulFx, t: number, cam: THREE.Vector3 | null) {
  const flicker = 0.55 + 0.45 * Math.sin(t * 11 + fx.phase) * Math.sin(t * 7.3 + fx.phase * 1.7);
  fx.group.position.y = fx.baseY + Math.sin(t * 2.15 + fx.phase) * 0.2;
  fx.group.rotation.y = t * 0.4 + fx.phase;
  fx.sprites[0].scale.set(0.38 + flicker * 0.12, 0.5 + flicker * 0.18, 1);
  fx.sprites[1].scale.set(0.55 + flicker * 0.2, 0.95 + flicker * 0.35, 1);
  fx.sprites[2].scale.set(0.75 + flicker * 0.28, 1.25 + flicker * 0.45, 1);
  fx.sprites[3].position.x = Math.sin(t * 5 + fx.phase) * 0.1;
  fx.sprites[3].scale.set(0.3, 0.75 + flicker * 0.3, 1);
  fx.light.intensity = 1.05 + flicker * 0.7;
  if (cam) {
    const d = Math.hypot(cam.x - fx.group.position.x, cam.z - fx.group.position.z);
    fx.light.visible = d < 16;
  }
}
