class ArenaAudioEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;
  private musicEnabled = false;
  private musicInterval: number | null = null;
  private musicStep = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.14,
    delay = 0
  ): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playDiceRoll(): void {
    const freqs = [240, 320, 280, 380, 460];
    freqs.forEach((f, idx) => {
      this.playTone(f, 0.055, 'triangle', 0.1, idx * 0.055);
    });
  }

  playPawnMove(): void {
    this.playTone(520, 0.08, 'sine', 0.12, 0);
    this.playTone(680, 0.09, 'sine', 0.1, 0.05);
  }

  playCapture(): void {
    this.playTone(300, 0.12, 'sawtooth', 0.14, 0);
    this.playTone(180, 0.22, 'sawtooth', 0.16, 0.09);
    this.playTone(620, 0.16, 'triangle', 0.12, 0.18);
  }

  playHomeArrival(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.playTone(f, 0.18, 'triangle', 0.12, idx * 0.07);
    });
  }

  playExtraTurn(): void {
    this.playTone(587.33, 0.1, 'sine', 0.12, 0);
    this.playTone(880, 0.16, 'sine', 0.14, 0.08);
  }

  playTurnAlert(): void {
    this.playTone(740, 0.1, 'sine', 0.09, 0);
  }

  playVictoryFanfare(): void {
    const melody = [
      { f: 523.25, d: 0.14, t: 0 },
      { f: 659.25, d: 0.14, t: 0.13 },
      { f: 783.99, d: 0.14, t: 0.26 },
      { f: 1046.5, d: 0.4, t: 0.4 },
    ];
    for (const note of melody) {
      this.playTone(note.f, note.d, 'triangle', 0.16, note.t);
    }
  }

  private startMusic(): void {
    if (this.musicInterval !== null || typeof window === 'undefined') return;
    const scale = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23];
    this.musicInterval = window.setInterval(() => {
      if (!this.musicEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const freq = scale[this.musicStep % scale.length];
      this.musicStep++;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }, 520);
  }

  private stopMusic(): void {
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const audioEngine = new ArenaAudioEngine();
