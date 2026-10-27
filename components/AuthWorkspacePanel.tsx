"use client";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppData } from "@/lib/types";
import { readData, validateImport } from "@/lib/persistence";

type Workspace = { id: string; name: string; role: string };
type Member = { user_id: string; role: string };
type Counts = { teams: number; matches: number; observations: number };

export default function AuthWorkspacePanel({ visible, onWorkspaceReady, onLocalMode }: {
  visible: boolean;
  onWorkspaceReady: (id: string, data: AppData) => void;
  onLocalMode: () => void;
}) {
  const [configured, setConfigured] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [localCounts, setLocalCounts] = useState<Counts>({ teams: 0, matches: 0, observations: 0 });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteRole, setInviteRole] = useState<"scout" | "viewer">("scout");
  const [members, setMembers] = useState<Member[]>([]);
  const [importVerified, setImportVerified] = useState(false);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "La solicitud falló.");
    return result;
  }

  async function refresh() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data } = await client.auth.getUser();
    setUser(data.user?.email || "");
    if (data.user) {
      try {
        const result = await request("/api/workspaces");
        setWorkspaces(result.workspaces || []);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "No se pudieron cargar grupos.");
      }
    }
  }

  // Browser storage and Supabase auth are only available after hydration.
  useEffect(() => {
    const timer = setTimeout(() => {
      setConfigured(!!createSupabaseBrowserClient());
      const local = readData();
      setLocalCounts({ teams: local.teams.length, matches: local.matches.length, observations: local.observations.length });
      void refresh();
    }, 0);
    const client = createSupabaseBrowserClient();
    if (!client) return () => clearTimeout(timer);
    const { data: { subscription } } = client.auth.onAuthStateChange(() => setTimeout(() => void refresh(), 0));
    return () => { clearTimeout(timer); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function auth(event: FormEvent, mode: "sign_in" | "sign_up") {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setStatus("");
    try {
      const result = mode === "sign_up"
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setStatus(mode === "sign_up" && !result.data.session ? "Revisa tu correo para confirmar la cuenta." : "Sesión iniciada.");
      await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo autenticar."); }
    finally { setBusy(false); }
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await request("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) });
      setWorkspaces(old => [...old, result.workspace]); setName(""); setStatus("Grupo creado.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo crear el grupo."); }
    finally { setBusy(false); }
  }

  async function enterWorkspace(id: string) {
    setBusy(true); setStatus("Cargando datos del grupo…");
    try {
      const result = await request(`/api/workspaces/${id}/scouting`);
      const data = validateImport(result.data);
      setSelected(id); setImportVerified(false); onWorkspaceReady(id, data);
      const client = createSupabaseBrowserClient();
      if (client) {
        const { data: rows } = await client.from("workspace_members").select("user_id,role").eq("workspace_id", id);
        setMembers(rows || []);
      }
      setStatus("Datos del grupo cargados.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo abrir el grupo."); }
    finally { setBusy(false); }
  }

  async function makeInvite(event: FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    const group = workspaces.find(item => item.id === selected);
    if (!client || !group || group.role !== "admin") return;
    setBusy(true);
    try {
      const token = crypto.randomUUID() + crypto.randomUUID();
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
      const { data: { user: current } } = await client.auth.getUser();
      const { error } = await client.from("workspace_invites").insert({
        workspace_id: selected, email: inviteEmail.trim().toLowerCase(), role: inviteRole,
        token_hash: `\\x${hash}`, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_by: current?.id,
      });
      if (error) throw error;
      setInviteCode(token); setStatus("Invitación creada. Comparte el código con la persona invitada.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo crear la invitación."); }
    finally { setBusy(false); }
  }

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient(); if (!client) return;
    setBusy(true);
    try {
      const { data, error } = await client.rpc("accept_workspace_invite", { invite_token: inviteCode.trim() });
      if (error) throw error;
      await refresh(); setStatus(`Invitación aceptada para el grupo ${data}.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo aceptar la invitación."); }
    finally { setBusy(false); }
  }

  async function changeRole(userId: string, role: string) {
    const client = createSupabaseBrowserClient(); if (!client || !selected) return;
    const { error } = await client.from("workspace_members").update({ role }).eq("workspace_id", selected).eq("user_id", userId);
    if (error) { setStatus(error.message); return; }
    setMembers(rows => rows.map(row => row.user_id === userId ? { ...row, role } : row));
  }

  async function importLocal() {
    if (!selected) return;
    const local = readData();
    if (!confirm(`Importar ${local.teams.length} equipos, ${local.matches.length} partidos y ${local.observations.length} observaciones al grupo?`)) return;
    setBusy(true); setStatus("Importando y verificando…");
    try {
      const result = await request(`/api/workspaces/${selected}/import`, { method: "POST", body: JSON.stringify({ data: local }) });
      const refreshed = await request(`/api/workspaces/${selected}/scouting`);
      onWorkspaceReady(selected, validateImport(refreshed.data)); setImportVerified(true);
      setStatus(`Importación verificada: ${result.inserted.teams} equipos, ${result.inserted.matches} partidos y ${result.inserted.observations} observaciones nuevos.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Falló la importación; los datos locales se conservaron."); }
    finally { setBusy(false); }
  }

  function removeLocal() {
    if (!importVerified || !confirm("La importación fue verificada. ¿Eliminar la copia local de scouting de este navegador?")) return;
    localStorage.removeItem("biobuzz-scout-v1");
    setLocalCounts({ teams: 0, matches: 0, observations: 0 }); setStatus("Copia local de scouting eliminada.");
  }

  async function signOut() {
    const client = createSupabaseBrowserClient(); if (client) await client.auth.signOut();
    setUser(""); setWorkspaces([]); setSelected(""); onLocalMode(); setStatus("Sesión cerrada; se usa el almacenamiento local.");
  }

  if (!visible) return null;
  return <section className="panel workspace-panel">
    <div className="panel-head"><div><h2>Cuenta y espacio de trabajo</h2><p>Autenticación y persistencia por grupo</p></div></div>
    {!configured ? <div className="scoring-status"><b>Supabase no está configurado.</b><p>Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY, aplica la migración SQL y reinicia Next.js.</p></div>
      : !user ? <form className="form-stack" onSubmit={event => void auth(event, "sign_in")}>
        <label className="field"><span>Correo</span><input type="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
        <label className="field"><span>Contraseña</span><input type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)}/></label>
        <div className="form-foot"><span>Sin sesión, se mantienen los datos locales.</span><div>
          <button className="button button-secondary" disabled={busy} type="button" onClick={event => void auth(event, "sign_up")}>Crear cuenta</button>
          <button className="button button-primary" disabled={busy}>Iniciar sesión</button>
        </div></div>
      </form> : <>
        <p>Sesión: <b>{user}</b> <button className="text-button" onClick={() => void signOut()}>Cerrar sesión</button></p>
        <form className="form-foot" onSubmit={event => void createWorkspace(event)}><input aria-label="Nombre del grupo" placeholder="Nombre del grupo" value={name} onChange={event => setName(event.target.value)}/><button className="button button-secondary" disabled={busy}>Crear grupo</button></form>
        <div className="form-stack">{workspaces.map(group => <div key={group.id} className="team-row"><div className="row-main"><b>{group.name}</b><span>Rol: {group.role}</span></div><button className="button button-primary" disabled={busy} onClick={() => void enterWorkspace(group.id)}>Abrir</button></div>)}</div>
        {!workspaces.length && <p>Aún no perteneces a un grupo. Crea uno o acepta una invitación.</p>}
        <form className="form-foot" onSubmit={event => void acceptInvite(event)}><input aria-label="Código de invitación" placeholder="Código de invitación" value={inviteCode} onChange={event => setInviteCode(event.target.value)}/><button className="button button-secondary" disabled={busy}>Aceptar invitación</button></form>
        {selected && workspaces.find(group => group.id === selected)?.role === "admin" && <>
          <form className="form-foot" onSubmit={event => void makeInvite(event)}><input type="email" required aria-label="Correo de invitación" placeholder="Correo de la persona" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}/><select value={inviteRole} onChange={event => setInviteRole(event.target.value as "scout" | "viewer")}><option value="scout">Scout</option><option value="viewer">Solo lectura</option></select><button className="button button-secondary" disabled={busy}>Crear invitación</button></form>
          {inviteCode && <p>Código de un solo uso (7 días): <code>{inviteCode}</code></p>}
          <div className="form-stack"><b>Miembros</b>{members.map(member => <div className="team-row" key={member.user_id}><span className="row-main"><b>{member.user_id}</b></span><select aria-label={`Rol de ${member.user_id}`} value={member.role} onChange={event => void changeRole(member.user_id, event.target.value)}><option value="admin">Admin</option><option value="scout">Scout</option><option value="viewer">Solo lectura</option></select></div>)}</div>
        </>}
        {selected && <div className="scoring-status"><p>Datos locales pendientes: {localCounts.teams} equipos · {localCounts.matches} partidos · {localCounts.observations} observaciones.</p><button className="button button-secondary" disabled={busy} onClick={() => void importLocal()}>Importar y verificar</button>{importVerified && <button className="text-button" onClick={removeLocal}>Eliminar copia local verificada</button>}</div>}
      </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
