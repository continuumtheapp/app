"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, type Bbox } from "@/lib/geo";
import { formatMoney } from "@/lib/pricing";

/**
 * OpenFreeMap serves these tiles: no API key, no request limits, no logo.
 * Attribution is required and MapLibre renders it automatically from the style.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/**
 * Marker styling, applied inline rather than with Tailwind classes.
 *
 * Markers are created in plain DOM and restyled at runtime, so any Tailwind
 * class names here would be assembled from variables — which Tailwind's
 * scanner cannot see, so it never generates the CSS and the pins render
 * unstyled. Inline styles avoid the build step entirely.
 *
 * Deliberately no transform: a pin that resizes when tapped reads as the map
 * jumping under your thumb. Selection changes colour only, and hover is handled
 * by CSS in globals.css — MapLibre intercepts pointer events on markers, so JS
 * mouseenter handlers never fire.
 */
const MARKER_BASE_STYLE: Partial<CSSStyleDeclaration> = {
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "500",
  lineHeight: "1.2",
  borderWidth: "1px",
  borderStyle: "solid",
  boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)",
  cursor: "pointer",
  transition: "background-color 150ms, border-color 150ms, color 150ms",
  whiteSpace: "nowrap",
};

/** Matches the palette in globals.css. */
const MARKER_COLOURS = {
  /** An exact match. */
  exact:    { background: "#ffffff", color: "#1a1a1a", borderColor: "#d4cfc7" },
  /** A near miss — same amber as the "not quite" cards in the list. */
  nearMiss: { background: "#fff3e0", color: "#9c5f00", borderColor: "#f6d9a8" },
  /** The pin whose card is open. */
  selected: { background: "#014e4b", color: "#ffffff", borderColor: "#014e4b" },
} as const;

function paintMarker(el: HTMLElement, state: "exact" | "nearMiss" | "selected") {
  const c = MARKER_COLOURS[state];
  el.style.backgroundColor = c.background;
  el.style.color = c.color;
  el.style.borderColor = c.borderColor;
  el.style.zIndex = state === "selected" ? "10" : "";
  // Read by the :hover rules in globals.css.
  el.dataset.state = state;
}

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  title: string;
  /** Cheapest rate per night — comparable between listings priced differently. */
  pricePerNightCents: number;
  currency: string;
  isNearMiss?: boolean;
}

export function ListingsMap({
  pins,
  onSearchArea,
  onPinClick,
  selectedId = null,
  area = null,
  className = "",
}: {
  pins: MapPin[];
  /** The area searched, e.g. a city: shown when there are no pins to frame. */
  area?: Bbox | null;
  onSearchArea?: (bbox: { south: number; west: number; north: number; east: number }) => void;
  /** Called instead of navigating, so mobile can show a card for the pin. */
  onPinClick?: (id: number) => void;
  /** Highlights the pin whose card is currently open. */
  selectedId?: number | null;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  /** Marker elements by listing id, so selection restyles without rebuilding. */
  const markerEls = useRef<Map<number, HTMLButtonElement>>(new Map());
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);
  // Held in a ref so changing the handler doesn't force every marker to rebuild.
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const areaRef = useRef(area);
  areaRef.current = area;

  /**
   * Create the map once and keep it for the lifetime of the component.
   *
   * MapLibre is imported dynamically rather than at the top of the module.
   * Its bundled entry point spawns a Web Worker, and Next's bundler rewrites
   * the worker URL such that the worker never starts: the style downloads but
   * is never processed, so no tiles are ever requested and the canvas stays
   * blank — with no error raised. Loading it at runtime keeps the worker's own
   * URL resolution intact.
   *
   * The map is also deliberately NOT torn down in this effect's cleanup:
   * React Strict Mode runs effects twice in development, and removing the map
   * there would destroy the WebGL context and leave a dead canvas behind.
   */
  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !container.current || map.current) return;

      // MapLibre parses tiles in a Web Worker. Next's bundler rewrites the
      // worker entry point into something that never starts, so the style
      // loads but no tiles are ever requested and the canvas stays blank —
      // silently, with no error. Pointing at the library's own prebuilt worker,
      // copied into public/vendor by `npm run sync-maplibre-worker`, sidesteps
      // the bundler entirely.
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

      const instance = new maplibre.Map({
        container: container.current,
        style: STYLE_URL,
        center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
        zoom: 10.5,
        attributionControl: { compact: true },
      });
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.current = instance;
      setReady(true);

      // The container is often not laid out yet when the map is constructed,
      // and MapLibre caches that zero size — it then never works out which
      // tiles the viewport needs. Resizing on layout change fixes that.
      const observer = new ResizeObserver(() => instance.resize());
      observer.observe(container.current);
      resizeObserver.current = observer;
    })();

    return () => { cancelled = true; };
  }, []);

  // Dispose only when the component really goes away.
  useEffect(() => () => {
    resizeObserver.current?.disconnect();
    map.current?.remove();
    map.current = null;
  }, []);

  // Re-render markers whenever the results change.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let cancelled = false;

    // Cleared synchronously, before the await: if this ran after the dynamic
    // import, a re-render could add its markers before the previous set was
    // removed, leaving duplicates on the map.
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    markerEls.current.clear();

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;

    for (const pin of pins) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "simbacasa-pin";
      Object.assign(el.style, MARKER_BASE_STYLE);
      el.dataset.nearMiss = pin.isNearMiss ? "1" : "";
      paintMarker(el, pin.isNearMiss ? "nearMiss" : "exact");

      el.textContent = formatMoney(pin.pricePerNightCents, pin.currency);
      el.setAttribute("aria-label", `${pin.title} — view listing`);
      el.onclick = () => {
        if (onPinClickRef.current) onPinClickRef.current(pin.id);
        else window.location.href = `/listing/${pin.id}`;
      };

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);

      // A popup would cover the card that opens on tap, so only show one when
      // the marker navigates directly.
      if (!onPinClickRef.current) {
        marker.setPopup(
          new maplibre.Popup({ offset: 12, closeButton: false }).setHTML(
            `<div style="font-size:13px;font-weight:500;max-width:180px">${escapeHtml(pin.title)}</div>`,
          ),
        );
      }

      markers.current.push(marker);
      markerEls.current.set(pin.id, el);
    }

    // Frame the results, unless there is only one (which would zoom in absurdly).
    if (pins.length > 1) {
      const bounds = new maplibre.LngLatBounds();
      pins.forEach((p) => bounds.extend([p.lng, p.lat]));
      m.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 400 });
    } else if (pins.length === 1) {
      m.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 13, duration: 400 });
    } else if (areaRef.current) {
      const a = areaRef.current;
      m.fitBounds([[a.west, a.south], [a.east, a.north]], { padding: 20, duration: 0 });
      }
    })();

    return () => { cancelled = true; };
  }, [pins, ready]);

  /**
   * Apply the selected style in place.
   *
   * Rebuilding the markers when the selection changed removed the very element
   * the user was tapping, so only the first tap ever registered a card. This
   * only swaps class names, leaving the DOM nodes and their handlers alone.
   */
  useEffect(() => {
    for (const [id, el] of markerEls.current) {
      const nearMiss = el.dataset.nearMiss === "1";
      paintMarker(el, id === selectedId ? "selected" : nearMiss ? "nearMiss" : "exact");
    }
  }, [selectedId, pins, ready]);

  return (
    <div className={`relative ${className}`}>
      <div ref={container} className="size-full rounded-xl overflow-hidden border border-line" />
      {onSearchArea && (
        <button
          type="button"
          onClick={() => {
            const b = map.current?.getBounds();
            if (b) onSearchArea({
              south: b.getSouth(), west: b.getWest(),
              north: b.getNorth(), east: b.getEast(),
            });
          }}
          className="btn btn-secondary absolute top-3 left-1/2 -translate-x-1/2 shadow-sm text-sm py-1.5"
        >
          Search this area
        </button>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
