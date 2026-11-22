"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import BrandMark from "@/components/BrandMark";

export default function PasswordRecoveryPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setStatus("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirmation) { setStatus("Las contraseñas no coinciden."); return; }
    const client = createSupabaseBrowserClient();
    if (!client) { setStatus("Supabase no está configurado."); return; }
    setBusy(true); setStatus("");
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);
    setStatus(error ? error.message : "Contraseña actualizada. Ya puedes volver a iniciar sesión.");
  }

  return (
    <main className="auth-recovery-page">
      <section className="panel auth-recovery-card">
        <div className="brand auth-brand"><div className="brand-mark"><BrandMark size={28}/></div><div><b>BIOBUZZ</b><span>RECUPERACIÓN DE CUENTA</span></div></div>
        <h1>Crear contraseña nueva</h1>
        <form className="form-stack" onSubmit={updatePassword}>
          <label className="field"><span>Contraseña nueva</span><input type="password" required minLength={8} value={password} onChange={event=>setPassword(event.target.value)}/></label>
          <label className="field"><span>Confirmar contraseña</span><input type="password" required minLength={8} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>
          <button className="button button-primary" disabled={busy}>Actualizar contraseña</button>
          {status && <p role="status">{status}</p>}
        </form>
      </section>
    </main>
  );
}
