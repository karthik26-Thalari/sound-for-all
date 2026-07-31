// Proxies to Hugging Face's Inference Providers router for Whisper
// transcription. This is for the FILE upload flow (not live captions) —
// Whisper is more accurate on degraded/muffled audio than the browser's
// built-in recognizer, but can have a few seconds of latency, which makes
// it a bad fit for anything live/real-time.
//
// Set the token as a Cloudflare secret, never in client code:
//   npx wrangler secret put HF_API_TOKEN
// Token needs "Inference Providers" permission — generate one at
// https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write
//
// Provider note: DeepInfra's integration with the HF router currently only
// supports chat/text-generation tasks, not speech — using it here returns
// "Model not supported by provider deepinfra". hf-inference is the provider
// HF's own docs confirm as reliable for automatic-speech-recognition.

const HF_MODEL = 'openai/whisper-large-v3';
const HF_PROVIDER = 'hf-inference';

export async function POST(req: Request) {
  const HF_API_TOKEN = process.env.HF_API_TOKEN;

  if (!HF_API_TOKEN) {
    return Response.json(
      { error: 'HF_API_TOKEN not configured. Set it as a Cloudflare secret.' },
      { status: 503 }
    );
  }

  try {
    const incomingForm = await req.formData();
    const audio = incomingForm.get('audio');
    if (!audio || !(audio instanceof Blob)) {
      return Response.json({ error: 'No audio field in request' }, { status: 400 });
    }

    const audioBytes = await audio.arrayBuffer();

    const upstream = await fetch(
      `https://router.huggingface.co/${HF_PROVIDER}/models/${HF_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': audio.type || 'audio/wav',
        },
        body: audioBytes,
      }
    );

    if (upstream.status === 503) {
      return Response.json(
        { error: 'Model is warming up on Hugging Face — try again shortly.' },
        { status: 503 }
      );
    }

    if (!upstream.ok) {
      const detail = await upstream.text();
      return Response.json(
        { error: `Transcription service returned ${upstream.status}: ${detail}` },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return Response.json({ text: data.text ?? '' });
  } catch (err) {
    return Response.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
