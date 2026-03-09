import { WeaponId, UpgradeId } from "./types";
import { UPGRADE_DEFINITIONS } from "./progression";
import { WEAPON_DEFINITIONS } from "./weapons";

export interface ClassPreset {
  id: string;
  name: string;
  description: string;
  weaponId: WeaponId;
  upgradeId: UpgradeId | null;
  upgradeStacks: number;
}

export type ClassPresetId = ClassPreset["id"];

export const CLASS_PRESETS: ClassPreset[] = [
  {
    id: "recruit",
    name: "Recruit",
    description: "No specialty — classic start with the standard carbine.",
    weaponId: "vanguard-carbine",
    upgradeId: null,
    upgradeStacks: 0,
  },
  {
    id: "assault",
    name: "Assault",
    description: "Sustained firepower with an overclocked fire rate.",
    weaponId: "vanguard-carbine",
    upgradeId: "overcrank",
    upgradeStacks: 2,
  },
  {
    id: "recon",
    name: "Recon",
    description: "Precision at range with tighter weapon spread.",
    weaponId: "phantom-sniper",
    upgradeId: "tight-choke",
    upgradeStacks: 2,
  },
  {
    id: "breacher",
    name: "Breacher",
    description: "Fast and close-range with enhanced movement speed.",
    weaponId: "scattershot",
    upgradeId: "fleet-step",
    upgradeStacks: 2,
  },
  {
    id: "demolitionist",
    name: "Demolitionist",
    description: "Explosive power with boosted weapon damage.",
    weaponId: "plasma-lobber",
    upgradeId: "hollow-point",
    upgradeStacks: 2,
  },
  {
    id: "operator",
    name: "Operator",
    description: "Tactical burst fighter with faster dash recovery.",
    weaponId: "helix-burst-rifle",
    upgradeId: "dash-capacitors",
    upgradeStacks: 2,
  },
];

const CLASS_PRESET_BY_ID = new Map(CLASS_PRESETS.map((preset) => [preset.id, preset]));

export function getClassWeaponName(preset: ClassPreset): string {
  return WEAPON_DEFINITIONS[preset.weaponId].name;
}

export function getClassUpgradeName(preset: ClassPreset): string | null {
  if (preset.upgradeId === null) return null;
  return UPGRADE_DEFINITIONS[preset.upgradeId].name;
}

export function getClassPresetById(id: ClassPresetId | null | undefined): ClassPreset | null {
  if (!id) return null;
  return CLASS_PRESET_BY_ID.get(id) ?? null;
}
