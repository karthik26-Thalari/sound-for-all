import * as tf from '@tensorflow/tfjs';
import Papa from 'papaparse';

// YAMNet: Google's pretrained audio event classifier, 521 AudioSet classes,
// runs entirely client-side via TF.js — no backend, no network cost per
// inference after the model is cached. See:
// https://tfhub.dev/google/yamnet/1
const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';
const YAMNET_SAMPLE_RATE = 16000;

let modelPromise: Promise<tf.GraphModel> | null = null;
let classMapPromise: Promise<string[]> | null = null;

function loadModel(): Promise<tf.GraphModel> {
  if (!modelPromise) {
    modelPromise = tf.loadGraphModel(MODEL_URL, { fromTFHub: true });
  }
  return modelPromise;
}

function loadClassMap(): Promise<string[]> {
  if (!classMapPromise) {
    classMapPromise = fetch('/yamnet_class_map.csv')
      .then((res) => res.text())
      .then(
        (csv) =>
          new Promise<string[]>((resolve) => {
            Papa.parse<{ index: string; display_name: string }>(csv, {
              header: true,
              complete: (result) => {
                const names = result.data
                  .filter((row) => row.display_name !== undefined)
                  .map((row) => row.display_name);
                resolve(names);
              },
            });
          })
      );
  }
  return classMapPromise;
}

/** Resample an AudioBuffer to mono 16kHz Float32Array, as YAMNet expects. */
async function toYamnetWaveform(buffer: AudioBuffer): Promise<Float32Array> {
  const durationSeconds = buffer.duration;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(durationSeconds * YAMNET_SAMPLE_RATE),
    YAMNET_SAMPLE_RATE
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

// Maps the raw 521-class AudioSet label to the 4 categories this app cares
// about. Keyword-based on purpose — AudioSet's ontology nests many labels
// under each of these (e.g. "Alarm" also covers "Smoke detector", "Siren",
// "Buzzer"), so this stays a broad match rather than an exact one.
function bucketLabel(rawLabel: string): 'doorbell' | 'alarm' | 'speech' | 'noise' {
  const l = rawLabel.toLowerCase();
  if (l.includes('doorbell') || l.includes('ding-dong')) return 'doorbell';
  if (
    l.includes('alarm') ||
    l.includes('siren') ||
    l.includes('smoke detector') ||
    l.includes('fire alarm') ||
    l.includes('buzzer')
  )
    return 'alarm';
  if (l.includes('speech') || l.includes('conversation') || l.includes('narration')) return 'speech';
  return 'noise';
}

export type YamnetResult = {
  bucket: 'doorbell' | 'alarm' | 'speech' | 'noise';
  confidence: number;
  rawLabel: string;
  top5: { label: string; score: number }[];
};

export async function classifyWithYamnet(buffer: AudioBuffer): Promise<YamnetResult> {
  const [model, classNames] = await Promise.all([loadModel(), loadClassMap()]);
  const waveform = await toYamnetWaveform(buffer);

  const result = tf.tidy(() => {
    const waveformTensor = tf.tensor1d(waveform);
    const output = model.execute(waveformTensor) as tf.Tensor | tf.Tensor[];
    // YAMNet returns [scores, embeddings, spectrogram]; scores is [numFrames, 521]
    const scoresTensor = Array.isArray(output) ? output[0] : output;
    const meanScores = scoresTensor.mean(0) as tf.Tensor1D; // average across frames
    return meanScores.arraySync() as number[];
  });

  const indexed = result.map((score, i) => ({ score, label: classNames[i] ?? `class_${i}` }));
  indexed.sort((a, b) => b.score - a.score);
  const top = indexed[0];

  return {
    bucket: bucketLabel(top.label),
    confidence: top.score,
    rawLabel: top.label,
    top5: indexed.slice(0, 5).map((x) => ({ label: x.label, score: x.score })),
  };
}
