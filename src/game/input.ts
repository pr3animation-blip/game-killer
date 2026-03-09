export interface InputSnapshot {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  slide: boolean;
  dash: boolean;
  fire: boolean;
  firePressed: boolean;
  fireReleased: boolean;
  reload: boolean;
  interact: boolean;
  swapWeapon: boolean;
  selectSlot1: boolean;
  selectSlot2: boolean;
  selectSlot3: boolean;
  ads: boolean;
  adsPressed: boolean;
  adsReleased: boolean;
  tab: boolean;
  escape: boolean;
  mouseDeltaX: number;
  mouseDeltaY: number;
}

export class InputManager {
  private keys = new Map<string, boolean>();
  private keysJustPressed = new Set<string>();
  private mouseButtons = new Map<number, boolean>();
  private mouseButtonsJustPressed = new Set<number>();
  private mouseButtonsJustReleased = new Set<number>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private _isPointerLocked = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private setupListeners(): void {
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
    document.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("contextmenu", this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.code;
    if (!this.keys.get(key)) {
      this.keysJustPressed.add(key);
    }
    this.keys.set(key, true);
    // Prevent default for game keys
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "KeyC",
        "KeyQ",
        "KeyE",
        "KeyR",
        "KeyX",
        "Digit1",
        "Digit2",
        "Digit3",
        "Tab",
        "Escape",
      ].includes(key)
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.mouseButtons.get(e.button)) {
      this.mouseButtonsJustPressed.add(e.button);
    }
    this.mouseButtons.set(e.button, true);
    // Only lock pointer when clicking directly on the game canvas
    if (!this._isPointerLocked && e.target === this.canvas) {
      this.requestPointerLock();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.mouseButtonsJustReleased.add(e.button);
    this.mouseButtons.set(e.button, false);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this._isPointerLocked) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onPointerLockChange = (): void => {
    this._isPointerLocked = document.pointerLockElement === this.canvas;
  };

  requestPointerLock(): void {
    if (!this.canvas.isConnected) return;
    const requestResult = this.canvas.requestPointerLock() as void | Promise<void>;
    if (requestResult instanceof Promise) {
      void requestResult.catch(() => {});
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  poll(): InputSnapshot {
    const snapshot: InputSnapshot = {
      forward: this.keys.get("KeyW") || false,
      backward: this.keys.get("KeyS") || false,
      left: this.keys.get("KeyA") || false,
      right: this.keys.get("KeyD") || false,
      jump: this.keys.get("Space") || false,
      sprint:
        this.keys.get("ShiftLeft") ||
        this.keys.get("ShiftRight") ||
        false,
      slide:
        this.keysJustPressed.has("ControlLeft") ||
        this.keysJustPressed.has("KeyC"),
      dash: this.keysJustPressed.has("KeyQ"),
      fire: this.mouseButtons.get(0) || false,
      firePressed: this.mouseButtonsJustPressed.has(0),
      fireReleased: this.mouseButtonsJustReleased.has(0),
      reload: this.keysJustPressed.has("KeyR"),
      interact: this.keys.get("KeyE") || false,
      swapWeapon: this.keysJustPressed.has("KeyX"),
      selectSlot1: this.keysJustPressed.has("Digit1"),
      selectSlot2: this.keysJustPressed.has("Digit2"),
      selectSlot3: this.keysJustPressed.has("Digit3"),
      ads: this.mouseButtons.get(2) || false,
      adsPressed: this.mouseButtonsJustPressed.has(2),
      adsReleased: this.mouseButtonsJustReleased.has(2),
      tab: this.keys.get("Tab") || false,
      escape: this.keysJustPressed.has("Escape"),
      mouseDeltaX: this.mouseDeltaX,
      mouseDeltaY: this.mouseDeltaY,
    };

    // Reset per-frame state
    this.keysJustPressed.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    return snapshot;
  }

  dispose(): void {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    document.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener(
      "pointerlockchange",
      this.onPointerLockChange
    );
    document.removeEventListener("contextmenu", this.onContextMenu);
  }
}
