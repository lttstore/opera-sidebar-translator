/* ============================================================
   Opera Sidebar Translator — Logic
   DeepL translation with auto-detect, two-way direction,
   language swap, read aloud, and persistent settings.
   ============================================================ */

import { t, setLang, getLocale, hasString, applyI18n } from './i18n.js';
import * as deepl from './deepl.js';
import * as tts from './tts.js';

// ──────────────────────────────────────────────
// Application State
// ──────────────────────────────────────────────
const state = {
  apiKey:             '',
  geminiKey:          '',
  ttsVoice:           'Kore',
  appTheme:           'claude', // 'auto' | 'minimal' | 'night' | 'claude'
  lightTheme:         'claude', // light theme used by 'auto'
  uiLang:             'auto',   // 'auto' | 'zh' | 'en'
  translateSpeed:     'medium', // 'fast' | 'medium' | 'slow'
  formality:          'default',// 'default' | 'prefer_more' | 'prefer_less'
  modelType:          'default',// 'default' | 'prefer_quality_optimized' | 'latency_optimized'
  customInstructions: '',       // one instruction per line
  pairLang:           '',       // two-way translation partner of targetLang, '' = off
  sourceLang:         'AUTO',
  targetLang:         'EN-US',
  langVariants:       {},       // last chosen target variant per base language, e.g. { EN: 'EN-GB' }
};

const PERSISTED_KEYS = Object.keys(state);

// Runtime-only state
let languages       = deepl.FALLBACK_LANGUAGES;
let detectedLang    = null;   // detected source language of the current result
let effectiveTarget = null;   // target language the current result was translated into
let usage           = null;   // { character_count, character_limit } | 'invalid' | null

const LANGUAGE_CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_INSTRUCTIONS = 10;
const MAX_INSTRUCTION_LENGTH = 300;

// ──────────────────────────────────────────────
// Debounce & Request tracking for "Type-as-you-Translate"
// ──────────────────────────────────────────────
let debounceTimer = null;
let abortController = null;
let requestSeq = 0;           // only the latest request may update the UI

const SPEED_MAP = {
  fast: 400,
  medium: 500,
  slow: 700
};

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  mainView:        $('mainView'),
  settingsToggle:  $('settingsToggle'),
  backBtn:         $('backBtn'),
  settingsPanel:   $('settingsPanel'),
  usagePill:       $('usagePill'),
  usageText:       $('usageText'),
  usageFill:       $('usageFill'),
  usagePct:        $('usagePct'),
  apiKey:          $('apiKey'),
  keyStatus:       $('keyStatus'),
  geminiKey:       $('geminiKey'),
  ttsVoice:        $('ttsVoice'),
  pairLang:        $('pairLang'),
  instructions:    $('customInstructions'),
  instructionsHint:$('instructionsHint'),
  sourceLang:      $('sourceLang'),
  targetLang:      $('targetLang'),
  swapBtn:         $('swapBtn'),
  sourceText:      $('sourceText'),
  contextInput:    $('contextInput'),
  contextBtn:      $('contextBtn'),
  charCount:       $('charCount'),
  clearBtn:        $('clearBtn'),
  speakSourceBtn:  $('speakSourceBtn'),
  speakResultBtn:  $('speakResultBtn'),
  translateBtn:    $('translateBtn'),
  formalitySelect: $('formalitySelect'),
  resultSection:   $('resultSection'),
  detectedLang:    $('detectedLang'),
  resultText:      $('resultText'),
  copyBtn:         $('copyBtn'),
  toast:           $('toast'),
};

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────

// Localize before the first paint using the mirrored preference
setLang(readMirror('uiLang'));
applyI18n();
init();

async function init() {
  await loadSettings();
  setLang(state.uiLang);
  applyI18n();
  applyTheme();
  tts.VOICES.forEach(name => els.ttsVoice.add(new Option(name, name)));
  renderLanguageSelects();
  applyStateToUI();
  bindAllEvents();
  updateSwapAvailability();
  updateSpeakAvailability();
  els.sourceText.focus();

  refreshLanguages();
  refreshUsage();
}

// ──────────────────────────────────────────────
// Settings Persistence (chrome.storage.local)
// ──────────────────────────────────────────────
async function loadSettings() {
  try {
    // Keep stored keys out of reach of content scripts
    chrome.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });

    const data = await chrome.storage.local.get([...PERSISTED_KEYS, 'languageCache']);
    for (const key of PERSISTED_KEYS) {
      if (data[key] !== undefined) state[key] = data[key];
    }

    // Migrate old themes safely to new equivalents
    if (state.appTheme === 'pastel') state.appTheme = 'claude';
    else if (state.appTheme === 'brutalist') state.appTheme = 'night';
    if (data.lightTheme === undefined && state.appTheme === 'minimal') state.lightTheme = 'minimal';

    // Bare EN / PT / ZH are no longer valid target languages
    state.targetLang = deepl.toTargetCode(state.targetLang, state.langVariants);

    if (data.languageCache?.list?.length) languages = data.languageCache.list;

    chrome.storage.local.remove(['apiTier', 'alternativesCount']);
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

async function saveSettings(patch) {
  Object.assign(state, patch);
  try {
    await chrome.storage.local.set(patch);
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

// localStorage mirrors the preferences needed before chrome.storage resolves
function readMirror(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeMirror(key, value) {
  try { localStorage.setItem(key, value); } catch { /* unavailable */ }
}

function applyTheme() {
  writeMirror('appTheme', state.appTheme);
  writeMirror('lightTheme', state.lightTheme);
  window.applyTheme();
}

function checkRadio(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function applyStateToUI() {
  els.apiKey.value       = state.apiKey;
  els.geminiKey.value    = state.geminiKey;
  els.ttsVoice.value     = state.ttsVoice;
  els.instructions.value = state.customInstructions;

  checkRadio('appTheme', state.appTheme);
  checkRadio('uiLang', state.uiLang);
  checkRadio('translateSpeed', state.translateSpeed);
  checkRadio('modelType', state.modelType);

  els.formalitySelect.value = state.formality;

  updateFormalityAvailability();
  renderInstructionsHint();
  renderKeyStatus();
}

// ──────────────────────────────────────────────
// Languages
// ──────────────────────────────────────────────
let displayNames = null;

function getLanguageName(code) {
  try {
    const name = displayNames.of(code);
    if (name && name.toUpperCase() !== code) return name;
  } catch { /* code unknown to Intl */ }
  return languages.find(l => l.code === code)?.name || code;
}

function fillSelect(select, items, value, fallback) {
  select.replaceChildren(...items.map(item => new Option(item.label, item.code)));
  select.value = value;
  if (select.value !== value) select.value = fallback;
  return select.value;
}

function renderLanguageSelects() {
  displayNames = new Intl.DisplayNames([getLocale()], { type: 'language' });

  const toItems = (list) => list
    .map(l => ({ code: l.code, label: getLanguageName(l.code) }))
    .sort((a, b) => a.label.localeCompare(b.label, getLocale()));

  const sources = toItems(languages.filter(l => l.source));
  // Languages with regional or script variants are offered as those variants only
  const targets = toItems(languages.filter(l => l.target && !deepl.hasVariants(l.code)));

  state.sourceLang = fillSelect(els.sourceLang,
    [{ code: 'AUTO', label: t('lang.auto') }, ...sources], state.sourceLang, 'AUTO');
  state.targetLang = fillSelect(els.targetLang, targets, state.targetLang, 'EN-US');
  state.pairLang = fillSelect(els.pairLang,
    [{ code: '', label: t('pair.off') }, ...targets], state.pairLang, '');
}

function hasFeature(code, feature) {
  return languages.find(l => l.code === code)?.features.includes(feature) ?? false;
}

function updateFormalityAvailability() {
  els.formalitySelect.disabled = !hasFeature(state.targetLang, 'formality');
}

// Refreshes the language list from DeepL at most once a day
async function refreshLanguages(force = false) {
  if (!state.apiKey) return;
  try {
    if (!force) {
      const { languageCache } = await chrome.storage.local.get('languageCache');
      if (languageCache && Date.now() - languageCache.ts < LANGUAGE_CACHE_TTL) return;
    }
    const list = await deepl.fetchLanguages(state.apiKey);
    if (!list.length) return;

    languages = list;
    chrome.storage.local.set({ languageCache: { ts: Date.now(), list } });
    renderLanguageSelects();
    updateFormalityAvailability();
  } catch (e) {
    console.warn('Could not refresh languages:', e);
  }
}

// ──────────────────────────────────────────────
// API Key status & usage
// ──────────────────────────────────────────────
// keep: leave the last figures on screen while refreshing the same key
async function refreshUsage(keep = false) {
  if (!keep) {
    usage = null;
    renderKeyStatus();
  }
  if (!state.apiKey) return;

  const key = state.apiKey;
  try {
    const data = await deepl.fetchUsage(key);
    if (key === state.apiKey) usage = data;
  } catch (err) {
    if (key === state.apiKey && err.status === 403) usage = 'invalid';
  }
  renderKeyStatus();
}

// Refreshes the quota shortly after translating, coalescing bursts of requests
let usageTimer = null;
function scheduleUsageRefresh() {
  if (!deepl.isFreeKey(state.apiKey)) return;
  clearTimeout(usageTimer);
  usageTimer = setTimeout(() => refreshUsage(true), 3000);
}

function usageRatio() {
  if (!usage || usage === 'invalid' || !(usage.character_limit > 0)) return null;
  return Math.min(usage.character_count / usage.character_limit, 1);
}

function formatPercent(ratio) {
  // Avoid showing 0% once anything has been used
  if (ratio > 0 && ratio < 0.001) return `<${(0.001).toLocaleString(getLocale(), { style: 'percent', minimumFractionDigits: 1 })}`;
  return ratio.toLocaleString(getLocale(), { style: 'percent', maximumFractionDigits: 1 });
}

function usageLevel(ratio) {
  if (ratio >= 0.95) return 'crit';
  if (ratio >= 0.8)  return 'high';
  if (ratio >= 0.5)  return 'mid';
  return 'low';
}

function renderUsagePill() {
  const ratio = usageRatio();
  const show = ratio !== null && deepl.isFreeKey(state.apiKey);
  els.usagePill.hidden = !show;
  if (!show) return;

  const { character_count: used, character_limit: limit } = usage;
  const left = Math.max(limit - used, 0);
  const compact = new Intl.NumberFormat(getLocale(), { notation: 'compact', maximumFractionDigits: 1 });
  const full = (n) => n.toLocaleString(getLocale());

  els.usagePill.dataset.level = usageLevel(ratio);
  els.usageText.textContent = t('usage.short', { used: compact.format(used), left: compact.format(left) });
  els.usagePct.textContent = formatPercent(ratio);
  els.usageFill.style.width = `${ratio * 100}%`;
  els.usagePill.title = t('usage.full', { used: full(used), left: full(left), limit: full(limit) });
}

function renderKeyStatus() {
  renderUsagePill();
  els.keyStatus.classList.toggle('warn', usage === 'invalid');

  if (!state.apiKey) {
    els.keyStatus.textContent = '';
  } else if (usage === 'invalid') {
    els.keyStatus.textContent = t('key.invalid');
  } else {
    const tier = t(deepl.isFreeKey(state.apiKey) ? 'key.free' : 'key.pro');
    els.keyStatus.textContent = usage
      ? t('key.usage', {
          tier,
          used:  usage.character_count.toLocaleString(getLocale()),
          limit: usage.character_limit.toLocaleString(getLocale()),
          pct:   formatPercent(usageRatio() ?? 0),
        })
      : tier;
  }
}

// ──────────────────────────────────────────────
// Custom instructions
// ──────────────────────────────────────────────
function parseInstructions() {
  const lines = state.customInstructions.split('\n').map(l => l.trim()).filter(Boolean);
  const valid = lines.filter(l => l.length <= MAX_INSTRUCTION_LENGTH).slice(0, MAX_INSTRUCTIONS);
  return { valid, dropped: lines.length - valid.length };
}

function renderInstructionsHint() {
  const { dropped } = parseInstructions();
  els.instructionsHint.classList.toggle('warn', dropped > 0);
  els.instructionsHint.textContent = dropped > 0
    ? t('instr.dropped', { n: dropped })
    : t('instr.hint');
}

// ──────────────────────────────────────────────
// DeepL API Translation
// ──────────────────────────────────────────────
function buildPayload(text, target) {
  const payload = {
    text:        [text],
    target_lang: target,
  };

  // Omit source_lang to trigger DeepL auto-detection
  if (state.sourceLang !== 'AUTO') {
    payload.source_lang = state.sourceLang;
  }

  // Formality parameter support (prefer_more / prefer_less)
  if (state.formality !== 'default') {
    payload.formality = state.formality;
  }

  if (state.modelType !== 'default') {
    payload.model_type = state.modelType;
  }

  const context = els.contextInput.value.trim();
  if (context) {
    payload.context = context;
  }

  const instructions = parseInstructions().valid;
  if (instructions.length && hasFeature(target, 'custom_instructions')) {
    payload.custom_instructions = instructions;
  }

  return payload;
}

async function translate(isAutoTrigger = false) {
  const text = els.sourceText.value.trim();

  if (!text) {
    if (!isAutoTrigger) {
      showToast(t('toast.empty'), 'error');
      els.sourceText.focus();
    } else {
      clearResult();
    }
    return;
  }

  if (!state.apiKey) {
    if (!isAutoTrigger) {
      showToast(t('toast.noKey'), 'error');
      openSettings();
      els.apiKey.focus();
    }
    return;
  }

  // Abort any ongoing translation request
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  const seq = ++requestSeq;

  setTranslating(true);

  try {
    // Two-way translation: text already in the target language goes to its partner instead
    const partner = state.sourceLang === 'AUTO'
      && state.pairLang
      && deepl.baseOf(state.pairLang) !== deepl.baseOf(state.targetLang)
      && state.pairLang;

    let target = state.targetLang;
    if (partner && deepl.guessLanguage(text, target, partner) === target) {
      target = partner;
    }

    let translation = await deepl.translate(state.apiKey, buildPayload(text, target), signal);

    // The script-based guess is not always possible (or right); DeepL's detection decides
    if (partner && translation.detected_source_language === deepl.baseOf(target)) {
      target = target === partner ? state.targetLang : partner;
      translation = await deepl.translate(state.apiKey, buildPayload(text, target), signal);
    }

    if (seq !== requestSeq) return;

    els.resultText.textContent = translation.text;
    effectiveTarget = target;
    detectedLang = state.sourceLang === 'AUTO'
      ? (translation.detected_source_language || null)
      : null;

    renderDetectedLang();
    scheduleUsageRefresh();
    els.resultSection.classList.add('visible');
    updateSwapAvailability();
    updateSpeakAvailability();

  } catch (err) {
    // Aborted or superseded requests are ignored quietly
    if (err.name === 'AbortError' || seq !== requestSeq) return;
    showToast(describeError(err), 'error');
  } finally {
    if (seq === requestSeq) setTranslating(false);
  }
}

function cancelTranslation() {
  clearTimeout(debounceTimer);
  abortController?.abort();
  requestSeq++;
  setTranslating(false);
}

function scheduleTranslate() {
  clearTimeout(debounceTimer);
  const delay = SPEED_MAP[state.translateSpeed] || 500;
  debounceTimer = setTimeout(() => translate(true), delay);
}

// Re-run the translation after a setting that affects the result has changed
function retranslate() {
  if (els.sourceText.value.trim()) {
    clearTimeout(debounceTimer);
    translate(true);
  }
}

function renderDetectedLang() {
  if (!detectedLang) {
    els.detectedLang.textContent = '';
  } else if (effectiveTarget !== state.targetLang) {
    els.detectedLang.textContent = t('result.direction', {
      from: getLanguageName(detectedLang),
      to:   getLanguageName(effectiveTarget),
    });
  } else {
    els.detectedLang.textContent = t('result.detected', { lang: getLanguageName(detectedLang) });
  }
}

function clearResult() {
  cancelTranslation();
  els.resultText.textContent = '';
  els.resultSection.classList.remove('visible');
  detectedLang = null;
  effectiveTarget = null;
  renderDetectedLang();
  updateSwapAvailability();
  updateSpeakAvailability();
}

function describeError(err) {
  if (!(err instanceof deepl.DeepLError)) return t('err.network');

  const key = `err.${err.status}`;
  const summary = hasString(key) ? t(key) : t('err.generic', { status: err.status });
  return err.detail ? `${summary} — ${err.detail}` : summary;
}

// ──────────────────────────────────────────────
// Language Swap
// ──────────────────────────────────────────────
function hasOption(select, value) {
  return [...select.options].some(o => o.value === value);
}

function swapLanguages() {
  const from = state.sourceLang === 'AUTO' ? detectedLang : state.sourceLang;
  if (!from) return;

  const newTarget = deepl.toTargetCode(from, state.langVariants);
  if (!hasOption(els.targetLang, newTarget)) return;

  let newSource = deepl.toSourceCode(effectiveTarget || state.targetLang);
  if (!hasOption(els.sourceLang, newSource)) newSource = 'AUTO';

  els.sourceLang.value = newSource;
  els.targetLang.value = newTarget;
  saveSettings({ sourceLang: newSource, targetLang: newTarget });
  updateFormalityAvailability();

  // Move result text into input for re-translation context
  const translated = els.resultText.textContent;
  clearResult();
  if (translated) {
    els.sourceText.value = translated;
    updateCharCount();
    updateSpeakAvailability();
    // Auto translate the swapped text
    translate(true);
  }

  // Animate the swap button
  els.swapBtn.classList.add('rotating');
  setTimeout(() => els.swapBtn.classList.remove('rotating'), 400);

  updateSwapAvailability();
}

function updateSwapAvailability() {
  // Disable when source is AUTO and no translation has been done yet
  const canSwap = !(state.sourceLang === 'AUTO' && !detectedLang);
  els.swapBtn.disabled = !canSwap;
}

// ──────────────────────────────────────────────
// Read Aloud
// ──────────────────────────────────────────────
let speakingBtn = null;

async function toggleSpeak(btn, text, lang) {
  const wasSpeaking = speakingBtn === btn;
  tts.stop();
  if (wasSpeaking || !text) return;

  speakingBtn = btn;
  try {
    await tts.speak({
      text,
      lang,
      geminiKey: state.geminiKey,
      voice:     state.ttsVoice,
      onState:   (s) => { btn.dataset.state = s; },
      onFallback: (err) => showToast(t('toast.ttsFallback', {
        reason: err.name === 'TimeoutError' ? t('tts.timeout') : err.message,
      }), 'error'),
    });
  } catch (err) {
    showToast(t(err.name === 'NoVoiceError' ? 'toast.noVoice' : 'toast.ttsFailed'), 'error');
  } finally {
    delete btn.dataset.state;
    if (speakingBtn === btn) speakingBtn = null;
  }
}

function updateSpeakAvailability() {
  els.speakSourceBtn.disabled = !els.sourceText.value.trim();
  els.speakResultBtn.disabled = !els.resultText.textContent;
}

// ──────────────────────────────────────────────
// UI Helpers
// ──────────────────────────────────────────────
function setTranslating(busy) {
  const btnIcon   = els.translateBtn.querySelector('.trigger-icon');
  const btnLoader = els.translateBtn.querySelector('.trigger-loader');

  btnIcon.style.display   = busy ? 'none'   : 'block';
  btnLoader.style.display = busy ? 'flex'   : 'none';
  els.translateBtn.disabled = busy;
}

function updateCharCount() {
  const n = els.sourceText.value.length;
  els.charCount.textContent = `${n}`;
}

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className   = `toast ${type} show`;

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 3500);
}

// Settings is a page of its own; the main page's scroll position is restored on return
let mainScrollY = 0;

function isSettingsOpen() {
  return !els.settingsPanel.hidden;
}

function openSettings() {
  if (isSettingsOpen()) return;
  mainScrollY = window.scrollY;
  els.mainView.hidden = true;
  els.settingsPanel.hidden = false;
  window.scrollTo(0, 0);
  els.backBtn.focus({ preventScroll: true });
}

function closeSettings() {
  commitKeys();
  if (!isSettingsOpen()) return;
  els.settingsPanel.hidden = true;
  els.mainView.hidden = false;
  window.scrollTo(0, mainScrollY);
  els.settingsToggle.focus({ preventScroll: true });
}

function commitKeys() {
  commitKey(els.apiKey, 'apiKey');
  commitKey(els.geminiKey, 'geminiKey');
}

// Persists a key field once editing is finished, rather than on every keystroke
async function commitKey(input, field) {
  const value = input.value.trim();
  if (value === state[field]) return;

  if (value) {
    await saveSettings({ [field]: value });
  } else {
    state[field] = '';
    try {
      await chrome.storage.local.remove(field);
    } catch (e) {
      console.warn('Could not clear key:', e);
    }
  }

  if (field === 'apiKey') {
    refreshUsage();
    refreshLanguages(true);
  }
}

function bindRadios(name, onChange) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
    radio.addEventListener('change', (e) => onChange(e.target.value));
  });
}

// ──────────────────────────────────────────────
// Event Bindings
// ──────────────────────────────────────────────
function bindAllEvents() {

  // Settings
  els.settingsToggle.addEventListener('click', openSettings);
  els.backBtn.addEventListener('click', closeSettings);

  // Escape goes back to the main page
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSettingsOpen()) closeSettings();
  });

  // Theme change
  bindRadios('appTheme', (value) => {
    const patch = { appTheme: value };
    if (value === 'minimal' || value === 'claude') patch.lightTheme = value;
    saveSettings(patch);
    applyTheme();
  });

  // Interface language change
  bindRadios('uiLang', (value) => {
    saveSettings({ uiLang: value });
    writeMirror('uiLang', value);
    setLang(value);
    applyI18n();
    renderLanguageSelects();
    renderDetectedLang();
    renderInstructionsHint();
    renderKeyStatus();
  });

  // Speed change
  bindRadios('translateSpeed', (value) => saveSettings({ translateSpeed: value }));

  // Options below change the translation itself, so refresh the current result
  bindRadios('modelType', (value) => {
    saveSettings({ modelType: value });
    retranslate();
  });

  els.pairLang.addEventListener('change', () => {
    saveSettings({ pairLang: els.pairLang.value });
    retranslate();
  });

  els.instructions.addEventListener('input', () => {
    state.customInstructions = els.instructions.value;
    renderInstructionsHint();
  });
  els.instructions.addEventListener('change', () => {
    saveSettings({ customInstructions: els.instructions.value });
    retranslate();
  });

  els.formalitySelect.addEventListener('change', () => {
    saveSettings({ formality: els.formalitySelect.value });
    retranslate();
  });

  // API keys
  els.apiKey.addEventListener('change', () => commitKey(els.apiKey, 'apiKey'));
  els.geminiKey.addEventListener('change', () => commitKey(els.geminiKey, 'geminiKey'));
  window.addEventListener('pagehide', commitKeys);

  document.querySelectorAll('.eye-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('revealed', show);
    });
  });

  document.querySelectorAll('.key-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.clear);
      input.value = '';
      commitKey(input, btn.dataset.clear);
      input.focus();
    });
  });

  els.ttsVoice.addEventListener('change', () => saveSettings({ ttsVoice: els.ttsVoice.value }));

  // Language selectors
  els.sourceLang.addEventListener('change', () => {
    saveSettings({ sourceLang: els.sourceLang.value });
    detectedLang = null;
    renderDetectedLang();
    updateSwapAvailability();
    retranslate();
  });

  els.targetLang.addEventListener('change', () => {
    const target = els.targetLang.value;
    const base = deepl.baseOf(target);
    const patch = { targetLang: target };
    // Remember the chosen variant so swapping back restores it
    if (deepl.hasVariants(base)) {
      patch.langVariants = { ...state.langVariants, [base]: target };
    }
    saveSettings(patch);
    updateFormalityAvailability();
    retranslate();
  });

  // Swap
  els.swapBtn.addEventListener('click', swapLanguages);

  // Text input - handles character count and auto-translate trigger
  els.sourceText.addEventListener('input', () => {
    updateCharCount();

    if (!els.sourceText.value.trim()) {
      clearResult();
      return;
    }

    updateSpeakAvailability();
    // Trigger auto-translate based on current speed setting
    scheduleTranslate();
  });

  // Context
  els.contextBtn.addEventListener('click', () => {
    els.contextInput.hidden = !els.contextInput.hidden;
    if (!els.contextInput.hidden) els.contextInput.focus();
  });

  els.contextInput.addEventListener('input', () => {
    els.contextBtn.classList.toggle('active', !!els.contextInput.value.trim());
    if (els.sourceText.value.trim()) scheduleTranslate();
  });

  els.clearBtn.addEventListener('click', () => {
    els.sourceText.value = '';
    updateCharCount();
    clearResult();
    els.sourceText.focus();
  });

  // Read aloud
  els.speakSourceBtn.addEventListener('click', () => {
    const lang = state.sourceLang === 'AUTO' ? detectedLang : state.sourceLang;
    toggleSpeak(els.speakSourceBtn, els.sourceText.value.trim(), lang);
  });

  els.speakResultBtn.addEventListener('click', () => {
    toggleSpeak(els.speakResultBtn, els.resultText.textContent, effectiveTarget || state.targetLang);
  });

  // Translate button (Acts as manual force translation)
  els.translateBtn.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    translate(false);
  });

  // Copy result
  els.copyBtn.addEventListener('click', async () => {
    const text = els.resultText.textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(t('toast.copied'));
  });

  // Keyboard shortcut: Ctrl/Cmd + Enter → manual force translate
  els.sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      translate(false);
    }
  });
}

