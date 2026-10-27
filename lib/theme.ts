export type ThemeColors = { primary: string; secondary: string; accent: string; background: string; surface: string; mode: "dark" | "light" };

export const defaultTheme: ThemeColors = { primary: "#f2b544", secondary: "#202833", accent: "#e8a928", background: "#10151b", surface: "#191f27", mode: "dark" };
export const palettes: { name: string; colors: ThemeColors }[] = [
  { name: "Honeycomb", colors: defaultTheme },
  { name: "Violet", colors: { primary: "#7047eb", secondary: "#282044", accent: "#ffb454", background: "#11101a", surface: "#1d1b29", mode: "dark" } },
  { name: "Midnight", colors: { primary: "#6678f5", secondary: "#232a42", accent: "#50d5e8", background: "#0d1120", surface: "#171d30", mode: "dark" } },
  { name: "Forest", colors: { primary: "#397758", secondary: "#20362c", accent: "#87bd75", background: "#111813", surface: "#1b251e", mode: "dark" } },
  { name: "Ocean", colors: { primary: "#267fba", secondary: "#203447", accent: "#55c5e8", background: "#0e171d", surface: "#18242d", mode: "dark" } },
  { name: "Minimal", colors: { primary: "#777777", secondary: "#333333", accent: "#d4d4d4", background: "#171717", surface: "#222222", mode: "dark" } },
];
export const themeStorageKey = "biobuzz-theme-v1";

export function isThemeColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== "object") return false;
  const colors = value as Record<string, unknown>;
  return ["primary", "secondary", "accent", "background", "surface"].every((key) => typeof colors[key] === "string" && /^#[\da-f]{6}$/i.test(colors[key] as string)) && (colors.mode === "dark" || colors.mode === "light");
}
