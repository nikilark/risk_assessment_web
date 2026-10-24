import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";
import { mapMarkerRadii, placeScaleLabels, riskLevelsForCategory } from "../domain/mapLegend";
import { riskColors, riskLabels } from "../domain/risk";
import type { MapMarker, PlaceScale, ResearchObject, ResultItem } from "../domain/types";

type PollutionSourceKind = "works" | "power" | "landfill" | "waste" | "wastewater";

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

const sourceCache = new Map<string, { sources: PollutionSource[]; expires: number }>();
const maxPollutionSources = 120;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function overpassBounds(bounds: L.LatLngBounds): L.LatLngBounds {
  const south = clamp(Math.min(bounds.getSouth(), bounds.getNorth()), -90, 90);
  const north = clamp(Math.max(bounds.getSouth(), bounds.getNorth()), -90, 90);
  const west = clamp(Math.min(bounds.getWest(), bounds.getEast()), -180, 180);
  const east = clamp(Math.max(bounds.getWest(), bounds.getEast()), -180, 180);
  return L.latLngBounds([south, west], [north, east]);
}

function roundedCacheBounds(bounds: L.LatLngBounds): L.LatLngBounds {
  const searchBounds = overpassBounds(bounds);
  const south = clamp(Math.floor(searchBounds.getSouth() * 100) / 100, -90, 90);
  const west = clamp(Math.floor(searchBounds.getWest() * 100) / 100, -180, 180);
  const north = clamp(Math.ceil(searchBounds.getNorth() * 100) / 100, -90, 90);
  const east = clamp(Math.ceil(searchBounds.getEast() * 100) / 100, -180, 180);
  return L.latLngBounds([south, west], [north, east]);
}

function sourceInBounds(source: PollutionSource, bounds: L.LatLngBounds): boolean {
  return bounds.contains([source.latitude, source.longitude]);
}

function visibleSources(sources: PollutionSource[], bounds: L.LatLngBounds): PollutionSource[] {
  const visibleBounds = overpassBounds(bounds);
  return sources.filter((source) => sourceInBounds(source, visibleBounds)).slice(0, maxPollutionSources);
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

const combustionSources = "coal|lignite|gas|oil|diesel|biomass|biogas|wood|waste|peat";
const combustionSourcePattern = new RegExp(`(^|;)(${combustionSources})(;|$)`);

function pollutionSourceKind(tags: Record<string, string>): PollutionSourceKind | undefined {
  if (tags.landuse === "landfill") return "landfill";
  if (tags.man_made === "wastewater_plant") return "wastewater";
  if (tags.amenity === "waste_transfer_station") return "waste";
  if (tags.man_made === "works") return "works";
  if (tags.power === "plant" && (combustionSourcePattern.test(tags["plant:source"] ?? "") || tags["plant:method"] === "combustion")) return "power";
  return undefined;
}

function pollutionSourceKindLabel(kind: PollutionSourceKind): string {
  return {
    works: "завод / виробниче підприємство",
    power: "паливна електростанція / ТЕЦ",
    landfill: "полігон відходів",
    waste: "сміттєперевантажувальна станція",
    wastewater: "очисні споруди"
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

function cacheKey(bounds: L.LatLngBounds): string {
  return `${bounds.getSouth().toFixed(2)},${bounds.getWest().toFixed(2)},${bounds.getNorth().toFixed(2)},${bounds.getEast().toFixed(2)}`;
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
  nwr["power"="plant"]["plant:source"~"(^|;)(${combustionSources})(;|$)"](${bbox});
  nwr["power"="plant"]["plant:method"="combustion"](${bbox});
  nwr["landuse"="landfill"](${bbox});
  nwr["man_made"="wastewater_plant"](${bbox});
  nwr["amenity"="waste_transfer_station"](${bbox});
);
out center qt ${maxPollutionSources * 3};`;
}

async function fetchPollutionSources(bounds: L.LatLngBounds, signal: AbortSignal): Promise<PollutionSource[]> {
  const viewBounds = overpassBounds(bounds);
  const searchBounds = roundedCacheBounds(viewBounds);
  const key = cacheKey(searchBounds);
  const cached = sourceCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.sources;

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 30000);
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: overpassQuery(searchBounds),
      signal: controller.signal,
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      }
    });
    if (response.status === 429) throw new Error("Сервіс обмежив запити. Спробуйте пізніше.");
    if (!response.ok) throw new Error(`Сервіс недоступний (HTTP ${response.status}).`);

    const data = await response.json() as { elements?: OverpassElement[]; remark?: string };
    if (!data || !Array.isArray(data.elements)) throw new Error("Сервіс повернув некоректну відповідь.");
    if (data.remark) throw new Error("Сервіс не завершив пошук. Наблизьте мапу або повторіть пізніше.");
    const sources = new Map<string, PollutionSource>();
    for (const element of data.elements ?? []) {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const tags = element.tags ?? {};
      const kind = pollutionSourceKind(tags);
      if (!kind) continue;
      const source = {
        id: `${element.type}-${element.id}`,
        label: pollutionSourceLabel(tags, kind),
        kind,
        latitude,
        longitude,
        tags
      };
      if (!sourceInBounds(source, searchBounds)) continue;
      sources.set(`${element.type}-${element.id}`, {
        ...source
      });
    }

    const result = [...sources.values()].slice(0, maxPollutionSources * 2);
    if (sourceCache.size >= 50) sourceCache.delete(sourceCache.keys().next().value!);
    sourceCache.set(key, { sources: result, expires: Date.now() + 5 * 60 * 1000 });
    return result;
  } catch (error) {
    if (timedOut) throw new Error("Сервіс не відповів за 30 секунд. Спробуйте пізніше.");
    if (error instanceof TypeError) throw new Error("Не вдалося з’єднатися із сервісом.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", cancel);
  }
}

function renderPollutionSources(layer: L.LayerGroup, sources: PollutionSource[]) {
  layer.clearLayers();
  for (const source of sources) {
    const details = [
      source.tags.industrial && `industrial=${source.tags.industrial}`,
      source.tags.power && `power=${source.tags.power}`,
      source.tags.man_made && `man_made=${source.tags.man_made}`,
      source.tags.landuse && `landuse=${source.tags.landuse}`,
      source.tags.amenity && `amenity=${source.tags.amenity}`,
      source.tags["plant:source"] && `plant:source=${source.tags["plant:source"]}`
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

function addPollutionSourceOverlay(map: L.Map, selection: { current: boolean }): { remove: () => void } {
  const layer = L.layerGroup().addTo(map);
  const control = new L.Control({ position: "topright" });
  let active = selection.current;
  let status: HTMLElement;
  let checkbox: HTMLInputElement;
  let retry: HTMLButtonElement;
  let abortController: AbortController | undefined;
  let requestNumber = 0;
  let debounce: number | undefined;
  let lastSources: PollutionSource[] = [];

  const setStatus = (message: string) => {
    status.textContent = message;
    status.hidden = !message;
  };

  const unavailableReason = () => {
    if (!navigator.onLine) return "Потрібне з’єднання з інтернетом.";
    const bounds = roundedCacheBounds(map.getBounds());
    const width = bounds.getEast() - bounds.getWest();
    const height = bounds.getNorth() - bounds.getSouth();
    const area = width * height * 111 * 111 * Math.cos(map.getCenter().lat * Math.PI / 180);
    if (map.getZoom() < 11 || area > 1200) return "Наблизьте мапу для пошуку джерел.";
    return "";
  };

  const load = async () => {
    const currentRequest = ++requestNumber;
    abortController?.abort();
    retry.hidden = true;
    const reason = unavailableReason();
    checkbox.disabled = Boolean(reason);
    if (reason || !active) {
      layer.clearLayers();
      setStatus(reason);
      return;
    }
    const controller = new AbortController();
    abortController = controller;
    renderPollutionSources(layer, visibleSources(lastSources, map.getBounds()));
    setStatus("Пошук…");
    try {
      const sources = await fetchPollutionSources(map.getBounds(), controller.signal);
      if (currentRequest !== requestNumber || controller.signal.aborted) return;
      lastSources = sources;
      const visible = visibleSources(sources, map.getBounds());
      renderPollutionSources(layer, visible);
      setStatus(visible.length ? `${visible.length}` : "У цій області джерел в OSM не знайдено.");
    } catch (error) {
      if (currentRequest !== requestNumber || controller.signal.aborted) return;
      setStatus(error instanceof Error ? error.message : "Сервіс недоступний.");
      retry.hidden = false;
    }
  };

  const scheduleLoad = () => {
    ++requestNumber;
    abortController?.abort();
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 350);
  };

  control.onAdd = () => {
    const root = L.DomUtil.create("div", "pollution-source-control");
    L.DomEvent.disableClickPropagation(root);
    L.DomEvent.disableScrollPropagation(root);
    const label = document.createElement("label");
    label.className = "pollution-source-toggle";
    checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = active;
    const title = document.createElement("span");
    title.textContent = "Джерела забруднення";
    status = document.createElement("small");
    status.setAttribute("role", "status");
    retry = document.createElement("button");
    retry.type = "button";
    retry.className = "pollution-source-retry";
    retry.textContent = "Повторити";
    retry.hidden = true;
    label.append(checkbox, title);
    root.append(label, status, retry);
    L.DomEvent.on(checkbox, "change", () => {
      active = checkbox.checked;
      selection.current = active;
      window.clearTimeout(debounce);
      void load();
    });
    L.DomEvent.on(retry, "click", () => { window.clearTimeout(debounce); void load(); });
    return root;
  };

  control.addTo(map);
  void load();
  map.on("moveend", scheduleLoad);
  window.addEventListener("online", scheduleLoad);
  window.addEventListener("offline", scheduleLoad);

  return {
    remove: () => {
      ++requestNumber;
      window.clearTimeout(debounce);
      abortController?.abort();
      map.off("moveend", scheduleLoad);
      window.removeEventListener("online", scheduleLoad);
      window.removeEventListener("offline", scheduleLoad);
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
    title.textContent = "Рівень ризику";
    root.append(title);

    const riskList = document.createElement("div");
    riskList.className = "map-legend-list";
    for (const level of riskLevelsForCategory(result.category)) {
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

function fitMapToMarkers(map: L.Map, markers: MapMarker[]) {
  if (!markers.length) {
    map.setView([49.0, 31.0], 5);
    return;
  }
  if (markers.length === 1) {
    const marker = markers[0];
    const zoom = marker.scale === "street" ? 14 : marker.scale === "district" ? 12 : marker.scale === "region" ? 9 : 10;
    map.setView([marker.latitude, marker.longitude], zoom);
    return;
  }
  const bounds = L.latLngBounds(markers.map((marker) => [marker.latitude, marker.longitude] as [number, number]));
  map.fitBounds(bounds, { maxZoom: 12, padding: [42, 42] });
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
  const sourceSelection = useRef(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);
    fitMapToMarkers(map, result.mapMarkers);
    for (const point of result.mapMarkers) {
      L.circleMarker([point.latitude, point.longitude], {
        radius: markerRadius(point.scale),
        color: riskColors[point.riskLevel],
        fillColor: riskColors[point.riskLevel],
        fillOpacity: 0.72
      }).bindPopup(`${point.label}<br>${result.mapLegend}: ${point.value}`).addTo(map);
    }
    const legend = addMapLegend(map, result);
    const pollutionSources = addPollutionSourceOverlay(map, sourceSelection);
    const sizeObserver = new ResizeObserver(() => map.invalidateSize());
    sizeObserver.observe(ref.current);
    setTimeout(() => {
      map.invalidateSize();
      fitMapToMarkers(map, result.mapMarkers);
    }, 0);
    return () => {
      sizeObserver.disconnect();
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
  const sourceSelection = useRef(false);
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
    const pollutionSources = addPollutionSourceOverlay(map, sourceSelection);
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
    const sizeObserver = new ResizeObserver(() => map.invalidateSize());
    sizeObserver.observe(ref.current);
    return () => {
      sizeObserver.disconnect();
      disposed = true;
      pollutionSources.remove();
      map.remove();
    };
  }, [objects, onPick]);

  return <div className="map-panel map-picker" ref={ref} />;
}
