export type RuleConfiguration = { season: string; eventType: string; version: string; verified: boolean; values: Record<string, number> };
export const scoringRules: RuleConfiguration = { season: "BIOBUZZ 2026–2027", eventType: "Todos", version: "Sin configurar", verified: false, values: {} };
export function estimateScore(): null { return null; }
