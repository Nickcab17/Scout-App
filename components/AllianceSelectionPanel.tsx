"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Swords, Trash2, Users } from "lucide-react";
import { AppData } from "@/lib/types";
import { buildAllianceCompatibility, defaultRankingWeights, getTeamStats, rankTeamStats, RankingWeights } from "@/lib/analytics";

type Scenario = { id: string; name: string; teamNumbers: number[]; createdAt: string };
const SCENARIOS_KEY = "biobuzz-alliance-scenarios-v1";
const WEIGHTS_KEY = "biobuzz-alliance-weights-v1";

export default function AllianceSelectionPanel({ data }: { data: AppData }) {
  const [selected, setSelected] = useState<[string, string, string]>(["", "", ""]);
  const [weights, setWeights] = useState<RankingWeights>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(WEIGHTS_KEY) || "null");
      return stored && typeof stored === "object" ? { ...defaultRankingWeights, ...stored } : defaultRankingWeights;
    } catch {
      return defaultRankingWeights;
    }
  });
  const [scenarioName, setScenarioName] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    try {
      const storedScenarios = JSON.parse(localStorage.getItem(SCENARIOS_KEY) || "[]") as Scenario[];
      return Array.isArray(storedScenarios) ? storedScenarios : [];
    } catch {
      return [];
    }
  });

  useEffect(() => { try { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights)); } catch {} }, [weights]);
  useEffect(() => { try { localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios)); } catch {} }, [scenarios]);

  const stats = (() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("biobuzz-first-v1") || "{}") as { selections?: Record<string, { season?: number; eventCode?: string }> };
      const selection = parsed.selections?.local;
      const filtered = getTeamStats(data, selection?.season && selection.eventCode
        ? { season: String(selection.season), event: selection.eventCode }
        : {});
      return filtered;
    } catch {
      return getTeamStats(data);
    }
  })();
  const ranked = useMemo(() => rankTeamStats(stats, weights), [stats, weights]);
  const compatibility = useMemo(() => buildAllianceCompatibility(stats), [stats]);
  const selectedStats = selected.flatMap(value => {
    const item = ranked.find(candidate => String(candidate.team.number) === value);
    return item ? [item] : stats.find(candidate => String(candidate.team.number) === value) ? [stats.find(candidate => String(candidate.team.number) === value)!] : [];
  });
  const selectedNumbers = selectedStats.map(item => item!.team.number);
  const recommendations = ranked.filter(item => !selectedNumbers.includes(item.team.number)).slice(0, 5);

  function setWeight(key: keyof RankingWeights, value: number) {
    setWeights(current => ({ ...current, [key]: value }));
  }

  function saveScenario() {
    const valid = selectedStats.map(item => item!.team.number);
    if (valid.length !== 3) return;
    const scenario: Scenario = { id: crypto.randomUUID(), name: scenarioName.trim() || `Alianza ${valid.join(" · ")}`, teamNumbers: valid, createdAt: new Date().toISOString() };
    setScenarios(current => [...current, scenario]);
    setScenarioName("");
  }

  return <><div className="alliance-board">
    <div className="alliance-header"><div className="alliance-emblem"><Swords size={23}/></div><div><b>Constructor de alianza</b><span>Selecciona hasta tres equipos para comparar evidencia disponible</span></div><span className="config-pending">{selectedStats.length === 3 ? "COMBINACIÓN COMPLETA" : `${selectedStats.length}/3 EQUIPOS`}</span></div>
    <div className="alliance-selectors">{["Equipo principal", "Socio 1", "Socio 2"].map((label, index) => <label className="field" key={label}><span className="field-label">{label}</span><select value={selected[index]} disabled={!stats.length} onChange={event => setSelected(current => current.map((value, position) => position === index ? event.target.value : value) as [string,string,string])}><option value="">Selecciona un equipo…</option>{stats.map(item => <option key={item.team.id} value={String(item.team.number)} disabled={selected.some((value, position) => position !== index && value === String(item.team.number))}>{item.team.number} · {item.team.name}</option>)}</select></label>)}</div>
    <div className="alliance-participants">{stats.map(item => <div key={`participant-${item.team.id}`}><b>{item.team.number} · {item.team.name}</b><span>{item.records.length ? `${item.records.length} muestras confirmadas` : "Datos insuficientes · sin scouting confirmado"}</span></div>)}</div>
    {selectedStats.length ? <div className="alliance-combination"><h2>Combinación seleccionada</h2><div className="comparison-grid">{selectedStats.map(item => <div className="compare-cell" key={item.team.id}><span>{item.team.number} · {item.team.name}</span><b>{item.average.toFixed(1)} pts · {item.records.length} muestras</b><small>AUTO {item.autoAverage.toFixed(1)} · TeleOp {item.teleopAverage.toFixed(1)} · Consistencia {item.consistency.toFixed(0)}%</small><small>{item.team.capabilities || "Sin capacidades técnicas registradas"}</small></div>)}</div><div className="scenario-save"><input aria-label="Nombre de escenario" value={scenarioName} onChange={event => setScenarioName(event.target.value)} placeholder="Nombre del escenario"/><button className="button button-primary" disabled={selectedStats.length !== 3} onClick={saveScenario}><Plus size={15}/> Guardar escenario</button></div></div> : <div className="alliance-empty"><div className="alliance-empty-icon"><Users size={23}/></div><h2>Selecciona equipos para comparar</h2><p>La combinación usa registros confirmados de Match Scouting y puede distinguir datos declarados en Pit Scouting.</p><button className="button button-secondary" onClick={() => document.querySelector<HTMLButtonElement>('[aria-label="Teams"]')?.click()}><Plus size={15}/>Registrar equipos</button></div>}
  </div>

  <section className="panel wide-panel"><div className="panel-head"><div><h2>Ranking competitivo configurable</h2><p>Índice reproducible, no una predicción oficial FIRST.</p></div></div><div className="weight-controls">{(["total","auto","teleop","consistency","recent"] as const).map(key => <label key={key}>{key === "total" ? "Promedio" : key === "auto" ? "AUTO" : key === "teleop" ? "TeleOp" : key === "consistency" ? "Consistencia" : "Reciente"}<input type="range" min="0" max="100" value={weights[key]} onChange={event => setWeight(key, Number(event.target.value))}/><b>{weights[key]}%</b></label>)}</div><div className="table-wrap"><table><thead><tr><th>Posición</th><th>Equipo</th><th>Puntaje índice</th><th>Promedio</th><th>AUTO</th><th>TeleOp</th><th>Consistencia</th><th>Muestras</th></tr></thead><tbody>{ranked.map((item, index) => <tr key={item.team.id}><td>{index + 1}</td><td>{item.team.number} · {item.team.name}</td><td>{item.rankingScore.toFixed(1)}</td><td>{item.average.toFixed(1)}</td><td>{item.autoAverage.toFixed(1)}</td><td>{item.teleopAverage.toFixed(1)}</td><td>{item.consistency.toFixed(0)}%</td><td>{item.records.length}</td></tr>)}</tbody></table></div>{!ranked.length && <div className="analytics-empty"><b>Sin muestras confirmadas</b><span>El ranking solo incluye equipos con registros de scoring confirmados.</span></div>}</section>

  <section className="panel wide-panel"><div className="panel-head"><div><h2>Compatibilidad y recomendaciones</h2><p>Explicaciones reproducibles basadas en evidencia actual.</p></div></div>{recommendations.length ? <div className="recommendation-grid">{recommendations.map(item => { const profile = compatibility.find(profile => profile.team.number === item.team.number)!; return <div className="compare-cell" key={item.team.id}><span>{item.team.number} · {item.team.name}</span><b>{item.average.toFixed(1)} pts · {item.records.length} muestras</b><small><strong>Aporta:</strong> {profile.strengths.length ? profile.strengths.join(", ") : "Sin fortalezas confirmadas"}</small><small><strong>Limitaciones:</strong> {profile.limitations.length ? profile.limitations.join(", ") : "Sin limitaciones destacadas"}</small></div>; })}</div> : <div className="analytics-empty"><b>Sin recomendaciones suficientes</b><span>Agrega registros confirmados o selecciona menos equipos.</span></div>}</section>

  <section className="panel wide-panel"><div className="panel-head"><div><h2>Escenarios guardados</h2><p>Persistidos en este navegador.</p></div></div>{scenarios.length ? <div className="scenario-list">{scenarios.map(scenario => <div className="list-row" key={scenario.id}><div className="match-badge"><Swords size={15}/></div><div className="row-main"><b>{scenario.name}</b><span>{scenario.teamNumbers.join(" · ")}</span></div><button className="icon-button danger-hover" aria-label={`Eliminar escenario ${scenario.name}`} onClick={() => setScenarios(current => current.filter(item => item.id !== scenario.id))}><Trash2 size={15}/></button></div>)}</div> : <div className="analytics-empty"><b>Sin escenarios guardados</b><span>Selecciona tres equipos y guarda una combinación.</span></div>}</section></>;
}
