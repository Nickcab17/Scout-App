"use client";
import { useMemo, useState } from "react";
import { AppData } from "@/lib/types";
import { AnalyticsFilters, countIncompleteRecords, defaultAnalyticsFilters, filterConfirmedRecords, getTeamStats } from "@/lib/analytics";

const eventName = (matchEvent: string, eventCode?: string) => matchEvent || eventCode || "Evento local";

function BarChart({ title, data, valueKey }: { title: string; data: { label: string; value: number }[]; valueKey: string }) {
  const maximum = Math.max(...data.map(item => item.value), 1);
  return <section className="panel analytics-chart"><div className="panel-head"><div><h2>{title}</h2><p>{valueKey}</p></div></div>{data.length ? <div className="bar-chart" role="img" aria-label={title}>{data.map(item => <div className="bar-chart-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.max(2, item.value / maximum * 100)}%` }}><b title={`${item.value.toFixed(1)} puntos`}>{item.value.toFixed(1)}</b></i></div></div>)}</div> : <div className="analytics-empty"><b>Sin datos confirmados</b><span>No hay muestras que cumplan los filtros actuales.</span></div>}</section>;
}

function LineChart({ records }: { records: ReturnType<typeof filterConfirmedRecords> }) {
  const sorted = [...records].sort((a, b) => (a.match?.number || 0) - (b.match?.number || 0));
  const width = 640;
  const height = 220;
  const maximum = Math.max(...sorted.map(record => record.score.totalMatchPoints), 1);
  const points = sorted.map((record, index) => {
    const x = sorted.length === 1 ? width / 2 : 35 + index * (width - 70) / (sorted.length - 1);
    const y = height - 30 - record.score.totalMatchPoints / maximum * (height - 55);
    return { x, y, record };
  });
  const polyline = points.map(point => `${point.x},${point.y}`).join(" ");
  return <section className="panel analytics-chart"><div className="panel-head"><div><h2>Evolución del rendimiento</h2><p>Pts estimados por partido confirmado</p></div></div>{points.length ? <div className="line-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolución del rendimiento por partido"><polyline points={polyline} fill="none" stroke="var(--blue-bright)" strokeWidth="3"/>{points.map(point => <g key={point.record.observation.id}><circle cx={point.x} cy={point.y} r="5" fill="var(--primary)"><title>{`M${point.record.match?.number || "?"}: ${point.record.score.totalMatchPoints} pts · Equipo ${point.record.observation.teamNumber}`}</title></circle><text x={point.x} y={height - 10} textAnchor="middle">{`M${point.record.match?.number || "?"}`}</text></g>)}</svg></div> : <div className="analytics-empty"><b>Sin evolución disponible</b><span>Registra al menos una muestra confirmada.</span></div>}</section>;
}

export default function ScoringAnalytics({ data }: { data: AppData }) {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("biobuzz-first-v1") || "{}") as { selections?: Record<string, { season?: number; eventCode?: string }> };
      const selection = parsed.selections?.local;
      return selection?.season && selection.eventCode
        ? { ...defaultAnalyticsFilters, season: String(selection.season), event: selection.eventCode }
        : defaultAnalyticsFilters;
    } catch {
      return defaultAnalyticsFilters;
    }
  });
  const [comparison, setComparison] = useState<string[]>([]);

  const seasons = useMemo(() => [...new Set(data.matches.map(match => match.season ? String(match.season) : "Sin temporada"))].sort(), [data.matches]);
  const events = useMemo(() => {
    const values = new Set(data.matches.map(match => eventName(match.event, match.eventCode)));
    try {
      const parsed = JSON.parse(localStorage.getItem("biobuzz-first-v1") || "{}") as { selections?: Record<string, { eventCode?: string }> };
      const selected = parsed.selections?.local?.eventCode;
      if (selected) values.add(selected);
    } catch {}
    return [...values].sort();
  }, [data.matches]);
  const records = useMemo(() => filterConfirmedRecords(data, filters), [data, filters]);
  const stats = useMemo(() => getTeamStats(data, filters), [data, filters]);
  const incomplete = countIncompleteRecords(data, filters);

  const teamBars = stats.map(item => ({ label: String(item.team.number), value: item.average })).filter(item => item.value > 0 || records.some(record => String(record.observation.teamNumber) === item.label));
  const categoryRows = stats.length ? ["auto", "teleop", "cell", "flower", "garden", "bonus"].map(key => ({
    label: key.toUpperCase(),
    value: stats.reduce((sum, item) => sum + item.categoryAverage[key as keyof typeof item.categoryAverage], 0) / stats.length,
  })) : [];

  const compared = stats.filter(item => comparison.includes(String(item.team.number)));
  return <>
    <section className="panel wide-panel analytics-filters"><div className="panel-head"><div><h2>Filtros de análisis</h2><p>Los cálculos excluyen registros incompletos.</p></div></div><div className="analytics-filter-grid">
      <label>Temporada<select value={filters.season} onChange={e => setFilters(value => ({ ...value, season: e.target.value }))}><option value="all">Todas</option>{seasons.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Evento<select value={filters.event} onChange={e => setFilters(value => ({ ...value, event: e.target.value }))}><option value="all">Todos</option>{events.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Equipo<select value={filters.team} onChange={e => setFilters(value => ({ ...value, team: e.target.value }))}><option value="all">Todos</option>{data.teams.map(team => <option key={team.id} value={String(team.number)}>{team.number} · {team.name}</option>)}</select></label>
      <label>Periodo<select value={filters.period} onChange={e => setFilters(value => ({ ...value, period: e.target.value as AnalyticsFilters["period"] }))}><option value="all">Todos los partidos</option><option value="5">Últimos 5 partidos</option><option value="10">Últimos 10 partidos</option></select></label>
    </div></section>

    <section className="panel wide-panel"><div className="panel-head"><div><h2>Estadísticas por equipo</h2><p>Solo registros con cantidades confirmadas. Ceros confirmados sí cuentan.</p></div></div>{stats.length ? <div className="table-wrap"><table><thead><tr><th>Equipo</th><th>Partidos</th><th>Confirmados</th><th>Incompletos</th><th>Promedio</th><th>Mediana</th><th>Mín–Máx</th><th>Desv. estándar</th><th>Consistencia</th><th>AUTO</th><th>TELEOP</th><th>Reciente</th></tr></thead><tbody>{stats.map(item => <tr key={item.team.id}><td>{item.team.number}</td>{item.records.length ? <><td>{item.matches}</td><td>{item.records.length}</td><td>{item.incomplete}</td><td>{item.average.toFixed(1)} pts</td><td>{item.median.toFixed(1)}</td><td>{item.minimum.toFixed(0)}–{item.maximum.toFixed(0)}</td><td>{item.standardDeviation.toFixed(1)}</td><td>{item.consistency.toFixed(0)}%</td><td>{item.autoAverage.toFixed(1)}</td><td>{item.teleopAverage.toFixed(1)}</td><td>{item.recentAverage.toFixed(1)}</td></> : <td colSpan={11}>Datos insuficientes · sin scouting confirmado</td>}</tr>)}</tbody></table></div> : <div className="analytics-empty"><b>Sin scoring confirmado</b><span>Los registros narrativos no se convierten automáticamente a puntos.</span></div>}</section>

    <div className="analytics-grid-real">
      <BarChart title="Puntuación promedio por equipo" data={teamBars} valueKey="Puntos estimados por robot y partido"/>
      <LineChart records={records}/>
      <BarChart title="Rendimiento autónomo" data={stats.map(item => ({ label: String(item.team.number), value: item.autoAverage }))} valueKey="Puntos AUTO promedio"/>
      <BarChart title="Rendimiento TeleOp" data={stats.map(item => ({ label: String(item.team.number), value: item.teleopAverage }))} valueKey="Puntos TeleOp promedio"/>
      <BarChart title="Desglose por categoría" data={categoryRows} valueKey="Promedio de puntos por categoría"/>
      <section className="panel analytics-chart"><div className="panel-head"><div><h2>Consistencia entre partidos</h2><p>100% menos la variación relativa</p></div></div><div className="consistency-list">{stats.map(item => <div key={item.team.id}><span>{item.team.number}</span><div><i style={{ width: `${item.consistency}%` }}/></div><b>{item.consistency.toFixed(0)}%</b></div>)}</div></section>
    </div>

    <section className="panel wide-panel"><div className="panel-head"><div><h2>Comparación entre equipos</h2><p>Selecciona equipos para comparar métricas y Pit Scouting.</p></div></div><div className="team-comparison-select">{stats.map(item => <label key={item.team.id}><input type="checkbox" checked={comparison.includes(String(item.team.number))} onChange={e => setComparison(values => e.target.checked ? [...values, String(item.team.number)] : values.filter(value => value !== String(item.team.number)))}/>{item.team.number} · {item.team.name}</label>)}</div>{compared.length ? <div className="table-wrap"><table><thead><tr><th>Equipo</th><th>Muestras</th><th>Promedio</th><th>AUTO</th><th>TELEOP</th><th>Consistencia</th><th>Capacidad declarada</th><th>Capacidad observada</th></tr></thead><tbody>{compared.map(item => <tr key={item.team.id}><td>{item.team.number}</td><td>{item.records.length}</td><td>{item.average.toFixed(1)}</td><td>{item.autoAverage.toFixed(1)}</td><td>{item.teleopAverage.toFixed(1)}</td><td>{item.consistency.toFixed(0)}%</td><td>{item.team.capabilitiesSource === "team_reported" ? item.team.capabilities || "Sin detalle declarado" : item.team.capabilities ? "Orígen no confirmado" : "Sin dato"}</td><td>{item.team.capabilitiesSource === "scout_observed" ? item.team.capabilities || "Sin detalle observado" : "Sin verificación de scout"}</td></tr>)}</tbody></table></div> : <div className="analytics-empty"><b>Selecciona equipos</b><span>{incomplete} registros incompletos excluidos de esta vista.</span></div>}</section>
  </>;
}
