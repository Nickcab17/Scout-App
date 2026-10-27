"use client";
import { useEffect } from "react";
import { applyTheme } from "@/components/AppearanceSettings";
import { defaultTheme, isThemeColors, themeStorageKey } from "@/lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(themeStorageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        applyTheme(isThemeColors(saved) ? saved : defaultTheme);
      } else applyTheme(defaultTheme);
    } catch {
      applyTheme(defaultTheme);
    }
  }, []);
  return null;
}
