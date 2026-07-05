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
  Color,
  DirectionalLight,
  MeshPhongMaterial,
} from "three";
import {
  countryCentroid,
  countryId,
  countryName,
  type CountryFeature,
} from "@/lib/countries";

type GlobeRef = MutableRefObject<GlobeMethods | undefined>;

// next/dynamic drops refs, so thread it through a plain prop instead.
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

// Single marker shown on the selected country only: glowing dot + name.
// pointer-events stays off so it never blocks globe drag/click.
//
// three-globe's html layer (data-bind-mapper) keys by array position, not
// identity, and only calls htmlElement() once per slot to CREATE the DOM
// node — it never re-invokes it just because the data object changed. To
// force a clean rebuild when the selected country changes (rather than
// stale text bleeding through), GlobeCanvas below keys markers with a
// remount id so the html layer always tears down and recreates.
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

  // Matte material: no specular hotspot on the oceans. The night texture is
  // loaded onto it by the globeImageUrl prop.
  const nightMaterial = useMemo(() => {
    const mat = new MeshPhongMaterial();
    mat.shininess = 0;
    mat.specular = new Color(0x000000);
    return mat;
  }, []);

  const markers = useMemo<CountryMarker[]>(
    () =>
      selected
        ? [{ ...countryCentroid(selected), name: countryName(selected) }]
        : [],
    [selected]
  );

  // New function identity per selected country forces three-globe's
  // dataMapper.clear() path (it clears its html-layer cache whenever the
  // htmlElement prop itself changes), guaranteeing the DOM node is rebuilt
  // fresh rather than a stale one bleeding the previous country's label.
  const selectedId = selected ? countryId(selected) : null;
  const buildMarkerElement = useCallback(
    (d: object) => createMarkerElement((d as CountryMarker).name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const polygonAltitude = useCallback(
    (d: object) => (d === selected ? 0.02 : 0.008),
    [selected]
  );
  const polygonCapColor = useCallback(
    (d: object) =>
      d === selected ? "rgba(255, 212, 0, 0.15)" : "rgba(0, 0, 0, 0)",
    [selected]
  );
  const polygonStrokeColor = useCallback(
    (d: object) => (d === selected ? "#ffd400" : "rgba(255, 255, 255, 0.3)"),
    [selected]
  );
  const polygonSideColor = useCallback(() => "rgba(0, 0, 0, 0)", []);
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
    const altitude = 1.8;
    // Bias the look-at target east so the selected country renders well left
    // of canvas-center, clearing the full-right news panel. The offset is a
    // fixed angular amount (not px-based) so it holds steady across screen
    // sizes; tuned for this altitude specifically.
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

  // Fly when selection comes from outside the globe (e.g. the command
  // palette); resume the idle rotation when the selection is cleared.
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
    globe.pointOfView({ lat: 20, lng: 0, altitude: 2.4 }, 0);
    // The globe canvas is oversized (~135% of viewport) for the cropped
    // composition, so actual rendered pixels are already well above the
    // viewport's own pixel count — capping devicePixelRatio at 2 here would
    // still mean shading roughly 2x the real screen's pixels. Cap lower to
    // keep the 8K-textured, antialiased scene at 60fps on typical laptops.
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    globe.renderer().setPixelRatio(dpr);
    
    // The night texture is self-illuminated imagery. Ambient is kept low so
    // oceans/land stay near-black (letting the texture's own city lights
    // read as the only real color), while a soft directional "moonlight"
    // adds a subtle silver rim from one side.
    globe.lights([new AmbientLight(0xffffff, Math.PI * 0.45)]);

    // Soft off-screen "moonlight" rides along as a camera child so the
    // silver rim stays on the viewer-facing side while the globe rotates.
    const scene = globe.scene();
    const camera = globe.camera();
    scene.add(camera);

    // Aimed at the globe center (default light target is the world origin).
    const moonlight = new DirectionalLight(0xf2f4f8, 1.4);
    moonlight.position.set(175, 105, 40);
    camera.add(moonlight);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.03;
    controls.enableDamping = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  // Safety net: if the one-shot onGlobeReady event is missed (hot reload,
  // cached texture, or a dropped event), initialize anyway after a grace
  // period so the preloader can never hang the page.
  useEffect(() => {
    if (ready || size.width === 0) return;
    const t = setTimeout(() => handleReady(), 3000);
    return () => clearTimeout(t);
  }, [ready, size.width, handleReady]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
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
          globeMaterial={nightMaterial}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere
          atmosphereColor="#8a94a8"
          atmosphereAltitude={0.1}
          polygonsData={countries}
          polygonAltitude={polygonAltitude}
          polygonCapColor={polygonCapColor}
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
          rendererConfig={{ antialias: true, alpha: true }}
        />
      )}
    </div>
  );
}

export type { CountryFeature };
export { countryId };
