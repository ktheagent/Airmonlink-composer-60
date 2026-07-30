(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    playback: root.AirmonPlayback || (typeof require === 'function' ? require('./playback') : null),
    theory: root.AirmonMusicTheory || (typeof require === 'function' ? require('./music-theory') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonPracticeAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.playback || !deps.theory) throw new Error('Practice and audio dependencies are unavailable.');

  const AUDIO_FORMATS = Object.freeze(['wav']);
  const EXPORT_KINDS = Object.freeze(['full-mix', 'instrument', 'part', 'stem', 'accompaniment-only', 'click']);
  const QUANTIZE_GRIDS = Object.freeze([4, 2, 1, .5, .25, .125, .0625]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const slug = value => String(value || 'Track').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Track';

  function defaultChannel(part = {}, index = 0) {
    return Object.freeze({
      id: String(part.id || `channel-${index + 1}`),
      partId: part.id || null,
      name: String(part.name || `Channel ${index + 1}`),
      muted: Boolean(part.muted),
      solo: Boolean(part.solo),
      volume: clamp(part.volume ?? .8, 0, 1),
      pan: clamp(part.pan ?? 0, -1, 1),
      reverbSend: clamp(part.reverbSend ?? .15, 0, 1),
      sound: String(part.sound || part.instrumentKey || 'piano'),
      midiChannel: Math.round(clamp(part.midiChannel ?? index % 16, 0, 15)),
      midiProgram: Math.round(clamp(part.midiProgram ?? 0, 0, 127)),
      expressionMap: Object.freeze({ ...(part.expressionMap || {}) })
    });
  }

  function normalizeMixer(score, patch = null) {
    score.mixer ||= {
      master: { volume: .9, muted: false, reverb: .15, outputDeviceId: null },
      channels: score.parts.map(defaultChannel)
    };
    const byPart = new Map((score.mixer.channels || []).map(channel => [channel.partId, channel]));
    score.mixer.channels = score.parts.map((part, index) => ({
      ...defaultChannel(part, index),
      ...(byPart.get(part.id) || {})
    }));
    score.mixer.master = {
      volume: clamp(score.mixer.master?.volume ?? .9, 0, 1),
      muted: Boolean(score.mixer.master?.muted),
      reverb: clamp(score.mixer.master?.reverb ?? .15, 0, 1),
      outputDeviceId: score.mixer.master?.outputDeviceId || null
    };
    if (patch) {
      if (patch.master) score.mixer.master = {
        ...score.mixer.master,
        ...patch.master,
        volume: clamp(patch.master.volume ?? score.mixer.master.volume, 0, 1),
        reverb: clamp(patch.master.reverb ?? score.mixer.master.reverb, 0, 1),
        muted: patch.master.muted == null ? score.mixer.master.muted : Boolean(patch.master.muted),
        outputDeviceId: patch.master.outputDeviceId ?? score.mixer.master.outputDeviceId
      };
      for (const channelPatch of patch.channels || []) {
        const channel = score.mixer.channels.find(item => item.partId === channelPatch.partId || item.id === channelPatch.id);
        if (!channel) continue;
        Object.assign(channel, channelPatch, {
          volume: clamp(channelPatch.volume ?? channel.volume, 0, 1),
          pan: clamp(channelPatch.pan ?? channel.pan, -1, 1),
          reverbSend: clamp(channelPatch.reverbSend ?? channel.reverbSend, 0, 1),
          muted: channelPatch.muted == null ? channel.muted : Boolean(channelPatch.muted),
          solo: channelPatch.solo == null ? channel.solo : Boolean(channelPatch.solo),
          midiChannel: Math.round(clamp(channelPatch.midiChannel ?? channel.midiChannel, 0, 15)),
          midiProgram: Math.round(clamp(channelPatch.midiProgram ?? channel.midiProgram, 0, 127))
        });
      }
      deps.model.touch(score);
    }
    return Object.freeze(JSON.parse(JSON.stringify(score.mixer)));
  }

  function activeChannelIds(mixer) {
    const soloed = mixer.channels.filter(channel => channel.solo && !channel.muted);
    return new Set((soloed.length ? soloed : mixer.channels.filter(channel => !channel.muted)).map(channel => channel.id));
  }

  function eventGain(score, partId, velocity = 88) {
    const mixer = normalizeMixer(score);
    if (mixer.master.muted) return 0;
    const channel = mixer.channels.find(item => item.partId === partId);
    if (!channel || !activeChannelIds(mixer).has(channel.id)) return 0;
    return clamp(mixer.master.volume * channel.volume * clamp(velocity, 1, 127) / 127, 0, 1);
  }

  function practicePreset(score, options = {}) {
    const role = String(options.role || 'all').toLowerCase();
    const targetPartIds = new Set((options.partIds || score.parts
      .filter(part => role === 'all' || String(part.name || '').toLowerCase().includes(role))
      .map(part => part.id)));
    const emphasis = clamp(options.emphasis ?? .25, 0, 1);
    const accompaniment = clamp(options.accompaniment ?? .65, 0, 1);
    const channels = score.parts.map(part => ({
      partId: part.id,
      muted: options.accompanimentOnly ? targetPartIds.has(part.id) : false,
      solo: false,
      volume: options.accompanimentOnly
        ? (targetPartIds.has(part.id) ? 0 : accompaniment)
        : (targetPartIds.has(part.id) ? 1 : emphasis)
    }));
    const tempoScale = clamp(options.tempoScale ?? 1, .25, 2);
    const loopStart = Math.max(0, Number(options.loopStart) || 0);
    const loopEnd = Math.max(loopStart, Number(options.loopEnd) || deps.model.totalBeats(score));
    return Object.freeze({
      id: String(options.id || `practice-${role}`),
      name: String(options.name || `${role === 'all' ? 'Full score' : role} practice`),
      role,
      targetPartIds: Object.freeze([...targetPartIds]),
      tempoScale,
      tempo: Math.round(clamp((score.settings.tempo || 120) * tempoScale, 20, 400)),
      transpose: Math.round(clamp(options.transpose || 0, -24, 24)),
      loop: Object.freeze({ enabled: options.loop !== false, start: loopStart, end: loopEnd }),
      countInMeasures: Math.round(clamp(options.countInMeasures ?? 1, 0, 4)),
      metronome: options.metronome !== false,
      channels: Object.freeze(channels.map(item => Object.freeze(item)))
    });
  }

  function normalizeMidiConfiguration(value = {}) {
    return Object.freeze({
      inputDeviceId: value.inputDeviceId || null,
      outputDeviceId: value.outputDeviceId || null,
      mode: ['step-time', 'real-time'].includes(value.mode) ? value.mode : 'step-time',
      quantize: QUANTIZE_GRIDS.includes(Number(value.quantize)) ? Number(value.quantize) : .25,
      latencyMs: clamp(value.latencyMs || 0, -500, 500),
      sustain: value.sustain !== false,
      midiThru: Boolean(value.midiThru),
      channel: value.channel == null ? null : Math.round(clamp(value.channel, 0, 15)),
      minimumVelocity: Math.round(clamp(value.minimumVelocity || 1, 1, 127)),
      maximumVelocity: Math.round(clamp(value.maximumVelocity || 127, 1, 127)),
      noteLow: Math.round(clamp(value.noteLow || 0, 0, 127)),
      noteHigh: Math.round(clamp(value.noteHigh ?? 127, 0, 127))
    });
  }

  function quantizeRecordedEvents(events = [], configuration = {}) {
    const config = normalizeMidiConfiguration(configuration);
    const grid = config.quantize;
    const seen = new Set();
    return Object.freeze((events || []).map(event => {
      const start = Math.max(0, Math.round((Number(event.start) + config.latencyMs / 1000) / grid) * grid);
      const duration = Math.max(grid, Math.round((Number(event.duration) || grid) / grid) * grid);
      const midi = Math.round(clamp(event.midi, config.noteLow, config.noteHigh));
      const velocity = Math.round(clamp(event.velocity || 88, config.minimumVelocity, config.maximumVelocity));
      return { ...event, start, duration, midi, velocity };
    }).filter(event => {
      const key = `${event.channel ?? 0}|${event.midi}|${event.start.toFixed(6)}|${event.duration.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.start - b.start || a.midi - b.midi).map(event => Object.freeze(event)));
  }

  function audioExportPlan(score, options = {}) {
    const version = String(options.version || '1.0.0');
    const build = Math.max(1, Math.round(Number(options.build) || 1));
    const format = AUDIO_FORMATS.includes(String(options.format).toLowerCase()) ? String(options.format).toLowerCase() : 'wav';
    const kind = EXPORT_KINDS.includes(options.kind) ? options.kind : 'full-mix';
    const targets = kind === 'full-mix' || kind === 'click'
      ? [{ id: kind, name: kind === 'click' ? 'Click-Track' : 'Full-Mix', partIds: score.parts.map(part => part.id) }]
      : (options.partIds || score.parts.map(part => part.id)).map(partId => {
          const part = score.parts.find(item => item.id === partId);
          return { id: partId, name: part?.name || 'Part', partIds: [partId] };
        });
    return Object.freeze(targets.map((target, index) => Object.freeze({
      order: index,
      kind,
      targetId: target.id,
      partIds: Object.freeze(target.partIds),
      filename: `Airmonlink-Composer-${version}-Build${build}-${slug(target.name)}.${format}`,
      format,
      sampleRate: Math.round(clamp(options.sampleRate || 44100, 8000, 96000)),
      normalize: options.normalize !== false,
      countInMeasures: Math.round(clamp(options.countInMeasures || 0, 0, 4)),
      metronome: Boolean(options.metronome || kind === 'click')
    })));
  }

  function writeAscii(bytes, offset, text) {
    for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
  }

  function writeU16(bytes, offset, value) {
    bytes[offset] = value & 255; bytes[offset + 1] = (value >>> 8) & 255;
  }

  function writeU32(bytes, offset, value) {
    bytes[offset] = value & 255; bytes[offset + 1] = (value >>> 8) & 255;
    bytes[offset + 2] = (value >>> 16) & 255; bytes[offset + 3] = (value >>> 24) & 255;
  }

  function renderWav(score, options = {}) {
    const sampleRate = Math.round(clamp(options.sampleRate || 22050, 8000, 48000));
    const channels = Math.round(clamp(options.channels || 1, 1, 2));
    const tempo = clamp(options.tempo || score.settings.tempo || 120, 20, 400);
    const secondsPerBeat = 60 / tempo;
    const selectedParts = options.partIds ? new Set(options.partIds) : null;
    const transpose = Math.round(clamp(options.transpose || 0, -24, 24));
    const notes = deps.playback.buildPlaybackNotes(score)
      .filter(({ part, event }) => (!selectedParts || selectedParts.has(part.id)) && !event.mutedInPlayback)
      .map(({ part, event }) => ({
        partId: part.id,
        start: event.start * secondsPerBeat,
        end: (event.start + event.duration) * secondsPerBeat,
        midi: event.midi + transpose,
        velocity: event.velocity || 88,
        pan: normalizeMixer(score).channels.find(channel => channel.partId === part.id)?.pan || 0
      }));
    const durationSeconds = Math.max(.25, ...notes.map(note => note.end + .05));
    const frameCount = Math.ceil(durationSeconds * sampleRate);
    const samples = new Float32Array(frameCount * channels);
    for (const note of notes) {
      const startFrame = Math.max(0, Math.floor(note.start * sampleRate));
      const endFrame = Math.min(frameCount, Math.ceil(note.end * sampleRate));
      const frequency = deps.theory.frequencyForMidi(note.midi);
      const gain = eventGain(score, note.partId, note.velocity) * .22;
      const left = channels === 1 ? 1 : Math.sqrt((1 - note.pan) / 2);
      const right = channels === 1 ? 1 : Math.sqrt((1 + note.pan) / 2);
      for (let frame = startFrame; frame < endFrame; frame += 1) {
        const local = (frame - startFrame) / sampleRate;
        const noteLength = Math.max(.001, note.end - note.start);
        const attack = Math.min(1, local / .01);
        const release = Math.min(1, (noteLength - local) / .03);
        const envelope = Math.max(0, Math.min(attack, release));
        const value = Math.sin(2 * Math.PI * frequency * local) * gain * envelope;
        samples[frame * channels] += value * left;
        if (channels === 2) samples[frame * channels + 1] += value * right;
      }
    }
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    const scale = options.normalize === false || peak <= 0 ? 1 : Math.min(1, .95 / peak);
    const dataSize = samples.length * 2;
    const bytes = new Uint8Array(44 + dataSize);
    writeAscii(bytes, 0, 'RIFF'); writeU32(bytes, 4, 36 + dataSize); writeAscii(bytes, 8, 'WAVE');
    writeAscii(bytes, 12, 'fmt '); writeU32(bytes, 16, 16); writeU16(bytes, 20, 1);
    writeU16(bytes, 22, channels); writeU32(bytes, 24, sampleRate);
    writeU32(bytes, 28, sampleRate * channels * 2); writeU16(bytes, 32, channels * 2); writeU16(bytes, 34, 16);
    writeAscii(bytes, 36, 'data'); writeU32(bytes, 40, dataSize);
    const view = new DataView(bytes.buffer);
    samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.round(clamp(sample * scale, -1, 1) * 32767), true));
    return Object.freeze({
      bytes,
      sampleRate,
      channels,
      durationSeconds,
      noteCount: notes.length,
      peak,
      format: 'wav'
    });
  }

  return Object.freeze({
    AUDIO_FORMATS,
    EXPORT_KINDS,
    QUANTIZE_GRIDS,
    defaultChannel,
    normalizeMixer,
    activeChannelIds,
    eventGain,
    practicePreset,
    normalizeMidiConfiguration,
    quantizeRecordedEvents,
    audioExportPlan,
    renderWav
  });
});
