import * as THREE from "three";
import {
  Arena,
  ArenaHoldZoneVisual,
  ArenaInteractableVisual,
  ArenaWeaponPickupVisual,
  buildArena,
} from "./arena";
import { AudioManager } from "./audio";
import { Bot } from "./bot";
import { InputManager } from "./input";
import { LEVEL_DEFINITIONS, LEVEL_ORDER } from "./levels";
import { Player } from "./player";
import {
  applyUpgrade,
  awardXp,
  computeBalanceSnapshot,
  computePowerScore,
  computeRuntimeModifiers,
  createInactiveLevelUpChoice,
  createInitialProgressionState,
  getAdjustedMedalThresholds,
  rollLevelUpChoices,
} from "./progression";
import { GameRenderer } from "./renderer";
import {
  WeaponRayCommand,
  WeaponSystem,
} from "./weapon";
import {
  AppliedUpgrade,
  BalanceSnapshot,
  BankedScoreState,
  CheckpointState,
  ComboState,
  DEFAULT_SETTINGS,
  GameSettings,
  GameState,
  KillEntry,
  LevelUpChoiceState,
  LevelCompleteSummary,
  LevelDefinition,
  LevelRuntimeState,
  LevelSummary,
  MedalPaceState,
  MedalTier,
  MovementState,
  ObjectiveState,
  OpportunityState,
  PersonalBestSnapshot,
  PickupPromptState,
  ProgressionState,
  RadarContact,
  RadarState,
  RecoveryShardState,
  RunMutator,
  RuntimeModifiers,
  ScoreEvent,
  ThreatAlert,
  ThreatDirection,
  UpgradeId,
  GameOverStats,
} from "./types";

const STATE_PUSH_INTERVAL = 1000 / 20;
const RADAR_RANGE = 22;
const INTERACT_RANGE = 2.4;
const HOLD_ZONE_TOLERANCE = 0.2;
const EXTRACTION_TOLERANCE = 0.25;
const RESPAWN_TIME = 2;
const JUMP_PAD_COOLDOWN = 0.9;
const WEAPON_PICKUP_RADIUS = 1.4;
const WEAPON_REPLACE_HOLD = 0.45;
const COMBO_BASE_TIMER = 4.4;
const EVENT_FEED_LIMIT = 6;
const RECOVERY_SHARD_LIFETIME = 15;
const RECOVERY_SHARD_RADIUS = 1.2;
const SCORE_STORAGE_KEY = "game-killer-arcade-pb-v1";
const PRESSURE_WINDOW = 6.5;
const RELIEF_WINDOW = 3.75;

type WeaponPickupRuntime = {
  visual: ArenaWeaponPickupVisual;
  key: string;
  claimed: boolean;
  replaceProgress: number;
};

type OptionalObjectiveRuntime = {
  id: string;
  mesh: THREE.Mesh;
  beacon: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  beaconMaterial: THREE.MeshBasicMaterial;
};

const createInactiveThreatAlert = (): ThreatAlert => ({
  active: false,
  direction: "front",
  count: 0,
  distance: 0,
});

const createInactiveRadarState = (): RadarState => ({
  range: RADAR_RANGE,
  contacts: [],
});

const createEmptyLevelSummary = (): LevelSummary => ({
  id: "relay-loop",
  name: "Relay Loop",
  index: 1,
  total: LEVEL_ORDER.length,
});

const createEmptyObjectiveState = (): ObjectiveState => ({
  kind: "terminal-sequence",
  title: "",
  text: "",
  detail: "",
  progress: "",
  interactPrompt: null,
  extractionUnlocked: false,
  escapeTimer: null,
  opportunityHint: null,
});

const createInactivePickupPrompt = (): PickupPromptState => ({
  active: false,
  pickupId: null,
  weaponId: null,
  label: "",
  action: "pickup",
  text: "",
  progress: 0,
});

const createEmptyComboState = (): ComboState => ({
  multiplier: 1,
  liveBonus: 0,
  bankedLevel: 0,
  bankedRun: 0,
  timer: 0,
  maxTimer: COMBO_BASE_TIMER,
  bestMultiplier: 1,
  bestLiveBonus: 0,
  streak: 0,
  heat: 0,
});

const createEmptyBankState = (): BankedScoreState => ({
  live: 0,
  level: 0,
  run: 0,
  lostOnDeath: 0,
});

const createEmptyPersonalBest = (): PersonalBestSnapshot => ({
  bestRunScore: 0,
  bestRunTime: null,
  levelBestTimes: {},
  levelBestScores: {},
  lastRunScore: 0,
});

const createInactiveRecoveryShard = (): RecoveryShardState => ({
  active: false,
  position: null,
  value: 0,
  ttl: 0,
});

const createEmptyMedalPace = (): MedalPaceState => ({
  current: null,
  next: "bronze",
  pointsToNext: 0,
  maxTier: "s",
  degraded: false,
  targetTime: 0,
  splitDelta: null,
  bestScore: 0,
  bestTime: null,
});

const RUN_MUTATORS: RunMutator[] = [
  {
    id: "long-burn",
    name: "Long Burn",
    description: "Combo timer lasts longer and banking windows stay open.",
  },
  {
    id: "rail-bounty",
    name: "Rail Bounty",
    description: "Rail and Helix eliminations pay heavier live bonus.",
  },
  {
    id: "volatile-supply",
    name: "Volatile Supply",
    description: "Enemies shoot faster, but drops and caches pay more.",
  },
  {
    id: "dash-harvest",
    name: "Dash Harvest",
    description: "Dash and slide finishes supercharge combo growth.",
  },
  {
    id: "hunter-protocol",
    name: "Hunter Protocol",
    description: "Objective pressure spikes with extra rushers and bigger banks.",
  },
];

export type EngineEventCallback = {
  healthChanged: (health: number) => void;
  ammoChanged: (current: number, reserve: number) => void;
  inventoryChanged: (inventory: ReturnType<WeaponSystem["getInventoryState"]>) => void;
  pickupPromptChanged: (prompt: PickupPromptState) => void;
  scoreChanged: (score: number) => void;
  deathsChanged: (deaths: number) => void;
  kill: (entry: KillEntry) => void;
  playerDied: () => void;
  gameStateChanged: (state: GameState) => void;
  fpsUpdate: (fps: number) => void;
  hit: (position: THREE.Vector3, damage: number) => void;
  reloading: (isReloading: boolean) => void;
  threatChanged: (threat: ThreatAlert) => void;
  radarChanged: (radar: RadarState) => void;
  movementChanged: (payload: {
    state: MovementState;
    dashCooldown: number;
    horizontalSpeed: number;
    verticalSpeed: number;
    grounded: boolean;
  }) => void;
  objectiveChanged: (objective: ObjectiveState) => void;
  levelChanged: (level: LevelSummary) => void;
  runTimerChanged: (payload: {
    runTime: number;
    levelTime: number;
    escapeTimer: number | null;
  }) => void;
  levelComplete: (summary: LevelCompleteSummary | null) => void;
  comboChanged: (combo: ComboState) => void;
  scoreEventsChanged: (events: ScoreEvent[]) => void;
  mutatorChanged: (mutator: RunMutator | null) => void;
  upgradesChanged: (upgrades: AppliedUpgrade[]) => void;
  progressionChanged: (progression: ProgressionState) => void;
  levelUpChoiceChanged: (choice: LevelUpChoiceState) => void;
  runtimeModifiersChanged: (modifiers: RuntimeModifiers) => void;
  balanceChanged: (balance: BalanceSnapshot) => void;
  opportunityChanged: (opportunity: OpportunityState | null) => void;
  medalPaceChanged: (pace: MedalPaceState) => void;
  personalBestChanged: (snapshot: PersonalBestSnapshot) => void;
  gameOver: (stats: GameOverStats) => void;
};

export class GameEngine {
  private renderer: GameRenderer;
  private input: InputManager;
  private player: Player;
  private weapon: WeaponSystem;
  private bots: Bot[] = [];
  private arena!: Arena;
  private audio: AudioManager;
  private scene: THREE.Scene;

  private running = false;
  private animationId = 0;
  private lastTime = 0;
  private fixedDt = 1000 / 60;
  private accumulator = 0;
  private statePushTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private gameState: GameState = "playing";
  private respawnTimer = 0;
  private threatAlert: ThreatAlert = createInactiveThreatAlert();
  private radarState: RadarState = createInactiveRadarState();
  private objectiveState: ObjectiveState = createEmptyObjectiveState();
  private levelSummary: LevelSummary = createEmptyLevelSummary();
  private levelCompleteSummary: LevelCompleteSummary | null = null;
  private pickupPrompt: PickupPromptState = createInactivePickupPrompt();
  private runTime = 0;
  private currentLevelIndex = 0;
  private currentLevel!: LevelDefinition;
  private levelRuntime!: LevelRuntimeState;
  private levelTransitionTimer = 0;
  private levelScoreBaseline = 0;
  private readonly jumpPadCooldowns = new Map<string, number>();
  private weaponPickups: WeaponPickupRuntime[] = [];
  private readonly claimedWeaponPickups = new Set<string>();
  private comboState: ComboState = createEmptyComboState();
  private bankState: BankedScoreState = createEmptyBankState();
  private scoreEvents: ScoreEvent[] = [];
  private activeMutator: RunMutator | null = null;
  private activeUpgrades: AppliedUpgrade[] = [];
  private progression: ProgressionState = createInitialProgressionState();
  private levelUpChoice: LevelUpChoiceState = createInactiveLevelUpChoice();
  private runtimeModifiers: RuntimeModifiers = computeRuntimeModifiers([]);
  private balanceSnapshot: BalanceSnapshot = computeBalanceSnapshot(0);
  private activeOpportunity: OpportunityState | null = null;
  private medalPace: MedalPaceState = createEmptyMedalPace();
  private personalBest: PersonalBestSnapshot = createEmptyPersonalBest();
  private recoveryShard: RecoveryShardState = createInactiveRecoveryShard();
  private recoveryShardMesh: THREE.Mesh | null = null;
  private optionalObjectives: OptionalObjectiveRuntime[] = [];
  private objectiveDamageTaken = 0;
  private objectiveStartHealth = 100;
  private killChainTimer = 0;
  private killChainCount = 0;
  private pressureTimer = PRESSURE_WINDOW;
  private reliefTimer = 0;
  private totalKills = 0;

  private listeners: Partial<EngineEventCallback> = {};

  constructor(canvas: HTMLCanvasElement, settings?: Partial<GameSettings>) {
    const s = { ...DEFAULT_SETTINGS, ...settings };
    this.scene = new THREE.Scene();
    this.renderer = new GameRenderer(canvas);
    this.input = new InputManager(canvas);

    this.currentLevel = LEVEL_DEFINITIONS[LEVEL_ORDER[0]];
    this.arena = buildArena(this.scene, this.currentLevel);

    const spawn = this.currentLevel.spawnPoints[0];
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.player = new Player(spawn, s.fov, aspect, s.mouseSensitivity);
    this.weapon = new WeaponSystem(this.scene, this.player.camera.camera);
    this.audio = new AudioManager(this.player.camera.camera);
    this.personalBest = this.loadPersonalBest();

    this.initializeLevel(0, true);

    const resizeObserver = new ResizeObserver(() => {
      this.renderer.resize();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        this.player.camera.setAspect(w / h);
      }
    });
    resizeObserver.observe(canvas.parentElement || canvas);
  }

  on<K extends keyof EngineEventCallback>(
    event: K,
    callback: EngineEventCallback[K]
  ): void {
    (this.listeners as Record<string, unknown>)[event] = callback;
  }

  private emit<K extends keyof EngineEventCallback>(
    event: K,
    ...args: Parameters<EngineEventCallback[K]>
  ): void {
    const cb = this.listeners[event];
    if (cb) {
      (cb as (...a: unknown[]) => void)(...args);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.gameState = "playing";
    this.emit("gameStateChanged", "playing");
    this.pushFullState();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  pause(): void {
    if (this.gameState !== "playing") return;
    this.gameState = "paused";
    this.player.camera.resetMotionEffects();
    this.input.exitPointerLock();
    this.emit("gameStateChanged", "paused");
    this.stop();
  }

  resume(): void {
    if (this.gameState !== "paused") return;
    this.gameState = "playing";
    this.player.camera.resetMotionEffects();
    this.emit("gameStateChanged", "playing");
    this.running = true;
    this.lastTime = performance.now();
    this.pushFullState();
    this.input.requestPointerLock();
    this.tick(this.lastTime);
  }

  chooseUpgrade(upgradeId: UpgradeId): void {
    if (!this.levelUpChoice.active) return;
    const choice = this.levelUpChoice.choices.find((entry) => entry.id === upgradeId);
    if (!choice) return;

    this.activeUpgrades = applyUpgrade(this.activeUpgrades, choice.id);
    this.levelUpChoice = createInactiveLevelUpChoice();
    this.progression = {
      ...this.progression,
      pendingLevelUps: Math.max(0, this.progression.pendingLevelUps - 1),
      powerScore: computePowerScore(this.activeUpgrades),
    };
    this.applyRunModifiers();
    this.emit("levelUpChoiceChanged", this.levelUpChoice);
    this.emit("upgradesChanged", this.activeUpgrades);
    this.emit("progressionChanged", this.progression);
    this.emit("runtimeModifiersChanged", this.runtimeModifiers);
    this.emit("balanceChanged", this.balanceSnapshot);
    this.pushScoreEvent({
      kind: "upgrade",
      label: choice.name,
      amount: 0,
      detail: choice.description,
    });
    this.gameState = "playing";
    this.tryOpenLevelUpChoice();
    if (!this.levelUpChoice.active) {
      this.emit("gameStateChanged", "playing");
      this.input.requestPointerLock();
      this.pushFullState();
    } else {
      this.emit("gameStateChanged", "levelUpChoice");
      this.pushState();
    }
  }

  continueAfterLevelComplete(): void {
    if (this.gameState !== "levelComplete") return;
    this.advanceToNextLevel();
    this.input.requestPointerLock();
  }

  restartRun(): void {
    this.input.exitPointerLock();
    this.initializeLevel(0, true);
    this.gameState = "playing";
    this.emit("gameStateChanged", "playing");
    this.pushFullState();
  }

  advanceTime(ms: number): void {
    if (ms <= 0) return;

    this.accumulator += ms;
    const dtFixed = this.fixedDt / 1000;
    while (this.accumulator >= this.fixedDt) {
      this.fixedUpdate(dtFixed);
      this.accumulator -= this.fixedDt;
    }

    this.renderer.render(this.scene, this.player.camera.camera);
  }

  renderGameToText(): string {
    const activeInteractable = this.getActiveInteractable();
    const activeHoldZone = this.getActiveHoldZone();
    const inventory = this.weapon.getInventoryState();
    const projectiles = this.weapon.getProjectilesState();
    const recoilState = this.player.camera.getShotRecoilState();

    const payload = {
      coordinateSystem: "x:right y:up z:forward-negative",
      state: this.gameState,
      level: {
        id: this.currentLevel.id,
        name: this.currentLevel.name,
        index: this.currentLevelIndex + 1,
        total: LEVEL_ORDER.length,
        levelTime: Number(this.levelRuntime.levelTimer.toFixed(1)),
        runTime: Number(this.runTime.toFixed(1)),
      },
      player: {
        alive: this.player.isAlive,
        health: this.player.health,
        position: vectorToObject(this.player.body.position),
        eye: vectorToObject(this.player.body.getEyePosition()),
        forward: vectorToObject(this.player.camera.getForward()),
        movementState: this.player.movementState,
        dashCooldown: this.player.getDashCooldown(),
        speed: Number(this.player.currentMoveSpeed.toFixed(2)),
        horizontalSpeed: Number(this.player.getHorizontalSpeed().toFixed(2)),
        verticalSpeed: this.player.getVerticalSpeed(),
        grounded: this.player.body.isGrounded,
        cameraRecoil: {
          pitch: Number(recoilState.pitch.toFixed(4)),
          yaw: Number(recoilState.yaw.toFixed(4)),
          roll: Number(recoilState.roll.toFixed(4)),
          back: Number(recoilState.back.toFixed(4)),
          drop: Number(recoilState.drop.toFixed(4)),
        },
      },
      inventory,
      activeWeapon: {
        weaponId: inventory.activeWeaponId,
        name: inventory.activeWeaponName,
        ammo: inventory.ammo,
        reserveAmmo: inventory.reserveAmmo,
        fireMode: inventory.fireMode,
        chargeRatio: inventory.chargeRatio,
        reloading: inventory.isReloading,
      },
      pickupPrompt: {
        ...this.pickupPrompt,
        progress: Number(this.pickupPrompt.progress.toFixed(2)),
      },
      objective: {
        kind: this.currentLevel.objectiveKind,
        title: this.objectiveState.title,
        text: this.objectiveState.text,
        detail: this.objectiveState.detail,
        progress: this.objectiveState.progress,
        interactPrompt: this.objectiveState.interactPrompt,
        opportunityHint: this.objectiveState.opportunityHint,
        activeInteractableId: activeInteractable?.def.id ?? null,
        activeHoldZoneId: activeHoldZone?.def.id ?? null,
        escapeTimer: this.levelRuntime.escapeTimer,
      },
      interactables: this.arena.interactables.map((entry) => ({
        id: entry.def.id,
        label: entry.def.label,
        hint: entry.def.hint,
        active: activeInteractable?.def.id === entry.def.id,
        completed: this.levelRuntime.completedInteractables.includes(entry.def.id),
        position: vectorToObject(entry.def.position),
      })),
      holdZones: this.arena.holdZones.map((entry) => ({
        id: entry.def.id,
        label: entry.def.label,
        hint: entry.def.hint,
        active: activeHoldZone?.def.id === entry.def.id,
        progress: Number((this.levelRuntime.holdProgress[entry.def.id] ?? 0).toFixed(1)),
        required: entry.def.duration,
        position: vectorToObject(entry.def.position),
      })),
      extraction: {
        unlocked: this.levelRuntime.extractionUnlocked,
        hint: this.arena.extraction.def.hint,
        progress: Number(this.levelRuntime.extractionProgress.toFixed(2)),
        position: vectorToObject(this.arena.extraction.def.position),
      },
      jumpPads: this.arena.jumpPads.map((entry) => ({
        id: entry.def.id,
        label: entry.def.label,
        position: vectorToObject(entry.def.position),
      })),
      weaponPickups: this.weaponPickups.map((pickup) => ({
        id: pickup.visual.def.id,
        label: pickup.visual.def.label,
        weaponId: pickup.visual.def.weaponId,
        claimed: pickup.claimed,
        position: vectorToObject(pickup.visual.def.position),
      })),
      projectiles: projectiles.map((projectile) => ({
        id: projectile.id,
        weaponId: projectile.weaponId,
        position: vectorToObject(projectile.position),
        velocity: vectorToObject(projectile.velocity),
        radius: projectile.radius,
        age: Number(projectile.age.toFixed(2)),
        maxAge: Number(projectile.maxAge.toFixed(2)),
      })),
      awareness: this.threatAlert,
      radar: this.radarState,
      combo: this.comboState,
      bank: this.bankState,
      mutator: this.activeMutator,
      progression: this.progression,
      upgrades: this.activeUpgrades,
      levelUpChoice: this.levelUpChoice,
      runtimeModifiers: this.runtimeModifiers,
      balance: this.balanceSnapshot,
      medalPace: this.medalPace,
      opportunity: this.activeOpportunity,
      recoveryShard: this.recoveryShard.active
        ? {
            value: this.recoveryShard.value,
            ttl: Number(this.recoveryShard.ttl.toFixed(1)),
            position: vectorToObject(this.recoveryShard.position ?? new THREE.Vector3()),
          }
        : null,
      personalBest: this.personalBest,
      scoreEvents: this.scoreEvents,
      bots: this.bots
        .filter((bot) => bot.isAlive())
        .map((bot) => ({
          id: bot.data.id,
          name: bot.data.name,
          state: bot.getState(),
          health: bot.data.health,
          archetype: bot.data.archetype,
          elite: bot.data.elite,
          position: vectorToObject(bot.body.position),
          lookDirection: vectorToObject(bot.getLookDirection()),
          muzzle: vectorToObject(bot.getMuzzlePosition()),
        })),
      score: this.player.score,
      deaths: this.player.deaths,
      levelComplete: this.levelCompleteSummary,
    };

    return JSON.stringify(payload);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.tick);

    const frameDt = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    this.accumulator += frameDt;

    const dtFixed = this.fixedDt / 1000;
    while (this.accumulator >= this.fixedDt) {
      this.fixedUpdate(dtFixed);
      this.accumulator -= this.fixedDt;
    }

    this.fpsFrames++;
    this.fpsTime += frameDt;
    if (this.fpsTime >= 1000) {
      this.emit("fpsUpdate", this.fpsFrames);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    this.renderer.render(this.scene, this.player.camera.camera);
  };

  private fixedUpdate(dt: number): void {
    this.updateJumpPadCooldowns(dt);
    this.updateRecoveryShard(dt);
    this.updateComboDecay(dt);

    if (this.gameState === "runComplete" || this.gameState === "levelUpChoice" || this.gameState === "gameover") {
      this.pushState();
      return;
    }

    if (this.gameState === "levelComplete") {
      this.pushState();
      return;
    }

    const input = this.input.poll();

    if (input.escape) {
      this.pause();
      return;
    }

    if (!this.player.isAlive) {
      this.pushState();
      return;
    }

    this.runTime += dt;
    this.levelRuntime.levelTimer += dt;
    this.killChainTimer = Math.max(0, this.killChainTimer - dt);
    this.updateEncounterPressure(dt);

    if (this.levelRuntime.escapeTimer !== null) {
      this.levelRuntime.escapeTimer = Math.max(0, this.levelRuntime.escapeTimer - dt);
      if (this.levelRuntime.escapeTimer === 0) {
        this.restartCurrentLevel();
        return;
      }
    }

    this.player.update(input, this.arena.colliders, dt);
    if (this.player.consumeDashTriggered() && this.runtimeModifiers.blinkDash) {
      this.weapon.refillActiveMagazinePercent(0.25);
    }
    this.player.camera.setADSZoom(this.weapon.adsZoomFactor);
    this.player.camera.updateADS(input.ads && !this.weapon.isReloading(), dt);
    this.handleWeaponSlotInput(input);
    this.weapon.update(dt, input);
    this.handleReload(input);
    this.updateObjectives(dt, input.interact);
    this.handleWeaponPickups(dt, input.interact, !this.objectiveState.interactPrompt);
    this.updateOptionalObjectives(dt, input.interact);
    this.handleJumpPads();
    this.handlePlayerFire(input);
    this.updateBotBias();
    this.updateBots(dt);
    this.updateProjectileCombat(dt);
    this.updateAwareness(this.player.body.getEyePosition());
    this.updateRecoveryShardPickup();
    this.updateOpportunityState();
    this.updateMedalPace();
    this.syncArenaVisuals();

    this.statePushTimer += dt * 1000;
    if (this.statePushTimer >= STATE_PUSH_INTERVAL) {
      this.statePushTimer = 0;
      this.pushState();
    }
  }

  private handleWeaponSlotInput(input: {
    swapWeapon: boolean;
    selectSlot1: boolean;
    selectSlot2: boolean;
    selectSlot3: boolean;
  }): void {
    if (input.swapWeapon) {
      this.weapon.quickSwap();
    }
    if (input.selectSlot1) {
      this.weapon.selectSlot(0);
    }
    if (input.selectSlot2) {
      this.weapon.selectSlot(1);
    }
    if (input.selectSlot3) {
      this.weapon.selectSlot(2);
    }
  }

  private handlePlayerFire(input: {
    fire: boolean;
    firePressed: boolean;
    fireReleased: boolean;
  }): void {
    const eyePosition = this.player.body.getEyePosition();
    let direction = this.player.camera.getForward();

    if (this.weapon.isADS) {
      direction = this.applyAimAssist(eyePosition, direction);
    }

    const dispatch = this.weapon.consumeFireInput(input, eyePosition, direction);

    if (!dispatch.fired) return;

    this.player.camera.applyShotImpulse(dispatch.cameraKick);

    const damageEvents = new Map<string, { damage: number; point: THREE.Vector3 }>();
    const botMeshes = this.bots
      .filter((bot) => bot.isAlive())
      .flatMap((bot) => bot.getKillMeshes());

    for (const command of dispatch.commands) {
      const result = this.resolveRayCommand(command, botMeshes);
      this.weapon.spawnTrace(
        command.weaponId,
        command.visualOrigin,
        result.traceEnd,
        command.traceScale,
        command.tracerColor
      );
      for (const hit of result.hits) {
        const current = damageEvents.get(hit.entity.id);
        if (current) {
          current.damage += hit.damage;
        } else {
          damageEvents.set(hit.entity.id, { damage: hit.damage, point: hit.point.clone() });
        }
      }
    }

    this.weapon.finalizeDispatch(dispatch);
    this.audio.playShoot();

    if (damageEvents.size > 0) {
      this.applyDamageEvents(damageEvents, dispatch.weaponName ?? "Weapon");
    }
  }

  private applyAimAssist(
    eyePosition: THREE.Vector3,
    direction: THREE.Vector3
  ): THREE.Vector3 {
    const AIM_ASSIST_CONE = Math.cos(THREE.MathUtils.degToRad(8));
    const AIM_ASSIST_RANGE = 60;
    const AIM_ASSIST_STRENGTH = 0.45;

    let bestDot = AIM_ASSIST_CONE;
    let bestTarget: THREE.Vector3 | null = null;

    for (const bot of this.bots) {
      if (!bot.isAlive()) continue;

      const targetPos = bot.data.position.clone();
      targetPos.y += 0.8;
      const toTarget = targetPos.clone().sub(eyePosition);
      const dist = toTarget.length();
      if (dist > AIM_ASSIST_RANGE || dist < 0.5) continue;

      toTarget.normalize();
      const dot = direction.dot(toTarget);
      if (dot > bestDot) {
        bestDot = dot;
        bestTarget = toTarget;
      }
    }

    if (!bestTarget) return direction;

    const assisted = direction
      .clone()
      .lerp(bestTarget, AIM_ASSIST_STRENGTH * this.weapon.adsAmount)
      .normalize();
    return assisted;
  }

  private resolveRayCommand(
    command: WeaponRayCommand,
    botMeshes: THREE.Object3D[]
  ): {
    hits: Array<{ entity: Bot["data"]; point: THREE.Vector3; damage: number }>;
    traceEnd: THREE.Vector3;
  } {
    const raycaster = new THREE.Raycaster(
      command.origin,
      command.direction.clone().normalize(),
      0,
      command.range
    );
    const maxRangePoint = command.origin
      .clone()
      .addScaledVector(command.direction, command.range);
    const worldHit = raycaster.intersectObjects(this.arena.wallMeshes, false)[0] ?? null;
    const worldDistance = worldHit?.distance ?? command.range;
    const hits: Array<{ entity: Bot["data"]; point: THREE.Vector3; damage: number }> = [];
    const seen = new Set<string>();

    for (const hit of raycaster.intersectObjects(botMeshes, false)) {
      const entity = (hit.object.userData as Bot["data"]) ?? null;
      if (!entity || seen.has(entity.id) || hit.distance > worldDistance) continue;
      seen.add(entity.id);
      hits.push({
        entity,
        point: hit.point.clone(),
        damage: command.damage,
      });
      if (hits.length >= command.maxPierce) break;
    }

    let traceEnd = maxRangePoint;
    if (command.maxPierce === 1 && hits[0]) {
      traceEnd = hits[0].point.clone();
    } else if (worldHit) {
      traceEnd = worldHit.point.clone();
    }

    return { hits, traceEnd };
  }

  private updateProjectileCombat(dt: number): void {
    const botMeshes = this.bots
      .filter((bot) => bot.isAlive())
      .flatMap((bot) => bot.getKillMeshes());
    const impacts = this.weapon.updateProjectiles(dt, botMeshes, this.arena.wallMeshes);

    for (const impact of impacts) {
      const damageEvents = new Map<string, { damage: number; point: THREE.Vector3 }>();

      if (impact.directEntity) {
        damageEvents.set(impact.directEntity.id, {
          damage: impact.directDamage,
          point: impact.position.clone(),
        });
      }

      if (impact.radius > 0 && impact.splashDamage > 0) {
        for (const bot of this.bots) {
          if (!bot.isAlive()) continue;
          const distance = bot.body.position.distanceTo(impact.position);
          if (distance > impact.radius) continue;
          const scaledDamage = impact.splashDamage * (1 - distance / impact.radius);
          if (scaledDamage <= 0) continue;
          const current = damageEvents.get(bot.data.id);
          if (current) {
            current.damage += scaledDamage;
          } else {
            damageEvents.set(bot.data.id, {
              damage: scaledDamage,
              point: impact.position.clone(),
            });
          }
        }
      }

      if (damageEvents.size > 0) {
        this.applyDamageEvents(damageEvents, impact.weaponName);
      }
    }
  }

  private applyDamageEvents(
    damageEvents: Map<string, { damage: number; point: THREE.Vector3 }>,
    weaponName: string
  ): void {
    for (const [botId, event] of damageEvents.entries()) {
      const bot = this.bots.find((entry) => entry.data.id === botId && entry.isAlive());
      if (!bot) continue;

      const damage = Math.max(1, Math.round(event.damage));
      const killed = bot.takeDamage(damage);
      this.audio.playHit();
      this.emit("hit", event.point, damage);

      if (!killed) continue;

      this.handleBotKill(bot, weaponName, event.point);
      this.emit("kill", {
        killer: "You",
        victim: bot.data.name,
        weapon: weaponName,
        timestamp: Date.now(),
      });
    }
  }

  private handleReload(input: { reload?: boolean }): void {
    if (!input.reload) return;
    if (this.weapon.startReload()) {
      this.audio.playReload();
    }
  }

  private updateBots(dt: number): void {
    for (const bot of this.bots) {
      const result = bot.update(
        dt,
        this.player.body,
        this.player.isAlive,
        this.arena.colliders,
        this.arena.wallMeshes
      );

      if (!result?.damaged) continue;

      if (this.player.isInvulnerable()) {
        continue;
      }

      const died = this.player.takeDamage(result.damage);
      this.objectiveDamageTaken += result.damage;
      this.player.camera.applyDamageShake(result.damage);
      this.emit("healthChanged", this.player.health);
      if (!died) continue;

      this.handlePlayerDeath(bot.data.name);
    }
  }

  private updateObjectives(dt: number, interactHeld: boolean): void {
    const playerPos = this.player.body.position;
    const activeInteractable = this.getActiveInteractable();
    const activeHoldZone = this.getActiveHoldZone();

    let interactPrompt: string | null = null;
    if (activeInteractable) {
      const distance = playerPos.distanceTo(activeInteractable.def.position);
      const interactDuration =
        activeInteractable.def.holdDuration * this.getInteractionDurationScale();
      if (distance <= INTERACT_RANGE) {
        interactPrompt = `Hold E — ${activeInteractable.def.label}`;
        if (interactHeld) {
          this.levelRuntime.interactTargetId = activeInteractable.def.id;
          this.levelRuntime.interactProgress += dt;
          if (this.levelRuntime.interactProgress >= interactDuration) {
            this.completeInteractable(activeInteractable);
          }
        } else {
          this.levelRuntime.interactProgress = 0;
        }
      } else {
        this.levelRuntime.interactProgress = 0;
      }
    } else {
      this.levelRuntime.interactProgress = 0;
    }

    if (activeHoldZone) {
      const distance = playerPos.distanceTo(activeHoldZone.def.position);
      if (distance <= activeHoldZone.def.radius + HOLD_ZONE_TOLERANCE) {
        const progress =
          (this.levelRuntime.holdProgress[activeHoldZone.def.id] ?? 0) + dt;
        this.levelRuntime.holdProgress[activeHoldZone.def.id] = progress;
        if (progress >= activeHoldZone.def.duration) {
          this.completeHoldZone(activeHoldZone);
        }
      }
    }

    if (this.levelRuntime.extractionUnlocked) {
      const extractionDistance = playerPos.distanceTo(this.arena.extraction.def.position);
      const extractionDuration =
        this.arena.extraction.def.holdDuration * this.getInteractionDurationScale();
      if (extractionDistance <= this.arena.extraction.def.radius + EXTRACTION_TOLERANCE) {
        this.levelRuntime.extractionProgress += dt;
        interactPrompt = `Hold E — Extract`;
        if (this.levelRuntime.extractionProgress >= extractionDuration) {
          this.completeLevel();
          return;
        }
      } else {
        this.levelRuntime.extractionProgress = 0;
      }
    } else {
      this.levelRuntime.extractionProgress = 0;
    }

    this.objectiveState = this.buildObjectiveState(interactPrompt);
  }

  private handleWeaponPickups(
    dt: number,
    interactHeld: boolean,
    allowReplace: boolean
  ): void {
    const pickupRadiusSq = WEAPON_PICKUP_RADIUS * WEAPON_PICKUP_RADIUS;
    let nearestReplace: { pickup: WeaponPickupRuntime; distanceSq: number } | null = null;

    for (const pickup of this.weaponPickups) {
      if (pickup.claimed) continue;

      const distanceSq = this.player.body.position.distanceToSquared(
        pickup.visual.def.position
      );
      if (distanceSq > pickupRadiusSq) continue;

      if (this.weapon.canAutoCollectWeapon(pickup.visual.def.weaponId)) {
        const result = this.weapon.pickupWeapon(pickup.visual.def.weaponId, false);
        if (result.kind === "stored" || result.kind === "ammo") {
          this.claimWeaponPickup(pickup);
          this.audio.playReload();
        }
        continue;
      }

      if (!allowReplace) continue;

      if (!nearestReplace || distanceSq < nearestReplace.distanceSq) {
        nearestReplace = { pickup, distanceSq };
      }
    }

    for (const pickup of this.weaponPickups) {
      if (!nearestReplace || pickup !== nearestReplace.pickup) {
        pickup.replaceProgress = 0;
      }
    }

    if (!nearestReplace) {
      this.pickupPrompt = createInactivePickupPrompt();
      return;
    }

    const pickup = nearestReplace.pickup;
    pickup.replaceProgress = interactHeld
      ? Math.min(WEAPON_REPLACE_HOLD, pickup.replaceProgress + dt)
      : 0;

    this.pickupPrompt = {
      active: true,
      pickupId: pickup.visual.def.id,
      weaponId: pickup.visual.def.weaponId,
      label: pickup.visual.def.label,
      action: "replace",
      text: `Hold E to replace ${this.weapon.activeWeaponName ?? "current weapon"} with ${pickup.visual.def.label}`,
      progress: pickup.replaceProgress / WEAPON_REPLACE_HOLD,
    };

    if (pickup.replaceProgress < WEAPON_REPLACE_HOLD) return;

    const result = this.weapon.pickupWeapon(pickup.visual.def.weaponId, true);
    if (result.kind === "replaced") {
      this.claimWeaponPickup(pickup);
      this.audio.playReload();
      this.pickupPrompt = createInactivePickupPrompt();
    }
  }

  private claimWeaponPickup(pickup: WeaponPickupRuntime): void {
    pickup.claimed = true;
    pickup.replaceProgress = 0;
    pickup.visual.group.visible = false;
    this.claimedWeaponPickups.add(pickup.key);
  }

  private completeInteractable(entry: ArenaInteractableVisual): void {
    this.audio.playReload();
    this.levelRuntime.interactProgress = 0;
    this.levelRuntime.completedInteractables.push(entry.def.id);
    this.awardScore(240);
    this.addComboValue(120, "Terminal Sync", "objective");
    this.bankCombo(`Secured ${entry.def.label}`, 1.1);

    if (
      this.currentLevel.id === "relay-loop" &&
      entry.def.id === "relay-terminal-b" &&
      this.levelRuntime.reinforcementIds.length === 0
    ) {
      this.spawnReinforcements(this.currentLevel.reinforcementSpawns ?? []);
    }

    if (this.currentLevel.objectiveKind === "switch-escape") {
      this.levelRuntime.extractionUnlocked = true;
      this.levelRuntime.escapeTimer = this.currentLevel.escapeDuration ?? 35;
      this.spawnReinforcements(this.currentLevel.reinforcementSpawns ?? []);
    }

    this.levelRuntime.objectiveIndex += 1;
    this.updateCheckpointFromObjective();
    if (
      this.currentLevel.objectiveKind === "terminal-sequence" &&
      this.levelRuntime.objectiveIndex >= this.currentLevel.interactables.length
    ) {
      this.levelRuntime.extractionUnlocked = true;
    }

    this.completeOptionalObjectivesFromInteractable(entry.def.id);
    this.resetObjectiveDamageWindow();
    this.objectiveState = this.buildObjectiveState(null);
  }

  private completeHoldZone(entry: ArenaHoldZoneVisual): void {
    const pristineHold = this.objectiveDamageTaken <= 0;
    this.awardScore(260);
    this.addComboValue(130, "Uplink Secured", "objective");
    if (pristineHold) {
      this.addComboValue(95, "No-Damage Hold", "style");
    }
    this.bankCombo(`Banked ${entry.def.label}`, 1.12);
    this.levelRuntime.objectiveIndex += 1;
    this.levelRuntime.holdProgress[entry.def.id] = entry.def.duration;
    if (this.levelRuntime.objectiveIndex >= this.currentLevel.holdZones.length) {
      this.levelRuntime.extractionUnlocked = true;
    }
    this.updateCheckpointFromObjective();
    this.resetObjectiveDamageWindow();
    this.objectiveState = this.buildObjectiveState(null);
  }

  private completeLevel(): void {
    if (this.gameState !== "playing") return;

    this.awardScore(500);
    this.addComboValue(180, "Extraction Window", "objective");
    this.completeTimedExtractIfEligible();
    const extractionBank = this.bankCombo("Extraction Cashout", 1.4);
    const runComplete = this.currentLevelIndex === LEVEL_ORDER.length - 1;
    if (runComplete) {
      this.awardScore(250);
    }

    const maxMedalTier = this.getMaxMedalTier();
    const medal = this.clampMedalTier(
      this.getMedalTierForScore(this.player.score),
      maxMedalTier
    );
    const pbBefore: PersonalBestSnapshot = {
      bestRunScore: this.personalBest.bestRunScore,
      bestRunTime: this.personalBest.bestRunTime,
      levelBestTimes: { ...this.personalBest.levelBestTimes },
      levelBestScores: { ...this.personalBest.levelBestScores },
      lastRunScore: this.personalBest.lastRunScore,
    };
    const missedBonuses =
      this.currentLevel.optionalObjectives.length -
      this.levelRuntime.completedOptionalObjectives.length;
    this.updatePersonalBest(runComplete);
    this.levelCompleteSummary = {
      levelId: this.currentLevel.id,
      levelName: this.currentLevel.name,
      scoreGained: this.player.score - this.levelScoreBaseline,
      levelTime: Number(this.levelRuntime.levelTimer.toFixed(1)),
      totalScore: this.player.score,
      totalRunTime: Number(this.runTime.toFixed(1)),
      runComplete,
      medal,
      maxMedalTier,
      bankedBonus: extractionBank,
      bestCombo: this.comboState.bestMultiplier,
      deaths: this.levelRuntime.levelDeaths,
      missedBonuses,
      splitDelta: this.medalPace.splitDelta,
      nextTarget: this.describeNextTarget(),
      personalBestScore: this.personalBest.bestRunScore > pbBefore.bestRunScore,
      personalBestTime:
        pbBefore.bestRunTime === null ||
        (runComplete &&
          this.personalBest.bestRunTime !== null &&
          this.personalBest.bestRunTime < pbBefore.bestRunTime),
    };
    this.emit("levelComplete", this.levelCompleteSummary);
    this.input.exitPointerLock();

    if (runComplete) {
      this.gameState = "runComplete";
      this.emit("gameStateChanged", "runComplete");
      this.emit("personalBestChanged", this.personalBest);
      this.pushState();
      return;
    }

    this.levelUpChoice = createInactiveLevelUpChoice();
    this.gameState = "levelComplete";
    this.emit("levelUpChoiceChanged", this.levelUpChoice);
    this.emit("gameStateChanged", this.gameState);
    this.pushState();
  }

  private advanceToNextLevel(): void {
    const nextLevelIndex = Math.min(this.currentLevelIndex + 1, LEVEL_ORDER.length - 1);
    this.initializeLevel(nextLevelIndex, false);
    this.gameState = "playing";
    this.emit("gameStateChanged", "playing");
    this.pushFullState();
  }

  private restartCurrentLevel(): void {
    this.initializeLevel(this.currentLevelIndex, false);
    this.gameState = "playing";
    this.emit("gameStateChanged", "playing");
    this.pushFullState();
  }

  private initializeLevel(levelIndex: number, resetRun: boolean): void {
    this.currentLevelIndex = levelIndex;
    this.currentLevel = LEVEL_DEFINITIONS[LEVEL_ORDER[levelIndex]];
    this.levelSummary = {
      id: this.currentLevel.id,
      name: this.currentLevel.name,
      index: levelIndex + 1,
      total: LEVEL_ORDER.length,
    };

    if (resetRun) {
      this.runTime = 0;
      this.totalKills = 0;
      this.player.score = 0;
      this.player.deaths = 0;
      this.claimedWeaponPickups.clear();
      this.weapon.resetForNewRun();
      this.comboState = createEmptyComboState();
      this.bankState = createEmptyBankState();
      this.scoreEvents = [];
      this.activeUpgrades = [];
      this.progression = createInitialProgressionState();
      this.activeMutator = this.rollMutator();
      this.levelUpChoice = createInactiveLevelUpChoice();
      this.recoveryShard = createInactiveRecoveryShard();
    }

    this.clearArena();
    this.arena = buildArena(this.scene, this.currentLevel);
    this.weaponPickups = this.arena.weaponPickups.map((visual) => {
      const key = `${this.currentLevel.id}:${visual.def.id}`;
      const claimed = this.claimedWeaponPickups.has(key);
      visual.group.visible = !claimed;
      return {
        visual,
        key,
        claimed,
        replaceProgress: 0,
      };
    });
    this.resetBots(this.currentLevel.botSpawns);
    this.jumpPadCooldowns.clear();

    this.levelRuntime = {
      objectiveIndex: 0,
      completedInteractables: [],
      holdProgress: Object.fromEntries(
        this.currentLevel.holdZones.map((entry) => [entry.id, 0])
      ),
      extractionUnlocked: false,
      extractionProgress: 0,
      interactProgress: 0,
      interactTargetId: null,
      escapeTimer: null,
      levelTimer: 0,
      reinforcementIds: [],
      completedOptionalObjectives: [],
      optionalProgress: Object.fromEntries(
        this.currentLevel.optionalObjectives.map((entry) => [entry.id, 0])
      ),
      levelDeaths: 0,
      checkpointIndex: 0,
      overchargeState: Object.fromEntries(
        this.currentLevel.holdZones.map((entry) => [entry.id, false])
      ),
    };

    this.levelCompleteSummary = null;
    this.pickupPrompt = createInactivePickupPrompt();
    this.emit("levelComplete", null);
    this.levelScoreBaseline = this.player.score;
    this.threatAlert = createInactiveThreatAlert();
    this.radarState = createInactiveRadarState();
    this.activeOpportunity = null;
    this.objectiveDamageTaken = 0;
    this.objectiveStartHealth = this.player.health;
    this.pressureTimer = PRESSURE_WINDOW;
    this.reliefTimer = 0;
    this.killChainCount = 0;
    this.killChainTimer = 0;
    this.createOptionalObjectiveVisuals();
    this.applyRunModifiers();
    this.respawnPlayer();
    this.updateMedalPace();
    this.objectiveState = this.buildObjectiveState(null);
    this.syncArenaVisuals();
  }

  private clearArena(): void {
    for (const bot of this.bots) {
      bot.dispose();
    }
    this.bots = [];
    this.weaponPickups = [];
    for (const objective of this.optionalObjectives) {
      this.scene.remove(objective.mesh);
      this.scene.remove(objective.beacon);
      objective.mesh.geometry.dispose();
      objective.material.dispose();
      objective.beacon.geometry.dispose();
      objective.beaconMaterial.dispose();
    }
    this.optionalObjectives = [];

    if (this.recoveryShardMesh) {
      this.scene.remove(this.recoveryShardMesh);
      this.recoveryShardMesh.geometry.dispose();
      (this.recoveryShardMesh.material as THREE.Material).dispose();
      this.recoveryShardMesh = null;
    }

    if (this.arena?.root) {
      this.scene.remove(this.arena.root);
    }
  }

  private resetBots(spawns: LevelDefinition["botSpawns"]): void {
    for (const spawn of spawns) {
      this.bots.push(
        new Bot(
          spawn.id,
          spawn.spawn,
          spawn.patrolRoute,
          this.scene,
          spawn.archetype ?? "anchor",
          spawn.elite ?? false,
          this.balanceSnapshot
        )
      );
    }
  }

  private respawnPlayer(): void {
    const spawn = this.getCurrentCheckpoint().spawn;
    this.player.respawn(spawn);
    this.weapon.clearTransientState();
    this.pickupPrompt = createInactivePickupPrompt();
    this.objectiveStartHealth = this.player.health;
    this.emit("healthChanged", this.player.health);
    this.emit("ammoChanged", this.weapon.ammo, this.weapon.reserveAmmo);
    this.emit("deathsChanged", this.player.deaths);
  }

  private spawnReinforcements(spawns: LevelDefinition["reinforcementSpawns"]): void {
    for (const spawn of spawns ?? []) {
      if (this.levelRuntime.reinforcementIds.includes(spawn.id)) continue;
      this.bots.push(
        new Bot(
          spawn.id,
          spawn.spawn,
          spawn.patrolRoute,
          this.scene,
          spawn.archetype ?? "anchor",
          spawn.elite ?? false,
          this.balanceSnapshot
        )
      );
      this.levelRuntime.reinforcementIds.push(spawn.id);
    }
  }

  private updateJumpPadCooldowns(dt: number): void {
    for (const [id, value] of this.jumpPadCooldowns.entries()) {
      const next = value - dt;
      if (next <= 0) {
        this.jumpPadCooldowns.delete(id);
      } else {
        this.jumpPadCooldowns.set(id, next);
      }
    }
  }

  private handleJumpPads(): void {
    for (const jumpPad of this.arena.jumpPads) {
      if (this.jumpPadCooldowns.has(jumpPad.def.id)) continue;
      const distance = this.player.body.position.distanceTo(jumpPad.def.position);
      if (distance > jumpPad.def.radius) continue;
      this.player.launch(jumpPad.def.impulse);
      this.jumpPadCooldowns.set(jumpPad.def.id, JUMP_PAD_COOLDOWN);
    }
  }

  private getActiveInteractable(): ArenaInteractableVisual | null {
    if (this.currentLevel.objectiveKind === "hold-zone") {
      return null;
    }

    if (
      this.currentLevel.objectiveKind === "switch-escape" &&
      this.levelRuntime.completedInteractables.length > 0
    ) {
      return null;
    }

    return this.arena?.interactables?.[this.levelRuntime.objectiveIndex] ?? null;
  }

  private getActiveHoldZone(): ArenaHoldZoneVisual | null {
    if (this.currentLevel.objectiveKind !== "hold-zone") return null;
    return this.arena?.holdZones?.[this.levelRuntime.objectiveIndex] ?? null;
  }

  private buildObjectiveState(interactPrompt: string | null): ObjectiveState {
    const opportunityHint = this.activeOpportunity
      ? `${this.activeOpportunity.label}: ${this.activeOpportunity.hint}`
      : null;

    if (this.currentLevel.objectiveKind === "terminal-sequence") {
      const active = this.getActiveInteractable();
      return {
        kind: "terminal-sequence",
        title: this.currentLevel.name,
        text: active
          ? `Go to ${active.def.label}`
          : "Move to extraction",
        detail: "",
        progress: `${this.levelRuntime.completedInteractables.length}/${this.currentLevel.interactables.length}`,
        interactPrompt,
        extractionUnlocked: this.levelRuntime.extractionUnlocked,
        escapeTimer: null,
        opportunityHint,
      };
    }

    if (this.currentLevel.objectiveKind === "hold-zone") {
      const active = this.getActiveHoldZone();
      const progressValue = active
        ? this.levelRuntime.holdProgress[active.def.id] ?? 0
        : this.currentLevel.holdZones.reduce(
            (sum, zone) => sum + (this.levelRuntime.holdProgress[zone.id] ?? 0),
            0
          );
      return {
        kind: "hold-zone",
        title: this.currentLevel.name,
        text: active
          ? `Hold ${active.def.label}`
          : "Move to extraction",
        detail: "",
        progress: active
          ? `${Math.min(active.def.duration, progressValue).toFixed(1)}/${active.def.duration.toFixed(1)}`
          : `${this.currentLevel.holdZones.length}/${this.currentLevel.holdZones.length}`,
        interactPrompt,
        extractionUnlocked: this.levelRuntime.extractionUnlocked,
        escapeTimer: null,
        opportunityHint,
      };
    }

    const switchComplete = this.levelRuntime.completedInteractables.length > 0;
    return {
      kind: "switch-escape",
      title: this.currentLevel.name,
      text: switchComplete
        ? "Get to extraction"
        : `Trigger ${this.currentLevel.interactables[0]?.label ?? "reactor"}`,
      detail: "",
      progress: switchComplete ? "1/1" : "0/1",
      interactPrompt,
      extractionUnlocked: this.levelRuntime.extractionUnlocked,
      escapeTimer:
        this.levelRuntime.escapeTimer === null
          ? null
          : Number(this.levelRuntime.escapeTimer.toFixed(1)),
      opportunityHint,
    };
  }

  private updateBotBias(): void {
    const activeInteractable = this.getActiveInteractable();
    const activeHoldZone = this.getActiveHoldZone();
    const baseFocus =
      activeHoldZone?.def.position ??
      activeInteractable?.def.position ??
      (this.levelRuntime.extractionUnlocked
        ? this.arena.extraction.def.position
        : this.currentLevel.spawnPoints[0].position);
    const biasPoints = this.currentLevel.objectiveDefensePoints ?? [];

    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const bias = biasPoints[i % Math.max(1, biasPoints.length)] ?? baseFocus;
      bot.setObjectiveBias(bias);
    }
  }

  private syncArenaVisuals(): void {
    const activeInteractable = this.getActiveInteractable();
    const activeHoldZone = this.getActiveHoldZone();

    for (const interactable of this.arena.interactables) {
      const completed = this.levelRuntime.completedInteractables.includes(interactable.def.id);
      const active = activeInteractable?.def.id === interactable.def.id;
      interactable.beacon.visible = !completed;
      interactable.label.visible = !completed;
      interactable.accent.emissiveIntensity = completed ? 0.08 : active ? 0.92 : 0.28;
      interactable.accent.color.set(active ? 0x8ed6ff : completed ? 0x6dc5a2 : 0x7ab7ff);
      interactable.group.visible = true;
    }

    for (const holdZone of this.arena.holdZones) {
      const active = activeHoldZone?.def.id === holdZone.def.id;
      const progress = this.levelRuntime.holdProgress[holdZone.def.id] ?? 0;
      const pct = Math.min(1, progress / holdZone.def.duration);
      holdZone.beacon.visible = !this.levelRuntime.extractionUnlocked || active;
      holdZone.label.visible = !this.levelRuntime.extractionUnlocked || active;
      holdZone.material.opacity = active ? 0.32 + pct * 0.18 : 0.12;
      holdZone.material.color.set(active ? 0x8fdcff : 0x6ed0ff);
    }

    for (const jumpPad of this.arena.jumpPads) {
      const pulse = 0.35 + Math.sin(performance.now() / 180) * 0.08;
      jumpPad.material.emissiveIntensity = pulse;
    }

    for (let i = 0; i < this.weaponPickups.length; i++) {
      const pickup = this.weaponPickups[i];
      pickup.visual.group.visible = !pickup.claimed;
      if (pickup.claimed) continue;

      const time = performance.now() * 0.002 + i * 0.65;
      pickup.visual.group.position.set(
        pickup.visual.def.position.x,
        pickup.visual.def.position.y + Math.sin(time) * 0.08,
        pickup.visual.def.position.z
      );
      pickup.visual.ring.rotation.z += 0.015;
      pickup.visual.core.rotation.y += 0.02;
      pickup.visual.material.emissiveIntensity = 0.62 + Math.sin(time * 1.6) * 0.12;
      pickup.visual.ringMaterial.emissiveIntensity = 0.48 + Math.cos(time * 1.8) * 0.12;
      pickup.visual.beaconMaterial.opacity = 0.16 + Math.sin(time) * 0.04;
    }

    for (let i = 0; i < this.optionalObjectives.length; i++) {
      const runtime = this.optionalObjectives[i];
      const definition = this.currentLevel.optionalObjectives.find(
        (entry) => entry.id === runtime.id
      );
      if (!definition) continue;

      const active = this.isOptionalObjectiveActive(definition);
      const completed = this.levelRuntime.completedOptionalObjectives.includes(runtime.id);
      runtime.mesh.visible = active && !completed;
      runtime.beacon.visible = active && !completed;
      if (!runtime.mesh.visible) continue;

      const t = performance.now() * 0.002 + i * 0.4;
      runtime.material.emissiveIntensity = 0.45 + Math.sin(t * 1.8) * 0.15;
      runtime.beaconMaterial.opacity = 0.1 + Math.sin(t) * 0.04;
      runtime.mesh.position.y = definition.position.y + 0.32 + Math.sin(t) * 0.08;
    }

    const extractionVisible = this.levelRuntime.extractionUnlocked;
    this.arena.extraction.group.visible = extractionVisible;
    this.arena.extraction.material.emissiveIntensity = extractionVisible ? 0.78 : 0.08;
  }

  private pushState(): void {
    const inventory = this.weapon.getInventoryState();
    this.emit("healthChanged", this.player.health);
    this.emit("ammoChanged", inventory.ammo, inventory.reserveAmmo);
    this.emit("inventoryChanged", inventory);
    this.emit("pickupPromptChanged", this.pickupPrompt);
    this.emit("reloading", inventory.isReloading);
    this.emit("threatChanged", this.threatAlert);
    this.emit("radarChanged", this.radarState);
    this.emit("movementChanged", {
      state: this.player.movementState,
      dashCooldown: this.player.getDashCooldown(),
      horizontalSpeed: Number(this.player.getHorizontalSpeed().toFixed(2)),
      verticalSpeed: this.player.getVerticalSpeed(),
      grounded: this.player.body.isGrounded,
    });
    this.emit("objectiveChanged", this.objectiveState);
    this.emit("levelChanged", this.levelSummary);
    this.emit("runTimerChanged", {
      runTime: Number(this.runTime.toFixed(1)),
      levelTime: Number(this.levelRuntime.levelTimer.toFixed(1)),
      escapeTimer:
        this.levelRuntime.escapeTimer === null
          ? null
          : Number(this.levelRuntime.escapeTimer.toFixed(1)),
    });
    this.emit("comboChanged", this.comboState);
    this.emit("scoreEventsChanged", this.scoreEvents);
    this.emit("mutatorChanged", this.activeMutator);
    this.emit("upgradesChanged", this.activeUpgrades);
    this.emit("progressionChanged", this.progression);
    this.emit("levelUpChoiceChanged", this.levelUpChoice);
    this.emit("runtimeModifiersChanged", this.runtimeModifiers);
    this.emit("balanceChanged", this.balanceSnapshot);
    this.emit("opportunityChanged", this.activeOpportunity);
    this.emit("medalPaceChanged", this.medalPace);
    this.emit("personalBestChanged", this.personalBest);
  }

  private pushFullState(): void {
    const inventory = this.weapon.getInventoryState();
    this.emit("healthChanged", this.player.health);
    this.emit("ammoChanged", inventory.ammo, inventory.reserveAmmo);
    this.emit("inventoryChanged", inventory);
    this.emit("pickupPromptChanged", this.pickupPrompt);
    this.emit("scoreChanged", this.player.score);
    this.emit("deathsChanged", this.player.deaths);
    this.emit("reloading", inventory.isReloading);
    this.emit("threatChanged", this.threatAlert);
    this.emit("radarChanged", this.radarState);
    this.emit("movementChanged", {
      state: this.player.movementState,
      dashCooldown: this.player.getDashCooldown(),
      horizontalSpeed: Number(this.player.getHorizontalSpeed().toFixed(2)),
      verticalSpeed: this.player.getVerticalSpeed(),
      grounded: this.player.body.isGrounded,
    });
    this.emit("objectiveChanged", this.objectiveState);
    this.emit("levelChanged", this.levelSummary);
    this.emit("runTimerChanged", {
      runTime: Number(this.runTime.toFixed(1)),
      levelTime: Number(this.levelRuntime.levelTimer.toFixed(1)),
      escapeTimer:
        this.levelRuntime.escapeTimer === null
          ? null
          : Number(this.levelRuntime.escapeTimer.toFixed(1)),
    });
    this.emit("levelComplete", this.levelCompleteSummary);
    this.emit("comboChanged", this.comboState);
    this.emit("scoreEventsChanged", this.scoreEvents);
    this.emit("mutatorChanged", this.activeMutator);
    this.emit("upgradesChanged", this.activeUpgrades);
    this.emit("progressionChanged", this.progression);
    this.emit("levelUpChoiceChanged", this.levelUpChoice);
    this.emit("runtimeModifiersChanged", this.runtimeModifiers);
    this.emit("balanceChanged", this.balanceSnapshot);
    this.emit("opportunityChanged", this.activeOpportunity);
    this.emit("medalPaceChanged", this.medalPace);
    this.emit("personalBestChanged", this.personalBest);
  }

  private getInteractionDurationScale(): number {
    return 1;
  }

  private applyRunModifiers(): void {
    this.runtimeModifiers = computeRuntimeModifiers(this.activeUpgrades);
    const powerScore = computePowerScore(this.activeUpgrades);
    this.progression = {
      ...this.progression,
      powerScore,
    };
    this.balanceSnapshot = computeBalanceSnapshot(powerScore);
    this.comboState.maxTimer = this.getComboMaxTimer();
    this.comboState.timer = Math.min(this.comboState.timer, this.comboState.maxTimer);
    this.player.applyRuntimeModifiers(this.runtimeModifiers);
    this.weapon.applyRuntimeModifiers(this.runtimeModifiers);
    for (const bot of this.bots) {
      bot.setDirectorBalance(this.balanceSnapshot);
    }
  }

  private getComboMaxTimer(): number {
    let timer = COMBO_BASE_TIMER;
    if (this.activeMutator?.id === "long-burn") timer += 1.6;
    if (this.weapon.activeWeaponId === "arc-smg") timer += 0.2;
    return timer;
  }

  private pushScoreEvent(event: Omit<ScoreEvent, "id" | "timestamp">): void {
    this.scoreEvents = [
      {
        ...event,
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
        timestamp: Date.now(),
      },
      ...this.scoreEvents,
    ].slice(0, EVENT_FEED_LIMIT);
  }

  private addComboValue(
    amount: number,
    label: string,
    kind: ScoreEvent["kind"],
    detail?: string
  ): number {
    if (amount <= 0) return 0;

    this.comboState.maxTimer = this.getComboMaxTimer();
    this.comboState.timer = this.comboState.maxTimer;
    this.comboState.streak += 1;
    this.comboState.multiplier = Math.min(8, 1 + Math.floor(this.comboState.streak / 2));
    const total = Math.round(amount * this.comboState.multiplier);
    this.comboState.liveBonus += total;
    this.bankState.live = this.comboState.liveBonus;
    this.comboState.heat = Math.min(
      1,
      this.comboState.liveBonus / Math.max(600, this.currentLevel.medalThresholds.gold)
    );
    this.comboState.bestMultiplier = Math.max(
      this.comboState.bestMultiplier,
      this.comboState.multiplier
    );
    this.comboState.bestLiveBonus = Math.max(
      this.comboState.bestLiveBonus,
      this.comboState.liveBonus
    );
    this.pushScoreEvent({ kind, label, amount: total, detail });
    return total;
  }

  private bankCombo(label: string, factor = 1): number {
    if (this.comboState.liveBonus <= 0) return 0;

    let bankFactor = factor;
    if (this.activeMutator?.id === "hunter-protocol") bankFactor *= 1.08;

    const banked = Math.round(this.comboState.liveBonus * bankFactor);
    this.awardScore(banked);
    this.bankState.level += banked;
    this.bankState.run += banked;
    this.comboState.bankedLevel = this.bankState.level;
    this.comboState.bankedRun = this.bankState.run;
    this.comboState.liveBonus = 0;
    this.bankState.live = 0;
    this.comboState.multiplier = Math.max(1, Math.floor(this.comboState.multiplier / 2));
    this.comboState.streak = Math.max(0, Math.floor(this.comboState.streak / 2));
    this.comboState.heat = 0;
    this.comboState.timer = this.comboState.maxTimer * 0.5;
    this.reliefTimer = RELIEF_WINDOW;
    this.pushScoreEvent({ kind: "bank", label, amount: banked });
    return banked;
  }

  private updateComboDecay(dt: number): void {
    if (this.gameState !== "playing") return;
    if (this.comboState.timer > 0) {
      this.comboState.timer = Math.max(0, this.comboState.timer - dt);
      return;
    }

    if (this.comboState.liveBonus <= 0 && this.comboState.multiplier <= 1) return;
    this.comboState.liveBonus = 0;
    this.bankState.live = 0;
    this.comboState.multiplier = 1;
    this.comboState.streak = 0;
    this.comboState.heat = 0;
    this.pushScoreEvent({
      kind: "death",
      label: "Combo Dropped",
      amount: 0,
      detail: "Momentum expired before you banked it.",
    });
  }

  private handleBotKill(bot: Bot, weaponName: string, point: THREE.Vector3): void {
    const distance = this.player.body.position.distanceTo(point);
    const weaponId = this.weapon.activeWeaponId;
    const xpGain = this.getXpForBot(bot);
    let baseScore = 100;
    if (bot.isElite()) baseScore += 80;
    if (bot.getArchetype() === "anchor") baseScore += 20;
    if (bot.getArchetype() === "disruptor") baseScore += 10;
    this.awardScore(baseScore);

    let styleBonus = 70;
    if (this.player.movementState === "slide") {
      styleBonus += 80;
      this.pushScoreEvent({ kind: "style", label: "Slide Kill", amount: 80 });
    } else if (this.player.movementState === "dash") {
      styleBonus += 95;
      this.pushScoreEvent({ kind: "style", label: "Dash Kill", amount: 95 });
    } else if (this.player.movementState === "air") {
      styleBonus += 70;
      this.pushScoreEvent({ kind: "style", label: "Air Kill", amount: 70 });
    }

    if (distance >= 14) {
      styleBonus += 55;
      this.pushScoreEvent({ kind: "style", label: "Long Range", amount: 55 });
    }

    if (this.player.health <= 35) {
      styleBonus += 65;
      this.pushScoreEvent({ kind: "style", label: "Clutch Kill", amount: 65 });
    }

    if (this.killChainTimer > 0) {
      this.killChainCount += 1;
    } else {
      this.killChainCount = 1;
    }
    this.killChainTimer = 2.4;
    if (this.killChainCount >= 2) {
      const chainBonus = 35 * this.killChainCount;
      styleBonus += chainBonus;
      this.pushScoreEvent({
        kind: "style",
        label: `${this.killChainCount}x Chain`,
        amount: chainBonus,
      });
    }

    if (weaponId === "scattershot" && distance <= 6.4) {
      styleBonus += 85;
    }
    if (weaponId === "rail-lance" || weaponId === "helix-burst-rifle") {
      styleBonus += 40;
      if (this.activeMutator?.id === "rail-bounty") {
        styleBonus += 80;
      }
    }
    if (weaponId === "arc-smg") {
      this.comboState.timer = Math.min(
        this.comboState.maxTimer,
        this.comboState.timer + 0.5
      );
      styleBonus += 20;
    }
    if (weaponId === "plasma-lobber") {
      styleBonus += 35;
    }
    if (
      this.activeMutator?.id === "dash-harvest" &&
      (this.player.movementState === "dash" || this.player.movementState === "slide")
    ) {
      styleBonus += 75;
    }
    if (this.activeMutator?.id === "volatile-supply") {
      styleBonus += 25;
    }

    this.totalKills += 1;
    this.addComboValue(styleBonus, weaponName, "kill", bot.data.name);
    this.awardKillXp(xpGain);
    this.updateMedalPace();
  }

  private handlePlayerDeath(killerName: string): void {
    this.gameState = "gameover";

    const stats: GameOverStats = {
      score: this.player.score + this.bankState.level + this.bankState.run,
      kills: this.totalKills,
      timeAlive: Number(this.runTime.toFixed(1)),
      bestCombo: this.comboState.bestMultiplier,
      levelReached: this.currentLevel.name,
      killedBy: killerName,
    };

    this.updatePersonalBest(false);

    this.emit("kill", {
      killer: killerName,
      victim: "You",
      weapon: "Rifle",
      timestamp: Date.now(),
    });
    this.emit("gameStateChanged", "gameover");
    this.emit("gameOver", stats);
    this.emit("personalBestChanged", this.personalBest);
    this.audio.playDeath();
    this.input.exitPointerLock();
    this.pushState();
  }

  private dropRecoveryShard(value: number): void {
    if (this.recoveryShardMesh) {
      this.scene.remove(this.recoveryShardMesh);
      this.recoveryShardMesh.geometry.dispose();
      (this.recoveryShardMesh.material as THREE.Material).dispose();
      this.recoveryShardMesh = null;
    }

    const material = new THREE.MeshStandardMaterial({
      color: 0xffd780,
      emissive: 0x7d4a12,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.18,
    });
    this.recoveryShardMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      material
    );
    this.recoveryShardMesh.position.copy(this.player.body.position).setY(0.55);
    this.scene.add(this.recoveryShardMesh);
    this.recoveryShard = {
      active: true,
      position: this.recoveryShardMesh.position.clone(),
      value,
      ttl: RECOVERY_SHARD_LIFETIME,
    };
  }

  private updateRecoveryShard(dt: number): void {
    if (!this.recoveryShard.active || !this.recoveryShardMesh) return;

    this.recoveryShard.ttl = Math.max(0, this.recoveryShard.ttl - dt);
    this.recoveryShardMesh.rotation.y += dt * 2.5;
    this.recoveryShardMesh.position.y =
      0.55 + Math.sin(performance.now() * 0.006) * 0.08;
    this.recoveryShard.position = this.recoveryShardMesh.position.clone();

    if (this.recoveryShard.ttl > 0) return;

    this.scene.remove(this.recoveryShardMesh);
    this.recoveryShardMesh.geometry.dispose();
    (this.recoveryShardMesh.material as THREE.Material).dispose();
    this.recoveryShardMesh = null;
    this.recoveryShard = createInactiveRecoveryShard();
  }

  private updateRecoveryShardPickup(): void {
    if (!this.recoveryShard.active || !this.recoveryShard.position || !this.player.isAlive) {
      return;
    }

    if (this.player.body.position.distanceTo(this.recoveryShard.position) > RECOVERY_SHARD_RADIUS) {
      return;
    }

    this.awardScore(this.recoveryShard.value);
    this.addComboValue(
      Math.round(this.recoveryShard.value * 0.4),
      "Recovery Shard",
      "recovery"
    );
    if (this.recoveryShardMesh) {
      this.scene.remove(this.recoveryShardMesh);
      this.recoveryShardMesh.geometry.dispose();
      (this.recoveryShardMesh.material as THREE.Material).dispose();
      this.recoveryShardMesh = null;
    }
    this.recoveryShard = createInactiveRecoveryShard();
  }

  private createOptionalObjectiveVisuals(): void {
    for (const objective of this.currentLevel.optionalObjectives) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xffd27a,
        emissive: 0x8a5a16,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), material);
      mesh.position.copy(objective.position).setY(objective.position.y + 0.32);
      const beaconMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.34, 3.4, 12, 1, true),
        beaconMaterial
      );
      beacon.position.copy(objective.position).setY(objective.position.y + 1.8);
      this.scene.add(mesh);
      this.scene.add(beacon);
      this.optionalObjectives.push({
        id: objective.id,
        mesh,
        beacon,
        material,
        beaconMaterial,
      });
    }
  }

  private updateOptionalObjectives(dt: number, interactHeld: boolean): void {
    for (const objective of this.currentLevel.optionalObjectives) {
      if (!this.isOptionalObjectiveActive(objective)) continue;

      const distance = this.player.body.position.distanceTo(objective.position);
      if (objective.kind === "elite-wave") {
        const eligible = (objective.linkedSpawnIds ?? []).every((id) =>
          this.levelRuntime.reinforcementIds.includes(id)
        );
        const cleared = (objective.linkedSpawnIds ?? []).every((id) =>
          !this.bots.some((bot) => bot.data.id === id && bot.isAlive())
        );
        if (eligible && cleared) {
          this.completeOptionalObjective(objective, "Elite Cleared");
        }
        continue;
      }

      if (objective.kind === "bonus-cache") {
        if (
          distance <= objective.radius &&
          (!objective.requiresWeaponIds ||
            (this.weapon.activeWeaponId !== null &&
              objective.requiresWeaponIds.includes(this.weapon.activeWeaponId)))
        ) {
          this.completeOptionalObjective(objective, objective.label);
        }
        continue;
      }

      if (objective.kind === "bonus-ring") {
        const inside = distance <= objective.radius;
        if (inside) {
          if ((objective.linkedSpawnIds?.length ?? 0) > 0) {
            this.spawnLinkedReinforcements(objective.id);
          }
          this.levelRuntime.optionalProgress[objective.id] =
            (this.levelRuntime.optionalProgress[objective.id] ?? 0) + dt;
          if (
            this.levelRuntime.optionalProgress[objective.id] >=
            (objective.holdDuration ?? 2) * this.getInteractionDurationScale()
          ) {
            this.completeOptionalObjective(objective, objective.label);
          }
        } else {
          this.levelRuntime.optionalProgress[objective.id] = Math.max(
            0,
            (this.levelRuntime.optionalProgress[objective.id] ?? 0) - dt * 1.2
          );
        }
        continue;
      }

      if (
        objective.kind === "overload-node" &&
        distance <= objective.radius &&
        interactHeld
      ) {
        this.levelRuntime.optionalProgress[objective.id] =
          (this.levelRuntime.optionalProgress[objective.id] ?? 0) + dt;
        if (
          this.levelRuntime.optionalProgress[objective.id] >=
          (objective.holdDuration ?? 0.8) * this.getInteractionDurationScale()
        ) {
          this.completeOptionalObjective(objective, "Overload Live");
        }
      } else if (objective.kind === "overload-node") {
        this.levelRuntime.optionalProgress[objective.id] = 0;
      }
    }
  }

  private completeOptionalObjectivesFromInteractable(interactableId: string): void {
    for (const objective of this.currentLevel.optionalObjectives) {
      if (objective.onlyAfterInteractableId !== interactableId) continue;
      if ((objective.linkedSpawnIds?.length ?? 0) > 0) {
        this.spawnLinkedReinforcements(objective.id);
      }
      this.pushScoreEvent({
        kind: "route",
        label: objective.label,
        amount: 0,
        detail: objective.hint,
      });
    }
  }

  private completeTimedExtractIfEligible(): void {
    for (const objective of this.currentLevel.optionalObjectives) {
      if (objective.kind !== "timed-extract") continue;
      if (!this.isOptionalObjectiveActive(objective)) continue;
      if (
        objective.timeLimit !== undefined &&
        this.levelRuntime.levelTimer <= objective.timeLimit
      ) {
        this.completeOptionalObjective(objective, objective.label);
      }
    }
  }

  private completeOptionalObjective(
    objective: LevelDefinition["optionalObjectives"][number],
    label: string
  ): void {
    if (this.levelRuntime.completedOptionalObjectives.includes(objective.id)) return;
    this.levelRuntime.completedOptionalObjectives.push(objective.id);
    const cash = Math.round(objective.scoreValue * 0.4);
    this.awardScore(cash);
    this.addComboValue(objective.scoreValue, label, "route", objective.hint);
    this.pushScoreEvent({ kind: "route", label, amount: cash, detail: objective.hint });
    this.updateMedalPace();
  }

  private isOptionalObjectiveActive(
    objective: LevelDefinition["optionalObjectives"][number]
  ): boolean {
    if (this.levelRuntime.completedOptionalObjectives.includes(objective.id)) return false;
    if (
      objective.unlockObjectiveIndex !== undefined &&
      this.levelRuntime.objectiveIndex < objective.unlockObjectiveIndex
    ) {
      return false;
    }
    if (
      objective.onlyAfterInteractableId &&
      !this.levelRuntime.completedInteractables.includes(objective.onlyAfterInteractableId)
    ) {
      return false;
    }
    if (objective.onlyAfterExtractionUnlocked && !this.levelRuntime.extractionUnlocked) {
      return false;
    }
    return true;
  }

  private updateCheckpointFromObjective(): void {
    const nextIndex = this.currentLevel.checkpoints.reduce((bestIndex, checkpoint, index) => {
      if (checkpoint.objectiveIndex <= this.levelRuntime.objectiveIndex) {
        return index;
      }
      return bestIndex;
    }, 0);
    this.levelRuntime.checkpointIndex = nextIndex;
  }

  private getCurrentCheckpoint(): CheckpointState {
    return (
      this.currentLevel.checkpoints[this.levelRuntime?.checkpointIndex ?? 0] ??
      this.currentLevel.checkpoints[0]
    );
  }

  private resetObjectiveDamageWindow(): void {
    this.objectiveDamageTaken = 0;
    this.objectiveStartHealth = this.player.health;
  }

  private spawnLinkedReinforcements(objectiveId: string): void {
    const objective = this.currentLevel.optionalObjectives.find((entry) => entry.id === objectiveId);
    const spawnIds = objective?.linkedSpawnIds ?? [];
    const spawns = (this.currentLevel.reinforcementSpawns ?? []).filter((entry) =>
      spawnIds.includes(entry.id)
    );
    this.spawnReinforcements(spawns);
  }

  private updateEncounterPressure(dt: number): void {
    if (this.reliefTimer > 0) {
      this.reliefTimer = Math.max(0, this.reliefTimer - dt);
      return;
    }

    this.pressureTimer -= dt;
    if (this.pressureTimer > 0) return;

    const shouldPressure =
      this.comboState.multiplier >= 3 ||
      this.levelRuntime.escapeTimer !== null ||
      this.activeMutator?.id === "hunter-protocol" ||
      Boolean(this.objectiveState.interactPrompt);

    this.pressureTimer = Math.max(
      2.5,
      (PRESSURE_WINDOW - this.comboState.multiplier * 0.35) *
        this.balanceSnapshot.reinforcementIntervalMultiplier
    );
    if (!shouldPressure) return;

    const available = (this.currentLevel.reinforcementSpawns ?? []).filter(
      (entry) => !this.levelRuntime.reinforcementIds.includes(entry.id)
    );
    if (available.length === 0) return;

    this.spawnReinforcements([available[0]]);
  }

  private updateOpportunityState(): void {
    const activeObjectives = this.currentLevel.optionalObjectives
      .filter((entry) => this.isOptionalObjectiveActive(entry))
      .map((entry) => ({
        ...entry,
        distance: this.player.body.position.distanceTo(entry.position),
      }))
      .sort((a, b) => a.distance - b.distance);

    const nearest = activeObjectives[0];
    this.activeOpportunity =
      nearest && (nearest.distance <= 14 || nearest.kind === "timed-extract")
        ? {
            id: nearest.id,
            label: nearest.label,
            hint: nearest.hint,
            kind: nearest.kind,
            distance: Number(nearest.distance.toFixed(1)),
          }
        : null;
    this.objectiveState = this.buildObjectiveState(this.objectiveState.interactPrompt);
  }

  private updateMedalPace(): void {
    const projectedScore = this.player.score + this.comboState.liveBonus;
    const maxTier = this.getMaxMedalTier();
    const thresholds = getAdjustedMedalThresholds(
      this.currentLevel.medalThresholds,
      this.balanceSnapshot
    );
    const current = this.clampMedalTier(
      this.getMedalTierForScore(projectedScore),
      maxTier
    );
    const next = this.getNextMedalTier(projectedScore, maxTier);
    const threshold = next ? thresholds[next] : 0;
    const bestTime = this.personalBest.levelBestTimes[this.currentLevel.id] ?? null;
    this.medalPace = {
      current,
      next,
      pointsToNext: next ? Math.max(0, threshold - projectedScore) : 0,
      maxTier,
      degraded: maxTier !== "s",
      targetTime: thresholds.targetTime,
      splitDelta:
        bestTime !== null
          ? Number((this.levelRuntime.levelTimer - bestTime).toFixed(1))
          : Number(
              (this.levelRuntime.levelTimer - thresholds.targetTime).toFixed(1)
            ),
      bestScore: this.personalBest.levelBestScores[this.currentLevel.id] ?? 0,
      bestTime,
    };
  }

  private getMedalTierForScore(score: number): MedalTier | null {
    const thresholds = getAdjustedMedalThresholds(
      this.currentLevel.medalThresholds,
      this.balanceSnapshot
    );
    if (score >= thresholds.s) return "s";
    if (score >= thresholds.gold) return "gold";
    if (score >= thresholds.silver) return "silver";
    if (score >= thresholds.bronze) return "bronze";
    return null;
  }

  private getMaxMedalTier(): MedalTier {
    if (this.levelRuntime.levelDeaths >= 2) return "gold";
    return "s";
  }

  private getNextMedalTier(score: number, maxTier: MedalTier): MedalTier | null {
    const order: MedalTier[] = ["bronze", "silver", "gold", "s"];
    const allowed = order.slice(0, order.indexOf(maxTier) + 1);
    const thresholds = getAdjustedMedalThresholds(
      this.currentLevel.medalThresholds,
      this.balanceSnapshot
    );
    for (const tier of allowed) {
      if (score < thresholds[tier]) {
        return tier;
      }
    }
    return null;
  }

  private clampMedalTier(medal: MedalTier | null, maxTier: MedalTier): MedalTier | null {
    if (!medal) return null;
    const order: MedalTier[] = ["bronze", "silver", "gold", "s"];
    return order.indexOf(medal) > order.indexOf(maxTier) ? maxTier : medal;
  }

  private rollMutator(): RunMutator {
    return RUN_MUTATORS[Math.floor(Math.random() * RUN_MUTATORS.length)];
  }

  private tryOpenLevelUpChoice(): void {
    if (this.gameState !== "playing") return;
    if (this.progression.pendingLevelUps <= 0) return;

    this.levelUpChoice = rollLevelUpChoices(this.progression.level, this.activeUpgrades);
    if (!this.levelUpChoice.active) {
      this.progression = {
        ...this.progression,
        pendingLevelUps: 0,
      };
      this.emit("progressionChanged", this.progression);
      return;
    }

    this.gameState = "levelUpChoice";
    this.input.exitPointerLock();
    this.emit("levelUpChoiceChanged", this.levelUpChoice);
    this.emit("gameStateChanged", this.gameState);
  }

  private awardKillXp(amount: number): void {
    const powerScore = computePowerScore(this.activeUpgrades);
    this.progression = awardXp(this.progression, amount, powerScore);
    this.emit("progressionChanged", this.progression);
    this.tryOpenLevelUpChoice();
  }

  private getXpForBot(bot: Bot): number {
    let xp =
      bot.getArchetype() === "anchor"
        ? 26
        : bot.getArchetype() === "disruptor"
          ? 22
          : 18;
    if (bot.isElite()) xp += 12;
    return xp;
  }

  private describeNextTarget(): string {
    if (this.medalPace.next) {
      return `${this.medalPace.pointsToNext} pts to ${this.medalPace.next.toUpperCase()}`;
    }
    if (this.personalBest.bestRunScore > this.player.score) {
      return `${this.personalBest.bestRunScore - this.player.score} pts to PB`;
    }
    return "New route target available";
  }

  private loadPersonalBest(): PersonalBestSnapshot {
    if (typeof window === "undefined") return createEmptyPersonalBest();

    try {
      const raw = window.localStorage.getItem(SCORE_STORAGE_KEY);
      if (!raw) return createEmptyPersonalBest();
      return { ...createEmptyPersonalBest(), ...JSON.parse(raw) } as PersonalBestSnapshot;
    } catch {
      return createEmptyPersonalBest();
    }
  }

  private savePersonalBest(): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(this.personalBest));
  }

  private updatePersonalBest(runComplete: boolean): void {
    this.personalBest.levelBestScores[this.currentLevel.id] = Math.max(
      this.personalBest.levelBestScores[this.currentLevel.id] ?? 0,
      this.player.score - this.levelScoreBaseline
    );

    const bestLevelTime = this.personalBest.levelBestTimes[this.currentLevel.id];
    if (
      bestLevelTime === undefined ||
      this.levelRuntime.levelTimer < bestLevelTime
    ) {
      this.personalBest.levelBestTimes[this.currentLevel.id] = Number(
        this.levelRuntime.levelTimer.toFixed(1)
      );
    }

    if (runComplete) {
      this.personalBest.bestRunScore = Math.max(
        this.personalBest.bestRunScore,
        this.player.score
      );
      if (
        this.personalBest.bestRunTime === null ||
        this.runTime < this.personalBest.bestRunTime
      ) {
        this.personalBest.bestRunTime = Number(this.runTime.toFixed(1));
      }
      this.personalBest.lastRunScore = this.player.score;
    }

    this.savePersonalBest();
  }

  private updateAwareness(playerPos: THREE.Vector3): void {
    if (!this.player.isAlive) {
      this.threatAlert = createInactiveThreatAlert();
      this.radarState = createInactiveRadarState();
      return;
    }

    const playerForward = this.player.camera.getForward().clone();
    playerForward.y = 0;
    if (playerForward.lengthSq() === 0) {
      playerForward.set(0, 0, -1);
    } else {
      playerForward.normalize();
    }

    const playerRight = new THREE.Vector3()
      .crossVectors(playerForward, new THREE.Vector3(0, 1, 0))
      .normalize();

    const contacts: RadarContact[] = [];
    const watchingBots = this.bots
      .filter((bot) => bot.isAlive())
      .map((bot) => {
        const toBot = new THREE.Vector3().subVectors(bot.body.position, playerPos);
        toBot.y = 0;
        const distance = toBot.length();
        if (distance <= 0.001) {
          return null;
        }

        const watching = bot.isWatchingPlayer(playerPos, this.arena.wallMeshes);
        const dirToBot = toBot.normalize();
        const forwardDot = THREE.MathUtils.clamp(playerForward.dot(dirToBot), -1, 1);
        const side = new THREE.Vector3().crossVectors(playerForward, dirToBot).y;

        const radarPosition = new THREE.Vector3().subVectors(bot.body.position, playerPos);
        radarPosition.y = 0;
        const clamped = distance > RADAR_RANGE;
        if (clamped) {
          radarPosition.multiplyScalar(RADAR_RANGE / distance);
        }

        contacts.push({
          id: bot.data.id,
          x: Number((playerRight.dot(radarPosition) / RADAR_RANGE).toFixed(3)),
          y: Number((playerForward.dot(radarPosition) / RADAR_RANGE).toFixed(3)),
          distance: Number(distance.toFixed(1)),
          clamped,
          watching,
        });

        if (!watching) return null;

        return {
          distance,
          direction: classifyThreatDirection(forwardDot, side),
        };
      })
      .filter(
        (threat): threat is { distance: number; direction: ThreatDirection } =>
          Boolean(threat)
      )
      .sort((a, b) => a.distance - b.distance);

    this.radarState = {
      range: RADAR_RANGE,
      contacts: contacts.sort((a, b) => a.distance - b.distance),
    };

    const nearestThreat = watchingBots[0];
    if (!nearestThreat) {
      this.threatAlert = createInactiveThreatAlert();
      return;
    }

    this.threatAlert = {
      active: true,
      direction: nearestThreat.direction,
      count: watchingBots.length,
      distance: Number(nearestThreat.distance.toFixed(1)),
    };
  }

  updateSettings(settings: Partial<GameSettings>): void {
    if (settings.mouseSensitivity !== undefined) {
      this.player.camera.setSensitivity(settings.mouseSensitivity);
    }
    if (settings.masterVolume !== undefined) {
      this.audio.setMasterVolume(settings.masterVolume);
    }
    if (settings.sfxVolume !== undefined) {
      this.audio.setSfxVolume(settings.sfxVolume);
    }
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.audio.dispose();
    this.weapon.dispose();
    this.renderer.dispose();
    for (const bot of this.bots) {
      bot.dispose();
    }
    if (this.arena?.root) {
      this.scene.remove(this.arena.root);
    }
  }

  private awardScore(amount: number): void {
    this.player.score += amount;
    this.emit("scoreChanged", this.player.score);
    this.updateMedalPace();
  }
}

function classifyThreatDirection(
  forwardDot: number,
  side: number
): ThreatDirection {
  if (forwardDot <= -0.45) return "behind";
  if (forwardDot >= 0.45) return "front";
  return side >= 0 ? "left" : "right";
}

function vectorToObject(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return {
    x: Number(vector.x.toFixed(2)),
    y: Number(vector.y.toFixed(2)),
    z: Number(vector.z.toFixed(2)),
  };
}
