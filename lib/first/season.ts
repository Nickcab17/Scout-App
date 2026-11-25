export const FIRST_SEASON = 2026;
export const FIRST_MIN_SEASON = 2000;

export function isSupportedFirstSeason(season: number): boolean {
  return Number.isInteger(season) && season >= FIRST_MIN_SEASON && season <= 9999;
}
