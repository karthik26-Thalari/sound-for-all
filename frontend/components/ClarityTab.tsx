'use client';

import { useEffect, useRef, useState } from 'react';
import { audioBufferToWav, resampleTo16kMono } from '@/lib/wavEncoder';

export default function ClarityTab() {
  const [enabled, setEnabled] = useState(false);
  const [boostOn, setBoostOn] = useState(true);
  const [boostGain, setBoostGain] = useState(9); // dB, applied 1.5-4kHz
  const [status, setStatus] = useState('Microphone off.');

  // --- file enhance/isolate state ---
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileStatus, setFileStatus] = useState('Upload a recording to enhance and download.');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const originalFileBufferRef = useRef<AudioBuffer | null>(null);
  const enhancedFileBufferRef = useRef<AudioBuffer | null>(null);
  const filePlaybackCtxRef = useRef<AudioContext | null>(null);
  const filePlaybackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const dryAnalyserRef = useRef<AnalyserNode | null>(null);
  const wetAnalyserRef = useRef<AnalyserNode | null>(null);
  const dryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (filterRef.current) {
      filterRef.current.gain.value = boostOn ? boostGain : 0;
    }
  }, [boostGain, boostOn]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);

      const dryAnalyser = ctx.createAnalyser();
      dryAnalyser.fftSize = 1024;
      dryAnalyserRef.current = dryAnalyser;
      source.connect(dryAnalyser);

      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = 2700; // sits in the 1.5-4kHz consonant band
      filter.Q.value = 0.9;
      filter.gain.value = boostOn ? boostGain : 0;
      filterRef.current = filter;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 18;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const wetAnalyser = ctx.createAnalyser();
      wetAnalyser.fftSize = 1024;
      wetAnalyserRef.current = wetAnalyser;

      source.connect(filter);
      filter.connect(compressor);
      compressor.connect(wetAnalyser);
      compressor.connect(ctx.destination);

      setEnabled(true);
      setStatus('Live — wear headphones to avoid feedback screech.');
      draw();
    } catch (err) {
      setStatus('Could not access microphone. Check browser permissions.');
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close().catch(() => {});
    }
    ctxRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setEnabled(false);
    setStatus('Microphone off.');
  }

  function drawOn(canvas: HTMLCanvasElement | null, analyser: AnalyserNode | null) {
    if (!canvas || !analyser) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const w = canvas.width;
    const h = canvas.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.beginPath();
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = '#1e2a44';
    const step = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i] / 255) * h;
      i === 0 ? ctx2d.moveTo(0, y) : ctx2d.lineTo(i * step, y);
    }
    ctx2d.stroke();
  }

  function draw() {
    drawOn(dryCanvasRef.current, dryAnalyserRef.current);
    drawOn(wetCanvasRef.current, wetAnalyserRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }

  // --- optional backup captions (Web Speech API, off by default) ---
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionsSupported, setCaptionsSupported] = useState(true);
  const [captionText, setCaptionText] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => () => stop(), []); // cleanup on unmount

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setCaptionsSupported(Boolean(SpeechRecognition));
  }, []);

  function toggleCaptions() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (captionsOn) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setCaptionsOn(false);
      setCaptionText('');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setCaptionText(text);
    };
    recognition.onerror = () => setCaptionsOn(false);
    recognition.onend = () => {
      // auto-restart while toggled on, since the API stops after pauses
      if (recognitionRef.current) recognition.start();
    };
    recognition.start();
    recognitionRef.current = recognition;
    setCaptionsOn(true);
  }

  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState('');

  async function transcribeEnhanced() {
    const buffer = enhancedFileBufferRef.current;
    if (!buffer) return;
    setTranscribing(true);
    setTranscribeStatus('Sending to Whisper (may take longer on a cold model)…');
    setTranscript(null);
    try {
      const resampled = await resampleTo16kMono(buffer);
      const wavBlob = audioBufferToWav(resampled);
      const form = new FormData();
      form.append('audio', wavBlob, 'clip.wav');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        setTranscribeStatus(data.error || `Failed (${res.status})`);
      } else {
        setTranscript(data.text || '(empty transcript)');
        setTranscribeStatus('');
      }
    } catch {
      setTranscribeStatus('Request failed — check your connection.');
    } finally {
      setTranscribing(false);
    }
  }

  function getFilePlaybackCtx() {
    if (!filePlaybackCtxRef.current) filePlaybackCtxRef.current = new AudioContext();
    return filePlaybackCtxRef.current;
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDownloadUrl(null);
    enhancedFileBufferRef.current = null;
    setFileStatus('Decoding…');
    try {
      const ctx = getFilePlaybackCtx();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      originalFileBufferRef.current = decoded;
      setFileStatus(`Loaded "${file.name}" — ${decoded.duration.toFixed(1)}s. Ready to enhance.`);
    } catch {
      setFileStatus('Could not decode that file — try a wav or mp3.');
    }
  }

  async function enhanceFile() {
    const input = originalFileBufferRef.current;
    if (!input) return;
    setFileBusy(true);
    setFileStatus('Enhancing — applying the same EQ boost + compression as the live version…');

    const offlineCtx = new OfflineAudioContext(input.numberOfChannels, input.length, input.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = input;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = 2700;
    filter.Q.value = 0.9;
    filter.gain.value = boostOn ? boostGain : 0;

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 18;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    source.connect(filter);
    filter.connect(compressor);
    compressor.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    enhancedFileBufferRef.current = rendered;

    const wavBlob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(wavBlob);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });

    setFileBusy(false);
    setFileStatus('Done — play it back or download the isolated, enhanced file below.');
  }

  function playFileBuffer(buffer: AudioBuffer | null) {
    if (!buffer) return;
    const ctx = getFilePlaybackCtx();
    filePlaybackSourceRef.current?.stop();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    filePlaybackSourceRef.current = src;
  }

  return (
    <div className="panel">
      <span className="pill">Layer 1</span>
      <h2>Make it clearer, not louder</h2>
      <p className="lede">
        Boosts the 1.5–4kHz range where s, f, th and k live — the sounds age-related
        hearing loss drops first — and evens out loud/quiet speech.
      </p>

      <div className="note-box">
        Use headphones for this live demo. Mic input played back through the same
        device's speakers will feedback-screech — that's a hardware limitation of
        any live mic+speaker demo, not a bug in the app.
      </div>

      {!enabled ? (
        <button className="primary-btn" onClick={start}>
          Enable microphone
        </button>
      ) : (
        <button className="ghost-btn" onClick={stop}>
          Stop
        </button>
      )}
      <div className="status-line">{status}</div>

      <div className="big-toggle">
        <button
          className="switch"
          data-on={boostOn}
          role="switch"
          aria-checked={boostOn}
          aria-label="Clarity boost"
          onClick={() => setBoostOn((v) => !v)}
        >
          <span className="knob" />
        </button>
        <div>
          <strong>Clarity boost</strong>
          <div className="status-line">Toggle off to A/B compare against raw mic input.</div>
        </div>
      </div>

      <div className="field-row">
        <label htmlFor="gain">Consonant boost ({boostGain} dB)</label>
        <input
          id="gain"
          type="range"
          min={0}
          max={15}
          step={1}
          value={boostGain}
          onChange={(e) => setBoostGain(Number(e.target.value))}
        />
      </div>

      <div className="big-toggle">
        <button
          className="switch"
          data-on={captionsOn}
          role="switch"
          aria-checked={captionsOn}
          aria-label="Backup captions"
          onClick={toggleCaptions}
          disabled={!captionsSupported}
        >
          <span className="knob" />
        </button>
        <div>
          <strong>Backup captions (optional)</strong>
          <div className="status-line">
            {captionsSupported
              ? 'Off by default — sound + flash + vibration cover most people. Turn on only if you want a text fallback too.'
              : 'Not supported in this browser (needs Chrome or Edge).'}
          </div>
        </div>
      </div>
      {captionsOn && (
        <div className="note-box" aria-live="polite">
          {captionText || 'Listening…'}
        </div>
      )}

      <div className="waveform-pair">
        <div className="waveform-card">
          <h4>Raw mic input</h4>
          <canvas ref={dryCanvasRef} width={400} height={90} />
        </div>
        <div className="waveform-card">
          <h4>Cleaned + boosted</h4>
          <canvas ref={wetCanvasRef} width={400} height={90} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '32px 0' }} />

      <h3>Enhance a recording (upload, don't just listen live)</h3>
      <p className="lede">
        Upload a voice note or call recording, apply the same clarity chain offline,
        and download the isolated, enhanced result to keep or share.
      </p>

      <div className="field-row">
        <label htmlFor="clarity-file">Audio file</label>
        <input id="clarity-file" type="file" accept="audio/*" onChange={onFileSelected} />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button className="ghost-btn" disabled={!fileName} onClick={() => playFileBuffer(originalFileBufferRef.current)}>
          Play original
        </button>
        <button className="primary-btn" disabled={!fileName || fileBusy} onClick={enhanceFile}>
          {fileBusy ? 'Enhancing…' : 'Enhance'}
        </button>
        <button
          className="ghost-btn"
          disabled={!enhancedFileBufferRef.current}
          onClick={() => playFileBuffer(enhancedFileBufferRef.current)}
        >
          Play enhanced
        </button>
      </div>

      <div className="status-line">{fileStatus}</div>

      {downloadUrl && (
        <a href={downloadUrl} download={`enhanced-${fileName ?? 'audio'}.wav`} className="ghost-btn" style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none' }}>
          Download enhanced audio (.wav)
        </a>
      )}

      {enhancedFileBufferRef.current && (
        <div style={{ marginTop: 20 }}>
          <button className="ghost-btn" disabled={transcribing} onClick={transcribeEnhanced}>
            {transcribing ? 'Transcribing…' : 'Get text transcript (Whisper)'}
          </button>
          {transcribeStatus && <div className="status-line">{transcribeStatus}</div>}
          {transcript && (
            <div className="note-box" style={{ marginTop: 12 }}>
              {transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
