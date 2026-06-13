import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";
import { mapMarkerRadii, placeScaleLabels, riskLevelOrder } from "../domain/mapLegend";
import { riskColors, riskLabels } from "../domain/risk";
import type { MapMarker, PlaceScale, ResearchObject, ResultItem } from "../domain/types";

type PollutionSourceKind = "works" | "power" | "industrial" | "chimney";

interface PollutionSource {
  id: string;
  label: string;
  kind: PollutionSourceKind;
  latitude: number;
  longitude: number;
  tags: Record<string, string>;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

const sourceCache = new Map<string, PollutionSource[]>();

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function centerFromMarkers(markers: MapMarker[]) {
  const first = markers[0];
  return first ? ([first.latitude, first.longitude] as [number, number]) : ([49.0, 31.0] as [number, number]);
}

function fallbackPointName(latitude: number, longitude: number): string {
  return `Об'єкт ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function scaleFromZoom(zoom: number): PlaceScale {
  if (zoom >= 16) return "street";
  if (zoom >= 12) return "district";
  if (zoom >= 9) return "city";
  return "region";
}

function scaleLabel(scale: PlaceScale): string {
  return placeScaleLabels[scale];
}

function markerRadius(scale?: PlaceScale): number {
  return mapMarkerRadii[scale ?? "city"];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

function pollutionSourceKind(tags: Record<string, string>): PollutionSourceKind {
  if (tags.man_made === "chimney") return "chimney";
  if (tags.power === "plant" || tags.power === "generator") return "power";
  if (tags.landuse === "industrial" || tags.industrial) return "industrial";
  return "works";
}

function pollutionSourceKindLabel(kind: PollutionSourceKind): string {
  return {
    works: "виробничий об'єкт",
    power: "енергетичний об'єкт",
    industrial: "промислова зона",
    chimney: "димова труба"
  }[kind];
}

function pollutionSourceLabel(tags: Record<string, string>, kind: PollutionSourceKind): string {
  return tags["name:uk"] || tags.name || tags.operator || tags.brand || pollutionSourceKindLabel(kind);
}

function pollutionSourceIcon(kind: PollutionSourceKind): L.DivIcon {
  return L.divIcon({
    className: "pollution-source-leaflet-icon",
    html: `<span class="pollution-source-marker ${kind}" aria-hidden="true"><span></span></span>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28]
  });
}

function cacheKey(bounds: L.LatLngBounds, zoom: number): string {
  const south = Math.floor(bounds.getSouth() * 100) / 100;
  const west = Math.floor(bounds.getWest() * 100) / 100;
  const north = Math.ceil(bounds.getNorth() * 100) / 100;
  const east = Math.ceil(bounds.getEast() * 100) / 100;
  return `${Math.floor(zoom)}:${south},${west},${north},${east}`;
}

function overpassQuery(bounds: L.LatLngBounds): string {
  const bbox = [
    bounds.getSouth().toFixed(5),
    bounds.getWest().toFixed(5),
    bounds.getNorth().toFixed(5),
    bounds.getEast().toFixed(5)
  ].join(",");
  return `[out:json][timeout:12];
(
  nwr["man_made"="works"](${bbox});
  nwr["man_made"="chimney"](${bbox});
  nwr["power"="plant"](${bbox});
  nwr["power"="generator"](${bbox});
  nwr["landuse"="industrial"](${bbox});
  nwr["industrial"](${bbox});
);
out center qt 120;`;
}

async function fetchPollutionSources(bounds: L.LatLngBounds, zoom: number, signal: AbortSignal): Promise<PollutionSource[]> {
  const key = cacheKey(bounds, zoom);
  const cached = sourceCache.get(key);
  if (cached) return cached;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: overpassQuery(bounds),
    signal,
    headers: {
      "Content-Type": "text/plain;charset=UTF-8"
    }
  });
  if (!response.ok) throw new Error("Overpass request failed");

  const data = await response.json() as { elements?: OverpassElement[] };
  const sources = new Map<string, PollutionSource>();
  for (const element of data.elements ?? []) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const tags = element.tags ?? {};
    const kind = pollutionSourceKind(tags);
    sources.set(`${element.type}-${element.id}`, {
      id: `${element.type}-${element.id}`,
      label: pollutionSourceLabel(tags, kind),
      kind,
      latitude,
      longitude,
      tags
    });
  }

  const result = [...sources.values()].slice(0, 120);
  sourceCache.set(key, result);
  return result;
}

function renderPollutionSources(layer: L.LayerGroup, sources: PollutionSource[]) {
  layer.clearLayers();
  for (const source of sources) {
    const details = [
      source.tags.industrial && `industrial=${source.tags.industrial}`,
      source.tags.power && `power=${source.tags.power}`,
      source.tags.man_made && `man_made=${source.tags.man_made}`,
      source.tags.landuse && `landuse=${source.tags.landuse}`
    ].filter((item): item is string => Boolean(item)).map(escapeHtml).join("<br>");
    L.marker([source.latitude, source.longitude], {
      icon: pollutionSourceIcon(source.kind),
      keyboard: false,
      title: source.label
    }).bindPopup(
      `<strong>${escapeHtml(source.label)}</strong><br>${escapeHtml(pollutionSourceKindLabel(source.kind))}${details ? `<br><small>${details}</small>` : ""}<br><small>OpenStreetMap / Overpass</small>`
    ).addTo(layer);
  }
}

function addPollutionSourceOverlay(map: L.Map): { remove: () => void } {
  const layer = L.layerGroup().addTo(map);
  const control = new L.Control({ position: "topright" });
  let active = false;
  let status: HTMLSpanElement | undefined;
  let abortController: AbortController | undefined;
  let requestNumber = 0;

  const setStatus = (message: string) => {
    if (status) status.textContent = message;
  };

  const load = async () => {
    abortController?.abort();
    if (!active) {
      layer.clearLayers();
      setStatus("");
      return;
    }
    if (map.getZoom() < 9) {
      layer.clearLayers();
      setStatus("наблизьте мапу");
      return;
    }

    const currentRequest = ++requestNumber;
    abortController = new AbortController();
    setStatus("пошук...");
    try {
      const sources = await fetchPollutionSources(map.getBounds(), map.getZoom(), abortController.signal);
      if (currentRequest !== requestNumber) return;
      renderPollutionSources(layer, sources);
      setStatus(sources.length ? `${sources.length}` : "не знайдено");
    } catch {
      if (currentRequest !== requestNumber) return;
      layer.clearLayers();
      setStatus("недоступно");
    }
  };

  control.onAdd = () => {
    const root = L.DomUtil.create("label", "pollution-source-control");
    L.DomEvent.disableClickPropagation(root);
    L.DomEvent.disableScrollPropagation(root);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const title = document.createElement("span");
    title.textContent = "Джерела забруднення";
    status = document.createElement("small");

    root.append(checkbox, title, status);
    L.DomEvent.on(checkbox, "change", () => {
      active = checkbox.checked;
      void load();
    });
    return root;
  };

  control.addTo(map);
  map.on("moveend", load);

  return {
    remove: () => {
      abortController?.abort();
      map.off("moveend", load);
      control.remove();
      layer.remove();
    }
  };
}

function addMapLegend(map: L.Map, result: ResultItem): L.Control {
  const legend = new L.Control({ position: "bottomright" });
  legend.onAdd = () => {
    const root = L.DomUtil.create("div", "map-legend-control");
    L.DomEvent.disableClickPropagation(root);
    L.DomEvent.disableScrollPropagation(root);

    const title = document.createElement("strong");
    title.textContent = result.mapLegend;
    root.append(title);

    const riskList = document.createElement("div");
    riskList.className = "map-legend-list";
    for (const level of riskLevelOrder) {
      const item = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.className = "map-legend-color";
      swatch.style.background = riskColors[level];
      const label = document.createElement("span");
      label.textContent = riskLabels[level];
      item.append(swatch, label);
      riskList.append(item);
    }
    root.append(riskList);

    return root;
  };
  legend.addTo(map);
  return legend;
}

function pickAddressName(address: Record<string, string | undefined> | undefined, scale: PlaceScale, displayName?: string): string | undefined {
  if (!address) return displayName;
  if (scale === "street") return address.road || address.pedestrian || address.footway || address.neighbourhood || address.suburb || address.city || displayName;
  if (scale === "district") return address.city_district || address.district || address.suburb || address.borough || address.neighbourhood || address.county || address.city || displayName;
  if (scale === "city") return address.city || address.town || address.village || address.municipality || address.county || displayName;
  return address.state || address.region || address.province || address.county || address.country || displayName;
}

async function reverseGeocode(latitude: number, longitude: number, scale: PlaceScale): Promise<string | undefined> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", scale === "street" ? "18" : scale === "district" ? "13" : scale === "city" ? "10" : "7");
    url.searchParams.set("accept-language", "uk");
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const data = await response.json() as { display_name?: string; name?: string; address?: Record<string, string | undefined> };
    return pickAddressName(data.address, scale, data.name || data.display_name);
  } catch {
    return undefined;
  }
}

export function ResultMap({ result }: { result: ResultItem }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current).setView(centerFromMarkers(result.mapMarkers), result.mapMarkers.length ? 9 : 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);
    for (const point of result.mapMarkers) {
      L.circleMarker([point.latitude, point.longitude], {
        radius: markerRadius(point.scale),
        color: riskColors[point.riskLevel],
        fillColor: riskColors[point.riskLevel],
        fillOpacity: 0.72
      }).bindPopup(`${point.label}<br>${result.mapLegend}: ${point.value}`).addTo(map);
    }
    const legend = addMapLegend(map, result);
    const pollutionSources = addPollutionSourceOverlay(map);
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      pollutionSources.remove();
      legend.remove();
      map.remove();
    };
  }, [result]);

  return <div className="map-panel" ref={ref} />;
}

export function MapPicker({
  onPick,
  objects
}: {
  onPick: (coordinate: { latitude: number; longitude: number; title?: string; scale?: PlaceScale }) => void;
  objects: ResearchObject[];
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    const map = L.map(ref.current).setView([49.0, 31.0], 5);
    let pickedMarker: L.Marker | undefined;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);
    const pollutionSources = addPollutionSourceOverlay(map);
    for (const object of objects) {
      if (object.coordinate) {
        L.marker([object.coordinate.latitude, object.coordinate.longitude]).bindPopup(object.title).addTo(map);
      }
    }
    map.on("click", (event) => {
      const latitude = event.latlng.lat;
      const longitude = event.latlng.lng;
      const scale = scaleFromZoom(map.getZoom());
      const title = fallbackPointName(latitude, longitude);
      pickedMarker?.remove();
      pickedMarker = L.marker([latitude, longitude]).bindPopup(`${title}<br>${scaleLabel(scale)}`).addTo(map).openPopup();
      onPick({ latitude, longitude, title, scale });
      reverseGeocode(latitude, longitude, scale).then((name) => {
        if (disposed || !name) return;
        pickedMarker?.bindPopup(`${name}<br>${scaleLabel(scale)}`).openPopup();
        onPick({ latitude, longitude, title: name, scale });
      });
    });
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      disposed = true;
      pollutionSources.remove();
      map.remove();
    };
  }, [objects, onPick]);

  return <div className="map-panel map-picker" ref={ref} />;
}
