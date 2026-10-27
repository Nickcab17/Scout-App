"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, RefreshCw, Search } from "lucide-react";
import { OfficialEvent, OfficialMatch, mergeOfficialMatches } from "@/lib/first/normalize";

type Level = "qual" | "playoff";
type ScheduleCache = { matches: OfficialMatch[]; syncedAt: string; lastModified: string | null };
type Store = { selections: Record<string, { season: number; eventCode: string }>; schedules: Record<string, ScheduleCache> };
const KEY = "biobuzz-first-v1";
const emptyStore: Store = { selections: {}, schedules: {} };
const normalizeSeason = (year: number) => year === 2027 ? 2026 : year;
const scheduleKey = (season: number, code: string, level: Level) => `${season}:${code.toUpperCase()}:${level}`;
const teamList = (teams: { number: number; name: string | null }[]) => teams.length ? teams.map(team => `${team.number}${team.name ? ` · ${team.name}` : ""}`).join(" / ") : "Equipos no publicados";
const officialPoints = (value: number | null) => value === null ? "Pendiente" : String(value);
const dateText = (value: string | null) => {
  if (!value) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);
  if (!parts) return value;
  return `${parts[3]}/${parts[2]}/${parts[1]}${parts[4] ? ` · ${parts[4]} hora local del evento` : ""}`;
};
const syncText = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function OfficialEventsPanel({ workspaceId }: { workspaceId: string | null }) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [season, setSeason] = useState(2026);
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [eventsSeason, setEventsSeason] = useState<number | null>(null);
  const [eventCode, setEventCode] = useState("");
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<Level>("qual");
  const [busyEvents, setBusyEvents] = useState(false);
  const [busySchedule, setBusySchedule] = useState(false);
  const [message, setMessage] = useState("");
  const [selectionStatus, setSelectionStatus] = useState("");
  const scope = workspaceId ?? "local";
  const selectedEvent = eventsSeason === season ? events.find(event => event.code.toUpperCase() === eventCode.toUpperCase()) : undefined;
  const currentCache = store.schedules[scheduleKey(season, eventCode, level)];
  const visibleMatches = currentCache?.matches ?? [];
  const filteredEvents = useMemo(() => (eventsSeason === season ? events : []).filter(event => `${event.name} ${event.code} ${event.city ?? ""} ${event.stateProv ?? ""} ${event.venue ?? ""}`.toLowerCase().includes(search.toLowerCase())), [events, eventsSeason, search, season]);

  // localStorage is read after hydration so this page stays safe during static rendering.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Store>;
          const next = {
            selections: parsed.selections && typeof parsed.selections === "object" && !Array.isArray(parsed.selections) ? parsed.selections : {},
            schedules: parsed.schedules && typeof parsed.schedules === "object" && !Array.isArray(parsed.schedules) ? parsed.schedules : {},
          };
          setStore(next);
          const localSelection = next.selections[scope];
          if (localSelection) { setSeason(normalizeSeason(localSelection.season)); setEventCode(localSelection.eventCode); }
        }
      } catch { setMessage("No se pudo leer el historial local de eventos FIRST."); }
    }, 0);
    return () => clearTimeout(timer);
  }, [scope]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch { /* The current response remains in memory; a later browser write may succeed. */ }
  }, [store]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void fetch(`/api/first/selection?workspaceId=${encodeURIComponent(workspaceId)}`).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cargar la selección del grupo.");
      if (cancelled || !result.selection) return;
      const selectedSeason = normalizeSeason(result.selection.season);
      setSeason(selectedSeason); setEventCode(result.selection.eventCode);
      setStore(value => ({ ...value, selections: { ...value.selections, [scope]: { season: selectedSeason, eventCode: result.selection.eventCode } } }));
      setSelectionStatus("Selección sincronizada con este grupo.");
    }).catch(error => { if (!cancelled) setSelectionStatus(error instanceof Error ? error.message : "Selección guardada localmente."); });
    return () => { cancelled = true; };
  }, [workspaceId, scope]);

  const loadEvents = useCallback(async (refresh = false) => {
    setBusyEvents(true); setMessage("");
    try {
      const response = await fetch(`/api/first/events?season=${season}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible obtener eventos de FIRST.");
      setEvents(result.events ?? []);
      setEventsSeason(season);
      if (result.events?.length) setEventCode(current => result.events.some((event: OfficialEvent) => event.code.toUpperCase() === current.toUpperCase()) ? current : "");
      setMessage(result.warning ? `${result.warning} Última descarga correcta: ${syncText(result.syncedAt)}.` : result.events?.length ? `Consulta FIRST correcta · ${syncText(result.syncedAt)}${result.persisted ? " · caché oficial compartido" : " · caché local"}` : "FIRST no publicó eventos para esta temporada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo conectar con FIRST; conserva la última consulta correcta."); }
    finally { setBusyEvents(false); }
  }, [season]);

  useEffect(() => { const timer = setTimeout(() => void loadEvents(), 0); return () => clearTimeout(timer); }, [loadEvents]);

  function updateSelection(nextSeason: number, nextCode: string) {
    setSeason(nextSeason); setEventCode(nextCode); setMessage("");
    setStore(value => ({ ...value, selections: { ...value.selections, [scope]: { season: nextSeason, eventCode: nextCode } } }));
    if (workspaceId && nextCode) {
      void fetch("/api/first/selection", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, season: nextSeason, eventCode: nextCode }) })
        .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se pudo sincronizar la selección."); setSelectionStatus("Selección guardada para este grupo."); })
        .catch(error => setSelectionStatus(error instanceof Error ? `${error.message} Se conserva la selección local.` : "Selección guardada localmente."));
    } else setSelectionStatus("Selección guardada en este navegador.");
  }

  async function refreshSchedule() {
    if (!eventCode) return;
    setBusySchedule(true); setMessage("");
    const outcomes = await Promise.allSettled((["qual", "playoff"] as const).map(async tournamentLevel => {
      const response = await fetch(`/api/first/events/${encodeURIComponent(eventCode)}/schedule?season=${season}&level=${tournamentLevel}&refresh=1`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Falló la consulta ${tournamentLevel}.`);
      const key = scheduleKey(season, eventCode, tournamentLevel);
      setStore(value => {
        const old = value.schedules[key];
        const incoming = result.matches as OfficialMatch[];
        const matches = old ? mergeOfficialMatches(old.matches, incoming) : incoming;
        return { ...value, schedules: { ...value.schedules, [key]: { matches, syncedAt: result.syncedAt, lastModified: result.lastModified } } };
      });
      return { tournamentLevel, count: (result.matches as OfficialMatch[]).length, persisted: Boolean(result.persisted), warning: result.warning as string | null };
    }));
    const failures = outcomes.filter(outcome => outcome.status === "rejected");
    const successes = outcomes.filter(outcome => outcome.status === "fulfilled");
    if (failures.length) setMessage(`${failures.map(item => item.reason instanceof Error ? item.reason.message : "Error de consulta").join(" ")} Los datos de la última actualización correcta se mantienen.`);
    else if (successes.some(item => item.value.warning)) setMessage(`${successes.map(item => item.value.warning).filter(Boolean).join(" ")} Se conserva la última descarga correcta.`);
    else setMessage(`Calendario actualizado desde FIRST: ${successes.map(item => `${item.value.tournamentLevel} ${item.value.count}`).join(" · ")} partidos${successes.every(item => item.value.persisted) ? " · caché oficial compartido" : " · copia local disponible"}.`);
    setBusySchedule(false);
  }

  const lastUpdate = currentCache?.syncedAt ? syncText(currentCache.syncedAt) : null;
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> FIRST / DATOS OFICIALES</div><h1>Eventos oficiales</h1><p className="subheading">Eventos, calendario híbrido y resultados publicados por FIRST.</p></div><span className="count-chip">Temporada {season}</span></div>
    <section className="panel official-controls">
      <div className="official-filter-grid"><label className="field"><span className="field-label">Temporada</span><select value={season} onChange={event => { setSeason(Number(event.target.value)); setEventCode(""); }}><option value={2026}>BIOBUZZ 2026–2027 (temporada FIRST 2026)</option>{[2025, 2024, 2023].map(year => <option key={year} value={year}>{year - 1}–{year} (FIRST {year})</option>)}</select></label>
        <label className="field"><span className="field-label">Buscar evento oficial</span><span className="official-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, ubicación o código"/></span></label>
        <button className="button button-secondary" onClick={() => void loadEvents(true)} disabled={busyEvents}><RefreshCw size={15} className={busyEvents ? "spin" : ""}/> {busyEvents ? "Consultando FIRST…" : "Actualizar eventos"}</button>
      </div>
      <label className="field official-event-select"><span className="field-label">Evento oficial</span><select value={eventCode} onChange={event => updateSelection(season, event.target.value)} disabled={!filteredEvents.length}><option value="">{eventsSeason === season && events.length ? "Selecciona un evento recibido de FIRST" : "Carga los eventos de FIRST"}</option>{filteredEvents.map(event => <option key={event.id} value={event.code}>{event.name} · {event.code}{event.city ? ` · ${event.city}` : ""}</option>)}</select></label>
      {eventsSeason === season && events.length > 0 && filteredEvents.length === 0 && <p className="official-attribution">Ningún evento de esta temporada coincide con la búsqueda.</p>}
      {selectedEvent && <div className="official-event-card"><div className="official-event-icon"><CalendarDays size={19}/></div><div><b>{selectedEvent.name}</b><span>{[selectedEvent.code, selectedEvent.venue, selectedEvent.city, selectedEvent.stateProv, selectedEvent.country].filter(Boolean).join(" · ")}</span><span>{[selectedEvent.dateStart && dateText(selectedEvent.dateStart), selectedEvent.dateEnd && dateText(selectedEvent.dateEnd)].filter(Boolean).join(" – ") || "Fechas no incluidas en la respuesta de FIRST"}</span></div><span className="official-badge">OFICIAL · FIRST</span></div>}
      {eventCode && <div className="official-schedule-tools"><label className="field"><span className="field-label">Nivel de torneo</span><select value={level} onChange={event => setLevel(event.target.value as Level)}><option value="qual">Clasificación (qual)</option><option value="playoff">Eliminatorias (playoff)</option></select></label><button className="button button-primary" onClick={() => void refreshSchedule()} disabled={busySchedule}><RefreshCw size={15} className={busySchedule ? "spin" : ""}/> {busySchedule ? "Actualizando calendario…" : "Actualizar desde FIRST"}</button><span>{selectionStatus}</span></div>}
      {message && <div className="official-message" role="status">{message.includes("FIRST") || message.includes("fall") || message.includes("Fall") ? <AlertTriangle size={15}/> : <CalendarDays size={15}/>}<span>{message}</span></div>}
      <p className="official-attribution">Fuente: <a href="https://ftc-events.firstinspires.org/services/API" target="_blank" rel="noreferrer">FTC Events API de FIRST</a>. <a href="https://ftc-events.firstinspires.org/services/API/register" target="_blank" rel="noreferrer">Solicitar credenciales API</a>. FIRST publica resultados una vez que los eventos concluyen y sus sistemas sincronizan los datos; esta consulta no garantiza información en tiempo real.</p>
    </section>
    {eventCode && <section className="panel official-matches"><div className="panel-head"><div><h2>{selectedEvent?.name ?? `Evento ${eventCode}`}</h2><p>{level === "qual" ? "Partidos de clasificación" : "Partidos de eliminatorias"} · {visibleMatches.length} recibidos</p></div><span className="official-updated">Última consulta correcta: {lastUpdate ?? "aún no descargado"}</span></div>
      {!currentCache ? <div className="official-empty">Pulsa “Actualizar desde FIRST” para obtener el calendario y los resultados publicados.</div> : visibleMatches.length ? <div className="official-match-list">{visibleMatches.map(match => <article className="official-match" key={match.id}><div className="official-match-title"><b>{match.description || `${match.level.toUpperCase()} · Partido ${match.number}`}</b><span>{match.status === "played" ? "Disputado · resultado oficial" : match.status === "result_pending" ? "Iniciado · resultado pendiente de publicación" : "Programado · sin resultado"}</span><small>{dateText(match.actualStartTime ?? match.startTime) ?? "Hora no publicada"}</small></div><div className="official-alliance red"><b>ROJO</b><span>{teamList(match.redTeams)}</span><strong>{officialPoints(match.redFinal)}</strong></div><div className="official-alliance blue"><b>AZUL</b><span>{teamList(match.blueTeams)}</span><strong>{officialPoints(match.blueFinal)}</strong></div>{match.status === "played" && <div className="official-score-details"><span>AUTO Rojo: {officialPoints(match.redAuto)}</span><span>Faltas Rojo: {officialPoints(match.redFoul)}</span><span>AUTO Azul: {officialPoints(match.blueAuto)}</span><span>Faltas Azul: {officialPoints(match.blueFoul)}</span></div>}</article>)}</div> : <div className="official-empty">FIRST devolvió un calendario vacío para este nivel. No se creó ningún partido ni resultado.</div>}
    </section>}
  </>;
}
