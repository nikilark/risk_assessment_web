import { mapExportMarkerRadii, placeScaleLabels, riskLevelOrder } from "./mapLegend";
import { formatNumber, riskColors, riskLabels } from "./risk";
import type { MapMarker, PlaceScale, ResultItem } from "./types";

function markerScale(marker: MapMarker): PlaceScale {
  return marker.scale ?? "city";
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 3 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

export function mapMarkersToPng(result: ResultItem): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  if (!context) return "";

  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#1f2933";
  context.font = "700 34px Arial, sans-serif";
  context.fillText(fitText(context, result.title, 1220), 72, 56);
  context.font = "18px Arial, sans-serif";
  context.fillStyle = "#5f6b7a";
  context.fillText(result.mapLegend, 72, 88);

  const plot = { x: 72, y: 138, width: 1256, height: 610 };
  context.fillStyle = "#ffffff";
  context.fillRect(plot.x, plot.y, plot.width, plot.height);
  context.strokeStyle = "#cfd8dc";
  context.lineWidth = 2;
  context.strokeRect(plot.x, plot.y, plot.width, plot.height);

  context.strokeStyle = "#edf1f3";
  context.lineWidth = 1;
  for (let index = 1; index < 6; index += 1) {
    const x = plot.x + (plot.width / 6) * index;
    const y = plot.y + (plot.height / 6) * index;
    context.beginPath();
    context.moveTo(x, plot.y);
    context.lineTo(x, plot.y + plot.height);
    context.moveTo(plot.x, y);
    context.lineTo(plot.x + plot.width, y);
    context.stroke();
  }

  const latitudes = result.mapMarkers.map((marker) => marker.latitude);
  const longitudes = result.mapMarkers.map((marker) => marker.longitude);
  let minLatitude = Math.min(...latitudes);
  let maxLatitude = Math.max(...latitudes);
  let minLongitude = Math.min(...longitudes);
  let maxLongitude = Math.max(...longitudes);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * 0.08, 0.005);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * 0.08, 0.005);
  minLatitude -= latitudePadding;
  maxLatitude += latitudePadding;
  minLongitude -= longitudePadding;
  maxLongitude += longitudePadding;
  const latitudeRange = maxLatitude - minLatitude || 1;
  const longitudeRange = maxLongitude - minLongitude || 1;
  const pointPosition = (marker: MapMarker) => ({
    x: plot.x + ((marker.longitude - minLongitude) / longitudeRange) * plot.width,
    y: plot.y + ((maxLatitude - marker.latitude) / latitudeRange) * plot.height
  });

  for (const marker of [...result.mapMarkers].sort((a, b) => mapExportMarkerRadii[markerScale(b)] - mapExportMarkerRadii[markerScale(a)])) {
    const position = pointPosition(marker);
    const radius = mapExportMarkerRadii[markerScale(marker)];
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fillStyle = riskColors[marker.riskLevel];
    context.fill();
    context.lineWidth = 4;
    context.strokeStyle = "#ffffff";
    context.stroke();
  }

  for (const marker of result.mapMarkers) {
    const position = pointPosition(marker);
    const radius = mapExportMarkerRadii[markerScale(marker)];
    const alignRight = position.x > plot.x + plot.width * 0.66;
    const labelX = position.x + (alignRight ? -radius - 12 : radius + 12);
    const maxLabelWidth = alignRight ? Math.max(140, labelX - plot.x - 18) : Math.max(140, plot.x + plot.width - labelX - 18);
    context.font = "700 17px Arial, sans-serif";
    const label = fitText(context, marker.label, Math.min(340, maxLabelWidth));
    context.font = "16px Arial, sans-serif";
    const detail = fitText(context, `${formatNumber(marker.value)} · ${riskLabels[marker.riskLevel]} · ${placeScaleLabels[markerScale(marker)]}`, Math.min(340, maxLabelWidth));
    const boxWidth = Math.max(context.measureText(label).width, context.measureText(detail).width) + 18;
    const boxX = alignRight ? labelX - boxWidth + 8 : labelX - 8;

    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    context.fillRect(boxX, position.y - 26, boxWidth, 49);
    context.textAlign = alignRight ? "right" : "left";
    context.fillStyle = "#1f2933";
    context.font = "700 17px Arial, sans-serif";
    context.fillText(label, labelX, position.y - 7);
    context.fillStyle = "#5f6b7a";
    context.font = "16px Arial, sans-serif";
    context.fillText(detail, labelX, position.y + 15);
    context.textAlign = "left";
  }

  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#334e68";
  context.fillText("Рівень ризику", 72, 795);
  let legendX = 72;
  for (const level of riskLevelOrder) {
    context.beginPath();
    context.arc(legendX + 8, 826, 8, 0, Math.PI * 2);
    context.fillStyle = riskColors[level];
    context.fill();
    context.fillStyle = "#334e68";
    context.fillText(riskLabels[level], legendX + 22, 831);
    legendX += 142;
  }

  context.font = "14px Arial, sans-serif";
  context.fillStyle = "#7b8794";
  context.fillText("PNG-схема мапи працює офлайн: координати збережені у проекті, кольори відповідають рівню ризику.", 72, 870);

  return canvas.toDataURL("image/png");
}

