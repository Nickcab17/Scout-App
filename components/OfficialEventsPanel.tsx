"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, RefreshCw, Search } from "lucide-react";
import { OfficialEvent, OfficialMatch, mergeOfficialMatches, normalizeHybridSchedule } from "@/lib/first/normalize";
import { normalizeOfficialTeams, previewTeamImport, type OfficialTeam, type TeamImportPreview } from "@/lib/first/team-import";
import { readData } from "@/lib/persistence";
import { readActiveFirstEvent, type ActiveFirstEvent } from "@/lib/first/active-event";
import { FIRST_SEASON, isSupportedFirstSeason } from "@/lib/first/season";
import { classifyEventWeeks, type EventWeekGroup } from "@/lib/first/event-weeks";

type Level = "qual" | "playoff";
type ScheduleCache = { matches: OfficialMatch[]; syncedAt: string; lastModified: string | null; scoreDetails?: unknown[] };
type Store = { selections: Record<string, { season: number; eventCode: string }>; schedules: Record<string, ScheduleCache> };
const KEY = "biobuzz-first-v1";
const emptyStore: Store = { selections: {}, schedules: {} };
const scheduleKey = (season: number, code: string, level: Level) => `${season}:${code.toUpperCase()}:${level}`;
const teamList = (teams?: { number: number; name: string | null }[]) => Array.isArray(teams) && teams.length ? teams.map(team => `${team.number}${team.name ? ` · ${team.name}` : ""}`).join(" / ") : "Equipos no publicados";
const officialPoints = (value: number | null | undefined) => value == null ? "Pendiente" : String(value);
const dateText = (value: string | null) => {
  if (!value) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(value);
  if (!parts) return value;
  return `${parts[3]}/${parts[2]}/${parts[1]}${parts[4] ? ` · ${parts[4]} hora local del evento` : ""}`;
};
const syncText = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const eventTypeLabel = (event: OfficialEvent) => {
  const type = event.type || "Tipo no especificado";
  if (/regional/i.test(type)) return type;
  return /regional/i.test(event.name) ? `Regional · ${type}` : type;
};

function EventWeekList({ groups, activeEvent, selectedCodes, onToggle, disabled }: {
  groups: EventWeekGroup[];
  activeEvent: ActiveFirstEvent | null;
  selectedCodes: string[];
  onToggle: (eventCode: string, selected: boolean) => void;
  disabled: boolean;
}) {
  return <div className="official-event-weeks">{groups.map(group => <details key={group.key} className="official-event-week" open={group.key === "week-1"}>
    <summary><span>{group.title}</span><span className="count-chip">{group.events.length}</span></summary>
    {group.events.length ? <div className="official-event-list">{group.events.map(event => <article className="official-event-row" key={event.id}>
      <div><b>{event.name}</b><span>{event.code} · {eventTypeLabel(event)}{event.dateStart ? ` · ${event.dateStart}${event.dateEnd && event.dateEnd !== event.dateStart ? `–${event.dateEnd}` : ""}` : " · Sin fecha publicada"}{event.city ? ` · ${event.city}` : ""}{event.stateProv ? ` · ${event.stateProv}` : ""}{event.country ? ` · ${event.country}` : ""}</span></div>
      <div className="official-event-row-actions">
        {activeEvent?.eventCode.toUpperCase() === event.code.toUpperCase() && <span className="official-badge">ACTIVO</span>}
        <label className="official-event-choice"><input type="checkbox" aria-label={`Seleccionar ${event.name}`} checked={selectedCodes.includes(event.code.toUpperCase())} disabled={disabled} onChange={change => onToggle(event.code, change.target.checked)}/><span>Seleccionar</span></label>
      </div>
    </article>)}</div> : <p className="official-empty">No hay eventos para esta semana con la búsqueda actual.</p>}
  </details>)}</div>;
}

function OfficialMatchCard({ match, scoreDetails }: { match: OfficialMatch; scoreDetails?: unknown[] }) {
  const details = scoreDetails?.filter(item => item && typeof item === "object" && Number((item as Record<string, unknown>).matchNumber) === match.number) ?? [];
  return <article className="official-match" key={match.id}>
    <div className="official-match-title"><b>{match.description || `${match.level.toUpperCase()} · Partido ${match.number}`}</b><span>{match.status === "played" ? "Disputado · resultado oficial FIRST" : match.status === "result_pending" ? "Iniciado · resultado pendiente de publicación" : "Programado · sin resultado oficial"}</span><small>{dateText(match.actualStartTime ?? match.startTime) ?? "Hora no publicada"}</small></div>
    <div className="official-alliance red"><b>ROJO</b><span>{teamList(match.redTeams)}</span><strong>{officialPoints(match.redFinal)}</strong></div>
    <div className="official-alliance blue"><b>AZUL</b><span>{teamList(match.blueTeams)}</span><strong>{officialPoints(match.blueFinal)}</strong></div>
    {match.status === "played" && <div className="official-score-details"><span>AUTO Rojo: {officialPoints(match.redAuto)}</span><span>TELEOP Rojo: {officialPoints(match.redDriveControlled)}</span><span>Faltas Rojo: {officialPoints(match.redFoul)}</span><span>Endgame Rojo: {officialPoints(match.redEndgame)}</span><span>AUTO Azul: {officialPoints(match.blueAuto)}</span><span>TELEOP Azul: {officialPoints(match.blueDriveControlled)}</span><span>Faltas Azul: {officialPoints(match.blueFoul)}</span><span>Endgame Azul: {officialPoints(match.blueEndgame)}</span></div>}
    {details.length > 0 && <details className="official-score-details"><summary>Detalles de scoring publicados por FIRST</summary><pre>{JSON.stringify(details, null, 2)}</pre></details>}
  </article>;
}

export default function OfficialEventsPanel({ mode = "schedule", activeEvent, onActiveEventChange, workspaceId, workspaceRole }: {
  mode?: "events" | "schedule" | "results";
  activeEvent: ActiveFirstEvent | null;
  onActiveEventChange: (selection: ActiveFirstEvent) => void;
  workspaceId: string;
  workspaceRole: string;
}) {
  const [store, setStore] = useState<Store>(emptyStore);
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [season, setSeason] = useState(FIRST_SEASON);
  const [maxSeason, setMaxSeason] = useState(FIRST_SEASON);
  const [seasonReady, setSeasonReady] = useState(false);
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [eventDetail, setEventDetail] = useState<{ code: string; season: number; event: OfficialEvent } | null>(null);
  const [eventTeams, setEventTeams] = useState<Record<string, unknown>[]>([]);
  const [eventTeamsCode, setEventTeamsCode] = useState("");
  const [importPreview, setImportPreview] = useState<TeamImportPreview[]>([]);
  const [selectedImportNumbers, setSelectedImportNumbers] = useState<number[]>([]);
  const [importSummary, setImportSummary] = useState("");
  const [eventPage, setEventPage] = useState(0);
  const [eventsSeason, setEventsSeason] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ code: string; currentEventCode: string }>({ code: "", currentEventCode: "" });
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<Level>("qual");
  const [busyEvents, setBusyEvents] = useState(false);
  const [busySchedule, setBusySchedule] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRegionalCodes, setSelectedRegionalCodes] = useState<string[]>([]);
  const [loadedRegionalSelectionScope, setLoadedRegionalSelectionScope] = useState("");
  const [regionalSelectionsLoadFailed, setRegionalSelectionsLoadFailed] = useState(false);
  const [regionalSelectionsSaving, setRegionalSelectionsSaving] = useState(false);
  const [regionalSelectionsMessage, setRegionalSelectionsMessage] = useState("");
  const regionalSelectionSaveInFlight = useRef(false);
  const scheduleRequest = useRef(0);
  const selectionStatus = regionalSelectionsMessage || (selectedRegionalCodes.length === 1
    ? "1 regional seleccionado y guardado en este grupo."
    : `${selectedRegionalCodes.length} regionales seleccionados y guardados en este grupo.`);
  const scope = "local";
  const regionalSelectionScope = `${workspaceId}:${season}`;
  const regionalSelectionsLoaded = loadedRegionalSelectionScope === regionalSelectionScope;
  const eventCode = activeEvent?.season === season ? activeEvent.eventCode : "";
  const pendingEventCode = pendingSelection.currentEventCode === eventCode ? pendingSelection.code : "";
  const currentEventTeams = eventTeamsCode === eventCode ? eventTeams : [];
  const selectedEvent = eventDetail?.season === season && eventDetail.code === eventCode.toUpperCase() ? eventDetail.event : eventsSeason === season ? events.find(event => event.code.toUpperCase() === eventCode.toUpperCase()) : undefined;
  const currentCache = store.schedules[scheduleKey(season, eventCode, level)];
  const scopedMatches = currentCache?.matches.filter(match => match.level === level && match.id.startsWith(`${season}:${eventCode.toUpperCase()}:${level}:`)) ?? [];
  const scheduleMatches = Array.from(new Map(scopedMatches.map(match => [match.id, match])).values());
  const officialResults = scheduleMatches.filter(match => match.status === "played");
  const visibleMatches = scheduleMatches;
  const filteredEvents = useMemo(() => (eventsSeason === season ? events : []).filter(event => `${event.name} ${event.code} ${event.type ?? ""} ${event.city ?? ""} ${event.stateProv ?? ""} ${event.country ?? ""} ${event.venue ?? ""}`.toLowerCase().includes(search.toLowerCase())), [events, eventsSeason, search, season]);
  const pageSize = 60;
  const visibleEvents = filteredEvents.slice(eventPage * pageSize, (eventPage + 1) * pageSize);

  useEffect(() => {
    if (!workspaceId || !isSupportedFirstSeason(season)) return;
    let cancelled = false;
    const selectionScope = `${workspaceId}:${season}`;
    const timer = setTimeout(() => {
      setRegionalSelectionsLoadFailed(false);
      setSelectedRegionalCodes([]);
      setRegionalSelectionsMessage("");
      void fetch(`/api/first/selection/events?workspaceId=${encodeURIComponent(workspaceId)}&season=${season}`, { cache: "no-store" }).then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudieron cargar las selecciones del grupo.");
        if (!cancelled) setSelectedRegionalCodes(Array.isArray(result.eventCodes) ? result.eventCodes : []);
      }).catch(error => {
        if (!cancelled) {
          setRegionalSelectionsLoadFailed(true);
          setRegionalSelectionsMessage(error instanceof Error ? error.message : "No se pudieron cargar las selecciones del grupo.");
        }
      }).finally(() => { if (!cancelled) setLoadedRegionalSelectionScope(selectionScope); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [workspaceId, season]);

  async function toggleRegionalSelection(code: string, checked: boolean) {
    if (regionalSelectionSaveInFlight.current || !regionalSelectionsLoaded || regionalSelectionsLoadFailed || workspaceRole === "viewer") return;
    regionalSelectionSaveInFlight.current = true;
    const previous = selectedRegionalCodes;
    const next = checked
      ? [...new Set([...previous, code.toUpperCase()])]
      : previous.filter(value => value !== code.toUpperCase());
    setSelectedRegionalCodes(next);
    setRegionalSelectionsSaving(true);
    setRegionalSelectionsMessage("");
    try {
      const response = await fetch("/api/first/selection/events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, season, eventCodes: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron guardar las selecciones del grupo.");
      setRegionalSelectionsMessage("");
    } catch (error) {
      setSelectedRegionalCodes(previous);
      setRegionalSelectionsMessage(error instanceof Error ? error.message : "No se pudieron guardar las selecciones del grupo.");
    } finally { regionalSelectionSaveInFlight.current = false; setRegionalSelectionsSaving(false); }
  }

  useEffect(() => {
    if (!eventCode) return;
    let cancelled = false;
    void fetch(`/api/first/events/${encodeURIComponent(eventCode)}?season=${season}`, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!cancelled && response.ok && result.event) setEventDetail({ code: eventCode.toUpperCase(), season, event: result.event as OfficialEvent });
    }).catch(() => { /* Keep metadata from the season listing if the detail request fails. */ });
    return () => { cancelled = true; };
  }, [eventCode, season]);

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
        }
      } catch { setMessage("No se pudo leer el historial local de eventos FIRST."); }
      finally { setStoreLoaded(true); }
    }, 0);
    return () => clearTimeout(timer);
  }, [scope]);

  useEffect(() => {
    if (!storeLoaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch { /* The current response remains in memory; a later browser write may succeed. */ }
  }, [store, storeLoaded]);

  const loadEvents = useCallback(async (refresh = false) => {
    setBusyEvents(true); setMessage("");
    try {
      const requestedSeason = season;
      const response = await fetch(`/api/first/events?season=${requestedSeason}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible obtener eventos de FIRST.");
      const currentSeasonEvents = Array.isArray(result.events) ? result.events.filter((event: OfficialEvent & { season?: number; seasonYear?: number; seasonCode?: number | string }) => {
        const suppliedSeason = event.season ?? event.seasonYear ?? event.seasonCode;
        const parsedSeason = typeof suppliedSeason === "number" ? suppliedSeason : typeof suppliedSeason === "string" ? Number(suppliedSeason) : null;
        return parsedSeason === null || !Number.isFinite(parsedSeason) || parsedSeason === requestedSeason;
      }) : [];
      setEvents(currentSeasonEvents);
      setEventsSeason(requestedSeason);
      setMessage(result.warning ? `${result.warning} Última descarga correcta: ${syncText(result.syncedAt)}.` : currentSeasonEvents.length ? `Consulta FIRST correcta · ${currentSeasonEvents.length} eventos en ${result.pageTotal ?? 1} páginas · ${syncText(result.syncedAt)}${result.persisted ? " · caché oficial compartido" : " · caché local"}` : "FIRST no publicó eventos para esta temporada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo conectar con FIRST; conserva la última consulta correcta."); }
    finally { setBusyEvents(false); }
  }, [season]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/first/seasons", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      const latest = Number(result.maxSeason ?? result.currentSeason);
      if (!cancelled && response.ok && Number.isInteger(latest) && latest >= 2000) {
        setMaxSeason(latest);
        setSeason(latest);
      }
    }).catch(() => { /* Keep the current season fallback when FIRST's index is unavailable. */ })
      .finally(() => { if (!cancelled) setSeasonReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!seasonReady) return;
    const timer = setTimeout(() => void loadEvents(), 0);
    return () => clearTimeout(timer);
  }, [loadEvents, seasonReady]);

  function confirmSelection(nextCode: string) {
    if (!nextCode) return;
    const selected = events.find(event => event.code.toUpperCase() === nextCode.toUpperCase());
    if (!selected || eventsSeason !== season) {
      setMessage(`Selecciona un evento recibido de FIRST para la temporada ${season}–${season + 1}.`);
      return;
    }
    const selection: ActiveFirstEvent = { season, eventCode: nextCode.toUpperCase(), eventId: selected.id, eventName: selected.name };
    onActiveEventChange(selection);
    setMessage(`Evento activo confirmado: ${selected?.name ?? selection.eventCode}.`);
    setStore(value => ({ ...value, selections: { ...value.selections, [scope]: { season: selection.season, eventCode: selection.eventCode } } }));
  }

  useEffect(() => {
    if (!eventCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEventTeams([]);
      setEventTeamsCode("");
      return;
    }
    let cancelled = false;
    void fetch(`/api/first/events/${encodeURIComponent(eventCode)}/teams?season=${season}`, { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (!cancelled && response.ok) {
        const teams = normalizeOfficialTeams(payload);
        setEventTeamsCode(eventCode.toUpperCase());
        setEventTeams(teams.map(team => ({ teamNumber: team.number, nameFull: team.name })) as Record<string, unknown>[]);
        if (teams.length) window.dispatchEvent(new CustomEvent("biobuzz:import-first-teams", {
          detail: { teams, season, eventCode: eventCode.toUpperCase(), selectedNumbers: teams.map(team => team.number) },
        }));
      }
      else if (!cancelled) { setEventTeams([]); setEventTeamsCode(""); }
    }).catch(() => { if (!cancelled) setEventTeams([]); });
    return () => { cancelled = true; };
  }, [eventCode, season]);

  function openTeamImportPreview() {
    if (!eventCode || !currentEventTeams.length) return;
    const teams: OfficialTeam[] = normalizeOfficialTeams({ teams: currentEventTeams.map(team => ({ teamNumber: team.teamNumber, nameFull: team.nameFull })) });
    const preview = previewTeamImport(readData(), teams, season, eventCode);
    setImportPreview(preview);
    setSelectedImportNumbers(preview.map(team => team.number));
    setImportSummary("");
  }

  function confirmTeamImport() {
    if (!eventCode || !importPreview.length) return;
    const teams: OfficialTeam[] = normalizeOfficialTeams({ teams: currentEventTeams.map(team => ({ teamNumber: team.teamNumber, nameFull: team.nameFull })) });
    window.dispatchEvent(new CustomEvent("biobuzz:import-first-teams", {
      detail: { teams, season, eventCode, selectedNumbers: selectedImportNumbers },
    }));
    const preview = previewTeamImport(readData(), teams, season, eventCode);
    const selected = new Set(selectedImportNumbers);
    const newTeams = preview.filter(team => selected.has(team.number) && team.state === "new").length;
    const updated = preview.filter(team => selected.has(team.number) && team.state === "updated").length;
    const existing = preview.filter(team => selected.has(team.number) && team.state === "existing").length;
    setImportSummary(`${newTeams} nuevos · ${updated} actualizados · ${existing} ya existían`);
    setImportPreview([]);
  }

  async function refreshSchedule(refresh = false) {
    if (!eventCode) return;
    const thisRequest = ++scheduleRequest.current;
    const requestedSeason = season;
    const requestedEventCode = eventCode.toUpperCase();
    setBusySchedule(true); setMessage("");
    const outcomes = await Promise.allSettled((["qual", "playoff"] as const).map(async tournamentLevel => {
      const responses = await Promise.all([
        fetch(`/api/first/events/${encodeURIComponent(eventCode)}/schedule?season=${requestedSeason}&level=${tournamentLevel}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/first/events/${encodeURIComponent(eventCode)}/results/${tournamentLevel}?season=${requestedSeason}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/first/events/${encodeURIComponent(eventCode)}/scores/${tournamentLevel}?season=${requestedSeason}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
      ]);
        const [result, results, scores] = await Promise.all(responses.map(response => response.json()));
      if (!responses[0].ok) throw new Error(result.error || `Falló la consulta ${tournamentLevel}.`);
      const key = scheduleKey(season, eventCode, tournamentLevel);
      setStore(value => {
        const active = readActiveFirstEvent();
        if (!active || active.season !== requestedSeason || active.eventCode !== requestedEventCode) return value;
        const old = value.schedules[key];
        let matches = (result.matches as OfficialMatch[]).filter(match => match.level === tournamentLevel && match.id.startsWith(`${requestedSeason}:${requestedEventCode}:${tournamentLevel}:`));
        if (responses[1].ok && Array.isArray(results.matches)) matches = mergeOfficialMatches(matches, normalizeHybridSchedule({ schedule: results.matches }, season, eventCode, tournamentLevel));
        if (old) matches = mergeOfficialMatches(old.matches.filter(match => match.level === tournamentLevel && match.id.startsWith(`${requestedSeason}:${requestedEventCode}:${tournamentLevel}:`)), matches);
        return { ...value, schedules: { ...value.schedules, [key]: { matches, syncedAt: result.syncedAt, lastModified: result.lastModified, scoreDetails: responses[2].ok ? scores.scoreDetails : old?.scoreDetails } } };
      });
      return { tournamentLevel, count: (result.matches as OfficialMatch[]).length, persisted: Boolean(result.persisted), warning: result.warning as string | null, scoreWarning: responses[2].ok ? null : scores.error as string | undefined };
    }));
    const active = readActiveFirstEvent();
    if (thisRequest !== scheduleRequest.current || !active || active.season !== requestedSeason || active.eventCode !== requestedEventCode) {
      if (thisRequest === scheduleRequest.current) setBusySchedule(false);
      return;
    }
    const failures = outcomes.filter(outcome => outcome.status === "rejected");
    const successes = outcomes.filter(outcome => outcome.status === "fulfilled");
    if (failures.length) setMessage(`${failures.map(item => item.reason instanceof Error ? item.reason.message : "Error de consulta").join(" ")} Los datos de la última actualización correcta se mantienen.`);
    else if (successes.some(item => item.value.warning || item.value.scoreWarning)) setMessage(`${successes.map(item => item.value.warning || item.value.scoreWarning).filter(Boolean).join(" ")} Se conserva la última descarga correcta.`);
    else setMessage(`Calendario actualizado desde FIRST: ${successes.map(item => `${item.value.tournamentLevel} ${item.value.count}`).join(" · ")} partidos${successes.every(item => item.value.persisted) ? " · caché oficial compartido" : " · copia local disponible"}.`);
    if (thisRequest === scheduleRequest.current) setBusySchedule(false);
  }

  useEffect(() => {
    if (!eventCode) return;
    const active = readActiveFirstEvent();
    if (active && (active.season !== season || active.eventCode !== eventCode.toUpperCase())) return;
    if (!currentCache) {
      const timer = setTimeout(() => void refreshSchedule(), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode, season, currentCache]);

  const lastUpdate = currentCache?.syncedAt ? syncText(currentCache.syncedAt) : null;
  const listedEvents = useMemo(() => {
    const items = eventsSeason === season ? [...events] : [];
    if (activeEvent?.season === season && !items.some(event => event.code.toUpperCase() === activeEvent.eventCode.toUpperCase())) {
      items.unshift({
        id: activeEvent.eventId ?? `${season}:${activeEvent.eventCode}`,
        code: activeEvent.eventCode,
        name: activeEvent.eventName ?? activeEvent.eventCode,
        venue: null, address: null, city: null, stateProv: null, country: null,
        dateStart: null, dateEnd: null, type: null,
      });
    }
    return items;
  }, [activeEvent, events, eventsSeason, season]);
  const eventWeekClassification = useMemo(() => classifyEventWeeks(listedEvents), [listedEvents]);
  const eventWeekGroups = useMemo(() => eventWeekClassification.groups.map(group => ({
    ...group,
    events: group.events.filter(event => `${event.name} ${event.code} ${event.type ?? ""} ${event.city ?? ""} ${event.stateProv ?? ""} ${event.country ?? ""} ${event.venue ?? ""}`.toLowerCase().includes(search.toLowerCase())),
  })), [eventWeekClassification, search]);
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> FIRST / EVENTOS Y COMPETENCIA</div><h1>FIRST Events</h1><p className="subheading">Selecciona un regional una sola vez. Su calendario, equipos, resultados oficiales y Match Scouting comparten el mismo evento activo.</p></div><span className="count-chip">FTC {season}–{season + 1}</span></div>
    <section className="panel official-controls">
      {mode !== "results" && <div className="official-filter-grid">
        <label className="field"><span className="field-label">Temporada FIRST</span><select aria-label="Temporada FIRST" value={season} disabled={!seasonReady} onChange={event => { setSeason(Number(event.target.value)); setEventPage(0); setPendingSelection({ code: "", currentEventCode: "" }); }}>
          {Array.from({ length: Math.max(0, maxSeason - 2000 + 1) }, (_, index) => maxSeason - index).map(year => <option key={year} value={year}>{year}–{year + 1}</option>)}
        </select></label>
        <label className="field"><span className="field-label">Buscar eventos · temporada {season}</span><span className="official-search"><Search size={15}/><input value={search} onChange={event => { setEventPage(0); setSearch(event.target.value); }} placeholder="Nombre, ubicación o código"/></span></label>
        <button className="button button-secondary" onClick={() => void loadEvents(true)} disabled={busyEvents}><RefreshCw size={15} className={busyEvents ? "spin" : ""}/> {busyEvents ? "Consultando FIRST…" : "Actualizar eventos"}</button>
      </div>}
      {mode === "schedule" && <>
        <label className="field official-event-select"><span className="field-label">Regional para trabajar</span><select aria-label="Regional para trabajar" value={pendingEventCode} onChange={event => setPendingSelection({ code: event.target.value, currentEventCode: eventCode })} disabled={!filteredEvents.length}><option value="">{eventsSeason === season && events.length ? "Selecciona un evento recibido de FIRST" : "Carga los eventos de FIRST"}</option>{visibleEvents.map(event => <option key={event.id} value={event.code}>{event.name} · {eventTypeLabel(event)} · {event.code}{event.city ? ` · ${event.city}` : ""}{event.country ? ` · ${event.country}` : ""}</option>)}</select></label>
        <div className="official-schedule-tools"><button className="button button-primary" type="button" disabled={!pendingEventCode || (pendingEventCode.toUpperCase() === activeEvent?.eventCode.toUpperCase() && activeEvent?.season === season)} onClick={() => confirmSelection(pendingEventCode)}>Confirmar evento activo</button></div>
      </>}
      <div className="official-event-card"><div className="official-event-icon"><CalendarDays size={19}/></div><div><b>{activeEvent?.season === season ? activeEvent.eventName ?? activeEvent.eventCode : "Sin evento activo en esta temporada"}</b><span>{activeEvent?.season === season ? `Evento FIRST ${season} · ${activeEvent.eventCode}` : "Selecciona y confirma un regional para cargar los datos oficiales."}</span>{selectedEvent && <span>{[selectedEvent.venue, selectedEvent.city, selectedEvent.stateProv, selectedEvent.country].filter(Boolean).join(" · ")}</span>}</div>{activeEvent?.season === season && <span className="official-badge">EVENTO ACTIVO</span>}</div>
      {mode === "schedule" && filteredEvents.length > pageSize && <div className="official-schedule-tools"><span>Mostrando {eventPage * pageSize + 1}–{Math.min((eventPage + 1) * pageSize, filteredEvents.length)} de {filteredEvents.length} eventos</span><button className="button button-secondary" disabled={eventPage === 0} onClick={() => setEventPage(value => value - 1)}>Anterior</button><button className="button button-secondary" disabled={(eventPage + 1) * pageSize >= filteredEvents.length} onClick={() => setEventPage(value => value + 1)}>Siguiente</button></div>}
      {mode === "schedule" && eventsSeason === season && events.length > 0 && filteredEvents.length === 0 && <p className="official-attribution">Ningún evento de esta temporada coincide con la búsqueda.</p>}
      {mode === "events" && <section className="panel official-matches"><div className="panel-head"><div><h2>Eventos oficiales FIRST</h2><p>{busyEvents ? "Consultando eventos oficiales…" : `${listedEvents.length} eventos disponibles en la temporada FIRST ${season}–${season + 1}`}</p></div><span className="count-chip">{listedEvents.length}</span></div>{listedEvents.length ? <div className="official-event-list">{listedEvents.map(event => <article className="official-event-row" key={event.id}><div><b>{event.name}</b><span>{event.code}{eventTypeLabel(event) ? ` · ${eventTypeLabel(event)}` : ""}{event.city ? ` · ${event.city}` : ""}{event.stateProv ? ` · ${event.stateProv}` : ""}{event.country ? ` · ${event.country}` : ""}</span></div>{activeEvent?.eventCode.toUpperCase() === event.code.toUpperCase() && <span className="official-badge">ACTIVO</span>}</article>)}</div> : <div className="official-empty">{busyEvents ? "Cargando eventos oficiales de FIRST…" : message || "No hay eventos oficiales disponibles."}</div>}</section>}
      {mode === "schedule" && eventCode && currentEventTeams.length > 0 && <section className="panel official-team-import"><div className="panel-head"><div><h2>Equipos participantes de FIRST</h2><p>{currentEventTeams.length} equipos publicados para este evento.</p></div><button className="button button-primary" onClick={openTeamImportPreview}>Vista previa e importar equipos</button></div>{importSummary && <div className="official-message"><span>{importSummary}</span></div>}{importPreview.length > 0 && <div className="official-team-preview"><div className="official-schedule-tools"><button className="button button-secondary" onClick={() => setSelectedImportNumbers(importPreview.map(team => team.number))}>Seleccionar todos</button><span>{selectedImportNumbers.length} de {importPreview.length} seleccionados</span></div><div className="table-wrap"><table><thead><tr><th>Importar</th><th>Equipo</th><th>Nombre FIRST</th><th>Estado</th></tr></thead><tbody>{importPreview.map(team => <tr key={team.number}><td><input aria-label={`Importar equipo ${team.number}`} type="checkbox" checked={selectedImportNumbers.includes(team.number)} onChange={event => setSelectedImportNumbers(values => event.target.checked ? [...values, team.number] : values.filter(number => number !== team.number))}/></td><td>{team.number}</td><td>{team.name}</td><td>{team.state === "new" ? "Nuevo" : team.state === "updated" ? "Actualizar datos oficiales" : "Ya existe"}</td></tr>)}</tbody></table></div><button className="button button-primary" disabled={!selectedImportNumbers.length} onClick={confirmTeamImport}>Confirmar importación</button></div>}</section>}
      {mode !== "events" && eventCode && <div className="official-schedule-tools"><label className="field"><span className="field-label">Nivel de torneo</span><select value={level} onChange={event => setLevel(event.target.value as Level)}><option value="qual">Clasificación (qual)</option><option value="playoff">Eliminatorias (playoff)</option></select></label><button className="button button-primary" onClick={() => void refreshSchedule(true)} disabled={busySchedule}><RefreshCw size={15} className={busySchedule ? "spin" : ""}/> {busySchedule ? "Actualizando FIRST…" : mode === "schedule" ? "Actualizar calendario FIRST" : "Actualizar resultados FIRST"}</button></div>}
      {message && <div className="official-message" role="status">{message.includes("FIRST") || message.includes("fall") || message.includes("Fall") ? <AlertTriangle size={15}/> : <CalendarDays size={15}/>}<span>{message}</span></div>}
    </section>
    <section className="panel official-matches" aria-label="Eventos FIRST disponibles">
      <div className="panel-head"><div><h2>Eventos FIRST disponibles</h2><p>{busyEvents ? "Consultando eventos oficiales…" : `${listedEvents.length} eventos disponibles en la temporada FIRST ${season}–${season + 1}`}</p></div><span className="count-chip">{listedEvents.length}</span></div>
      <p className="official-attribution" role="status">{selectionStatus}</p><p className="official-attribution">Semana N se calcula desde la fecha de inicio del evento Kickoff publicado por FIRST, en periodos consecutivos de 7 días, como el indicador “Week N since kickoff” de FTC Events. Inicio de temporada usado: {eventWeekClassification.kickoffDate ?? "sin kickoff publicado en esta lista"}. Sin fecha de inicio, antes del kickoff o sin fecha de kickoff de referencia: “Otros”.</p>
      {listedEvents.length ? <EventWeekList groups={eventWeekGroups} activeEvent={activeEvent} selectedCodes={selectedRegionalCodes} onToggle={(code, checked) => void toggleRegionalSelection(code, checked)} disabled={!regionalSelectionsLoaded || regionalSelectionsLoadFailed || regionalSelectionsSaving || workspaceRole === "viewer"}/> : <div className="official-empty">{busyEvents ? "Cargando eventos oficiales de FIRST…" : message || "No hay eventos oficiales disponibles para esta temporada."}</div>}
    </section>
    {mode !== "events" && eventCode && currentEventTeams.length > 0 && <section className="panel official-matches"><div className="panel-head"><div><h2>Equipos participantes</h2><p>Equipos oficiales asociados a {selectedEvent?.name ?? eventCode}</p></div><span className="count-chip">{currentEventTeams.length}</span></div><div className="official-attribution">{currentEventTeams.map(team => `${String(team.teamNumber ?? "")}${team.nameFull || team.nameShort || team.teamName ? ` · ${String(team.nameFull ?? team.nameShort ?? team.teamName)}` : ""}`).filter(Boolean).join("  /  ")}</div></section>}
    {!eventCode && <section className="panel official-matches" aria-label="Calendario de partidos"><div className="panel-head"><div><h2>Calendario de partidos</h2><p>El calendario aparece al confirmar un evento activo.</p></div></div><div className="official-empty">Selecciona un regional de FIRST para consultar su calendario.</div></section>}
    {mode !== "events" && eventCode && <section className="panel official-matches" aria-label="Calendario de partidos"><div className="panel-head"><div><h2>Calendario de partidos</h2><p>{selectedEvent?.name ?? `Evento ${eventCode}`} · {level === "qual" ? "Partidos de clasificación" : "Partidos de eliminatorias"} · {visibleMatches.length} recibidos</p></div><span className="official-updated">Última consulta correcta: {lastUpdate ?? "aún no descargado"}</span></div>
      {!currentCache && busySchedule ? <div className="official-empty">Cargando datos oficiales de {activeEvent?.eventName ?? eventCode}…</div> : !currentCache ? <div className="official-empty">{mode === "results" ? "Aún no hay resultados cargados para este evento." : "No hay calendario cargado para este evento."}</div> : visibleMatches.length ? <div className="official-match-list">{visibleMatches.map((match, index) => { const details = currentCache.scoreDetails?.filter(item => item && typeof item === "object" && Number((item as Record<string, unknown>).matchNumber) === match.number) ?? []; return <article className="official-match" key={`${match.id}:${index}`}><div className="official-match-title"><b>{match.description || `${match.level.toUpperCase()} · Partido ${match.number}`}</b><span>{match.status === "played" ? "Disputado · resultado oficial FIRST" : match.status === "result_pending" ? "Iniciado · resultado pendiente de publicación" : "Programado · sin resultado oficial"}</span><small>{dateText(match.actualStartTime ?? match.startTime) ?? "Hora no publicada"}</small></div><div className="official-alliance red"><b>ROJO</b><span>{teamList(match.redTeams)}</span><strong>{officialPoints(match.redFinal)}</strong></div><div className="official-alliance blue"><b>AZUL</b><span>{teamList(match.blueTeams)}</span><strong>{officialPoints(match.blueFinal)}</strong></div>{match.status === "played" && <div className="official-score-details"><span>AUTO Rojo: {officialPoints(match.redAuto)}</span><span>TELEOP Rojo: {officialPoints(match.redDriveControlled)}</span><span>Faltas Rojo: {officialPoints(match.redFoul)}</span><span>Endgame Rojo: {officialPoints(match.redEndgame)}</span><span>AUTO Azul: {officialPoints(match.blueAuto)}</span><span>TELEOP Azul: {officialPoints(match.blueDriveControlled)}</span><span>Faltas Azul: {officialPoints(match.blueFoul)}</span><span>Endgame Azul: {officialPoints(match.blueEndgame)}</span></div>}{details.length > 0 && <details className="official-score-details"><summary>Detalles de scoring publicados por FIRST</summary><pre>{JSON.stringify(details, null, 2)}</pre></details>}</article>; })}</div> : <div className="official-empty">{mode === "results" ? "FIRST no ha publicado resultados para este evento y nivel." : "FIRST devolvió un calendario vacío para este nivel."}</div>}
    </section>}
    <section className="panel official-matches" aria-label="Resultados oficiales FIRST">
      <div className="panel-head"><div><h2>Resultados oficiales FIRST</h2><p>{eventCode ? `${selectedEvent?.name ?? eventCode} · ${officialResults.length} partidos con resultado oficial` : "Selecciona un evento activo para consultar resultados oficiales."}</p></div><span className="official-updated">Solo datos oficiales FIRST</span></div>
      {!eventCode ? <div className="official-empty">Selecciona un regional para consultar sus resultados oficiales.</div> : !currentCache && busySchedule ? <div className="official-empty">Cargando resultados oficiales de {activeEvent?.eventName ?? eventCode}…</div> : !currentCache || officialResults.length === 0 ? <div className="official-empty">FIRST todavía no ha publicado resultados para este evento y nivel.</div> : <><p className="official-attribution">Estos puntajes son resultados oficiales publicados por FIRST; no son estimaciones individuales de scouting.</p><div className="official-match-list">{officialResults.map(match => <OfficialMatchCard key={match.id} match={match} scoreDetails={currentCache.scoreDetails}/>)}</div></>}
    </section>
  </>;
}
