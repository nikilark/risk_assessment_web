import L from "leaflet";
import { riskLevelsForCategory } from "./mapLegend";
import { numberFormatter, riskColors, riskLabels } from "./risk";
import type { ResultItem } from "./types";

function wrapText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (let word of text.split(/\s+/)) {
    if (line && context.measureText(`${line} ${word}`).width > width) { lines.push(line); line = ""; }
    while (context.measureText(word).width > width) {
      let length = word.length - 1;
      while (length > 1 && context.measureText(word.slice(0, length)).width > width) length--;
      lines.push(word.slice(0, length)); word = word.slice(length);
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function loadTile(url: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      image.onload = image.onerror = null;
      if (error) { image.src = ""; reject(error); } else resolve(image);
    };
    const cancel = () => finish(new DOMException("Aborted", "AbortError"));
    const timeout = window.setTimeout(() => finish(new Error("Не вдалося завантажити мапу за 15 секунд. Перевірте інтернет і повторіть.")), 15000);
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Не вдалося завантажити підкладку мапи. Перевірте інтернет і повторіть."));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel(); else image.src = url;
  });
}

/** Render the selected data on the same Web Mercator tile grid used by Leaflet. */
export async function mapMarkersToPng(result: ResultItem, signal?: AbortSignal): Promise<string> {
  const formatNumber = numberFormatter(result.locale);
  if (!result.mapMarkers.length) throw new Error("Немає об’єктів із координатами для мапи.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не підтримує збереження мапи.");
    context.font = "700 28px Arial, sans-serif";
    const title = wrapText(context, result.title.split(" · Мапа:")[0], 1304);
    context.font = "20px Arial, sans-serif";
    const subtitle = wrapText(context, result.mapLegend.replace(/^Рівень ризику · /, ""), 1304);
    const plot = { x: 48, y: 48 + title.length * 36 + subtitle.length * 28 + 64, width: 1304, height: 660 };
    context.font = "18px Arial, sans-serif";
    const rows = result.mapMarkers.map((marker) => ({ marker, lines: wrapText(context, marker.label, 800) }));
    canvas.height = plot.y + plot.height + 94 + rows.reduce((height, row) => height + Math.max(54, row.lines.length * 25 + 20), 0) + 30;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = "top";
    context.fillStyle = "#1f2933";
    context.font = "700 28px Arial, sans-serif";
    title.forEach((line, index) => context.fillText(line, 48, 28 + index * 36));
    context.font = "20px Arial, sans-serif";
    context.fillStyle = "#52616f";
    subtitle.forEach((line, index) => context.fillText(line, 48, 36 + title.length * 36 + index * 28));
    const legendY = plot.y - 42;
    context.font = "18px Arial, sans-serif";
    let legendX = 48;
    for (const level of riskLevelsForCategory(result.category)) {
      context.fillStyle = riskColors[level];
      context.beginPath(); context.arc(legendX + 9, legendY + 10, 9, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#334e68";
      context.fillText(riskLabels[level], legendX + 25, legendY);
      legendX += 25 + context.measureText(riskLabels[level]).width + 34;
    }

    const markers = result.mapMarkers;
    const scale = markers[0].scale;
    let zoom = markers.length === 1 ? scale === "street" ? 14 : scale === "district" ? 12 : scale === "region" ? 9 : 10 : 16;
    const project = (latitude: number, longitude: number) => L.CRS.EPSG3857.latLngToPoint(L.latLng(latitude, longitude), zoom);
    let points = markers.map(marker => project(marker.latitude, marker.longitude));
    const extent = () => ({ minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
      minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)) });
    while (zoom > 1) {
      const bounds = extent();
      if (bounds.maxX - bounds.minX <= plot.width - 128 && bounds.maxY - bounds.minY <= plot.height - 128) break;
      zoom--;
      points = markers.map(marker => project(marker.latitude, marker.longitude));
    }
    const bounds = extent();
    const origin = L.point((bounds.minX + bounds.maxX - plot.width) / 2, (bounds.minY + bounds.maxY - plot.height) / 2);
    const tiles: { x: number; y: number; image?: HTMLImageElement }[] = [];
    for (let y = Math.floor(origin.y / 256); y <= Math.floor((origin.y + plot.height - 1) / 256); y++) {
      for (let x = Math.floor(origin.x / 256); x <= Math.floor((origin.x + plot.width - 1) / 256); x++) tiles.push({ x, y });
    }
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < tiles.length) {
        const tile = tiles[next++];
        const count = 2 ** zoom;
        if (tile.y < 0 || tile.y >= count) continue;
        tile.image = await loadTile(`https://tile.openstreetmap.org/${zoom}/${((tile.x % count) + count) % count}/${tile.y}.png`, controller.signal);
      }
    }));
    context.save();
    context.beginPath(); context.rect(plot.x, plot.y, plot.width, plot.height); context.clip();
    for (const tile of tiles) if (tile.image) context.drawImage(tile.image, plot.x + tile.x * 256 - origin.x, plot.y + tile.y * 256 - origin.y, 256, 256);

    const occupied: L.Point[] = [];
    const placements = points.map((point) => {
      const actual = L.point(plot.x + point.x - origin.x, plot.y + point.y - origin.y);
      let badge = actual;
      for (let attempt = 0; attempt < 500; attempt++) {
        const radius = attempt === 0 ? 0 : 36 * Math.ceil(attempt / 12);
        const angle = (attempt % 12) * Math.PI / 6;
        badge = L.point(Math.max(plot.x + 22, Math.min(plot.x + plot.width - 22, actual.x + Math.cos(angle) * radius)),
          Math.max(plot.y + 22, Math.min(plot.y + plot.height - 42, actual.y + Math.sin(angle) * radius)));
        if (occupied.every(other => other.distanceTo(badge) >= 42)) break;
      }
      occupied.push(badge);
      return { actual, badge };
    });
    placements.forEach(({ actual, badge }, index) => {
      const color = riskColors[markers[index].riskLevel];
      if (actual.distanceTo(badge) > 2) {
        context.strokeStyle = "#334e68"; context.lineWidth = 2;
        context.beginPath(); context.moveTo(actual.x, actual.y); context.lineTo(badge.x, badge.y); context.stroke();
        context.beginPath(); context.arc(actual.x, actual.y, 4, 0, Math.PI * 2); context.fillStyle = color; context.fill();
      }
    });
    placements.forEach(({ badge }, index) => {
      const color = riskColors[markers[index].riskLevel];
      context.beginPath(); context.arc(badge.x, badge.y, 18, 0, Math.PI * 2);
      context.fillStyle = color; context.fill(); context.strokeStyle = "#ffffff"; context.lineWidth = 3; context.stroke();
      context.font = "700 18px Arial, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
      context.lineWidth = 4; context.strokeStyle = "#ffffff"; context.strokeText(String(index + 1), badge.x, badge.y);
      context.fillStyle = "#1f2933"; context.fillText(String(index + 1), badge.x, badge.y);
    });
    context.restore();
    context.textAlign = "right"; context.textBaseline = "top"; context.font = "14px Arial, sans-serif";
    context.fillStyle = "rgba(255,255,255,0.92)"; context.fillRect(plot.x + plot.width - 390, plot.y + plot.height - 24, 390, 24);
    context.fillStyle = "#334e68"; context.fillText("© OpenStreetMap contributors · openstreetmap.org/copyright", plot.x + plot.width - 8, plot.y + plot.height - 19);
    context.textAlign = "left";
    context.font = "700 18px Arial, sans-serif";
    let rowY = plot.y + plot.height + 28;
    context.fillText("№", 58, rowY); context.fillText("Об’єкт", 112, rowY); context.fillText("Значення", 956, rowY); context.fillText("Рівень ризику", 1110, rowY);
    rowY += 36;
    rows.forEach(({ marker, lines }, index) => {
      const height = Math.max(54, lines.length * 25 + 20);
      context.fillStyle = index % 2 ? "#f3f5f7" : "#ffffff"; context.fillRect(48, rowY - 8, 1304, height);
      context.fillStyle = "#1f2933"; context.font = "18px Arial, sans-serif";
      context.fillText(String(index + 1), 58, rowY);
      lines.forEach((line, lineIndex) => context.fillText(line, 112, rowY + lineIndex * 25));
      context.fillText(formatNumber(marker.value), 956, rowY);
      context.fillStyle = riskColors[marker.riskLevel]; context.beginPath(); context.arc(1119, rowY + 10, 8, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#1f2933"; context.fillText(riskLabels[marker.riskLevel], 1140, rowY);
      rowY += height;
    });
    return canvas.toDataURL("image/png");
  } finally {
    controller.abort();
    signal?.removeEventListener("abort", cancel);
  }
}
