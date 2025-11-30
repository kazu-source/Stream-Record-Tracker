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
 * Format the complete stream record response for LoL
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
