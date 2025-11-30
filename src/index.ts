import { Env, RequestParams, PlatformRegion, LpCaptureState, GameType, detectGameType } from "./types";
import { RiotApiClient, RiotApiError } from "./riot-api";
import { SessionManager } from "./session-manager";
import { TwitchApiClient } from "./twitch-api";
import { getGameHandler, GameHandlerContext } from "./games";

// Response messages
const RESPONSES = {
  API_UNAVAILABLE: "Stats temporarily unavailable",
  UNKNOWN_ERROR: "Unknown Error",
  MISSING_PARAMS: "Missing required parameters: summoner, tag, region",
  UNSUPPORTED_GAME: (game: string) => `Game "${game}" is not yet supported. Currently supported: League of Legends, Teamfight Tactics`,
};

export default {
  // HTTP request handler (for Nightbot !record command)
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Parse URL parameters
      const url = new URL(request.url);
      const params = parseParams(url);

      if (!params) {
        return textResponse(RESPONSES.MISSING_PARAMS);
      }

      const { summoner, tag, region, streamStart, testStartLp, game } = params;
      const platformRegion = region as PlatformRegion;

      // Get the appropriate game handler
      const handler = getGameHandler(game);
      console.log(`Processing ${game} request for ${summoner}#${tag}`);

      // Initialize session manager
      const sessionManager = new SessionManager(env);

      // Check if stream is offline
      if (sessionManager.isStreamOffline(streamStart)) {
        const result = await handler.handleOfflineStream(sessionManager, summoner, tag);
        return textResponse(result.response);
      }

      // Stream is online - create context and process
      const ctx: GameHandlerContext = {
        env,
        sessionManager,
        summoner,
        tag,
        region: platformRegion,
        streamStart: streamStart!,
        testStartLp,
      };

      const result = await handler.handleOnlineStream(ctx);
      return textResponse(result.response);

    } catch (error) {
      console.error("Worker error:", error);

      if (error instanceof RiotApiError) {
        if (error.isRateLimited) {
          return textResponse(RESPONSES.API_UNAVAILABLE);
        }
      }

      return textResponse(RESPONSES.UNKNOWN_ERROR);
    }
  },

  // Scheduled handler (cron trigger for automatic LP capture)
  // Note: Currently only supports LoL for the configured streamer
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduledLpCapture(env);
  },
};

/**
 * Parse and validate request parameters
 */
function parseParams(url: URL): RequestParams | null {
  const summoner = url.searchParams.get("summoner");
  const tag = url.searchParams.get("tag");
  const region = url.searchParams.get("region");
  const streamStart = url.searchParams.get("streamStart");
  const testStartLp = url.searchParams.get("testStartLp");
  const gameParam = url.searchParams.get("game");

  if (!summoner || !tag || !region) {
    return null;
  }

  // Detect game type from Twitch category (defaults to LoL for backward compatibility)
  const game = detectGameType(gameParam);
  console.log(`Detected game: ${game} (from param: ${gameParam || "none"})`);

  return {
    summoner,
    tag,
    region,
    streamStart,
    testStartLp: testStartLp ? parseInt(testStartLp, 10) : null,
    game,
  };
}

/**
 * Create a plain text response (for Nightbot)
 */
function textResponse(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Handle scheduled cron trigger for automatic LP capture
 * Checks if configured stream is live and captures starting LP
 * Note: Currently only supports LoL
 */
async function handleScheduledLpCapture(env: Env): Promise<void> {
  // Check if auto LP capture is configured
  const twitchChannel = env.TWITCH_CHANNEL;
  const summonerName = env.SUMMONER_NAME;
  const summonerTag = env.SUMMONER_TAG;
  const summonerRegion = env.SUMMONER_REGION as PlatformRegion | undefined;

  if (!twitchChannel || !summonerName || !summonerTag || !summonerRegion) {
    // Auto LP capture not configured, skip
    return;
  }

  const twitchClient = new TwitchApiClient(env);

  if (!twitchClient.isConfigured()) {
    console.log("Twitch API not configured, skipping LP capture");
    return;
  }

  const riotClient = new RiotApiClient(env);
  const sessionManager = new SessionManager(env);

  try {
    // Get current capture state
    const captureState = await sessionManager.getLpCaptureState(
      summonerName,
      summonerTag
    );
    const wasLive = captureState?.wasLive ?? false;

    // Check if stream is currently live
    const streamInfo = await twitchClient.getStreamInfo(twitchChannel);
    const isLive = streamInfo !== null && streamInfo.type === "live";

    if (isLive && !wasLive) {
      // Stream just went live! Capture the starting LP
      console.log(`Stream ${twitchChannel} just went live, capturing LP...`);

      const account = await riotClient.getAccountByRiotId(
        summonerName,
        summonerTag,
        summonerRegion
      );

      const currentLp = await riotClient.getCurrentSoloQueueLp(
        account.puuid,
        summonerRegion
      );

      const newState: LpCaptureState = {
        wasLive: true,
        capturedLp: currentLp,
        capturedAt: new Date().toISOString(),
        streamStartedAt: streamInfo.started_at,
      };

      await sessionManager.saveLpCaptureState(summonerName, summonerTag, newState);
      console.log(`Captured starting LP: ${currentLp} at stream start: ${streamInfo.started_at}`);
    } else if (!isLive && wasLive) {
      // Stream went offline
      console.log(`Stream ${twitchChannel} went offline`);

      const newState: LpCaptureState = {
        wasLive: false,
        capturedLp: captureState?.capturedLp ?? null,
        capturedAt: captureState?.capturedAt ?? null,
        streamStartedAt: captureState?.streamStartedAt ?? null,
      };

      await sessionManager.saveLpCaptureState(summonerName, summonerTag, newState);
    } else if (isLive) {
      // Still live, just update wasLive state if needed
      if (!captureState) {
        // First check while already live, capture LP now
        console.log(`Stream ${twitchChannel} is live (first check), capturing LP...`);

        const account = await riotClient.getAccountByRiotId(
          summonerName,
          summonerTag,
          summonerRegion
        );

        const currentLp = await riotClient.getCurrentSoloQueueLp(
          account.puuid,
          summonerRegion
        );

        const newState: LpCaptureState = {
          wasLive: true,
          capturedLp: currentLp,
          capturedAt: new Date().toISOString(),
          streamStartedAt: streamInfo.started_at,
        };

        await sessionManager.saveLpCaptureState(summonerName, summonerTag, newState);
        console.log(`Captured starting LP: ${currentLp}`);
      }
    }
  } catch (error) {
    console.error("Error in scheduled LP capture:", error);
  }
}
