# TODO

## In Progress

- [ ] **VALORANT Support** - Handler not yet implemented (Phase 3)
  - RSO (Riot Sign On) types are defined but handler is missing
  - Requires OAuth flow for VALORANT API access

## Planned Features

- [ ] **Auto Game Detection in Nightbot** - Add `game` parameter to USAGE.md examples
  - Currently defaults to LoL; users need `&game=$(twitch $(channel) "{{game}}")` for auto-switching

- [ ] **Flex Queue Support** - Currently only tracks Solo/Duo for LoL

- [ ] **TFT Double Up Support** - Track Double Up queue in addition to ranked

- [ ] **Multi-account Support** - Allow tracking multiple accounts per stream

## Nice to Have

- [ ] **Web Dashboard** - Visual display of stats instead of just text
- [ ] **Historical Stats** - Track stats across multiple streams
- [ ] **Streamer Leaderboard** - Compare stats across streamers using the service
- [ ] **Custom Response Templates** - Let users customize the output format

## Completed

- [x] League of Legends ranked Solo/Duo tracking
- [x] TFT ranked tracking with placements
- [x] LP change tracking
- [x] Session continuity (10-minute grace period for stream restarts)
- [x] Auto LP capture via cron trigger
- [x] Offline stream handling (shows last session)
- [x] Twitch API integration for stream status
