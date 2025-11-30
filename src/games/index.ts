import { GameHandler } from "./game-handler";
import { GameType } from "../types";
import { LoLHandler } from "./lol";
import { TftHandler } from "./tft";

// Registry of game handlers
const handlers: Map<GameType, GameHandler> = new Map();

// Register handlers
handlers.set("lol", new LoLHandler());
handlers.set("tft", new TftHandler());
// VALORANT handler will be added in Phase 3

/**
 * Get the handler for a specific game type
 * Falls back to LoL handler if game type not supported
 */
export function getGameHandler(gameType: GameType): GameHandler {
  const handler = handlers.get(gameType);
  if (!handler) {
    console.log(`No handler for game type: ${gameType}, falling back to LoL`);
    return handlers.get("lol")!;
  }
  return handler;
}

/**
 * Check if a game type is supported
 */
export function isGameSupported(gameType: GameType): boolean {
  return handlers.has(gameType);
}

export type { GameHandler, GameHandlerContext, GameHandlerResult } from "./game-handler";
export { LoLHandler } from "./lol";
export { TftHandler } from "./tft";
