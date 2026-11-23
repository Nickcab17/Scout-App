"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthWorkspacePanel from "@/components/AuthWorkspacePanel";
import BrandMark from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ACTIVE_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces/constants";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void client.auth.getUser().then(({ data, error }) => {
      if (active && !error && data.user && localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)) {
        router.replace("/");
      }
    });
    return () => { active = false; };
  }, [router]);

  return <main className="login-page">
    <div className="login-shell">
      <header className="login-brand">
        <div className="brand-mark"><BrandMark size={30}/></div>
        <div><b>BIOBUZZ</b><span>SCOUTING · FTC 2026–2027</span></div>
      </header>
      <section className="login-intro">
        <div className="eyebrow"><span className="eyebrow-line"/> ACCESO SEGURO</div>
        <h1>Inicia sesión para continuar</h1>
        <p>Accede a BioBuzz con tu cuenta y una membresía válida de espacio de trabajo.</p>
      </section>
      <AuthWorkspacePanel
        visible
        required
        onWorkspaceReady={(id) => {
          localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
          router.replace("/");
        }}
        onLocalMode={() => router.replace("/login")}
      />
    </div>
  </main>;
}
