# LoL-Record

A Cloudflare Worker that tracks your League of Legends ranked stats during Twitch streams. Integrates with Nightbot to provide a `!record` command for viewers.

## Features

- Track Win/Loss record during stream sessions
- Track LP gains/losses
- **Smart LP capture** - Automatically captures starting LP on first `!record` if no games played yet
- **Optional: Twitch integration** - Detects when stream goes live and captures LP via cron (for worker owner)
- Automatic stream session detection (handles restarts and subathons)
- Offline support (shows last stream's record)
- Rate limit mitigation via caching

## Example Output

**Live stream:**
```
Stream Record: 4W-2L | LP: +45
```

**Stream offline:**
```
Stream is offline. Last stream's record: 4W-2L | LP: +45
```

## Prerequisites

1. **Node.js** (v18 or later)
2. **Cloudflare Account** (free tier works)
3. **Riot Games API Key** - Get one at [developer.riotgames.com](https://developer.riotgames.com/)

## Setup Instructions

### 1. Install Dependencies

```bash
cd LoL-record
npm install
```

### 2. Install Wrangler CLI (if not already installed)

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

### 4. Create KV Namespace

```bash
wrangler kv namespace create "CACHE"
```

This will output something like:
```
{ binding = "CACHE", id = "xxxxxxxxxxxxxxxxxxxx" }
```

### 5. Configure wrangler.toml

Edit `wrangler.toml` and add your KV namespace ID:

```toml
name = "lol-record"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id-here"
```

### 6. Add Your Riot API Key

```bash
wrangler secret put RIOT_API_KEY
# Enter your API key when prompted
```

### 7. Deploy

```bash
npm run deploy
```

Your worker will be deployed to: `https://lol-record.<your-subdomain>.workers.dev`

### 8. (Optional) Enable Twitch Stream Detection

**Note:** This step is optional. LP tracking already works automatically when `!record` is used before any games are played. This Twitch integration adds an extra layer that captures LP even if no one uses the command.

This detects when your stream goes live and captures your starting LP automatically via a cron job that runs every 2 minutes.

#### Create a Twitch Application

1. Go to [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Click **Register Your Application**
3. Fill in:
   - Name: `LoL Record` (or anything)
   - OAuth Redirect URLs: `http://localhost` (not used, but required)
   - Category: `Application Integration`
4. Click **Create**
5. Click **Manage** on your new app
6. Copy the **Client ID** and generate a **Client Secret**

#### Add Twitch Credentials

```bash
wrangler secret put TWITCH_CLIENT_ID
# Enter your Twitch Client ID

wrangler secret put TWITCH_CLIENT_SECRET
# Enter your Twitch Client Secret
```

#### Configure Your Streamer Info

Edit `wrangler.toml` and uncomment/set these variables:

```toml
[vars]
TWITCH_CHANNEL = "your_twitch_username"
SUMMONER_NAME = "YourRiotName"
SUMMONER_TAG = "NA1"
SUMMONER_REGION = "na1"
```

#### Redeploy

```bash
npm run deploy
```

The worker will now check every 2 minutes if your stream is live. When it detects your stream going live, it automatically captures your LP before any games are played.

### Finding Your Workers Subdomain

If you don't know your Cloudflare Workers subdomain:

```bash
wrangler whoami
```

Or check the Cloudflare dashboard: **Workers & Pages** → your subdomain is shown at the top.

## Nightbot Setup

Add the `!record` command in your Nightbot dashboard or via chat:

```
!commands add !record $(urlfetch https://lol-record.<your-subdomain>.workers.dev?summoner=<name>&tag=<tag>&region=<region>&streamStart=$(twitch $(channel) "{{uptimeAt}}"))
```

### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `summoner` | Your Riot ID game name | `Faker` |
| `tag` | Your Riot ID tagline (after #) | `KR1` |
| `region` | Your server region code (lowercase) | `na1` |
| `streamStart` | Auto-filled by Nightbot | - |

### Region Codes

| Region | Code |
|--------|------|
| North America | `na1` |
| Europe West | `euw1` |
| Europe Nordic & East | `eun1` |
| Korea | `kr` |
| Japan | `jp1` |
| Brazil | `br1` |
| Latin America North | `la1` |
| Latin America South | `la2` |
| Oceania | `oc1` |
| Turkey | `tr1` |
| Russia | `ru` |

### Example Command

For a player named `DragonSlayer#NA1` on the NA server:

```
!commands add !record $(urlfetch https://lol-record.mysubdomain.workers.dev?summoner=DragonSlayer&tag=NA1&region=na1&streamStart=$(twitch $(channel) "{{uptimeAt}}"))
```

**Testing on another channel:** Replace `$(channel)` with a hardcoded channel name:

```
!commands add !record $(urlfetch https://lol-record.mysubdomain.workers.dev?summoner=DragonSlayer&tag=NA1&region=na1&streamStart=$(twitch some_channel "{{uptimeAt}}"))
```

### Auto-Trigger on Stream Start (Recommended)

For accurate LP tracking, set up a Nightbot timer to automatically run `!record` when your stream starts:

1. Go to **Nightbot Dashboard** → **Timers**
2. Create a new timer with:
   - **Name:** `Auto Record`
   - **Message:** `!record`
   - **Interval:** `5` minutes
   - **Chat Lines:** `0`

This ensures LP is captured before your first ranked game, even if no one manually uses the command.

## Development

### Run Locally

```bash
npm run dev
```

### Test the Endpoint

Use URL-encoded spaces (`%20`) for summoner names with spaces:

```bash
curl "http://localhost:8787?summoner=The%20Lion&tag=wreck&region=na1&streamStart=2024-01-15T18:00:00Z"
```

Or just paste the URL in your browser.

**Note:** The `streamStart` timestamp is in UTC (ISO 8601 format). The `Z` suffix indicates UTC time.

### Debug Parameter

For testing LP calculations, use the `testStartLp` parameter to override the starting LP:

```
?summoner=Name&tag=Tag&region=na1&streamStart=2024-01-15T18:00:00Z&testStartLp=3200
```

This simulates what the LP change would be if the session started at 3200 LP.

### View Logs

```bash
wrangler tail
```

Or use the npm script:

```bash
npm run tail
```

## How It Works

1. **Viewer types `!record`** in Twitch chat
2. **Nightbot** sends a request to your Cloudflare Worker with stream info
3. **Worker** checks if stream is live or offline
4. **If live**: Fetches match history from Riot API, filters for ranked Solo/Duo games since stream started
5. **Calculates** win/loss record and LP change
6. **Returns** formatted response to chat

### LP Tracking

LP tracking works by comparing current LP to the starting LP captured at the beginning of the stream session.

**Smart LP Capture:** When `!record` is first used in a session and no ranked games have been played yet, the current LP is automatically captured as the starting LP. This means LP tracking "just works" for any streamer as long as `!record` runs before their first game.

**Recommended:** Set up a Nightbot timer to auto-trigger `!record` when the stream starts. See [USAGE.md](USAGE.md) for instructions.

**Optional Twitch Integration:** For the worker owner (configured in `wrangler.toml`), there's an additional cron-based system that detects when the stream goes live and captures LP automatically - even if no one uses `!record`.

The W/L record is always accurate regardless of when `!record` is first used, as it's calculated from match history.

### Session Management

- Sessions are tracked per Riot ID
- If stream restarts within 10 minutes, the session continues (handles technical issues and 48h subathon resets)
- When stream goes offline, the last session's record is preserved

## Troubleshooting

### "Stats temporarily unavailable"
- Riot API rate limit hit. Wait a moment and try again.
- Check if your API key is valid and has the correct permissions.

### "LP: N/A"
- The player may not have Solo/Duo ranked data (only plays Flex or is unranked).
- LP tracking only works for `RANKED_SOLO_5x5` queue.

### "Missing required parameters"
- Ensure your Nightbot command includes all parameters: `summoner`, `tag`, `region`
- Make sure region is lowercase (e.g., `na1` not `NA1`)

### "Unknown Error"
- Check Cloudflare Worker logs: `wrangler tail`
- Verify your Riot ID and region are correct

### Wrangler Command Errors
If you get `Unknown arguments` errors with wrangler commands, you may be using an older syntax. Use spaces instead of colons:
- Old: `wrangler kv:namespace create`
- New: `wrangler kv namespace create`

## Rate Limits

Riot API has rate limits. This worker mitigates them by:
- Caching PUUID lookups (24 hours)
- Caching match details (1 hour)
- Caching match lists (2 minutes)
- Caching ranked stats (2 minutes)

## Technical Notes

This worker uses Riot's PUUID-based API endpoints for ranked stats (`/lol/league/v4/entries/by-puuid/`), which is the current recommended approach as of 2024.

## License

MIT
