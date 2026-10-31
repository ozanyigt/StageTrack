import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../core/format";
import { cameraPosition, lerpView, orbit, pan, presetView, zoom, type CameraPreset, type OrbitView, type SceneBounds, type Vec3 } from "../core/stage3d/camera";
import type { CarrierLabel, CarrierModel } from "../core/stage3d/carriers";
import { jointMarks, snapPlacement, type SceneLayout, type ScreenPlacement } from "../core/stage3d/scene";
import { buildCarriers, buildDimensions, buildFloorText, buildPodium, buildScreens, disposeGroup, lines, screenLabelPoint } from "./sceneObjects";
import { buildProps } from "../../draft/propObjects";
import type { StageProp } from "../../draft/stageProps";

/**
 * The 3D view of 3D Sahne (three.js, loaded with this page only). Drag: turn, wheel: zoom, Shift + drag: pan, click a
 * screen: select it. Drawn only when something changes. Each screen is one instanced mesh (one draw call however
 * many panels), so hundreds of panels stay smooth.
 */

export interface StageView {
  showGrid: boolean;
  showPodium: boolean;
  showRig: boolean;
  showDimensions: boolean;
  showLabels: boolean;
  showCurveAngles: boolean;
}

export interface StageViewportProps {
  layout: SceneLayout;
  /** The other trades' groups standing on the same floor (draft/stageProps.ts); empty for a LED-only job. */
  props?: StageProp[];
  /** A group dragged on the floor, or dropped onto the scene from the list beside it. */
  onMoveProp?: (id: string, at: { x: number; z: number }) => void;
  /** Something dropped from the list at this floor point. */
  onDropAt?: (at: { x: number; z: number }) => void;
  /** The carriers (lib/stage3d/carriers.ts) and their label. */
  carriers: CarrierModel[];
  carrierLabel: CarrierLabel | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A screen dragged on the floor to a new x / z (snapped unless Shift is held). */
  onMove: (id: string, at: Pick<ScreenPlacement, "x" | "z">) => void;
  preset: CameraPreset;
  /** Changes on every preset click (the same preset again re-frames the scene). */
  presetKey: number;
  view: StageView;
}

const FOV = 45;
/** Angle labels nearer to each other than this (pixels) are thinned out. */
const ANGLE_LABEL_MIN_PX = 30;
const ANIMATION_MS = 450;
/** A press that moves less than this (pixels) is a click. */
const CLICK_SLOP = 4;
/** A dragged screen snaps within this many pixels (in metres at the current zoom). */
const SNAP_PX = 12;
const GUIDE_COLOR = 0x22d3ee;

interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  grid: THREE.GridHelper;
  screens: THREE.Group;
  podium: THREE.Group;
  rig: THREE.Group;
  dimensions: THREE.Group;
  floorText: THREE.Group;
  /** The snapping lines while a screen is dragged. */
  guides: THREE.Group;
  /** The other trades' groups. */
  props: THREE.Group;
}

/** A label written over the picture at a 3D point (follows the camera). */
interface Label {
  key: string;
  point: Vec3;
  kind: "screen" | "dimension" | "info" | "angle";
  /** Angle labels: their screen (the ones of one screen thin out together when they would overlap). */
  group?: string;
  content: ReactNode;
  highlighted?: boolean;
}

export default function StageViewport({ layout, props = [], carriers, carrierLabel, selectedId, onSelect, onMove, onMoveProp, onDropAt, preset, presetKey, view }: StageViewportProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "tr";
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const viewRef = useRef<OrbitView | null>(null);
  const frameRef = useRef<number | null>(null);
  const animRef = useRef<{ from: OrbitView; to: OrbitView; start: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const m = (value: number) => `${formatNumber(value, lang, 2)} m`;
  const labels: Label[] = useMemo(() => {
    const out: Label[] = [];
    for (const { screen } of layout.screens) {
      const point = screenLabelPoint(layout, screen.id);
      if (!point) continue;
      out.push({
        key: `screen:${screen.id}`,
        point,
        kind: "screen",
        highlighted: screen.id === selectedId,
        content: (
          <>
            <span className="font-semibold">{screen.name}</span>
            <span className="ml-1.5 tabular-nums opacity-80">
              {screen.resolution.width} × {screen.resolution.height}
            </span>
          </>
        ),
      });
    }
    if (carrierLabel) {
      out.push({ key: "carrier", point: carrierLabel.point, kind: "info", content: t(`stage3d.carrierLabel.${carrierLabel.kind}`, { value: m(carrierLabel.valueM) }) });
    }
    for (const j of jointMarks(layout)) {
      out.push({
        key: `angle:${j.screenId}:${j.index}`,
        point: j.point,
        kind: "angle",
        group: j.screenId,
        content: `${formatNumber(Math.abs(j.angleDeg), lang, Number.isInteger(j.angleDeg) ? 0 : 1)}°`,
      });
    }
    for (const d of layout.dimensions) {
      out.push({ key: `dim:${d.kind}`, point: d.label, kind: "dimension", content: t(`stage3d.dim.${d.kind}`, { value: m(d.value) }) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, carrierLabel, selectedId, t, lang]);

  // ---- Drawing on demand.
  const labelsList = useRef(labels);
  labelsList.current = labels;
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    frameRef.current = null;
    const s = sceneRef.current;
    const host = hostRef.current;
    if (!s || !host || !viewRef.current) return;
    const anim = animRef.current;
    if (anim) {
      const t01 = (performance.now() - anim.start) / ANIMATION_MS;
      viewRef.current = lerpView(anim.from, anim.to, t01);
      if (t01 >= 1) animRef.current = null;
      else requestDraw();
    }
    const v = viewRef.current;
    const p = cameraPosition(v);
    s.camera.position.set(p.x, p.y, p.z);
    s.camera.lookAt(v.target.x, v.target.y, v.target.z);
    s.camera.updateMatrixWorld();
    s.renderer.render(s.scene, s.camera);
    placeLabels(s.camera, host.clientWidth, host.clientHeight);
  };
  function requestDraw() {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(() => drawRef.current());
  }

  function placeLabels(camera: THREE.Camera, width: number, height: number) {
    const root = labelsRef.current;
    if (!root) return;
    const v = new THREE.Vector3();
    // Angle labels closer than this to the last one shown of their screen are left out (zoomed out, they would pile up).
    const lastShown = new Map<string, { x: number; y: number }>();
    for (const label of labelsList.current) {
      const el = root.querySelector<HTMLElement>(`[data-label="${CSS.escape(label.key)}"]`);
      if (!el) continue;
      v.set(label.point.x, label.point.y, label.point.z).project(camera);
      const x = ((v.x + 1) / 2) * width;
      const y = ((1 - v.y) / 2) * height;
      let hidden = v.z > 1;
      if (!hidden && label.kind === "angle" && label.group) {
        const prev = lastShown.get(label.group);
        if (prev && Math.hypot(x - prev.x, y - prev.y) < ANGLE_LABEL_MIN_PX) hidden = true;
        else lastShown.set(label.group, { x, y });
      }
      el.style.display = hidden ? "none" : "";
      const shift = label.kind === "screen" ? "translate(-50%, -100%)" : label.kind === "angle" ? "translate(-50%, -100%)" : "translate(-50%, -50%)";
      el.style.transform = `${shift} translate(${x}px, ${y}px)`;
    }
  }

  // ---- Set up once: renderer, camera, light, floor.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      // preserveDrawingBuffer: the print-out takes the picture as it is on screen.
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x0a0a0a);
    renderer.domElement.dataset.testid = "stage3d-canvas";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1c1917, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-8, 14, 12);
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    scene.add(floor);
    const grid = new THREE.GridHelper(200, 200, 0x3f3f46, 0x232326);
    scene.add(grid);
    const groups = { screens: new THREE.Group(), props: new THREE.Group(), podium: new THREE.Group(), rig: new THREE.Group(), dimensions: new THREE.Group(), floorText: new THREE.Group(), guides: new THREE.Group() };
    // Measurements over everything else (they are drawn without depth test).
    groups.dimensions.renderOrder = 10;
    for (const g of Object.values(groups)) scene.add(g);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2000);
    sceneRef.current = { renderer, scene, camera, grid, ...groups };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestDraw();
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(host);

    return () => {
      observer?.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      disposeGroup(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- What is drawn: rebuilt when the layout or the choice changes.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeGroup(s.screens);
    s.screens.add(buildScreens(layout, selectedId));
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, selectedId]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeGroup(s.podium);
    s.podium.add(buildPodium(layout.podium));
    disposeGroup(s.dimensions);
    s.dimensions.add(buildDimensions(layout));
    disposeGroup(s.floorText);
    s.floorText.add(buildFloorText(t("stage3d.audience"), layout.audience, Math.min(9, Math.max(3, layout.podium.width * 0.5))));
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, t]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeGroup(s.rig);
    s.rig.add(buildCarriers(carriers));
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carriers]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    disposeGroup(s.props);
    s.props.add(buildProps(props, selectedId));
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, selectedId]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.grid.visible = view.showGrid;
    s.podium.visible = view.showPodium;
    s.rig.visible = view.showRig;
    s.dimensions.visible = view.showDimensions;
    s.floorText.visible = view.showLabels;
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.showGrid, view.showPodium, view.showRig, view.showDimensions, view.showLabels]);

  // Labels added / removed: place them at once.
  useEffect(() => {
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, view.showLabels, view.showDimensions, view.showCurveAngles]);

  // ---- The view: a preset framing the scene. A click on a preset eases there; until the view is turned / zoomed by
  // hand, it follows the scene (screens arriving, shown, hidden; the stage resized).
  const boundsKey = JSON.stringify(layout.bounds);
  const userMoved = useRef(false);
  const lastPresetKey = useRef(presetKey);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const aspect = host.clientWidth / Math.max(1, host.clientHeight) || 16 / 9;
    const target = presetView(preset, JSON.parse(boundsKey) as SceneBounds, FOV, aspect);
    const clicked = lastPresetKey.current !== presetKey;
    lastPresetKey.current = presetKey;
    if (clicked) userMoved.current = false;
    if (!viewRef.current || (!clicked && !userMoved.current)) {
      animRef.current = null;
      viewRef.current = target;
    } else if (clicked) animRef.current = { from: viewRef.current, to: target, start: performance.now() };
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, presetKey, boundsKey]);

  // ---- Pointer: on a screen, a drag moves it on the floor (snapping) and a click selects it; on empty space a drag
  // turns the view, Shift + drag pans, a click deselects. The wheel zooms.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const propsRef = useRef(props);
  propsRef.current = props;
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
    /** Moving a screen: which, the floor height grabbed at, and how far its place is from the point grabbed. */
    screen: { id: string; planeY: number; dx: number; dz: number } | null;
    /** Moving a group of another trade; the same idea, without the screen-to-screen snapping. */
    prop: { id: string; planeY: number; dx: number; dz: number } | null;
  } | null>(null);
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || failed) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const hit = pickHit(e.clientX, e.clientY);
    const placed = hit?.kind === "screen" && layoutRef.current.screens.find((p) => p.screen.id === hit.id);
    const screen = hit && placed ? { id: hit.id, planeY: hit.point.y, dx: placed.x - hit.point.x, dz: placed.z - hit.point.z } : null;
    const propped = hit?.kind === "prop" ? propsRef.current.find((p) => p.id === hit.id) : undefined;
    const prop = hit && propped ? { id: hit.id, planeY: hit.point.y, dx: propped.x - hit.point.x, dz: propped.z - hit.point.z } : null;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, screen, prop };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const v = viewRef.current;
    if (!d || d.id !== e.pointerId || !v) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < CLICK_SLOP) return;
    d.moved = true;
    userMoved.current = true;
    animRef.current = null;
    if (d.prop) {
      const floor = floorPoint(e.clientX, e.clientY, d.prop.planeY);
      if (!floor) return;
      const round = (n: number) => Math.round(n * 100) / 100;
      onMoveProp?.(d.prop.id, { x: round(floor.x + d.prop.dx), z: round(floor.z + d.prop.dz) });
      return;
    }
    if (d.screen) {
      const floor = floorPoint(e.clientX, e.clientY, d.screen.planeY);
      const placed = layoutRef.current.screens.find((p) => p.screen.id === d.screen!.id);
      if (!floor || !placed) return;
      const host = hostRef.current!;
      const metresPerPixel = (2 * v.distance * Math.tan(((FOV / 2) * Math.PI) / 180)) / Math.max(1, host.clientHeight);
      const snapped = snapPlacement(layoutRef.current, d.screen.id, { x: floor.x + d.screen.dx, z: floor.z + d.screen.dz, rotationDeg: placed.rotationDeg }, SNAP_PX * metresPerPixel, e.shiftKey);
      const round = (n: number) => Math.round(n * 100) / 100;
      onMove(d.screen.id, { x: round(snapped.x), z: round(snapped.z) });
      showGuides(snapped.guideX, snapped.guideZ);
      return;
    }
    viewRef.current = e.shiftKey ? pan(v, dx, dy, hostRef.current?.clientHeight ?? 1, FOV) : orbit(v, dx, dy);
    requestDraw();
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    showGuides(null, null);
    const moving = d.screen ?? d.prop;
    if (moving && d.moved) onSelect(moving.id);
    else if (!d.moved && e.type === "pointerup") onSelect(moving?.id ?? null);
  }
  /** The snapping lines across the stage while a screen is dragged (none: hidden). */
  function showGuides(x: number | null, z: number | null) {
    const s = sceneRef.current;
    if (!s) return;
    disposeGroup(s.guides);
    const y = layoutRef.current.podium.height + 0.01;
    const segments = [
      ...(x !== null ? [{ a: { x, y, z: -60 }, b: { x, y, z: 60 } }] : []),
      ...(z !== null ? [{ a: { x: -60, y, z }, b: { x: 60, y, z } }] : []),
    ];
    if (segments.length > 0) s.guides.add(lines(segments, GUIDE_COLOR));
    requestDraw();
  }
  /** Where the pointer meets the level plane at height `y`. */
  function floorPoint(clientX: number, clientY: number, y: number): THREE.Vector3 | null {
    const ray = rayAt(clientX, clientY);
    if (!ray) return null;
    const point = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), point) ? point : null;
  }
  function rayAt(clientX: number, clientY: number): THREE.Raycaster | null {
    const s = sceneRef.current;
    const host = hostRef.current;
    if (!s || !host) return null;
    const rect = host.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), s.camera);
    return ray;
  }
  /** What is under the pointer - a screen or a group of another trade - and the point hit on it. */
  function pickHit(clientX: number, clientY: number): { id: string; kind: "screen" | "prop"; point: THREE.Vector3 } | null {
    const s = sceneRef.current;
    const ray = rayAt(clientX, clientY);
    if (!s || !ray) return null;
    const meshes: THREE.Object3D[] = [];
    for (const root of [s.screens, s.props]) {
      root.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) meshes.push(o);
      });
    }
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    const screenId = hit.object.userData.screenId as string | undefined;
    if (screenId) return { id: screenId, kind: "screen", point: hit.point.clone() };
    const propId = hit.object.userData.propId as string | undefined;
    return propId ? { id: propId, kind: "prop", point: hit.point.clone() } : null;
  }
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (!viewRef.current) return;
      e.preventDefault();
      userMoved.current = true;
      animRef.current = null;
      viewRef.current = zoom(viewRef.current, e.deltaY);
      requestDraw();
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = (l: Label) =>
    l.kind === "dimension" ? view.showDimensions : l.kind === "angle" ? view.showCurveAngles : l.key === "carrier" ? view.showLabels && view.showRig : view.showLabels;
  return (
    <div
      ref={hostRef}
      className="relative w-full h-full overflow-hidden bg-neutral-950 cursor-grab active:cursor-grabbing select-none"
      data-stage3d-view
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDragOver={onDropAt ? (e) => e.preventDefault() : undefined}
      onDrop={
        onDropAt
          ? (e) => {
              // Dropped from the list beside the scene: it lands where it was let go, on the deck.
              e.preventDefault();
              const floor = floorPoint(e.clientX, e.clientY, layoutRef.current.podium.height);
              if (floor) onDropAt({ x: Math.round(floor.x * 100) / 100, z: Math.round(floor.z * 100) / 100 });
            }
          : undefined
      }
    >
      {failed && <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 p-6 text-center">{t("stage3d.noWebgl")}</p>}
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none" aria-hidden>
        {labels.filter(shown).map((l) => (
          <div
            key={l.key}
            data-label={l.key}
            className={`absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] leading-tight border ${
              l.highlighted
                ? "bg-yellow-400 text-black border-yellow-300"
                : l.kind === "dimension"
                  ? "bg-neutral-950/85 text-neutral-100 border-neutral-600 tabular-nums"
                  : l.kind === "angle"
                    ? "bg-sky-950/85 text-sky-100 border-sky-500/60 tabular-nums px-1 py-0 text-[10px]"
                    : l.kind === "info"
                    ? "bg-neutral-800/90 text-neutral-200 border-neutral-500 tabular-nums"
                    : "bg-neutral-900/85 text-neutral-100 border-neutral-700"
            }`}
          >
            {l.content}
          </div>
        ))}
      </div>
    </div>
  );
}
