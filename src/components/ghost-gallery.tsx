/*
  管理メニューからおばけを見る。本番の createGhost と同じ形。
  ゲームループは持たない。滑走もしない。回して hop するだけ。
*/
// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createGhost, GHOST_CATALOG, setBagFace, posePipeTaiso, type GhostKind } from "@/game/ghosts";

export function GhostGallery({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<GhostKind>("kasa");
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const entry = GHOST_CATALOG.find((g) => g.kind === kind) ?? GHOST_CATALOG[0]!;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x141210, 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141210);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.08, 24);
    camera.position.set(2.1, 1.35, 2.4);
    camera.lookAt(0, 0.75, 0);
    scene.add(new THREE.HemisphereLight(0xc9d2d4, 0x3a3228, 0.85));
    const sun = new THREE.DirectionalLight(0xf0e6d4, 0.7);
    sun.position.set(2.2, 4.2, 3);
    scene.add(sun);
    const fill = new THREE.PointLight(0x66c8ff, 1.4, 8, 2);
    fill.position.set(-0.4, 1.6, 1.4);
    scene.add(fill);

    let ghost = createGhost(kindRef.current);
    scene.add(ghost);
    const lamp = ghost.getObjectByName("ghostLamp");
    if (lamp instanceof THREE.PointLight) lamp.visible = true;

    const swap = (next: GhostKind) => {
      scene.remove(ghost);
      disposeObj(ghost);
      ghost = createGhost(next);
      scene.add(ghost);
      const l = ghost.getObjectByName("ghostLamp");
      if (l instanceof THREE.PointLight) l.visible = true;
    };

    let raf = 0;
    let lastKind = kindRef.current;
    let faceI = 0;
    let faceT = 0;
    const loop = (now: number) => {
      if (kindRef.current !== lastKind) {
        lastKind = kindRef.current;
        swap(lastKind);
        faceI = 0;
        faceT = now;
      }
      const t = now * 0.001;
      if (lastKind === "mimic" && now - faceT > 500) {
        faceT = now;
        faceI += 1;
        setBagFace(ghost, faceI);
      }
      if (lastKind === "pipe" || lastKind === "yuki" || lastKind === "meri") {
        posePipeTaiso(ghost, t);
        ghost.rotation.y = t * 0.35;
        ghost.position.y = 0;
        ghost.rotation.z = 0;
      } else {
        ghost.rotation.y = t * 0.65;
        ghost.position.y = Math.abs(Math.sin(t * 3.1)) * 0.14;
        ghost.rotation.z = Math.sin(t * 3.1) * 0.1;
      }
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w && h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      disposeObj(ghost);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <p className="text-subtle text-xs tracking-[0.28em]">図鑑</p>
        <p className="text-subtle mt-1 text-xs">No.{String(entry.no).padStart(3, "0")}</p>
        <h2 className="font-display mt-1 text-2xl">{entry.name}</h2>
        <p className="text-muted mt-2 text-sm leading-relaxed">{entry.note}</p>
        <canvas
          ref={canvasRef}
          className="mt-4 min-h-0 w-full flex-1 rounded-[var(--radius-xl)]"
          aria-label={entry.name}
        />
        {GHOST_CATALOG.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {GHOST_CATALOG.map((g) => (
              <button
                key={g.kind}
                type="button"
                className={g.kind === kind ? "btn-primary px-4" : "btn-ghost px-4"}
                onClick={() => setKind(g.kind)}
              >
                No.{String(g.no).padStart(3, "0")} {g.name}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn-primary mt-4 w-full" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}

function disposeObj(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
