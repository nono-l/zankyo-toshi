/*
  おばけの形。地形は gen.ts、滑走は echoes.ts。
  ギャラリーと本番は同じ関数を見る。
  2026-09-04 ログ復元。未コミット分を会話記録から再構成した。
*/
// @ts-nocheck
import * as THREE from "three";

export type GhostKind = "kasa" | "mimic" | "aka" | "pipe" | "yuki" | "meri";

export const GHOST_CATALOG: {
  kind: GhostKind;
  no: number;
  name: string;
  note: string;
}[] = [
  {
    kind: "kasa",
    no: 1,
    name: "傘おばけ",
    note: "レールの上を跳ねる。カケラを取るたび五体増える。触れれば器は棄てられる。",
  },
  {
    kind: "mimic",
    no: 2,
    name: "ミミックさん",
    note: "壁際に三十。袋の顔は顔文字で個体差。初期位置から六メートルまでしか歩けない。触れればハッピーエンド。",
  },
  {
    kind: "aka",
    no: 3,
    name: "アカミソ",
    note: "柱の側に八割。消灯のときだけ明るさ200で光る。灯の下ではほとんど透ける。1秒以上触れると強制脱出。",
  },
  {
    kind: "pipe",
    no: 4,
    name: "鉄パイプの妖精さん",
    note: "水の側に立つ。鉢の黒髪と継手。暇ならラジオ体操。罰は、まだない。",
  },
  {
    kind: "yuki",
    no: 5,
    name: "ゆきおんな",
    note: "開いた空の下に立つ。白髪と淡い着物。顔はイラスト。暇ならラジオ体操。罰は、まだない。",
  },
  {
    kind: "meri",
    no: 6,
    name: "めりさん",
    note: "祠の側に漂う。青いフードのおばけ。顔はイラスト。罰は、まだない。",
  },
];

export function createGhost(kind: GhostKind) {
  if (kind === "mimic") return createMimic();
  if (kind === "aka") return createAkamiso();
  if (kind === "pipe") return createPipeYousei();
  if (kind === "yuki") return createYukiOnna();
  if (kind === "meri") return createMeriSan();
  return createKasaObake();
}

export const BAG_FACES = [
  "・ω・",
  "^_^",
  ">_<",
  "●ω●",
  "￣▽￣",
  "T_T",
  "・∀・",
  "￣ω￣",
  "×_×",
  "◕‿◕",
  "・ᴗ・",
  "¬‿¬",
] as const;

const faceMaps = new Map<string, THREE.CanvasTexture>();

function mat(color: number, extra: Record<string, unknown> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    ...extra,
  });
}

function faceTexture(text: string) {
  const hit = faceMaps.get(text);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#c6a27c";
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "#1a1511";
  ctx.font =
    "700 54px 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 86);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  faceMaps.set(text, tex);
  return tex;
}

export function setBagFace(root: THREE.Object3D, index: number) {
  const mesh = root.getObjectByName("bag-face") as THREE.Mesh | undefined;
  if (!mesh) return;
  const n = BAG_FACES.length;
  const text = BAG_FACES[((index % n) + n) % n]!;
  mesh.material = new THREE.MeshBasicMaterial({
    map: faceTexture(text),
    toneMapped: false,
  });
}

function paperBag(paper: THREE.Material, crease: THREE.Material, face = 0) {
  const bag = new THREE.Group();
  bag.name = "paper-bag";
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.4, 0.52), paper);
  body.position.y = 0.24;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.54), paper);
  lid.position.y = 0.445;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.56), paper);
  rim.position.y = 0.04;
  const gusL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.38, 0.5), crease);
  gusL.position.set(-0.33, 0.24, 0);
  const gusR = gusL.clone();
  gusR.position.x = 0.33;
  bag.add(body, lid, rim, gusL, gusR);
  const faceM = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.3), new THREE.MeshBasicMaterial());
  faceM.name = "bag-face";
  faceM.position.set(0, 0.25, 0.262);
  bag.add(faceM);
  setBagFace(bag, face);
  bag.rotation.z = -0.16;
  bag.rotation.x = -0.05;
  return bag;
}

export function createMimic() {
  const g = new THREE.Group();
  g.name = "mimic";
  g.userData.kind = "mimic";
  const paper = mat(0xc6a27c, { roughness: 0.86 });
  const crease = mat(0x8a6a48, { roughness: 0.9 });
  const coat = mat(0x5a4638, { roughness: 0.8 });
  const skin = mat(0xf3e6d8, { roughness: 0.5 });
  const bag = paperBag(paper, crease, 0);
  bag.position.y = 1.05;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.28), coat);
  body.position.y = 0.62;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), coat);
  armL.position.set(-0.28, 0.58, 0);
  const armR = armL.clone();
  armR.position.x = 0.28;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skin);
  handL.position.set(-0.28, 0.42, 0.04);
  const handR = handL.clone();
  handR.position.x = 0.28;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.14), coat);
  legL.position.set(-0.1, 0.2, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;
  g.add(bag, body, armL, armR, handL, handR, legL, legR);
  return g;
}

let mimicLiteProto: THREE.Group | null = null;
export function createMimicLite(face = 0) {
  if (!mimicLiteProto) {
    mimicLiteProto = createMimic();
    mimicLiteProto.name = "mimic-lite";
  }
  const c = mimicLiteProto.clone(true);
  c.userData.kind = "mimic";
  setBagFace(c, face);
  return c;
}

export function createKasaObake() {
  const g = new THREE.Group();
  g.name = "kasa-obake";
  g.userData.kind = "kasa";
  const paper = new THREE.MeshStandardMaterial({
    color: 0xd4c4ae,
    roughness: 0.88,
    metalness: 0.02,
    emissive: 0x2a3e52,
    emissiveIntensity: 0.12,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b5344, roughness: 0.78 });
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

let kasaLiteProto: THREE.Group | null = null;
export function createKasaLite() {
  if (!kasaLiteProto) {
    kasaLiteProto = createKasaObake();
    kasaLiteProto.name = "kasa-lite";
  }
  const c = kasaLiteProto.clone(true);
  c.userData.kind = "kasa";
  return c;
}

function akaMat(color: number, extra: Record<string, unknown> = {}) {
  return mat(color, {
    emissive: color,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 1,
    ...extra,
  });
}

export function createAkamiso() {
  const g = new THREE.Group();
  g.name = "akamiso";
  g.userData.kind = "aka";
  const hairC = akaMat(0x7a2438, { roughness: 0.78 });
  const faceC = akaMat(0xf7f2ee, { roughness: 0.45, emissive: 0xffd0d8, emissiveIntensity: 0.25 });
  const robeC = akaMat(0x1b211e, { roughness: 0.86, emissive: 0x3a1822, emissiveIntensity: 0.35 });
  const stoleC = akaMat(0x6e1f35, { roughness: 0.72 });
  const robe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.26), robeC);
  robe.position.y = 0.72;
  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.28), robeC);
  hem.position.y = 0.32;
  const stoleL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.08), stoleC);
  stoleL.position.set(-0.14, 0.7, 0.08);
  const stoleR = stoleL.clone();
  stoleR.position.x = 0.14;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), faceC);
  head.position.y = 1.14;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), hairC);
  hair.position.set(-0.02, 1.28, -0.02);
  hair.scale.set(1.15, 0.72, 1.05);
  g.add(robe, hem, stoleL, stoleR, head, hair);
  const lamp = new THREE.PointLight(0xff6688, 200, 8, 2);
  lamp.name = "akaLamp";
  lamp.position.y = 1.15;
  lamp.visible = false;
  g.add(lamp);
  return g;
}

let akaLiteProto: THREE.Group | null = null;
export function createAkamisoLite() {
  if (!akaLiteProto) {
    akaLiteProto = createAkamiso();
    akaLiteProto.name = "akamiso-lite";
  }
  const c = akaLiteProto.clone(true);
  c.userData.kind = "aka";
  const lamp = new THREE.PointLight(0xff6688, 200, 8, 2);
  lamp.name = "akaLamp";
  lamp.position.y = 1.15;
  lamp.visible = false;
  c.add(lamp);
  return c;
}

export function createPipeYousei() {
  const g = new THREE.Group();
  g.name = "pipe-yousei";
  g.userData.kind = "pipe";
  const hairC = mat(0x111214, { roughness: 0.9 });
  const faceC = mat(0xf6f3ef, { roughness: 0.48 });
  const coat = mat(0x2c333c, { roughness: 0.82 });
  const coatDark = mat(0x1a1e24, { roughness: 0.84 });
  const steel = mat(0x8b939c, { metalness: 0.72, roughness: 0.38 });
  const eyeW = mat(0xfbf8f4, { roughness: 0.35 });
  const eyeB = mat(0x0d0e10, { roughness: 0.4 });
  const hips = new THREE.Group();
  hips.name = "pipe-hips";
  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.26), coatDark);
  hem.position.y = 0.36;
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.16), hairC);
  shoeL.position.set(-0.1, 0.05, 0.02);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.1;
  hips.add(hem, shoeL, shoeR);
  const torso = new THREE.Group();
  torso.name = "pipe-torso";
  torso.position.y = 0.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.24), coat);
  body.position.y = 0.18;
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.16), coatDark);
  collar.position.set(0, 0.4, 0.06);
  torso.add(body, collar);
  const armL = new THREE.Group();
  armL.name = "pipe-arm-l";
  armL.position.set(-0.24, 0.16, 0.06);
  const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), coat);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), faceC);
  handL.position.set(-0.02, -0.1, 0.06);
  armL.add(sleeveL, handL);
  const armR = new THREE.Group();
  armR.name = "pipe-arm-r";
  armR.position.set(0.22, 0.16, 0.06);
  const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), coat);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), faceC);
  handR.position.set(0, -0.12, 0.08);
  armR.add(sleeveR, handR);
  const pipe = new THREE.Group();
  pipe.name = "pipe-bar";
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), steel);
  shaft.rotation.z = Math.PI / 2;
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), steel);
  elbow.position.set(-0.42, 0.04, 0);
  elbow.rotation.z = 0.9;
  pipe.add(shaft, elbow);
  pipe.position.set(0, 0.08, 0.16);
  const head = new THREE.Group();
  head.name = "pipe-head";
  head.position.y = 0.62;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), faceC);
  face.scale.set(1.08, 0.88, 0.95);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairC,
  );
  bowl.position.set(0, 0.08, -0.02);
  const bang = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.18), hairC);
  bang.position.set(0, 0.1, 0.16);
  head.add(face, bowl, bang);
  const mkEye = (x: number) => {
    const e = new THREE.Group();
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), eyeW);
    w.scale.set(1.05, 0.85, 0.5);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeB);
    b.position.z = 0.018;
    e.add(w, b);
    e.position.set(x, -0.02, 0.17);
    return e;
  };
  head.add(mkEye(-0.075), mkEye(0.075));
  torso.add(armL, armR, pipe, head);
  hips.add(torso);
  g.add(hips);
  return g;
}

export function posePipeTaiso(g: THREE.Object3D, t: number) {
  const hips = g.getObjectByName("pipe-hips");
  const torso = g.getObjectByName("pipe-torso");
  const head = g.getObjectByName("pipe-head");
  const armL = g.getObjectByName("pipe-arm-l");
  const armR = g.getObjectByName("pipe-arm-r");
  const pipe = g.getObjectByName("pipe-bar");
  if (!hips || !torso || !armL || !armR) return;
  const u = ((t % 10) + 10) % 10;
  hips.rotation.set(0, 0, 0);
  hips.position.y = 0;
  torso.rotation.set(0, 0, 0);
  if (head) head.rotation.set(0, 0, 0);
  armL.rotation.set(0, 0, 0);
  armR.rotation.set(0, 0, 0);
  if (pipe) {
    pipe.position.set(0, 0.08, 0.16);
    pipe.rotation.set(-0.08, 0, 0);
  }
  if (u < 2) {
    const k = Math.sin((u / 2) * Math.PI);
    armL.rotation.x = -k * 1.55;
    armR.rotation.x = -k * 1.55;
    if (pipe) {
      pipe.position.y = 0.08 + k * 0.52;
      pipe.rotation.x = -0.08 - k * 0.35;
    }
    hips.position.y = k * 0.03;
  } else if (u < 4) {
    const k = Math.sin(((u - 2) / 2) * Math.PI * 2);
    torso.rotation.z = k * 0.42;
    armL.rotation.z = k * 0.35;
    armR.rotation.z = k * 0.35;
  } else if (u < 6) {
    const a = ((u - 4) / 2) * Math.PI * 2;
    armL.rotation.x = -0.4 + Math.sin(a) * 0.9;
    armR.rotation.x = -0.4 + Math.sin(a) * 0.9;
    armL.rotation.z = Math.cos(a) * 0.55;
    armR.rotation.z = -Math.cos(a) * 0.55;
  } else if (u < 8) {
    const k = Math.sin(((u - 6) / 2) * Math.PI);
    torso.rotation.x = k * 0.7;
    armL.rotation.x = k * 0.35;
    armR.rotation.x = k * 0.35;
  } else {
    const k = Math.abs(Math.sin(((u - 8) / 2) * Math.PI * 3));
    hips.position.y = k * 0.14;
    armL.rotation.x = -k * 0.5;
    armR.rotation.x = -k * 0.5;
  }
}

function chibiBody(coat: THREE.Material, coatDark: THREE.Material, faceC: THREE.Material, shoeC: THREE.Material) {
  const g = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = "pipe-hips";
  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.28), coatDark);
  hem.position.y = 0.36;
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.16), shoeC);
  shoeL.position.set(-0.1, 0.05, 0.02);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.1;
  hips.add(hem, shoeL, shoeR);
  const torso = new THREE.Group();
  torso.name = "pipe-torso";
  torso.position.y = 0.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.26), coat);
  body.position.y = 0.18;
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.16), coatDark);
  collar.position.set(0, 0.4, 0.07);
  torso.add(body, collar);
  const armL = new THREE.Group();
  armL.name = "pipe-arm-l";
  armL.position.set(-0.24, 0.16, 0.06);
  armL.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), coat));
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), faceC);
  handL.position.set(-0.02, -0.1, 0.06);
  armL.add(handL);
  const armR = new THREE.Group();
  armR.name = "pipe-arm-r";
  armR.position.set(0.22, 0.16, 0.06);
  armR.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), coat));
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), faceC);
  handR.position.set(0, -0.12, 0.08);
  armR.add(handR);
  const head = new THREE.Group();
  head.name = "pipe-head";
  head.position.y = 0.62;
  torso.add(armL, armR, head);
  hips.add(torso);
  g.add(hips);
  return { g, head };
}

const faceTex = new Map<string, THREE.Texture>();
function loadFace(url: string) {
  const hit = faceTex.get(url);
  if (hit) return hit;
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceTex.set(url, tex);
  return tex;
}

function faceCard(url: string, w: number, h: number, name: string) {
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: loadFace(url),
      transparent: true,
      alphaTest: 0.12,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  card.name = name;
  return card;
}

export function createYukiOnna() {
  // 白髪は紙と同色なのでキー抜きできない。顔まわりを楕円で切り、残りは立体の髪。
  const faceC = mat(0xf6e7de, { roughness: 0.48 });
  const coat = mat(0xd5e2d4, { roughness: 0.62, emissive: 0x8aa890, emissiveIntensity: 0.06 });
  const coatDark = mat(0xb7c8b6, { roughness: 0.64 });
  const shoeC = mat(0xf4f0ea, { roughness: 0.7 });
  const hairC = mat(0xf2eee8, { roughness: 0.78 });
  const { g, head } = chibiBody(coat, coatDark, faceC, shoeC);
  g.name = "yuki-onna";
  g.userData.kind = "yuki";
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), hairC);
  hair.position.set(-0.02, 0.08, -0.04);
  hair.scale.set(1.15, 1.05, 1.05);
  const card = faceCard("/ghosts/yuki-face.png?v=2", 0.58, 0.69, "yuki-face");
  card.position.set(0, 0.1, 0.2);
  head.add(hair, card);
  return g;
}

export function poseMeri(g: THREE.Object3D, t: number) {
  const hips = g.getObjectByName("pipe-hips");
  const armL = g.getObjectByName("pipe-arm-l");
  const armR = g.getObjectByName("pipe-arm-r");
  if (!hips) return;
  const s = Math.sin(t * 1.1);
  hips.position.y = 0.05 + s * 0.035;
  if (armL) armL.rotation.z = 0.06 + s * 0.05;
  if (armR) armR.rotation.z = -0.06 - s * 0.05;
}

function meriCloakGeo() {
  const pts = [
    new THREE.Vector2(0.1, 0.02),
    new THREE.Vector2(0.28, 0.08),
    new THREE.Vector2(0.38, 0.22),
    new THREE.Vector2(0.4, 0.44),
    new THREE.Vector2(0.32, 0.66),
    new THREE.Vector2(0.22, 0.84),
    new THREE.Vector2(0.16, 0.96),
  ];
  return new THREE.LatheGeometry(pts, 48);
}

function meriHoodShell(open: number) {
  // 後ろから頭を包む。切断面は唇のトーラスで隠す。
  return new THREE.SphereGeometry(
    0.38,
    48,
    36,
    Math.PI / 2 + open / 2,
    Math.PI * 2 - open,
    0,
    Math.PI * 0.82,
  );
}

export function createMeriSan() {
  // 布の頭巾。切った球の兜にはしない。口のほとんどを顔が占める。
  const skin = mat(0xecd4bc, { roughness: 0.48 });
  const cloth = mat(0x6a7d9e, {
    roughness: 0.56,
    emissive: 0x1c2838,
    emissiveIntensity: 0.1,
  });
  const lining = mat(0xc5cad4, { roughness: 0.45 });
  const g = new THREE.Group();
  g.name = "meri-san";
  g.userData.kind = "meri";

  const hips = new THREE.Group();
  hips.name = "pipe-hips";
  hips.add(new THREE.Mesh(meriCloakGeo(), cloth));

  const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), cloth);
  yoke.position.set(0, 0.94, -0.02);
  yoke.scale.set(1.35, 0.42, 1.05);
  hips.add(yoke);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), skin);
  neck.position.y = 0.98;
  hips.add(neck);

  const head = new THREE.Group();
  head.name = "pipe-head";
  head.position.set(0, 1.14, 0);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 14), skin);
  skull.position.set(0, 0.02, -0.04);

  const open = 1.22;
  const hood = new THREE.Mesh(meriHoodShell(open), cloth);
  hood.position.set(0, 0.1, -0.1);
  hood.scale.set(1.22, 1.28, 1.16);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 12, 36), cloth);
  lip.position.set(0, 0.06, 0.16);
  lip.scale.set(1.05, 1.18, 1);
  const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 36), lining);
  stitch.position.set(0, 0.06, 0.175);
  stitch.scale.set(1.05, 1.18, 1);

  const drape = (side: number) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), cloth);
    m.position.set(side * 0.2, -0.02, 0.06);
    m.scale.set(0.55, 1.05, 0.5);
    return m;
  };

  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.5),
    new THREE.MeshBasicMaterial({
      map: loadFace("/ghosts/meri-face.png?v=11"),
      transparent: true,
      alphaTest: 0.08,
      toneMapped: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    }),
  );
  card.name = "meri-face";
  card.position.set(0, 0.05, 0.19);

  const lamp = new THREE.PointLight(0xc8d6e8, 0.28, 2.4, 2);
  lamp.name = "ghostLamp";
  lamp.position.set(0, 0.06, 0.08);
  lamp.visible = false;
  head.add(skull, hood, lip, stitch, drape(-1), drape(1), card, lamp);

  const torso = new THREE.Group();
  torso.name = "pipe-torso";
  const mkHand = (side: number) => {
    const arm = new THREE.Group();
    arm.name = side < 0 ? "pipe-arm-l" : "pipe-arm-r";
    arm.position.set(side * 0.36, 0.46, 0.1);
    arm.add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skin));
    return arm;
  };
  torso.add(mkHand(-1), mkHand(1));

  hips.add(head, torso);
  g.add(hips);
  return g;
}


