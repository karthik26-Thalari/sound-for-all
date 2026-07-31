'use client';

import { useRef, useState } from 'react';
import { classifyWithYamnet, type YamnetResult } from '@/lib/yamnet';

export default function ClassifierTab() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<YamnetResult | null>(null);
  const [status, setStatus] = useState(
    'Record a 3-second clip of a sound to classify it — runs on-device, no upload.'
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function recordClip() {
    setResult(null);
    setStatus('Listening…');
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const webmBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await classifyBlob(webmBlob);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setTimeout(() => recorder.stop(), 3000);
  }

  async function classifyBlob(blob: Blob) {
    setRecording(false);
    setBusy(true);
    setStatus('Loading model (first run only) and classifying…');
    try {
      const ctx = new AudioContext();
      const arrayBuf = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      const classification = await classifyWithYamnet(decoded);
      setResult(classification);
      setStatus('Done — ran entirely on-device.');
    } catch (err) {
      setStatus('Could not classify that clip — try a different recording or file.');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    await classifyBlob(file);
  }

  const bucketMeta: Record<YamnetResult['bucket'], { icon: string; label: string }> = {
    doorbell: { icon: '🔔', label: 'Doorbell' },
    alarm: { icon: '🚨', label: 'Alarm' },
    speech: { icon: '🗣️', label: 'Speech' },
    noise: { icon: '🔊', label: 'Background noise' },
  };

  return (
    <div className="panel">
      <span className="pill">Enhancement</span>
      <h2>What's that sound?</h2>
      <p className="lede">
        Classifies doorbell, alarm, speech, or background noise, then routes the
        result into the same 3-way alert system — not a caption feed. Runs
        on-device using YAMNet (Google's pretrained audio event model,
        521 AudioSet classes) — no server call, no cost per use.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary-btn" disabled={recording || busy} onClick={recordClip}>
          {recording ? 'Recording…' : 'Record 3s clip'}
        </button>
        <span className="status-line" style={{ margin: 0 }}>or</span>
        <input type="file" accept="audio/*" onChange={onFile} disabled={recording || busy} />
      </div>

      <div className="status-line">{status}</div>

      {result && (
        <>
          <div className="big-toggle" style={{ marginTop: 20 }}>
            <span style={{ fontSize: '2rem' }}>{bucketMeta[result.bucket].icon}</span>
            <div>
              <strong>{bucketMeta[result.bucket].label}</strong>
              <div className="status-line">
                Raw model label: "{result.rawLabel}" — confidence {(result.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className="waveform-card" style={{ marginTop: 14 }}>
            <h4>Top 5 raw predictions</h4>
            {result.top5.map((item) => (
              <div key={item.label} className="status-line" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.label}</span>
                <span>{(item.score * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
