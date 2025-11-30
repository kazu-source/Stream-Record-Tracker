/**
 * Format placement as ordinal (1st, 2nd, 3rd, etc.)
 */
function formatPlacement(placement: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = placement % 100;
  return placement + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
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
 * Format the TFT stream record response
 * Format: W-L: 3W-2L | L5: 1st, 3rd, 8th, 7th, 4th | LP: +38
 */
export function formatTftStreamRecord(
  wins: number,
  losses: number,
  placements: number[],
  lpChange: number | null
): string {
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  // Format last 5 placements
  let l5Str = "";
  if (placements.length > 0) {
    const placementStrs = placements.map(formatPlacement);
    l5Str = ` | L5: ${placementStrs.join(", ")}`;
  }

  return `W-L: ${recordStr}${l5Str} | ${lpStr}`;
}

/**
 * Format offline TFT response
 */
export function formatTftOfflineRecord(
  wins: number,
  losses: number,
  placements: number[],
  lpChange: number | null
): string {
  const recordStr = `${wins}W-${losses}L`;
  const lpStr = formatLpChange(lpChange);

  // Format last 5 placements
  let l5Str = "";
  if (placements.length > 0) {
    const placementStrs = placements.map(formatPlacement);
    l5Str = ` | L5: ${placementStrs.join(", ")}`;
  }

  return `Stream is offline. Last stream's TFT record: W-L: ${recordStr}${l5Str} | ${lpStr}`;
}
