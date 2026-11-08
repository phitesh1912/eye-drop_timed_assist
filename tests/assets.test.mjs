// The alarm sound must actually make a sound (the first version was all zeros).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);

function readWav(path) {
  const buf = readFileSync(new URL(path, root));
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
  let off = 12;
  let fmt = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { format: buf.readUInt16LE(off + 8), channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') {
      const samples = [];
      for (let i = off + 8; i + 1 < off + 8 + size; i += 2) samples.push(buf.readInt16LE(i) / 32768);
      return { fmt, samples, bytes: buf };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`no audio data in ${path}`);
}

const stats = (samples) => ({
  peak: Math.max(...samples.map(Math.abs)),
  rms: Math.sqrt(samples.reduce((a, v) => a + v * v, 0) / samples.length),
});

test('the loudest alarm is loud enough to hear', () => {
  const { fmt, samples } = readWav('docs/assets/alarm-5.wav');
  assert.deepEqual(fmt, { format: 1, channels: 1, rate: 22050, bits: 16 });
  const seconds = samples.length / fmt.rate;
  assert.ok(seconds > 2 && seconds < 4, `length ${seconds}s`);
  const { peak, rms } = stats(samples);
  assert.ok(peak > 0.8, `peak ${peak}`);
  assert.ok(rms > 0.15, `rms ${rms}`);
});

test('every loudness step is audible, and each is about half as loud as the next', () => {
  let louder = null;
  for (let level = 5; level >= 1; level--) {
    const { peak, rms } = stats(readWav(`docs/assets/alarm-${level}.wav`).samples);
    assert.ok(rms > 0.01, `level ${level} is silent (rms ${rms})`);
    if (louder) {
      const ratio = rms / louder.rms;
      assert.ok(ratio > 0.45 && ratio < 0.55, `level ${level} is ${ratio.toFixed(2)} of level ${level + 1}`);
      assert.ok(peak < louder.peak);
    }
    louder = { peak, rms };
  }
});

test('the Android app rings with the same sounds', () => {
  for (let level = 1; level <= 5; level++) {
    const web = readWav(`docs/assets/alarm-${level}.wav`).bytes;
    const android = readWav(`android/app/src/main/res/raw/alarm_${level}.wav`).bytes;
    assert.ok(web.equals(android), `level ${level} differs`);
  }
});
