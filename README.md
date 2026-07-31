<div align="center">

# Sound for All

### Speech clearer — not louder.

Built for elderly hearing-aid users — not Deaf/sign-language users, who existing accessibility tools already serve well.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-sound--for--all.kotatsu.workers.dev-0640BC?style=for-the-badge)](https://sound-for-all.kotatsu.workers.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com)
[![TensorFlow.js](https://img.shields.io/badge/ML-TensorFlow.js-FF6F00?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![WebRTC](https://img.shields.io/badge/Live%20Call-WebRTC-333333?style=flat-square&logo=webrtc)](https://webrtc.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#license)

**[Try it live →](https://sound-for-all.kotatsu.workers.dev)**

</div>

---

## The problem

The internet assumes everyone hears well — calls, videos, alerts, notifications. Most accessibility tools solve for Deaf/sign-language users or fast readers. They miss the largest underserved group entirely: **elderly people with hearing aids** — not deaf, don't sign, don't want to read scrolling captions.

Age-related hearing loss strips high frequencies first — consonants (`s`, `f`, `th`, `k`) vanish before vowels do. Speech turns to mumble, not silence. Turning up the volume just amplifies the mumble.

Specifically, the affected range sits roughly at:

$$
1.5 \text{ kHz} \leq f \leq 4 \text{ kHz}
$$

which is exactly where consonant energy concentrates. Restoring that band — not raising overall amplitude — is what actually restores intelligibility:

$$
\text{Intelligibility} \neq f(\text{Volume}) \quad\Longrightarrow\quad \text{Intelligibility} = f(\text{Spectral Balance})
$$

## What it does

**Sound for All** makes speech clearer — not louder — and backs every alert up with sight and touch, so nothing depends on reading fast captions or knowing sign language.

| # | Feature | What it does |
|---|---|---|
| 01 | **Clarity Boost** | Live mic audio → noise suppression → peaking EQ boost on the consonant band → dynamics compression, all in real time in the browser. File mode: upload, enhance offline, download as WAV. |
| 02 | **3-way Alerts** | Doorbell, alarm, phone ringing — every alert fires sound + screen flash + vibration together. |
| 03 | **Slow Speech** | Pitch-preserving time-stretch (hand-written overlap-add) for uploaded audio — no chipmunk distortion. |
| 04 | **What's that sound?** | [YAMNet](https://tfhub.dev/google/yamnet/1) (521 AudioSet classes) runs entirely on-device via TensorFlow.js, routing detections into the alert system. |
| 05 | **Live Call** | Two devices connect peer-to-peer over WebRTC. Clarity Boost runs live on incoming audio, during the actual conversation. Permanent per-device codes, saved contacts. |

## Architecture

```
Browser (Cloudflare Worker, via Next.js + OpenNext)
  ├─ Clarity, Alerts, Slow Speech, Live Call → pure client-side Web Audio API + WebRTC
  ├─ Classifier → YAMNet running client-side via TensorFlow.js
  └─ /api/transcribe → Hugging Face (hf-inference) for Whisper, file-upload flow only
```

One Cloudflare-hosted app. No separate backend for the core features — the project started with **Cloudflare + Workers + Render + FastAPI** (a server-side heuristic classifier) and was simplified once [YAMNet](https://tfhub.dev/google/yamnet/1) proved a real pretrained model could do the job client-side, for free, more accurately.

## Tech stack

**Frontend / Runtime**
[Next.js 15](https://nextjs.org) · [React 18](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Cloudflare Workers](https://workers.cloudflare.com) via [OpenNext](https://opennext.js.org/cloudflare)

**Audio / ML**
[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) (`BiquadFilterNode`, `DynamicsCompressorNode`) · [TensorFlow.js](https://www.tensorflow.org/js) · [YAMNet](https://tfhub.dev/google/yamnet/1) · [OpenAI Whisper](https://github.com/openai/whisper) via [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers) · [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

**Real-time / Calling**
[WebRTC](https://webrtc.org) · [PeerJS](https://peerjs.com) · [ExpressTURN](https://www.expressturn.com) (NAT traversal)

## Getting started

```bash
git clone https://github.com/karthik26-Thalari/sound-for-all.git
cd sound-for-all/frontend
npm install
```

Create `frontend/.env.local`:

```
HF_API_TOKEN=your_huggingface_token_here
NEXT_PUBLIC_TURN_USERNAME=your_expressturn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_expressturn_password
```

- `HF_API_TOKEN` — generate at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write) with **Inference Providers** permission
- TURN credentials — free at [expressturn.com](https://www.expressturn.com) (1000GB/month, no credit card required)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

```bash
npx wrangler login
npx wrangler secret put HF_API_TOKEN
npm run deploy
```

Uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), the current officially recommended Cloudflare adapter.

## What's real vs. what's a stub

| Piece | Status |
|---|---|
| EQ boost + compression | Real, live |
| Noise suppression | Browser-native (true [RNNoise](https://github.com/xiph/rnnoise) via WASM is the natural next upgrade) |
| Time-stretch | Real, hand-written overlap-add algorithm |
| Sound classifier | Real pretrained model ([YAMNet](https://tfhub.dev/google/yamnet/1)), not a heuristic |
| Transcription | Real [Whisper](https://github.com/openai/whisper), ~\$0.0002/min |
| Live Call encryption | Real — WebRTC's built-in [DTLS-SRTP](https://webrtc-security.github.io/), not something built by hand |

## Known limitations

- No virtual audio into real calls (WhatsApp/Zoom/Phone) — blocked at the OS level, not solvable from a browser tab
- No direct hearing-aid Bluetooth streaming — requires [MFi](https://mfi.apple.com)/[ASHA](https://source.android.com/docs/core/connect/bluetooth/asha) manufacturer certification
- No live carrier-call interception — Android has restricted third-party `VOICE_CALL` audio access since Android 9; this is exactly why Live Call uses WebRTC instead

## Roadmap

- A hearing profile that learns each person's specific hearing curve over time, instead of one generic boost
- A native companion that's reachable the way a real phone is — always on, not a tab to remember to open
- Care that includes the people around them — family and caregivers gently kept in the loop
- The same clarity idea reaching TVs, doorbells, and shared spaces, not just one device

## Team

<table>
<tr>
<td align="center">
<a href="https://github.com/karthik26-Thalari">
<img src="https://github.com/karthik26-Thalari.png" width="80" style="border-radius:50%"><br>
<b>karthik26-Thalari</b>
</a>
</td>
<td align="center">
<a href="https://github.com/Tanmayee1802">
<img src="https://github.com/Tanmayee1802.png" width="80" style="border-radius:50%"><br>
<b>Tanmayee1802</b>
</a>
</td>
</tr>
</table>

## License

[MIT](LICENSE)

---

<div align="center">

*Sound for All makes speech clearer — not louder — and backs it up with sight and touch, so nobody needs to read fast or know sign language to use it.*

</div>
