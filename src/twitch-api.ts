import {
  Env,
  TwitchTokenResponse,
  TwitchStreamsResponse,
  TwitchStream,
} from "./types";

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";

// Cache token for 1 hour (tokens last ~60 days, but we refresh more often)
const TOKEN_CACHE_TTL = 3600;

export class TwitchApiClient {
  private clientId: string;
  private clientSecret: string;
  private cache: KVNamespace;

  constructor(env: Env) {
    this.clientId = env.TWITCH_CLIENT_ID || "";
    this.clientSecret = env.TWITCH_CLIENT_SECRET || "";
    this.cache = env.CACHE;
  }

  /**
   * Check if Twitch API is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get an app access token from Twitch
   */
  private async getAccessToken(): Promise<string | null> {
    // Try cache first
    const cached = await this.cache.get("twitch:token");
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(TWITCH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
        }),
      });

      if (!response.ok) {
        console.error("Failed to get Twitch token:", response.statusText);
        return null;
      }

      const data = (await response.json()) as TwitchTokenResponse;

      // Cache the token
      await this.cache.put("twitch:token", data.access_token, {
        expirationTtl: TOKEN_CACHE_TTL,
      });

      return data.access_token;
    } catch (error) {
      console.error("Error getting Twitch token:", error);
      return null;
    }
  }

  /**
   * Check if a channel is currently live
   */
  async getStreamInfo(channelName: string): Promise<TwitchStream | null> {
    const token = await this.getAccessToken();
    if (!token) {
      return null;
    }

    try {
      const url = `${TWITCH_STREAMS_URL}?user_login=${encodeURIComponent(channelName)}`;
      const response = await fetch(url, {
        headers: {
          "Client-ID": this.clientId,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to get stream info:", response.statusText);
        return null;
      }

      const data = (await response.json()) as TwitchStreamsResponse;

      // If data array is empty, stream is offline
      if (data.data.length === 0) {
        return null;
      }

      return data.data[0];
    } catch (error) {
      console.error("Error getting stream info:", error);
      return null;
    }
  }

  /**
   * Check if a channel is live (simple boolean check)
   */
  async isLive(channelName: string): Promise<boolean> {
    const stream = await this.getStreamInfo(channelName);
    return stream !== null && stream.type === "live";
  }
}
