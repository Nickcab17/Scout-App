export type ObservationIdentity = { id: string; match_id: string; team_number: number };

export function selectNewObservationRows<T extends ObservationIdentity>(incoming: T[], existing: ObservationIdentity[]) {
  const byId = new Map(existing.map(row => [row.id, row]));
  const byKey = new Set(existing.map(row => `${row.match_id}\u0000${row.team_number}`));
  const rows: T[] = [];
  const batchKeys = new Set<string>();
  let duplicate = false;
  for (const row of incoming) {
    const key = `${row.match_id}\u0000${row.team_number}`;
    if (byId.has(row.id)) continue;
    if (byKey.has(key) || batchKeys.has(key)) { duplicate = true; continue; }
    batchKeys.add(key);
    rows.push(row);
  }
  return { rows, duplicate };
}
