/* ============================================================
   Opera Sidebar Translator — DeepL API client
   ============================================================ */

export class DeepLError extends Error {
  constructor(status, detail) {
    super(detail || `DeepL request failed (${status})`);
    this.name   = 'DeepLError';
    this.status = status;
    this.detail = detail;
  }
}

// Free keys carry a ":fx" suffix and are served from a separate host
export const isFreeKey = (key) => key.endsWith(':fx');

const baseUrl = (key) =>
  isFreeKey(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

async function request(key, path, { body, signal } = {}) {
  const res = await fetch(baseUrl(key) + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Authorization': `DeepL-Auth-Key ${key}`,
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const detail = await res.json().then(d => d.message, () => '');
    throw new DeepLError(res.status, detail);
  }
  return res.json();
}

export async function translate(key, payload, signal) {
  const data = await request(key, '/v2/translate', { body: payload, signal });
  return data.translations[0];
}

// → { character_count, character_limit }
export function fetchUsage(key) {
  return request(key, '/v2/usage');
}

export async function fetchLanguages(key) {
  const list = await request(key, '/v3/languages?product=translate_text');
  return list.map(l => ({
    code:     l.lang.toUpperCase(),
    name:     l.name,
    source:   l.usable_as_source,
    target:   l.usable_as_target,
    features: l.features || [],
  }));
}

// ──────────────────────────────────────────────
// Language codes
// ──────────────────────────────────────────────

// Source languages that must be sent as a specific variant when used as target
const TARGET_VARIANTS = { EN: 'EN-US', PT: 'PT-BR', ZH: 'ZH-HANS' };

export const baseOf = (code) => code.split('-')[0];

export const hasVariants = (code) => code in TARGET_VARIANTS;

export const toSourceCode = (code) => baseOf(code);

// preferred: { EN: 'EN-GB', … } — the variants the user last picked
export const toTargetCode = (code, preferred = {}) =>
  preferred[code] || TARGET_VARIANTS[code] || code;

// ──────────────────────────────────────────────
// Built-in language list, used until /v3/languages has been fetched
// ──────────────────────────────────────────────
const FORMALITY    = ['DE', 'ES', 'ES-419', 'FR', 'IT', 'JA', 'NL', 'PL', 'PT-BR', 'PT-PT', 'RU'];
const INSTRUCTIONS = ['DE', 'EN', 'ES', 'FR', 'IT', 'JA', 'KO', 'ZH'];

const lang = (code, role = 'both') => ({
  code,
  source: role !== 'target',
  target: role !== 'source',
  features: [
    ...(FORMALITY.includes(code) ? ['formality'] : []),
    ...(INSTRUCTIONS.includes(baseOf(code)) ? ['custom_instructions'] : []),
  ],
});

export const FALLBACK_LANGUAGES = [
  lang('AR'), lang('BG'), lang('CS'), lang('DA'), lang('DE'), lang('EL'),
  lang('EN', 'source'), lang('EN-GB', 'target'), lang('EN-US', 'target'),
  lang('ES'), lang('ES-419', 'target'), lang('ET'), lang('FI'), lang('FR'),
  lang('HE'), lang('HU'), lang('ID'), lang('IT'), lang('JA'), lang('KO'),
  lang('LT'), lang('LV'), lang('NB'), lang('NL'), lang('PL'),
  lang('PT', 'source'), lang('PT-BR', 'target'), lang('PT-PT', 'target'),
  lang('RO'), lang('RU'), lang('SK'), lang('SL'), lang('SV'), lang('TH'),
  lang('TR'), lang('UK'), lang('VI'),
  lang('ZH', 'source'), lang('ZH-HANS', 'target'), lang('ZH-HANT', 'target'),
];

// ──────────────────────────────────────────────
// Script-based language guess (for two-way translation)
// ──────────────────────────────────────────────
const LANG_SCRIPT = {
  ZH: 'Han', JA: 'Kana', KO: 'Hangul',
  RU: 'Cyrillic', UK: 'Cyrillic', BG: 'Cyrillic',
  EL: 'Greek', AR: 'Arabic', HE: 'Hebrew', TH: 'Thai',
};

const SCRIPT_PATTERNS = {
  Han:      /\p{Script=Han}/gu,
  Kana:     /[\p{Script=Hiragana}\p{Script=Katakana}]/gu,
  Hangul:   /\p{Script=Hangul}/gu,
  Cyrillic: /\p{Script=Cyrillic}/gu,
  Greek:    /\p{Script=Greek}/gu,
  Arabic:   /\p{Script=Arabic}/gu,
  Hebrew:   /\p{Script=Hebrew}/gu,
  Thai:     /\p{Script=Thai}/gu,
  Latin:    /\p{Script=Latin}/gu,
};

const scriptOf = (code) => LANG_SCRIPT[baseOf(code)] || 'Latin';

function dominantScript(text) {
  const counts = {};
  for (const [script, pattern] of Object.entries(SCRIPT_PATTERNS)) {
    counts[script] = (text.match(pattern) || []).length;
  }
  // Japanese mixes kana with Han characters
  if (counts.Kana > 0) {
    counts.Kana += counts.Han;
    counts.Han = 0;
  }
  const [script, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? script : null;
}

// Which of two languages the text is written in, judged by script alone.
// Returns langA, langB, or null when the scripts cannot tell them apart.
export function guessLanguage(text, langA, langB) {
  const scriptA = scriptOf(langA);
  const scriptB = scriptOf(langB);
  if (scriptA === scriptB) return null;

  const script = dominantScript(text);
  if (script === scriptA) return langA;
  if (script === scriptB) return langB;
  return null;
}
