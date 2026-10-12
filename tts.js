/* ============================================================
   Opera Sidebar Translator — Read aloud
   Web Speech API by default; Gemini TTS when a Gemini key is set.
   ============================================================ */

const GEMINI_URL   = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-3.8-flash-lite-tts';
const SAMPLE_RATE  = 24000;   // streamed audio is 16-bit mono PCM at 24 kHz
const STALL_LIMIT  = 20000;   // give up when no audio arrives for this long

export const VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede',
  'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba',
  'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
  'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
];

// DeepL codes whose speech locale is not simply the lowercased code
const SPEECH_LOCALES = {
  'ZH': 'zh-CN', 'ZH-HANS': 'zh-CN', 'ZH-HANT': 'zh-TW',
  'EN': 'en-US', 'PT': 'pt-PT', 'ES-419': 'es-MX',
};

let stopCurrent = null;   // stops whatever is loading or playing
let lastClip    = null;   // { id, buffers } — most recent Gemini audio

export function stop() {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Reads text aloud. Resolves when playback finishes or is stopped.
 * onState('loading' | 'playing') reports progress;
 * onFallback(error) is called when Gemini fails before any audio was heard
 * and the system voice takes over.
 */
export async function speak({ text, lang, geminiKey, voice, onState, onFallback }) {
  stop();

  if (geminiKey) {
    try {
      return await speakGemini(text, geminiKey, voice, onState);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.interrupted) throw err;
      onFallback?.(err);
    }
  }
  return speakSystem(text, lang, onState);
}

// ──────────────────────────────────────────────
// Gemini TTS (streamed, so long texts start playing right away)
// ──────────────────────────────────────────────
async function speakGemini(text, key, voice, onState) {
  const id = `${voice}\n${text}`;
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const controller = new AbortController();

  let onStopped;
  const stopped = new Promise(resolve => { onStopped = resolve; });
  stopCurrent = () => { controller.abort(); onStopped(); };

  // Queue each buffer directly after the previous one
  let playhead = 0;
  const enqueue = (buffer) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    playhead = Math.max(playhead, ctx.currentTime + 0.05);
    source.start(playhead);
    playhead += buffer.duration;
  };

  let heard = false;
  try {
    if (lastClip?.id === id) {
      onState?.('playing');
      lastClip.buffers.forEach(enqueue);
    } else {
      onState?.('loading');
      const buffers = [];
      for await (const buffer of streamGemini(text, key, voice, controller)) {
        if (!heard) onState?.('playing');
        heard = true;
        buffers.push(buffer);
        enqueue(buffer);
      }
      if (!buffers.length) throw new Error('No audio returned');
      lastClip = { id, buffers };
    }

    const remaining = Math.max(0, playhead - ctx.currentTime) * 1000;
    await Promise.race([new Promise(resolve => setTimeout(resolve, remaining)), stopped]);
  } catch (err) {
    // Once audio has been heard, starting over with another voice would be worse than stopping
    err.interrupted = heard;
    throw err;
  } finally {
    ctx.close();
  }
}

// Yields AudioBuffers as Gemini synthesizes them
async function* streamGemini(text, key, voice, controller) {
  let stallTimer;
  const watchStall = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(
      () => controller.abort(new DOMException('No audio received in time', 'TimeoutError')),
      STALL_LIMIT,
    );
  };

  try {
    watchStall();
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice }] },
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let pending  = '';                  // incomplete trailing SSE line
    let oddByte  = new Uint8Array(0);   // half of a sample split across chunks

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        let event;
        try { event = JSON.parse(line.slice(5)); } catch { continue; }
        if (event.error) throw new Error(event.error.message || 'Stream error');
        if (event.event_type !== 'step.delta' || event.delta?.type !== 'audio' || !event.delta.data) continue;

        watchStall();
        const chunk = Uint8Array.from(atob(event.delta.data), c => c.charCodeAt(0));
        const bytes = new Uint8Array(oddByte.length + chunk.length);
        bytes.set(oddByte);
        bytes.set(chunk, oddByte.length);
        oddByte = bytes.slice(bytes.length & ~1);

        const sampleCount = bytes.length >> 1;
        if (!sampleCount) continue;

        const view    = new DataView(bytes.buffer);
        const buffer  = new AudioBuffer({ length: sampleCount, sampleRate: SAMPLE_RATE });
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          samples[i] = view.getInt16(i * 2, true) / 32768;
        }
        yield buffer;
      }
    }
  } finally {
    clearTimeout(stallTimer);
  }
}

// ──────────────────────────────────────────────
// Web Speech API
// ──────────────────────────────────────────────
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);

  // Chromium fills the voice list asynchronously
  return new Promise(resolve => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1000);
  });
}

async function speakSystem(text, lang, onState) {
  const utterance = new SpeechSynthesisUtterance(text);

  if (lang) {
    const locale = (SPEECH_LOCALES[lang] || lang).toLowerCase();
    const base   = locale.split('-')[0];
    const voices = await loadVoices();
    const match  = (test) => voices.find(v => test(v.lang.toLowerCase().replace('_', '-')));
    const voice  = match(l => l === locale) || match(l => l.split('-')[0] === base);

    if (!voice) {
      const err = new Error('No voice installed for this language');
      err.name = 'NoVoiceError';
      throw err;
    }
    utterance.voice = voice;
    utterance.lang  = voice.lang;
  }

  return new Promise((resolve, reject) => {
    stopCurrent = () => { speechSynthesis.cancel(); resolve(); };
    utterance.onend   = resolve;
    utterance.onerror = (e) =>
      (e.error === 'canceled' || e.error === 'interrupted') ? resolve() : reject(new Error(e.error));
    onState?.('playing');
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}
