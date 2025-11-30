# How to Use !record

A simple guide for streamers to set up the `!record` command for tracking your League of Legends ranked stats during streams.

## What Does It Do?

When viewers type `!record` in your chat, they'll see your current stream's ranked record:

```
Stream Record: 4W-2L | LP: +45
```

This shows:
- **4W-2L** - You've won 4 games and lost 2 games this stream
- **LP: +45** - You've gained 45 LP total this stream

When your stream is offline, it shows your last stream's record instead.

## Quick Setup (5 minutes)

### Step 1: Get Your Info Ready

You'll need:
- Your **Riot ID** (the name you see in League, like `YourName#NA1`)
- Your **region code** (see table below)

| Where You Play | Code |
|----------------|------|
| North America | `na1` |
| Europe West | `euw1` |
| Europe Nordic & East | `eun1` |
| Korea | `kr` |
| Brazil | `br1` |
| Latin America North | `la1` |
| Latin America South | `la2` |
| Oceania | `oc1` |
| Japan | `jp1` |
| Turkey | `tr1` |
| Russia | `ru` |

### Step 2: Add the Command to Nightbot

1. Go to your **Nightbot Dashboard** (or type in your chat if you're live)
2. Add this command, replacing the parts in `<brackets>`:

```
!commands add !record $(urlfetch https://lol-record.kazunhinged.workers.dev?summoner=<your-summoner-name>&tag=<your-tag>&region=<your-region>&streamStart=$(twitch $(channel) "{{uptimeAt}}"))
```

### Example

If your Riot ID is `kazuyoshi#stink` (that's me) and you play on NA:

```
!commands add !record $(urlfetch https://lol-record.kazunhinged.workers.dev?summoner=kazuyoshi&tag=stink&region=na1&streamStart=$(twitch $(channel) "{{uptimeAt}}"))
```

**Note:** If your name has spaces (like `The Lion#wreck`), just type it normally - Nightbot handles it. Shoutout Nickich I used him to test.

ALSO - You don't need to add your twitch inside $(channel). The bot should handle it automatically.

## How It Works

1. Someone types `!record` in your chat
2. Nightbot checks your match history since the stream started
3. It counts your wins and losses in ranked Solo/Duo
4. It shows the total LP you've gained or lost

## Tips for Best Results

### LP Tracking

**Good news!** LP tracking works automatically as long as `!record` is used **before your first ranked game** of the stream. The system will capture your starting LP on the first request.

**Recommended:** Set up an automatic `!record` trigger when your stream starts (see below). This ensures LP tracking is always accurate without you having to remember anything.

If `!record` is first used after games have already been played, the win/loss record will still be accurate - only the LP tracking might be off for those early games.

### Auto-Trigger !record on Stream Start (Recommended)

To ensure LP tracking is always accurate, set up Nightbot to automatically run `!record` when your stream starts:

1. Go to your **Nightbot Dashboard** → **Timers**
2. Click **Add** to create a new timer
3. Configure it:
   - **Name:** `Auto Record`
   - **Message:** `!record`
   - **Interval:** `30` minutes (max 60 minutes)
   - **Chat Lines:** `0` (runs even without chat activity)
4. **Important:** Enable "Only when live" if available, or just let it run - the command handles offline gracefully

**Alternative - Use a stream start trigger:**

If you use a stream deck or streaming software with chat integration:
- Add `!record` to your "Go Live" automation/macro
- This triggers once when you start streaming, capturing your LP immediately

### What Counts
- Only **ranked Solo/Duo** games count
- Flex queue, normals, and ARAM don't affect your record
- Games must **finish** to be counted (in-progress games don't show yet)

### Stream Restarts
If your stream crashes and you restart within 10 minutes, your record continues from where it was. No need to worry about losing your stats!

## Common Questions

**Q: Why does it say "No ranked games this stream yet!"?**
A: You haven't finished any ranked Solo/Duo games since the stream started.

**Q: Why does LP show "N/A"?**
A: This can happen if:
- You haven't played ranked Solo/Duo this season
- The first `!record` was used after games were already played (set up auto-trigger to avoid this!)
- The Riot API couldn't fetch your ranked data

**Q: Can I track Flex queue?**
A: Currently only Solo/Duo is tracked.

**Q: The record seems wrong?**
A: Make sure your Riot ID and region are correct in the command. Also, games take a few minutes to appear in the Riot API after they finish.

**Q: Can viewers spam the command?**
A: Nightbot has built-in cooldowns. You can also set a custom cooldown when adding the command.

## Need Help?

If something isn't working:
1. Double-check your Riot ID spelling
2. Make sure the region code is lowercase (`na1` not `NA1`)
3. Wait a few minutes after a game ends for it to show up
4. Ask your developer to check the worker logs

---

Happy streaming! May your LP gains be plentiful and your chat be merciful.
