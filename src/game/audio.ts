import * as THREE from "three";

export class AudioManager {
  private listener: THREE.AudioListener;
  private sounds = new Map<string, THREE.Audio>();
  private masterVolume = 0.8;
  private sfxVolume = 0.8;

  constructor(camera: THREE.PerspectiveCamera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
  }

  setMasterVolume(vol: number): void {
    this.masterVolume = vol;
    this.listener.setMasterVolume(vol);
  }

  setSfxVolume(vol: number): void {
    this.sfxVolume = vol;
  }

  // Generate a simple oscillator-based sound effect
  playShoot(): void {
    this.playTone(800, 0.05, "square", 0.3);
  }

  playHit(): void {
    this.playTone(400, 0.08, "sawtooth", 0.4);
  }

  playDeath(): void {
    this.playTone(200, 0.3, "sawtooth", 0.5);
  }

  playReload(): void {
    this.playTone(600, 0.1, "sine", 0.2);
    setTimeout(() => this.playTone(900, 0.1, "sine", 0.2), 150);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    const ctx = this.listener.context;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume * this.sfxVolume * this.masterVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  dispose(): void {
    this.sounds.forEach((sound) => {
      if (sound.isPlaying) sound.stop();
    });
    this.sounds.clear();
  }
}
