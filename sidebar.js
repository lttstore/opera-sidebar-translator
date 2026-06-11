/* ============================================================
   Opera Sidebar Translator — Logic
   DeepL API integration with auto-detect, manual selection,
   one-click language swap, and persistent settings.
   ============================================================ */

// ──────────────────────────────────────────────
// DeepL Supported Languages
// ──────────────────────────────────────────────
const LANGUAGES = [
  { code: 'AUTO', name: '自动检测',    isAuto: true },
  { code: 'BG',   name: '保加利亚语' },
  { code: 'CS',   name: '捷克语' },
  { code: 'DA',   name: '丹麦语' },
  { code: 'DE',   name: '德语' },
  { code: 'EL',   name: '希腊语' },
  { code: 'EN',   name: '英语' },
  { code: 'EN-GB',name: '英语 (英式)',  targetOnly: true },
  { code: 'EN-US',name: '英语 (美式)',  targetOnly: true },
  { code: 'ES',   name: '西班牙语' },
  { code: 'ET',   name: '爱沙尼亚语' },
  { code: 'FI',   name: '芬兰语' },
  { code: 'FR',   name: '法语' },
  { code: 'HU',   name: '匈牙利语' },
  { code: 'ID',   name: '印尼语' },
  { code: 'IT',   name: '意大利语' },
  { code: 'JA',   name: '日语' },
  { code: 'KO',   name: '韩语' },
  { code: 'LT',   name: '立陶宛语' },
  { code: 'LV',   name: '拉脱维亚语' },
  { code: 'NB',   name: '挪威语' },
  { code: 'NL',   name: '荷兰语' },
  { code: 'PL',   name: '波兰语' },
  { code: 'PT',   name: '葡萄牙语' },
  { code: 'PT-BR',name: '葡萄牙语 (巴西)', targetOnly: true },
  { code: 'PT-PT',name: '葡萄牙语 (欧洲)', targetOnly: true },
  { code: 'RO',   name: '罗马尼亚语' },
  { code: 'RU',   name: '俄语' },
  { code: 'SK',   name: '斯洛伐克语' },
  { code: 'SL',   name: '斯洛文尼亚语' },
  { code: 'SV',   name: '瑞典语' },
  { code: 'TR',   name: '土耳其语' },
  { code: 'UK',   name: '乌克兰语' },
  { code: 'ZH',   name: '中文' },
];

// ──────────────────────────────────────────────
// Application State
// ──────────────────────────────────────────────
const state = {
  apiKey:        '',
  apiTier:       'free',   // 'free' | 'pro'
  sourceLang:    'AUTO',
  targetLang:    'EN',
  detectedLang:  null,     // detected source language code after translation
  isTranslating: false,
};

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  settingsToggle: $('settingsToggle'),
  settingsPanel:  $('settingsPanel'),
  apiKey:         $('apiKey'),
  eyeToggle:      $('eyeToggle'),
  sourceLang:     $('sourceLang'),
  targetLang:     $('targetLang'),
  swapBtn:        $('swapBtn'),
  sourceText:     $('sourceText'),
  charCount:      $('charCount'),
  clearBtn:       $('clearBtn'),
  translateBtn:   $('translateBtn'),
  resultSection:  $('resultSection'),
  detectedLang:   $('detectedLang'),
  resultText:     $('resultText'),
  copyBtn:        $('copyBtn'),
  toast:          $('toast'),
};

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadSettings();
  populateLanguageSelects();
  applyStateToUI();
  bindAllEvents();
  updateSwapAvailability();
  els.sourceText.focus();
}

// ──────────────────────────────────────────────
// Settings Persistence (chrome.storage.local)
// ──────────────────────────────────────────────
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      'apiKey', 'apiTier', 'sourceLang', 'targetLang',
    ]);
    if (data.apiKey     !== undefined) state.apiKey     = data.apiKey;
    if (data.apiTier    !== undefined) state.apiTier    = data.apiTier;
    if (data.sourceLang !== undefined) state.sourceLang = data.sourceLang;
    if (data.targetLang !== undefined) state.targetLang = data.targetLang;
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      apiKey:     state.apiKey,
      apiTier:    state.apiTier,
      sourceLang: state.sourceLang,
      targetLang: state.targetLang,
    });
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

function applyStateToUI() {
  els.apiKey.value = state.apiKey;

  const tierRadio = document.querySelector(
    `input[name="apiTier"][value="${state.apiTier}"]`
  );
  if (tierRadio) tierRadio.checked = true;

  if ([...els.sourceLang.options].some(o => o.value === state.sourceLang)) {
    els.sourceLang.value = state.sourceLang;
  }
  if ([...els.targetLang.options].some(o => o.value === state.targetLang)) {
    els.targetLang.value = state.targetLang;
  }
}

// ──────────────────────────────────────────────
// Language Select Population
// ──────────────────────────────────────────────
function populateLanguageSelects() {
  // Source: includes AUTO, excludes targetOnly variants
  LANGUAGES.filter(l => !l.targetOnly).forEach(lang => {
    const opt = new Option(lang.name, lang.code);
    els.sourceLang.add(opt);
  });

  // Target: excludes AUTO and sourceOnly items
  LANGUAGES.filter(l => !l.isAuto).forEach(lang => {
    const opt = new Option(lang.name, lang.code);
    els.targetLang.add(opt);
  });
}

function getLanguageName(code) {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
}

// ──────────────────────────────────────────────
// DeepL API Translation
// ──────────────────────────────────────────────
async function translate() {
  const text = els.sourceText.value.trim();

  if (!text) {
    showToast('请输入要翻译的文本', 'error');
    els.sourceText.focus();
    return;
  }

  if (!state.apiKey) {
    showToast('请先在设置中输入 DeepL API Key', 'error');
    openSettings();
    els.apiKey.focus();
    return;
  }

  if (state.isTranslating) return;
  setTranslating(true);

  const baseUrl = state.apiTier === 'pro'
    ? 'https://api.deepl.com/v2/translate'
    : 'https://api-free.deepl.com/v2/translate';

  const payload = {
    text:       [text],
    target_lang: state.targetLang,
  };

  // Omit source_lang to trigger DeepL auto-detection
  if (state.sourceLang !== 'AUTO') {
    payload.source_lang = state.sourceLang;
  }

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${state.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(parseApiError(res.status));
    }

    const data        = await res.json();
    const translation = data.translations[0];

    // ── Display result ──
    els.resultText.textContent = translation.text;

    // ── Show detected language ──
    if (state.sourceLang === 'AUTO' && translation.detected_source_language) {
      state.detectedLang = translation.detected_source_language;
      els.detectedLang.textContent =
        `检测到: ${getLanguageName(translation.detected_source_language)}`;
    } else {
      state.detectedLang = null;
      els.detectedLang.textContent = '';
    }

    els.resultSection.classList.add('visible');
    updateSwapAvailability();

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setTranslating(false);
  }
}

function parseApiError(status) {
  switch (status) {
    case 400: return '请求参数错误，请检查文本内容';
    case 403: return 'API Key 无效或权限不足';
    case 413: return '文本过长，请缩短后重试';
    case 429: return '请求过于频繁，请稍后再试';
    case 456: return '已达到配额上限';
    case 503: return 'DeepL 服务暂时不可用，请稍后重试';
    default:  return `请求失败 (${status})`;
  }
}

// ──────────────────────────────────────────────
// Language Swap
// ──────────────────────────────────────────────
function swapLanguages() {
  let newSource, newTarget;

  if (state.sourceLang === 'AUTO') {
    // With auto-detect: swap to detected→target becomes source, old target→new target
    if (!state.detectedLang) return;
    newSource = state.targetLang;
    newTarget = state.detectedLang;
  } else {
    // Normal swap
    newSource = state.targetLang;
    newTarget = state.sourceLang;
  }

  state.sourceLang   = newSource;
  state.targetLang   = newTarget;
  state.detectedLang = null;

  els.sourceLang.value = state.sourceLang;
  els.targetLang.value = state.targetLang;

  // Move result text into input for re-translation context
  const translated = els.resultText.textContent;
  if (translated) {
    els.sourceText.value = translated;
    els.resultText.textContent = '';
    els.resultSection.classList.remove('visible');
    els.detectedLang.textContent = '';
    updateCharCount();
  }

  // Animate the swap button
  els.swapBtn.classList.add('rotating');
  setTimeout(() => els.swapBtn.classList.remove('rotating'), 400);

  updateSwapAvailability();
  saveSettings();
}

function updateSwapAvailability() {
  // Disable when source is AUTO and no translation has been done yet
  const canSwap = !(state.sourceLang === 'AUTO' && !state.detectedLang);
  els.swapBtn.disabled = !canSwap;
}

// ──────────────────────────────────────────────
// UI Helpers
// ──────────────────────────────────────────────
function setTranslating(busy) {
  state.isTranslating = busy;
  const btnText   = els.translateBtn.querySelector('.btn-text');
  const btnLoader = els.translateBtn.querySelector('.btn-loader');

  btnText.style.display   = busy ? 'none'   : 'inline';
  btnLoader.style.display = busy ? 'flex'   : 'none';
  els.translateBtn.disabled = busy;
}

function updateCharCount() {
  const n = els.sourceText.value.length;
  els.charCount.textContent = `${n} 字符`;
}

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.className   = `toast ${type} show`;

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 3500);
}

function openSettings() {
  els.settingsPanel.classList.add('open');
  els.settingsToggle.classList.add('active');
}

function toggleSettings() {
  const isOpen = els.settingsPanel.classList.toggle('open');
  els.settingsToggle.classList.toggle('active', isOpen);
  if (isOpen) els.apiKey.focus();
}

// ──────────────────────────────────────────────
// Event Bindings
// ──────────────────────────────────────────────
function bindAllEvents() {

  // Settings
  els.settingsToggle.addEventListener('click', toggleSettings);

  els.apiKey.addEventListener('input', () => {
    state.apiKey = els.apiKey.value.trim();
    saveSettings();
  });

  els.eyeToggle.addEventListener('click', () => {
    const show = els.apiKey.type === 'password';
    els.apiKey.type = show ? 'text' : 'password';
    els.eyeToggle.querySelector('.eye-open').style.display   = show ? 'none'  : 'block';
    els.eyeToggle.querySelector('.eye-closed').style.display = show ? 'block' : 'none';
  });

  document.querySelectorAll('input[name="apiTier"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.apiTier = e.target.value;
      saveSettings();
    });
  });

  // Language selectors
  els.sourceLang.addEventListener('change', () => {
    state.sourceLang   = els.sourceLang.value;
    state.detectedLang = null;
    els.detectedLang.textContent = '';
    updateSwapAvailability();
    saveSettings();
  });

  els.targetLang.addEventListener('change', () => {
    state.targetLang = els.targetLang.value;
    saveSettings();
  });

  // Swap
  els.swapBtn.addEventListener('click', swapLanguages);

  // Text input
  els.sourceText.addEventListener('input', updateCharCount);

  els.clearBtn.addEventListener('click', () => {
    els.sourceText.value = '';
    updateCharCount();
    els.sourceText.focus();
  });

  // Translate
  els.translateBtn.addEventListener('click', translate);

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
    showToast('已复制到剪贴板');
  });

  // Keyboard shortcut: Ctrl/Cmd + Enter → translate
  els.sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      translate();
    }
  });
}
