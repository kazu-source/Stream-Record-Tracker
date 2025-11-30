import { Env, GameType, PlatformRegion, SessionData } from "../types";
import { SessionManager } from "../session-manager";

/**
 * Result from a game handler
 */
export interface GameHandlerResult {
  response: string;
  session?: SessionData;
}

/**
 * Common context passed to game handlers
 */
export interface GameHandlerContext {
  env: Env;
  sessionManager: SessionManager;
  summoner: string;
  tag: string;
  region: PlatformRegion;
  streamStart: string;
  testStartLp: number | null;
}

/**
 * Abstract interface for game-specific handlers
 * Each game (LoL, TFT, VALORANT) implements this interface
 */
export interface GameHandler {
  /**
   * The game type this handler supports
   */
  readonly gameType: GameType;

  /**
   * Handle an online stream request
   * Fetches matches, calculates record, updates session
   */
  handleOnlineStream(ctx: GameHandlerContext): Promise<GameHandlerResult>;

  /**
   * Handle an offline stream request
   * Returns the last session's record
   */
  handleOfflineStream(
    sessionManager: SessionManager,
    summoner: string,
    tag: string
  ): Promise<GameHandlerResult>;

  /**
   * Format the response string for this game
   */
  formatResponse(
    wins: number,
    losses: number,
    lpChange: number | null,
    extra?: Record<string, unknown>
  ): string;
}
