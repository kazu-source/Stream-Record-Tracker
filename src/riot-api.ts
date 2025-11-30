import {
  Env,
  RiotAccount,
  RiotSummoner,
  RiotMatch,
  LeagueEntry,
  PlatformRegion,
  RegionalRoute,
  REGION_TO_ROUTE,
} from "./types";

const CACHE_TTL = {
  PUUID: 86400,      // 24 hours - rarely changes
  SUMMONER: 3600,    // 1 hour
  MATCH_LIST: 120,   // 2 minutes - for fresh data
  MATCH_DETAIL: 3600, // 1 hour - match data is immutable
  RANKED_STATS: 120, // 2 minutes - LP can change quickly
};

export class RiotApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public isRateLimited: boolean = false
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}

export class RiotApiClient {
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
      throw new RiotApiError("Rate limited", 429, true);
    }

    if (!response.ok) {
      throw new RiotApiError(
        `API request failed: ${response.statusText}`,
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
   * Get PUUID from Riot ID (gameName#tagLine)
   */
  async getAccountByRiotId(
    gameName: string,
    tagLine: string,
    region: PlatformRegion
  ): Promise<RiotAccount> {
    const route = this.getRegionalRoute(region);
    const url = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const cacheKey = `account:${gameName}:${tagLine}`;

    return this.fetchWithCache<RiotAccount>(url, cacheKey, CACHE_TTL.PUUID);
  }

  /**
   * Get Summoner data from PUUID (needed for summoner ID for ranked stats)
   */
  async getSummonerByPuuid(
    puuid: string,
    region: PlatformRegion
  ): Promise<RiotSummoner> {
    const url = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    const cacheKey = `summoner:${puuid}`;

    return this.fetchWithCache<RiotSummoner>(url, cacheKey, CACHE_TTL.SUMMONER);
  }

  /**
   * Get list of recent match IDs
   */
  async getMatchHistory(
    puuid: string,
    region: PlatformRegion,
    count: number = 20,
    startTime?: number
  ): Promise<string[]> {
    const route = this.getRegionalRoute(region);
    let url = `https://${route}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`;

    if (startTime) {
      // Convert to seconds for API
      const startTimeSeconds = Math.floor(startTime / 1000);
      url += `&startTime=${startTimeSeconds}`;
    }

    // Short cache for match list to get fresh data
    const cacheKey = `matches:${puuid}:${count}:${startTime || "all"}`;
    return this.fetchWithCache<string[]>(url, cacheKey, CACHE_TTL.MATCH_LIST);
  }

  /**
   * Get match details by match ID
   */
  async getMatch(
    matchId: string,
    region: PlatformRegion
  ): Promise<RiotMatch> {
    const route = this.getRegionalRoute(region);
    const url = `https://${route}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
    const cacheKey = `match:${matchId}`;

    // Match data is immutable, cache longer
    return this.fetchWithCache<RiotMatch>(url, cacheKey, CACHE_TTL.MATCH_DETAIL);
  }

  /**
   * Get ranked stats for a summoner by PUUID
   */
  async getRankedStats(
    puuid: string,
    region: PlatformRegion
  ): Promise<LeagueEntry[]> {
    const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
    const cacheKey = `ranked:${puuid}`;

    return this.fetchWithCache<LeagueEntry[]>(url, cacheKey, CACHE_TTL.RANKED_STATS);
  }

  /**
   * Get current Solo/Duo LP
   */
  async getCurrentSoloQueueLp(
    puuid: string,
    region: PlatformRegion
  ): Promise<number | null> {
    try {
      const entries = await this.getRankedStats(puuid, region);
      console.log("Ranked entries:", JSON.stringify(entries));
      const soloQueue = entries.find(e => e.queueType === "RANKED_SOLO_5x5");

      if (!soloQueue) {
        console.log("No RANKED_SOLO_5x5 found in entries");
        return null;
      }
      console.log("Solo queue data:", JSON.stringify(soloQueue));

      // Calculate total LP based on tier
      const tierLp = this.getTierBaseLp(soloQueue.tier);
      const rankLp = this.getRankLp(soloQueue.rank);

      return tierLp + rankLp + soloQueue.leaguePoints;
    } catch (error) {
      console.log("Error fetching ranked stats:", error);
      return null;
    }
  }

  /**
   * Get base LP for a tier (for calculating net LP changes across promotions/demotions)
   */
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

  /**
   * Get LP offset for a rank within a tier
   */
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
