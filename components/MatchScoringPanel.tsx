"use client";
import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { calculateAllianceRankingPoints, calculateRobotScore, EventType, PieceCounts, RobotScoutingInput } from "@/lib/scoring";

type Props = {
  value: RobotScoutingInput;
  onChange: (next: RobotScoutingInput) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  scoutName: string;
  onScoutNameChange: (value: string) => void;
  eventType: EventType;
  teamNumber: string;
  allianceName: string;
  allianceRecords: RobotScoutingInput[];
};

function CountField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="score-input"><span>{label}</span><input type="number" min="0" step="1" inputMode="numeric" value={value} onChange={event => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}/></label>;
}

function CheckField({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="score-check"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/><span>{label}</span></label>;
}

function PieceFields({ value, set, prefix }: { value: PieceCounts; set: (next: PieceCounts) => void; prefix: string }) {
  return <div className="score-counts"><CountField label={`${prefix}: POLLEN`} value={value.pollen} onChange={pollen => set({ ...value, pollen })}/><CountField label={`${prefix}: NECTAR`} value={value.nectar} onChange={nectar => set({ ...value, nectar })}/></div>;
}

export default function MatchScoringPanel({ value, onChange, confirmed, onConfirmedChange, scoutName, onScoutNameChange, eventType, teamNumber, allianceName, allianceRecords }: Props) {
  const score = useMemo(() => calculateRobotScore(value), [value]);
  const rp = useMemo(() => calculateAllianceRankingPoints({ robots: allianceRecords, activeRobotCount: 2, eventType }), [allianceRecords, eventType]);
  const setAuto = (changes: Partial<RobotScoutingInput["auto"]>) => onChange({ ...value, auto: { ...value.auto, ...changes } });
  const setTeleop = (changes: Partial<RobotScoutingInput["teleop"]>) => onChange({ ...value, teleop: { ...value.teleop, ...changes } });
  const updatePieces = (key: "cells" | "flowers" | "gardens", next: PieceCounts) => setTeleop({ [key]: next });
  const threshold = eventType === "all_other_events";
  const allianceTips = allianceRecords.reduce((total, robot) => total + robot.auto.hiveTips + robot.teleop.hiveTips, 0);
  const allianceLeavePark = allianceRecords.reduce((total, robot) => total + (robot.auto.leave ? 3 : 0) + (robot.auto.park ? 5 : 0) + (robot.teleop.park ? 5 : 0), 0);
  const bonusRecordedByTeammate = allianceRecords.some(robot => robot !== value && robot.teleop.bottomNectarBonusFlowers > 0);

  return <section className="scoring-entry" aria-labelledby="scoring-heading">
    <div className="scoring-entry-head"><div><div className="section-kicker"><span>03</span> PUNTUACIÓN BIOBUZZ</div><h3 id="scoring-heading">Estimación del robot {teamNumber || "sin equipo"} · alianza {allianceName}</h3></div><Activity size={17}/></div>
    <p className="scoring-guidance">Registra acciones y cantidades observadas que cumplan los criterios de la temporada. Son atribuciones de scouting, no un puntaje oficial de alianza.</p>
    <div className="scoring-identity"><label className="score-input"><span>Scout responsable</span><input value={scoutName} maxLength={80} onChange={event => onScoutNameChange(event.target.value)} placeholder="Nombre o iniciales"/></label><div className="score-input read-only"><span>Temporada / evento</span><b>BIOBUZZ 2026–2027 · {eventType === "not_configured" ? "tipo de evento pendiente" : eventType.replaceAll("_", " ")}</b></div></div>
    <div className="scoring-periods">
      <fieldset className="scoring-period"><legend>Autónomo (AUTO)</legend><CheckField label="LEAVE · robot separado del perímetro" checked={value.auto.leave} onChange={leave => setAuto({ leave })}/><CheckField label="PARK AUTO · parcialmente en LOADING ZONE" checked={value.auto.park} onChange={park => setAuto({ park })}/><CountField label="HIVE TIPS completados en AUTO" value={value.auto.hiveTips} onChange={hiveTips => setAuto({ hiveTips })}/></fieldset>
      <fieldset className="scoring-period"><legend>Teleoperado (TELEOP)</legend><CheckField label="PARK TELEOP · parcialmente en LOADING ZONE" checked={value.teleop.park} onChange={park => setTeleop({ park })}/><CountField label="HIVE TIPS completados en TELEOP" value={value.teleop.hiveTips} onChange={hiveTips => setTeleop({ hiveTips })}/><PieceFields prefix="CELL al finalizar" value={value.teleop.cells} set={next => updatePieces("cells", next)}/></fieldset>
    </div>
    <fieldset className="scoring-period"><legend>Scoring final observado en TELEOP</legend><p className="score-help">En FLOWER cuenta piezas en el volumen puntuable y atribuidas a flores propias. Marca el Bottom NECTAR Bonus solo cuando se verificó su condición al cierre; registra el logro una sola vez para la alianza.</p><PieceFields prefix="FLOWER propia" value={value.teleop.flowers} set={next => updatePieces("flowers", next)}/><CheckField label={bonusRecordedByTeammate?"Bottom NECTAR Bonus ya registrado para la alianza":"Bottom NECTAR Bonus cumplido (5 puntos; máximo uno por alianza)"} checked={value.teleop.bottomNectarBonusFlowers===1} disabled={bonusRecordedByTeammate&&!value.teleop.bottomNectarBonusFlowers} onChange={checked=>setTeleop({bottomNectarBonusFlowers:checked?1:0})}/><PieceFields prefix="GARDEN propio" value={value.teleop.gardens} set={next => updatePieces("gardens", next)}/></fieldset>
    <label className="scoring-confirm"><input type="checkbox" checked={confirmed} onChange={event => onConfirmedChange(event.target.checked)}/><span>Confirmo que revisé este registro; los ceros significan que no observé la acción o cantidad.</span></label>
    <div className="score-results"><div className="score-result-heading"><div><b>Estimación de este robot</b><span>Reglas {score.ruleVersion}</span></div><b className="score-total">{score.totalMatchPoints} <small>pts</small></b></div><div className="score-breakdown"><span>AUTO <b>{score.autoPoints}</b></span><span>TELEOP <b>{score.teleopPoints}</b></span><span>TIPS <b>{score.totalTips}</b></span><span>CELL <b>{score.cellPoints}</b></span><span>FLOWER <b>{score.flowerPoints}</b></span><span>GARDEN <b>{score.gardenPoints}</b></span><span>BONUS <b>{score.bonusPoints}</b></span><span>PENALTIES <b>Pendiente</b></span></div><div className="score-rp"><b>RP de alianza · parcial: {rp.totalEstimatedRP}</b>{threshold ? <span>{allianceLeavePark}/16 LEAVE + PARK · {allianceTips}/4 y 7 TIPS</span> : <span>Umbrales pendientes de confirmar para este tipo de evento.</span>}<div className="rp-values"><span>SWARM: {rp.swarmRP ?? "pendiente"}</span><span>POLLINATOR 1: {rp.pollinator1RP ?? "pendiente"}</span><span>POLLINATOR 2: {rp.pollinator2RP ?? "pendiente"}</span><span>WIN: {rp.winRP ?? "requiere resultado oficial"}</span></div>{rp.missing.length > 0 && <small><AlertTriangle size={12}/>{rp.missing.join("; ")}</small>}</div><div className="pool-pending"><AlertTriangle size={13}/><span>Pool points: no definido en el manual TU06; cálculo pendiente, no se estima.</span></div></div>
    <div className="score-sync-note"><CheckCircle2 size={13}/>{confirmed ? "El registro está confirmado para guardar con la observación." : "Confirma los datos, incluidos los ceros, antes de guardarlos."}</div>
  </section>;
}
