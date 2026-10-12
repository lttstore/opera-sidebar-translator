/* ============================================================
   Opera Sidebar Translator — Interface strings
   ============================================================ */

const STRINGS = {
  zh: {
    'settings.title':      '设置',
    'settings.close':      '关闭',
    'sec.appearance':      '外观',
    'sec.translation':     '翻译',
    'sec.speech':          '朗读',
    'sec.api':             'DeepL API',

    'theme.label':         '主题',
    'theme.auto':          '自动',
    'theme.minimal':       '极简',
    'theme.night':         '夜空',
    'theme.claude':        '纸墨',
    'uiLang.label':        '界面语言',
    'uiLang.auto':         '跟随系统',

    'speed.label':         '自动翻译延迟',
    'speed.fast':          '快 (400ms)',
    'speed.medium':        '中 (500ms)',
    'speed.slow':          '慢 (700ms)',
    'model.label':         '翻译模型',
    'model.default':       '默认',
    'model.quality':       '质量优先',
    'model.speed':         '速度优先',
    'pair.label':          '互译语言',
    'pair.off':            '关闭',
    'pair.hint':           '源语言为自动检测时，输入内容若已是目标语言，则改译为此语言。',
    'instr.label':         '自定义指令',
    'instr.placeholder':   '每行一条，例如：Use a friendly, conversational tone',
    'instr.hint':          '用英语或目标语言书写，最多 10 条，每条不超过 300 字符。',
    'instr.dropped':       '有 {n} 条指令超出限制，不会发送。',

    'gemini.label':        'Gemini API Key',
    'gemini.placeholder':  '可选，留空则使用系统语音',
    'voice.label':         'Gemini 音色',

    'key.label':           'DeepL API Key',
    'key.placeholder':     '粘贴 DeepL API Key…',
    'key.show':            '显示或隐藏',
    'key.clear':           '清除',
    'key.free':            'Free API',
    'key.pro':             'Pro API',
    'key.usage':           '{tier} · 已用 {used} / {limit} 字符',
    'key.invalid':         'API Key 无效',

    'lang.auto':           '自动检测',
    'lang.source':         '源语言',
    'lang.target':         '目标语言',
    'lang.swap':           '交换语言',

    'input.placeholder':   '输入要翻译的文本…',
    'context.toggle':      '上下文',
    'context.placeholder': '补充上下文以消除歧义（不会被翻译）',
    'action.translate':    '翻译 (Ctrl+Enter)',
    'action.clear':        '清空',
    'action.copy':         '复制',
    'action.speak':        '朗读',
    'formality.label':     '语气',
    'formality.default':   '默认语气',
    'formality.more':      '正式',
    'formality.less':      '随意',

    'result.detected':     '检测到：{lang}',
    'result.direction':    '{from} → {to}',

    'toast.empty':         '请输入要翻译的文本',
    'toast.noKey':         '请先在设置中填写 DeepL API Key',
    'toast.copied':        '已复制到剪贴板',
    'toast.noVoice':       '系统未安装该语言的语音',
    'toast.ttsFallback':   'Gemini 朗读失败（{reason}），已改用系统语音',
    'toast.ttsFailed':     '朗读失败',
    'tts.timeout':         '请求超时',

    'err.400':             '请求参数错误',
    'err.403':             'API Key 无效或权限不足',
    'err.413':             '文本过长，请缩短后重试',
    'err.429':             '请求过于频繁，请稍后再试',
    'err.456':             '已达到配额上限',
    'err.503':             'DeepL 服务暂时不可用，请稍后重试',
    'err.network':         '网络连接失败',
    'err.generic':         '请求失败 ({status})',
  },

  en: {
    'settings.title':      'Settings',
    'settings.close':      'Close',
    'sec.appearance':      'Appearance',
    'sec.translation':     'Translation',
    'sec.speech':          'Read aloud',
    'sec.api':             'DeepL API',

    'theme.label':         'Theme',
    'theme.auto':          'Auto',
    'theme.minimal':       'Minimal',
    'theme.night':         'Night',
    'theme.claude':        'Claude',
    'uiLang.label':        'Interface language',
    'uiLang.auto':         'System',

    'speed.label':         'Auto-translate delay',
    'speed.fast':          'Fast (400ms)',
    'speed.medium':        'Medium (500ms)',
    'speed.slow':          'Slow (700ms)',
    'model.label':         'Translation model',
    'model.default':       'Default',
    'model.quality':       'Quality',
    'model.speed':         'Speed',
    'pair.label':          'Two-way language',
    'pair.off':            'Off',
    'pair.hint':           'With language detection on, text already in the target language is translated into this language instead.',
    'instr.label':         'Custom instructions',
    'instr.placeholder':   'One per line, e.g. Use a friendly, conversational tone',
    'instr.hint':          'Write in English or the target language. Up to 10 instructions, 300 characters each.',
    'instr.dropped':       '{n} instruction(s) exceed the limits and will not be sent.',

    'gemini.label':        'Gemini API Key',
    'gemini.placeholder':  'Optional — the system voice is used when empty',
    'voice.label':         'Gemini voice',

    'key.label':           'DeepL API Key',
    'key.placeholder':     'Paste your DeepL API key…',
    'key.show':            'Show or hide',
    'key.clear':           'Clear',
    'key.free':            'Free API',
    'key.pro':             'Pro API',
    'key.usage':           '{tier} · {used} / {limit} characters used',
    'key.invalid':         'Invalid API key',

    'lang.auto':           'Detect language',
    'lang.source':         'Source language',
    'lang.target':         'Target language',
    'lang.swap':           'Swap languages',

    'input.placeholder':   'Enter text to translate…',
    'context.toggle':      'Context',
    'context.placeholder': 'Add context to resolve ambiguity (not translated)',
    'action.translate':    'Translate (Ctrl+Enter)',
    'action.clear':        'Clear',
    'action.copy':         'Copy',
    'action.speak':        'Read aloud',
    'formality.label':     'Tone',
    'formality.default':   'Default tone',
    'formality.more':      'Formal',
    'formality.less':      'Casual',

    'result.detected':     'Detected: {lang}',
    'result.direction':    '{from} → {to}',

    'toast.empty':         'Enter some text to translate',
    'toast.noKey':         'Add your DeepL API key in Settings first',
    'toast.copied':        'Copied to clipboard',
    'toast.noVoice':       'No system voice is installed for this language',
    'toast.ttsFallback':   'Gemini speech failed ({reason}); using the system voice',
    'toast.ttsFailed':     'Could not read aloud',
    'tts.timeout':         'request timed out',

    'err.400':             'Invalid request parameters',
    'err.403':             'Invalid API key or insufficient permissions',
    'err.413':             'Text is too long',
    'err.429':             'Too many requests, try again shortly',
    'err.456':             'Quota exceeded',
    'err.503':             'DeepL is temporarily unavailable',
    'err.network':         'Network connection failed',
    'err.generic':         'Request failed ({status})',
  },
};

let current = 'zh';

// pref: 'auto' | 'zh' | 'en'
export function setLang(pref) {
  current = pref === 'zh' || pref === 'en'
    ? pref
    : (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
  document.documentElement.lang = getLocale();
}

export function getLocale() {
  return current === 'zh' ? 'zh-CN' : 'en';
}

export function hasString(key) {
  return key in STRINGS[current];
}

export function t(key, vars = {}) {
  const template = STRINGS[current][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}

export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const text = t(el.dataset.i18nTitle);
    el.title = text;
    el.setAttribute('aria-label', text);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
}
