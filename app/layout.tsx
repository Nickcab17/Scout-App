import type { Metadata } from "next";
import "./globals.css";
import "./theme-overrides.css";
import "./accessibility.css";

export const metadata: Metadata = { title: "BIOBUZZ Scouting FTC", description: "Registro y análisis de observaciones de scouting FTC." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
