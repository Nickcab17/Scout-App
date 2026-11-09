"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import type { AppData } from "@/lib/types";
import { normalizeHybridSchedule, type OfficialEvent } from "@/lib/first/normalize";
import { normalizeOfficialTeams } from "@/lib/first/team-import";
import { buildFirstMatchAndObservation, parsePollenCount, type FirstRobotMatch } from "@/lib/first/match-scouting";

type Props = { data: AppData; setData: (updater: (current: AppData) => AppData) => void };

export default function FirstMatchScouting({ setData }: Props) {
  const [season, setSeason] = useState(2026);
  const [seasons, setSeasons] = useState([2026, 2025, 2024, 2023]);
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [eventCode, setEventCode] = useState("");
  const [matches, setMatches] = useState<FirstRobotMatch[]>([]);
  const [matchId, setMatchId] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [pollen, setPollen] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    void fetch("/api/first/seasons", { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (response.ok && Number.isInteger(payload.maxSeason)) {
        const normalized = payload.maxSeason === 2027 ? 2026 : payload.maxSeason;
        setSeasons(Array.from({ length: Math.max(0, normalized - 2023 + 1) }, (_, index) => normalized - index));
        setSeason(normalized);
      }
    }).catch(() => { /* Preserve the selector defaults while FIRST is unavailable. */ });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem("biobuzz-first-v1");
        if (!raw) return;
        const store = JSON.parse(raw) as { selections?: Record<string, { season: number; eventCode: string }> };
        const selection = store.selections?.local;
        if (selection?.eventCode && Number.isInteger(selection.season)) {
          setSeason(selection.season === 2027 ? 2026 : selection.season);
          setEventCode(selection.eventCode);
        }
      } catch { /* Keep the selector usable if local FIRST state is malformed. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function loadEvents(refresh = false) {
    setLoading(true); setError(""); setSaved("");
    try {
      const response = await fetch(`/api/first/events?season=${season}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "FIRST no pudo consultar los eventos.");
      setEvents(payload.events ?? []);
      setEventCode(current => payload.events?.some((event: OfficialEvent) => event.code === current) ? current : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible consultar FIRST.");
    } finally { setLoading(false); }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => { void loadEvents(); }, [season]); // Event list is scoped to the active FIRST season.
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function loadEventData(code: string, refresh = false) {
    if (!code) return;
    setLoading(true); setError(""); setSaved(""); setMatches([]); setMatchId(""); setTeamNumber("");
    try {
      const [teamResponse, qualResponse, playoffResponse] = await Promise.all([
        fetch(`/api/first/events/${encodeURIComponent(code)}/teams?season=${season}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/first/events/${encodeURIComponent(code)}/schedule?season=${season}&level=qual${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
        fetch(`/api/first/events/${encodeURIComponent(code)}/schedule?season=${season}&level=playoff${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }),
      ]);
      const [teamPayload, qualPayload, playoffPayload] = await Promise.all([teamResponse.json(), qualResponse.json(), playoffResponse.json()]);
      if (!teamResponse.ok) throw new Error(teamPayload.error || "FIRST no pudo consultar los equipos del evento.");
      if (!qualResponse.ok && !playoffResponse.ok) throw new Error(qualPayload.error || playoffPayload.error || "FIRST no pudo consultar el calendario del evento.");

      const officialTeams = normalizeOfficialTeams(teamPayload);
      if (!officialTeams.length) throw new Error("FIRST no publicó equipos para este evento. No se inventaron equipos.");
      window.dispatchEvent(new CustomEvent("biobuzz:import-first-teams", { detail: { teams: officialTeams, season, eventCode: code, selectedNumbers: officialTeams.map(team => team.number) } }));

      const combined = new Map<string, FirstRobotMatch>();
      if (qualResponse.ok) normalizeHybridSchedule(qualPayload, season, code, "qual").forEach(match => combined.set(match.id, { ...match, season, eventCode: code } as FirstRobotMatch));
      if (playoffResponse.ok) normalizeHybridSchedule(playoffPayload, season, code, "playoff").forEach(match => combined.set(match.id, { ...match, season, eventCode: code } as FirstRobotMatch));
      const officialMatches = [...combined.values()].sort((a, b) => (a.level === b.level ? a.number - b.number : a.level === "qual" ? -1 : 1));
      if (!officialMatches.length) throw new Error("FIRST no publicó partidos oficiales para este evento. No se puede registrar scouting sin alianzas verificadas.");
      setMatches(officialMatches);

      try {
        const raw = localStorage.getItem("biobuzz-first-v1");
        const store = raw ? JSON.parse(raw) as { selections?: Record<string, unknown>; schedules?: Record<string, unknown> } : { selections: {}, schedules: {} };
        store.selections = { ...(store.selections ?? {}), local: { season, eventCode: code } };
        localStorage.setItem("biobuzz-first-v1", JSON.stringify(store));
      } catch { /* Persistence of the selection is secondary to the official API response. */ }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar los datos oficiales.");
    } finally { setLoading(false); }
  }

  function selectEvent(code: string) {
    setEventCode(code);
    setMatchId("");
    setTeamNumber("");
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!eventCode) return;
    void loadEventData(eventCode);
  }, [eventCode, season]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const selectedMatch = useMemo(() => matches.find(match => match.id === matchId), [matches, matchId]);
  const robots = useMemo(() => selectedMatch ? [
    ...selectedMatch.redTeams.map(team => ({ ...team, alliance: "red" as const })),
    ...selectedMatch.blueTeams.map(team => ({ ...team, alliance: "blue" as const })),
  ] : [], [selectedMatch]);

  function savePollen() {
    setSaved(""); setError("");
    const pollenCount = parsePollenCount(pollen);
    if (pollenCount === null) {
      setError("Polen inválido. Introduce únicamente un número entero igual o mayor que cero.");
      return;
    }
    if (!selectedMatch) { setError("Selecciona un partido oficial antes de guardar."); return; }
    const number = Number(teamNumber);
    if (!teamNumber || !Number.isInteger(number)) { setError("Selecciona el robot observado."); return; }
    try {
      setData(current => {
        const result = buildFirstMatchAndObservation(selectedMatch, number, pollenCount, current);
        const matches = result.localMatch === current.matches.find(match => match.officialMatchId === selectedMatch.id)
          ? current.matches.map(match => match.officialMatchId === result.localMatch.officialMatchId ? result.localMatch : match)
          : [...current.matches, result.localMatch];
        const observations = current.observations.some(item => item.id === result.observation.id)
          ? current.observations.map(item => item.id === result.observation.id ? result.observation : item)
          : [...current.observations, result.observation];
        return { ...current, matches, observations };
      });
      setSaved(`Registro guardado: equipo ${number}, alianza ${selectedMatch.redTeams.some(team => team.number === number) ? "roja" : "azul"}, ${pollenCount} polen.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el registro.");
    }
  }

  return (
    <div className="first-match-scouting">
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line"/> CAPTURA OFICIAL / EN CAMPO</div><h1>Match Scouting</h1><p className="subheading">FIRST proporciona equipos, partidos y alianzas. El scout solo identifica el robot y cuenta el polen observado.</p></div>
        <button className="button button-secondary" type="button" onClick={() => { void loadEvents(true); if (eventCode) void loadEventData(eventCode, true); }} disabled={loading}><RefreshCw size={15}/> Reintentar consulta FIRST</button>
      </div>
      <div className="notice"><div className="notice-icon"><ShieldCheck size={16}/></div><div><b>Estación de observación</b><span>No se inventan equipos ni alianzas. Las estimaciones están desactivadas mientras falten valores oficiales confirmados.</span></div></div>
      {error && <div className="notice"><div className="notice-icon"><AlertTriangle size={16}/></div><div><b>No se pudo completar la captura</b><span>{error}</span></div></div>}
      {saved && <div className="notice"><div className="notice-icon"><CheckCircle2 size={16}/></div><div><b>Guardado localmente</b><span>{saved}</span></div></div>}
      <div className="management-grid">
        <section className="panel form-panel">
          <div className="panel-head"><div><h2>Partido FIRST</h2><p>Selecciona temporada, evento, partido y robot</p></div><CalendarDays size={17} className="head-icon"/></div>
          <div className="form-stack">
            <label className="field"><span>Temporada FIRST</span><select aria-label="Temporada FIRST" value={season} onChange={event => setSeason(Number(event.target.value))}>{seasons.map(year => <option key={year} value={year}>{year}—{year + 1}</option>)}</select></label>
            <label className="field"><span>Evento FIRST</span><select aria-label="Evento FIRST" value={eventCode} onChange={event => selectEvent(event.target.value)}><option value="">Selecciona un evento oficial</option>{events.map(event => <option key={event.code} value={event.code}>{event.code} · {event.name}</option>)}</select></label>
            <label className="field"><span>Partido oficial</span><select aria-label="Partido oficial" value={matchId} onChange={event => { setMatchId(event.target.value); setTeamNumber(""); setSaved(""); }} disabled={!matches.length}><option value="">Selecciona un partido</option>{matches.map(match => <option key={match.id} value={match.id}>{match.level.toUpperCase()} M{match.number}{match.description ? ` · ${match.description}` : ""}</option>)}</select></label>
            {selectedMatch && <label className="field"><span>Robot observado</span><select aria-label="Robot observado" value={teamNumber} onChange={event => { setTeamNumber(event.target.value); setSaved(""); }}><option value="">Selecciona el robot</option>{robots.map(robot => <option key={`${robot.alliance}-${robot.number}`} value={robot.number}>{robot.alliance === "red" ? "Rojo" : "Azul"} · {robot.number}{robot.name ? ` · ${robot.name}` : ""}</option>)}</select></label>}
          </div>
        </section>
        <section className="panel form-panel">
          <div className="panel-head"><div><h2>Dato observado</h2><p>Solo se registra polen observado</p></div><ShieldCheck size={17} className="head-icon"/></div>
          <div className="form-stack">
            {selectedMatch && teamNumber && <div className="scoring-identity"><div className="score-input read-only"><span>Evento / partido</span><b>{season} · {selectedMatch.eventCode} · M{selectedMatch.number}</b></div><div className="score-input read-only"><span>Equipo / alianza / nivel</span><b>{teamNumber} · {selectedMatch.redTeams.some(team => team.number === Number(teamNumber)) ? "Roja" : "Azul"} · {selectedMatch.level}</b></div></div>}
            <label className="field"><span>Cantidad de polen introducida</span><input aria-label="Cantidad de polen" type="number" min="0" step="1" inputMode="numeric" value={pollen} onChange={event => { setPollen(event.target.value); setSaved(""); }} placeholder="0"/></label>
            <div className="pool-pending"><AlertTriangle size={13}/><span>Estimaciones desactivadas: las reglas oficiales no están verificadas.</span></div>
            <div className="form-foot"><span><i className="pending-dot"/> Guardado local</span><button className="button button-primary" type="button" onClick={savePollen}><CheckCircle2 size={15}/> Guardar polen</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}
