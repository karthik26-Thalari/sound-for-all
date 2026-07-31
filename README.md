# Sound for All

Speech clearer, not louder — for elderly hearing-aid users, backed up with sight and
touch so nothing depends on reading fast captions or knowing sign language.

Four working layers, all live in the browser:

1. **Clarity Boost** — mic → noise suppression → 1.5–4kHz consonant boost → compressor
2. **3-way Alerts** — every alert fires sound + screen flash + vibration together
3. **Slow Speech** — pitch-preserving time-stretch (overlap-add) for uploaded audio
4. **What's that sound?** — classifies doorbell/alarm/speech/noise **on-device** using
   YAMNet (Google's pretrained audio event model), plus an optional Whisper
   transcript button on enhanced files

## Architecture (simplified — no backend server)

```
Browser
  ├─ Layers 1-3: pure client-side Web Audio API
  ├─ Layer 4 classifier: YAMNet running client-side via TensorFlow.js
  │    (model + 521-class AudioSet map fetched once, cached, then fully offline)
  └─ /api/transcribe (Cloudflare Function) → Hugging Face (DeepInfra provider)
       for Whisper transcription on the enhanced-file flow only.
       HF_API_TOKEN lives as a Cloudflare secret, never in client code.
```

There used to be a FastAPI classifier on Render — removed once YAMNet (real
pretrained model, runs in-browser, zero cost, more accurate) replaced it
entirely. One less service to deploy and keep alive for the demo.

## Deploy (Cloudflare only now)

Uses `@opennextjs/cloudflare`, the current officially recommended adapter.

```bash
cd frontend
npm install
npx wrangler login          # first time only

npm run preview             # local production-accurate preview (workerd, not `next dev`)
npm run deploy               # deploy
```

Set the one secret it needs:

```bash
npx wrangler secret put HF_API_TOKEN
# paste a Hugging Face token with "Inference Providers" permission —
# generate one at https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write
# used only by /api/transcribe (Whisper, via DeepInfra) for the "Get text
# transcript" button on the enhanced-file flow. Confirmed rate: $0.0002/min
# of audio — trivially cheap for a hackathon's worth of testing and demo.
```

Note: `npm install` may emit an ERESOLVE peer-dependency warning between
`wrangler` and `@opennextjs/cloudflare`'s transitive deps — known nested-peer
mismatch, not a bug here. Use `npm install --legacy-peer-deps` if it blocks you.

## Local development

```bash
cd frontend
npm install
echo "HF_API_TOKEN=your_token_here" > .env.local
npm run dev
```

Open `http://localhost:3000`. Everything except the Whisper transcript button
works with zero network calls and zero setup beyond `npm install`.

## What's real DSP/ML vs. what's a stub

- **Clarity boost**: real — `BiquadFilterNode` (peaking EQ) + `DynamicsCompressorNode`,
  live on the mic stream. Native browser `noiseSuppression` constraint stands in for
  RNNoise; swapping in true RNNoise (WASM) is the natural next upgrade.
- **Slow speech**: real — overlap-add time-stretch (`lib/timestretch.ts`), no
  dependencies. Not full WSOLA (no cross-correlation grain alignment), so very
  sustained tones can show mild warble, but holds up well on speech at 0.6–0.9x.
- **Sound classifier**: real — YAMNet, Google's pretrained model (521 AudioSet
  classes), running via TensorFlow.js entirely in-browser (`lib/yamnet.ts`).
  Not a stub, not a heuristic — an actual trained model. The raw top-5
  predictions are shown alongside the simplified doorbell/alarm/speech/noise
  bucket so you can see exactly what it heard.
- **Transcription**: real — `openai/whisper-large-v3-turbo` via Hugging Face's
  Inference Providers (DeepInfra), called from `/api/transcribe`. File-upload
  flow only, not wired into anything live (a few seconds of latency per call).

## Known gaps (be upfront about these if judges ask)

- No virtual audio output into WhatsApp/Zoom/Phone — not possible from a browser tab
  without an OS-level virtual audio driver install. Roadmap item, not a bug.
- No direct hearing-aid Bluetooth streaming (MFi/ASHA) — requires Apple/Google
  certification, out of scope for a web app entirely.
- Live mic playback through the same device's speakers will feedback-screech —
  inherent to any live mic+speaker demo. Use headphones, or demo with a
  pre-recorded muffled-speech sample as the primary path.
