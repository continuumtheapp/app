"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BERLIN_CENTER } from "@/lib/geo";
import { formatPrice } from "@/lib/pricing";

/**
 * OpenFreeMap serves these tiles: no API key, no request limits, no logo.
 * Attribution is required and MapLibre renders it automatically from the style.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/**
 * Shared marker styling. Deliberately no scale or transform — a pin that
 * resizes when tapped reads as the map jumping around under your thumb.
 * Selection changes colour only.
 */
const MARKER_BASE_CLASS =
  "px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm cursor-pointer " +
  "transition-colors duration-150";

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  title: string;
  priceCents: number;
  pricePeriod: "night" | "week" | "month";
  isNearMiss?: boolean;
}

export function ListingsMap({
  pins,
  onSearchArea,
  onPinClick,
  selectedId = null,
  className = "",
}: {
  pins: MapPin[];
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
        center: [BERLIN_CENTER.lng, BERLIN_CENTER.lat],
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
      // Roomier than it looks on desktop: these are thumb targets on a phone,
      // where anything under ~44px tall is awkward to hit.
      // Selection is applied separately, in place — see the effect below.
      el.className = MARKER_BASE_CLASS;
      el.dataset.nearMiss = pin.isNearMiss ? "1" : "";
      el.textContent = formatPrice(pin.priceCents, pin.pricePeriod).split(" / ")[0];
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
      const selected = id === selectedId;
      const nearMiss = el.dataset.nearMiss === "1";
      el.className = `${MARKER_BASE_CLASS} ${
        selected
          ? "bg-ink text-white border-ink"
          : nearMiss
            ? "bg-flexible-soft text-flexible border-flexible/40"
            : "bg-white text-ink border-line-strong"
      }`;
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
