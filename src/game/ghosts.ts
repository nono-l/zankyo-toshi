/*
  おばけの形。地形は gen.ts、滑走は echoes.ts。
  ギャラリーと本番は同じ関数を見る。ここでだけ傘をいじる。
*/
// @ts-nocheck
import * as THREE from "three";

export type GhostKind = "kasa";

export const GHOST_CATALOG: { kind: GhostKind; name: string; note: string }[] = [
  {
    kind: "kasa",
    name: "傘おばけ",
    note: "レールの上を跳ねる。一眼、舌、一本下駄。触れると器が棄てられる。",
  },
];

export function createGhost(kind: GhostKind) {
  if (kind === "kasa") return createKasaObake();
  return createKasaObake();
}

export function createKasaObake() {
  const g = new THREE.Group();
  g.name = "kasa-obake";

  const paper = new THREE.MeshStandardMaterial({
    color: 0xd4c4ae,
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x2a3e52,
    emissiveIntensity: 0.12,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x6b5344,
    roughness: 0.78,
  });
  const tongueMat = new THREE.MeshStandardMaterial({
    color: 0xe58b9a,
    roughness: 0.45,
    emissive: 0x7a3040,
    emissiveIntensity: 0.18,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xf6f1e8,
    roughness: 0.35,
    emissive: 0xdfe8f0,
    emissiveIntensity: 0.2,
  });
  const iris = new THREE.MeshStandardMaterial({
    color: 0x243040,
    roughness: 0.3,
    emissive: 0x4aa8d8,
    emissiveIntensity: 0.45,
  });

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    paper,
  );
  canopy.position.y = 1.08;
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 8, 20), wood);
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.98;
  const nub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), wood);
  nub.position.y = 1.4;
  g.add(canopy, brim, nub);
  for (let k = 0; k < 8; k++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4), wood);
    rib.position.y = 1.12;
    rib.rotation.z = 0.72;
    rib.rotation.y = (k / 8) * Math.PI * 2;
    g.add(rib);
  }

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), white);
  eye.position.set(0, 1.16, 0.46);
  eye.scale.set(1, 1, 0.72);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), iris);
  pupil.position.set(0, 1.16, 0.58);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), white);
  shine.position.set(0.05, 1.22, 0.64);
  g.add(eye, pupil, shine);

  const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 4, 8), tongueMat);
  tongue.position.set(0, 0.86, 0.38);
  tongue.rotation.x = 0.55;
  g.add(tongue);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.42, 8), wood);
  handle.position.y = 0.76;
  g.add(handle);

  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.16, 3, 6), paper);
  armL.position.set(-0.2, 0.78, 0.08);
  armL.rotation.z = 0.85;
  armL.rotation.x = 0.35;
  const armR = armL.clone();
  armR.position.x = 0.2;
  armR.rotation.z = -0.85;
  g.add(armL, armR);

  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.42, 8), paper);
  leg.position.y = 0.38;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.28), wood);
  foot.position.set(0, 0.16, 0.04);
  const getaF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.04), wood);
  getaF.position.set(0, 0.11, 0.12);
  const getaB = getaF.clone();
  getaB.position.z = -0.08;
  g.add(leg, foot, getaF, getaB);

  const lamp = new THREE.PointLight(0x66c8ff, 1.1, 4.5, 2);
  lamp.name = "ghostLamp";
  lamp.position.y = 1.2;
  g.add(lamp);
  return g;
}
