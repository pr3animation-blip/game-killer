"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LiveMenuBackground = dynamic(
  () => import("@/components/menu/menu-background").then((mod) => mod.MenuBackground),
  { ssr: false }
);

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function DeferredMenuBackground() {
  const [showLiveBackground, setShowLiveBackground] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const showBackground = () => {
      timeoutId = window.setTimeout(() => {
        setShowLiveBackground(true);
      }, 150);
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(() => {
        showBackground();
      });
    } else {
      showBackground();
    }

    return () => {
      if (idleId !== null && typeof idleWindow.cancelIdleCallback === "function") {
        idleWindow.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <>
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_28%,rgba(160,120,80,0.16),transparent_24%),radial-gradient(circle_at_18%_78%,rgba(120,100,70,0.12),transparent_30%),linear-gradient(180deg,rgba(16,14,11,0.25),rgba(12,10,8,0.72))]" />
        <div className="absolute inset-x-[8%] top-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-[16%] bottom-[16%] h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
        <div className="absolute left-[10%] top-[18%] h-28 w-28 rounded-full border border-primary/14 bg-primary/6 blur-2xl" />
        <div className="absolute right-[14%] top-[24%] h-44 w-44 rounded-full border border-white/6 bg-white/4 blur-3xl" />
        <div className="absolute bottom-[12%] left-[20%] h-32 w-[38%] rounded-[2rem] border border-primary/10 bg-background/18 blur-2xl" />
      </div>

      {showLiveBackground ? <LiveMenuBackground /> : null}
    </>
  );
}
