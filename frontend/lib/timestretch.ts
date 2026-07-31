// Overlap-add (OLA) time-stretching: changes playback duration without
// changing pitch. Not full WSOLA (no cross-correlation grain alignment),
// so very sustained tones can show mild warble — but for speech at
// 0.6x-0.9x it holds up well and is cheap enough to run in real time
// in the browser with zero dependencies.

function hannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return w;
}

/**
 * @param buffer input AudioBuffer
 * @param speed  playback speed relative to original (0.5 = half speed / slower, 1 = unchanged)
 * @param audioCtx an AudioContext or OfflineAudioContext used to allocate the output buffer
 */
export function timeStretch(
  buffer: AudioBuffer,
  speed: number,
  audioCtx: BaseAudioContext
): AudioBuffer {
  const grainSize = 4096;
  const hopOut = Math.floor(grainSize / 4);
  const hopIn = Math.max(1, Math.round(hopOut * speed));
  const window = hannWindow(grainSize);

  const numChannels = buffer.numberOfChannels;
  const inputLength = buffer.length;
  const numGrains = Math.max(1, Math.ceil((inputLength - grainSize) / hopIn) + 1);
  const outputLength = numGrains * hopOut + grainSize;

  const outputBuffer = audioCtx.createBuffer(numChannels, outputLength, buffer.sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = new Float32Array(outputLength);
    const norm = new Float32Array(outputLength);

    for (let g = 0; g < numGrains; g++) {
      const inStart = g * hopIn;
      const outStart = g * hopOut;
      for (let i = 0; i < grainSize; i++) {
        const inputIdx = inStart + i;
        if (inputIdx >= inputLength) break;
        const sample = input[inputIdx] * window[i];
        output[outStart + i] += sample;
        norm[outStart + i] += window[i];
      }
    }

    for (let i = 0; i < outputLength; i++) {
      output[i] = norm[i] > 1e-6 ? output[i] / norm[i] : output[i];
    }

    outputBuffer.copyToChannel(output, ch);
  }

  return outputBuffer;
}
