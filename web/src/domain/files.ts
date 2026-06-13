import { allResultsToTsv, resultToTsv } from "./results";
import type { ProjectFile, ResultItem } from "./types";

export function safeFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*]+/g, "_") || "project";
}

export function downloadText(fileName: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(fileName: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}

export function exportProject(project: ProjectFile) {
  downloadText(`${safeFileName(project.project.title)}.json`, JSON.stringify(project, null, 2), "application/json;charset=utf-8");
}

export function exportResult(result: ResultItem) {
  downloadText(`${safeFileName(result.title)}.tsv`, resultToTsv(result), "text/tab-separated-values;charset=utf-8");
}

export function exportAllResults(project: ProjectFile, results: ResultItem[]) {
  downloadText(`${safeFileName(project.project.title)}_results.tsv`, allResultsToTsv(results), "text/tab-separated-values;charset=utf-8");
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function readJsonFile<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не вдалося прочитати файл."));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch {
        reject(new Error("Файл не є коректним JSON."));
      }
    };
    reader.readAsText(file);
  });
}
