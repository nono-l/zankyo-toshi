/*
  Three の歩行エンジン。HUD・記録・ID は echoes-app。
  物理エンジンは使わない（デプロイの npm が WASM で落ちた）。衝突は格子 + 柱円 + 坂の面。
  霧の距離は「消灯 6m / 点灯 20m」。1m/6m は何も見えなくなったので捨てた。
  閃光は測量の残置。60 秒に 1 秒だけ遠方を返す。照明のチートではない。
*/
// @ts-nocheck
import * as THREE from "three";
import { generateRuin, isWalk, worldToCell, SIZE, CELL, type Relic, type RuinWorld } from "./gen";
import {
  createKasaLite,
  createMimicLite,
  createAkamisoLite,
  createPipeYousei,
  posePipeTaiso,
  poseMeri,
  createYukiOnna,
  createMeriSan,
} from "./ghosts";
import { createSoul, tickSoul, type SoulFx } from "./hitodama";
import { Input } from "./input";
import { RuinAudio } from "./audio";

export type DebugState = {
  speed: number;
  seeAll: boolean;
  flashInstant: boolean;
  noclip: boolean;
  showPos: boolean;
  freeExit: boolean;
};

export type HudState = {
  seed: string;
  civName: string;
  civRule: string;
  landmarkName: string;
  found: number;
  total: number;
  foundIds: number[];
  nearRelic: Relic | null;
  toast: string | null;
  atLandmark: boolean;
  atPortal: boolean;
  complete: boolean;
  lantern: boolean;
  flashCd: number;
  flashing: boolean;
  paused: boolean;
  debug: DebugState;
  posX: number;
  posZ: number;
  roomBright: number;
  lanternBright: number;
  fogOffM: number;
  fogOnM: number;
};




type Listener = (s: HudState) => void;

const EYE = 1.64;
const WALK = 3.15;
const SPRINT = 4.85;
const GHOST_SPEED = 3.7;
const GHOST_HIT = 1.12;
const MIMIC_LEASH = 6;
const LOOK = 0.00235;
const PORTAL_R = 1.9;
const FLASH_DUR = 1;
const FLASH_CD = 60;
const FLASH_FAR = 80;
const FOG_OFF = 6.2;
const FOG_ON = 20.5;
const ROOM_DEFAULT = 0.28;
const LANTERN_DEFAULT = 0.48;





function matForStyle(style: RuinWorld["style"], kind: "floor" | "wall" | "ceil") {
  const stone = { floor: 0x6e675c, wall: 0x5a544b, ceil: 0x4a453e };
  const conc = { floor: 0x5c5f5d, wall: 0x4a4d4c, ceil: 0x3d403f };
  const pal = style === "concrete" ? conc : stone;
  if (style === "mixed" && kind === "wall") return conc.wall;
  return pal[kind];
}


export class EchoesEngine {
  world: RuinWorld;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private yawObj = new THREE.Object3D();
  private pitchObj = new THREE.Object3D();
  private lantern: THREE.PointLight;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private input = new Input();
  private audio = new RuinAudio();
  private raf = 0;
  private last = 0;
  private running = false;
  private disposed = false;
  private yaw = 0;
  private pitch = 0;
  private vx = 0;
  private vz = 0;
  private speed = 0;
  private lanternOn = true;
  private flashT = 0;
  private flashCd = 0;
  private roomBright = ROOM_DEFAULT;
  private lanternBright = LANTERN_DEFAULT;
  private fogOffM = FOG_OFF;
  private fogOnM = FOG_ON;



  debug: DebugState = {
    speed: 1,
    seeAll: false,
    flashInstant: false,
    noclip: false,
    showPos: false,
    freeExit: false,
  };


  private paused = false;
  private found = new Set<number>();
  private toast: string | null = null;
  private toastT = 0;
  private listeners = new Set<Listener>();
  private lastHudSig = "";
  private mode: "orbit" | "play" = "orbit";
  private orbitT = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3();
  private relicMeshes: THREE.Mesh[] = [];
  private solids: { x: number; z: number; r: number }[] = [];
  private ramps: {
    mat: THREE.Matrix4;
    inv: THREE.Matrix4;
    halfL: number;
    halfW: number;
    halfT: number;
  }[] = [];
  private localP = new THREE.Vector3();
  private localD = new THREE.Vector3();
  private portalSpin: THREE.Object3D | null = null;
  private ghost: THREE.Object3D | null = null;
  private ghostLight: THREE.PointLight | null = null;
  private railMesh: THREE.Object3D | null = null;
  private railCurve: THREE.Curve<THREE.Vector3> | null = null;
  private railLen = 1;
  private ghostU = 0.38;
  private ghostHit = false;
  private souls: SoulFx[] = [];
  portalX = 0;
  portalZ = 0;


  private canvas: HTMLCanvasElement;
  private resizeObs: ResizeObserver;
  private hud: HudState;
  onRelicFound: ((info: {
    relic: Relic;
    seed: string;
    civName: string;
    landmarkName: string;
    atLandmark: boolean;
    x: number;
    z: number;
  }) => void) | null = null;
  onGhostHit: ((kind: "kasa" | "mimic" | "aka") => void) | null = null;
  private kasas: THREE.Object3D[] = [];
  private mimics: THREE.Object3D[] = [];
  private pipes: THREE.Object3D[] = [];
  private yukis: THREE.Object3D[] = [];
  private meris: THREE.Object3D[] = [];
  private colPos: { x: number; z: number }[] = [];
  private akas: {
    group: THREE.Object3D;
    light: THREE.PointLight | null;
    mats: THREE.MeshStandardMaterial[];
    phase: number;
  }[] = [];
  private akaTouch = 0;



  constructor(canvas: HTMLCanvasElement, seed: string) {
    this.canvas = canvas;
    this.world = generateRuin(seed);
    this.hud = this.makeHud();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 1.6,
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x141210, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1c1916, 14, 48);
    this.scene.background = new THREE.Color(0x1c1916);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 90);
    this.pitchObj.add(this.camera);
    this.yawObj.add(this.pitchObj);
    this.scene.add(this.yawObj);

    this.hemi = new THREE.HemisphereLight(0xc9d2d4, 0x3a3228, 0.72);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xf0e6d4, 0.95);
    this.sun.position.set(22, 48, 14);
    this.scene.add(this.sun);

    this.lantern = new THREE.PointLight(0xffe6c2, 0.2, 8, 2);
    this.camera.add(this.lantern);
    this.lantern.position.set(0.15, -0.08, -0.25);
    this.applyAtmosphere();


    this.buildWorld();
    this.placePlayer(true);
    this.input.attach();
    this.bindLook();
    this.fit();
    this.resizeObs = new ResizeObserver(() => this.fit());
    this.resizeObs.observe(canvas.parentElement || canvas);

    this.wireProbe();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private makeHud(): HudState {
    const px = this.yawObj.position.x;
    const pz = this.yawObj.position.z;
    return {
      seed: this.world.seed,
      civName: this.world.civName,
      civRule: this.world.civRule,
      landmarkName: this.world.landmarkName,
      found: this.found.size,
      total: this.world.relics.length,
      foundIds: [...this.found],
      nearRelic: null,
      toast: this.toast,
      atLandmark: false,
      atPortal: Math.hypot(px - this.portalX, pz - this.portalZ) < PORTAL_R || this.debug.freeExit,
      complete: this.found.size >= this.world.relics.length,
      lantern: this.lanternOn,
      flashCd: Math.ceil(this.flashCd),
      flashing: this.flashT > 0,
      paused: this.paused,
      debug: { ...this.debug },
      posX: px,
      posZ: pz,
      roomBright: this.roomBright,
      lanternBright: this.lanternBright,
      fogOffM: this.fogOffM,
      fogOnM: this.fogOnM,
    };
  }



  private emit() {
    this.hud = this.makeHud();
    for (const l of this.listeners) l(this.hud);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.hud);
    return () => this.listeners.delete(fn);
  }

  startPlay() {
    this.audio.unlock();
    this.mode = "play";
    this.paused = false;
    this.found.clear();
    this.placePlayer(false);
    this.flashT = 0;
    this.flashCd = 0;
    this.ghostHit = false;
    this.ghostU = 0.38;
    this.applyAtmosphere();
    this.toast = "入口の光に触れれば、通常に戻れる";
    this.toastT = 4.5;
    this.emit();
  }

  endRun() {
    this.found.clear();
    this.paused = false;
    this.mode = "orbit";
    this.toast = null;
    this.placePlayer(true);
    this.applyAtmosphere();
    this.emit();
  }

  setPaused(v: boolean) {

    this.paused = v;
    this.emit();
  }

  setDebug(patch: Partial<DebugState>) {
    // セッション限り。記録や権限表には書かない。
    if (patch.speed != null) {
      this.debug.speed = Math.max(1, Math.min(5, Math.round(patch.speed)));
    }
    if (patch.seeAll != null) this.debug.seeAll = patch.seeAll;
    if (patch.flashInstant != null) this.debug.flashInstant = patch.flashInstant;
    if (patch.noclip != null) this.debug.noclip = patch.noclip;
    if (patch.showPos != null) this.debug.showPos = patch.showPos;
    if (patch.freeExit != null) this.debug.freeExit = patch.freeExit;
    if (this.debug.flashInstant) this.flashCd = 0;
    this.applyAtmosphere();
    this.emit();
  }

  teleportTo(kind: "portal" | "landmark") {
    const x = kind === "portal" ? this.portalX : this.world.landmark.cx;
    const z = kind === "portal" ? this.portalZ : this.world.landmark.cz;
    this.yawObj.position.set(x, this.surfaceY(x, z) + EYE, z);
    this.vx = 0;
    this.vz = 0;
    this.emit();
  }

  markAllRelicsRead() {
    // onRelicFound は呼ばない。本番の拾得ログを汚さない。
    for (const r of this.world.relics) this.found.add(r.id);
    this.toast = "デバッグ：断片を既読にした";
    this.toastT = 2.4;
    this.emit();
  }

  setLook(
    patch: { room?: number; lantern?: number; fogOff?: number; fogOn?: number },
    preview?: "room" | "lantern" | "fogOff" | "fogOn",
  ) {
    if (patch.room != null) this.roomBright = Math.min(5, Math.max(0, patch.room));
    if (patch.lantern != null) this.lanternBright = Math.min(5, Math.max(0, patch.lantern));
    if (patch.fogOff != null) this.fogOffM = Math.min(25, Math.max(1, patch.fogOff));
    if (patch.fogOn != null) this.fogOnM = Math.min(80, Math.max(4, patch.fogOn));
    if (preview === "room" || preview === "fogOff") this.lanternOn = false;
    if (preview === "lantern" || preview === "fogOn") this.lanternOn = true;
    if (this.debug.seeAll) this.debug.seeAll = false;
    this.applyAtmosphere();
    this.renderer.render(this.scene, this.camera);
    this.emit();
  }



  toggleLantern() {
    this.lanternOn = !this.lanternOn;
    if (this.flashT <= 0) this.applyAtmosphere();
    this.emit();
  }

  triggerFlash() {
    if (this.mode !== "play" || this.flashCd > 0 || this.flashT > 0) return;
    // 冷却は撃った瞬間から 60 秒。持続 1 秒を足して 61 にはしない。
    this.flashT = FLASH_DUR;
    this.flashCd = this.debug.flashInstant ? 0 : FLASH_CD;
    this.audio.flash();
    this.toast = "測量の閃光";
    this.toastT = 1.15;
    this.applyAtmosphere();
    this.emit();
  }

  private applyAtmosphere() {
    const play = this.mode === "play";
    if (!play) {
      this.scene.fog = new THREE.Fog(0x1c1916, 14, 48);
      this.scene.background = new THREE.Color(0x1c1916);
      this.renderer.setClearColor(0x141210, 1);
      this.renderer.toneMappingExposure = 1.02;
      this.hemi.intensity = 0.72;
      this.sun.intensity = 0.95;
      this.lantern.intensity = 0.2;
      this.lantern.distance = 8;
      this.lantern.decay = 2;
      this.camera.near = 0.08;
      this.camera.far = 90;
      this.camera.updateProjectionMatrix();
      return;
    }
    this.scene.background = new THREE.Color(0x0b0908);
    this.renderer.setClearColor(0x0b0908, 1);
    if (this.debug.seeAll) {
      this.renderer.toneMappingExposure = 1.05;
      this.hemi.intensity = 0.88;
      this.sun.intensity = 0.75;
      this.scene.fog = new THREE.Fog(0x1c1916, 80, 280);
      this.scene.background = new THREE.Color(0x1c1916);
      this.lantern.intensity = 0.4;
      this.lantern.distance = 12;
      this.camera.near = 0.08;
      this.camera.far = 320;
      this.camera.updateProjectionMatrix();
      return;
    }
    if (this.flashT > 0) {
      this.renderer.toneMappingExposure = 1.12;
      this.hemi.intensity = 0.62;
      this.sun.intensity = 0.4;
      this.scene.fog = new THREE.Fog(0xc9c2b4, 18, FLASH_FAR);
      this.scene.background = new THREE.Color(0x2a2723);
      this.lantern.color.setHex(0xfff4e0);
      this.lantern.intensity = 8.5;
      this.lantern.distance = FLASH_FAR;
      this.lantern.decay = 1.15;
      this.camera.near = 0.08;
      this.camera.far = FLASH_FAR + 12;
      this.camera.updateProjectionMatrix();
      return;
    }
    this.renderer.toneMappingExposure = 0.72 + this.roomBright * 0.35;
    this.camera.near = 0.08;
    this.camera.far = Math.max(28, this.fogOnM + 10);
    this.camera.updateProjectionMatrix();
    const room = this.roomBright;
    const flame = this.lanternBright;
    const offM = this.fogOffM;
    const onM = this.fogOnM;
    if (this.lanternOn) {
      this.hemi.intensity = 0.04 + room * 0.55;
      this.sun.intensity = room * 0.22;
      this.scene.fog = new THREE.Fog(0x0b0908, onM * 0.39, onM);
      this.lantern.color.setHex(0xffe2b8);
      this.lantern.intensity = 0.4 + flame * 9.2;
      this.lantern.distance = onM;
      this.lantern.decay = 1.45;
    } else {
      this.hemi.intensity = 0.03 + room * 0.95;
      this.sun.intensity = room * 0.65;
      this.scene.fog = new THREE.Fog(0x0b0908, offM * 0.35, offM);
      this.lantern.color.setHex(0xffd4a0);
      this.lantern.intensity = 0.12 + flame * 0.2;
      this.lantern.distance = Math.min(3, offM * 0.4);
      this.lantern.decay = 2;
    }
  }



  regenerate(seed: string) {
    for (const ch of [...this.scene.children]) {
      if (ch === this.yawObj) continue;
      this.scene.remove(ch);
      this.disposeObject(ch);
    }
    this.relicMeshes = [];
    this.ghost = null;
    this.ghostLight = null;
    this.railMesh = null;
    this.railCurve = null;
    this.ghostHit = false;
    this.souls = [];
    this.kasas = [];
    this.mimics = [];
    this.pipes = [];
    this.yukis = [];
    this.meris = [];
    this.akas = [];
    this.colPos = [];
    this.akaTouch = 0;
    this.found.clear();
    this.world = generateRuin(seed);
    this.hemi = new THREE.HemisphereLight(0xc9d2d4, 0x3a3228, 0.72);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xf0e6d4, 0.95);
    this.sun.position.set(22, 48, 14);
    this.scene.add(this.sun);
    this.buildWorld();
    this.placePlayer(this.mode === "orbit");
    this.applyAtmosphere();
    this.toast = null;
    this.emit();
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }

  private buildWorld() {
    this.solids = [];
    this.ramps = [];
    this.portalSpin = null;
    this.souls = [];
    this.colPos = [];
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.45;
    this.scene.add(ground);
    const { world } = this;
    const floorGeo = new THREE.BoxGeometry(CELL, 0.28, CELL);
    const wallGeo = new THREE.BoxGeometry(CELL * 1.02, 1, CELL * 1.02);
    const ceilGeo = new THREE.BoxGeometry(CELL, 0.18, CELL);
    const colGeo = new THREE.CylinderGeometry(0.28, 0.34, 4.6, 8);

    const floorMat = new THREE.MeshStandardMaterial({
      color: matForStyle(world.style, "floor"),
      roughness: 0.92,
      metalness: 0.04,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: matForStyle(world.style, "wall"),
      roughness: 0.9,
      metalness: 0.06,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: matForStyle(world.style, "ceil"),
      roughness: 0.95,
    });
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x4a5a44,
      roughness: 1,
    });
    const colMat = new THREE.MeshStandardMaterial({
      color: world.style === "stone" ? 0x7a7368 : 0x6a6d6b,
      roughness: 0.88,
    });

    const floors: THREE.Matrix4[] = [];
    const moss: THREE.Matrix4[] = [];
    const walls: { m: THREE.Matrix4; h: number }[] = [];
    const ceils: THREE.Matrix4[] = [];
    const cols: THREE.Matrix4[] = [];

    const setPos = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      this.tmp.set(x, y, z);
      this.tmpQ.identity();
      this.tmpS.set(sx, sy, sz);
      return new THREE.Matrix4().compose(this.tmp, this.tmpQ, this.tmpS);
    };

    for (let j = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++) {
        const walk = isWalk(world, i, j);
        const o = (SIZE / 2) * CELL;
        const x = i * CELL - o + CELL * 0.5;
        const z = j * CELL - o + CELL * 0.5;
        const n = Math.sin(i * 1.7 + j * 0.9);

        if (walk) {
          floors.push(setPos(x, -0.14, z));
          if (n > 0.55) moss.push(setPos(x, 0.02, z, 0.7, 0.08, 0.7));
          const sky = world.openSky[j * SIZE + i];
          if (!sky) ceils.push(setPos(x, 4.55 + (n > 0 ? 0.4 : 0), z));
        } else {
          let vis = false;
          for (const [di, dj] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            if (isWalk(world, i + di, j + dj)) vis = true;
          }
          if (!vis && i > 2 && j > 2 && i < SIZE - 3 && j < SIZE - 3) continue;
          const h = 3.6 + (Math.abs(n) * 2.8 + (i % 5) * 0.15);
          walls.push({ m: setPos(x, h / 2, z, 1, h, 1), h });
        }
      }
    }

    for (const r of world.rooms) {
      if (r.kind === "flooded" || r.w < 6) continue;
      for (let z = r.z + 2; z < r.z + r.h - 2; z += 3) {
        for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) {
          if (!isWalk(world, x, z)) continue;
          const o = (SIZE / 2) * CELL;
          const px = x * CELL - o + CELL * 0.5;
          const pz = z * CELL - o + CELL * 0.5;
          cols.push(setPos(px, 2.3, pz));
          this.colPos.push({ x: px, z: pz });
          // 柱は walk セル上の飾りなので格子だけではすり抜ける。
          this.solids.push({ x: px, z: pz, r: 0.5 });

        }
      }
    }

    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
      if (!mats.length) return;
      const mesh = new THREE.InstancedMesh(geo, mat, mats.length);
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      mats.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = true;
      this.scene.add(mesh);
    };

    inst(floorGeo, floorMat, floors);
    inst(floorGeo, mossMat, moss);
    inst(ceilGeo, ceilMat, ceils);
    inst(colGeo, colMat, cols);

    if (walls.length) {
      const mesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
      walls.forEach((w, i) => mesh.setMatrixAt(i, w.m));
      mesh.instanceMatrix.needsUpdate = true;
      this.scene.add(mesh);
    }

    if (world.rooms.some((r) => r.kind === "flooded")) {
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x3a5558,
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.42,
      });
      for (let j = 0; j < SIZE; j++) {
        for (let i = 0; i < SIZE; i++) {
          if (!world.flooded[j * SIZE + i]) continue;
          const o = (SIZE / 2) * CELL;
          const x = i * CELL - o + CELL * 0.5;
          const z = j * CELL - o + CELL * 0.5;
          const wmesh = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.2, CELL), waterMat);
          wmesh.position.set(x, 0.22, z);
          this.scene.add(wmesh);
        }
      }
    }

    this.addLandmark();
    this.addRelics();
    this.addDebris();
    this.addPortal();
    this.addGhost();
    this.addMimics();
    this.addAkamiso();
    this.addPipes();
    this.addYuki();
    this.addMeri();
    this.addHitodama();
  }


  private addLandmark() {
    const { landmark, landmarkKind } = this.world;
    const rust = new THREE.MeshStandardMaterial({
      color: 0x6a5c50,
      roughness: 0.72,
      metalness: 0.25,
    });
    if (landmarkKind === "bridge") {
      const L = landmark.w * 0.9;
      const T = 0.7;
      const W = 2.4;
      const g = new THREE.BoxGeometry(L, T, W);
      const m = new THREE.Mesh(g, rust);
      m.position.set(landmark.cx, 3.2, landmark.cz);
      m.rotation.z = 0.28;
      m.rotation.y = 0.4;
      this.scene.add(m);
      const mat = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.4, 0.28, "XYZ"));
      mat.compose(
        new THREE.Vector3(landmark.cx, 3.2, landmark.cz),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      // 傾いた箱を坂として歩く。AABB だと中を貫通する。
      this.ramps.push({
        mat,
        inv: mat.clone().invert(),
        halfL: L / 2,
        halfW: W / 2,
        halfT: T / 2,
      });
    } else if (landmarkKind === "tower") {
      const g = new THREE.CylinderGeometry(0.45, 0.8, 14, 8);
      const m = new THREE.Mesh(g, rust);
      m.position.set(landmark.cx, 6.4, landmark.cz);
      m.rotation.z = 0.18;
      this.scene.add(m);
      this.solids.push({ x: landmark.cx, z: landmark.cz, r: 0.95 });
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.12, 12), rust);
      dish.position.set(landmark.cx + 1.2, 12.4, landmark.cz);
      dish.rotation.x = 0.5;
      this.scene.add(dish);
    } else {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(Math.min(landmark.w, landmark.d) * 0.22, 0.28, 8, 24),
        rust,
      );
      ring.position.set(landmark.cx, 0.4, landmark.cz);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
    }



    const shaft = new THREE.SpotLight(0xf0e6c8, 1.15, 16, 0.5, 0.7, 1.4);
    shaft.position.set(landmark.cx, 18, landmark.cz);
    shaft.target.position.set(landmark.cx, 0, landmark.cz);
    this.scene.add(shaft);
    this.scene.add(shaft.target);
  }

  private addRelics() {
    const geo = new THREE.OctahedronGeometry(0.22, 0);
    for (const r of this.world.relics) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd9d4c8,
        emissive: 0xb7c4c0,
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.2,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(r.x, r.y, r.z);
      m.userData.relicId = r.id;
      this.scene.add(m);
      this.relicMeshes.push(m);
      const pl = new THREE.PointLight(0xdde6e2, 0.32, 2.1, 2);
      pl.position.copy(m.position);
      this.scene.add(pl);
    }
  }

  private addDebris() {
    const geo = new THREE.BoxGeometry(1, 0.4, 0.7);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, 140);
    let n = 0;
    for (let k = 0; k < 140; k++) {
      const i = 2 + ((k * 13) % (SIZE - 4));
      const j = 2 + ((k * 9) % (SIZE - 4));
      if (!isWalk(this.world, i, j)) continue;
      if (this.world.openSky[j * SIZE + i] === 0 && k % 3) continue;
      const o = (SIZE / 2) * CELL;
      const x = i * CELL - o + CELL * 0.5 + ((k % 5) - 2) * 0.3;
      const z = j * CELL - o + CELL * 0.5 + ((k % 7) - 3) * 0.2;
      this.tmp.set(x, 0.2, z);
      this.tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 0.7);
      this.tmpS.set(0.6 + (k % 3) * 0.2, 0.5, 0.5);
      this.tmpM.compose(this.tmp, this.tmpQ, this.tmpS);
      mesh.setMatrixAt(n++, this.tmpM);
    }
    mesh.count = n;
    this.scene.add(mesh);
  }

  private addPortal() {
    const x = this.world.spawnX;
    const z = this.world.spawnZ;
    this.portalX = x;
    this.portalZ = z;
    const yaw = Math.atan2(this.world.landmark.cz - z, this.world.landmark.cx - x);

    const group = new THREE.Group();
    group.position.set(x, 1.35, z);
    group.rotation.y = -yaw + Math.PI / 2;

    const metal = new THREE.MeshStandardMaterial({
      color: 0x9aa3a8,
      emissive: 0x6d7c82,
      emissiveIntensity: 0.85,
      roughness: 0.35,
      metalness: 0.55,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.07, 8, 28), metal);
    group.add(ring);

    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6);
    const left = new THREE.Mesh(postGeo, metal);
    left.position.set(-1.12, -0.05, 0);
    const right = new THREE.Mesh(postGeo, metal);
    right.position.set(1.12, -0.05, 0);
    group.add(left, right);

    const glow = new THREE.PointLight(0xd5e2e6, 1.05, 3.1, 2);
    glow.position.set(0, 0.2, 0);
    group.add(glow);

    this.scene.add(group);
    this.portalSpin = ring;
  }

  private addGhost() {
    const pts = this.world.rail;
    this.ghost = null;
    this.railMesh = null;
    this.ghostLight = null;
    this.railCurve = null;
    if (pts.length < 8) return;
    const vecs = pts.map((p) => new THREE.Vector3(p.x, 0.12, p.z));
    const curve = new THREE.CatmullRomCurve3(vecs, true, "catmullrom", 0.15);
    this.railCurve = curve;
    this.railLen = Math.max(8, curve.getLength());

    const tube = new THREE.TubeGeometry(curve, Math.min(180, pts.length * 4), 0.045, 5, true);
    const railMat = new THREE.MeshBasicMaterial({
      color: 0x5ec4ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rail = new THREE.Mesh(tube, railMat);
    rail.visible = false;
    this.scene.add(rail);
    this.railMesh = rail;

    const g = createKasaLite();
    const lamp = g.getObjectByName("ghostLamp");
    this.ghostLight = lamp instanceof THREE.PointLight ? lamp : null;
    if (this.ghostLight) this.ghostLight.visible = false;
    this.scene.add(g);
    this.ghost = g;
    this.kasas = [g];
    this.placeGhost();
  }

  private spawnExtraKasa(n: number) {
    if (!this.railCurve) return;
    for (let i = 0; i < n; i++) {
      const extra = createKasaLite();
      extra.userData.uOff = (this.kasas.length * 0.13) % 1;
      this.scene.add(extra);
      this.kasas.push(extra);
    }
  }

  private addMimics() {
    this.mimics = [];
    let i = 0;
    for (const p of this.world.mimics) {
      const g = createMimicLite(i);
      g.position.set(p.x, this.surfaceY(p.x, p.z), p.z);
      g.lookAt(p.x + p.faceX, g.position.y, p.z + p.faceZ);
      g.userData.homeX = p.x;
      g.userData.homeZ = p.z;
      this.scene.add(g);
      this.mimics.push(g);
      i += 1;
    }
  }

  private addAkamiso() {
    this.akas = [];
    const rng = Math.abs(this.world.seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
    let n = 0;
    for (const c of this.colPos) {
      if (((rng + n * 17) % 10) >= 8) {
        n += 1;
        continue;
      }
      const g = createAkamisoLite();
      const ox = ((n % 2) * 2 - 1) * 0.7;
      g.position.set(c.x + ox, this.surfaceY(c.x, c.z), c.z);
      const lamp = g.getObjectByName("akaLamp");
      const mats: THREE.MeshStandardMaterial[] = [];
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m instanceof THREE.MeshStandardMaterial) mats.push(m);
      });
      this.scene.add(g);
      this.akas.push({
        group: g,
        light: lamp instanceof THREE.PointLight ? lamp : null,
        mats,
        phase: n * 0.4,
      });
      n += 1;
    }
  }

  private addPipes() {
    this.pipes = [];
    for (const p of this.world.pipes) {
      const g = createPipeYousei();
      g.position.set(p.x, this.surfaceY(p.x, p.z), p.z);
      this.scene.add(g);
      this.pipes.push(g);
    }
  }

  private addYuki() {
    this.yukis = [];
    for (const p of this.world.yuki) {
      const g = createYukiOnna();
      g.position.set(p.x, this.surfaceY(p.x, p.z), p.z);
      this.scene.add(g);
      this.yukis.push(g);
    }
  }

  private addMeri() {
    this.meris = [];
    for (const p of this.world.meri) {
      const g = createMeriSan();
      g.position.set(p.x, this.surfaceY(p.x, p.z), p.z);
      this.scene.add(g);
      this.meris.push(g);
    }
  }

  private addHitodama() {
    this.souls = [];
    for (const s of this.world.hitodama) {
      const fx = createSoul(s.color, (s.x + s.z) * 0.13);
      fx.group.position.set(s.x, fx.baseY, s.z);
      this.scene.add(fx.group);
      this.souls.push(fx);
    }
  }

  private tickSouls(now: number) {
    const t = now * 0.001;
    const cam = this.mode === "play" ? this.yawObj.position : null;
    for (const fx of this.souls) tickSoul(fx, t, cam);
  }

  private placeGhost() {
    if (!this.ghost || !this.railCurve) return;
    const u = ((this.ghostU % 1) + 1) % 1;
    const p = this.railCurve.getPointAt(u);
    const t = this.railCurve.getTangentAt(u);
    const hop = Math.abs(Math.sin(this.ghostU * this.railLen * 2.4)) * 0.14;
    this.ghost.position.set(p.x, this.surfaceY(p.x, p.z) + hop, p.z);
    this.ghost.rotation.y = Math.atan2(t.x, t.z);
    this.ghost.rotation.z = Math.sin(this.ghostU * this.railLen * 2.4) * 0.12;
  }

  private tickGhost(dt: number) {
    if (!this.railCurve || this.kasas.length === 0) return;
    this.ghostU += (GHOST_SPEED * dt) / this.railLen;
    const p = this.yawObj.position;
    for (let i = 0; i < this.kasas.length; i++) {
      const g = this.kasas[i]!;
      const off = Number(g.userData.uOff) || 0;
      const u = (((this.ghostU + off) % 1) + 1) % 1;
      const pt = this.railCurve.getPointAt(u);
      const t = this.railCurve.getTangentAt(u);
      const hop = Math.abs(Math.sin((this.ghostU + off) * this.railLen * 2.4)) * 0.14;
      g.position.set(pt.x, this.surfaceY(pt.x, pt.z) + hop, pt.z);
      g.rotation.y = Math.atan2(t.x, t.z);
      const d = Math.hypot(p.x - g.position.x, p.z - g.position.z);
      g.visible = this.mode !== "play" || d < 28;
      if (this.mode !== "play" || this.paused || this.ghostHit || this.debug.noclip) continue;
      if (d < 3.2 && this.toastT <= 0) {
        this.toast = "傘が近い";
        this.toastT = 1.1;
      }
      if (d < GHOST_HIT) {
        this.ghostHit = true;
        this.toast = null;
        this.emit();
        this.onGhostHit?.("kasa");
      }
    }
    if (this.ghost && this.kasas[0]) {
      this.ghost.position.copy(this.kasas[0].position);
    }
  }

  private tickMimic(dt: number) {
    if (this.mimics.length === 0) return;
    const pl = this.yawObj.position;
    const speed = WALK;
    for (const g of this.mimics) {
      const hx = Number(g.userData.homeX);
      const hz = Number(g.userData.homeZ);
      const d = Math.hypot(pl.x - g.position.x, pl.z - g.position.z);
      g.visible = this.mode !== "play" || d < 28;
      if (this.mode === "play" && !this.paused && !this.ghostHit && d < 10) {
        const ang = Math.atan2(pl.x - g.position.x, pl.z - g.position.z);
        let nx = g.position.x + Math.sin(ang) * speed * dt;
        let nz = g.position.z + Math.cos(ang) * speed * dt;
        const fromHome = Math.hypot(nx - hx, nz - hz);
        if (fromHome > MIMIC_LEASH) {
          const s = MIMIC_LEASH / fromHome;
          nx = hx + (nx - hx) * s;
          nz = hz + (nz - hz) * s;
        }
        g.position.x = nx;
        g.position.z = nz;
        g.position.y = this.surfaceY(g.position.x, g.position.z);
        g.rotation.y = ang;
        if (d < 1.05 && !this.debug.noclip) {
          this.ghostHit = true;
          this.emit();
          this.onGhostHit?.("mimic");
        }
      } else {
        g.position.x += (hx - g.position.x) * Math.min(1, dt * 1.4);
        g.position.z += (hz - g.position.z) * Math.min(1, dt * 1.4);
      }
    }
  }

  private tickAka(dt: number) {
    if (this.akas.length === 0) return;
    const now = performance.now() * 0.001;
    const pl = this.yawObj.position;
    let touching = false;
    for (const a of this.akas) {
      const hop = Math.abs(Math.sin(now * 2.2 + a.phase)) * 0.04;
      const p = a.group.position;
      p.y = this.surfaceY(p.x, p.z) + hop;
      const d = Math.hypot(pl.x - p.x, pl.z - p.z);
      a.group.visible = this.mode !== "play" || d < 28;
      if (this.mode === "play" && !this.paused && !this.ghostHit && d < 1.15 && !this.debug.noclip) {
        touching = true;
      }
    }
    if (touching) this.akaTouch += dt;
    else this.akaTouch = 0;
    if (this.akaTouch >= 1 && !this.ghostHit) {
      this.ghostHit = true;
      this.emit();
      this.onGhostHit?.("aka");
    }
  }

  private syncAka() {
    const glow = this.mode === "play" && !this.lanternOn;
    for (const a of this.akas) {
      if (a.light) {
        a.light.visible = glow;
        a.light.intensity = glow ? 200 : 0;
      }
      for (const m of a.mats) {
        m.opacity = glow ? 1 : 0.1;
        m.transparent = true;
        m.emissiveIntensity = glow ? 0.55 : 0.05;
      }
    }
  }

  private tickPipes() {
    if (this.pipes.length === 0) return;
    const t = performance.now() * 0.001;
    const pl = this.yawObj.position;
    for (const g of this.pipes) {
      posePipeTaiso(g, t);
      const d = Math.hypot(pl.x - g.position.x, pl.z - g.position.z);
      g.visible = this.mode !== "play" || d < 28;
    }
  }

  private tickYuki() {
    if (this.yukis.length === 0) return;
    const t = performance.now() * 0.001;
    const pl = this.yawObj.position;
    for (const g of this.yukis) {
      posePipeTaiso(g, t);
      const d = Math.hypot(pl.x - g.position.x, pl.z - g.position.z);
      g.visible = this.mode !== "play" || d < 28;
    }
  }

  private tickMeri() {
    if (this.meris.length === 0) return;
    const t = performance.now() * 0.001;
    const pl = this.yawObj.position;
    for (const g of this.meris) {
      poseMeri(g, t);
      g.rotation.y = Math.atan2(pl.x - g.position.x, pl.z - g.position.z);
      const d = Math.hypot(pl.x - g.position.x, pl.z - g.position.z);
      g.visible = this.mode !== "play" || d < 28;
    }
  }

  private syncRailGlow() {
    // 経路は消灯時だけ蒼い。灯は規格であり、おばけのレールは闇の側の印。
    const glow = this.mode === "play" && !this.lanternOn && this.flashT <= 0;
    if (this.railMesh) this.railMesh.visible = glow;
    if (this.ghostLight) this.ghostLight.visible = glow;
  }

  private placePlayer(orbit: boolean) {
    const dx = this.world.landmark.cx - this.world.spawnX;
    const dz = this.world.landmark.cz - this.world.spawnZ;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = orbit ? -0.42 : 0.08;
    this.yawObj.position.set(this.world.spawnX, EYE, this.world.spawnZ);
    this.vx = 0;
    this.vz = 0;
    this.yawObj.rotation.set(0, this.yaw, 0);
    this.pitchObj.rotation.set(this.pitch, 0, 0);
    this.yawObj.position.y = this.surfaceY(this.world.spawnX, this.world.spawnZ) + EYE;

  }

  private walkableWorld(x: number, z: number, r = 0.36) {
    if (this.debug.noclip) return true;
    const feet = this.yawObj.position.y - EYE;
    const onRamp = this.rampSurface(x, z);
    if (onRamp == null) {
      for (const [ox, oz] of [
        [-r, -r],
        [r, -r],
        [-r, r],
        [r, r],
      ] as const) {
        const { i, j } = worldToCell(x + ox, z + oz);
        if (!isWalk(this.world, i, j)) return false;
      }
    }
    for (const s of this.solids) {
      if (Math.hypot(x - s.x, z - s.z) < s.r + r) return false;
    }
    if (this.rampInside(x, z, feet + 0.9) && onRamp == null) return false;
    if (onRamp != null && onRamp - feet > 0.72) return false;
    return true;
  }

  private surfaceY(x: number, z: number) {
    return this.rampSurface(x, z) ?? 0;
  }

  private rampSurface(x: number, z: number): number | null {
    for (const ramp of this.ramps) {
      this.localP.set(0, ramp.halfT, 0).applyMatrix4(ramp.mat);
      this.localD.set(0, 1, 0).transformDirection(ramp.mat);
      const ny = this.localD.y;
      if (ny < 0.42) continue;
      const hitY =
        this.localP.y -
        (this.localD.x * (x - this.localP.x) + this.localD.z * (z - this.localP.z)) / ny;
      this.tmp.set(x, hitY, z).applyMatrix4(ramp.inv);
      if (Math.abs(this.tmp.x) <= ramp.halfL + 0.1 && Math.abs(this.tmp.z) <= ramp.halfW + 0.16) {
        return hitY;
      }
    }
    return null;
  }


  private rampInside(x: number, z: number, y: number) {
    for (const ramp of this.ramps) {
      this.localP.set(x, y, z).applyMatrix4(ramp.inv);
      if (
        Math.abs(this.localP.x) <= ramp.halfL &&
        Math.abs(this.localP.y) <= ramp.halfT &&
        Math.abs(this.localP.z) <= ramp.halfW
      ) {
        return true;
      }
    }
    return false;
  }


  private bindLook() {
    const onLocked = (e: PointerEvent) => {
      if (this.mode !== "play" || this.paused) return;
      if (document.pointerLockElement) this.input.addLook(e.movementX, e.movementY);
    };
    document.addEventListener("pointermove", onLocked);
    this._lookDetach = () => document.removeEventListener("pointermove", onLocked);
  }

  _lookDetach: (() => void) | null = null;

  applyExternalStick(x: number, y: number) {
    this.input.stick.x = x;
    this.input.stick.y = y;
  }

  applyExternalLook(dx: number, dy: number) {
    this.input.addLook(dx, dy);
  }

  private loop(now: number) {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, 0.08);
    this.last = now;

    if (this.mode === "orbit") {
      this.orbitT += dt;
      const lm = this.world.landmark;
      const ang = this.orbitT * 0.18;
      const rad = 5.5;
      this.yawObj.position.set(lm.cx + Math.cos(ang) * rad, 11.5, lm.cz + Math.sin(ang) * rad);
      this.yawObj.lookAt(lm.cx, 0.4, lm.cz);
      this.pitchObj.rotation.set(0, 0, 0);
    } else if (!this.paused) {
      this.tickPlay(dt);
    }
    if (this.mode === "play") this.tickFlash(dt);
    if (this.portalSpin) this.portalSpin.rotation.z += dt * 0.35;
    this.tickGhost(dt);
    this.tickMimic(dt);
    this.tickAka(dt);
    this.tickPipes();
    this.tickYuki();
    this.tickMeri();
    this.syncRailGlow();
    this.syncAka();
    this.tickSouls(now);





    for (const m of this.relicMeshes) {
      const id = m.userData.relicId as number;
      const hide = this.found.has(id);
      m.visible = !hide;
      if (!hide) {
        m.rotation.y += dt * 0.8;
        m.position.y = 1.15 + Math.sin(now * 0.002 + id) * 0.08;
      }
    }

    const pw = this.canvas.clientWidth;
    const ph = this.canvas.clientHeight;
    if (pw && ph && (this.canvas.width !== Math.floor(pw * this.renderer.getPixelRatio()) || this.canvas.height !== Math.floor(ph * this.renderer.getPixelRatio()))) {
      this.fit();
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  private tickPlay(dt: number) {
    const a = this.input.sample();
    if (a.lantern) this.toggleLantern();
    if (a.flash) this.triggerFlash();
    if (a.pause) this.setPaused(true);


    this.yaw -= a.lookX * LOOK;
    this.pitch -= a.lookY * LOOK;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    this.yawObj.rotation.set(0, this.yaw, 0);
    this.pitchObj.rotation.set(this.pitch, 0, 0);

    const sprint = this.input.keys.has("ShiftLeft") || this.input.keys.has("ShiftRight") || Math.hypot(a.moveX, a.moveY) > 0.92;
    const max = (sprint ? SPRINT : WALK) * this.debug.speed;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);

    const wishX = fx * a.moveY + rx * a.moveX;
    const wishZ = fz * a.moveY + rz * a.moveX;

    const { i, j } = worldToCell(this.yawObj.position.x, this.yawObj.position.z);
    const wet = i >= 0 && j >= 0 && i < SIZE && j < SIZE && this.world.flooded[j * SIZE + i];
    const target = (wet ? 0.55 : 1) * max;
    const moving = Math.hypot(a.moveX, a.moveY) > 0.08;
    const accel = moving ? 14 : 18;
    const wx = moving ? wishX * target : 0;
    const wz = moving ? wishZ * target : 0;
    this.vx += (wx - this.vx) * Math.min(1, accel * dt);
    this.vz += (wz - this.vz) * Math.min(1, accel * dt);

    const p = this.yawObj.position;
    const nx = p.x + this.vx * dt;
    const nz = p.z + this.vz * dt;
    if (this.walkableWorld(nx, p.z)) p.x = nx;
    else this.vx = 0;
    if (this.walkableWorld(p.x, nz)) p.z = nz;
    else this.vz = 0;
    p.y = this.surfaceY(p.x, p.z) + EYE;
    this.speed = Math.hypot(this.vx, this.vz);


    const sky =
      i >= 0 && j >= 0 && i < SIZE && j < SIZE ? this.world.openSky[j * SIZE + i] : 1;
    this.audio.setAir(sky, this.speed);
    this.audio.foot(dt, this.speed);

    let near: Relic | null = null;
    for (const r of this.world.relics) {
      if (this.found.has(r.id)) continue;
      const d = Math.hypot(p.x - r.x, p.z - r.z);
      if (d < 1.7) {
        near = r;
        this.found.add(r.id);
        this.audio.chime();
        this.toast = r.title;
        this.toastT = 3.2;
        const atLmNow =
          Math.hypot(p.x - this.world.landmark.cx, p.z - this.world.landmark.cz) <
          Math.max(4, Math.min(this.world.landmark.w, this.world.landmark.d) * 0.25);
        this.onRelicFound?.({
          relic: r,
          seed: this.world.seed,
          civName: this.world.civName,
          landmarkName: this.world.landmarkName,
          atLandmark: atLmNow,
          x: p.x,
          z: p.z,
        });
        this.spawnExtraKasa(5);
      } else if (d < 3.2 && !near) near = r;
    }

    const atLm =
      Math.hypot(p.x - this.world.landmark.cx, p.z - this.world.landmark.cz) <
      Math.max(4, Math.min(this.world.landmark.w, this.world.landmark.d) * 0.25);
    const atPortal =
      Math.hypot(p.x - this.portalX, p.z - this.portalZ) < PORTAL_R || this.debug.freeExit;

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toast = null;
    }

    const complete = this.found.size >= this.world.relics.length;
    if (complete && atLm) {
      this.toast = "この滅び方を読んだ。入口の光へ戻れ。";
      this.toastT = Math.max(this.toastT, 1);
    }
    const next = {
      ...this.makeHud(),
      nearRelic: near,
      atLandmark: atLm,
      atPortal,
      complete,
      found: this.found.size,
      toast: this.toast,
    };
    const sig = `${next.found}|${next.toast}|${next.atLandmark}|${next.atPortal}|${next.paused}|${next.lantern}|${next.flashing}|${next.flashCd}|${next.roomBright}|${next.lanternBright}|${next.fogOffM}|${next.fogOnM}|${next.debug.speed}|${Number(next.debug.seeAll)}|${Number(next.debug.flashInstant)}|${Number(next.debug.noclip)}|${Number(next.debug.showPos)}|${Number(next.debug.freeExit)}|${next.foundIds.join(",")}`;



    if (sig !== this.lastHudSig) {
      this.lastHudSig = sig;
      this.hud = next;
      for (const l of this.listeners) l(this.hud);
    }
  }

  private tickFlash(dt: number) {
    let dirty = false;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT = 0;
        this.applyAtmosphere();
        dirty = true;
      }
    }
    if (this.debug.flashInstant && this.flashCd > 0) this.flashCd = 0;
    if (this.flashCd > 0) {
      const before = Math.ceil(this.flashCd);
      this.flashCd = Math.max(0, this.flashCd - dt);
      if (Math.ceil(this.flashCd) !== before) dirty = true;
    }
    if (!dirty) return;
    const next = this.makeHud();
    const sig = `${next.found}|${next.toast}|${next.atLandmark}|${next.atPortal}|${next.paused}|${next.lantern}|${next.flashing}|${next.flashCd}|${next.roomBright}|${next.lanternBright}|${next.fogOffM}|${next.fogOnM}|${next.debug.speed}|${Number(next.debug.seeAll)}|${Number(next.debug.flashInstant)}|${Number(next.debug.noclip)}|${Number(next.debug.showPos)}|${Number(next.debug.freeExit)}|${next.foundIds.join(",")}`;


    if (sig === this.lastHudSig) return;
    this.lastHudSig = sig;
    this.hud = next;
    for (const l of this.listeners) l(this.hud);
  }

  private fit() {

    const parent = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private wireProbe() {
    window.__controlsTest = {
      getYaw: () => this.yaw,
      getSpeed: () => this.speed,
      setKeys: (codes: string[]) => {
        this.input.injected = new Set(codes);
      },
      getPos: () => ({
        x: this.yawObj.position.x,
        y: this.yawObj.position.y,
        z: this.yawObj.position.z,
      }),
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.audio.dispose();
    this._lookDetach?.();
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.disposeObject(this.scene);
    if (window.__controlsTest) delete window.__controlsTest;
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      getPos?: () => { x: number; y: number; z: number };
    };
  }
}
