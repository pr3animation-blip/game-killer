"use client";

import { useEffect, useRef } from "react";
import { MenuScene } from "@/game/menu-scene";

export function MenuBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new MenuScene(canvasRef.current);
    scene.start();

    return () => {
      scene.dispose();
    };
  }, []);

  return (
    <div
      className="menu-live-scene pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
