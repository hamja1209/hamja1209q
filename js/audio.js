'use strict';
/* Synthesized audio (Web Audio API): no audio files needed, works offline.
   API: unlock(), set(key,bool), run(bool), update(rpm,gas,skid), coin(), fuel(), jump(), land(v), crash(), over() */
const Sfx = (() => {
  let ac, master, sfxG, musG, osc, sub, filt, engG, noiseBuf, noiseG, timer = null, nextT = 0, stepI = 0, running = false;
  const on = { sound: true, music: true };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const BPM = 132, SP = 60 / BPM / 2;
  const MEL = [72,0,76,0,79,76,0,74, 72,0,74,76,0,79,81,0, 79,0,76,0,74,72,0,69, 71,0,72,0,74,0,76,0];
  const BASS = [48,0,48,0,55,0,55,0, 45,0,45,0,52,0,52,0];

  function unlock() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      ac = new C(); master = ac.createGain(); master.connect(ac.destination);
      sfxG = ac.createGain(); musG = ac.createGain(); sfxG.connect(master); musG.connect(master);
      // engine: saw + sub triangle through a low-pass filter
      osc = ac.createOscillator(); osc.type = 'sawtooth'; sub = ac.createOscillator(); sub.type = 'triangle';
      filt = ac.createBiquadFilter(); filt.type = 'lowpass'; engG = ac.createGain(); engG.gain.value = 0;
      osc.connect(filt); sub.connect(filt); filt.connect(engG); engG.connect(sfxG); osc.start(); sub.start();
      // noise (tire / crash)
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ns = ac.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400;
      noiseG = ac.createGain(); noiseG.gain.value = 0; ns.connect(bp); bp.connect(noiseG); noiseG.connect(sfxG); ns.start();
    }
    if (ac.state === 'suspended') ac.resume();
    apply();
  }
  function apply() {
    if (!ac) return;
    sfxG.gain.value = on.sound ? 1 : 0; musG.gain.value = on.music ? 0.5 : 0;
    engG.gain.setTargetAtTime(running && on.sound ? 0.07 : 0, ac.currentTime, 0.05);
    if (!running || !on.sound) noiseG.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    if (running && on.music) startMusic(); else stopMusic();
  }
  function tone(type, f0, f1, dur, vol, delay = 0, dest) {
    if (!ac || !on.sound) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  function burst(dur, vol, freq) {
    if (!ac || !on.sound) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxG); s.start(t); s.stop(t + dur + 0.02);
  }
  // background music: simple chiptune loop (square melody + triangle bass)
  function noteAt(i, t) {
    const m = MEL[i % 32], b = BASS[i % 16];
    const play = (type, n, vol, len) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(n);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(g); g.connect(musG); o.start(t); o.stop(t + len + 0.02);
    };
    if (m) play('square', m, 0.05, SP * 1.7);
    if (b) play('triangle', b, 0.16, SP * 1.8);
  }
  function startMusic() {
    if (timer || !ac) return; nextT = ac.currentTime + 0.05;
    timer = setInterval(() => { while (nextT < ac.currentTime + 0.3) { noteAt(stepI, nextT); nextT += SP; stepI = (stepI + 1) % 32; } }, 100);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  return {
    unlock,
    set(k, v) { on[k] = v; apply(); },
    run(b) { running = b; apply(); },
    update(rpm, gas, skid) {
      if (!ac || !running) return; const t = ac.currentTime;
      osc.frequency.setTargetAtTime(42 + rpm * 95 + (gas ? 10 : 0), t, 0.06); sub.frequency.setTargetAtTime(21 + rpm * 47, t, 0.06);
      filt.frequency.setTargetAtTime(260 + rpm * 900, t, 0.08);
      noiseG.gain.setTargetAtTime(on.sound ? skid * 0.045 : 0, t, 0.05);
    },
    coin() { tone('square', 988, 988, 0.07, 0.07); tone('square', 1319, 1319, 0.14, 0.07, 0.07); },
    fuel() { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.12, 0.12, i * 0.09)); },
    jump() { tone('sine', 200, 420, 0.15, 0.05); },
    land(v) { const vol = Math.min(0.5, v / 22); tone('sine', 130, 40, 0.25, vol); burst(0.14, vol * 0.7, 700); },
    crash() { burst(0.55, 0.45, 1000); tone('sawtooth', 220, 40, 0.6, 0.25); },
    over() { tone('triangle', 392, 196, 0.6, 0.18); }
  };
})();
