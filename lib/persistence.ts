import { AppData, emptyData } from "./types";
import { validateImportData } from "./import-validation";
const KEY = "biobuzz-scout-v1";
export function readData(): AppData {
  try { const raw = localStorage.getItem(KEY); if (!raw) return emptyData; const parsed = JSON.parse(raw); if (!parsed || !Array.isArray(parsed.teams) || !Array.isArray(parsed.matches) || !Array.isArray(parsed.observations)) return emptyData; return parsed as AppData; } catch { return emptyData; }
}
export function writeData(data: AppData) { localStorage.setItem(KEY, JSON.stringify(data)); }
export function exportData(data: AppData) { return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...data }, null, 2); }
export const validateImport = validateImportData;
