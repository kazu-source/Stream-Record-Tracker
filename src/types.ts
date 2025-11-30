// Environment bindings for Cloudflare Worker
export interface Env {
  CACHE: KVNamespace;
  RIOT_API_KEY: string;
  // Twitch API credentials (for auto LP capture)
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  // Streamer config (for auto LP capture)
  TWITCH_CHANNEL?: string;
  SUMMONER_NAME?: string;
  SUMMONER_TAG?: string;
  SUMMONER_REGION?: string;
  // RSO credentials (for VALORANT)
  RSO_CLIENT_ID?: string;
  RSO_CLIENT_SECRET?: string;
  RSO_REDIRECT_URI?: string;
}

// Supported game types
export type GameType = "lol" | "tft" | "valorant";

// Request parameters from Nightbot
export interface RequestParams {
  summoner: string;
  tag: string;
  region: string;
  streamStart: string | null; // null when stream is offline
  testStartLp: number | null; // debug param to override starting LP
  game: GameType; // detected from Twitch category
}

/**
 * Detect game type from Twitch category string
 */
export function detectGameType(gameParam: string | null): GameType {
  if (!gameParam) return "lol"; // Backward compatibility

  const normalized = gameParam.toLowerCase();
  if (normalized.includes("teamfight tactics") || normalized === "tft") {
    return "tft";
  }
  if (normalized.includes("valorant")) {
    return "valorant";
  }
  return "lol"; // Default (includes "League of Legends")
}

// Riot API: Account response
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

// Riot API: Summoner response
export interface RiotSummoner {
  id: string;
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

// Riot API: Match participant data
export interface MatchParticipant {
  puuid: string;
  summonerName: string;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
}

// Riot API: Match info
export interface MatchInfo {
  gameCreation: number;
  gameDuration: number;
  gameEndTimestamp: number;
  gameStartTimestamp: number;
  queueId: number;
  participants: MatchParticipant[];
}

// Riot API: Full match response
export interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: MatchInfo;
}

// Riot API: Ranked league entry
export interface LeagueEntry {
  leagueId: string;
  summonerId: string;
  queueType: string; // "RANKED_SOLO_5x5" or "RANKED_FLEX_SR"
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

// Processed match result for our purposes
export interface ProcessedMatch {
  matchId: string;
  gameStartTimestamp: number;
  win: boolean;
  queueId: number;
}

// Session data stored in KV
export interface SessionData {
  gameType: GameType;
  streamStart: string;
  lastSeen: string;
  wins: number;
  losses: number;
  lpChange: number;
  startingLp: number | null;
  // TFT-specific: store last 5 placements
  placements?: number[];
}

// Final response data
export interface StreamRecord {
  wins: number;
  losses: number;
  lpChange: number;
  isOffline: boolean;
  hasData: boolean;
}

// Region routing for Riot API
export type PlatformRegion =
  | "na1" | "br1" | "la1" | "la2"  // Americas
  | "euw1" | "eun1" | "tr1" | "ru"  // Europe
  | "kr" | "jp1"                    // Asia
  | "oc1" | "ph2" | "sg2" | "th2" | "tw2" | "vn2"; // SEA

export type RegionalRoute = "americas" | "europe" | "asia" | "sea";

// Map platform regions to regional routes (for account/match APIs)
export const REGION_TO_ROUTE: Record<PlatformRegion, RegionalRoute> = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea",
};

// Queue IDs we care about
export const RANKED_SOLO_QUEUE_ID = 420;
export const RANKED_FLEX_QUEUE_ID = 440;

// TFT Queue IDs
export const TFT_RANKED_QUEUE_ID = 1100; // TFT Ranked

// ===== TFT Types =====

// TFT Match participant
export interface TftParticipant {
  puuid: string;
  placement: number; // 1-8
  level: number;
  gold_left: number;
  total_damage_to_players: number;
}

// TFT Match info
export interface TftMatchInfo {
  game_datetime: number;
  game_length: number;
  queue_id: number;
  tft_set_number: number;
  participants: TftParticipant[];
}

// TFT Match response
export interface TftMatch {
  metadata: {
    match_id: string;
    participants: string[];
  };
  info: TftMatchInfo;
}

// TFT Processed match for our purposes
export interface TftProcessedMatch {
  matchId: string;
  gameTimestamp: number;
  placement: number;
  isWin: boolean; // Top 4 = win for display purposes
  isTop4: boolean; // Top 4 for LP purposes
}

// TFT League entry
export interface TftLeagueEntry {
  leagueId: string;
  summonerId: string;
  queueType: string; // "RANKED_TFT"
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

// ===== VALORANT Types =====

// VALORANT regions (different from LoL)
export type ValorantRegion = "na" | "eu" | "ap" | "kr" | "br" | "latam";

// Map platform regions to VALORANT regions
export const PLATFORM_TO_VAL_REGION: Record<string, ValorantRegion> = {
  na1: "na",
  br1: "br",
  la1: "latam",
  la2: "latam",
  euw1: "eu",
  eun1: "eu",
  tr1: "eu",
  ru: "eu",
  kr: "kr",
  jp1: "ap",
  oc1: "ap",
  ph2: "ap",
  sg2: "ap",
  th2: "ap",
  tw2: "ap",
  vn2: "ap",
};

// VALORANT Match player
export interface ValMatchPlayer {
  puuid: string;
  gameName: string;
  tagLine: string;
  teamId: string;
  partyId: string;
  characterId: string;
  stats: {
    score: number;
    roundsPlayed: number;
    kills: number;
    deaths: number;
    assists: number;
  };
  competitiveTier: number;
}

// VALORANT Match team
export interface ValMatchTeam {
  teamId: string;
  won: boolean;
  roundsPlayed: number;
  roundsWon: number;
  numPoints: number;
}

// VALORANT Match info
export interface ValMatchInfo {
  matchId: string;
  mapId: string;
  gameStartMillis: number;
  gameLengthMillis: number;
  queueId: string;
  isRankedGame: boolean;
  seasonId: string;
  players: ValMatchPlayer[];
  teams: ValMatchTeam[];
}

// VALORANT Match response
export interface ValMatch {
  matchInfo: ValMatchInfo;
}

// VALORANT Match list response
export interface ValMatchList {
  puuid: string;
  history: Array<{
    matchId: string;
    gameStartTimeMillis: number;
    queueId: string;
  }>;
}

// VALORANT Processed match
export interface ValProcessedMatch {
  matchId: string;
  gameStartTimestamp: number;
  win: boolean;
  competitiveTier: number;
}

// ===== RSO (Riot Sign On) Types =====

// RSO Token response from OAuth
export interface RsoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// RSO stored token data
export interface RsoStoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  puuid: string;
  gameName: string;
  tagLine: string;
}

// RSO account info response
export interface RsoAccountInfo {
  puuid: string;
  gameName: string;
  tagLine: string;
}

// Twitch API types
export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string; // "live" when streaming
  title: string;
  started_at: string;
}

export interface TwitchStreamsResponse {
  data: TwitchStream[];
}

// LP capture state stored in KV
export interface LpCaptureState {
  wasLive: boolean;
  capturedLp: number | null;
  capturedAt: string | null;
  streamStartedAt: string | null;
}
