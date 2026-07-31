<div align="center">

# Sound for All

### Speech clearer. Not louder.

Built for elderly hearing-aid users, not Deaf or sign-language users, who existing accessibility tools already serve well.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-sound--for--all.kotatsu.workers.dev-0640BC?style=for-the-badge)](https://sound-for-all.kotatsu.workers.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?style=flat-square&logo=cloudflare)](https://workers.cloudflare.com)
[![TensorFlow.js](https://img.shields.io/badge/ML-TensorFlow.js-FF6F00?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)
[![WebRTC](https://img.shields.io/badge/Live%20Call-WebRTC-333333?style=flat-square&logo=webrtc)](https://webrtc.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**[Try it live](https://sound-for-all.kotatsu.workers.dev)**

</div>

---

## The problem

The internet assumes everyone hears well. Calls, videos, alerts, notifications. Most accessibility tools solve for Deaf users or sign language users or people who can read fast scrolling captions. They miss a much larger group entirely: elderly people who wear hearing aids. Not deaf. Not signing. Just hearing loss that gets in the way of following speech.

Age related hearing loss removes high frequencies first. Consonants like `s`, `f`, `th`, and `k` vanish before vowels do. Speech does not go silent. It turns to mumble. And turning up the volume does not fix that. It just makes the mumble louder, because it amplifies everything equally instead of restoring what is actually missing.

The affected range sits roughly here:

$$
1.5 \text{ kHz} \leq f \leq 4 \text{ kHz}
$$

That is exactly where consonant energy lives. So the fix is not raising amplitude. It is restoring balance:

$$
\text{Intelligibility} \neq f(\text{Volume})
$$
$$
\text{Intelligibility} = f(\text{Spectral Balance})
$$

## What it does

Sound for All makes speech clearer, not louder, and backs every alert up with sight and touch so nothing depends on reading fast or knowing sign language.

### 01. Clarity Boost
Live microphone audio gets cleaned and boosted in real time, directly in the browser. Background noise gets suppressed first. A peaking EQ filter then lifts the 1.5 to 4 kHz band, the exact range hearing loss removes. A compressor evens out loud and quiet speech so nothing gets buried. There is also a file mode: upload a recording, enhance it offline, and download the result as a WAV file.

### 02. 3 way Alerts
A doorbell, an alarm, a phone ringing. Every alert fires sound, a screen flash, and vibration together. If one channel is weak, the other two still land.

### 03. Slow Speech
Pitch preserving time stretch for uploaded audio, built with a hand written overlap add algorithm and no external dependency. Slows speech down without the chipmunk distortion that naive playback rate changes cause. Useful because older adults often need more time to process speech, not just louder speech.

### 04. What's that sound?
A real pretrained model, [YAMNet](https://tfhub.dev/google/yamnet/1), runs entirely on device through TensorFlow.js. It classifies doorbell, alarm, speech, or background noise from 521 AudioSet classes and routes the result into the same alert system. Not a caption feed.

### 05. Live Call
Two devices connect directly over WebRTC. Every device gets a permanent code the first time it opens the app, saved locally like a contact. Clarity Boost runs live on the incoming audio during the actual conversation, not just on recordings.

## Architecture

```
Browser (Cloudflare Worker, via Next.js and OpenNext)
  - Clarity, Alerts, Slow Speech, Live Call: pure client side Web Audio API and WebRTC
  - Classifier: YAMNet running client side via TensorFlow.js
  - /api/transcribe: proxies to Hugging Face for Whisper, file upload flow only
```

One Cloudflare hosted app. No separate backend for the core features. The project started with Cloudflare, Cloudflare Workers, and a Render hosted FastAPI backend running a hand tuned heuristic classifier. Once YAMNet proved a real pretrained model could do that job client side, for free, and more accurately, the backend was removed entirely.

## Tech stack

**Frontend and runtime**: [Next.js 15](https://nextjs.org), [React 18](https://react.dev), [TypeScript](https://www.typescriptlang.org), deployed to [Cloudflare Workers](https://workers.cloudflare.com) via [OpenNext](https://opennext.js.org/cloudflare)

**Audio and ML**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API), [TensorFlow.js](https://www.tensorflow.org/js), [YAMNet](https://tfhub.dev/google/yamnet/1), [OpenAI Whisper](https://github.com/openai/whisper) via [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers), [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

**Real time and calling**: [WebRTC](https://webrtc.org), [PeerJS](https://peerjs.com), [ExpressTURN](https://www.expressturn.com) for NAT traversal

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

Get `HF_API_TOKEN` from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write) with Inference Providers permission enabled. Get TURN credentials for free from [expressturn.com](https://www.expressturn.com), which offers 1000GB per month with no credit card required.

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Deployment

```bash
npx wrangler login
npx wrangler secret put HF_API_TOKEN
npm run deploy
```

Uses [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), the officially recommended Cloudflare adapter for Next.js.

## What is real versus what is a stub

| Piece | Status |
|---|---|
| EQ boost and compression | Real, running live |
| Noise suppression | Browser native (true [RNNoise](https://github.com/xiph/rnnoise) via WASM is the natural next upgrade) |
| Time stretch | Real, hand written overlap add algorithm |
| Sound classifier | Real pretrained model ([YAMNet](https://tfhub.dev/google/yamnet/1)), not a heuristic |
| Transcription | Real [Whisper](https://github.com/openai/whisper), about $0.0002 per minute |
| Live Call encryption | Real, WebRTC's built in [DTLS-SRTP](https://webrtc-security.github.io/), not something added by hand |

## Known limitations

- No virtual audio into real calls like WhatsApp, Zoom, or Phone. This is blocked at the operating system level and cannot be solved from a browser tab.
- No direct hearing aid Bluetooth streaming. That requires [MFi](https://mfi.apple.com) or [ASHA](https://source.android.com/docs/core/connect/bluetooth/asha) manufacturer certification.
- No live carrier call interception. Android has restricted third party access to `VOICE_CALL` audio since Android 9, even for the default dialer. This is exactly why Live Call uses WebRTC instead of trying to tap into real phone calls.

## Roadmap

- A hearing profile that learns each person's specific hearing curve over time, instead of one generic boost for everyone.
- A native companion that is reachable the way a real phone is, always on, rather than a browser tab someone has to remember to open.
- Care that includes the people around the user. Family or caregivers gently kept in the loop when something is missed.
- The same clarity idea reaching TVs, doorbells, and shared spaces, not just one device.

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

Sound for All makes speech clearer, not louder, and backs it up with sight and touch, so nobody needs to read fast or know sign language to use it.

</div>
