type SoundName = 'correct' | 'wrong' | 'tick' | 'streak' | 'gameover' | 'click' | 'countdown';

const SOUND_FILES: Record<SoundName, string> = {
  correct: '/sounds/correct.mp3',
  wrong: '/sounds/wrong.mp3',
  tick: '/sounds/tick.mp3',
  streak: '/sounds/streak.mp3',
  gameover: '/sounds/gameover.mp3',
  click: '/sounds/click.mp3',
  countdown: '/sounds/countdown.mp3',
};

class SoundManager {
  private cache: Map<SoundName, HTMLAudioElement> = new Map();
  private muted = false;
  private volume = 1.0;

  private load(name: SoundName): HTMLAudioElement {
    if (!this.cache.has(name)) {
      const audio = new Audio(SOUND_FILES[name]);
      audio.preload = 'auto';
      this.cache.set(name, audio);
    }
    return this.cache.get(name)!;
  }

  preload(): void {
    if (typeof window === 'undefined') return;
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => this.load(name));
  }

  play(name: SoundName): void {
    if (typeof window === 'undefined' || this.muted) return;
    try {
      const audio = this.load(name);
      audio.volume = this.volume;
      // Rewind if already playing
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Ignore autoplay policy errors silently
      });
    } catch {
      // Ignore errors
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.cache.forEach((audio) => {
      audio.volume = this.volume;
    });
  }

  isMuted(): boolean {
    return this.muted;
  }
}

const soundManager = new SoundManager();
export default soundManager;
