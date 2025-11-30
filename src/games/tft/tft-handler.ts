import { GameHandler, GameHandlerContext, GameHandlerResult } from "../game-handler";
import { GameType, RiotAccount, REGION_TO_ROUTE } from "../../types";
import { SessionManager } from "../../session-manager";
import { TftApiClient, getTftStreamMatches, calculateTftRecord } from "./tft-api";
import { formatTftStreamRecord, formatTftOfflineRecord } from "./tft-formatter";

const RESPONSES = {
  NO_GAMES: "No ranked TFT games this stream yet!",
  OFFLINE_NO_DATA: "Stream is offline. No previous TFT record found.",
};

export class TftHandler implements GameHandler {
  readonly gameType: GameType = "tft";

  async handleOnlineStream(ctx: GameHandlerContext): Promise<GameHandlerResult> {
    const { env, sessionManager, summoner, tag, region, streamStart, testStartLp } = ctx;
    const tftClient = new TftApiClient(env);

    // Resolve session (new vs continuation)
    const { isNewSession, effectiveStreamStart, existingSession } =
      await sessionManager.resolveSession(this.gameType, summoner, tag, streamStart);

    // Get account data (using the standard Riot account endpoint)
    const route = REGION_TO_ROUTE[region] || "americas";
    const accountUrl = `https://${route}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summoner)}/${encodeURIComponent(tag)}`;

    const accountResponse = await fetch(accountUrl, {
      headers: { "X-Riot-Token": env.RIOT_API_KEY },
    });

    if (!accountResponse.ok) {
      throw new Error(`Failed to get account: ${accountResponse.statusText}`);
    }

    const account = await accountResponse.json() as RiotAccount;
    console.log("TFT Account PUUID:", account.puuid);

    // Get current LP for comparison
    const currentLpResult = await tftClient.getCurrentTftLp(account.puuid, region);
    console.log("TFT Current LP result:", currentLpResult);

    // Get matches since stream started
    const streamStartTimestamp = new Date(effectiveStreamStart).getTime();
    const matches = await getTftStreamMatches(
      tftClient,
      account.puuid,
      region,
      streamStartTimestamp
    );

    // Calculate record
    const { wins, losses, placements } = calculateTftRecord(matches);
    const gamesPlayed = wins + losses;

    // Determine starting LP
    let startingLp: number | null;
    if (testStartLp !== null) {
      console.log("Using test starting LP:", testStartLp);
      startingLp = testStartLp;
    } else if (isNewSession) {
      if (gamesPlayed === 0) {
        // No games played yet - current LP IS the starting LP
        console.log("No TFT games played yet, capturing current LP as starting LP:", currentLpResult);
        startingLp = currentLpResult;
      } else {
        // Games already played before first !record
        console.log("TFT games already played before first !record, LP tracking may be inaccurate");
        startingLp = currentLpResult;
      }
    } else {
      // For continued session, use stored starting LP
      startingLp = existingSession?.startingLp ?? null;
    }

    // Calculate LP change
    let lpChange: number | null = null;
    if (startingLp !== null && currentLpResult !== null) {
      lpChange = currentLpResult - startingLp;
    }

    // Update session
    const updatedSession = isNewSession
      ? sessionManager.createNewSession(this.gameType, effectiveStreamStart, startingLp)
      : sessionManager.updateSession(existingSession!, wins, losses, lpChange);

    // Save with updated values
    updatedSession.wins = wins;
    updatedSession.losses = losses;
    updatedSession.placements = placements;
    if (lpChange !== null) {
      updatedSession.lpChange = lpChange;
    }

    await sessionManager.saveSession(this.gameType, summoner, tag, updatedSession);

    // Check if no games played
    if (wins === 0 && losses === 0) {
      return { response: RESPONSES.NO_GAMES, session: updatedSession };
    }

    // Return formatted response
    const response = formatTftStreamRecord(wins, losses, placements, lpChange);
    return { response, session: updatedSession };
  }

  async handleOfflineStream(
    sessionManager: SessionManager,
    summoner: string,
    tag: string
  ): Promise<GameHandlerResult> {
    const lastSession = await sessionManager.getSession(this.gameType, summoner, tag);

    if (!lastSession || (lastSession.wins === 0 && lastSession.losses === 0)) {
      return { response: RESPONSES.OFFLINE_NO_DATA };
    }

    const placements = lastSession.placements || [];
    const response = formatTftOfflineRecord(
      lastSession.wins,
      lastSession.losses,
      placements,
      lastSession.lpChange
    );

    return { response, session: lastSession };
  }

  formatResponse(
    wins: number,
    losses: number,
    lpChange: number | null,
    extra?: Record<string, unknown>
  ): string {
    const placements = (extra?.placements as number[]) || [];
    return formatTftStreamRecord(wins, losses, placements, lpChange);
  }
}
