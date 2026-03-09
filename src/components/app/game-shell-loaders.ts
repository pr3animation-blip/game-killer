"use client";

export function preloadClassSelect(): Promise<typeof import("@/components/menu/class-select")> {
  return import("@/components/menu/class-select");
}

export function preloadGameCanvas(): Promise<typeof import("@/components/game/game-canvas")> {
  return import("@/components/game/game-canvas");
}
