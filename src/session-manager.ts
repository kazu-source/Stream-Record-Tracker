import { Env, SessionData, LpCaptureState, GameType } from "./types";

// Restart window: if stream restarts within 10 minutes, treat as same session
const RESTART_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export class SessionManager {
  private cache: KVNamespace;

  constructor(env: Env) {
    this.cache = env.CACHE;
  }

  /**
   * Generate session key for a player (game-aware)
   */
  private getSessionKey(game: GameType, summoner: string, tag: string): string {
    return `session:${game}:${summoner.toLowerCase()}:${tag.toLowerCase()}`;
  }

  /**
   * Check if stream is offline (no streamStart provided)
   */
  isStreamOffline(streamStart: string | null): boolean {
    return !streamStart || streamStart.trim() === "";
  }

  /**
   * Get existing session data for a specific game
   */
  async getSession(game: GameType, summoner: string, tag: string): Promise<SessionData | null> {
    const key = this.getSessionKey(game, summoner, tag);
    const data = await this.cache.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as SessionData;
  }

  /**
   * Save session data for a specific game
   */
  async saveSession(
    game: GameType,
    summoner: string,
    tag: string,
    session: SessionData
  ): Promise<void> {
    const key = this.getSessionKey(game, summoner, tag);
    await this.cache.put(key, JSON.stringify(session));
  }

  /**
   * Determine if this is a new session or continuation
   * Returns the effective stream start time to use
   */
  async resolveSession(
    game: GameType,
    summoner: string,
    tag: string,
    currentStreamStart: string
  ): Promise<{
    isNewSession: boolean;
    effectiveStreamStart: string;
    existingSession: SessionData | null;
  }> {
    const existingSession = await this.getSession(game, summoner, tag);

    if (!existingSession) {
      // No existing session, this is a new one
      return {
        isNewSession: true,
        effectiveStreamStart: currentStreamStart,
        existingSession: null,
      };
    }

    const existingStart = new Date(existingSession.streamStart).getTime();
    const currentStart = new Date(currentStreamStart).getTime();

    // Check if this is a stream restart within the window
    const timeDiff = Math.abs(currentStart - existingStart);

    if (timeDiff <= RESTART_WINDOW_MS) {
      // Stream restart detected, continue existing session
      return {
        isNewSession: false,
        effectiveStreamStart: existingSession.streamStart,
        existingSession,
      };
    }

    // Check if the existing session's lastSeen is recent
    // This handles case where stream ended and restarted
    const lastSeen = new Date(existingSession.lastSeen).getTime();
    const now = Date.now();
    const timeSinceLastSeen = now - lastSeen;

    if (timeSinceLastSeen <= RESTART_WINDOW_MS) {
      // Recent activity, check if current start is after last seen
      // This means it's likely a restart
      if (currentStart > lastSeen - RESTART_WINDOW_MS) {
        return {
          isNewSession: false,
          effectiveStreamStart: existingSession.streamStart,
          existingSession,
        };
      }
    }

    // New session - different stream start time beyond the window
    return {
      isNewSession: true,
      effectiveStreamStart: currentStreamStart,
      existingSession,
    };
  }

  /**
   * Create a new session for a specific game
   */
  createNewSession(game: GameType, streamStart: string, startingLp: number | null): SessionData {
    return {
      gameType: game,
      streamStart,
      lastSeen: new Date().toISOString(),
      wins: 0,
      losses: 0,
      lpChange: 0,
      startingLp,
      placements: game === "tft" ? [] : undefined,
    };
  }

  /**
   * Update session with new match results
   */
  updateSession(
    session: SessionData,
    wins: number,
    losses: number,
    lpChange: number | null
  ): SessionData {
    return {
      ...session,
      lastSeen: new Date().toISOString(),
      wins,
      losses,
      lpChange: lpChange ?? session.lpChange,
    };
  }

  // ===== LP Capture Methods (for automatic stream detection) =====

  /**
   * Generate LP capture state key for a player
   */
  private getLpCaptureKey(summoner: string, tag: string): string {
    return `lp-capture:${summoner.toLowerCase()}:${tag.toLowerCase()}`;
  }

  /**
   * Get LP capture state
   */
  async getLpCaptureState(
    summoner: string,
    tag: string
  ): Promise<LpCaptureState | null> {
    const key = this.getLpCaptureKey(summoner, tag);
    const data = await this.cache.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as LpCaptureState;
  }

  /**
   * Save LP capture state
   */
  async saveLpCaptureState(
    summoner: string,
    tag: string,
    state: LpCaptureState
  ): Promise<void> {
    const key = this.getLpCaptureKey(summoner, tag);
    // Store for 24 hours (in case stream is very long)
    await this.cache.put(key, JSON.stringify(state), {
      expirationTtl: 86400,
    });
  }

  /**
   * Get the captured starting LP for a stream session
   * Returns the LP that was captured when the stream went live
   */
  async getCapturedStartingLp(
    summoner: string,
    tag: string,
    streamStart: string
  ): Promise<number | null> {
    const state = await this.getLpCaptureState(summoner, tag);

    if (!state || !state.capturedLp || !state.streamStartedAt) {
      return null;
    }

    // Check if the captured LP is for this stream session
    const capturedStreamStart = new Date(state.streamStartedAt).getTime();
    const currentStreamStart = new Date(streamStart).getTime();

    // Allow 5 minute window for timing differences
    const timeDiff = Math.abs(capturedStreamStart - currentStreamStart);
    if (timeDiff <= 5 * 60 * 1000) {
      console.log("Using auto-captured starting LP:", state.capturedLp);
      return state.capturedLp;
    }

    return null;
  }
}
