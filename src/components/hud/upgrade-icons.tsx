import type { UpgradeId } from "@/game/types";

interface UpgradeIconProps {
  upgradeId: UpgradeId;
  className?: string;
}

const iconSize = 28;

const svgProps = {
  width: iconSize,
  height: iconSize,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function TightChokeIcon() {
  return (
    <svg {...svgProps}>
      {/* Crosshair with tight inner ring */}
      <circle cx="12" cy="12" r="8" strokeDasharray="2 3" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function FastHandsIcon() {
  return (
    <svg {...svgProps}>
      {/* Fast reload — arrow cycling around a magazine */}
      <rect x="9" y="8" width="6" height="12" rx="1" />
      <path d="M7 6 L12 2 L17 6" />
      <polyline points="4,10 4,6 8,6" />
      <polyline points="20,14 20,18 16,18" />
      <path d="M4 10 C4 4 10 2 12 2" strokeDasharray="0" />
      <path d="M20 14 C20 20 14 22 12 22" strokeDasharray="0" />
    </svg>
  );
}

function OvercrankIcon() {
  return (
    <svg {...svgProps}>
      {/* Gear with lightning bolt */}
      <path d="M12 2 L13.5 5.5 L17 4 L15.5 7.5 L19.5 8 L16.5 10.5 L19 13.5 L15 13 L15 17 L12 14.5 L9 17 L9 13 L5 13.5 L7.5 10.5 L4.5 8 L8.5 7.5 L7 4 L10.5 5.5 Z" />
      <path d="M13 9 L11 12.5 L13.5 12.5 L11 16" strokeWidth="1.8" />
    </svg>
  );
}

function HollowPointIcon() {
  return (
    <svg {...svgProps}>
      {/* Bullet with hollow tip */}
      <path d="M12 3 C14 3 16 5 16 8 L16 18 C16 19.5 14 21 12 21 C10 21 8 19.5 8 18 L8 8 C8 5 10 3 12 3Z" />
      <ellipse cx="12" cy="5" rx="2.5" ry="1.5" />
      <line x1="8" y1="13" x2="16" y2="13" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function FleetStepIcon() {
  return (
    <svg {...svgProps}>
      {/* Speed boot with motion lines */}
      <path d="M7 20 L5 14 L7 8 L9 5 L11 5 L10 8 L13 7 L15 8 L14 11 L18 12 L19 16 L19 20 Z" />
      <line x1="2" y1="10" x2="5" y2="10" strokeWidth="1.2" />
      <line x1="1" y1="13" x2="4.5" y2="13" strokeWidth="1.2" />
      <line x1="2" y1="16" x2="5" y2="16" strokeWidth="1.2" />
    </svg>
  );
}

function DashCapacitorsIcon() {
  return (
    <svg {...svgProps}>
      {/* Double chevron dash with capacitor arcs */}
      <polyline points="5,18 12,12 5,6" strokeWidth="2.2" />
      <polyline points="13,18 20,12 13,6" strokeWidth="2.2" />
      <path d="M3 4 C1 8 1 16 3 20" strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
}

function ExtendedMagIcon() {
  return (
    <svg {...svgProps}>
      {/* Tall magazine with extra rounds */}
      <rect x="8" y="2" width="8" height="20" rx="1.5" />
      <line x1="10" y1="6" x2="14" y2="6" strokeWidth="1.2" />
      <line x1="10" y1="9.5" x2="14" y2="9.5" strokeWidth="1.2" />
      <line x1="10" y1="13" x2="14" y2="13" strokeWidth="1.2" />
      <line x1="10" y1="16.5" x2="14" y2="16.5" strokeWidth="1.2" />
      <path d="M6 18 L8 18" strokeWidth="1.4" />
      <path d="M16 18 L18 18" strokeWidth="1.4" />
      <path d="M8 2 L9 0.5 L15 0.5 L16 2" strokeWidth="1" />
    </svg>
  );
}

function PiercingRoundsIcon() {
  return (
    <svg {...svgProps}>
      {/* Arrow punching through layers */}
      <line x1="2" y1="12" x2="20" y2="12" strokeWidth="2" />
      <polyline points="16,8 20,12 16,16" strokeWidth="2" />
      <line x1="8" y1="6" x2="8" y2="18" strokeDasharray="2 2" />
      <line x1="13" y1="6" x2="13" y2="18" strokeDasharray="2 2" />
    </svg>
  );
}

function GoldenChamberIcon() {
  return (
    <svg {...svgProps}>
      {/* Star-marked bullet chamber */}
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" strokeDasharray="3 2" />
      <polygon
        points="12,7 13.5,10.5 17,10.5 14.2,13 15.2,16.5 12,14.5 8.8,16.5 9.8,13 7,10.5 10.5,10.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function ScatterCoreIcon() {
  return (
    <svg {...svgProps}>
      {/* Central core radiating pellets */}
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="5" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="19" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none" />
      <line x1="12" y1="8.5" x2="12" y2="5" strokeWidth="1" />
      <line x1="8.5" y1="12" x2="6.5" y2="12" strokeWidth="1" />
      <line x1="15.5" y1="12" x2="17.5" y2="12" strokeWidth="1" />
      <line x1="9.5" y1="9.5" x2="7" y2="7" strokeWidth="1" />
      <line x1="14.5" y1="9.5" x2="17" y2="7" strokeWidth="1" />
      <line x1="9.5" y1="14.5" x2="7" y2="17" strokeWidth="1" />
      <line x1="14.5" y1="14.5" x2="17" y2="17" strokeWidth="1" />
    </svg>
  );
}

function BlinkDashIcon() {
  return (
    <svg {...svgProps}>
      {/* Teleport silhouette — figure dissolving */}
      <path d="M8 6 C8 4 10 2 12 2 C14 2 16 4 16 6 C16 8 14 9 12 9 C10 9 8 8 8 6Z" strokeDasharray="2 2" />
      <path d="M10 10 L8 20 L12 17 L16 20 L14 10" strokeDasharray="2 2" />
      <line x1="18" y1="4" x2="21" y2="2" strokeWidth="1.4" />
      <line x1="19" y1="8" x2="22" y2="8" strokeWidth="1.4" />
      <line x1="18" y1="12" x2="21" y2="14" strokeWidth="1.4" />
    </svg>
  );
}

const ICON_MAP: Record<UpgradeId, () => React.JSX.Element> = {
  "tight-choke": TightChokeIcon,
  "fast-hands": FastHandsIcon,
  "overcrank": OvercrankIcon,
  "hollow-point": HollowPointIcon,
  "fleet-step": FleetStepIcon,
  "dash-capacitors": DashCapacitorsIcon,
  "extended-mag": ExtendedMagIcon,
  "piercing-rounds": PiercingRoundsIcon,
  "golden-chamber": GoldenChamberIcon,
  "scatter-core": ScatterCoreIcon,
  "blink-dash": BlinkDashIcon,
};

export function UpgradeIcon({ upgradeId, className }: UpgradeIconProps) {
  const IconComponent = ICON_MAP[upgradeId];
  if (!IconComponent) return null;

  return (
    <div className={className}>
      <IconComponent />
    </div>
  );
}
