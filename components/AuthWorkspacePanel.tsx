"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppData } from "@/lib/types";
import { readData, validateImport } from "@/lib/persistence";
import { signOutSupabase } from "@/lib/supabase/browser-auth";
import { ACTIVE_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces/constants";

type Workspace = { id: string; name: string; role: string };
type Member = { user_id: string; display_name: string | null; role: string };
type Counts = { teams: number; matches: number; observations: number };

export default function AuthWorkspacePanel({ visible, onWorkspaceReady, onLocalMode, required = false }: {
  visible: boolean;
  onWorkspaceReady: (id: string, data: AppData, role: string, workspaceName: string) => void;
  onLocalMode: () => void;
  required?: boolean;
}) {
  const [configured, setConfigured] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<"sign_in"|"sign_up"|"forgot">("sign_in");
  const [user, setUser] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
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
  const createInFlight = useRef(false);

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "La solicitud falló.");
    return result;
  }

  async function refresh() {
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data } = await client.auth.getUser();
    setUser(data.user?.email || "");
    if (data.user) {
      const { data: profile } = await client.from("profiles").select("display_name").eq("id", data.user.id).maybeSingle();
      setDisplayName(profile?.display_name || String(data.user.user_metadata?.display_name || ""));
      try {
        const result = await request("/api/workspaces");
        setWorkspaces(result.workspaces || []);
        const remembered = localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
        if (remembered && result.workspaces?.some((workspace: Workspace) => workspace.id === remembered)) setSelected(remembered);
        else if (remembered) { localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY); setSelected(""); }
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
    if (mode === "sign_up" && displayName.trim().length < 2) { setStatus("Ingresa tu nombre."); return; }
    if (mode === "sign_up" && password !== confirmPassword) { setStatus("Las contraseñas no coinciden."); return; }
    setBusy(true); setStatus("");
    try {
      const result = mode === "sign_up"
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback`, data: { display_name: displayName.trim() } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setStatus(mode === "sign_up" && !result.data.session ? "Revisa tu correo para confirmar la cuenta." : "Sesión iniciada.");
      await refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo autenticar."); }
    finally { setBusy(false); }
  }

  async function sendRecovery(event: FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setStatus("");
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/auth/recovery` });
      if (error) throw error;
      setStatus("Revisa tu correo. BioBuzz te enviará un enlace seguro para establecer una contraseña nueva.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo enviar la recuperación."); }
    finally { setBusy(false); }
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault();
    if (createInFlight.current) return;
    createInFlight.current = true;
    setBusy(true); setStatus("");
    try {
      const result = await request("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) });
      const workspace = result.workspace as Workspace;
      setWorkspaces(old => [...old.filter(group => group.id !== workspace.id), workspace]);
      setName("");
      const opened = await enterWorkspace(workspace.id, workspace);
      setStatus(opened ? "Grupo creado. Ya tienes rol Admin y el grupo está activo." : "Grupo creado con rol Admin, pero no se pudieron cargar sus datos. Intenta abrirlo de nuevo.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo crear el grupo."); }
    finally { createInFlight.current = false; setBusy(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const { data: { user: current }, error: userError } = await client.auth.getUser();
    if (userError || !current) { setStatus("Tu sesión ya no es válida. Inicia sesión de nuevo."); return; }
    const normalizedName = displayName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 100) { setStatus("El nombre debe tener entre 2 y 100 caracteres."); return; }
    setProfileSaving(true);
    const { error } = await client.from("profiles").update({ display_name: normalizedName, updated_at: new Date().toISOString() }).eq("id", current.id);
    setProfileSaving(false);
    setStatus(error ? "No se pudo guardar el perfil. Comprueba la migración de perfiles." : "Perfil actualizado.");
  }

  async function enterWorkspace(id: string, workspaceOverride?: Workspace): Promise<boolean> {
    setBusy(true); setStatus("Cargando datos del grupo…");
    try {
      const result = await request(`/api/workspaces/${id}/scouting`);
      const data = validateImport(result.data);
      const workspace = workspaceOverride ?? workspaces.find(group => group.id === id);
      setSelected(id); setImportVerified(false); localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id); onWorkspaceReady(id, data, workspace?.role || "", workspace?.name || "");
      window.dispatchEvent(new CustomEvent("biobuzz:workspace-selected", { detail: { id, data, role: workspace?.role || "", name: workspace?.name || "" } }));
      if (workspace?.role === "admin") {
        const result = await request(`/api/workspaces/${id}/members`);
        setMembers(result.members || []);
      } else setMembers([]);
      setStatus("Datos del grupo cargados.");
      return true;
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo abrir el grupo."); return false; }
    finally { setBusy(false); }
  }

  async function makeInvite(event: FormEvent) {
    event.preventDefault();
    const group = workspaces.find(item => item.id === selected);
    if (!group || group.role !== "admin" || busy) return;
    setBusy(true); setStatus("");
    try {
      const result = await request(`/api/workspaces/${selected}/invites`, { method: "POST", body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      setInviteCode(result.token); setStatus("Invitación creada. Comparte el código con la persona invitada.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo crear la invitación."); }
    finally { setBusy(false); }
  }

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setStatus("");
    try {
      const accepted = await request("/api/workspaces/invites/accept", { method: "POST", body: JSON.stringify({ token: inviteCode }) });
      const result = await request("/api/workspaces");
      const groups = result.workspaces as Workspace[];
      setWorkspaces(groups);
      const workspace = groups.find(group => group.id === accepted.workspaceId);
      if (!workspace) throw new Error("La invitación se aceptó, pero no se encontró una membresía válida para abrir el grupo.");
      const opened = await enterWorkspace(workspace.id, workspace);
      setInviteCode(""); setStatus(opened ? `Invitación aceptada. El grupo ${workspace.name} está activo con rol ${workspace.role}.` : "Invitación aceptada, pero no se pudieron cargar los datos del grupo. Intenta abrirlo de nuevo.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo aceptar la invitación."); }
    finally { setBusy(false); }
  }

  async function changeRole(userId: string, role: string) {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const result = await request(`/api/workspaces/${selected}/members`, { method: "PATCH", body: JSON.stringify({ userId, role }) });
      setMembers(rows => rows.map(row => row.user_id === userId ? { ...row, role: result.member.role } : row));
      setStatus("Rol actualizado.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo cambiar el rol."); }
    finally { setBusy(false); }
  }
  async function importLocal() {
    if (!selected) return;
    const local = readData();
    if (!confirm(`Importar ${local.teams.length} equipos, ${local.matches.length} partidos y ${local.observations.length} observaciones al grupo?`)) return;
    setBusy(true); setStatus("Importando y verificando…");
    try {
      const result = await request(`/api/workspaces/${selected}/import`, { method: "POST", body: JSON.stringify({ data: local }) });
      const refreshed = await request(`/api/workspaces/${selected}/scouting`);
      const workspace = workspaces.find(group => group.id === selected);
      onWorkspaceReady(selected, validateImport(refreshed.data), workspace?.role || "", workspace?.name || ""); setImportVerified(true);
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
    setBusy(true);
    try {
      await signOutSupabase();
      setUser(""); setWorkspaces([]); setSelected(""); onLocalMode();
      window.location.replace("/login");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo cerrar la sesión.");
    } finally { setBusy(false); }
  }

  if (!visible) return null;
  return <section className="panel workspace-panel">
    <div className="panel-head"><div><h2>{required ? "Acceso a BioBuzz" : "Cuenta y espacio de trabajo"}</h2><p>{required ? "Autenticación y membresía obligatorias" : "Autenticación y persistencia por grupo"}</p></div></div>
    {!configured ? <div className="scoring-status"><b>Supabase no está configurado.</b><p>Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno del servidor para habilitar el inicio de sesión. No se permite continuar en modo local.</p></div>
      : !user ? <>
        {authMode === "forgot" ? <form className="form-stack" onSubmit={sendRecovery}>
          <div className="auth-form-heading"><b>Recuperar contraseña</b><span>Ingresa tu correo para recibir un enlace seguro de Supabase.</span></div>
          <label className="field"><span>Correo electrónico</span><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="scout@ejemplo.com"/></label>
          <div className="form-foot"><button className="text-button" type="button" onClick={()=>setAuthMode("sign_in")}>Volver a iniciar sesión</button><button className="button button-primary" disabled={busy}>Enviar enlace</button></div>
        </form> : <form className="form-stack" onSubmit={event => void auth(event, authMode)}>
          {authMode === "sign_up" && <label className="field"><span>Nombre</span><input required minLength={2} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Nombre del scout"/></label>}
          <label className="field"><span>Correo electrónico</span><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="scout@ejemplo.com"/></label>
          <label className="field"><span>Contraseña</span><input type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)}/></label>
          {authMode === "sign_up" && <label className="field"><span>Confirmar contraseña</span><input type="password" required minLength={8} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></label>}
          <div className="form-foot">
            <div className="auth-links">{authMode === "sign_in" ? <><button className="text-button" type="button" onClick={()=>setAuthMode("sign_up")}>Crear cuenta</button><button className="text-button" type="button" onClick={()=>setAuthMode("forgot")}>¿Olvidaste tu contraseña?</button></> : <button className="text-button" type="button" onClick={()=>setAuthMode("sign_in")}>Ya tengo una cuenta</button>}</div>
            <button className="button button-primary" disabled={busy}>{authMode === "sign_up" ? "Crear cuenta" : "Iniciar sesión"}</button>
          </div>
        </form>}
      </> : <>
        <section className="account-profile" aria-labelledby="profile-heading">
          <div className="panel-head"><div><h3 id="profile-heading">Mi perfil</h3><p>Datos personales de esta cuenta</p></div></div>
          <form className="form-stack" onSubmit={event => void saveProfile(event)}>
            <label className="field"><span>Nombre</span><input value={displayName} minLength={2} maxLength={100} required onChange={event => setDisplayName(event.target.value)}/></label>
            <div className="profile-readonly"><span>Correo</span><b>{user}</b></div>
            <div className="profile-readonly"><span>Rol en el workspace seleccionado</span><b>{workspaces.find(group => group.id === selected)?.role ?? "Sin workspace seleccionado"}</b></div>
            <div className="profile-readonly"><span>Workspace</span><b>{workspaces.find(group => group.id === selected)?.name ?? "Sin workspace"}</b></div>
            <div className="form-foot"><button className="button button-secondary" disabled={profileSaving}>{profileSaving ? "Guardando…" : "Guardar perfil"}</button><button className="text-button" type="button" onClick={() => void signOut()}>Cerrar sesión</button></div>
          </form>
        </section>
        <form className="form-foot" onSubmit={event => void createWorkspace(event)}><input aria-label="Nombre del grupo" placeholder="Nombre del grupo" value={name} onChange={event => setName(event.target.value)}/><button className="button button-secondary" disabled={busy}>Crear grupo</button></form>
        <div className="form-stack">{workspaces.map(group => <div key={group.id} className="team-row"><div className="row-main"><b>{group.name}</b><span>Rol: {group.role}</span></div><button className="button button-primary" disabled={busy} onClick={() => void enterWorkspace(group.id)}>Abrir</button></div>)}</div>
        {!workspaces.length && <p>Aún no perteneces a un grupo. Crea uno o acepta una invitación. No se concede acceso hasta que exista una membresía válida.</p>}
        <form className="form-foot" onSubmit={event => void acceptInvite(event)}><input aria-label="Código de invitación" placeholder="Código de invitación" value={inviteCode} onChange={event => setInviteCode(event.target.value)}/><button className="button button-secondary" disabled={busy}>Aceptar invitación</button></form>
        {selected && workspaces.find(group => group.id === selected)?.role === "admin" && <>
          <form className="form-foot" onSubmit={event => void makeInvite(event)}><input type="email" required aria-label="Correo de invitación" placeholder="Correo de la persona" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)}/><select value={inviteRole} onChange={event => setInviteRole(event.target.value as "scout" | "viewer")}><option value="scout">Scout</option><option value="viewer">Solo lectura</option></select><button className="button button-secondary" disabled={busy}>Crear invitación</button></form>
          {inviteCode && <p>Código de un solo uso (7 días): <code>{inviteCode}</code></p>}
          <div className="form-stack"><b>Miembros</b>{members.map(member => <div className="team-row" key={member.user_id}><span className="row-main"><b>{member.display_name?.trim() || "Usuario sin nombre"}</b><span>{member.role === "admin" ? "Admin" : member.role === "scout" ? "Scout" : "Solo lectura"}</span></span><select aria-label={`Rol de ${member.display_name?.trim() || "Usuario sin nombre"}`} value={member.role} onChange={event => void changeRole(member.user_id, event.target.value)}><option value="admin">Admin</option><option value="scout">Scout</option><option value="viewer">Solo lectura</option></select></div>)}</div>
        </>}
        {selected && <div className="scoring-status"><p>Datos locales pendientes: {localCounts.teams} equipos · {localCounts.matches} partidos · {localCounts.observations} observaciones.</p><button className="button button-secondary" disabled={busy} onClick={() => void importLocal()}>Importar y verificar</button>{importVerified && <button className="text-button" onClick={removeLocal}>Eliminar copia local verificada</button>}</div>}
      </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
