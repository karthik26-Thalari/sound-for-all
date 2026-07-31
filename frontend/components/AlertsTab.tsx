'use client';

import { useRef, useState } from 'react';

type AlertKind = 'doorbell' | 'alarm' | 'phone';

const ALERTS: Record<AlertKind, { label: string; icon: string; freq: number; pattern: number[]; vibrate: number[] }> = {
  doorbell: { label: 'Doorbell', icon: '🔔', freq: 880, pattern: [1, 0, 1], vibrate: [200, 100, 200] },
  alarm: { label: 'Smoke alarm', icon: '🚨', freq: 3100, pattern: [1, 1, 1, 1, 1, 1], vibrate: [400, 80, 400, 80, 400, 80, 400] },
  phone: { label: 'Phone ringing', icon: '📞', freq: 1200, pattern: [1, 0, 1, 0], vibrate: [300, 200, 300] },
};

export default function AlertsTab() {
  const [active, setActive] = useState<AlertKind | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  function playTone(freq: number, pattern: number[]) {
    const ctx = ctxRef.current ?? new AudioContext();
    ctxRef.current = ctx;
    const stepMs = 220;
    pattern.forEach((on, i) => {
      if (!on) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + (i * stepMs) / 1000);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + (i * stepMs) / 1000 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (i * stepMs) / 1000 + stepMs / 1000 - 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + (i * stepMs) / 1000);
      osc.stop(ctx.currentTime + (i * stepMs) / 1000 + stepMs / 1000);
    });
  }

  function trigger(kind: AlertKind) {
    const cfg = ALERTS[kind];
    setActive(kind);
    playTone(cfg.freq, cfg.pattern);
    if ('vibrate' in navigator) navigator.vibrate(cfg.vibrate);
    setTimeout(() => setActive(null), 1400);
  }

  return (
    <div className="panel">
      <span className="pill">Layer 2</span>
      <h2>Say every alert three ways</h2>
      <p className="lede">
        Sound, sight, and touch fire together. If one channel is weak — a hearing aid
        left on the nightstand, a phone face-down — the other two still land.
      </p>

      <div className="alert-grid">
        {(Object.keys(ALERTS) as AlertKind[]).map((kind) => (
          <div className="alert-card" key={kind}>
            <span className="icon">{ALERTS[kind].icon}</span>
            <strong>{ALERTS[kind].label}</strong>
            <button className="primary-btn" onClick={() => trigger(kind)}>
              Simulate
            </button>
          </div>
        ))}
      </div>

      <div className="status-line">
        Tap a card to fire sound + screen flash + vibration (on supported devices) together.
      </div>

      <div className={`flash-overlay ${active ? 'active' : ''}`} aria-hidden="true" />
      <div className={`alert-banner ${active ? 'show' : ''}`} role="alert">
        {active && (
          <>
            <span className="icon" style={{ fontSize: '2rem' }}>{ALERTS[active].icon}</span>
            {ALERTS[active].label}
          </>
        )}
      </div>
    </div>
  );
}
