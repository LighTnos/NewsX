"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { GlobeMethods, GlobeProps } from "react-globe.gl";
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
} from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import {
  countryCentroid,
  countryId,
  countryName,
  type CountryFeature,
} from "@/lib/countries";

BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

type GlobeRef = MutableRefObject<GlobeMethods | undefined>;

const Globe = dynamic(
  () =>
    import("react-globe.gl").then((mod) => {
      const GlobeGl = mod.default;
      function GlobeWithRef({
        forwardedRef,
        ...props
      }: GlobeProps & { forwardedRef: GlobeRef }) {
        return <GlobeGl ref={forwardedRef} {...props} />;
      }
      return GlobeWithRef;
    }),
  { ssr: false }
);

interface GlobeCanvasProps {
  countries: CountryFeature[];
  selected: CountryFeature | null;
  onSelect: (country: CountryFeature) => void;
  onReady?: () => void;
}

interface CountryMarker {
  lat: number;
  lng: number;
  name: string;
}

function createMarkerElement(name: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";

  const dot = document.createElement("div");
  dot.style.cssText =
    "position:absolute;left:-5px;top:-5px;width:10px;height:10px;" +
    "border-radius:9999px;background:#ffd400;" +
    "box-shadow:0 0 4px rgba(255,212,0,0.95),0 0 14px 3px rgba(255,212,0,0.55),0 0 28px 8px rgba(255,212,0,0.25);";

  const label = document.createElement("div");
  label.textContent = name;
  label.style.cssText =
    "position:absolute;top:9px;left:0;transform:translateX(-50%);" +
    "color:#ffffff;font-size:12px;font-weight:600;letter-spacing:0.02em;" +
    "font-family:var(--font-geist-sans),sans-serif;" +
    "white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,0.95);";

  el.append(dot, label);
  return el;
}

export default function GlobeCanvas({
  countries,
  selected,
  onSelect,
  onReady,
}: GlobeCanvasProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const globeMaterial = useMemo(() => {
    const mat = new MeshPhongMaterial();
    mat.shininess = 0;
    mat.specular = new Color(0x000000);
    return mat;
  }, []);

  const capMaterials = useMemo(() => {
    const hidden = new MeshBasicMaterial();
    hidden.visible = false;
    const highlight = new MeshBasicMaterial({
      color: 0xffd400,
      transparent: true,
      opacity: 0.15,
      side: DoubleSide,
    });
    highlight.forceSinglePass = true;
    return { hidden, highlight };
  }, []);

  const markers = useMemo<CountryMarker[]>(
    () =>
      selected
        ? [{ ...countryCentroid(selected), name: countryName(selected) }]
        : [],
    [selected]
  );

  const selectedId = selected ? countryId(selected) : null;
  const buildMarkerElement = useCallback(
    (d: object) => createMarkerElement((d as CountryMarker).name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsMobile(window.innerWidth < 768);
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let last = 0;
    const throttleMove = (e: PointerEvent) => {
      if (e.buttons !== 0) return;
      const now = performance.now();
      if (now - last < 100) {
        e.stopPropagation();
        return;
      }
      last = now;
    };
    el.addEventListener("pointermove", throttleMove, true);
    return () => el.removeEventListener("pointermove", throttleMove, true);
  }, []);

  useEffect(() => {
    if (!ready || countries.length === 0) return;
    const globe = globeRef.current;
    if (!globe) return;
    const timer = setTimeout(() => {
      globe.scene().traverse((obj) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const geometry = mesh.geometry as BufferGeometry;
        if (geometry.boundsTree || !geometry.getAttribute("position")) return;
        geometry.computeBoundsTree();
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, countries, selected]);

  const polygonAltitude = useCallback(
    (d: object) => (d === selected ? 0.02 : 0.008),
    [selected]
  );
  const polygonCapMaterial = useCallback(
    (d: object) =>
      d === selected ? capMaterials.highlight : capMaterials.hidden,
    [selected, capMaterials]
  );
  const polygonSideColor = useCallback(() => "", []);
  const polygonStrokeColor = useCallback(
    (d: object) => (d === selected ? "#ffd400" : "rgba(255, 255, 255, 0.3)"),
    [selected]
  );
  const polygonLabel = useCallback(
    (d: object) =>
      `<span style="font-family:var(--font-geist-sans),sans-serif;font-size:12px;color:#e6e8ee;background:rgba(11,13,20,0.85);padding:4px 8px;border-radius:6px;">${
        (d as CountryFeature).properties.ADMIN
      }</span>`,
    []
  );
  const handlePolygonHover = useCallback(
    () => {},
    []
  );
  const markerLat = useCallback((d: object) => (d as CountryMarker).lat, []);
  const markerLng = useCallback((d: object) => (d as CountryMarker).lng, []);
  const markerVisibility = useCallback(
    (el: HTMLElement, isVisible: boolean) => {
      el.style.opacity = isVisible ? "1" : "0";
    },
    []
  );

  const flyTo = useCallback((country: CountryFeature) => {
    const globe = globeRef.current;
    if (!globe) return;
    const { lat, lng } = countryCentroid(country);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.innerWidth < 768;
    const altitude = isMobile ? 3.0 : 1.8;
    const LEFT_SHIFT_DEG = 0;
    globe.pointOfView(
      { lat, lng: lng + LEFT_SHIFT_DEG, altitude },
      reduceMotion ? 0 : 1000
    );
    globe.controls().autoRotate = false;
  }, []);

  const handlePolygonClick = useCallback(
    (d: object) => {
      const country = d as CountryFeature;
      onSelect(country);
      flyTo(country);
    },
    [onSelect, flyTo]
  );

  useEffect(() => {
    if (!ready) return;
    if (selected) {
      flyTo(selected);
    } else {
      const controls = globeRef.current?.controls();
      if (controls) controls.autoRotate = true;
    }
  }, [ready, selected, flyTo]);

  const initializedRef = useRef(false);
  const handleReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe || initializedRef.current) return;
    initializedRef.current = true;
    const isMobile = window.innerWidth < 768;
    const altitude = isMobile ? 4.5 : 2.4;
    globe.pointOfView({ lat: 20, lng: 0, altitude }, 0);
    const dpr = window.innerWidth < 768 
      ? Math.min(window.devicePixelRatio, 1)
      : Math.min(window.devicePixelRatio, 1.25);
    globe.renderer().setPixelRatio(dpr);
    
    globe.lights([new AmbientLight(0xffffff, Math.PI * 0.45)]);

    const scene = globe.scene();
    const camera = globe.camera();
    scene.add(camera);

    const moonlight = new DirectionalLight(0xf2f4f8, 1.4);
    moonlight.position.set(175, 105, 40);
    camera.add(moonlight);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.008;
    controls.enableDamping = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    if (ready || size.width === 0) return;
    const t = setTimeout(() => handleReady(), 3000);
    return () => clearTimeout(t);
  }, [ready, size.width, handleReady]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none"
      role="img"
      aria-label="Interactive 3D globe. Use the country selector for keyboard access."
    >
      {size.width > 0 && (
        <Globe
          forwardedRef={globeRef}
          width={size.width}
          height={size.height}
          globeImageUrl="/textures/earth-night-8k.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          globeMaterial={globeMaterial}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={!isMobile}
          atmosphereColor="#8a94a8"
          atmosphereAltitude={0.15}
          polygonsData={countries}
          polygonAltitude={polygonAltitude}
          polygonCapMaterial={polygonCapMaterial}
          polygonSideColor={polygonSideColor}
          polygonStrokeColor={polygonStrokeColor}
          polygonLabel={polygonLabel}
          polygonsTransitionDuration={200}
          onPolygonHover={handlePolygonHover}
          onPolygonClick={handlePolygonClick}
          htmlElementsData={markers}
          htmlLat={markerLat}
          htmlLng={markerLng}
          htmlAltitude={0.012}
          htmlElement={buildMarkerElement}
          htmlElementVisibilityModifier={markerVisibility}
          ringsData={markers}
          ringLat={markerLat}
          ringLng={markerLng}
          ringColor={() => "rgba(255, 212, 0, 0.5)"}
          ringMaxRadius={1.5}
          ringPropagationSpeed={1.2}
          ringRepeatPeriod={1200}
          onGlobeReady={handleReady}
          rendererConfig={{ antialias: !isMobile, alpha: true, powerPreference: "high-performance" }}
        />
      )}
    </div>
  );
}

export type { CountryFeature };
export { countryId };
