import * as THREE from "three";

export interface GameSettings {
  mouseSensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  fov: number;
  graphicsQuality: "low" | "medium" | "high";
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 0.002,
  masterVolume: 0.8,
  sfxVolume: 0.8,
  fov: 75,
  graphicsQuality: "medium",
};

export interface SpawnPoint {
  position: THREE.Vector3;
  rotation: number;
}

export interface KillEntry {
  killer: string;
  victim: string;
  weapon: string;
  timestamp: number;
}

export type LevelId = "relay-loop" | "uplink-split" | "blackout-run";
export type ObjectiveKind = "terminal-sequence" | "hold-zone" | "switch-escape";
export type LevelPhase = "objective" | "boss" | "extract";
export type MovementState = "walk" | "sprint" | "slide" | "dash" | "air";
export type WeaponId =
  | "vanguard-carbine"
  | "arc-smg"
  | "scattershot"
  | "helix-burst-rifle"
  | "rail-lance"
  | "plasma-lobber"
  | "phantom-sniper";
export type WeaponFireMode =
  | "auto"
  | "burst"
  | "scatter"
  | "charge"
  | "projectile"
  | "semi";
export type ThreatDirection = "front" | "left" | "right" | "behind";
export type MedalTier = "bronze" | "silver" | "gold" | "s";
export type EnemyArchetype = "rusher" | "anchor" | "disruptor";
export type BossId = "relay-warden" | "uplink-overseer" | "blackout-hunter";
export type BossWeaponType = "conductor-beam" | "siege-mortar" | "phase-rail";
export type OptionalObjectiveKind =
  | "elite-wave"
  | "bonus-cache"
  | "bonus-ring"
  | "overload-node"
  | "timed-extract";
export type ScoreEventKind =
  | "kill"
  | "style"
  | "objective"
  | "bank"
  | "upgrade"
  | "mutator"
  | "death"
  | "route"
  | "recovery";
export type RunMutatorId =
  | "long-burn"
  | "rail-bounty"
  | "volatile-supply"
  | "dash-harvest"
  | "hunter-protocol";
export type RunPerkId =
  | "bank-amplifier"
  | "quick-sync"
  | "adrenaline"
  | "precision-bonus"
  | "salvage-link"
  | "dash-boost";
export type UpgradeCategory =
  | "weapon"
  | "mobility"
  | "ammo"
  | "special";
export type UpgradeRarity = "common" | "rare";
export type UpgradeId =
  | "tight-choke"
  | "fast-hands"
  | "overcrank"
  | "hollow-point"
  | "fleet-step"
  | "dash-capacitors"
  | "extended-mag"
  | "piercing-rounds"
  | "golden-chamber"
  | "scatter-core"
  | "blink-dash";

export interface ThreatAlert {
  active: boolean;
  direction: ThreatDirection;
  count: number;
  distance: number;
}

export interface RadarContact {
  id: string;
  x: number;
  y: number;
  distance: number;
  clamped: boolean;
  watching: boolean;
}

export interface RadarState {
  range: number;
  contacts: RadarContact[];
}

export interface StructureDefinition {
  id: string;
  size: THREE.Vector3;
  position: THREE.Vector3;
  color: number;
  role?: "cover" | "wall" | "platform" | "overhead";
}

export interface Interactable {
  id: string;
  label: string;
  hint: string;
  type: "terminal" | "switch";
  position: THREE.Vector3;
  holdDuration: number;
  rotation?: number;
}

export interface HoldZoneDefinition {
  id: string;
  label: string;
  hint: string;
  position: THREE.Vector3;
  radius: number;
  duration: number;
}

export interface JumpPad {
  id: string;
  label: string;
  position: THREE.Vector3;
  radius: number;
  impulse: THREE.Vector3;
}

export interface WeaponCameraRecoilProfile {
  pitchDeg: number;
  yawDeg: number;
  rollDeg: number;
  backOffset: number;
  dropOffset: number;
  attack: number;
  recover: number;
  yawVariance: number;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  shortName: string;
  pickupLabel: string;
  pickupDetail: string;
  fireMode: WeaponFireMode;
  damage: number;
  fireRate: number;
  range: number;
  magazineSize: number;
  maxReserveAmmo: number;
  reloadTime: number;
  color: number;
  emissive: number;
  tracerColor: number;
  tracerWidth: number;
  moveSpread: number;
  recoil: number;
  cameraRecoil: WeaponCameraRecoilProfile;
  scoreRole: string;
  scoreHint: string;
  pellets?: number;
  spread?: number;
  burstCount?: number;
  burstInterval?: number;
  chargeTime?: number;
  minChargeDamage?: number;
  maxChargeDamage?: number;
  maxPierce?: number;
  projectileSpeed?: number;
  projectileGravity?: number;
  projectileLifetime?: number;
  splashRadius?: number;
  splashDamage?: number;
  adsZoomFactor?: number;
  adsSpeed?: number;
}

export interface WeaponInstance {
  id: WeaponId;
  ammo: number;
  reserveAmmo: number;
}

export type WeaponSlot = WeaponInstance | null;

export interface WeaponSlotSummary {
  index: number;
  weaponId: WeaponId | null;
  name: string | null;
  shortName: string | null;
  ammo: number | null;
  reserveAmmo: number | null;
}

export interface WeaponSlotLoadout {
  weaponId: WeaponId | null;
  ammo: number;
  reserveAmmo: number;
  goldenChamberReady: boolean;
}

export interface WeaponLoadoutSnapshot {
  slots: WeaponSlotLoadout[];
  activeSlot: number;
}

export interface InventoryState {
  slots: WeaponSlotSummary[];
  activeSlot: number;
  activeWeaponId: WeaponId | null;
  activeWeaponName: string | null;
  fireMode: WeaponFireMode | null;
  ammo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  reloadDuration: number;
  chargeRatio: number;
  reticleSpread: number;
  isADS: boolean;
}

export interface WeaponPickupDefinition {
  id: string;
  label: string;
  detail: string;
  weaponId: WeaponId;
  position: THREE.Vector3;
}

export interface PickupState {
  pickupId: string;
  weaponId: WeaponId;
  label: string;
  detail: string;
  position: THREE.Vector3;
  claimed: boolean;
}

export interface PickupPromptState {
  active: boolean;
  pickupId: string | null;
  weaponId: WeaponId | null;
  label: string;
  action: "pickup" | "replace" | "ammo";
  text: string;
  progress: number;
}

export interface ProjectileState {
  id: string;
  weaponId: WeaponId;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  age: number;
  maxAge: number;
}

export interface ExtractionZone {
  label: string;
  hint: string;
  position: THREE.Vector3;
  radius: number;
  holdDuration: number;
}

export interface OptionalObjectiveDefinition {
  id: string;
  kind: OptionalObjectiveKind;
  label: string;
  hint: string;
  position: THREE.Vector3;
  radius: number;
  scoreValue: number;
  holdDuration?: number;
  unlockObjectiveIndex?: number;
  timeLimit?: number;
  linkedSpawnIds?: string[];
  requiresWeaponIds?: WeaponId[];
  onlyAfterInteractableId?: string;
  onlyAfterExtractionUnlocked?: boolean;
}

export interface MedalThresholds {
  bronze: number;
  silver: number;
  gold: number;
  s: number;
  targetTime: number;
}

export interface CheckpointState {
  id: string;
  label: string;
  objectiveIndex: number;
  spawn: SpawnPoint;
}

export interface BossLockdownSegmentDefinition {
  id: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  color: number;
}

export interface BossEncounterDefinition {
  bossId: BossId;
  displayName: string;
  weaponType: BossWeaponType;
  spawn: SpawnPoint;
  checkpoint: SpawnPoint;
  lockdownSegments: BossLockdownSegmentDefinition[];
  health: number;
  scoreValue: number;
  xpValue: number;
  introText: string;
  escapeDurationAfterKill?: number;
}

export interface BossState {
  active: boolean;
  introActive: boolean;
  defeated: boolean;
  id: BossId | null;
  name: string;
  weaponType: BossWeaponType | null;
  health: number;
  maxHealth: number;
  phase: number;
  telegraph: string | null;
  introText: string | null;
}

export interface BossCheckpointState {
  active: boolean;
  spawn: SpawnPoint | null;
  loadoutSnapshot: WeaponLoadoutSnapshot | null;
  weaponPickupClaims: string[];
}

export interface BotSpawnDefinition {
  id: string;
  spawn: SpawnPoint;
  patrolRoute: THREE.Vector3[];
  archetype?: EnemyArchetype;
  elite?: boolean;
}

export interface ObjectiveState {
  kind: ObjectiveKind;
  phase: LevelPhase;
  title: string;
  text: string;
  detail: string;
  progress: string;
  interactPrompt: string | null;
  extractionUnlocked: boolean;
  escapeTimer: number | null;
  opportunityHint: string | null;
}

export interface ScoreEvent {
  id: string;
  kind: ScoreEventKind;
  label: string;
  amount: number;
  timestamp: number;
  detail?: string;
  weaponId?: WeaponId | null;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  description: string;
  category: UpgradeCategory;
  rarity: UpgradeRarity;
  maxStacks: number;
  minLevel?: number;
  powerBudget: number;
}

export interface AppliedUpgrade extends UpgradeDefinition {
  stacks: number;
}

export interface ComboState {
  multiplier: number;
  liveBonus: number;
  bankedLevel: number;
  bankedRun: number;
  timer: number;
  maxTimer: number;
  bestMultiplier: number;
  bestLiveBonus: number;
  streak: number;
  heat: number;
}

export interface BankedScoreState {
  live: number;
  level: number;
  run: number;
  lostOnDeath: number;
}

export interface RunMutator {
  id: RunMutatorId;
  name: string;
  description: string;
}

export interface RunPerk {
  id: RunPerkId;
  name: string;
  description: string;
}

export interface PerkChoiceState {
  active: boolean;
  levelIndex: number;
  choices: RunPerk[];
}

export interface ProgressionState {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  pendingLevelUps: number;
  powerScore: number;
}

export interface LevelUpChoiceState {
  active: boolean;
  level: number;
  choices: UpgradeDefinition[];
}

export interface RuntimeModifiers {
  damageMultiplier: number;
  fireRateMultiplier: number;
  reloadSpeedMultiplier: number;
  spreadMultiplier: number;
  magazineSizeMultiplier: number;
  recoilMultiplier: number;
  moveSpeedMultiplier: number;
  airAccelMultiplier: number;
  dashCooldownMultiplier: number;
  dashSpeedMultiplier: number;
  projectileCountBonus: number;
  pierceBonus: number;
  goldenChamber: boolean;
  scatterCore: boolean;
  blinkDash: boolean;
}

export interface BalanceSnapshot {
  powerScore: number;
  enemyHealthMultiplier: number;
  enemyFireRateMultiplier: number;
  reinforcementIntervalMultiplier: number;
  medalThresholdMultiplier: number;
}

export interface OpportunityState {
  id: string;
  label: string;
  hint: string;
  kind: OptionalObjectiveKind;
  distance: number;
}

export interface MedalPaceState {
  current: MedalTier | null;
  next: MedalTier | null;
  pointsToNext: number;
  maxTier: MedalTier;
  degraded: boolean;
  targetTime: number;
  splitDelta: number | null;
  bestScore: number;
  bestTime: number | null;
}

export interface PersonalBestSnapshot {
  bestRunScore: number;
  bestRunTime: number | null;
  levelBestTimes: Partial<Record<LevelId, number>>;
  levelBestScores: Partial<Record<LevelId, number>>;
  lastRunScore: number;
}

export interface GameOverStats {
  score: number;
  kills: number;
  timeAlive: number;
  bestCombo: number;
  levelReached: string;
  killedBy: string;
}

export interface LeaderboardEntry {
  score: number;
  kills: number;
  timeAlive: number;
  bestCombo: number;
  levelReached: string;
  date: number; // Date.now()
}

export interface RecoveryShardState {
  active: boolean;
  position: THREE.Vector3 | null;
  value: number;
  ttl: number;
}

export interface LevelRuntimeState {
  phase: LevelPhase;
  objectiveIndex: number;
  completedInteractables: string[];
  holdProgress: Record<string, number>;
  extractionUnlocked: boolean;
  extractionProgress: number;
  interactProgress: number;
  interactTargetId: string | null;
  escapeTimer: number | null;
  levelTimer: number;
  reinforcementIds: string[];
  completedOptionalObjectives: string[];
  optionalProgress: Record<string, number>;
  levelDeaths: number;
  checkpointIndex: number;
  overchargeState: Record<string, boolean>;
  bossStarted: boolean;
  bossDefeated: boolean;
}

export interface LevelDefinition {
  id: LevelId;
  name: string;
  subtitle: string;
  objectiveKind: ObjectiveKind;
  floorSize: THREE.Vector2;
  floorColor: number;
  backgroundColor: number;
  fogFar: number;
  spawnPoints: SpawnPoint[];
  structures: StructureDefinition[];
  navWaypoints: THREE.Vector3[];
  botSpawns: BotSpawnDefinition[];
  reinforcementSpawns?: BotSpawnDefinition[];
  interactables: Interactable[];
  holdZones: HoldZoneDefinition[];
  jumpPads: JumpPad[];
  weaponPickups: WeaponPickupDefinition[];
  extractionZone: ExtractionZone;
  objectiveDefensePoints?: THREE.Vector3[];
  escapeDuration?: number;
  optionalObjectives: OptionalObjectiveDefinition[];
  medalThresholds: MedalThresholds;
  checkpoints: CheckpointState[];
  bossEncounter: BossEncounterDefinition;
}

export interface LevelSummary {
  id: LevelId;
  name: string;
  index: number;
  total: number;
}

export interface LevelCompleteSummary {
  levelId: LevelId;
  levelName: string;
  scoreGained: number;
  levelTime: number;
  totalScore: number;
  totalRunTime: number;
  runComplete: boolean;
  medal: MedalTier | null;
  maxMedalTier: MedalTier | null;
  bankedBonus: number;
  bestCombo: number;
  deaths: number;
  missedBonuses: number;
  splitDelta: number | null;
  nextTarget: string;
  personalBestScore: boolean;
  personalBestTime: boolean;
}

export interface HitResult {
  point: THREE.Vector3;
  entity: BotData | null;
  distance: number;
}

export interface BotData {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  mesh: THREE.Object3D;
  archetype: EnemyArchetype;
  elite: boolean;
}

export interface ArenaCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  mesh: THREE.Mesh;
}

export type GameState =
  | "menu"
  | "playing"
  | "paused"
  | "dying"
  | "levelUpChoice"
  | "levelComplete"
  | "levelTransition"
  | "runComplete"
  | "gameover";

export type GameEventMap = {
  healthChanged: number;
  ammoChanged: { current: number; reserve: number };
  inventoryChanged: InventoryState;
  pickupPromptChanged: PickupPromptState;
  scoreChanged: number;
  deathsChanged: number;
  kill: KillEntry;
  playerDied: void;
  gameStateChanged: GameState;
  fpsUpdate: number;
  hit: { position: THREE.Vector3; damage: number };
  threatChanged: ThreatAlert;
  radarChanged: RadarState;
  bossChanged: BossState;
  movementChanged: {
    state: MovementState;
    dashCooldown: number;
    horizontalSpeed: number;
    verticalSpeed: number;
    grounded: boolean;
  };
  objectiveChanged: ObjectiveState;
  levelChanged: LevelSummary;
  runTimerChanged: { runTime: number; levelTime: number; escapeTimer: number | null };
  levelComplete: LevelCompleteSummary | null;
  comboChanged: ComboState;
  scoreEventsChanged: ScoreEvent[];
  mutatorChanged: RunMutator | null;
  upgradesChanged: AppliedUpgrade[];
  progressionChanged: ProgressionState;
  levelUpChoiceChanged: LevelUpChoiceState;
  runtimeModifiersChanged: RuntimeModifiers;
  balanceChanged: BalanceSnapshot;
  opportunityChanged: OpportunityState | null;
  medalPaceChanged: MedalPaceState;
  personalBestChanged: PersonalBestSnapshot;
  gameOver: GameOverStats;
};
