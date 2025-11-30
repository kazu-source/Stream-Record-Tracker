import { Env, PlatformRegion } from "./types";
import { RiotApiClient } from "./riot-api";

/**
 * Calculate LP change during stream session
 *
 * Note: Riot API doesn't provide historical LP data per match.
 * We track LP by storing the starting LP when session begins,
 * then comparing to current LP on each request.
 */
export async function calculateLpChange(
  client: RiotApiClient,
  summonerId: string,
  region: PlatformRegion,
  startingLp: number | null
): Promise<{ currentLp: number | null; lpChange: number | null }> {
  const currentLp = await client.getCurrentSoloQueueLp(summonerId, region);

  if (currentLp === null) {
    return { currentLp: null, lpChange: null };
  }

  if (startingLp === null) {
    // No starting LP recorded yet, this is the start of session
    return { currentLp, lpChange: null };
  }

  const lpChange = currentLp - startingLp;
  return { currentLp, lpChange };
}

/**
 * Format LP change with +/- sign
 */
export function formatLpChange(lpChange: number | null): string {
  if (lpChange === null) {
    return "LP: N/A";
  }

  if (lpChange >= 0) {
    return `LP: +${lpChange}`;
  }

  return `LP: ${lpChange}`;
}

/**
 * Format the complete stream record response
 */
export function formatStreamRecord(
  wins: number,
  losses: number,
  lpChange: number | null
): string {
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  return `Stream Record: ${recordStr} | ${lpStr}`;
}

/**
 * Format offline response with last session's record
 */
export function formatOfflineRecord(
  wins: number,
  losses: number,
  lpChange: number | null
): string {
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  return `Stream is offline. Last stream's record: ${recordStr} | ${lpStr}`;
}
