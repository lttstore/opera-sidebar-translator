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
  apiKey:            '',
  apiTier:           'free',   // 'free' | 'pro'
  appTheme:          'claude', // 'minimal' | 'night' | 'claude'
  translateSpeed:    'medium', // 'fast' | 'medium' | 'slow'
  alternativesCount: '0',      // '0' | '1' | '2' | '3'
  formality:         'default',// 'default' | 'prefer_more' | 'prefer_less'
  sourceLang:        'AUTO',
  targetLang:        'EN',
  detectedLang:      null,     // detected source language code after translation
  isTranslating:     false,
};

// ──────────────────────────────────────────────
// Debounce & Abort Controller for "Type-as-you-Translate"
// ──────────────────────────────────────────────
let debounceTimer = null;
let abortController = null;

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
  html:           document.documentElement,
  settingsToggle: $('settingsToggle'),
  closeSettings:  $('closeSettingsBtn'),
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
  formalitySelect:$('formalitySelect'),
  resultSection:  $('resultSection'),
  detectedLang:   $('detectedLang'),
  resultText:     $('resultText'),
  alternativesBox:$('alternativesBox'),
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
      'apiKey', 'apiTier', 'appTheme', 'translateSpeed', 'alternativesCount', 'formality', 'sourceLang', 'targetLang',
    ]);
    if (data.apiKey            !== undefined) state.apiKey            = data.apiKey;
    if (data.apiTier           !== undefined) state.apiTier           = data.apiTier;
    if (data.appTheme          !== undefined) {
      // Migrate old themes safely to new equivalents
      if (data.appTheme === 'pastel') state.appTheme = 'claude';
      else if (data.appTheme === 'brutalist') state.appTheme = 'night';
      else state.appTheme = data.appTheme;
    }
    if (data.translateSpeed    !== undefined) state.translateSpeed    = data.translateSpeed;
    if (data.alternativesCount !== undefined) state.alternativesCount = data.alternativesCount;
    if (data.formality         !== undefined) state.formality         = data.formality;
    if (data.sourceLang        !== undefined) state.sourceLang        = data.sourceLang;
    if (data.targetLang        !== undefined) state.targetLang        = data.targetLang;
  } catch (e) {
    console.warn('Could not load settings:', e);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({
      apiKey:            state.apiKey,
      apiTier:           state.apiTier,
      appTheme:          state.appTheme,
      translateSpeed:    state.translateSpeed,
      alternativesCount: state.alternativesCount,
      formality:         state.formality,
      sourceLang:        state.sourceLang,
      targetLang:        state.targetLang,
    });
  } catch (e) {
    console.warn('Could not save settings:', e);
  }
}

function applyStateToUI() {
  els.apiKey.value = state.apiKey;

  // Apply Theme
  els.html.setAttribute('data-theme', state.appTheme);
  const themeRadio = document.querySelector(`input[name="appTheme"][value="${state.appTheme}"]`);
  if (themeRadio) themeRadio.checked = true;

  // Apply Speed Option
  const speedRadio = document.querySelector(`input[name="translateSpeed"][value="${state.translateSpeed}"]`);
  if (speedRadio) speedRadio.checked = true;

  // Apply Alternatives Count
  const altRadio = document.querySelector(`input[name="alternativesCount"][value="${state.alternativesCount}"]`);
  if (altRadio) altRadio.checked = true;

  // Apply Formality
  els.formalitySelect.value = state.formality;

  // Apply API Tier
  const tierRadio = document.querySelector(`input[name="apiTier"][value="${state.apiTier}"]`);
  if (tierRadio) tierRadio.checked = true;

  // Apply Languages
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
async function translate(isAutoTrigger = false) {
  const text = els.sourceText.value.trim();

  if (!text) {
    if (!isAutoTrigger) {
      showToast('请输入要翻译的文本', 'error');
      els.sourceText.focus();
    } else {
      clearResult();
    }
    return;
  }

  if (!state.apiKey) {
    if (!isAutoTrigger) {
      showToast('请先在设置中输入 DeepL API Key', 'error');
      openSettings();
      els.apiKey.focus();
    }
    return;
  }

  // Abort any ongoing translation request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();

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

  // Formality parameter support (prefer_more / prefer_less)
  if (state.formality !== 'default') {
    payload.formality = state.formality;
  }

  // Alternatives parameter support
  const count = parseInt(state.alternativesCount, 10);
  if (count > 0) {
    payload.alternatives = count;
  }

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${state.apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!res.ok) {
      throw new Error(parseApiError(res.status));
    }

    const data        = await res.json();
    const translation = data.translations[0];

    // ── Display main result ──
    els.resultText.textContent = translation.text;

    // ── Display alternatives if any are returned and requested ──
    const alternatives = data.translations[0].alternatives || [];
    if (count > 0 && alternatives.length > 0) {
      els.alternativesBox.innerHTML = '';
      alternatives.slice(0, count).forEach(alt => {
        const altItem = document.createElement('div');
        altItem.className = 'alternative-item';
        altItem.title = '点击使用此备选翻译';
        altItem.innerHTML = `
          <svg class="alt-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
          </svg>
          <span class="alt-text">${alt.text}</span>
        `;
        
        // Let user click on any alternative to swap it into the main result
        altItem.addEventListener('click', () => {
          const originalMain = els.resultText.textContent;
          els.resultText.textContent = alt.text;
          altItem.querySelector('.alt-text').textContent = originalMain;
        });

        els.alternativesBox.appendChild(altItem);
      });
      els.alternativesBox.style.display = 'flex';
    } else {
      els.alternativesBox.style.display = 'none';
      els.alternativesBox.innerHTML = '';
    }

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
    if (err.name === 'AbortError') {
      // Quietly ignore aborted requests, as they were superseded by a newer input
      return;
    }
    showToast(err.message, 'error');
  } finally {
    // Only turn off translating status if we are not expecting another aborted callback to clear it prematurely
    if (!abortController || abortController.signal.aborted === false) {
      setTranslating(false);
    }
  }
}

function clearResult() {
  els.resultText.textContent = '';
  els.detectedLang.textContent = '';
  els.alternativesBox.style.display = 'none';
  els.alternativesBox.innerHTML = '';
  els.resultSection.classList.remove('visible');
  state.detectedLang = null;
  updateSwapAvailability();
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
    clearResult();
    updateCharCount();
    // Auto translate the swapped text
    translate(true);
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

function openSettings() {
  els.settingsPanel.classList.add('open');
}

function closeSettings() {
  els.settingsPanel.classList.remove('open');
}

function toggleSettings() {
  const isOpen = els.settingsPanel.classList.contains('open');
  if (isOpen) {
    closeSettings();
  } else {
    openSettings();
    els.apiKey.focus();
  }
}

// ──────────────────────────────────────────────
// Event Bindings
// ──────────────────────────────────────────────
function bindAllEvents() {

  // Settings
  els.settingsToggle.addEventListener('click', toggleSettings);
  els.closeSettings.addEventListener('click', closeSettings);

  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    if (els.settingsPanel.classList.contains('open') && 
        !els.settingsPanel.contains(e.target) && 
        !els.settingsToggle.contains(e.target)) {
      closeSettings();
    }
  });

  // Theme change
  document.querySelectorAll('input[name="appTheme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.appTheme = e.target.value;
      els.html.setAttribute('data-theme', state.appTheme);
      saveSettings();
    });
  });

  // Speed change
  document.querySelectorAll('input[name="translateSpeed"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.translateSpeed = e.target.value;
      saveSettings();
    });
  });

  // Alternatives count change
  document.querySelectorAll('input[name="alternativesCount"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.alternativesCount = e.target.value;
      saveSettings();
      // If there is already text, trigger a translation refresh with new settings
      if (els.sourceText.value.trim()) {
        translate(true);
      }
    });
  });

  // Formality dropdown change
  els.formalitySelect.addEventListener('change', () => {
    state.formality = els.formalitySelect.value;
    saveSettings();
    // If there is already text, trigger a translation refresh with new settings
    if (els.sourceText.value.trim()) {
      translate(true);
    }
  });

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

  // Text input - handles character count and auto-translate trigger
  els.sourceText.addEventListener('input', () => {
    updateCharCount();

    // Reset debounce timer on every key stroke
    clearTimeout(debounceTimer);

    const text = els.sourceText.value.trim();
    if (!text) {
      clearResult();
      return;
    }

    // Trigger auto-translate based on current speed setting
    const delay = SPEED_MAP[state.translateSpeed] || 500;
    debounceTimer = setTimeout(() => {
      translate(true);
    }, delay);
  });

  els.clearBtn.addEventListener('click', () => {
    els.sourceText.value = '';
    updateCharCount();
    clearResult();
    els.sourceText.focus();
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
    showToast('已复制到剪贴板');
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
