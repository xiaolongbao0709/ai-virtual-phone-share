const PLUGIN_ID = "float-interface-skins";
const STORAGE_KEY = "state-v3";
const MAX_FONT_FILE_BYTES = 25 * 1024 * 1024;

const REGION_DEFS = [
  { key: "appBackground", label: "应用背景", hint: "同一张图片可用于五个主界面，并可覆盖聊天室自带背景", overflow: false, targets: [["messages", "消息"], ["contacts", "联系人"], ["feeds", "动态"], ["me", "主页"], ["chatRoom", "聊天室"]] },
  { key: "topBar", label: "顶部栏图片", hint: "同一张图片可分别用于五个界面的顶部栏", overflow: true, targets: [["me", "主页"], ["feeds", "动态"], ["contacts", "联系人"], ["messages", "消息"], ["chatRoom", "聊天"]] },
  { key: "bottomBar", label: "底部栏图片", hint: "同一张图片可分别调节聊天输入区和应用底部栏", overflow: true, targets: [["inputBar", "聊天输入区"], ["tabBar", "应用底部栏"]] },
  { key: "inputField", label: "输入框图片", hint: "同一张图片可用于聊天输入框、搜索框和表单输入框", targets: [["chatInput", "聊天输入框"], ["searchInput", "搜索框"], ["formInput", "表单输入框"]] },
];

const IMAGE_REGION_DEFS = REGION_DEFS.filter(def => def.key !== "inputField");

const COLOR_TARGETS = [
  { key: "activeIcon", label: "激活图标" },
  { key: "icon", label: "普通图标" },
  { key: "title", label: "标题文字" },
  { key: "text", label: "正文文字" },
  { key: "metaText", label: "辅助文字" },
];

const BUTTON_STYLE_TARGETS = [
  ["accent", "功能按钮"],
  ["capsule", "胶囊标签"],
];

const FONT_TARGETS = [
  { key: "title", label: "标题文字" },
  { key: "text", label: "正文文字" },
  { key: "metaText", label: "辅助文字" },
  { key: "button", label: "按钮文字" },
  { key: "input", label: "输入框文字" },
];

const INPUT_STYLE_TARGETS = [
  ["chatInput", "聊天输入框"],
  ["searchInput", "搜索框"],
  ["formInput", "表单输入框"],
];

function colorRuleId() {
  return "color-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function themeId() {
  return "theme-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function fontRuleId() {
  return "font-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function themeSnapshot(source) {
  return JSON.parse(JSON.stringify({
    version: 26,
    colorsEnabled: source.colorsEnabled,
    imagesEnabled: source.imagesEnabled,
    colorRules: source.colorRules,
    inputStyle: source.inputStyle,
    buttonStyle: source.buttonStyle,
    interfaceStyle: source.interfaceStyle,
    fontsEnabled: source.fontsEnabled,
    fontRules: source.fontRules,
    regions: source.regions,
  }));
}

function makeRegion(def) {
  const region = {
    enabled: true,
    image: "",
    fileName: "",
    scale: 1,
    blur: 0,
    positionX: 50,
    positionY: 50,
    opacity: 1,
    overflowY: 0,
    applyTargets: def.targets ? def.targets.map(([key]) => key) : undefined,
  };
  if (def.key === "bottomBar") {
    region.targetSettings = {
      inputBar: { scale: 1, blur: 0, positionX: 50, positionY: 50, overflowY: 0 },
      tabBar: { scale: 1, blur: 0, positionX: 50, positionY: 50, overflowY: 0 },
    };
  }
  return region;
}

function defaultState() {
  const regions = {};
  for (const def of REGION_DEFS) regions[def.key] = makeRegion(def);
  return {
    version: 26,
    colorsEnabled: true,
    imagesEnabled: true,
    floatingButtonEnabled: true,
    floatingButtonTop: null,
    inputStyle: {
      enabled: false,
      radius: 14,
      borderless: false,
      borderWidth: 1,
      borderColor: "#dadbdf",
      backgroundMode: "color",
      backgroundColor: "#ebecef",
      backgroundOpacity: 100,
      applyTargets: INPUT_STYLE_TARGETS.map(([key]) => key),
    },
    buttonStyle: {
      enabled: false,
      accentColor: "#246bfd",
      accentOpacity: 100,
      capsuleColor: "#ebebeb",
      capsuleOpacity: 100,
      radius: 12,
      borderless: true,
      borderWidth: 1,
      borderColor: "#dadbdf",
      applyTargets: BUTTON_STYLE_TARGETS.map(([key]) => key),
    },
    interfaceStyle: {
      cardsEnabled: false,
      radius: 28,
      borderless: true,
      borderWidth: 1,
      borderColor: "#dadbdf",
      backgroundColor: "#ffffff",
      backgroundOpacity: 100,
    },
    fontsEnabled: true,
    fontRules: [],
    colorRules: [{ id: colorRuleId(), color: "#8f76b8", targets: [] }],
    regions,
    themes: {},
  };
}

function clamp(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeState(raw) {
  const state = defaultState();
  if (!raw || typeof raw !== "object") return state;
  state.colorsEnabled = raw.colorsEnabled !== false;
  state.imagesEnabled = raw.imagesEnabled !== false;
  state.floatingButtonEnabled = raw.floatingButtonEnabled !== false;
  state.floatingButtonTop = raw.floatingButtonTop != null && Number.isFinite(Number(raw.floatingButtonTop)) ? Math.max(8, Number(raw.floatingButtonTop)) : null;
  state.fontsEnabled = raw.fontsEnabled !== false;
  if (raw.inputStyle && typeof raw.inputStyle === "object") {
    state.inputStyle.enabled = raw.inputStyle.enabled === true;
    state.inputStyle.radius = clamp(raw.inputStyle.radius, 14, 0, 50);
    state.inputStyle.borderless = raw.inputStyle.borderless === true;
    state.inputStyle.borderWidth = clamp(raw.inputStyle.borderWidth, 1, 0.5, 6);
    state.inputStyle.borderColor = /^#[0-9a-f]{6}$/i.test(String(raw.inputStyle.borderColor || "")) ? String(raw.inputStyle.borderColor).toLowerCase() : "#dadbdf";
    state.inputStyle.backgroundColor = /^#[0-9a-f]{6}$/i.test(String(raw.inputStyle.backgroundColor || "")) ? String(raw.inputStyle.backgroundColor).toLowerCase() : "#ebecef";
    state.inputStyle.backgroundOpacity = clamp(raw.inputStyle.backgroundOpacity, 100, 0, 100);
    if (["none", "color", "image"].includes(raw.inputStyle.backgroundMode)) state.inputStyle.backgroundMode = raw.inputStyle.backgroundMode;
    if (Array.isArray(raw.inputStyle.applyTargets)) {
      const allowed = INPUT_STYLE_TARGETS.map(([key]) => key);
      state.inputStyle.applyTargets = [...new Set(raw.inputStyle.applyTargets.filter(key => allowed.includes(key)))];
    }
  }
  if (raw.buttonStyle && typeof raw.buttonStyle === "object") {
    state.buttonStyle.enabled = raw.buttonStyle.enabled === true;
    state.buttonStyle.accentColor = state.buttonStyle.enabled && /^#[0-9a-f]{6}$/i.test(String(raw.buttonStyle.accentColor || "")) ? String(raw.buttonStyle.accentColor).toLowerCase() : "#246bfd";
    state.buttonStyle.accentOpacity = state.buttonStyle.enabled ? clamp(raw.buttonStyle.accentOpacity, 100, 0, 100) : 100;
    state.buttonStyle.capsuleColor = state.buttonStyle.enabled && /^#[0-9a-f]{6}$/i.test(String(raw.buttonStyle.capsuleColor || "")) ? String(raw.buttonStyle.capsuleColor).toLowerCase() : "#ebebeb";
    state.buttonStyle.capsuleOpacity = state.buttonStyle.enabled ? clamp(raw.buttonStyle.capsuleOpacity, 100, 0, 100) : 100;
    state.buttonStyle.radius = clamp(raw.buttonStyle.radius, 12, 0, 50);
    state.buttonStyle.borderless = raw.buttonStyle.borderless === true;
    state.buttonStyle.borderWidth = clamp(raw.buttonStyle.borderWidth, 1, 0.5, 6);
    state.buttonStyle.borderColor = /^#[0-9a-f]{6}$/i.test(String(raw.buttonStyle.borderColor || "")) ? String(raw.buttonStyle.borderColor).toLowerCase() : "#dadbdf";
    if (Array.isArray(raw.buttonStyle.applyTargets)) {
      const allowed = BUTTON_STYLE_TARGETS.map(([key]) => key);
      state.buttonStyle.applyTargets = [...new Set(raw.buttonStyle.applyTargets.filter(key => allowed.includes(key)))];
    }
  }
  if (raw.interfaceStyle && typeof raw.interfaceStyle === "object") {
    state.interfaceStyle.cardsEnabled = raw.interfaceStyle.cardsEnabled === true;
    state.interfaceStyle.radius = clamp(raw.interfaceStyle.radius, 28, 0, 50);
    state.interfaceStyle.borderless = raw.interfaceStyle.borderless === true;
    state.interfaceStyle.borderWidth = clamp(raw.interfaceStyle.borderWidth, 1, 0.5, 6);
    state.interfaceStyle.borderColor = /^#[0-9a-f]{6}$/i.test(String(raw.interfaceStyle.borderColor || "")) ? String(raw.interfaceStyle.borderColor).toLowerCase() : "#dadbdf";
    state.interfaceStyle.backgroundColor = /^#[0-9a-f]{6}$/i.test(String(raw.interfaceStyle.backgroundColor || "")) ? String(raw.interfaceStyle.backgroundColor).toLowerCase() : "#ffffff";
    state.interfaceStyle.backgroundOpacity = clamp(raw.interfaceStyle.backgroundOpacity, 100, 0, 100);
  }
  if (Array.isArray(raw.fontRules)) {
    state.fontRules = raw.fontRules.slice(0, 10).map(rule => ({
      id: String(rule && rule.id || fontRuleId()),
      name: String(rule && rule.name || "自定义字体"),
      data: typeof (rule && rule.data) === "string" ? rule.data : "",
      targets: [...new Set((Array.isArray(rule && rule.targets) ? rule.targets : []).filter(key => FONT_TARGETS.some(target => target.key === key)))],
    })).filter(rule => rule.data);
  }
  const claimedFontTargets = new Set();
  for (const rule of state.fontRules) {
    rule.targets = rule.targets.filter(key => {
      if (claimedFontTargets.has(key)) return false;
      claimedFontTargets.add(key); return true;
    });
  }
  if (Array.isArray(raw.colorRules)) {
    state.colorRules = raw.colorRules.slice(0, 10).map(rule => ({
      id: String(rule && rule.id || colorRuleId()),
      color: /^#[0-9a-f]{6}$/i.test(String(rule && rule.color || "")) ? String(rule.color).toLowerCase() : "#8f76b8",
      targets: [...new Set((Array.isArray(rule && rule.targets) ? rule.targets : []).filter(key => COLOR_TARGETS.some(target => target.key === key)))],
    }));
  }
  const claimedTargets = new Set();
  for (const rule of state.colorRules) {
    rule.targets = rule.targets.filter(key => {
      if (claimedTargets.has(key)) return false;
      claimedTargets.add(key);
      return true;
    });
  }
  for (const def of REGION_DEFS) {
    const source = raw.regions && raw.regions[def.key];
    if (!source || typeof source !== "object") continue;
    const region = state.regions[def.key];
    region.enabled = source.enabled !== false;
    region.image = typeof source.image === "string" ? source.image : "";
    region.fileName = typeof source.fileName === "string" ? source.fileName : "";
    region.scale = clamp(source.scale, 1, 0.1, 3);
    region.blur = clamp(source.blur, 0, 0, 30);
    region.positionX = clamp(source.positionX, 50, 0, 100);
    region.positionY = clamp(source.positionY, 50, 0, 100);
    if (def.targets) {
      const allowed = def.targets.map(([key]) => key);
      const sourceTargets = source.applyTargets;
      if (Array.isArray(sourceTargets)) region.applyTargets = [...new Set(sourceTargets.filter(key => allowed.includes(key)))];
    }
    region.opacity = clamp(source.opacity, 1, 0.05, 1);
    region.overflowY = clamp(Math.abs(Number(source.overflowY)), 0, 0, 300);
    if (def.key === "bottomBar" && source.targetSettings && typeof source.targetSettings === "object") {
      for (const key of ["inputBar", "tabBar"]) {
        const sourceSettings = source.targetSettings[key];
        if (!sourceSettings || typeof sourceSettings !== "object") continue;
        const settings = region.targetSettings[key];
        settings.scale = clamp(sourceSettings.scale, 1, 0.1, 3);
        settings.blur = clamp(sourceSettings.blur, 0, 0, 30);
        settings.positionX = clamp(sourceSettings.positionX, 50, 0, 100);
        settings.positionY = clamp(sourceSettings.positionY, 50, 0, 100);
        settings.overflowY = clamp(sourceSettings.overflowY, 0, 0, 300);
      }
    }
  }
  const inputRegion = state.regions.inputField;
  inputRegion.enabled = true;
  inputRegion.applyTargets = [...state.inputStyle.applyTargets];
  if (raw.themes && typeof raw.themes === "object") {
    for (const [rawId, value] of Object.entries(raw.themes)) {
      const id = String(value && value.id || rawId || themeId());
      const snapshot = value && value.snapshot;
      if (!id || !snapshot || typeof snapshot !== "object") continue;
      const normalized = normalizeState({ ...snapshot, themes: {} });
      state.themes[id] = {
        id,
        name: String(value.name || "未命名主题"),
        snapshot: themeSnapshot(normalized),
      };
    }
  }
  return state;
}

function cssUrl(value) {
  return `url("${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, "")}")`;
}

function blurImageDataUrl(source, blur) {
  return new Promise(resolve => {
    if (!source || blur <= 0) { resolve(source); return; }
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, image.naturalWidth || image.width);
        canvas.height = Math.max(1, image.naturalHeight || image.height);
        const context = canvas.getContext("2d");
        if (!context) { resolve(source); return; }
        const padding = Math.ceil(blur * 2);
        context.filter = `blur(${blur}px)`;
        context.drawImage(image, -padding, -padding, canvas.width + padding * 2, canvas.height + padding * 2);
        resolve(canvas.toDataURL("image/png"));
      } catch (_) { resolve(source); }
    };
    image.onerror = () => resolve(source);
    image.src = source;
  });
}

function imageSizeCss(def, scale) {
  const percent = Math.round(scale * 10000) / 100;
  return def.key === "appBackground" ? `auto ${percent}%` : `${percent}% auto`;
}

function colorWithOpacity(hex, opacity) {
  const matched = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!matched) return hex;
  const alpha = clamp(opacity, 100, 0, 100) / 100;
  return `rgba(${parseInt(matched[1], 16)},${parseInt(matched[2], 16)},${parseInt(matched[3], 16)},${alpha})`;
}

function fontFamilyName(id) {
  return "FISFont_" + String(id).replace(/[^a-z0-9_-]/gi, "_");
}

const BASE_CSS = `
.fis-settings{margin-top:10px;padding:12px;border:1px solid rgba(120,140,165,.24);border-radius:13px;color:var(--c-text-title,#334155)}
.fis-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px}.fis-head .fis-toolbar{margin-left:auto}.fis-page-tabs{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.fis-settings .fis-page-tab{min-height:34px;padding:7px 13px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#52677f;font-size:12px;line-height:1.2;cursor:pointer}.fis-settings .fis-page-tab.active{border-color:#6f8fb5;background:#6f8fb5;color:#fff}
.fis-toolbar{display:flex!important;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin:0}.fis-settings .fis-btn{display:inline-flex!important;align-items:center;justify-content:center;visibility:visible!important;min-height:34px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#52677f;font-size:12px;line-height:1.2;cursor:pointer;opacity:1!important}.fis-settings .fis-btn.primary{background:#6f8fb5!important;border-color:#6f8fb5!important;color:#fff!important}.fis-settings .fis-btn.danger{color:#b42318}.fis-settings .fis-btn:disabled{opacity:.45!important}.fis-settings input[type="file"][hidden]{display:none!important}.fis-settings .fis-icon-btn{display:grid!important;place-items:center;width:36px;height:36px;min-height:36px;padding:0;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#52677f;cursor:pointer}.fis-settings .fis-icon-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.fis-settings .fis-icon-btn.primary{background:#6f8fb5;border-color:#6f8fb5;color:#fff}.fis-settings .fis-icon-btn.danger{color:#b42318}
.fis-region{margin:8px 0;border:1px solid rgba(120,140,165,.2);border-radius:11px;background:rgba(255,255,255,.82);overflow:hidden}.fis-region-summary{display:grid;grid-template-columns:22px 42px minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px}.fis-region-enabled{width:18px;height:18px}.fis-thumb{width:42px;height:42px;border-radius:8px;background-color:#eef2f6;background-position:center;background-size:cover;background-repeat:no-repeat;border:1px solid rgba(120,140,165,.18)}.fis-region-name{font-size:13px;font-weight:650}.fis-region-hint{margin-top:2px;font-size:10px;color:#8a98a9}.fis-region-actions,.fis-color-head-actions{display:flex!important;visibility:visible!important;align-items:center;gap:6px}.fis-region-actions .fis-btn{min-height:32px;padding:6px 9px}
.fis-panel{display:block;padding:10px;border-top:1px solid #e7ebf0}.fis-row{display:grid;grid-template-columns:74px minmax(0,1fr);align-items:center;gap:8px;margin:8px 0}.fis-label{font-size:11px;color:#68788d}.fis-file-row{display:flex;align-items:center;gap:7px;min-width:0}.fis-file-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#68788d}.fis-select,.fis-number{width:100%;min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;padding:6px 8px;font-size:12px}.fis-range-pair{display:grid;grid-template-columns:minmax(0,1fr) 58px;gap:7px;align-items:center}.fis-range{width:100%;height:4px;margin:8px 0;border:0;border-radius:999px;outline:0;appearance:none;-webkit-appearance:none;accent-color:#6f8fb5;background:linear-gradient(to right,#6f8fb5 0 var(--fis-range-progress,50%),#d7e0ea var(--fis-range-progress,50%) 100%)!important}.fis-range::-webkit-slider-runnable-track{height:4px;border:0;border-radius:999px;background:transparent}.fis-range::-webkit-slider-thumb{width:16px;height:16px;margin-top:-6px;border:2px solid #fff;border-radius:50%;background:#6f8fb5;box-shadow:0 1px 4px rgba(50,75,105,.28);appearance:none;-webkit-appearance:none}.fis-range::-moz-range-track{height:4px;border:0;border-radius:999px;background:#d7e0ea}.fis-range::-moz-range-progress{height:4px;border-radius:999px;background:#6f8fb5}.fis-range::-moz-range-thumb{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#6f8fb5;box-shadow:0 1px 4px rgba(50,75,105,.28)}.fis-empty{padding:13px 4px;text-align:center;color:#8a98a9;font-size:11px}.fis-input-targets{display:flex;align-items:center;gap:7px 12px;flex-wrap:wrap;padding:7px 9px;border:1px solid #d7e0ea;border-radius:8px;background:#fff}.fis-input-target{display:flex;align-items:center;gap:5px;font-size:11px;color:#607086;white-space:nowrap}
.fis-input-style-card{padding:10px;border:1px solid rgba(120,140,165,.2);border-radius:11px;background:rgba(255,255,255,.82)}.fis-input-style-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.fis-input-style-body.disabled{opacity:.55}.fis-color-pair{display:grid;grid-template-columns:42px minmax(0,1fr);gap:7px;align-items:center}.fis-color-pair input[type=color]{width:42px;height:34px;padding:2px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.fis-color-pair .fis-number{text-transform:uppercase}
.fis-theme-list{display:flex;flex-direction:column;gap:8px}.fis-theme-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px;border:1px solid rgba(120,140,165,.2);border-radius:11px;background:rgba(255,255,255,.82)}.fis-theme-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:650}.fis-theme-hint{margin-top:2px;color:#8a98a9;font-size:10px}.fis-theme-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:560px){.fis-theme-card{grid-template-columns:1fr}.fis-theme-actions{justify-content:flex-start}}
.fis-subtab-bar{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;min-width:0;border-bottom:1px solid rgba(120,140,165,.24)}.fis-subtab-strip{display:flex;align-items:flex-end;gap:6px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}.fis-subtab-strip::-webkit-scrollbar{display:none}.fis-subtab-switch{display:flex;align-items:center;justify-content:center;flex:0 0 auto;height:48px;padding:0 5px 8px}.fis-switch{position:relative;display:inline-flex;width:46px;height:26px;cursor:pointer}.fis-switch input{position:absolute;width:1px;height:1px;opacity:0}.fis-switch-track{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;transition:background .18s}.fis-switch-track::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(43,58,78,.24);transition:transform .18s}.fis-switch input:checked+.fis-switch-track{background:#6f8fb5}.fis-switch input:checked+.fis-switch-track::after{transform:translateX(20px)}.fis-color-workspace.disabled>.fis-color-panel,.fis-color-workspace.disabled>.fis-color-actions{opacity:.55}.fis-color-tabs{flex-wrap:wrap;overflow:visible}.fis-color-tab{position:relative;display:grid;place-items:center;flex:0 0 42px;width:42px;height:44px;padding:4px 4px 0;border:1px solid transparent;border-bottom:0;border-radius:10px 10px 0 0;background:transparent;cursor:pointer}.fis-color-tab.active{z-index:1;border-color:rgba(120,140,165,.24);background:rgba(255,255,255,.9);margin-bottom:-1px}.fis-color-heart{font-size:28px;line-height:1;color:var(--fis-heart-color);text-shadow:0 1px 1px rgba(45,55,72,.08)}.fis-color-tab-mark{display:none;position:absolute;right:1px;top:2px;width:15px;height:15px;align-items:center;justify-content:center;border:1px solid #b8c4d1;border-radius:50%;background:#fff;color:#fff;font-size:9px}.fis-color-tabs.delete-mode .fis-color-tab-mark{display:inline-flex}.fis-color-tab.selected .fis-color-tab-mark{border-color:#b42318;background:#b42318}.fis-color-tab.selected{background:rgba(180,35,24,.05)}.fis-color-panel{padding:14px;border:1px solid rgba(120,140,165,.24);border-top:0;border-radius:0 0 11px 11px;background:rgba(255,255,255,.82)}.fis-color-actions{display:flex;align-items:center;justify-content:center;gap:7px;padding-top:9px}.fis-inline-color-editor{display:grid;grid-template-columns:38px minmax(90px,150px);align-items:center;gap:8px;margin-bottom:7px}.fis-inline-color-editor input[type=color]{width:38px;height:34px;padding:2px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.fis-inline-color-editor input[type=text]{width:100%;min-height:34px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#52677f;font-size:11px;text-transform:uppercase}.fis-target-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 8px}.fis-target-option{display:flex;align-items:center;gap:5px;min-width:0;padding:4px 2px;font-size:11px;color:#607086}.fis-target-option span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fis-image-workspace.disabled>.fis-region{opacity:.55}.fis-image-tab{flex:0 0 auto;min-height:40px;padding:8px 14px;border:1px solid transparent;border-bottom:0;border-radius:11px 11px 0 0;background:transparent;color:#607086;font-size:12px;cursor:pointer}.fis-image-tab.active{z-index:1;border-color:rgba(120,140,165,.24);background:rgba(255,255,255,.9);margin-bottom:-1px;color:#42566f}.fis-image-workspace>.fis-region{margin:0;border-top:0;border-radius:0 0 11px 11px}
.fis-font-tabs{flex-wrap:wrap;overflow:visible}.fis-font-tab{display:block;max-width:120px;min-height:40px;padding:8px 12px;border:1px solid transparent;border-bottom:0;border-radius:10px 10px 0 0;background:transparent;color:#607086;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.fis-font-tab.active{z-index:1;margin-bottom:-1px;border-color:rgba(120,140,165,.24);background:rgba(255,255,255,.9);color:#42566f}
.fis-interface-workspace>.fis-subtab-bar{padding:0;border:0;border-bottom:1px solid rgba(120,140,165,.24);border-radius:0;background:transparent}.fis-interface-workspace>.fis-input-style-card{padding-top:10px;padding-bottom:10px;border-top:0;border-radius:0 0 11px 11px}.fis-interface-workspace>.fis-input-style-card>.fis-row:first-child{margin-top:0}.fis-interface-workspace>.fis-input-style-card>.fis-input-feature:first-child{margin-top:0}.fis-interface-workspace .fis-card-feature{border:0;border-radius:0;background:transparent}
.fis-settings-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px 4px;color:var(--c-text-title,#334155)}.fis-library-title{font-size:14px;font-weight:700;color:#42566f}.fis-library-toggle-label{font-size:12px;color:#5f536c;white-space:nowrap}.fis-floating-button{position:fixed;right:18px;bottom:86px;z-index:2147483000;display:grid;place-items:center;width:48px;height:48px;padding:0;border:1px solid rgba(108,132,162,.24);border-radius:50%;background:#6f8fb5;color:#fff;box-shadow:0 6px 20px rgba(54,74,101,.28);cursor:pointer}.fis-floating-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.fis-floating-button[hidden],.fis-floating-panel[hidden]{display:none!important}.fis-floating-panel{position:fixed;right:14px;bottom:144px;z-index:2147482999;width:min(540px,calc(100vw - 28px));max-height:min(74vh,720px);margin:0;padding:10px;overflow:auto;overscroll-behavior:contain;border:1px solid rgba(108,132,162,.28);border-radius:15px;background:rgba(250,252,255,.96);box-shadow:0 14px 42px rgba(42,57,78,.3);backdrop-filter:blur(16px)}.fis-floating-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.fis-floating-head .fis-page-tabs{min-width:0;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}.fis-floating-head .fis-page-tabs::-webkit-scrollbar{display:none}.fis-floating-close{flex:0 0 auto;width:34px;height:34px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#607086;font-size:20px;line-height:1;cursor:pointer}.fis-floating-body{min-width:0}.fis-input-feature{margin-top:10px;border:1px solid rgba(120,140,165,.2);border-radius:10px;background:rgba(255,255,255,.62);overflow:hidden}.fis-input-feature-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px}.fis-input-feature-body{padding:2px 10px 8px;border-top:1px solid #e7ebf0}.fis-input-feature-body.disabled{opacity:.5}.fis-input-image-pick{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 0}.fis-input-image-pick .fis-region-actions{justify-content:flex-end}@media(max-width:560px){.fis-floating-button{right:14px;bottom:78px;width:46px;height:46px}.fis-floating-panel{left:10px;right:10px;bottom:134px;width:auto;max-height:calc(100dvh - 155px)}.fis-subtab-bar{gap:6px}.fis-subtab-switch{padding-left:2px;padding-right:2px}.fis-target-options{grid-template-columns:repeat(2,minmax(0,1fr))}.fis-input-image-pick{grid-template-columns:42px minmax(0,1fr)}.fis-input-image-pick .fis-region-actions{grid-column:1/-1;justify-content:flex-end}}
.fis-library-title{font-size:14px;font-weight:700;color:#42566f}.fis-library-controls{display:flex;align-items:center;gap:8px}.fis-library-toggle-label{font-size:11px;color:#68788d;white-space:nowrap}.fis-floating-button{position:fixed;right:18px;bottom:86px;z-index:2147483000;display:grid;place-items:center;width:48px;height:48px;padding:0;border:1px solid rgba(108,132,162,.24);border-radius:50%;background:#6f8fb5;color:#fff;box-shadow:0 6px 20px rgba(54,74,101,.28);cursor:pointer}.fis-floating-button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.fis-floating-button[hidden],.fis-floating-panel[hidden]{display:none!important}.fis-floating-panel{position:fixed;right:14px;bottom:144px;z-index:2147482999;width:min(540px,calc(100vw - 28px));max-height:min(74vh,720px);margin:0;padding:10px;overflow:auto;overscroll-behavior:contain;border:1px solid rgba(108,132,162,.28);border-radius:15px;background:rgba(250,252,255,.96);box-shadow:0 14px 42px rgba(42,57,78,.3);backdrop-filter:blur(16px)}.fis-floating-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.fis-floating-head .fis-page-tabs{min-width:0;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none}.fis-floating-head .fis-page-tabs::-webkit-scrollbar{display:none}.fis-floating-head-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.fis-floating-close{flex:0 0 auto;width:34px;height:34px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#607086;font-size:20px;line-height:1;cursor:pointer}.fis-floating-body{min-width:0}.fis-input-feature{margin-top:10px;border:1px solid rgba(120,140,165,.2);border-radius:10px;background:rgba(255,255,255,.62);overflow:hidden}.fis-input-feature-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px}.fis-input-feature-body{padding:2px 10px 8px;border-top:1px solid #e7ebf0}.fis-input-feature-body.disabled{opacity:.5}.fis-input-image-pick{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px 0}.fis-input-image-pick .fis-region-actions{justify-content:flex-end}@media(max-width:560px){.fis-floating-button{right:14px;bottom:78px;width:46px;height:46px}.fis-floating-panel{left:10px;right:10px;bottom:134px;width:auto;max-height:calc(100dvh - 155px)}.fis-subtab-bar{gap:6px}.fis-subtab-switch{padding-left:2px;padding-right:2px}.fis-target-options{grid-template-columns:repeat(2,minmax(0,1fr))}.fis-input-image-pick{grid-template-columns:42px minmax(0,1fr)}.fis-input-image-pick .fis-region-actions{grid-column:1/-1;justify-content:flex-end}}

/* 贴边侧栏与半透明毛玻璃设置面板 */
.fis-floating-button{right:0!important;top:38vh;bottom:auto!important;width:24px!important;height:64px!important;min-height:64px;padding:0!important;border:1px solid rgba(255,255,255,.55)!important;border-right:0!important;border-radius:12px 0 0 12px!important;background:linear-gradient(180deg,rgba(184,162,216,.78),rgba(145,119,184,.74))!important;box-shadow:-3px 5px 16px rgba(83,62,112,.24)!important;backdrop-filter:blur(12px) saturate(1.14);-webkit-backdrop-filter:blur(12px) saturate(1.14);cursor:grab;touch-action:none;user-select:none}
.fis-floating-button:active{cursor:grabbing}.fis-floating-button svg{width:15px!important;height:15px!important}
.fis-floating-panel{right:32px!important;top:38vh;bottom:auto;width:min(540px,calc(100vw - 44px))!important;max-height:min(78vh,720px);margin:0!important;padding:0!important;display:grid;grid-template-columns:118px minmax(0,1fr);grid-template-rows:minmax(0,1fr);overflow:hidden!important;border:1px solid rgba(194,175,214,.6)!important;border-radius:16px!important;background:rgba(247,242,251,.78)!important;box-shadow:0 16px 44px rgba(72,53,93,.24),inset 0 1px 0 rgba(255,255,255,.75)!important;backdrop-filter:blur(22px) saturate(1.16)!important;-webkit-backdrop-filter:blur(22px) saturate(1.16)!important}
.fis-floating-panel[hidden]{display:none!important}
.fis-floating-head{grid-column:1;grid-row:1;min-width:0;height:100%;box-sizing:border-box;margin:0!important;padding:11px 9px;display:flex;flex-direction:column;align-items:stretch;gap:10px;border-right:1px solid rgba(183,163,205,.38);background:linear-gradient(160deg,rgba(235,225,245,.74),rgba(217,201,234,.58))}
.fis-floating-head .fis-page-tabs{display:flex;flex:0 0 auto;flex-direction:column;align-items:stretch;gap:6px;overflow:visible!important}
.fis-floating-head .fis-page-tab{width:100%;min-height:38px!important;padding:8px 9px!important;border:1px solid transparent!important;border-radius:10px!important;background:rgba(255,255,255,.4)!important;color:#665775!important;text-align:left;white-space:normal}
.fis-floating-head .fis-page-tab.active{border-color:rgba(144,116,176,.5)!important;background:linear-gradient(135deg,rgba(170,145,201,.92),rgba(139,111,174,.9))!important;color:#fff!important;box-shadow:0 4px 12px rgba(105,78,137,.2)}
.fis-floating-head-actions{margin-top:auto;display:flex;justify-content:space-between;gap:6px}.fis-floating-head-actions .fis-icon-btn,.fis-floating-close{width:38px!important;height:34px!important;min-height:34px!important;background:rgba(255,255,255,.6)!important;border-color:rgba(182,162,204,.48)!important;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.fis-floating-body{grid-column:2;grid-row:1;min-width:0;overflow:auto;overscroll-behavior:contain;padding:12px}
.fis-floating-panel :is(.fis-region,.fis-input-style-card,.fis-color-panel,.fis-theme-card){background:rgba(255,255,255,.5)!important;border-color:rgba(182,161,203,.36)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.6);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
.fis-floating-panel :is(.fis-input-targets,.fis-select,.fis-number,.fis-color-pair input,.fis-inline-color-editor input){background:rgba(255,255,255,.69)!important;border-color:rgba(184,164,204,.43)!important}
.fis-floating-panel .fis-subtab-bar{border-bottom-color:rgba(172,149,196,.36)}
.fis-floating-panel .fis-image-tab.active,.fis-floating-panel .fis-font-tab.active,.fis-floating-panel .fis-color-tab.active{background:rgba(255,255,255,.67)!important;border-color:rgba(178,156,200,.4)!important}
.fis-floating-panel :is(input[type=checkbox],input[type=radio]){accent-color:#9b78ba}.fis-floating-panel .fis-switch input:checked+.fis-switch-track{background:#a17fc0}.fis-floating-panel .fis-range{accent-color:#9b78ba;background:linear-gradient(to right,#a17fc0 0 var(--fis-range-progress,50%),rgba(211,199,223,.82) var(--fis-range-progress,50%) 100%)!important}.fis-floating-panel .fis-range::-webkit-slider-thumb,.fis-floating-panel .fis-range::-moz-range-thumb{background:#9b78ba}.fis-floating-panel .fis-btn.primary,.fis-floating-panel .fis-icon-btn.primary{background:#9b78ba!important;border-color:#9b78ba!important;color:#fff!important}
.fis-settings .fis-page-tab.active,.fis-settings .fis-btn.primary,.fis-settings .fis-icon-btn.primary,.fis-floating-panel .fis-btn.primary,.fis-floating-panel .fis-icon-btn.primary{background:#a17fc0!important;border-color:#a17fc0!important;color:#fff!important}.fis-settings .fis-switch input:checked+.fis-switch-track,.fis-settings-toggle-row .fis-switch input:checked+.fis-switch-track,.fis-dialog-actions .fis-btn.primary{background:#a17fc0!important;border-color:#a17fc0!important}
@media(max-width:560px){.fis-floating-button{right:0!important;width:22px!important;height:58px!important;min-height:58px}.fis-floating-panel{left:auto!important;right:28px!important;bottom:auto;width:calc(100vw - 40px)!important;grid-template-columns:96px minmax(0,1fr);max-height:78vh}.fis-floating-head{padding:9px 7px}.fis-floating-head .fis-page-tab{padding:7px 6px!important;font-size:11px!important}.fis-floating-body{padding:9px}.fis-floating-head-actions .fis-icon-btn,.fis-floating-close{width:34px!important}}

.fis-dialog-overlay{position:fixed;inset:0;z-index:2147483005;display:grid;place-items:center;padding:18px;background:rgba(30,41,59,.22);backdrop-filter:blur(3px)}.fis-dialog-card{width:min(360px,calc(100vw - 36px));padding:16px;border:1px solid rgba(108,132,162,.28);border-radius:14px;background:rgba(248,252,255,.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#334155;box-shadow:0 16px 46px rgba(42,57,78,.3)}.fis-dialog-title{font-size:15px;font-weight:700}.fis-dialog-message{margin-top:7px;color:#68788d;font-size:12px;line-height:1.55}.fis-dialog-input{box-sizing:border-box;width:100%;min-height:38px;margin-top:12px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;background:rgba(255,255,255,.72);color:#334155;font-size:13px;outline:none}.fis-dialog-input:focus{border-color:#6f8fb5;box-shadow:0 0 0 3px rgba(111,143,181,.14)}.fis-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.fis-dialog-actions .fis-btn{display:inline-flex!important;align-items:center;justify-content:center;min-height:34px;padding:7px 13px;border:1px solid #cbd5e1;border-radius:9px;background:rgba(255,255,255,.7);color:#52677f;font-size:12px;cursor:pointer}.fis-dialog-actions .fis-btn.primary{border-color:#6f8fb5;background:#6f8fb5;color:#fff}.fis-dialog-actions .fis-btn.danger{border-color:#d92d20;background:#d92d20;color:#fff}

/* 按钮与胶囊使用独立样式，不再占用主题配色规则。 */
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .ui-btn-primary,
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .ui-btn-action,
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .chat-list-tab.active,
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .minimal-unread-count,
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app [class~="bg-[var(--c-action-blue,#246bfd)]"]{background:var(--fis-button-accent-background)!important;border:var(--fis-button-border-width) solid var(--fis-button-border-color)!important;border-radius:var(--fis-button-radius)!important}
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .ui-btn-primary,
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .ui-btn-action{box-shadow:0 4px 14px color-mix(in srgb,var(--fis-button-accent-background) 35%,transparent)!important}
html[data-fis-view-scope="1"][data-fis-button-accent="1"] .chat-app .ui-btn-ghost{color:var(--fis-button-accent-background)!important;border-radius:var(--fis-button-radius)!important}

/* 主页与设置页的大块菜单卡片，排除按钮、输入框和浮动窗口。 */
html[data-fis-view-scope="1"][data-fis-interface-cards="1"] .chat-app:not([data-room-active]) [class~="mx-4"][class~="rounded-2xl"][class~="bg-[var(--c-card)]"]{background:var(--fis-interface-background)!important;border:var(--fis-interface-border-width) solid var(--fis-interface-border-color)!important;border-radius:var(--fis-interface-radius)!important;overflow:hidden}

html[data-fis-view-scope="1"][data-fis-font-title="1"] .chat-app:not([data-room-active]) :is(.page-title,.settings-menu-section-title,.appearance-menu-section-title,.card-section-label,.menu-label,.feed-post-author-name,.feed-comment-author,.feed-comment-reply-target,[class~="text-[var(--c-text-title)]"]),
html[data-fis-view-scope="1"][data-fis-font-title="1"] .chat-app .chat-room-wrapper .page-header .page-title{font-family:var(--fis-font-title),sans-serif!important}
html[data-fis-view-scope="1"][data-fis-font-text="1"] .chat-app:not([data-room-active]) :is(.menu-desc,.feed-profile-signature,.feed-profile-signature-text,.feed-post-content,.feed-post-location,.feed-like-summary,.feed-comment-body,[class~="text-[var(--c-text)]"]),
html[data-fis-view-scope="1"][data-fis-font-text="1"] .chat-app :is(.feed-profile-signature,.feed-profile-signature-text,.feed-post-content,.feed-post-location,.feed-like-summary,.feed-comment-body){font-family:var(--fis-font-text),sans-serif!important}
html[data-fis-view-scope="1"][data-fis-font-meta-text="1"] .chat-app:not([data-room-active]) :is(.ts-10,.ts-11,.feed-post-time,.feed-comment-meta,.feed-inline-translation,.contact-letter-header,.minimal-list-item [class~="text-[var(--c-icon)]"]){font-family:var(--fis-font-meta-text),sans-serif!important}
html[data-fis-view-scope="1"][data-fis-font-button="1"] .chat-app:not([data-room-active]) :is(.ui-btn-primary,.ui-btn-primary *,.ui-btn-action,.ui-btn-action *,.ui-btn-ghost,.ui-btn-ghost *,.chat-list-tab,.chat-list-tab *,.minimal-unread-count){font-family:var(--fis-font-button),sans-serif!important}
html[data-fis-view-scope="1"][data-fis-font-input="1"] .chat-app :is(input,textarea,select):not(.font-mono),
html[data-fis-view-scope="1"][data-fis-font-input="1"] .chat-app .chat-search-input,
html[data-fis-view-scope="1"][data-fis-font-input="1"] .chat-app .chat-search-input::placeholder{font-family:var(--fis-font-input),sans-serif!important}

/* 文字不再覆盖 Float 的全局变量：按界面语义精确着色，避免污染弹窗、气泡与富媒体小组件。 */
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .page-title,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .settings-menu-section-title,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .appearance-menu-section-title,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .card-section-label,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .menu-label,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) [class~="text-[var(--c-text-title)]"],
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .contact-letter-header,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .contact-alpha-letter,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app .chat-room-wrapper .page-title{color:var(--fis-color-title)!important}

html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .menu-desc,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) [class~="text-[var(--c-text)]"],
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .chat-search-input,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .chat-search-input::placeholder,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .feed-profile-signature,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .feed-post-content,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .feed-post-location,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .feed-like-summary,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app:not([data-room-active]) .feed-comment-body{color:var(--fis-color-text)!important}

/* 动态页的独有语义不依赖会话状态，避免 Float 保留旧会话时漏改。 */
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-profile-signature,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-profile-signature-text,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-profile-signature-input,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-post-content,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-post-location,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-like-summary,
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .feed-comment-body{color:var(--fis-color-text)!important}

html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .feed-post-author-name,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .feed-comment-author,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .feed-comment-reply-target,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .feed-profile-stats,
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app:not([data-room-active]) .feed-profile-stat-value{color:var(--fis-color-title)!important}

html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app:not([data-room-active]) .minimal-list-item [class~="text-[var(--c-icon)]"],
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app:not([data-room-active]) .page-header .ts-10,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .chat-room-wrapper .page-header .ts-10,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .feed-post-time,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app:not([data-room-active]) .feed-comment-meta,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .chat-bilingual-toggle,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .chat-bilingual-section-translation,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .chat-bilingual-section-translation .chat-markdown,
html[data-fis-view-scope="1"][data-fis-color-meta-text="1"] .chat-app .feed-inline-translation{color:var(--fis-color-meta-text)!important}

/* 普通图标只处理明确的图标容器，不再借 --c-icon 影响时间、分类和说明文字。 */
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .page-back-btn,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .page-header-right button,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .menu-icon,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .menu-right svg,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .chat-search-bar>svg,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .feed-profile-avatar-fallback,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .user-profile-page-root .lucide-user,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .feed-post-more-btn,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .feed-like-summary-icon,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .feed-comment-icon-button,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-tab:not(.chat-tab-active),
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-tab:not(.chat-tab-active)>span{color:var(--fis-color-icon)!important}
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .menu-icon svg,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .menu-right svg,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app:not([data-room-active]) .chat-search-bar>svg{color:var(--fis-color-icon)!important;stroke:var(--fis-color-icon)!important}
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .feed-post-actions button,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .feed-post-actions button svg,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .user-profile-page-root .lucide-user,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .user-profile-page-root svg[class~="text-[var(--c-icon)]"]{color:var(--fis-color-icon)!important;stroke:var(--fis-color-icon)!important}

html[data-fis-view-scope="1"][data-fis-color-active-icon="1"] .chat-app .chat-tab-active{color:var(--fis-color-active-icon)!important}

/* 聊天输入区的线性工具图标统一归入普通图标。 */
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-input-actions .ui-bare-btn,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-plus-menu-item:not([data-active]) .chat-plus-icon-box,
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-plus-menu-item:not([data-active])>span{color:var(--fis-color-icon)!important}
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-plus-menu-item:not([data-active]) .chat-plus-icon-box svg{color:var(--fis-color-icon)!important;stroke:var(--fis-color-icon)!important}
html[data-fis-view-scope="1"][data-fis-color-icon="1"] .chat-app .chat-plus-menu-item:not([data-active]) .chat-plus-icon-box svg text{fill:var(--fis-color-icon)!important;stroke:none!important}
html[data-fis-view-scope="1"][data-fis-color-active-icon="1"] .chat-app .chat-plus-menu-item[data-active] .chat-plus-icon-box{color:var(--fis-color-active-icon)!important}
html[data-fis-view-scope="1"][data-fis-color-active-icon="1"] .chat-app .chat-plus-menu-item[data-active] .chat-plus-icon-box svg{color:var(--fis-color-active-icon)!important;stroke:var(--fis-color-active-icon)!important}

/* 浮动窗口保留 Float 自己的文字体系。 */
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) .menu-label,
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) [class~="text-[var(--c-text-title)]"]{color:var(--c-text-title)!important}
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) .menu-desc,
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) [class~="text-[var(--c-text)]"]{color:var(--c-text)!important}
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) [class~="text-[var(--c-icon)]"]{color:var(--c-icon)!important}
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) :is(.ui-btn-primary,.ui-btn-action){background:var(--c-icon-active)!important;box-shadow:0 4px 14px color-mix(in srgb,var(--c-icon-active) 35%,transparent)!important}
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app :is([data-ui="modal"],.modal-overlay) .ui-btn-ghost{color:var(--c-icon-active)!important}
html[data-fis-view-scope="1"][data-fis-input-color-chat="1"] .chat-app .chat-room-wrapper .chat-input-textarea{background:var(--fis-input-background-color)!important}
html[data-fis-view-scope="1"][data-fis-input-color-search="1"] .chat-app .chat-search-bar{background:var(--fis-input-background-color)!important}
html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .ui-input:not(.ui-input-inline):not(.font-mono),html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .ui-textarea:not(.ui-input-inline):not(.font-mono),html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .ui-select:not(.font-mono){background:var(--fis-input-background-color)!important}
html[data-fis-view-scope="1"][data-fis-button-capsule="1"] .chat-app .chat-list-tab:not(.active){background:var(--fis-button-capsule-background)!important;border:var(--fis-button-border-width) solid var(--fis-button-border-color)!important;border-radius:var(--fis-button-radius)!important}
html[data-fis-view-scope="1"][data-fis-color-text="1"] .chat-app .chat-list-tab:not(.active){color:var(--fis-color-text)!important}
html[data-fis-view-scope="1"][data-fis-color-title="1"] .chat-app .chat-list-tab.active{color:var(--fis-color-title)!important}

/* 背景按页面根节点独立绘制，不再依赖可能被缓存页面误导的全局 activeView。 */
html[data-fis-app-background="1"][data-fis-background-target-chat-room="1"] .chat-app .chat-room-wrapper,
html[data-fis-app-background="1"][data-fis-background-target-messages="1"] .chat-app .page-shell:has(.chat-list-tabs),
html[data-fis-app-background="1"][data-fis-background-target-contacts="1"] .chat-app .page-shell:has(input[placeholder='Search contacts...'],.contacts-page-root),
html[data-fis-app-background="1"][data-fis-background-target-feeds="1"] .chat-app .page-shell:has(.feed-cover-shell),
html[data-fis-app-background="1"][data-fis-background-target-me="1"] .chat-app .user-profile-page-root{background-color:transparent!important;background-image:var(--fis-app-background-image)!important;background-size:var(--fis-app-background-size)!important;background-repeat:var(--fis-app-background-repeat)!important;background-position:var(--fis-app-background-position)!important}
html[data-fis-app-background="1"][data-fis-background-target-chat-room="1"] .chat-app .chat-room-wrapper :is(.chat-main-content,.page-body),
html[data-fis-app-background="1"][data-fis-background-target-messages="1"] .chat-app .page-shell:has(.chat-list-tabs) :is(.chat-main-content,.page-body),
html[data-fis-app-background="1"][data-fis-background-target-contacts="1"] .chat-app .page-shell:has(input[placeholder='Search contacts...'],.contacts-page-root) :is(.chat-main-content,.page-body),
html[data-fis-app-background="1"][data-fis-background-target-feeds="1"] .chat-app .page-shell:has(.feed-cover-shell) :is(.chat-main-content,.page-body),
html[data-fis-app-background="1"][data-fis-background-target-me="1"] .chat-app .user-profile-page-root :is(.chat-main-content,.page-body){background-color:transparent!important}

html[data-fis-view-scope="1"][data-fis-input-image-chat="1"] .chat-app .chat-room-wrapper .chat-input-textarea,html[data-fis-view-scope="1"][data-fis-input-image-search="1"] .chat-app .chat-search-bar,html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .ui-input:not(.ui-input-inline):not(.font-mono),html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .ui-textarea:not(.ui-input-inline):not(.font-mono),html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .ui-select:not(.font-mono){background-color:transparent!important;background-image:var(--fis-input-field-image)!important;background-size:var(--fis-input-field-size)!important;background-repeat:var(--fis-input-field-repeat)!important;background-position:var(--fis-input-field-position)!important;box-shadow:none}

html[data-fis-view-scope="1"][data-fis-input-style-chat="1"] .chat-app .chat-room-wrapper .chat-input-textarea,
html[data-fis-view-scope="1"][data-fis-input-style-search="1"] .chat-app .chat-search-bar,
html[data-fis-view-scope="1"][data-fis-input-style-form="1"] .chat-app .ui-input:not(.ui-input-inline):not(.font-mono),
html[data-fis-view-scope="1"][data-fis-input-style-form="1"] .chat-app .ui-textarea:not(.ui-input-inline):not(.font-mono),
html[data-fis-view-scope="1"][data-fis-input-style-form="1"] .chat-app .ui-select:not(.font-mono){border:var(--fis-input-border-width) solid var(--fis-input-border-color)!important;border-radius:var(--fis-input-radius)!important}

/* 文字图片、系统指令、红包、转账、位置等富功能弹窗保持 Float 原样。 */
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app .modal-overlay .ui-input:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app .modal-overlay .ui-textarea:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-colors="1"] .chat-app .modal-overlay .ui-select,
html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .modal-overlay .ui-input:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .modal-overlay .ui-textarea:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-input-image-form="1"] .chat-app .modal-overlay .ui-select,
html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .modal-overlay .ui-input:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .modal-overlay .ui-textarea:not(.ui-input-inline),
html[data-fis-view-scope="1"][data-fis-input-color-form="1"] .chat-app .modal-overlay .ui-select{background-color:var(--c-input)!important;background-image:none!important;background-size:auto!important;background-repeat:initial!important;background-position:initial!important;box-shadow:initial}

html[data-fis-view-scope="1"][data-fis-top-target-chat-room="1"] .chat-app .chat-room-wrapper>.page-header,
html[data-fis-view-scope="1"][data-fis-top-target-messages="1"] .chat-app .page-shell:has(.chat-list-tabs)>.page-header,
html[data-fis-view-scope="1"][data-fis-top-target-contacts="1"] .chat-app .page-shell:has(input[placeholder='Search contacts...'])>.page-header,
html[data-fis-view-scope="1"][data-fis-top-target-feeds="1"] .chat-app .page-shell:has(.feed-cover-shell)>.page-header,
html[data-fis-view-scope="1"][data-fis-top-target-me="1"] .chat-app .user-profile-page-root>.page-header,
html[data-fis-view-scope="1"][data-fis-bottom-image-input="1"] .chat-app .chat-room-wrapper .chat-input-bar,
html[data-fis-view-scope="1"][data-fis-bottom-image-tab="1"] .chat-app .chat-tab-bar{isolation:isolate;overflow:visible!important;background:transparent!important;box-shadow:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
html[data-fis-view-scope="1"][data-fis-bottom-image-input="1"] .chat-app .chat-room-wrapper .chat-input-bar,html[data-fis-view-scope="1"][data-fis-bottom-image-tab="1"] .chat-app .chat-tab-bar{border-top:0!important}
html[data-fis-view-scope="1"][data-fis-top-target-chat-room="1"] .chat-app .chat-room-wrapper>.page-header::before,
html[data-fis-view-scope="1"][data-fis-top-target-messages="1"] .chat-app .page-shell:has(.chat-list-tabs)>.page-header::before,
html[data-fis-view-scope="1"][data-fis-top-target-contacts="1"] .chat-app .page-shell:has(input[placeholder='Search contacts...'])>.page-header::before,
html[data-fis-view-scope="1"][data-fis-top-target-feeds="1"] .chat-app .page-shell:has(.feed-cover-shell)>.page-header::before,
html[data-fis-view-scope="1"][data-fis-top-target-me="1"] .chat-app .user-profile-page-root>.page-header::before{content:"";position:absolute;top:calc(-1px * var(--fis-top-bar-over-top,0));right:0;bottom:calc(-1px * var(--fis-top-bar-over-bottom,0));left:0;z-index:-1;pointer-events:none;background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background-image:var(--fis-top-bar-image)!important;background-size:var(--fis-top-bar-size)!important;background-repeat:var(--fis-top-bar-repeat)!important;background-position:var(--fis-top-bar-position)!important}
html[data-fis-view-scope="1"][data-fis-bottom-image-input="1"] .chat-app .chat-room-wrapper .chat-input-bar::before{content:"";position:absolute;top:calc(-1px * var(--fis-bottom-bar-input-over-top,0));right:0;bottom:calc(-1px * var(--fis-bottom-bar-input-over-bottom,0));left:0;z-index:-1;pointer-events:none;background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background-image:var(--fis-bottom-bar-input-image)!important;background-size:var(--fis-bottom-bar-input-size)!important;background-repeat:no-repeat!important;background-position:var(--fis-bottom-bar-input-position)!important}
html[data-fis-view-scope="1"][data-fis-bottom-image-tab="1"] .chat-app .chat-tab-bar::before{content:"";position:absolute;top:calc(-1px * var(--fis-bottom-bar-tab-over-top,0));right:0;bottom:calc(-1px * var(--fis-bottom-bar-tab-over-bottom,0));left:0;z-index:-1;pointer-events:none;background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background-image:var(--fis-bottom-bar-tab-image)!important;background-size:var(--fis-bottom-bar-tab-size)!important;background-repeat:no-repeat!important;background-position:var(--fis-bottom-bar-tab-position)!important}
`;

export default {
  manifest: {
    id: PLUGIN_ID,
    name: "自定义聊天主题",
    apiVersion: 1,
    version: "0.12.23",
    author: "NEEN&GPT",
    description: "用 PNG、主题色、字体、卡片、按钮与输入框设置自定义聊天界面",
  },

  setup(ctx) {
    let state = normalizeState(ctx.system.storage.get(STORAGE_KEY));
    const root = document.documentElement;
    const style = document.createElement("style");
    style.dataset.floatInterfaceSkins = "1";
    const refreshStyleSheet = () => {
      const fontFaces = state.fontRules.map(rule => `\n@font-face{font-family:"${fontFamilyName(rule.id)}";src:${cssUrl(rule.data)};font-display:swap}`).join("");
      style.textContent = BASE_CSS + fontFaces;
    };
    refreshStyleSheet();
    document.head.appendChild(style);
    const refreshers = new Set();
    const blurredImageCache = new Map();
    const blurTimers = new Map();
    const imageObjectUrls = new Map();
    let disposed = false;

    const persist = () => ctx.system.storage.set(STORAGE_KEY, state);
    const attributeName = key => "data-fis-" + key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());

    function imageSourceForCss(source) {
      const value = String(source || "");
      if (!value.startsWith("data:")) return value;
      const cached = imageObjectUrls.get(value);
      if (cached) return cached;
      try {
        const comma = value.indexOf(",");
        if (comma < 0) return value;
        const header = value.slice(5, comma);
        const payload = value.slice(comma + 1);
        const mime = (header.split(";")[0] || "application/octet-stream").trim();
        const bytesText = header.includes(";base64") ? atob(payload) : decodeURIComponent(payload);
        const bytes = new Uint8Array(bytesText.length);
        for (let index = 0; index < bytesText.length; index += 1) bytes[index] = bytesText.charCodeAt(index);
        const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        imageObjectUrls.set(value, objectUrl);
        return objectUrl;
      } catch (_) {
        return value;
      }
    }

    function applyImageSource(cacheKey, source, blur, prefix, isCurrent) {
      const cached = blurredImageCache.get(cacheKey);
      const initialSource = cached && cached.source === source && cached.blur === blur ? cached.result : source;
      root.style.setProperty(prefix + "-image", cssUrl(imageSourceForCss(initialSource)));
      if (!source || blur <= 0 || (cached && cached.source === source && cached.blur === blur)) return;
      if (blurTimers.has(cacheKey)) clearTimeout(blurTimers.get(cacheKey));
      blurTimers.set(cacheKey, setTimeout(async () => {
        blurTimers.delete(cacheKey);
        const result = await blurImageDataUrl(source, blur);
        if (disposed || !isCurrent()) return;
        blurredImageCache.set(cacheKey, { source, blur, result });
        root.style.setProperty(prefix + "-image", cssUrl(imageSourceForCss(result)));
      }, 120));
    }

    function applyRegionImage(def, region, prefix) {
      const source = region.image;
      const blur = region.blur;
      applyImageSource(def.key, source, blur, prefix, () => {
        const current = state.regions[def.key];
        return !!current && current.enabled && current.image === source && current.blur === blur;
      });
    }

    function previewRegionGeometry(def, region, key, customPrefix = "") {
      const prefix = customPrefix || `--fis-${def.key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())}`;
      if (key === "scale") root.style.setProperty(prefix + "-size", imageSizeCss(def, region.scale));
      if (key === "positionX" || key === "positionY") root.style.setProperty(prefix + "-position", `${region.positionX}% ${region.positionY}%`);
      if (key === "overflowY" && def.overflow) {
        root.style.setProperty(prefix + "-over-top", String(region.overflowY));
        root.style.setProperty(prefix + "-over-bottom", String(region.overflowY));
      }
    }

    function previewButtonStyle(buttonStyle, key) {
      if (key === "accentColor") root.style.setProperty("--fis-button-accent-background", colorWithOpacity(buttonStyle.accentColor, buttonStyle.accentOpacity));
      if (key === "capsuleColor") root.style.setProperty("--fis-button-capsule-background", colorWithOpacity(buttonStyle.capsuleColor, buttonStyle.capsuleOpacity));
      if (key === "borderColor") root.style.setProperty("--fis-button-border-color", buttonStyle.borderColor);
      if (key === "accentOpacity") root.style.setProperty("--fis-button-accent-background", colorWithOpacity(buttonStyle.accentColor, buttonStyle.accentOpacity));
      if (key === "capsuleOpacity") root.style.setProperty("--fis-button-capsule-background", colorWithOpacity(buttonStyle.capsuleColor, buttonStyle.capsuleOpacity));
      if (key === "radius") root.style.setProperty("--fis-button-radius", `${buttonStyle.radius}px`);
      if (key === "borderWidth") root.style.setProperty("--fis-button-border-width", buttonStyle.borderless ? "0px" : `${buttonStyle.borderWidth}px`);
    }

    function previewCardStyle(interfaceStyle, key) {
      if (key === "borderColor") root.style.setProperty("--fis-interface-border-color", interfaceStyle.borderColor);
      if (key === "backgroundColor") root.style.setProperty("--fis-interface-background", colorWithOpacity(interfaceStyle.backgroundColor, interfaceStyle.backgroundOpacity));
      if (key === "radius") root.style.setProperty("--fis-interface-radius", `${interfaceStyle.radius}px`);
      if (key === "borderWidth") root.style.setProperty("--fis-interface-border-width", interfaceStyle.borderless ? "0px" : `${interfaceStyle.borderWidth}px`);
      if (key === "backgroundOpacity") root.style.setProperty("--fis-interface-background", colorWithOpacity(interfaceStyle.backgroundColor, interfaceStyle.backgroundOpacity));
    }

    function previewInputStyle(inputStyle, key) {
      if (key === "backgroundColor") root.style.setProperty("--fis-input-background-color", colorWithOpacity(inputStyle.backgroundColor, inputStyle.backgroundOpacity));
      if (key === "borderColor") root.style.setProperty("--fis-input-border-color", inputStyle.borderColor);
      if (key === "backgroundOpacity") root.style.setProperty("--fis-input-background-color", colorWithOpacity(inputStyle.backgroundColor, inputStyle.backgroundOpacity));
      if (key === "radius") root.style.setProperty("--fis-input-radius", `${inputStyle.radius}px`);
      if (key === "borderWidth") root.style.setProperty("--fis-input-border-width", inputStyle.borderless ? "0px" : `${inputStyle.borderWidth}px`);
    }

    function clearApplied() {
      for (const def of REGION_DEFS) root.removeAttribute(attributeName(def.key));
      root.removeAttribute("data-fis-input-image-chat");
      root.removeAttribute("data-fis-input-image-search");
      root.removeAttribute("data-fis-input-image-form");
      root.removeAttribute("data-fis-input-color-chat");
      root.removeAttribute("data-fis-input-color-search");
      root.removeAttribute("data-fis-input-color-form");
      root.removeAttribute("data-fis-top-image-active");
      for (const key of ["messages", "contacts", "feeds", "me", "chat-room"]) root.removeAttribute("data-fis-top-target-" + key);
      root.removeAttribute("data-fis-active-view");
      root.removeAttribute("data-fis-bottom-image-input");
      root.removeAttribute("data-fis-bottom-image-tab");
      root.removeAttribute("data-fis-input-style-chat");
      root.removeAttribute("data-fis-input-style-search");
      root.removeAttribute("data-fis-input-style-form");
      root.removeAttribute("data-fis-colors");
      root.removeAttribute("data-fis-interface-cards");
      for (const target of FONT_TARGETS) root.removeAttribute("data-fis-font-" + target.key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()));
      for (const target of COLOR_TARGETS) {
        root.removeAttribute("data-fis-color-" + target.key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()));
      }
      for (const [key] of BUTTON_STYLE_TARGETS) root.removeAttribute("data-fis-button-" + key);
      root.removeAttribute("data-fis-background-scope");
      for (const key of ["messages", "contacts", "feeds", "me", "chat-room"]) root.removeAttribute("data-fis-background-target-" + key);
      for (const name of [...root.style]) {
        if (name.startsWith("--fis-")) root.style.removeProperty(name);
      }
    }

    function syncThemeScope() {
      const chatApp = document.querySelector(".chat-app");
      const modalOpen = !!document.querySelector(".chat-app .modal-overlay, .chat-app [data-ui='modal'], .chat-app .feed-comment-modal-layer");
      let activeView = "";
      if (chatApp && !modalOpen && !chatApp.hasAttribute("data-tabbar-hidden")) {
        const chatRoom = chatApp.querySelector(".chat-room-wrapper");
        if (chatApp.hasAttribute("data-room-active") && chatRoom) {
          if (!chatRoom.hasAttribute("data-settings-open")) activeView = "chatRoom";
        } else {
          if (chatApp.querySelector(".user-profile-page-root")) activeView = "me";
          else if (chatApp.querySelector(".feed-cover-shell")) activeView = "feeds";
          else if (chatApp.querySelector("input[placeholder='Search contacts...'], .contacts-page-root")) activeView = "contacts";
          else if (chatApp.querySelector(".chat-list-tabs, .messages-page-root")) activeView = "messages";
        }
      }
      if (activeView) {
        root.setAttribute("data-fis-view-scope", "1");
        root.setAttribute("data-fis-active-view", activeView);
      } else {
        root.removeAttribute("data-fis-view-scope");
        root.removeAttribute("data-fis-active-view");
      }
    }

    function apply() {
      clearApplied();
      if (state.colorsEnabled && state.colorRules.some(rule => rule.targets.length)) root.setAttribute("data-fis-colors", "1");
      if (state.colorsEnabled) {
        for (const rule of state.colorRules) {
          for (const key of rule.targets) {
            const suffix = key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
            root.setAttribute("data-fis-color-" + suffix, "1");
            root.style.setProperty("--fis-color-" + suffix, rule.color);
          }
        }
      }
      if (state.buttonStyle.enabled) {
        for (const key of state.buttonStyle.applyTargets) root.setAttribute("data-fis-button-" + key, "1");
        root.style.setProperty("--fis-button-accent-background", colorWithOpacity(state.buttonStyle.accentColor, state.buttonStyle.accentOpacity));
        root.style.setProperty("--fis-button-capsule-background", colorWithOpacity(state.buttonStyle.capsuleColor, state.buttonStyle.capsuleOpacity));
        root.style.setProperty("--fis-button-radius", `${state.buttonStyle.radius}px`);
        root.style.setProperty("--fis-button-border-width", state.buttonStyle.borderless ? "0px" : `${state.buttonStyle.borderWidth}px`);
        root.style.setProperty("--fis-button-border-color", state.buttonStyle.borderColor);
      }
      if (state.interfaceStyle.cardsEnabled) {
        root.setAttribute("data-fis-interface-cards", "1");
        root.style.setProperty("--fis-interface-radius", `${state.interfaceStyle.radius}px`);
        root.style.setProperty("--fis-interface-border-width", state.interfaceStyle.borderless ? "0px" : `${state.interfaceStyle.borderWidth}px`);
        root.style.setProperty("--fis-interface-border-color", state.interfaceStyle.borderColor);
        root.style.setProperty("--fis-interface-background", colorWithOpacity(state.interfaceStyle.backgroundColor, state.interfaceStyle.backgroundOpacity));
      }
      if (state.fontsEnabled) {
        for (const rule of state.fontRules) {
          for (const key of rule.targets) {
            const suffix = key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
            root.setAttribute("data-fis-font-" + suffix, "1");
            root.style.setProperty("--fis-font-" + suffix, `"${fontFamilyName(rule.id)}"`);
          }
        }
      }
      if (state.inputStyle.enabled) {
        if (state.inputStyle.applyTargets.includes("chatInput")) root.setAttribute("data-fis-input-style-chat", "1");
        if (state.inputStyle.applyTargets.includes("searchInput")) root.setAttribute("data-fis-input-style-search", "1");
        if (state.inputStyle.applyTargets.includes("formInput")) root.setAttribute("data-fis-input-style-form", "1");
        root.style.setProperty("--fis-input-radius", `${state.inputStyle.radius}px`);
        root.style.setProperty("--fis-input-border-width", state.inputStyle.borderless ? "0px" : `${state.inputStyle.borderWidth}px`);
        root.style.setProperty("--fis-input-border-color", state.inputStyle.borderColor);
      }
      if (state.inputStyle.backgroundMode === "color") {
        if (state.inputStyle.applyTargets.includes("chatInput")) root.setAttribute("data-fis-input-color-chat", "1");
        if (state.inputStyle.applyTargets.includes("searchInput")) root.setAttribute("data-fis-input-color-search", "1");
        if (state.inputStyle.applyTargets.includes("formInput")) root.setAttribute("data-fis-input-color-form", "1");
        root.style.setProperty("--fis-input-background-color", colorWithOpacity(state.inputStyle.backgroundColor, state.inputStyle.backgroundOpacity));
      }
      for (const def of REGION_DEFS) {
        const region = state.regions[def.key];
        if (def.key === "inputField") {
          if (state.inputStyle.backgroundMode !== "image" || !region.image) continue;
          if (state.inputStyle.applyTargets.includes("chatInput")) root.setAttribute("data-fis-input-image-chat", "1");
          if (state.inputStyle.applyTargets.includes("searchInput")) root.setAttribute("data-fis-input-image-search", "1");
          if (state.inputStyle.applyTargets.includes("formInput")) root.setAttribute("data-fis-input-image-form", "1");
        } else {
          if (!state.imagesEnabled || !region.enabled || !region.image) continue;
        }
        if (def.key === "bottomBar") {
          if (region.applyTargets.includes("inputBar")) root.setAttribute("data-fis-bottom-image-input", "1");
          if (region.applyTargets.includes("tabBar")) root.setAttribute("data-fis-bottom-image-tab", "1");
          for (const [targetKey, suffix] of [["inputBar", "input"], ["tabBar", "tab"]]) {
            const settings = region.targetSettings[targetKey];
            const prefix = `--fis-bottom-bar-${suffix}`;
            const source = region.image;
            const blur = settings.blur;
            applyImageSource(`bottomBar:${targetKey}`, source, blur, prefix, () => {
              const current = state.regions.bottomBar;
              const currentSettings = current && current.targetSettings && current.targetSettings[targetKey];
              return !!current && current.enabled && current.image === source && !!currentSettings && currentSettings.blur === blur;
            });
            root.style.setProperty(prefix + "-size", imageSizeCss(def, settings.scale));
            root.style.setProperty(prefix + "-position", `${settings.positionX}% ${settings.positionY}%`);
            root.style.setProperty(prefix + "-over-top", String(settings.overflowY));
            root.style.setProperty(prefix + "-over-bottom", String(settings.overflowY));
          }
          continue;
        } else root.setAttribute(attributeName(def.key), "1");
        if (def.key === "topBar") {
          for (const target of region.applyTargets) {
            const suffix = target === "chatRoom" ? "chat-room" : target;
            root.setAttribute("data-fis-top-target-" + suffix, "1");
          }
        }
        if (def.key === "appBackground") {
          for (const target of region.applyTargets) {
            const suffix = target === "chatRoom" ? "chat-room" : target;
            root.setAttribute("data-fis-background-target-" + suffix, "1");
          }
        }
        const prefix = `--fis-${def.key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())}`;
        const imageSize = imageSizeCss(def, region.scale);
        applyRegionImage(def, region, prefix);
        root.style.setProperty(prefix + "-size", imageSize);
        root.style.setProperty(prefix + "-repeat", "no-repeat");
        root.style.setProperty(prefix + "-position", `${region.positionX}% ${region.positionY}%`);
        const overflowY = def.overflow ? region.overflowY : 0;
        root.style.setProperty(prefix + "-over-top", String(overflowY));
        root.style.setProperty(prefix + "-over-right", "0");
        root.style.setProperty(prefix + "-over-bottom", String(overflowY));
        root.style.setProperty(prefix + "-over-left", "0");
      }
      refreshStyleSheet();
      syncThemeScope();
    }

    function refreshAll() {
      apply();
      for (const refresh of refreshers) {
        try { refresh(); } catch (error) { ctx.system.log("[自定义聊天主题] 设置界面刷新失败", error); }
      }
    }

    const floatingButton = document.createElement("button");
    floatingButton.type = "button";
    floatingButton.className = "fis-floating-button";
    floatingButton.title = "打开自定义聊天主题设置";
    floatingButton.setAttribute("aria-label", "打开自定义聊天主题设置");
    floatingButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
    const floatingPanel = document.createElement("div");
    floatingPanel.className = "fis-settings fis-floating-panel";
    floatingPanel.setAttribute("role", "dialog");
    floatingPanel.setAttribute("aria-label", "自定义聊天主题实时设置");
    const floatingHost = document.body || document.documentElement;
    floatingHost.append(floatingButton, floatingPanel);

    let floatingOpen = false;
    let floatingPage = "colors";
    let floatingInterfacePage = "cards";
    let floatingColorRuleId = "";
    let floatingFontRuleId = "";
    let floatingImageRegionKey = "appBackground";
    let floatingDeleteMode = false;
    const floatingDeleteSelection = new Set();

    const clampFloatingTop = value => {
      const height = floatingButton.offsetHeight || (window.innerWidth <= 560 ? 58 : 64);
      return Math.max(8, Math.min(window.innerHeight - height - 8, Number(value) || 8));
    };
    if (state.floatingButtonTop != null) floatingButton.style.top = `${clampFloatingTop(state.floatingButtonTop)}px`;

    function positionFloatingPanel() {
      if (!floatingOpen) return;
      const rect = floatingButton.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.top > viewportHeight * 0.48) {
        floatingPanel.style.top = "auto";
        floatingPanel.style.bottom = `${Math.max(8, viewportHeight - rect.bottom)}px`;
        floatingPanel.style.maxHeight = `${Math.min(viewportHeight * 0.78, Math.max(220, rect.bottom - 16))}px`;
      } else {
        const top = Math.max(8, rect.top);
        floatingPanel.style.bottom = "auto";
        floatingPanel.style.top = `${top}px`;
        floatingPanel.style.maxHeight = `${Math.min(viewportHeight * 0.78, Math.max(220, viewportHeight - top - 8))}px`;
      }
    }

    const onFloatingResize = () => {
      const top = clampFloatingTop(floatingButton.getBoundingClientRect().top);
      floatingButton.style.top = `${top}px`;
      if (state.floatingButtonTop != null) state.floatingButtonTop = top;
      positionFloatingPanel();
    };
    window.addEventListener("resize", onFloatingResize);

    const liveIcons = {
      themePlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/><path d="M12 7v6M9 10h6"/></svg>',
      plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
      trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    };

    const liveButton = (text, className, onClick) => {
      const node = document.createElement("button"); node.type = "button";
      node.className = "fis-btn" + (className ? " " + className : ""); node.textContent = text;
      node.addEventListener("click", event => { event.stopPropagation(); onClick(); });
      return node;
    };

    const liveIconButton = (icon, label, onClick, className = "") => {
      const node = document.createElement("button"); node.type = "button";
      node.className = "fis-icon-btn" + (className ? " " + className : ""); node.innerHTML = liveIcons[icon];
      node.title = label; node.setAttribute("aria-label", label);
      node.addEventListener("click", event => { event.stopPropagation(); onClick(); });
      return node;
    };

    const liveSwitch = (checked, label, onChange) => {
      const wrapper = document.createElement("label"); wrapper.className = "fis-switch"; wrapper.title = label;
      const input = document.createElement("input"); input.type = "checkbox"; input.checked = checked; input.setAttribute("aria-label", label);
      const track = document.createElement("span"); track.className = "fis-switch-track";
      input.addEventListener("change", () => onChange(input.checked)); wrapper.append(input, track);
      return wrapper;
    };

    const openFloatingDialog = ({ title, message = "", inputValue, inputPlaceholder = "", confirmLabel = "确定", danger = false, onConfirm }) => {
      const existing = document.querySelector(".fis-dialog-overlay");
      if (existing) existing.remove();
      const overlay = document.createElement("div"); overlay.className = "fis-dialog-overlay";
      const dialog = document.createElement("section"); dialog.className = "fis-dialog-card"; dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
      const heading = document.createElement("div"); heading.className = "fis-dialog-title"; heading.textContent = title;
      dialog.appendChild(heading);
      if (message) {
        const copy = document.createElement("div"); copy.className = "fis-dialog-message"; copy.textContent = message; dialog.appendChild(copy);
      }
      let input = null;
      if (inputValue !== undefined) {
        input = document.createElement("input"); input.type = "text"; input.className = "fis-dialog-input";
        input.value = String(inputValue); input.placeholder = inputPlaceholder; dialog.appendChild(input);
      }
      const actions = document.createElement("div"); actions.className = "fis-dialog-actions";
      const close = () => overlay.remove();
      const cancel = liveButton("取消", "", close);
      const confirmButton = liveButton(confirmLabel, danger ? "danger" : "primary", () => {
        const result = onConfirm ? onConfirm(input ? input.value : undefined) : undefined;
        if (result !== false) close();
      });
      actions.append(cancel, confirmButton); dialog.appendChild(actions); overlay.appendChild(dialog);
      (document.body || document.documentElement).appendChild(overlay);
      if (input) {
        input.addEventListener("keydown", event => { if (event.key === "Enter") confirmButton.click(); });
        setTimeout(() => { input.focus?.(); input.select?.(); }, 0);
      }
      return overlay;
    };

    const liveRange = (target, key, min, max, step, suffix, deferred = false, preview = null) => {
      const pair = document.createElement("div"); pair.className = "fis-range-pair";
      const range = document.createElement("input"); range.type = "range"; range.className = "fis-range";
      range.min = String(min); range.max = String(max); range.step = String(step); range.value = String(target[key]);
      const number = document.createElement("input"); number.type = "number"; number.className = "fis-number";
      number.min = String(min); number.max = String(max); number.step = String(step); number.value = String(target[key]); number.title = suffix;
      const updateProgress = () => {
        const progress = max === min ? 0 : ((Number(range.value) - min) / (max - min)) * 100;
        range.style.setProperty("--fis-range-progress", `${Math.min(100, Math.max(0, progress))}%`);
      };
      const sync = (source, other, commit = true) => {
        const value = clamp(source.value, target[key], min, max);
        target[key] = value; source.value = String(value); other.value = String(value); updateProgress();
        if (preview) preview(value);
        if (commit) { persist(); apply(); }
      };
      updateProgress();
      range.addEventListener("input", () => sync(range, number, !deferred));
      if (deferred) range.addEventListener("change", () => sync(range, number, true));
      number.addEventListener(deferred ? "change" : "input", () => sync(number, range, true));
      pair.append(range, number); return pair;
    };

    const liveRow = (panel, labelText, control) => {
      const row = document.createElement("div"); row.className = "fis-row";
      const label = document.createElement("div"); label.className = "fis-label"; label.textContent = labelText;
      row.append(label, control); panel.appendChild(row);
    };

    function syncFloatingUi() {
      if (!state.floatingButtonEnabled) floatingOpen = false;
      floatingButton.hidden = !state.floatingButtonEnabled;
      floatingPanel.hidden = !state.floatingButtonEnabled || !floatingOpen;
      floatingButton.setAttribute("aria-expanded", floatingOpen ? "true" : "false");
      if (floatingOpen) requestAnimationFrame(positionFloatingPanel);
    }

    function renderFloating() {
      syncFloatingUi();
      floatingPanel.textContent = "";
      const head = document.createElement("div"); head.className = "fis-floating-head";
      const tabs = document.createElement("div"); tabs.className = "fis-page-tabs";
      const pageTab = (text, page) => {
        const tab = document.createElement("button"); tab.type = "button";
        tab.className = "fis-page-tab" + (floatingPage === page ? " active" : ""); tab.textContent = text;
        tab.addEventListener("click", () => { floatingPage = page; floatingDeleteMode = false; floatingDeleteSelection.clear(); renderFloating(); });
        return tab;
      };
      tabs.append(pageTab("主题配色", "colors"), pageTab("字体", "fonts"), pageTab("界面设置", "interface"), pageTab("主题设置", "images"));
      const headActions = document.createElement("div"); headActions.className = "fis-floating-head-actions";
      const saveTheme = liveIconButton("themePlus", "保存当前设置为主题", () => {
        openFloatingDialog({
          title: "保存当前主题",
          message: "为当前设置填写一个主题名称。",
          inputValue: "",
          inputPlaceholder: "主题名称",
          confirmLabel: "保存",
          onConfirm: value => {
            const name = String(value || "").trim();
            if (!name) return false;
            const id = themeId();
            state.themes[id] = { id, name, snapshot: themeSnapshot(state) };
            persist(); refreshAll(); ctx.ui.toast("主题已保存");
          },
        });
      }, "primary");
      const close = document.createElement("button"); close.type = "button"; close.className = "fis-floating-close"; close.textContent = "×";
      close.title = "关闭设置"; close.setAttribute("aria-label", "关闭设置");
      close.addEventListener("click", () => { floatingOpen = false; syncFloatingUi(); });
      headActions.append(saveTheme, close); head.append(tabs, headActions); floatingPanel.appendChild(head);
      const body = document.createElement("div"); body.className = "fis-floating-body"; floatingPanel.appendChild(body);

      if (floatingPage === "colors") {
        if (!state.colorRules.some(rule => rule.id === floatingColorRuleId)) floatingColorRuleId = state.colorRules[0]?.id || "";
        const workspace = document.createElement("div"); workspace.className = "fis-color-workspace" + (state.colorsEnabled ? "" : " disabled");
        const bar = document.createElement("div"); bar.className = "fis-subtab-bar";
        const colorTabs = document.createElement("div"); colorTabs.className = "fis-subtab-strip fis-color-tabs" + (floatingDeleteMode ? " delete-mode" : "");
        for (const rule of state.colorRules) {
          const tab = document.createElement("button"); tab.type = "button"; tab.dataset.ruleId = rule.id;
          tab.className = "fis-color-tab" + (rule.id === floatingColorRuleId && !floatingDeleteMode ? " active" : "") + (floatingDeleteSelection.has(rule.id) ? " selected" : "");
          tab.title = floatingDeleteMode ? `选择删除 ${rule.color.toUpperCase()}` : `切换至 ${rule.color.toUpperCase()}`;
          const mark = document.createElement("span"); mark.className = "fis-color-tab-mark"; mark.textContent = floatingDeleteSelection.has(rule.id) ? "✓" : "";
          const heart = document.createElement("span"); heart.className = "fis-color-heart"; heart.textContent = "♥"; heart.style.color = rule.color;
          tab.append(mark, heart);
          tab.addEventListener("click", () => {
            if (floatingDeleteMode) floatingDeleteSelection.has(rule.id) ? floatingDeleteSelection.delete(rule.id) : floatingDeleteSelection.add(rule.id);
            else floatingColorRuleId = rule.id;
            renderFloating();
          });
          colorTabs.appendChild(tab);
        }
        const switchBox = document.createElement("div"); switchBox.className = "fis-subtab-switch";
        switchBox.appendChild(liveSwitch(state.colorsEnabled, "启用全部主题配色", checked => {
          state.colorsEnabled = checked; persist(); apply(); renderFloating();
        }));
        bar.append(colorTabs, switchBox); workspace.appendChild(bar);

        const activeRule = state.colorRules.find(rule => rule.id === floatingColorRuleId);
        if (activeRule && !floatingDeleteMode) {
          const panel = document.createElement("div"); panel.className = "fis-color-panel";
          const editor = document.createElement("div"); editor.className = "fis-inline-color-editor";
          const picker = document.createElement("input"); picker.type = "color"; picker.value = activeRule.color;
          const colorText = document.createElement("input"); colorText.type = "text"; colorText.maxLength = 7; colorText.value = activeRule.color.toUpperCase();
          const updateColor = (value, commit = true) => {
            if (!/^#[0-9a-f]{6}$/i.test(value)) return;
            activeRule.color = value.toLowerCase(); picker.value = activeRule.color; colorText.value = activeRule.color.toUpperCase();
            const activeTab = [...colorTabs.children].find(node => node.dataset.ruleId === activeRule.id);
            if (activeTab) activeTab.querySelector(".fis-color-heart").style.color = activeRule.color;
            for (const key of activeRule.targets) root.style.setProperty("--fis-color-" + key.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase()), activeRule.color);
            if (commit) { persist(); apply(); }
          };
          picker.addEventListener("input", () => updateColor(picker.value, false));
          picker.addEventListener("change", () => updateColor(picker.value, true));
          colorText.addEventListener("change", () => updateColor(colorText.value));
          colorText.addEventListener("blur", () => { colorText.value = activeRule.color.toUpperCase(); });
          editor.append(picker, colorText); panel.appendChild(editor);
          const options = document.createElement("div"); options.className = "fis-target-options";
          for (const target of COLOR_TARGETS) {
            const option = document.createElement("label"); option.className = "fis-target-option";
            const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = activeRule.targets.includes(target.key);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                for (const otherRule of state.colorRules) otherRule.targets = otherRule.targets.filter(key => key !== target.key);
                if (!activeRule.targets.includes(target.key)) activeRule.targets.push(target.key);
              } else activeRule.targets = activeRule.targets.filter(key => key !== target.key);
              persist(); apply(); renderFloating();
            });
            const label = document.createElement("span"); label.textContent = target.label;
            option.append(checkbox, label); options.appendChild(option);
          }
          panel.appendChild(options); workspace.appendChild(panel);
        }
        if (!state.colorRules.length) {
          const empty = document.createElement("div"); empty.className = "fis-color-panel fis-empty"; empty.textContent = "尚未添加主题颜色"; workspace.appendChild(empty);
        }
        const actions = document.createElement("div"); actions.className = "fis-color-actions";
        const add = liveIconButton("plus", "新增颜色", () => {
          if (state.colorRules.length >= 10) return;
          const rule = { id: colorRuleId(), color: "#8f76b8", targets: [] };
          state.colorRules.push(rule); floatingColorRuleId = rule.id; persist(); renderFloating();
        });
        add.disabled = floatingDeleteMode || state.colorRules.length >= 10;
        add.title = state.colorRules.length >= 10 ? "最多保存 10 个颜色" : "新增颜色";
        const removeLabel = floatingDeleteMode
          ? (floatingDeleteSelection.size ? `删除选中的 ${floatingDeleteSelection.size} 个颜色` : "取消删除")
          : "删除颜色";
        const remove = liveIconButton("trash", removeLabel, () => {
          if (!floatingDeleteMode) { floatingDeleteMode = true; floatingDeleteSelection.clear(); renderFloating(); return; }
          if (!floatingDeleteSelection.size) { floatingDeleteMode = false; renderFloating(); return; }
          if (!confirm(`确定删除选中的 ${floatingDeleteSelection.size} 种颜色？`)) return;
          state.colorRules = state.colorRules.filter(rule => !floatingDeleteSelection.has(rule.id));
          floatingDeleteSelection.clear(); floatingDeleteMode = false; persist(); apply(); renderFloating();
        });
        actions.append(add, remove); workspace.appendChild(actions); body.appendChild(workspace);
      }

      if (floatingPage === "fonts") {
        if (!state.fontRules.some(rule => rule.id === floatingFontRuleId)) floatingFontRuleId = state.fontRules[0]?.id || "";
        const workspace = document.createElement("div"); workspace.className = "fis-color-workspace" + (state.fontsEnabled ? "" : " disabled");
        const bar = document.createElement("div"); bar.className = "fis-subtab-bar";
        const fontTabs = document.createElement("div"); fontTabs.className = "fis-subtab-strip fis-font-tabs";
        for (const rule of state.fontRules) {
          const tab = document.createElement("button"); tab.type = "button"; tab.className = "fis-font-tab" + (rule.id === floatingFontRuleId ? " active" : "");
          tab.textContent = rule.name; tab.title = rule.name;
          tab.addEventListener("click", () => { floatingFontRuleId = rule.id; renderFloating(); }); fontTabs.appendChild(tab);
        }
        const switchBox = document.createElement("div"); switchBox.className = "fis-subtab-switch";
        switchBox.appendChild(liveSwitch(state.fontsEnabled, "启用全部字体设置", checked => { state.fontsEnabled = checked; persist(); apply(); renderFloating(); }));
        bar.append(fontTabs, switchBox); workspace.appendChild(bar);

        const loadFont = (file, replaceRule = null) => {
          if (!file) return;
          if (file.size > MAX_FONT_FILE_BYTES) { ctx.ui.toast("字体文件不能超过 25 MB"); return; }
          const reader = new FileReader(); reader.onload = () => {
            const data = String(reader.result || ""); if (!data) return;
            if (replaceRule) { replaceRule.data = data; replaceRule.name = file.name; floatingFontRuleId = replaceRule.id; }
            else {
              const rule = { id: fontRuleId(), name: file.name, data, targets: [] };
              state.fontRules.push(rule); floatingFontRuleId = rule.id;
            }
            state.fontsEnabled = true; persist(); apply(); renderFloating(); ctx.ui.toast("字体已载入");
          }; reader.readAsDataURL(file);
        };

        const activeRule = state.fontRules.find(rule => rule.id === floatingFontRuleId);
        if (activeRule) {
          const panel = document.createElement("div"); panel.className = "fis-color-panel";
          const replaceInput = document.createElement("input"); replaceInput.type = "file"; replaceInput.accept = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"; replaceInput.hidden = true;
          replaceInput.addEventListener("change", () => loadFont(replaceInput.files && replaceInput.files[0], activeRule));
          const fileRow = document.createElement("div"); fileRow.className = "fis-file-row";
          const fileName = document.createElement("div"); fileName.className = "fis-file-name"; fileName.textContent = activeRule.name;
          const fileActions = document.createElement("div"); fileActions.className = "fis-region-actions";
          fileActions.append(liveButton("替换", "primary", () => replaceInput.click()), replaceInput); fileRow.append(fileName, fileActions);
          liveRow(panel, "字体文件", fileRow);
          const options = document.createElement("div"); options.className = "fis-target-options";
          for (const target of FONT_TARGETS) {
            const option = document.createElement("label"); option.className = "fis-target-option";
            const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = activeRule.targets.includes(target.key);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                for (const otherRule of state.fontRules) otherRule.targets = otherRule.targets.filter(key => key !== target.key);
                if (!activeRule.targets.includes(target.key)) activeRule.targets.push(target.key);
              } else activeRule.targets = activeRule.targets.filter(key => key !== target.key);
              persist(); apply(); renderFloating();
            });
            const label = document.createElement("span"); label.textContent = target.label;
            option.append(checkbox, label); options.appendChild(option);
          }
          panel.appendChild(options); workspace.appendChild(panel);
        } else {
          const empty = document.createElement("div"); empty.className = "fis-color-panel fis-empty"; empty.textContent = "尚未上传字体"; workspace.appendChild(empty);
        }

        const actions = document.createElement("div"); actions.className = "fis-color-actions";
        const addInput = document.createElement("input"); addInput.type = "file"; addInput.accept = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"; addInput.hidden = true;
        addInput.addEventListener("change", () => loadFont(addInput.files && addInput.files[0]));
        const add = liveIconButton("plus", state.fontRules.length >= 10 ? "最多上传 10 个字体" : "上传字体", () => addInput.click());
        add.disabled = state.fontRules.length >= 10;
        const remove = liveIconButton("trash", "删除当前字体", () => {
          if (!activeRule) return;
          openFloatingDialog({
            title: "删除字体",
            message: `确定删除“${activeRule.name}”吗？`,
            confirmLabel: "删除",
            danger: true,
            onConfirm: () => {
              state.fontRules = state.fontRules.filter(rule => rule.id !== activeRule.id);
              floatingFontRuleId = state.fontRules[0]?.id || ""; persist(); apply(); renderFloating();
            },
          });
        });
        remove.disabled = !activeRule;
        actions.append(add, remove, addInput); workspace.appendChild(actions); body.appendChild(workspace);
      }

      let interfaceWorkspace = null;
      if (floatingPage === "interface") {
        interfaceWorkspace = document.createElement("div"); interfaceWorkspace.className = "fis-interface-workspace";
        const bar = document.createElement("div"); bar.className = "fis-subtab-bar";
        const strip = document.createElement("div"); strip.className = "fis-subtab-strip";
        const interfaceTab = (text, page) => {
          const tab = document.createElement("button"); tab.type = "button";
          tab.className = "fis-image-tab" + (floatingInterfacePage === page ? " active" : ""); tab.textContent = text;
          tab.addEventListener("click", () => { floatingInterfacePage = page; renderFloating(); });
          return tab;
        };
        strip.append(interfaceTab("卡片", "cards"), interfaceTab("按钮", "buttons"), interfaceTab("输入框", "inputs"));
        bar.appendChild(strip); interfaceWorkspace.appendChild(bar); body.appendChild(interfaceWorkspace);
      }

      if (floatingPage === "interface" && floatingInterfacePage === "buttons") {
        const buttonStyle = state.buttonStyle;
        const card = document.createElement("section"); card.className = "fis-input-style-card";
        liveRow(card, "启用设置", liveSwitch(buttonStyle.enabled, "启用按钮设置", checked => {
          buttonStyle.enabled = checked; persist(); apply(); renderFloating();
        }));
        const panel = document.createElement("div"); panel.className = "fis-input-style-body" + (buttonStyle.enabled ? "" : " disabled");
        const targets = document.createElement("div"); targets.className = "fis-input-targets";
        for (const [key, labelText] of BUTTON_STYLE_TARGETS) {
          const option = document.createElement("label"); option.className = "fis-input-target";
          const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = buttonStyle.applyTargets.includes(key);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked && !buttonStyle.applyTargets.includes(key)) buttonStyle.applyTargets.push(key);
            if (!checkbox.checked) buttonStyle.applyTargets = buttonStyle.applyTargets.filter(item => item !== key);
            persist(); apply();
          });
          const label = document.createElement("span"); label.textContent = labelText;
          option.append(checkbox, label); targets.appendChild(option);
        }
        liveRow(panel, "作用位置", targets);

        const appendBackgroundControl = (label, colorKey, opacityKey) => {
          const pair = document.createElement("div"); pair.className = "fis-color-pair";
          const picker = document.createElement("input"); picker.type = "color"; picker.value = buttonStyle[colorKey];
          const textInput = document.createElement("input"); textInput.type = "text"; textInput.className = "fis-number"; textInput.maxLength = 7; textInput.value = buttonStyle[colorKey].toUpperCase();
          const update = (color, commit = true) => {
            if (!/^#[0-9a-f]{6}$/i.test(color)) return;
            buttonStyle[colorKey] = color.toLowerCase(); picker.value = buttonStyle[colorKey]; textInput.value = buttonStyle[colorKey].toUpperCase();
            previewButtonStyle(buttonStyle, colorKey);
            if (commit) { persist(); apply(); }
          };
          picker.addEventListener("input", () => update(picker.value, false));
          picker.addEventListener("change", () => update(picker.value, true));
          textInput.addEventListener("change", () => update(textInput.value));
          textInput.addEventListener("blur", () => { textInput.value = buttonStyle[colorKey].toUpperCase(); });
          pair.append(picker, textInput); liveRow(panel, `${label}颜色`, pair);
          liveRow(panel, `${label}透明度`, liveRange(buttonStyle, opacityKey, 0, 100, 1, "%", true, () => previewButtonStyle(buttonStyle, opacityKey)));
        };
        appendBackgroundControl("功能按钮", "accentColor", "accentOpacity");
        appendBackgroundControl("胶囊标签", "capsuleColor", "capsuleOpacity");
        liveRow(panel, "圆角", liveRange(buttonStyle, "radius", 0, 50, 1, "px", true, () => previewButtonStyle(buttonStyle, "radius")));
        liveRow(panel, "边框粗细", liveRange(buttonStyle, "borderWidth", 0.5, 6, 0.5, "px", true, () => previewButtonStyle(buttonStyle, "borderWidth")));

        const borderOptions = document.createElement("div"); borderOptions.className = "fis-input-targets";
        const borderlessOption = document.createElement("label"); borderlessOption.className = "fis-input-target";
        const borderless = document.createElement("input"); borderless.type = "checkbox"; borderless.checked = buttonStyle.borderless;
        borderless.addEventListener("change", () => { buttonStyle.borderless = borderless.checked; persist(); apply(); renderFloating(); });
        borderlessOption.append(borderless, document.createTextNode("无边框")); borderOptions.appendChild(borderlessOption);
        liveRow(panel, "边框", borderOptions);

        const borderPair = document.createElement("div"); borderPair.className = "fis-color-pair";
        const borderPicker = document.createElement("input"); borderPicker.type = "color"; borderPicker.value = buttonStyle.borderColor;
        const borderText = document.createElement("input"); borderText.type = "text"; borderText.className = "fis-number"; borderText.maxLength = 7; borderText.value = buttonStyle.borderColor.toUpperCase();
        const updateBorder = (color, commit = true) => {
          if (!/^#[0-9a-f]{6}$/i.test(color)) return;
          buttonStyle.borderColor = color.toLowerCase(); borderPicker.value = buttonStyle.borderColor; borderText.value = buttonStyle.borderColor.toUpperCase();
          previewButtonStyle(buttonStyle, "borderColor");
          if (commit) { persist(); apply(); }
        };
        borderPicker.addEventListener("input", () => updateBorder(borderPicker.value, false));
        borderPicker.addEventListener("change", () => updateBorder(borderPicker.value, true));
        borderText.addEventListener("change", () => updateBorder(borderText.value));
        borderText.addEventListener("blur", () => { borderText.value = buttonStyle.borderColor.toUpperCase(); });
        borderPair.append(borderPicker, borderText); liveRow(panel, "边框颜色", borderPair);
        card.appendChild(panel); interfaceWorkspace.appendChild(card);
      }

      if (floatingPage === "interface" && floatingInterfacePage === "cards") {
        const interfaceStyle = state.interfaceStyle;
        const card = document.createElement("section"); card.className = "fis-input-style-card";

        const cardFeature = document.createElement("section"); cardFeature.className = "fis-input-feature fis-card-feature";
        const cardFeatureHead = document.createElement("div"); cardFeatureHead.className = "fis-input-feature-head";
        const cardFeatureTitle = document.createElement("div"); cardFeatureTitle.className = "fis-region-name"; cardFeatureTitle.textContent = "卡片样式";
        cardFeatureHead.append(cardFeatureTitle, liveSwitch(interfaceStyle.cardsEnabled, "启用卡片样式", checked => {
          interfaceStyle.cardsEnabled = checked; persist(); apply(); renderFloating();
        }));
        const cardFeatureBody = document.createElement("div"); cardFeatureBody.className = "fis-input-feature-body" + (interfaceStyle.cardsEnabled ? "" : " disabled");
        liveRow(cardFeatureBody, "圆角", liveRange(interfaceStyle, "radius", 0, 50, 1, "px", true, () => previewCardStyle(interfaceStyle, "radius")));
        liveRow(cardFeatureBody, "边框粗细", liveRange(interfaceStyle, "borderWidth", 0.5, 6, 0.5, "px", true, () => previewCardStyle(interfaceStyle, "borderWidth")));
        const borderOptions = document.createElement("div"); borderOptions.className = "fis-input-targets";
        const borderlessOption = document.createElement("label"); borderlessOption.className = "fis-input-target";
        const borderless = document.createElement("input"); borderless.type = "checkbox"; borderless.checked = interfaceStyle.borderless;
        borderless.addEventListener("change", () => { interfaceStyle.borderless = borderless.checked; persist(); apply(); renderFloating(); });
        borderlessOption.append(borderless, document.createTextNode("无边框")); borderOptions.appendChild(borderlessOption);
        liveRow(cardFeatureBody, "边框", borderOptions);
        const borderPair = document.createElement("div"); borderPair.className = "fis-color-pair";
        const borderPicker = document.createElement("input"); borderPicker.type = "color"; borderPicker.value = interfaceStyle.borderColor;
        const borderText = document.createElement("input"); borderText.type = "text"; borderText.className = "fis-number"; borderText.maxLength = 7; borderText.value = interfaceStyle.borderColor.toUpperCase();
        const updateBorder = (color, commit = true) => {
          if (!/^#[0-9a-f]{6}$/i.test(color)) return;
          interfaceStyle.borderColor = color.toLowerCase(); borderPicker.value = interfaceStyle.borderColor; borderText.value = interfaceStyle.borderColor.toUpperCase();
          previewCardStyle(interfaceStyle, "borderColor");
          if (commit) { persist(); apply(); }
        };
        borderPicker.addEventListener("input", () => updateBorder(borderPicker.value, false));
        borderPicker.addEventListener("change", () => updateBorder(borderPicker.value, true));
        borderText.addEventListener("change", () => updateBorder(borderText.value));
        borderText.addEventListener("blur", () => { borderText.value = interfaceStyle.borderColor.toUpperCase(); });
        borderPair.append(borderPicker, borderText); liveRow(cardFeatureBody, "边框颜色", borderPair);
        const backgroundPair = document.createElement("div"); backgroundPair.className = "fis-color-pair";
        const backgroundPicker = document.createElement("input"); backgroundPicker.type = "color"; backgroundPicker.value = interfaceStyle.backgroundColor;
        const backgroundText = document.createElement("input"); backgroundText.type = "text"; backgroundText.className = "fis-number"; backgroundText.maxLength = 7; backgroundText.value = interfaceStyle.backgroundColor.toUpperCase();
        const updateBackground = (color, commit = true) => {
          if (!/^#[0-9a-f]{6}$/i.test(color)) return;
          interfaceStyle.backgroundColor = color.toLowerCase(); backgroundPicker.value = interfaceStyle.backgroundColor; backgroundText.value = interfaceStyle.backgroundColor.toUpperCase();
          previewCardStyle(interfaceStyle, "backgroundColor");
          if (commit) { persist(); apply(); }
        };
        backgroundPicker.addEventListener("input", () => updateBackground(backgroundPicker.value, false));
        backgroundPicker.addEventListener("change", () => updateBackground(backgroundPicker.value, true));
        backgroundText.addEventListener("change", () => updateBackground(backgroundText.value));
        backgroundText.addEventListener("blur", () => { backgroundText.value = interfaceStyle.backgroundColor.toUpperCase(); });
        backgroundPair.append(backgroundPicker, backgroundText); liveRow(cardFeatureBody, "卡片颜色", backgroundPair);
        liveRow(cardFeatureBody, "透明度", liveRange(interfaceStyle, "backgroundOpacity", 0, 100, 1, "%", true, () => previewCardStyle(interfaceStyle, "backgroundOpacity")));
        cardFeature.append(cardFeatureHead, cardFeatureBody); card.appendChild(cardFeature);

        interfaceWorkspace.appendChild(card);
      }

      if (floatingPage === "interface" && floatingInterfacePage === "inputs") {
        const inputStyle = state.inputStyle;
        const inputRegion = state.regions.inputField;
        const inputDef = REGION_DEFS.find(def => def.key === "inputField");
        const card = document.createElement("section"); card.className = "fis-input-style-card";
        const targets = document.createElement("div"); targets.className = "fis-input-targets";
        for (const [key, labelText] of INPUT_STYLE_TARGETS) {
          const option = document.createElement("label"); option.className = "fis-input-target";
          const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = inputStyle.applyTargets.includes(key);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked && !inputStyle.applyTargets.includes(key)) inputStyle.applyTargets.push(key);
            if (!checkbox.checked) inputStyle.applyTargets = inputStyle.applyTargets.filter(item => item !== key);
            inputRegion.applyTargets = [...inputStyle.applyTargets];
            persist(); apply();
          });
          option.append(checkbox, document.createTextNode(labelText)); targets.appendChild(option);
        }
        liveRow(card, "作用位置", targets);

        const colorFeature = document.createElement("section"); colorFeature.className = "fis-input-feature";
        const colorFeatureHead = document.createElement("div"); colorFeatureHead.className = "fis-input-feature-head";
        const colorFeatureTitle = document.createElement("div"); colorFeatureTitle.className = "fis-region-name"; colorFeatureTitle.textContent = "输入框颜色";
        colorFeatureHead.append(colorFeatureTitle, liveSwitch(inputStyle.backgroundMode === "color", "启用输入框颜色", checked => {
          inputStyle.backgroundMode = checked ? "color" : (inputStyle.backgroundMode === "color" ? "none" : inputStyle.backgroundMode);
          persist(); apply(); renderFloating();
        }));
        const colorFeatureBody = document.createElement("div"); colorFeatureBody.className = "fis-input-feature-body" + (inputStyle.backgroundMode === "color" ? "" : " disabled");
        const backgroundColorPair = document.createElement("div"); backgroundColorPair.className = "fis-color-pair";
        const backgroundColorPicker = document.createElement("input"); backgroundColorPicker.type = "color"; backgroundColorPicker.value = inputStyle.backgroundColor;
        const backgroundColorText = document.createElement("input"); backgroundColorText.type = "text"; backgroundColorText.className = "fis-number"; backgroundColorText.maxLength = 7; backgroundColorText.value = inputStyle.backgroundColor.toUpperCase();
        const updateBackgroundColor = (color, commit = true) => {
          if (!/^#[0-9a-f]{6}$/i.test(color)) return;
          inputStyle.backgroundColor = color.toLowerCase(); backgroundColorPicker.value = inputStyle.backgroundColor; backgroundColorText.value = inputStyle.backgroundColor.toUpperCase();
          previewInputStyle(inputStyle, "backgroundColor");
          if (commit) { persist(); apply(); }
        };
        backgroundColorPicker.addEventListener("input", () => updateBackgroundColor(backgroundColorPicker.value, false));
        backgroundColorPicker.addEventListener("change", () => updateBackgroundColor(backgroundColorPicker.value, true));
        backgroundColorText.addEventListener("change", () => updateBackgroundColor(backgroundColorText.value));
        backgroundColorText.addEventListener("blur", () => { backgroundColorText.value = inputStyle.backgroundColor.toUpperCase(); });
        backgroundColorPair.append(backgroundColorPicker, backgroundColorText); liveRow(colorFeatureBody, "背景颜色", backgroundColorPair);
        liveRow(colorFeatureBody, "透明度", liveRange(inputStyle, "backgroundOpacity", 0, 100, 1, "%", true, () => previewInputStyle(inputStyle, "backgroundOpacity")));
        colorFeature.append(colorFeatureHead, colorFeatureBody); card.appendChild(colorFeature);

        const imageFeature = document.createElement("section"); imageFeature.className = "fis-input-feature";
        const imageFeatureHead = document.createElement("div"); imageFeatureHead.className = "fis-input-feature-head";
        const imageFeatureTitle = document.createElement("div"); imageFeatureTitle.className = "fis-region-name"; imageFeatureTitle.textContent = "输入框图片";
        imageFeatureHead.append(imageFeatureTitle, liveSwitch(inputStyle.backgroundMode === "image", "启用输入框图片", checked => {
          inputStyle.backgroundMode = checked ? "image" : (inputStyle.backgroundMode === "image" ? "none" : inputStyle.backgroundMode);
          persist(); apply(); renderFloating();
        }));
        const imageFeatureBody = document.createElement("div"); imageFeatureBody.className = "fis-input-feature-body" + (inputStyle.backgroundMode === "image" ? "" : " disabled");
        const imagePick = document.createElement("div"); imagePick.className = "fis-input-image-pick";
        const thumb = document.createElement("div"); thumb.className = "fis-thumb"; if (inputRegion.image) thumb.style.backgroundImage = cssUrl(inputRegion.image);
        const imageName = document.createElement("div"); imageName.className = "fis-file-name"; imageName.textContent = inputRegion.image ? (inputRegion.fileName || "已上传图片") : "尚未选择图片";
        const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/png,image/webp,image/jpeg"; fileInput.hidden = true;
        fileInput.addEventListener("change", () => {
          const file = fileInput.files && fileInput.files[0]; if (!file) return;
          const reader = new FileReader(); reader.onload = () => {
            inputRegion.image = String(reader.result || ""); inputRegion.fileName = file.name; inputStyle.backgroundMode = "image";
            persist(); apply(); renderFloating();
          }; reader.readAsDataURL(file);
        });
        const imageActions = document.createElement("div"); imageActions.className = "fis-region-actions";
        imageActions.append(liveButton("选择", "primary", () => fileInput.click()), liveButton("清除", "danger", () => {
          inputRegion.image = ""; inputRegion.fileName = ""; if (inputStyle.backgroundMode === "image") inputStyle.backgroundMode = "none";
          persist(); apply(); renderFloating();
        }), fileInput);
        imagePick.append(thumb, imageName, imageActions); imageFeatureBody.appendChild(imagePick);
        liveRow(imageFeatureBody, "图片缩放", liveRange(inputRegion, "scale", 0.1, 3, 0.05, "×", true, () => previewRegionGeometry(inputDef, inputRegion, "scale")));
        liveRow(imageFeatureBody, "图片模糊", liveRange(inputRegion, "blur", 0, 30, 1, "px", true));
        liveRow(imageFeatureBody, "水平位置", liveRange(inputRegion, "positionX", 0, 100, 1, "%", true, () => previewRegionGeometry(inputDef, inputRegion, "positionX")));
        liveRow(imageFeatureBody, "垂直位置", liveRange(inputRegion, "positionY", 0, 100, 1, "%", true, () => previewRegionGeometry(inputDef, inputRegion, "positionY")));
        imageFeature.append(imageFeatureHead, imageFeatureBody); card.appendChild(imageFeature);

        const shapeFeature = document.createElement("section"); shapeFeature.className = "fis-input-feature";
        const shapeFeatureHead = document.createElement("div"); shapeFeatureHead.className = "fis-input-feature-head";
        const shapeFeatureTitle = document.createElement("div"); shapeFeatureTitle.className = "fis-region-name"; shapeFeatureTitle.textContent = "圆角与边框";
        shapeFeatureHead.append(shapeFeatureTitle, liveSwitch(inputStyle.enabled, "启用圆角与边框", checked => {
          inputStyle.enabled = checked; persist(); apply(); renderFloating();
        }));
        const panel = document.createElement("div"); panel.className = "fis-input-feature-body" + (inputStyle.enabled ? "" : " disabled");
        liveRow(panel, "圆角", liveRange(inputStyle, "radius", 0, 50, 1, "px", true, () => previewInputStyle(inputStyle, "radius")));
        liveRow(panel, "边框粗细", liveRange(inputStyle, "borderWidth", 0.5, 6, 0.5, "px", true, () => previewInputStyle(inputStyle, "borderWidth")));
        const borderOptions = document.createElement("div"); borderOptions.className = "fis-input-targets";
        const borderlessOption = document.createElement("label"); borderlessOption.className = "fis-input-target";
        const borderless = document.createElement("input"); borderless.type = "checkbox"; borderless.checked = inputStyle.borderless;
        borderless.addEventListener("change", () => { inputStyle.borderless = borderless.checked; persist(); apply(); renderFloating(); });
        borderlessOption.append(borderless, document.createTextNode("无边框")); borderOptions.appendChild(borderlessOption);
        liveRow(panel, "边框", borderOptions);
        const colorPair = document.createElement("div"); colorPair.className = "fis-color-pair";
        const colorPicker = document.createElement("input"); colorPicker.type = "color"; colorPicker.value = inputStyle.borderColor;
        const colorText = document.createElement("input"); colorText.type = "text"; colorText.className = "fis-number"; colorText.maxLength = 7; colorText.value = inputStyle.borderColor.toUpperCase();
        const updateBorderColor = (color, commit = true) => {
          if (!/^#[0-9a-f]{6}$/i.test(color)) return;
          inputStyle.borderColor = color.toLowerCase(); colorPicker.value = inputStyle.borderColor; colorText.value = inputStyle.borderColor.toUpperCase();
          previewInputStyle(inputStyle, "borderColor");
          if (commit) { persist(); apply(); }
        };
        colorPicker.addEventListener("input", () => updateBorderColor(colorPicker.value, false));
        colorPicker.addEventListener("change", () => updateBorderColor(colorPicker.value, true));
        colorText.addEventListener("change", () => updateBorderColor(colorText.value));
        colorText.addEventListener("blur", () => { colorText.value = inputStyle.borderColor.toUpperCase(); });
        colorPair.append(colorPicker, colorText); liveRow(panel, "边框颜色", colorPair);
        shapeFeature.append(shapeFeatureHead, panel); card.appendChild(shapeFeature); interfaceWorkspace.appendChild(card);
      }

      if (floatingPage === "images") {
        if (!IMAGE_REGION_DEFS.some(def => def.key === floatingImageRegionKey)) floatingImageRegionKey = IMAGE_REGION_DEFS[0].key;
        const workspace = document.createElement("div"); workspace.className = "fis-image-workspace" + (state.imagesEnabled ? "" : " disabled");
        const bar = document.createElement("div"); bar.className = "fis-subtab-bar";
        const imageTabs = document.createElement("div"); imageTabs.className = "fis-subtab-strip";
        const labels = { appBackground: "背景", topBar: "顶部栏", bottomBar: "底部栏" };
        for (const tabDef of IMAGE_REGION_DEFS) {
          const tab = document.createElement("button"); tab.type = "button"; tab.className = "fis-image-tab" + (tabDef.key === floatingImageRegionKey ? " active" : ""); tab.textContent = labels[tabDef.key];
          tab.addEventListener("click", () => { floatingImageRegionKey = tabDef.key; renderFloating(); }); imageTabs.appendChild(tab);
        }
        const switchBox = document.createElement("div"); switchBox.className = "fis-subtab-switch";
        switchBox.appendChild(liveSwitch(state.imagesEnabled, "启用全部图片设置", checked => { state.imagesEnabled = checked; persist(); apply(); renderFloating(); }));
        bar.append(imageTabs, switchBox); workspace.appendChild(bar);
        const def = IMAGE_REGION_DEFS.find(item => item.key === floatingImageRegionKey);
        if (def) {
          const region = state.regions[def.key];
          const card = document.createElement("section"); card.className = "fis-region";
          const summary = document.createElement("div"); summary.className = "fis-region-summary";
          const enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.className = "fis-region-enabled"; enabled.checked = region.enabled; enabled.title = "启用区域";
          enabled.addEventListener("change", () => { region.enabled = enabled.checked; persist(); apply(); });
          const thumb = document.createElement("div"); thumb.className = "fis-thumb"; if (region.image) thumb.style.backgroundImage = cssUrl(region.image);
          const copy = document.createElement("div");
          const name = document.createElement("div"); name.className = "fis-region-name"; name.textContent = def.label;
          const hint = document.createElement("div"); hint.className = "fis-region-hint"; hint.textContent = region.image ? (region.fileName || "已上传图片") : def.hint;
          copy.append(name, hint);
          const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/png,image/webp,image/jpeg"; fileInput.hidden = true;
          fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0]; if (!file) return;
            const reader = new FileReader(); reader.onload = () => { region.image = String(reader.result || ""); region.fileName = file.name; persist(); apply(); renderFloating(); }; reader.readAsDataURL(file);
          });
          const actions = document.createElement("div"); actions.className = "fis-region-actions";
          actions.append(liveButton("选择", "primary", () => fileInput.click()), liveButton("清除", "danger", () => { region.image = ""; region.fileName = ""; persist(); apply(); renderFloating(); }), fileInput);
          summary.append(enabled, thumb, copy, actions); card.appendChild(summary);
          const panel = document.createElement("div"); panel.className = "fis-panel";
          if (def.targets) {
            const targets = document.createElement("div"); targets.className = "fis-input-targets";
            for (const [key, labelText] of def.targets) {
              const option = document.createElement("label"); option.className = "fis-input-target";
              const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = region.applyTargets.includes(key);
              checkbox.addEventListener("change", () => {
                if (checkbox.checked && !region.applyTargets.includes(key)) region.applyTargets.push(key);
                if (!checkbox.checked) region.applyTargets = region.applyTargets.filter(item => item !== key);
                persist(); apply();
                if (def.key === "bottomBar") renderFloating();
              });
              option.append(checkbox, document.createTextNode(labelText)); targets.appendChild(option);
            }
            liveRow(panel, "作用位置", targets);
          }
          if (def.key === "bottomBar") {
            for (const [targetKey, labelText, suffix] of [["inputBar", "聊天输入区调节", "input"], ["tabBar", "应用底部栏调节", "tab"]]) {
              const feature = document.createElement("section"); feature.className = "fis-input-feature";
              const featureHead = document.createElement("div"); featureHead.className = "fis-input-feature-head";
              const featureTitle = document.createElement("div"); featureTitle.className = "fis-region-name"; featureTitle.textContent = labelText;
              featureHead.appendChild(featureTitle);
              const settings = region.targetSettings[targetKey];
              const featureBody = document.createElement("div"); featureBody.className = "fis-input-feature-body" + (region.applyTargets.includes(targetKey) ? "" : " disabled");
              const prefix = `--fis-bottom-bar-${suffix}`;
              liveRow(featureBody, "图片缩放", liveRange(settings, "scale", 0.1, 3, 0.05, "×", true, () => previewRegionGeometry(def, settings, "scale", prefix)));
              liveRow(featureBody, "图片模糊", liveRange(settings, "blur", 0, 30, 1, "px", true));
              liveRow(featureBody, "水平位置", liveRange(settings, "positionX", 0, 100, 1, "%", true, () => previewRegionGeometry(def, settings, "positionX", prefix)));
              liveRow(featureBody, "垂直位置", liveRange(settings, "positionY", 0, 100, 1, "%", true, () => previewRegionGeometry(def, settings, "positionY", prefix)));
              liveRow(featureBody, "上下超界", liveRange(settings, "overflowY", 0, 300, 1, "px", true, () => previewRegionGeometry(def, settings, "overflowY", prefix)));
              feature.append(featureHead, featureBody); panel.appendChild(feature);
            }
          } else {
            liveRow(panel, "图片缩放", liveRange(region, "scale", 0.1, 3, 0.05, "×", true, () => previewRegionGeometry(def, region, "scale")));
            liveRow(panel, "图片模糊", liveRange(region, "blur", 0, 30, 1, "px", true));
            liveRow(panel, "水平位置", liveRange(region, "positionX", 0, 100, 1, "%", true, () => previewRegionGeometry(def, region, "positionX")));
            liveRow(panel, "垂直位置", liveRange(region, "positionY", 0, 100, 1, "%", true, () => previewRegionGeometry(def, region, "positionY")));
            if (def.overflow) liveRow(panel, "上下超界", liveRange(region, "overflowY", 0, 300, 1, "px", true, () => previewRegionGeometry(def, region, "overflowY")));
          }
          card.appendChild(panel); workspace.appendChild(card);
        }
        body.appendChild(workspace);
      }
    }

    let floatingDragStartY = null;
    let floatingDragStartTop = 0;
    let floatingDragMoved = false;
    let suppressFloatingClick = false;
    floatingButton.addEventListener("pointerdown", event => {
      floatingDragStartY = event.clientY;
      floatingDragStartTop = floatingButton.getBoundingClientRect().top;
      floatingDragMoved = false;
      try { floatingButton.setPointerCapture(event.pointerId); } catch (_) {}
    });
    floatingButton.addEventListener("pointermove", event => {
      if (floatingDragStartY == null) return;
      const delta = event.clientY - floatingDragStartY;
      if (Math.abs(delta) > 5) floatingDragMoved = true;
      if (!floatingDragMoved) return;
      floatingButton.style.top = `${clampFloatingTop(floatingDragStartTop + delta)}px`;
      positionFloatingPanel();
    });
    floatingButton.addEventListener("pointerup", () => {
      if (floatingDragMoved) {
        state.floatingButtonTop = clampFloatingTop(floatingButton.getBoundingClientRect().top);
        floatingButton.style.top = `${state.floatingButtonTop}px`;
        persist();
        suppressFloatingClick = true;
      }
      floatingDragStartY = null;
    });
    floatingButton.addEventListener("pointercancel", () => { floatingDragStartY = null; });
    floatingButton.addEventListener("click", () => {
      if (suppressFloatingClick) { suppressFloatingClick = false; return; }
      floatingOpen = !floatingOpen;
      if (floatingOpen) renderFloating(); else syncFloatingUi();
    });
    refreshers.add(renderFloating);
    renderFloating();

    const scopeObserver = new MutationObserver(syncThemeScope);
    if (document.body) {
      scopeObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-settings-open", "class", "style", "hidden", "aria-hidden"],
      });
    }

    ctx.ui.slot("settings.section", el => {
      let alive = true;
      const colorDeleteSelection = new Set();
      let colorDeleteMode = false;
      let activeColorRuleId = "";
      let activeImageRegionKey = "appBackground";
      let activeSettingsPage = "themes";
      const floatingToggleRow = document.createElement("div");
      floatingToggleRow.className = "fis-settings-toggle-row";
      const box = document.createElement("div");
      box.className = "fis-settings";
      el.append(floatingToggleRow, box);

      const button = (text, className, onClick) => {
        const node = document.createElement("button");
        node.type = "button";
        node.className = "fis-btn" + (className ? " " + className : "");
        node.textContent = text;
        node.addEventListener("click", event => { event.stopPropagation(); onClick(); });
        return node;
      };

      const icons = {
        themePlus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"/><path d="M12 7v6M9 10h6"/></svg>',
        upload: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M8 8l4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M8 12l4 4 4-4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
        check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
        save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></svg>',
        pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2zM14.5 7.1l2.8 2.8"/></svg>',
      };

      const iconButton = (icon, label, onClick, className = "") => {
        const node = document.createElement("button"); node.type = "button";
        node.className = "fis-icon-btn" + (className ? " " + className : "");
        node.innerHTML = icons[icon]; node.title = label; node.setAttribute("aria-label", label);
        node.addEventListener("click", event => { event.stopPropagation(); onClick(); });
        return node;
      };

      const switchControl = (checked, label, onChange) => {
        const wrapper = document.createElement("label"); wrapper.className = "fis-switch"; wrapper.title = label;
        const input = document.createElement("input"); input.type = "checkbox"; input.checked = checked; input.setAttribute("aria-label", label);
        const track = document.createElement("span"); track.className = "fis-switch-track";
        input.addEventListener("change", () => onChange(input.checked));
        wrapper.append(input, track);
        return wrapper;
      };

      const rangeControl = (region, key, min, max, step, suffix, deferred = false) => {
        const pair = document.createElement("div");
        pair.className = "fis-range-pair";
        const range = document.createElement("input");
        range.type = "range"; range.className = "fis-range";
        range.min = String(min); range.max = String(max); range.step = String(step); range.value = String(region[key]);
        const updateProgress = () => {
          const progress = max === min ? 0 : ((Number(range.value) - min) / (max - min)) * 100;
          range.style.setProperty("--fis-range-progress", `${Math.min(100, Math.max(0, progress))}%`);
        };
        updateProgress();
        const number = document.createElement("input");
        number.type = "number"; number.className = "fis-number";
        number.min = String(min); number.max = String(max); number.step = String(step); number.value = String(region[key]);
        const sync = (source, target, commit = true) => {
          const value = clamp(source.value, region[key], min, max);
          region[key] = value; source.value = String(value); target.value = String(value); updateProgress();
          if (commit) { persist(); apply(); }
        };
        range.addEventListener("input", () => sync(range, number, !deferred));
        if (deferred) range.addEventListener("change", () => sync(range, number, true));
        number.addEventListener(deferred ? "change" : "input", () => sync(number, range, true));
        number.title = suffix;
        pair.append(range, number);
        return pair;
      };

      const addRow = (panel, labelText, control) => {
        const row = document.createElement("div"); row.className = "fis-row";
        const label = document.createElement("div"); label.className = "fis-label"; label.textContent = labelText;
        row.append(label, control); panel.appendChild(row);
      };

      const render = () => {
        if (!alive) return;
        floatingToggleRow.textContent = "";
        box.textContent = "";
        const head = document.createElement("div"); head.className = "fis-head";
        const pageTabs = document.createElement("div"); pageTabs.className = "fis-page-tabs";
        const libraryTitle = document.createElement("div"); libraryTitle.className = "fis-library-title"; libraryTitle.textContent = "主题库";
        const floatingLabel = document.createElement("span"); floatingLabel.className = "fis-library-toggle-label"; floatingLabel.textContent = "显示主题设置侧边栏";
        const floatingSwitch = switchControl(state.floatingButtonEnabled, "显示设置按钮", checked => {
          state.floatingButtonEnabled = checked; persist(); syncFloatingUi(); renderFloating(); render();
        });
        floatingToggleRow.append(floatingLabel, floatingSwitch);
        pageTabs.append(libraryTitle);

        const importInput = document.createElement("input"); importInput.type = "file"; importInput.accept = "application/json,.json"; importInput.hidden = true;
        importInput.addEventListener("change", () => {
          const file = importInput.files && importInput.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try { state = normalizeState(JSON.parse(String(reader.result))); persist(); refreshAll(); ctx.ui.toast("自定义聊天主题已导入"); }
            catch (_) { ctx.ui.toast("导入失败：配置文件无效"); }
          };
          reader.readAsText(file);
        });
        const toolbar = document.createElement("div"); toolbar.className = "fis-toolbar";
        toolbar.append(
          iconButton("upload", "导入配置", () => importInput.click()),
          iconButton("download", "导出配置", () => {
            openFloatingDialog({
              title: "导出配置",
              message: "仅保存配色和样式，不包含图片本身",
              confirmLabel: "继续导出",
              onConfirm: () => {
                const exported = JSON.parse(JSON.stringify(state));
                const clearImages = regions => {
                  for (const region of Object.values(regions || {})) {
                    if (!region || typeof region !== "object") continue;
                    region.image = ""; region.fileName = "";
                  }
                };
                clearImages(exported.regions);
                for (const theme of Object.values(exported.themes || {})) clearImages(theme && theme.snapshot && theme.snapshot.regions);
                const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob); const link = document.createElement("a");
                link.href = url; link.download = "float-interface-skin.json"; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              },
            });
          }),
          importInput
        );
        head.append(pageTabs, toolbar); box.appendChild(head);

        if (activeSettingsPage === "colors") {
        if (!state.colorRules.some(rule => rule.id === activeColorRuleId)) activeColorRuleId = state.colorRules[0]?.id || "";
        const colorWorkspace = document.createElement("div"); colorWorkspace.className = "fis-color-workspace" + (state.colorsEnabled ? "" : " disabled");
        const subtabBar = document.createElement("div"); subtabBar.className = "fis-subtab-bar";
        const colorTabs = document.createElement("div"); colorTabs.className = "fis-subtab-strip fis-color-tabs" + (colorDeleteMode ? " delete-mode" : "");
        for (const rule of state.colorRules) {
          const tab = document.createElement("button"); tab.type = "button";
          tab.dataset.ruleId = rule.id;
          tab.className = "fis-color-tab" + (rule.id === activeColorRuleId && !colorDeleteMode ? " active" : "") + (colorDeleteSelection.has(rule.id) ? " selected" : "");
          tab.title = colorDeleteMode ? `选择删除 ${rule.color.toUpperCase()}` : `切换至 ${rule.color.toUpperCase()}`;
          tab.setAttribute("aria-label", tab.title);
          const mark = document.createElement("span"); mark.className = "fis-color-tab-mark"; mark.textContent = colorDeleteSelection.has(rule.id) ? "✓" : "";
          const heart = document.createElement("span"); heart.className = "fis-color-heart"; heart.textContent = "♥"; heart.style.color = rule.color;
          tab.append(mark, heart);
          tab.addEventListener("click", () => {
            if (colorDeleteMode) {
              colorDeleteSelection.has(rule.id) ? colorDeleteSelection.delete(rule.id) : colorDeleteSelection.add(rule.id);
            } else activeColorRuleId = rule.id;
            render();
          });
          colorTabs.appendChild(tab);
        }
        const switchBox = document.createElement("div"); switchBox.className = "fis-subtab-switch";
        switchBox.appendChild(switchControl(state.colorsEnabled, "启用全部主题配色", checked => {
          state.colorsEnabled = checked; persist(); apply(); render();
        }));
        subtabBar.append(colorTabs, switchBox); colorWorkspace.appendChild(subtabBar);

        const activeRule = state.colorRules.find(rule => rule.id === activeColorRuleId);
        if (activeRule && !colorDeleteMode) {
          const panel = document.createElement("div"); panel.className = "fis-color-panel";
          const colorEditor = document.createElement("div"); colorEditor.className = "fis-inline-color-editor";
          const picker = document.createElement("input"); picker.type = "color"; picker.value = activeRule.color;
          const colorText = document.createElement("input"); colorText.type = "text"; colorText.maxLength = 7; colorText.value = activeRule.color.toUpperCase();
          const updateColor = value => {
            if (!/^#[0-9a-f]{6}$/i.test(value)) return;
            activeRule.color = value.toLowerCase(); picker.value = activeRule.color; colorText.value = activeRule.color.toUpperCase();
            const activeTab = [...colorTabs.children].find(node => node.dataset.ruleId === activeRule.id);
            if (activeTab) {
              activeTab.querySelector(".fis-color-heart").style.color = activeRule.color;
              activeTab.title = `切换至 ${activeRule.color.toUpperCase()}`;
              activeTab.setAttribute("aria-label", activeTab.title);
            }
            persist(); apply();
          };
          picker.addEventListener("input", () => updateColor(picker.value));
          colorText.addEventListener("change", () => updateColor(colorText.value));
          colorText.addEventListener("blur", () => { colorText.value = activeRule.color.toUpperCase(); });
          colorEditor.append(picker, colorText); panel.appendChild(colorEditor);

          const options = document.createElement("div"); options.className = "fis-target-options";
          for (const target of COLOR_TARGETS) {
            const option = document.createElement("label"); option.className = "fis-target-option";
            const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = activeRule.targets.includes(target.key);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) {
                for (const otherRule of state.colorRules) otherRule.targets = otherRule.targets.filter(key => key !== target.key);
                if (!activeRule.targets.includes(target.key)) activeRule.targets.push(target.key);
              } else activeRule.targets = activeRule.targets.filter(key => key !== target.key);
              persist(); apply(); render();
            });
            const label = document.createElement("span"); label.textContent = target.label;
            option.append(checkbox, label); options.appendChild(option);
          }
          panel.appendChild(options); colorWorkspace.appendChild(panel);
        }
        if (!state.colorRules.length) {
          const empty = document.createElement("div"); empty.className = "fis-color-panel fis-empty"; empty.textContent = "尚未添加主题颜色"; colorWorkspace.appendChild(empty);
        }
        const colorActions = document.createElement("div"); colorActions.className = "fis-color-actions";
        const addColor = button("＋ 新增颜色", "primary", () => {
          if (state.colorRules.length >= 10) return;
          const rule = { id: colorRuleId(), color: "#8f76b8", targets: [] };
          state.colorRules.push(rule); activeColorRuleId = rule.id;
          persist(); render();
        });
        addColor.disabled = colorDeleteMode || state.colorRules.length >= 10;
        addColor.title = state.colorRules.length >= 10 ? "最多保存 10 个颜色" : "新增颜色";
        const deleteColor = button(colorDeleteMode ? (colorDeleteSelection.size ? `删除 (${colorDeleteSelection.size})` : "取消删除") : "删除颜色", "danger", () => {
          if (!colorDeleteMode) {
            colorDeleteMode = true; colorDeleteSelection.clear(); render(); return;
          }
          if (!colorDeleteSelection.size) {
            colorDeleteMode = false; render(); return;
          }
          if (!confirm(`确定删除选中的 ${colorDeleteSelection.size} 种颜色？`)) return;
          state.colorRules = state.colorRules.filter(rule => !colorDeleteSelection.has(rule.id));
          if (!state.colorRules.some(rule => rule.id === activeColorRuleId)) activeColorRuleId = state.colorRules[0]?.id || "";
          colorDeleteSelection.clear(); colorDeleteMode = false; persist(); apply(); render();
        });
        colorActions.append(addColor, deleteColor); colorWorkspace.appendChild(colorActions);
        box.appendChild(colorWorkspace);
        }

        if (activeSettingsPage === "inputs") {
          const inputStyle = state.inputStyle;
          const card = document.createElement("section"); card.className = "fis-input-style-card";
          const inputHead = document.createElement("div"); inputHead.className = "fis-input-style-head";
          const enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.className = "fis-color-enabled"; enabled.checked = inputStyle.enabled;
          enabled.title = "启用输入框样式";
          const heading = document.createElement("div"); heading.className = "fis-region-name"; heading.textContent = "输入框样式";
          inputHead.append(enabled, heading); card.appendChild(inputHead);

          const body = document.createElement("div"); body.className = "fis-input-style-body" + (inputStyle.enabled ? "" : " disabled");
          const targets = document.createElement("div"); targets.className = "fis-input-targets";
          for (const [key, labelText] of INPUT_STYLE_TARGETS) {
            const option = document.createElement("label"); option.className = "fis-input-target";
            const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = inputStyle.applyTargets.includes(key);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked && !inputStyle.applyTargets.includes(key)) inputStyle.applyTargets.push(key);
              if (!checkbox.checked) inputStyle.applyTargets = inputStyle.applyTargets.filter(item => item !== key);
              persist(); apply();
            });
            option.append(checkbox, document.createTextNode(labelText)); targets.appendChild(option);
          }
          addRow(body, "作用位置", targets);
          addRow(body, "圆角", rangeControl(inputStyle, "radius", 0, 50, 1, "px"));

          const borderOptions = document.createElement("div"); borderOptions.className = "fis-input-targets";
          const borderlessOption = document.createElement("label"); borderlessOption.className = "fis-input-target";
          const borderless = document.createElement("input"); borderless.type = "checkbox"; borderless.checked = inputStyle.borderless;
          borderless.addEventListener("change", () => { inputStyle.borderless = borderless.checked; persist(); apply(); render(); });
          borderlessOption.append(borderless, document.createTextNode("无边框")); borderOptions.appendChild(borderlessOption);
          addRow(body, "边框", borderOptions);

          const colorPair = document.createElement("div"); colorPair.className = "fis-color-pair";
          const colorPicker = document.createElement("input"); colorPicker.type = "color"; colorPicker.value = inputStyle.borderColor;
          const colorText = document.createElement("input"); colorText.type = "text"; colorText.className = "fis-number"; colorText.maxLength = 7; colorText.value = inputStyle.borderColor.toUpperCase();
          const updateBorderColor = color => {
            if (!/^#[0-9a-f]{6}$/i.test(color)) return;
            inputStyle.borderColor = color.toLowerCase(); colorPicker.value = inputStyle.borderColor; colorText.value = inputStyle.borderColor.toUpperCase();
            persist(); apply();
          };
          colorPicker.addEventListener("input", () => updateBorderColor(colorPicker.value));
          colorText.addEventListener("change", () => updateBorderColor(colorText.value));
          colorText.addEventListener("blur", () => { colorText.value = inputStyle.borderColor.toUpperCase(); });
          colorPair.append(colorPicker, colorText); addRow(body, "边框颜色", colorPair);

          enabled.addEventListener("change", () => { inputStyle.enabled = enabled.checked; persist(); apply(); render(); });
          card.appendChild(body); box.appendChild(card);
        }

        if (activeSettingsPage === "themes") {
          const list = document.createElement("div"); list.className = "fis-theme-list";
          const themes = Object.values(state.themes);
          for (const theme of themes) {
            const card = document.createElement("section"); card.className = "fis-theme-card";
            const copy = document.createElement("div");
            const name = document.createElement("div"); name.className = "fis-theme-name"; name.textContent = theme.name;
            const hint = document.createElement("div"); hint.className = "fis-theme-hint";
            const imageCount = Object.values(theme.snapshot.regions || {}).filter(region => region && region.image).length;
            copy.appendChild(name);
            if (imageCount) { hint.textContent = `包含 ${imageCount} 张图片`; copy.appendChild(hint); }

            const actions = document.createElement("div"); actions.className = "fis-theme-actions";
            actions.append(
              iconButton("check", `应用主题：${theme.name}`, () => {
                const savedThemes = state.themes;
                const floatingButtonEnabled = state.floatingButtonEnabled;
                const next = normalizeState(theme.snapshot);
                next.themes = savedThemes; next.floatingButtonEnabled = floatingButtonEnabled;
                state = next; persist(); refreshAll(); ctx.ui.toast(`已应用主题：${theme.name}`);
              }, "primary"),
              iconButton("save", `用当前设置覆盖：${theme.name}`, () => {
                openFloatingDialog({
                  title: "覆盖主题",
                  message: `确定用当前设置覆盖“${theme.name}”吗？`,
                  confirmLabel: "覆盖",
                  onConfirm: () => { theme.snapshot = themeSnapshot(state); persist(); render(); ctx.ui.toast("主题已更新"); },
                });
              }),
              iconButton("pencil", `重命名主题：${theme.name}`, () => {
                openFloatingDialog({
                  title: "重命名主题",
                  inputValue: theme.name,
                  inputPlaceholder: "主题名称",
                  confirmLabel: "保存",
                  onConfirm: value => {
                    const nextName = String(value || "").trim();
                    if (!nextName) return false;
                    theme.name = nextName; persist(); render();
                  },
                });
              }),
              iconButton("trash", `删除主题：${theme.name}`, () => {
                openFloatingDialog({
                  title: "删除主题",
                  message: `确定删除“${theme.name}”吗？此操作无法撤销。`,
                  confirmLabel: "删除",
                  danger: true,
                  onConfirm: () => { delete state.themes[theme.id]; persist(); render(); },
                });
              }, "danger")
            );
            card.append(copy, actions); list.appendChild(card);
          }
          if (!themes.length) {
            const empty = document.createElement("div"); empty.className = "fis-empty";
            empty.textContent = "还没有保存主题，请打开悬浮设置并点击书签＋图标保存";
            list.appendChild(empty);
          }
          box.appendChild(list);
        }

        if (activeSettingsPage === "images") {
        if (!IMAGE_REGION_DEFS.some(def => def.key === activeImageRegionKey)) activeImageRegionKey = IMAGE_REGION_DEFS[0].key;
        const imageWorkspace = document.createElement("div"); imageWorkspace.className = "fis-image-workspace" + (state.imagesEnabled ? "" : " disabled");
        const imageBar = document.createElement("div"); imageBar.className = "fis-subtab-bar";
        const imageTabs = document.createElement("div"); imageTabs.className = "fis-subtab-strip";
        const imageTabLabels = { appBackground: "背景", topBar: "顶部栏", bottomBar: "底部栏" };
        for (const tabDef of IMAGE_REGION_DEFS) {
          const tab = document.createElement("button"); tab.type = "button";
          tab.className = "fis-image-tab" + (tabDef.key === activeImageRegionKey ? " active" : "");
          tab.textContent = imageTabLabels[tabDef.key];
          tab.addEventListener("click", () => { activeImageRegionKey = tabDef.key; render(); });
          imageTabs.appendChild(tab);
        }
        const imageSwitchBox = document.createElement("div"); imageSwitchBox.className = "fis-subtab-switch";
        imageSwitchBox.appendChild(switchControl(state.imagesEnabled, "启用全部图片设置", checked => {
          state.imagesEnabled = checked; persist(); apply(); render();
        }));
        imageBar.append(imageTabs, imageSwitchBox); imageWorkspace.appendChild(imageBar);

        const def = IMAGE_REGION_DEFS.find(item => item.key === activeImageRegionKey);
        if (def) {
          const region = state.regions[def.key];
          const card = document.createElement("section"); card.className = "fis-region";
          const summary = document.createElement("div"); summary.className = "fis-region-summary";
          const enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.className = "fis-region-enabled"; enabled.checked = region.enabled;
          enabled.title = "启用区域";
          enabled.addEventListener("change", () => { region.enabled = enabled.checked; persist(); apply(); });
          const thumb = document.createElement("div"); thumb.className = "fis-thumb"; if (region.image) thumb.style.backgroundImage = cssUrl(region.image);
          const copy = document.createElement("div");
          const name = document.createElement("div"); name.className = "fis-region-name"; name.textContent = def.label;
          const hint = document.createElement("div"); hint.className = "fis-region-hint"; hint.textContent = region.image ? (region.fileName || "已上传图片") : def.hint;
          copy.append(name, hint);
          const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = "image/png,image/webp,image/jpeg"; fileInput.hidden = true;
          fileInput.addEventListener("change", () => {
            const file = fileInput.files && fileInput.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { region.image = String(reader.result || ""); region.fileName = file.name; persist(); apply(); render(); };
            reader.readAsDataURL(file);
          });
          const actions = document.createElement("div"); actions.className = "fis-region-actions";
          actions.append(button("选择", "primary", () => fileInput.click()), button("清除", "danger", () => { region.image = ""; region.fileName = ""; persist(); apply(); render(); }), fileInput);
          summary.append(enabled, thumb, copy, actions);
          card.appendChild(summary);

          const panel = document.createElement("div"); panel.className = "fis-panel";
          if (def.targets) {
            const targets = document.createElement("div"); targets.className = "fis-input-targets";
            for (const [key, labelText] of def.targets) {
              const option = document.createElement("label"); option.className = "fis-input-target";
              const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = region.applyTargets.includes(key);
              checkbox.addEventListener("change", () => {
                if (checkbox.checked && !region.applyTargets.includes(key)) region.applyTargets.push(key);
                if (!checkbox.checked) region.applyTargets = region.applyTargets.filter(item => item !== key);
                persist(); apply();
              });
              option.append(checkbox, document.createTextNode(labelText)); targets.appendChild(option);
            }
            addRow(panel, "作用位置", targets);
          }
          addRow(panel, "图片缩放", rangeControl(region, "scale", 0.1, 3, 0.05, "×"));
          addRow(panel, "图片模糊", rangeControl(region, "blur", 0, 30, 1, "px", true));
          addRow(panel, "水平位置", rangeControl(region, "positionX", 0, 100, 1, "%"));
          addRow(panel, "垂直位置", rangeControl(region, "positionY", 0, 100, 1, "%"));
          if (def.overflow) addRow(panel, "上下超界", rangeControl(region, "overflowY", 0, 300, 1, "px"));
          card.appendChild(panel); imageWorkspace.appendChild(card);
        }
        box.appendChild(imageWorkspace);
        }
      };

      refreshers.add(render); render();
      return () => { alive = false; refreshers.delete(render); floatingToggleRow.remove(); box.remove(); };
    });

    apply();
    ctx.hooks.on("app.ready", apply);
    ctx.hooks.on("session.opened", apply);

    return () => {
      disposed = true;
      for (const timer of blurTimers.values()) clearTimeout(timer);
      blurTimers.clear();
      blurredImageCache.clear();
      for (const objectUrl of imageObjectUrls.values()) URL.revokeObjectURL(objectUrl);
      imageObjectUrls.clear();
      window.removeEventListener("resize", onFloatingResize);
      scopeObserver.disconnect();
      root.removeAttribute("data-fis-view-scope");
      root.removeAttribute("data-fis-background-scope");
      clearApplied();
      floatingButton.remove();
      floatingPanel.remove();
      document.querySelector(".fis-dialog-overlay")?.remove();
      style.remove();
      refreshers.clear();
    };
  },
};
