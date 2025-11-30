import {
  RiotMatch,
  ProcessedMatch,
  PlatformRegion,
  RANKED_SOLO_QUEUE_ID,
} from "./types";
import { RiotApiClient, RiotApiError } from "./riot-api";

/**
 * Filter and process matches that occurred during the stream session
 */
export async function getStreamMatches(
  client: RiotApiClient,
  puuid: string,
  region: PlatformRegion,
  streamStartTimestamp: number
): Promise<ProcessedMatch[]> {
  // Get match IDs starting from stream start time
  const matchIds = await client.getMatchHistory(
    puuid,
    region,
    20, // Fetch up to 20 recent matches
    streamStartTimestamp
  );

  if (matchIds.length === 0) {
    return [];
  }

  const processedMatches: ProcessedMatch[] = [];

  // Fetch match details sequentially to avoid rate limits
  for (const matchId of matchIds) {
    try {
      const match = await client.getMatch(matchId, region);
      const processed = processMatch(match, puuid, streamStartTimestamp);

      if (processed) {
        processedMatches.push(processed);
      }

      // Small delay between requests to be nice to the API
      await sleep(50);
    } catch (error) {
      if (error instanceof RiotApiError && error.isRateLimited) {
        // Stop fetching if rate limited, return what we have
        break;
      }
      // Skip individual match errors, continue with others
      console.error(`Failed to fetch match ${matchId}:`, error);
    }
  }

  // Sort by game start time (oldest first)
  return processedMatches.sort(
    (a, b) => a.gameStartTimestamp - b.gameStartTimestamp
  );
}

/**
 * Process a match and extract relevant data
 * Returns null if match doesn't meet criteria
 */
function processMatch(
  match: RiotMatch,
  puuid: string,
  streamStartTimestamp: number
): ProcessedMatch | null {
  const { info } = match;

  // Filter: Only Ranked Solo/Duo (queueId: 420)
  if (info.queueId !== RANKED_SOLO_QUEUE_ID) {
    return null;
  }

  // Filter: Game must have started after stream started
  if (info.gameStartTimestamp < streamStartTimestamp) {
    return null;
  }

  // Find the player's participant data
  const participant = info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    return null;
  }

  return {
    matchId: match.metadata.matchId,
    gameStartTimestamp: info.gameStartTimestamp,
    win: participant.win,
    queueId: info.queueId,
  };
}

/**
 * Calculate win/loss record from processed matches
 */
export function calculateRecord(matches: ProcessedMatch[]): {
  wins: number;
  losses: number;
} {
  let wins = 0;
  let losses = 0;

  for (const match of matches) {
    if (match.win) {
      wins++;
    } else {
      losses++;
    }
  }

  return { wins, losses };
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
