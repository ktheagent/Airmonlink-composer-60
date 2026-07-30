'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const audio = require('../src/core/practice-audio-service');

function satb() {
  return model.createScore({ template: 'satb', measures: 4, autoFillRests: false });
}

test('Build 36 creates persistent mixer channels for every authoritative part', () => {
  const document = satb();
  const mixer = audio.normalizeMixer(document, {
    master: { volume: .75, outputDeviceId: 'device-1' },
    channels: [{ partId: document.parts[0].id, volume: .95, pan: -.25, reverbSend: .3 }]
  });
  assert.equal(mixer.channels.length, 4);
  assert.equal(mixer.master.volume, .75);
  assert.equal(mixer.master.outputDeviceId, 'device-1');
  assert.equal(mixer.channels[0].volume, .95);
  assert.equal(document.mixer.channels[0].pan, -.25);
});

test('Build 36 solo and mute semantics determine event gain', () => {
  const document = satb();
  audio.normalizeMixer(document, {
    channels: [
      { partId: document.parts[0].id, solo: true, volume: 1 },
      { partId: document.parts[1].id, volume: 1 }
    ]
  });
  assert.ok(audio.eventGain(document, document.parts[0].id, 100) > 0);
  assert.equal(audio.eventGain(document, document.parts[1].id, 100), 0);
});

test('Build 36 practice preset supports voice emphasis, tempo, loop, count-in and metronome', () => {
  const document = satb();
  const preset = audio.practicePreset(document, {
    role: 'soprano',
    tempoScale: .75,
    loopStart: 4,
    loopEnd: 12,
    countInMeasures: 2,
    metronome: true
  });
  assert.equal(preset.tempo, Math.round(document.settings.tempo * .75));
  assert.deepEqual(preset.loop, { enabled: true, start: 4, end: 12 });
  assert.equal(preset.countInMeasures, 2);
  assert.equal(preset.metronome, true);
  const soprano = preset.channels.find(channel => channel.partId === document.parts[0].id);
  const alto = preset.channels.find(channel => channel.partId === document.parts[1].id);
  assert.equal(soprano.volume, 1);
  assert.ok(alto.volume < soprano.volume);
});

test('Build 36 accompaniment-only preset removes the selected practice voice', () => {
  const document = satb();
  const preset = audio.practicePreset(document, { role: 'bass', accompanimentOnly: true });
  const bass = preset.channels.find(channel => channel.partId === document.parts[3].id);
  const soprano = preset.channels.find(channel => channel.partId === document.parts[0].id);
  assert.equal(bass.muted, true);
  assert.equal(soprano.muted, false);
});

test('Build 36 MIDI configuration clamps latency, velocity, channel and note filters', () => {
  const config = audio.normalizeMidiConfiguration({
    mode: 'real-time', quantize: .25, latencyMs: 900, channel: 20,
    minimumVelocity: 20, maximumVelocity: 110, noteLow: 36, noteHigh: 96, midiThru: true
  });
  assert.equal(config.mode, 'real-time');
  assert.equal(config.latencyMs, 500);
  assert.equal(config.channel, 15);
  assert.equal(config.noteLow, 36);
  assert.equal(config.noteHigh, 96);
  assert.equal(config.midiThru, true);
});

test('Build 36 real-time MIDI quantisation prevents duplicate notes', () => {
  const events = audio.quantizeRecordedEvents([
    { midi: 60, start: .12, duration: .49, velocity: 80, channel: 0 },
    { midi: 60, start: .12, duration: .5, velocity: 80, channel: 0 },
    { midi: 64, start: .12, duration: .49, velocity: 90, channel: 0 }
  ], { quantize: .25 });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(event => event.start), [0, 0]);
  assert.deepEqual(events.map(event => event.midi), [60, 64]);
  assert.ok(events.every(event => event.duration === .5));
});

test('Build 36 audio export plan creates deterministic full mix and stem filenames', () => {
  const document = satb();
  const mix = audio.audioExportPlan(document, {
    version: '1.1.16', build: 36, kind: 'full-mix', format: 'wav'
  });
  assert.equal(mix[0].filename, 'Airmonlink-Composer-1.1.16-Build36-Full-Mix.wav');
  const stems = audio.audioExportPlan(document, {
    version: '1.1.16', build: 36, kind: 'stem', format: 'wav'
  });
  assert.equal(stems.length, 4);
  assert.equal(new Set(stems.map(item => item.filename)).size, 4);
});

test('Build 36 renders a real deterministic PCM WAV from score events', () => {
  const document = model.createScore({ template: 'lead', measures: 2, autoFillRests: false });
  const part = document.parts[0];
  model.addNote(document, part.id, { midi: 69, start: 0, duration: 1, velocity: 100 });
  const first = audio.renderWav(document, { sampleRate: 8000, channels: 1, normalize: true });
  const second = audio.renderWav(document, { sampleRate: 8000, channels: 1, normalize: true });
  assert.equal(Buffer.from(first.bytes.subarray(0, 4)).toString('ascii'), 'RIFF');
  assert.equal(Buffer.from(first.bytes.subarray(8, 12)).toString('ascii'), 'WAVE');
  assert.equal(first.noteCount, 1);
  assert.ok(first.bytes.length > 44);
  assert.deepEqual(first.bytes, second.bytes);
});

test('Build 36 muted cue events are excluded from rendered audio', () => {
  const document = model.createScore({ template: 'lead', measures: 2, autoFillRests: false });
  const part = document.parts[0];
  const cue = model.addNote(document, part.id, { midi: 72, start: 0, duration: 1, generatedBy: 'cue' });
  model.updateEvent(document, part.id, cue.id, { mutedInPlayback: true, cue: true });
  const rendered = audio.renderWav(document, { sampleRate: 8000 });
  assert.equal(rendered.noteCount, 0);
});
