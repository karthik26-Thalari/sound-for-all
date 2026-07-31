'use client';

import { useRef, useState } from 'react';
import { timeStretch } from '@/lib/timestretch';

export default function SlowSpeechTab() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [speed, setSpeed] = useState(0.75);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Upload a voice note, video audio, or music clip.');

  const ctxRef = useRef<AudioContext | null>(null);
  const originalBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatus('Decoding audio…');
    const ctx = getCtx();
    const arrayBuf = await file.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    originalBufferRef.current = audioBuf;
    setStatus(`Loaded "${file.name}" — ${audioBuf.duration.toFixed(1)}s. Ready to play.`);
  }

  function stopPlayback() {
    sourceRef.current?.stop();
    sourceRef.current = null;
  }

  function playOriginal() {
    if (!originalBufferRef.current) return;
    stopPlayback();
    const ctx = getCtx();
    const src = ctx.createBufferSource();
    src.buffer = originalBufferRef.current;
    src.connect(ctx.destination);
    src.start();
    sourceRef.current = src;
  }

  function playSlowed() {
    if (!originalBufferRef.current) return;
    setBusy(true);
    setStatus('Stretching audio…');
    // Defer so the "Stretching…" status paints before the (synchronous) DSP work.
    setTimeout(() => {
      const ctx = getCtx();
      const stretched = timeStretch(originalBufferRef.current!, speed, ctx);
      stopPlayback();
      const src = ctx.createBufferSource();
      src.buffer = stretched;
      src.connect(ctx.destination);
      src.start();
      sourceRef.current = src;
      setBusy(false);
      setStatus(`Playing at ${speed}x — same pitch, slower pace.`);
    }, 30);
  }

  return (
    <div className="panel">
      <span className="pill">Layer 3</span>
      <h2>Slow down without the chipmunk effect</h2>
      <p className="lede">
        Helps because older adults often process speech slower, not just hear it
        worse. Pitch stays natural — it just gives you more time per word.
      </p>

      <div className="field-row">
        <label htmlFor="file">Audio file</label>
        <input id="file" type="file" accept="audio/*" onChange={onFile} />
      </div>

      <div className="field-row">
        <label htmlFor="speed">Speed ({speed.toFixed(2)}x)</label>
        <input
          id="speed"
          type="range"
          min={0.5}
          max={1}
          step={0.05}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        <button className="ghost-btn" disabled={!fileName} onClick={playOriginal}>
          Play original
        </button>
        <button className="primary-btn" disabled={!fileName || busy} onClick={playSlowed}>
          {busy ? 'Processing…' : 'Play slowed'}
        </button>
      </div>

      <div className="status-line">{status}</div>
    </div>
  );
}
