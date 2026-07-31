'use client';

import { useEffect, useState } from 'react';

// Fixed, non-interactive background layer: a faint grid across the whole
// page, plus a brighter grid + color glow that follows the cursor, a
// handful of static sparkle stars, and a star-burst animation on click.

const SPARKLE_POSITIONS = [
  { top: '8%', left: '6%', size: 18, rotate: -12 },
  { top: '14%', left: '92%', size: 14, rotate: 20 },
  { top: '46%', left: '3%', size: 12, rotate: 8 },
  { top: '78%', left: '95%', size: 20, rotate: -18 },
  { top: '88%', left: '10%', size: 14, rotate: 15 },
  { top: '30%', left: '97%', size: 10, rotate: -25 },
];

function Sparkle({ size, rotate }: { size: number; rotate: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path
        d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"
        fill="none"
        stroke="#0640bc"
        strokeWidth="1"
        opacity="0.5"
      />
    </svg>
  );
}

function BurstStar({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path
        d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
        fill="#0640bc"
        stroke="#030308"
        strokeWidth="1"
      />
    </svg>
  );
}

type Burst = { id: number; x: number; y: number; size: number };

export default function GridGlowBackground() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--my', `${e.clientY}px`);
    }
    let burstId = 0;
    function onClick(e: MouseEvent) {
      const id = burstId++;
      const size = 18 + Math.random() * 14;
      setBursts((prev) => [...prev, { id, x: e.clientX, y: e.clientY, size }]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, 550);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div className="grid-base" />
        <div className="grid-glow" />
        <div className="cursor-glow-color" />
        {SPARKLE_POSITIONS.map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: s.top, left: s.left }}>
            <Sparkle size={s.size} rotate={s.rotate} />
          </div>
        ))}
      </div>
      {bursts.map((b) => (
        <div
          key={b.id}
          className="click-star-burst"
          style={{ left: b.x, top: b.y }}
          aria-hidden="true"
        >
          <BurstStar size={b.size} />
        </div>
      ))}
    </>
  );
}
