// Optional sound (off by default): soft tick for a check firing, chime for success,
// low tone for a logical error. Synthesized with WebAudio, no assets.

import { useApp } from '../store/app';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function play(kind: 'tick' | 'chime' | 'fail' | 'click') {
  if (!useApp.getState().sound) return;
  if (kind === 'tick') tone(1240, 0.06, 'sine', 0.04);
  else if (kind === 'click') tone(660, 0.04, 'triangle', 0.03);
  else if (kind === 'chime') {
    tone(784, 0.35, 'sine', 0.05);
    tone(1175, 0.45, 'sine', 0.04, 0.09);
  } else tone(150, 0.5, 'sawtooth', 0.035);
}
