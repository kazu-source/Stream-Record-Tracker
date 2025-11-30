import {
  Env,
  TftMatch,
  TftLeagueEntry,
  TftProcessedMatch,
  PlatformRegion,
  RegionalRoute,
  REGION_TO_ROUTE,
} from "../../types";

const CACHE_TTL = {
  MATCH_LIST: 120,   // 2 minutes
  MATCH_DETAIL: 3600, // 1 hour - match data is immutable
  RANKED_STATS: 120, // 2 minutes
};

export class TftApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isRateLimited: boolean = false
  ) {
    super(message);
    this.name = "TftApiError";
  }
}

export class TftApiClient {
  private apiKey: string;
  private cache: KVNamespace;

  constructor(env: Env) {
    this.apiKey = env.RIOT_API_KEY;
    this.cache = env.CACHE;
  }

  private getRegionalRoute(region: PlatformRegion): RegionalRoute {
    return REGION_TO_ROUTE[region] || "americas";
  }

  private async fetchWithCache<T>(
    url: string,
    cacheKey: string,
    ttl: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // Fetch from API
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": this.apiKey,
      },
    });

    if (response.status === 429) {
      throw new TftApiError("Rate limited", 429, true);
    }

    if (!response.ok) {
      throw new TftApiError(
        `TFT API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as T;

    // Cache the result
    await this.cache.put(cacheKey, JSON.stringify(data), {
      expirationTtl: ttl,
    });

    return data;
  }

  /**
   * Get TFT match history for a player
   */
  async getMatchHistory(
    puuid: string,
    region: PlatformRegion,
    count: number = 20,
    startTime?: number
  ): Promise<string[]> {
    const route = this.getRegionalRoute(region);
    let url = `https://${route}.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=${count}`;

    if (startTime) {
      const startTimeSeconds = Math.floor(startTime / 1000);
      url += `&startTime=${startTimeSeconds}`;
    }

    const cacheKey = `tft-matches:${puuid}:${count}:${startTime || "all"}`;
    return this.fetchWithCache<string[]>(url, cacheKey, CACHE_TTL.MATCH_LIST);
  }

  /**
   * Get TFT match details
   */
  async getMatch(
    matchId: string,
    region: PlatformRegion
  ): Promise<TftMatch> {
    const route = this.getRegionalRoute(region);
    const url = `https://${route}.api.riotgames.com/tft/match/v1/matches/${matchId}`;
    const cacheKey = `tft-match:${matchId}`;

    return this.fetchWithCache<TftMatch>(url, cacheKey, CACHE_TTL.MATCH_DETAIL);
  }

  /**
   * Get TFT ranked stats for a summoner
   * Note: TFT uses summoner ID, not PUUID for ranked stats
   */
  async getRankedStatsBySummonerId(
    summonerId: string,
    region: PlatformRegion
  ): Promise<TftLeagueEntry[]> {
    const url = `https://${region}.api.riotgames.com/tft/league/v1/entries/by-summoner/${summonerId}`;
    const cacheKey = `tft-ranked:${summonerId}`;

    return this.fetchWithCache<TftLeagueEntry[]>(url, cacheKey, CACHE_TTL.RANKED_STATS);
  }

  /**
   * Get summoner ID from PUUID (needed for TFT ranked stats)
   */
  async getSummonerByPuuid(
    puuid: string,
    region: PlatformRegion
  ): Promise<{ id: string; accountId: string; puuid: string }> {
    // TFT uses the same summoner endpoint as LoL
    const url = `https://${region}.api.riotgames.com/tft/summoner/v1/summoners/by-puuid/${puuid}`;
    const cacheKey = `tft-summoner:${puuid}`;

    return this.fetchWithCache<{ id: string; accountId: string; puuid: string }>(
      url,
      cacheKey,
      3600 // 1 hour cache for summoner data
    );
  }

  /**
   * Get current TFT LP
   */
  async getCurrentTftLp(
    puuid: string,
    region: PlatformRegion
  ): Promise<number | null> {
    try {
      // First get summoner ID
      const summoner = await this.getSummonerByPuuid(puuid, region);

      // Then get ranked stats
      const entries = await this.getRankedStatsBySummonerId(summoner.id, region);
      console.log("TFT Ranked entries:", JSON.stringify(entries));

      const tftRanked = entries.find(e => e.queueType === "RANKED_TFT");

      if (!tftRanked) {
        console.log("No RANKED_TFT found in entries");
        return null;
      }
      console.log("TFT ranked data:", JSON.stringify(tftRanked));

      // Calculate total LP based on tier (same system as LoL)
      const tierLp = this.getTierBaseLp(tftRanked.tier);
      const rankLp = this.getRankLp(tftRanked.rank);

      return tierLp + rankLp + tftRanked.leaguePoints;
    } catch (error) {
      console.log("Error fetching TFT ranked stats:", error);
      return null;
    }
  }

  private getTierBaseLp(tier: string): number {
    const tiers: Record<string, number> = {
      IRON: 0,
      BRONZE: 400,
      SILVER: 800,
      GOLD: 1200,
      PLATINUM: 1600,
      EMERALD: 2000,
      DIAMOND: 2400,
      MASTER: 2800,
      GRANDMASTER: 2800,
      CHALLENGER: 2800,
    };
    return tiers[tier] || 0;
  }

  private getRankLp(rank: string): number {
    const ranks: Record<string, number> = {
      IV: 0,
      III: 100,
      II: 200,
      I: 300,
    };
    return ranks[rank] || 0;
  }
}

/**
 * Fetch and process TFT matches for a stream session
 */
export async function getTftStreamMatches(
  client: TftApiClient,
  puuid: string,
  region: PlatformRegion,
  streamStartTimestamp: number
): Promise<TftProcessedMatch[]> {
  const matchIds = await client.getMatchHistory(
    puuid,
    region,
    20,
    streamStartTimestamp
  );

  if (matchIds.length === 0) {
    return [];
  }

  const processedMatches: TftProcessedMatch[] = [];

  for (const matchId of matchIds) {
    try {
      const match = await client.getMatch(matchId, region);
      const processed = processTftMatch(match, puuid, streamStartTimestamp);

      if (processed) {
        processedMatches.push(processed);
      }

      // Small delay between requests
      await sleep(50);
    } catch (error) {
      if (error instanceof TftApiError && error.isRateLimited) {
        break;
      }
      console.error(`Failed to fetch TFT match ${matchId}:`, error);
    }
  }

  // Sort by game time (oldest first)
  return processedMatches.sort(
    (a, b) => a.gameTimestamp - b.gameTimestamp
  );
}

function processTftMatch(
  match: TftMatch,
  puuid: string,
  streamStartTimestamp: number
): TftProcessedMatch | null {
  const { info } = match;

  // Filter: Game must have started after stream started
  if (info.game_datetime < streamStartTimestamp) {
    return null;
  }

  // Find the player's participant data
  const participant = info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    return null;
  }

  const placement = participant.placement;
  const isTop4 = placement <= 4;
  const isWin = placement === 1; // Only 1st place is a "win"

  return {
    matchId: match.metadata.match_id,
    gameTimestamp: info.game_datetime,
    placement,
    isWin,
    isTop4,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate TFT record from matches
 * Returns wins (1st place only) and losses (5th-8th place)
 * Top 4 = Win for display, Bottom 4 = Loss
 */
export function calculateTftRecord(matches: TftProcessedMatch[]): {
  wins: number;      // Top 4 count (for W-L display)
  losses: number;    // Bottom 4 count
  firsts: number;    // 1st place count
  placements: number[]; // Last 5 placements
} {
  let wins = 0;    // Top 4
  let losses = 0;  // Bottom 4
  let firsts = 0;  // 1st place

  for (const match of matches) {
    if (match.isTop4) {
      wins++;
      if (match.isWin) {
        firsts++;
      }
    } else {
      losses++;
    }
  }

  // Get last 5 placements (most recent first)
  const recentMatches = [...matches].sort((a, b) => b.gameTimestamp - a.gameTimestamp);
  const placements = recentMatches.slice(0, 5).map(m => m.placement);

  return { wins, losses, firsts, placements };
}
