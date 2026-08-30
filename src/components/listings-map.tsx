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
  className = "",
}: {
  pins: MapPin[];
  onSearchArea?: (bbox: { south: number; west: number; north: number; east: number }) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);

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

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    for (const pin of pins) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = [
        "px-2 py-0.5 rounded-full text-xs font-medium border shadow-sm cursor-pointer",
        pin.isNearMiss
          ? "bg-flexible-soft text-flexible border-flexible/30"
          : "bg-white text-ink border-line-strong",
      ].join(" ");
      el.textContent = formatPrice(pin.priceCents, pin.pricePeriod).split(" / ")[0];
      el.setAttribute("aria-label", `${pin.title} — view listing`);
      el.onclick = () => { window.location.href = `/listing/${pin.id}`; };

      const marker = new maplibre.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(new maplibre.Popup({ offset: 12, closeButton: false })
          .setHTML(`<div style="font-size:13px;font-weight:500;max-width:180px">${escapeHtml(pin.title)}</div>`))
        .addTo(m);

      markers.current.push(marker);
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
