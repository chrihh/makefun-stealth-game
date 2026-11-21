// Night Ledger — tiny WebAudio sound kit. Every sound is synthesised from
// oscillators and filtered noise, so the game needs no audio files and makes
// no network request. Sounds stay silent until the first user gesture, which
// is when the browser allows an AudioContext to start.

export class SoundKit {
  constructor() {
    this.context = null;
    this.muted = false;
  }

  unlock() {
    if (this.context !== null) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    if (AudioCtor === undefined) return;
    this.context = new AudioCtor();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(frequency, seconds, type = 'sine', volume = 0.12, slideTo = null, delay = 0) {
    if (this.context === null || this.muted) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(this.context.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  noise(seconds, volume = 0.05, delay = 0) {
    if (this.context === null || this.muted) return;
    const start = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start(start);
  }

  step(sneaking) {
    this.noise(sneaking ? 0.05 : 0.08, sneaking ? 0.015 : 0.04);
  }

  pickup() {
    this.tone(660, 0.09, 'triangle', 0.14);
    this.tone(990, 0.14, 'triangle', 0.14, null, 0.07);
  }

  coinThrow() {
    this.tone(1320, 0.07, 'square', 0.05);
    this.tone(1760, 0.1, 'square', 0.04, null, 0.05);
  }

  coinLand() {
    this.tone(2093, 0.16, 'sine', 0.1);
    this.tone(2637, 0.22, 'sine', 0.07, null, 0.04);
  }

  suspicious() {
    this.tone(392, 0.12, 'triangle', 0.1);
  }

  alert() {
    this.tone(196, 0.28, 'sawtooth', 0.13, 98);
    this.tone(147, 0.3, 'sawtooth', 0.1, 73, 0.05);
  }

  caught() {
    this.tone(311, 0.16, 'square', 0.1);
    this.tone(233, 0.16, 'square', 0.1, null, 0.14);
    this.tone(155, 0.34, 'square', 0.11, null, 0.28);
  }

  exitOpen() {
    this.tone(523, 0.12, 'triangle', 0.12);
    this.tone(659, 0.12, 'triangle', 0.12, null, 0.1);
    this.tone(784, 0.2, 'triangle', 0.13, null, 0.2);
  }

  win() {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((note, index) => this.tone(note, 0.22, 'triangle', 0.12, null, index * 0.13));
  }
}
