"use client";
import { useEffect, useState } from "react";
import { RotateCcw, SwatchBook } from "lucide-react";
import { defaultTheme, isThemeColors, palettes, ThemeColors, themeStorageKey } from "@/lib/theme";

const labels: { key: keyof Omit<ThemeColors, "mode">; label: string }[] = [
  { key: "primary", label: "Color principal" }, { key: "secondary", label: "Color secundario" },
  { key: "accent", label: "Acento" }, { key: "background", label: "Fondo" }, { key: "surface", label: "Tarjetas y paneles" },
];

function foregroundColor(hex: string) {
  const channels = hex.slice(1).match(/../g)?.map((part) => parseInt(part, 16) / 255) ?? [0, 0, 0];
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] > 0.179 ? "#171717" : "#ffffff";
}

export function applyTheme(theme: ThemeColors) {
  const root = document.documentElement;
  root.dataset.theme = theme.mode;
  root.style.setProperty("--bg", theme.mode === "dark" ? theme.background : "#f4f6f8");
  root.style.setProperty("--surface", theme.mode === "dark" ? theme.surface : "#ffffff");
  root.style.setProperty("--surface-2", theme.mode === "dark" ? theme.secondary : "#edf0f4");
  root.style.setProperty("--surface-3", theme.mode === "dark" ? theme.secondary : "#e5e9ef");
  root.style.setProperty("--sidebar", theme.mode === "dark" ? theme.background : "#e9edf2");
  root.style.setProperty("--text", theme.mode === "dark" ? foregroundColor(theme.background) : "#202833");
  root.style.setProperty("--muted", theme.mode === "dark" ? "#a9b4c2" : "#596574");
  root.style.setProperty("--subtle", theme.mode === "dark" ? "#8a98aa" : "#687484");
  root.style.setProperty("--border", theme.mode === "dark" ? "#344154" : "#d4dae2");
  root.style.setProperty("--border-soft", theme.mode === "dark" ? "#283445" : "#e0e4e9");
  root.style.setProperty("--blue", theme.accent);
  root.style.setProperty("--blue-bright", theme.mode === "light" ? "#245f9e" : theme.primary);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--button-text", foregroundColor(theme.accent));
  root.style.colorScheme = theme.mode;
}

export default function AppearanceSettings() {
  const [theme, setTheme] = useState<ThemeColors>(defaultTheme);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(themeStorageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isThemeColors(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTheme(parsed);
        }
      }
    } catch { setSaved(false); }
  }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  function update(next: ThemeColors) {
    setTheme(next);
    try { localStorage.setItem(themeStorageKey, JSON.stringify(next)); setSaved(true); }
    catch { setSaved(false); }
  }

  return <section className="panel appearance-panel">
    <div className="panel-head"><div><h2>Apariencia</h2><p>Personaliza los colores de este navegador</p></div><SwatchBook size={17} className="head-icon"/></div>
    <div className="palette-grid" aria-label="Paletas prediseñadas">{palettes.map((palette) => <button type="button" key={palette.name} className="palette-option" aria-pressed={labels.every(({ key }) => theme[key] === palette.colors[key])} onClick={() => update({ ...palette.colors, mode: theme.mode })}>
      <span className="palette-swatches" aria-hidden="true">{[palette.colors.primary, palette.colors.secondary, palette.colors.accent, palette.colors.background].map((color, i) => <i key={i} style={{ backgroundColor: color }}/>)}</span><b>{palette.name}</b>
    </button>)}</div>
    <div className="appearance-preview" style={{ backgroundColor: theme.mode === "light" ? "#f4f6f8" : theme.background, borderColor: theme.primary }}><div><span style={{ backgroundColor: theme.primary }}/><span style={{ backgroundColor: theme.accent }}/></div><strong>Vista previa</strong><span>Texto legible sobre tarjetas</span><button type="button" style={{ backgroundColor: theme.accent, color: foregroundColor(theme.accent) }}>Acción</button></div>
    <div className="theme-mode"><b>Tema</b><div role="group" aria-label="Tema de color"><button type="button" aria-pressed={theme.mode === "light"} className={theme.mode === "light" ? "selected" : ""} onClick={() => update({ ...theme, mode: "light" })}>Claro</button><button type="button" aria-pressed={theme.mode === "dark"} className={theme.mode === "dark" ? "selected" : ""} onClick={() => update({ ...theme, mode: "dark" })}>Oscuro</button></div></div>
    <div className="color-controls">{labels.map(({ key, label }) => <label key={key} className="color-control"><span>{label}</span><input type="color" value={theme[key]} aria-label={label} onChange={(e) => update({ ...theme, [key]: e.target.value })}/><code>{theme[key].toUpperCase()}</code></label>)}</div>
    <div className="appearance-footer"><span role="status">{saved ? "Preferencia guardada en este navegador" : "No se pudo guardar la preferencia local"}</span><button type="button" className="button button-secondary" onClick={() => update(defaultTheme)}><RotateCcw size={14}/> Restaurar predeterminados</button></div>
    <p className="appearance-note">La apariencia se guarda en este navegador; no se sincroniza entre dispositivos.</p>
  </section>;
}
