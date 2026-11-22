"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Minus, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import type { AllianceFinalState, AppData, MatchActions } from "@/lib/types";
import { normalizeHybridSchedule, type OfficialEvent, type OfficialMatch } from "@/lib/first/normalize";
import { normalizeOfficialTeams, type OfficialTeam } from "@/lib/first/team-import";
import { buildFirstMatchAndObservation, emptyMatchActions, parsePollenCount, type FirstRobotMatch } from "@/lib/first/match-scouting";
import { calculateExtendedEstimate } from "@/lib/scoring";
import { writeData } from "@/lib/persistence";
import ContextHelp from "@/components/ContextHelp";
import { readActiveFirstEvent, type ActiveFirstEvent } from "@/lib/first/active-event";

type Props = { data: AppData; setData: (updater: (current: AppData) => AppData) => void };
type Period = "auto" | "teleop" | "endgame" | "final";

function NumberControl({ label, value, onChange, help }: { label: string; value: number; onChange: (value: number) => void; help?: string }) {
  const invalid = !Number.isSafeInteger(value) || value < 0;
  return <div className="capture-counter"><span>{label}{help && <ContextHelp label={label} text={help}/>}</span><div><button type="button" aria-label={`Reducir ${label}`} onClick={() => onChange(Math.max(0, value - 1))}><Minus size={14}/></button><input aria-label={label} type="number" min="0" step="1" inputMode="numeric" value={value} onChange={event => { const parsed = Number(event.target.value); onChange(Number.isFinite(parsed) ? parsed : -1); }} /><button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)}><Plus size={14}/></button></div>{invalid && <small>Debe ser un entero igual o mayor que cero</small>}</div>;
}

function ownFlowerState(): AllianceFinalState["flowerOwners"] { return [null, null, null, null]; }

function AutoCapture({ actions, setActions, setPath }: { actions: MatchActions; setActions: Dispatch<SetStateAction<MatchActions>>; setPath: (path: "autoPollenCell" | "autoNectarCell" | "teleopHive" | "teleopPollenCell" | "teleopNectarCell" | "teleopPollenFlowers" | "teleopNectarFlowers" | "endHive" | "endPollenGarden" | "endNectarGarden", value: number) => void }) {
  return <>
    <div className="capture-actions">
      <label className="capture-check"><input type="checkbox" checked={actions.auto.leave} onChange={event => setActions(current => ({ ...current, auto: { ...current.auto, leave: event.target.checked } }))}/> LEAVE — dejó de tocar la pared <ContextHelp label="LEAVE" text="Marca esta casilla solo si el robot observado se movió fuera de su zona inicial. Es una acción individual del robot; observala en el inicio de AUTO."/></label>
      <label className="capture-check"><input type="checkbox" checked={actions.auto.park} onChange={event => setActions(current => ({ ...current, auto: { ...current.auto, park: event.target.checked } }))}/> PARK al finalizar AUTO <ContextHelp label="PARK AUTO" text="Marca si el robot observado quedó estacionado dentro de su zona de PARK al terminar AUTO. No representa el estado colectivo de la alianza."/></label>
    </div>
    <div className="capture-section-grid">
      <NumberControl label="HIVE TIPS conseguidos en AUTO" help="Cuenta HIVE TIPS logrados por el robot observado. Un tip es el resultado o contacto válido específico mostrado por el elemento; no cuentes piezas solo por estar cerca." value={actions.auto.hiveTips} onChange={value => setActions(current => ({ ...current, auto: { ...current.auto, hiveTips: value } }))}/>
      <div className="piece-card pollen"><b>POLLEN</b><NumberControl label="Pollen lanzado hacia CELL superior" help="Pollen es la pieza amarilla. Cuenta lanzamientos o acciones realizadas por el robot observado hacia una CELL de Pollen. Registra un lanzamiento individual, no las piezas finales de toda la alianza." value={actions.auto.pollenLaunchedCell} onChange={value => setPath("autoPollenCell", value)}/></div>
      <div className="piece-card nectar"><b>NECTAR</b><NumberControl label="Nectar lanzado hacia CELL superior" help="Nectar es el líquido o recurso distinto del Pollen. Cuenta lanzamientos individuales hacia una CELL en AUTO. Si no puedes distinguirlo con claridad, deja cero y agrega una nota." value={actions.auto.nectarLaunchedCell} onChange={value => setPath("autoNectarCell", value)}/></div>
    </div>
  </>;
}

function TeleopCapture({ actions, setActions, setPath, updateFlower }: { actions: MatchActions; setActions: Dispatch<SetStateAction<MatchActions>>; setPath: (path: "autoPollenCell" | "autoNectarCell" | "teleopHive" | "teleopPollenCell" | "teleopNectarCell" | "teleopPollenFlowers" | "teleopNectarFlowers" | "endHive" | "endPollenGarden" | "endNectarGarden", value: number) => void; updateFlower: (periodName: "teleop" | "endGame" | "endGameFinal", index: number, piece: "pollen" | "nectar", value: number) => void }) {
  const names = ["FLOWER 1", "FLOWER 2", "FLOWER 3", "FLOWER 4"];
  return <>
    <NumberControl label="HIVE TIPS conseguidos en TELEOP" help="Cuenta acciones válidas HIVE TIP hechas por el robot observado durante TELEOP. Observa la acción del robot, no el estado final de las flores." value={actions.teleop.hiveTips} onChange={value => setPath("teleopHive", value)}/>
    <div className="capture-section-grid">
      <div className="piece-card pollen"><b>POLLEN</b><NumberControl label="POLLEN lanzado hacia CELLS" help="Pollen es la pieza amarilla. Cuenta lanzamientos del robot observado hacia cualquier CELL durante TELEOP." value={actions.teleop.pollenLaunchedCell} onChange={value => setPath("teleopPollenCell", value)}/><NumberControl label="POLLEN introducido en FLOWERS" help="Cuenta piezas Pollen que el robot observado deposita o entrega en las FLOWERS. CELL es un contenedor superior; FLOWER tiene pétalos y GARDEN es la zona inferior." value={actions.teleop.pollenFromFlowers} onChange={value => setPath("teleopPollenFlowers", value)}/><NumberControl label="POLLEN colocado en GARDENS" help="Cuenta acciones individuales del robot observado al colocar Pollen en un GARDEN. No cuentes piezas colocadas por otros robots." value={actions.teleop.gardens.pollen} onChange={value => setActions(current => ({ ...current, teleop: { ...current.teleop, gardens: { ...current.teleop.gardens, pollen: value } } }))}/></div>
      <div className="piece-card nectar"><b>NECTAR</b><NumberControl label="NECTAR lanzado hacia CELLS" help="Nectar es el recurso distinto de Pollen. Cuenta lanzamientos del robot observado hacia CELLS durante TELEOP." value={actions.teleop.nectarLaunchedCell} onChange={value => setPath("teleopNectarCell", value)}/><NumberControl label="NECTAR introducido en FLOWERS" help="Cuenta piezas o cantidades de Nectar que el robot observado coloca en las FLOWERS. Se registra por acción individual." value={actions.teleop.nectarFromFlowers} onChange={value => setPath("teleopNectarFlowers", value)}/><NumberControl label="NECTAR colocado en GARDENS" help="Cuenta acciones individuales del robot observado al colocar Nectar en GARDENS. No mezcles este dato con el estado final de la alianza." value={actions.teleop.gardens.nectar} onChange={value => setActions(current => ({ ...current, teleop: { ...current.teleop, gardens: { ...current.teleop.gardens, nectar: value } } }))}/></div>
    </div>
    <div className="flower-capture-grid">{names.map((name, index) => <div className="flower-card" key={name}><b>{name}</b><NumberControl label={`${name} POLLEN introducido`} help={`Cuenta Pollen depositado por el robot observado específicamente en ${name}. FLOWERS son cuatro elementos separados; no sumes entre ellas.`} value={actions.teleop.flowers[index].pollen} onChange={value => updateFlower("teleop", index, "pollen", value)}/><NumberControl label={`${name} NECTAR introducido`} help={`Cuenta Nectar depositado por el robot observado específicamente en ${name}. Usa el número visible de esta flower, no el total de la alianza.`} value={actions.teleop.flowers[index].nectar} onChange={value => updateFlower("teleop", index, "nectar", value)}/></div>)}</div>
  </>;
}

function EndGameCapture({ actions, setActions, setPath, updateFlower }: { actions: MatchActions; setActions: Dispatch<SetStateAction<MatchActions>>; setPath: (path: "autoPollenCell" | "autoNectarCell" | "teleopHive" | "teleopPollenCell" | "teleopNectarCell" | "teleopPollenFlowers" | "teleopNectarFlowers" | "endHive" | "endPollenGarden" | "endNectarGarden", value: number) => void; updateFlower: (periodName: "teleop" | "endGame" | "endGameFinal", index: number, piece: "pollen" | "nectar", value: number) => void }) {
  const names = ["FLOWER 1", "FLOWER 2", "FLOWER 3", "FLOWER 4"];
  return <>
    <label className="capture-check"><input type="checkbox" checked={actions.endGame.park} onChange={event => setActions(current => ({ ...current, endGame: { ...current.endGame, park: event.target.checked } }))}/> PARK al finalizar el partido <ContextHelp label="PARK END GAME" text="Marca si el robot observado terminó estacionado en PARK. Esta es una acción individual, no el conteo final de los tres robots."/></label>
    <NumberControl label="HIVE TIPS conseguidos en End Game" help="Cuenta HIVE TIPS logrados por el robot observado al final del partido. Separa esta acción de las piezas que quedan en CELLS o GARDENS." value={actions.endGame.hiveTips} onChange={value => setPath("endHive", value)}/>
    <div className="capture-section-grid">
      <div className="piece-card pollen"><b>POLLEN — restantes</b><NumberControl label="POLLEN restante en CELL" help="Cantidad de Pollen que permanece en una CELL al terminar. Esto describe el robot observado o el estado visible de la CELLP; no confundas con piezas lanzadas." value={actions.endGame.cells.pollen} onChange={value => setActions(current => ({ ...current, endGame: { ...current.endGame, cells: { ...current.endGame.cells, pollen: value } } }))}/><NumberControl label="POLLEN restante en GARDENS" help="Cuenta Pollen que queda físicamente en GARDENS al final. Para el resultado colectivo de la alianza usa ESTADO FINAL." value={actions.endGame.gardens.pollen} onChange={value => setPath("endPollenGarden", value)}/></div>
      <div className="piece-card nectar"><b>NECTAR — restantes</b><NumberControl label="NECTAR restante en CELL" help="Cantidad de Nectar que queda en una CELL al terminar. Reconoce Nectar como el recurso distinto de Pollen." value={actions.endGame.cells.nectar} onChange={value => setActions(current => ({ ...current, endGame: { ...current.endGame, cells: { ...current.endGame.cells, nectar: value } } }))}/><NumberControl label="NECTAR restante en GARDENS" help="Cuenta Nectar que queda físicamente en GARDENS al final. Este dato corresponde al robot observado o a la zona visible, no al resultado final completo salvo que se indique." value={actions.endGame.gardens.nectar} onChange={value => setPath("endNectarGarden", value)}/></div>
    </div>
    <div className="flower-capture-grid">{names.map((name, index) => <div className="flower-card" key={name}><b>{name}</b><NumberControl label={`${name} POLLEN introducido`} help={`Pollen colocado por el robot observado en ${name} durante todo el periodo o End Game.`} value={actions.endGame.flowers[index].pollen} onChange={value => updateFlower("endGame", index, "pollen", value)}/><NumberControl label={`${name} NECTAR introducido`} help={`Nectar colocado por el robot observado en ${name} durante todo el periodo o End Game.`} value={actions.endGame.flowers[index].nectar} onChange={value => updateFlower("endGame", index, "nectar", value)}/><NumberControl label={`${name} POLLEN final`} help={`Contenido final visible de Pollen en ${name}; en END GAME puede registrar el estado observado antes de pasar a ESTADO FINAL.`} value={actions.endGame.flowersFinal[index].pollen} onChange={value => updateFlower("endGameFinal", index, "pollen", value)}/><NumberControl label={`${name} NECTAR final`} help={`Contenido final visible de Nectar en ${name}; cuenta piezas, no acciones realizadas por un robot.`} value={actions.endGame.flowersFinal[index].nectar} onChange={value => updateFlower("endGameFinal", index, "nectar", value)}/></div>)}</div>
  </>;
}

function AllianceFinalCapture({ value, onChange, onFlowerChange }: {
  value: AllianceFinalState;
  onChange: (next: AllianceFinalState) => void;
  onFlowerChange: (index: number, piece: "pollen" | "nectar", pieceValue: number) => void;
}) {
  const names = ["FLOWER 1", "FLOWER 2", "FLOWER 3", "FLOWER 4"];
  return <>
    <p className="alliance-final-note">ESTADO FINAL: registra el resultado visible de toda la alianza al terminar el partido, no acciones atribuidas al robot observado.</p>
    <div className="capture-section-grid">
      <div className="piece-card pollen"><b>POLLEN — alianza final</b><NumberControl label="POLLEN final restante en CELLS" help="Cuenta todo el Pollen que queda en las CELLS de las tres posiciones de la alianza al terminar. Este es un resultado colectivo." value={value.cells.pollen} onChange={pieceValue => onChange({ ...value, cells: { ...value.cells, pollen: pieceValue } })}/><NumberControl label="POLLEN final en GARDENS" help="Cuenta el Pollen final visible en GARDENS de toda la alianza al terminar el partido." value={value.gardens.pollen} onChange={pieceValue => onChange({ ...value, gardens: { ...value.gardens, pollen: pieceValue } })}/></div>
      <div className="piece-card nectar"><b>NECTAR — alianza final</b><NumberControl label="NECTAR final restante en CELLS" help="Cuenta todo el Nectar que queda en las CELLS de toda la alianza al terminar. No confundas Nectar con Pollen." value={value.cells.nectar} onChange={pieceValue => onChange({ ...value, cells: { ...value.cells, nectar: pieceValue } })}/><NumberControl label="NECTAR final en GARDENS" help="Cuenta el Nectar final visible en GARDENS de toda la alianza." value={value.gardens.nectar} onChange={pieceValue => onChange({ ...value, gardens: { ...value.gardens, nectar: pieceValue } })}/></div>
    </div>
    <NumberControl label="FLOWERS con Bottom NECTAR Bonus" help="Cuenta entre cero y cuatro FLOWERS que cumplen Bottom NECTAR Bonus al final. Es un resultado de alianza." value={value.bottomNectarBonusFlowers} onChange={pieceValue => onChange({ ...value, bottomNectarBonusFlowers: Math.min(4, pieceValue) })}/>
    <div className="flower-capture-grid">{names.map((name, index) => <div className="flower-card" key={name}>
      <b>{name}</b>
      <label className="field"><span>Propietario de FLOWER <ContextHelp label={`${name} propietario`} text="Indica qué alianza controla o posee esta flower al final. Observa el estado de toda la alianza, no al robot que hizo la última acción."/></span><select aria-label={`${name} propietario`} value={value.flowerOwners[index] ?? ""} onChange={event => {
        const owners: AllianceFinalState["flowerOwners"] = [value.flowerOwners[0], value.flowerOwners[1], value.flowerOwners[2], value.flowerOwners[3]];
        owners[index] = event.target.value === "red" ? "red" : event.target.value === "blue" ? "blue" : null;
        onChange({ ...value, flowerOwners: owners });
      }}><option value="">Sin propietario observado</option><option value="red">Alianza roja</option><option value="blue">Alianza azul</option></select></label>
      <NumberControl label={`${name} POLLEN final`} help={`Cantidad final de Pollen contenida en ${name}. Cuenta el estado visible de esta flower específica al finalizar el partido.`} value={value.flowersFinal[index].pollen} onChange={pieceValue => onFlowerChange(index, "pollen", pieceValue)}/>
      <NumberControl label={`${name} NECTAR final`} help={`Cantidad final de Nectar contenida en ${name}. Cuenta el estado visible de esta flower específica y manténlo separado de Pollen.`} value={value.flowersFinal[index].nectar} onChange={pieceValue => onFlowerChange(index, "nectar", pieceValue)}/>
    </div>)}</div>
  </>;
}

function hasValidMatchNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0;
  if (Array.isArray(value)) return value.every(hasValidMatchNumbers);
  if (value && typeof value === "object") return Object.values(value).every(hasValidMatchNumbers);
  return true;
}

export default function FirstMatchScouting({ data, setData }: Props) {
  const [season, setSeason] = useState(2026);
  const [seasons, setSeasons] = useState([2026, 2025, 2024, 2023]);
  const [events, setEvents] = useState<OfficialEvent[]>([]);
  const [eventCode, setEventCode] = useState("");
  const [matches, setMatches] = useState<FirstRobotMatch[]>([]);
  const [eventTeams, setEventTeams] = useState<OfficialTeam[]>([]);
  const [matchId, setMatchId] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [period, setPeriod] = useState<Period>("auto");
  const [actions, setActions] = useState<MatchActions>(() => emptyMatchActions());
  const [finalState, setFinalState] = useState<AllianceFinalState>(() => ({ cells: { pollen: 0, nectar: 0 }, gardens: { pollen: 0, nectar: 0 }, flowersFinal: [{ pollen: 0, nectar: 0 }, { pollen: 0, nectar: 0 }, { pollen: 0, nectar: 0 }, { pollen: 0, nectar: 0 }], flowerOwners: ownFlowerState(), bottomNectarBonusFlowers: 0 }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [activeEvent, setActiveEvent] = useState<ActiveFirstEvent | null>(null);

  useEffect(() => {
    void fetch("/api/first/seasons", { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (response.ok && Number.isInteger(payload.maxSeason)) {
        const normalized = payload.maxSeason === 2027 ? 2026 : payload.maxSeason;
        setSeasons(Array.from({ length: Math.max(0, normalized - 2023 + 1) }, (_, index) => normalized - index)); setSeason(normalized);
      }
    }).catch(() => {});
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const active = readActiveFirstEvent();
      if (active) {
        setActiveEvent(active);
        setSeason(active.season);
        setEventCode(active.eventCode);
        return;
      }
      const raw = localStorage.getItem("biobuzz-first-v1");
      if (!raw) return;
      const store = JSON.parse(raw) as { selections?: Record<string, { season: number; eventCode: string }> };
      const selection = store.selections?.local;
      if (selection?.eventCode && Number.isInteger(selection.season)) { setSeason(selection.season === 2027 ? 2026 : selection.season); setEventCode(selection.eventCode); }
    } catch {}
  }, []);
  useEffect(() => {
    const handleActiveEvent = (event: Event) => {
      const detail = (event as CustomEvent<ActiveFirstEvent>).detail;
      if (!detail?.eventCode) return;
      setActiveEvent(detail);
      setSeason(detail.season);
      setEventCode(detail.eventCode);
      setMatchId("");
      setTeamNumber("");
    };
    window.addEventListener("biobuzz:active-first-event", handleActiveEvent);
    return () => window.removeEventListener("biobuzz:active-first-event", handleActiveEvent);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function loadEvents(refresh = false) {
    setLoading(true); setError(""); setSaved("");
    try {
      const response = await fetch(`/api/first/events?season=${season}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "FIRST no pudo consultar los eventos.");
      setEvents(payload.events ?? []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible consultar FIRST."); } finally { setLoading(false); }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => { void loadEvents(); }, [season]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function loadEventData(code: string, refresh = false) {
    if (!code) return;
    const requestedSeason = season;
    const requestedEventCode = code.toUpperCase();
    setLoading(true); setError(""); setSaved(""); setMatches([]); setMatchId(""); setTeamNumber("");
    try {
      let cachedStore: { schedules?: Record<string, { matches?: OfficialMatch[] }> } = {};
      try {
        const raw = localStorage.getItem("biobuzz-first-v1");
        if (raw) cachedStore = JSON.parse(raw) as { schedules?: Record<string, { matches?: OfficialMatch[] }> };
      } catch {}

      const teamResponse = await fetch(`/api/first/events/${encodeURIComponent(code)}/teams?season=${season}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
      const teamPayload = await teamResponse.json();
      const qualKey = `${requestedSeason}:${requestedEventCode}:qual`;
      const playoffKey = `${requestedSeason}:${requestedEventCode}:playoff`;
      const cachedQual = !refresh ? cachedStore.schedules?.[qualKey]?.matches : undefined;
      const cachedPlayoff = !refresh ? cachedStore.schedules?.[playoffKey]?.matches : undefined;

      const scheduleResponse = async (level: "qual" | "playoff", cached: OfficialMatch[] | undefined) => {
        if (cached?.length) return { ok: true, payload: { matches: cached } };
        const response = await fetch(`/api/first/events/${encodeURIComponent(code)}/schedule?season=${season}&level=${level}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
        return { ok: response.ok, payload: await response.json() };
      };
      const [qualResponse, playoffResponse] = await Promise.all([
        scheduleResponse("qual", cachedQual),
        scheduleResponse("playoff", cachedPlayoff),
      ]);
      const qualPayload = qualResponse.payload;
      const playoffPayload = playoffResponse.payload;
      const active = readActiveFirstEvent();
      if (active && (active.season !== requestedSeason || active.eventCode !== requestedEventCode)) return;
      if (!teamResponse.ok) throw new Error(teamPayload.error || "FIRST no pudo consultar los equipos del evento.");
      const officialTeams = normalizeOfficialTeams(teamPayload);
      if (!officialTeams.length) throw new Error("FIRST no publicó equipos para este evento.");
      setEventTeams(officialTeams);
      window.dispatchEvent(new CustomEvent("biobuzz:import-first-teams", { detail: { teams: officialTeams, season, eventCode: code, selectedNumbers: officialTeams.map(team => team.number) } }));

      const combined = new Map<string, FirstRobotMatch>();
      const normalize = (payload: unknown, level: "qual" | "playoff") => {
        const rawPayload = payload as { matches?: unknown[] };
        return Array.isArray(rawPayload.matches) ? rawPayload.matches as OfficialMatch[] : normalizeHybridSchedule(payload, season, code, level);
      };
      if (qualResponse.ok) normalize(qualPayload, "qual").forEach(match => combined.set(match.id, { ...match, season, eventCode: code } as FirstRobotMatch));
      if (playoffResponse.ok) normalize(playoffPayload, "playoff").forEach(match => combined.set(match.id, { ...match, season, eventCode: code } as FirstRobotMatch));
      const officialMatches = [...combined.values()].sort((a, b) => (a.level === b.level ? a.number - b.number : a.level === "qual" ? -1 : 1));
      if (!officialMatches.length) throw new Error("FIRST no publicó partidos oficiales para este evento.");
      setMatches(officialMatches);
      try { const raw = localStorage.getItem("biobuzz-first-v1"); const store = raw ? JSON.parse(raw) as { selections?: Record<string, unknown>; schedules?: Record<string, unknown> } : { selections: {}, schedules: {} }; store.selections = { ...(store.selections ?? {}), local: { season, eventCode: code } }; localStorage.setItem("biobuzz-first-v1", JSON.stringify(store)); } catch {}
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No fue posible cargar los datos oficiales."); } finally { setLoading(false); }
  }

  function selectEvent(code: string) { setEventCode(code); setMatchId(""); setTeamNumber(""); }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => { if (eventCode) void loadEventData(eventCode); }, [eventCode, season]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const selectedMatch = useMemo(() => matches.find(match => match.id === matchId), [matches, matchId]);
  const robots = useMemo(() => selectedMatch ? [...selectedMatch.redTeams.map(team => ({ ...team, alliance: "red" as const })), ...selectedMatch.blueTeams.map(team => ({ ...team, alliance: "blue" as const }))] : [], [selectedMatch]);
  const estimate = useMemo(() => calculateExtendedEstimate(actions, finalState), [actions, finalState]);
  const validActions = hasValidMatchNumbers(actions) && hasValidMatchNumbers(finalState);

  function setActionNumber(path: "autoPollenCell" | "autoNectarCell" | "teleopHive" | "teleopPollenCell" | "teleopNectarCell" | "teleopPollenFlowers" | "teleopNectarFlowers" | "endHive" | "endPollenGarden" | "endNectarGarden", value: number) {
    setActions(current => {
      const next = structuredClone(current);
      if (path === "autoPollenCell") next.auto.pollenLaunchedCell = value;
      if (path === "autoNectarCell") next.auto.nectarLaunchedCell = value;
      if (path === "teleopHive") next.teleop.hiveTips = value;
      if (path === "teleopPollenCell") next.teleop.pollenLaunchedCell = value;
      if (path === "teleopNectarCell") next.teleop.nectarLaunchedCell = value;
      if (path === "teleopPollenFlowers") next.teleop.pollenFromFlowers = value;
      if (path === "teleopNectarFlowers") next.teleop.nectarFromFlowers = value;
      if (path === "endHive") next.endGame.hiveTips = value;
      if (path === "endPollenGarden") next.endGame.gardens.pollen = value;
      if (path === "endNectarGarden") next.endGame.gardens.nectar = value;
      return next;
    });
  }

  function updateFlower(periodName: "teleop" | "endGame" | "endGameFinal", index: number, piece: "pollen" | "nectar", value: number) {
    setActions(current => {
      const next = structuredClone(current);
      if (periodName === "teleop") next.teleop.flowers[index][piece] = value;
      if (periodName === "endGame") next.endGame.flowers[index][piece] = value;
      if (periodName === "endGameFinal") next.endGame.flowersFinal[index][piece] = value;
      return next;
    });
  }

  function updateFinalFlower(index: number, piece: "pollen" | "nectar", value: number) {
    setFinalState(current => {
      const flowers: AllianceFinalState["flowersFinal"] = [
        { ...current.flowersFinal[0] },
        { ...current.flowersFinal[1] },
        { ...current.flowersFinal[2] },
        { ...current.flowersFinal[3] },
      ];
      flowers[index][piece] = value;
      return { ...current, flowersFinal: flowers };
    });
  }

  function saveCapture() {
    setSaved(""); setError("");
    const pollenCount = actions.teleop.pollenLaunchedCell;
    if (parsePollenCount(String(pollenCount)) === null) { setError("Todos los contadores deben contener enteros iguales o mayores que cero."); return; }
    if (!selectedMatch) { setError("Selecciona un partido oficial antes de guardar."); return; }
    const number = Number(teamNumber);
    if (!teamNumber || !Number.isInteger(number)) { setError("Selecciona el robot observado."); return; }
    const participant = [...selectedMatch.redTeams, ...selectedMatch.blueTeams].some(team => team.number === number);
    if (!participant) { setError("El equipo seleccionado no participa en este partido oficial."); return; }
    if (!validActions) { setError("Corrige los contadores inválidos antes de guardar."); return; }
    try {
      const result = buildFirstMatchAndObservation(selectedMatch, number, pollenCount, data, actions);
      const existingLocalMatch = data.matches.find(match => match.officialMatchId === selectedMatch.id);
      const nextMatches = existingLocalMatch ? data.matches.map(match => match.id === existingLocalMatch.id ? result.localMatch : match) : [...data.matches, result.localMatch];
      const observation = { ...result.observation, allianceFinal: finalState };
      const next: AppData = { ...data, matches: nextMatches, observations: [...data.observations, observation] };
      writeData(next); setData(() => next);
      setSaved(`Registro guardado: equipo ${number}, alianza ${selectedMatch.redTeams.some(team => team.number === number) ? "roja" : "azul"}, partido M${selectedMatch.number}.`);
      setActions(emptyMatchActions());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el registro."); }
  }

  const periods: Period[] = ["auto", "teleop", "endgame", "final"];

  return <div className="first-match-scouting">
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> CAPTURA OFICIAL / EN CAMPO</div><h1>Match Scouting</h1><p className="subheading">AUTO, TELEOP y End Game, con acciones individuales separadas de resultados de alianza.</p></div><button className="button button-secondary" type="button" onClick={() => { void loadEvents(true); if (eventCode) void loadEventData(eventCode, true); }} disabled={loading}><RefreshCw size={15}/> Reintentar consulta FIRST</button></div>
    {error && <div className="notice"><div className="notice-icon"><AlertTriangle size={16}/></div><div><b>No se pudo completar la captura</b><span>{error}</span></div></div>}
    {saved && <div className="notice"><div className="notice-icon"><CheckCircle2 size={16}/></div><div><b>Guardado localmente</b><span>{saved}</span></div></div>}
    <div className="management-grid">
      <section className="panel form-panel"><div className="panel-head"><div><h2>Partido FIRST</h2><p>Selecciona partido y robot observado</p></div><CalendarDays size={17} className="head-icon"/></div><div className="form-stack">
        <div className="active-event-banner"><span>Evento activo</span><b>{activeEvent?.eventName ?? activeEvent?.eventCode ?? (eventCode || "Sin evento confirmado")}</b>{activeEvent && <small>Temporada {activeEvent.season} · {activeEvent.eventCode}</small>}</div>
        <label className="field"><span>Partido oficial</span><select aria-label="Partido oficial" value={matchId} onChange={event => { setMatchId(event.target.value); setTeamNumber(""); }} disabled={!matches.length}><option value="">Selecciona un partido</option>{matches.map(match => <option key={match.id} value={match.id}>{match.level.toUpperCase()} M{match.number}{match.description ? ` · ${match.description}` : ""}</option>)}</select></label>
        {selectedMatch && <><div className="score-results"><div className="official-alliance red"><b>ALIANZA ROJA</b><span>{selectedMatch.redTeams.map(team => team.number).join(" · ")}</span></div><div className="official-alliance blue"><b>ALIANZA AZUL</b><span>{selectedMatch.blueTeams.map(team => team.number).join(" · ")}</span></div></div><label className="field"><span>Equipo participante observado</span><select aria-label="Equipo participante observado" value={teamNumber} onChange={event => setTeamNumber(event.target.value)}><option value="">Selecciona el equipo</option>{robots.map(robot => <option key={`${robot.alliance}-${robot.number}`} value={robot.number}>{robot.alliance === "red" ? "Rojo" : "Azul"} · {robot.number}{robot.name ? ` · ${robot.name}` : ""}</option>)}</select></label></>}
      </div></section>
      <section className="panel form-panel"><div className="panel-head"><div><h2>Captura de desempeño</h2><p>Contadores rápidos; se permiten registros parciales</p></div><ShieldCheck size={17} className="head-icon"/></div>
        <div className="capture-tabs" role="tablist">{periods.map(item => <button key={item} role="tab" type="button" aria-selected={period === item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item === "auto" ? "AUTO" : item === "teleop" ? "TELEOP" : item === "endgame" ? "END GAME" : "ESTADO FINAL"}</button>)}</div>
        <div className="form-stack">
          {period === "auto" && <AutoCapture actions={actions} setActions={setActions} setPath={setActionNumber}/>}
          {period === "teleop" && <TeleopCapture actions={actions} setActions={setActions} setPath={setActionNumber} updateFlower={updateFlower}/>}
          {period === "endgame" && <EndGameCapture actions={actions} setActions={setActions} setPath={setActionNumber} updateFlower={updateFlower}/>}
          {period === "final" && <AllianceFinalCapture value={finalState} onChange={setFinalState} onFlowerChange={updateFinalFlower}/>}
          <div className="capture-summary"><b>Resumen individual estimado</b><span>AUTO {estimate.autoPoints} · TELEOP {estimate.teleopPoints} · END GAME {estimate.endGamePoints}</span><b>Resultados finales de alianza</b><span>{estimate.allianceFinalPoints} pts estimados — no atribuidos al robot observado</span></div>
          <div className="form-foot"><span><i className="pending-dot"/> Guardado local independiente</span><button className="button button-primary" type="button" onClick={saveCapture} disabled={!selectedMatch || !teamNumber}><CheckCircle2 size={15}/> Guardar observación</button></div>
        </div>
      </section>
    </div>
  </div>;
}
