export default {
  manifest: {
    id: "image-api-presets",
    name: "生图 API / 提示词预设",
    apiVersion: 1,
    version: "1.5.4",
    author: "Cyrus",
    description: "API 与提示词分栏保存；4.5 锁脸直连中转，参考图补官方画布。",
    permissions: ["storage", "ui", "ai"],
  },

  setup(ctx) {
    const MARK = "data-img-api-presets";
    const SIG = "data-img-sig";
    const NEG = "data-iap-neg";
    const STORE = "v1";
    let webpackRequire = null;
    let loadFn = null;
    let saveFn = null;
    let scanTimer = null;
    let alive = true;
    let notice = "";
    let noticeErr = false;
    let editor = null;

    ctx.ui.injectCSS(`
      [${MARK}] { margin: 0; }
      [${MARK}] .iap-box {
        display: flex; flex-direction: column; gap: 10px;
        padding: 12px; border-radius: 12px;
        background: color-mix(in srgb, var(--c-input, #f3f3f3) 40%, transparent);
        border: 1px solid var(--c-card-border, rgba(0,0,0,.08));
      }
      [${MARK}] .iap-box + .iap-box { margin-top: 10px; }
      [${MARK}] .iap-row {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      [${MARK}] .iap-row > .iap-grow { flex: 1 1 160px; min-width: 0; }
      [${MARK}] .iap-title { font-size: 13px; font-weight: 600; }
      [${MARK}] .iap-hint { font-size: 11px; opacity: .65; line-height: 1.4; }
      [${MARK}] .iap-notice {
        font-size: 12px; line-height: 1.4; padding: 8px 10px; border-radius: 8px;
        background: color-mix(in srgb, var(--c-success, #16a34a) 14%, transparent);
      }
      [${MARK}] .iap-notice.iap-err {
        background: color-mix(in srgb, var(--c-danger, #dc2626) 14%, transparent);
      }
      [${MARK}] select, [${MARK}] input { width: 100%; }
      [${MARK}] .iap-toggle {
        display: flex; align-items: flex-start; gap: 8px;
        font-size: 13px; line-height: 1.4; cursor: pointer;
      }
      [${MARK}] .iap-toggle input { width: auto; margin-top: 2px; flex: none; }
      [${NEG}] { margin-top: 4px; }
      [${NEG}] textarea { width: 100%; min-height: 88px; }
    `);

    const newId = () => "iap_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

    const emptyState = () => ({
      presets: [],
      activeId: "",
      prompts: [],
      activePromptId: "",
      promptsMigrated: true,
      naiRelay: false,
      liveNegative: "",
    });

    const normalizePrompt = (p) => {
      const item = p && typeof p === "object" ? { ...p } : {};
      if (typeof item.negativePrompt !== "string") {
        item.negativePrompt = typeof item.naiNegative === "string" ? item.naiNegative : "";
      }
      return item;
    };

    const loadStore = () => {
      const raw = ctx.system.storage.get(STORE);
      if (!raw || typeof raw !== "object") return emptyState();
      const presets = Array.isArray(raw.presets) ? raw.presets.map((p) => ({ ...p })) : [];
      let prompts = Array.isArray(raw.prompts) ? raw.prompts.map(normalizePrompt) : [];
      let migrated = raw.promptsMigrated === true;
      if (!migrated) {
        for (const p of presets) {
          const extra = p && typeof p.extraPrompt === "string" ? p.extraPrompt : "";
          if (extra.trim()) {
            prompts.push({
              id: newId(),
              name: (p.name || "未命名") + " · 提示词",
              extraPrompt: extra,
              negativePrompt: "",
              naiPositive: "",
              naiNegative: "",
            });
          }
          if (p) delete p.extraPrompt;
        }
        migrated = true;
        const next = {
          presets,
          activeId: typeof raw.activeId === "string" ? raw.activeId : "",
          prompts,
          activePromptId: typeof raw.activePromptId === "string" ? raw.activePromptId : "",
          promptsMigrated: true,
          naiRelay: raw.naiRelay === true,
          liveNegative: typeof raw.liveNegative === "string" ? raw.liveNegative : "",
        };
        ctx.system.storage.set(STORE, next);
        return next;
      }
      return {
        presets,
        activeId: typeof raw.activeId === "string" ? raw.activeId : "",
        prompts,
        activePromptId: typeof raw.activePromptId === "string" ? raw.activePromptId : "",
        promptsMigrated: true,
        naiRelay: raw.naiRelay === true,
        liveNegative: typeof raw.liveNegative === "string" ? raw.liveNegative : "",
      };
    };

    const saveStore = (state) => {
      ctx.system.storage.set(STORE, state);
    };

    const isNaiRelay = () => loadStore().naiRelay === true;

    const NAI_PHOTO_HINT = [
      "【覆盖上文「发照片」的画面描述规则】当前生图走 NovelAI 中转，不是 gpt-image。",
      "写 [照片:使用参考图:描述] 或 [照片:不使用参考图:描述] 时，描述必须是 NovelAI / Danbooru 英文标签，逗号分隔。",
      "只写看得见的：人数(1boy/1girl)、外貌、发型发色瞳色、服装或裸露、姿势、构图(from above, selfie, looking at viewer)、光线、场景。",
      "禁止：中文长句、心理、声音、剧情、代词、质量词(masterpiece, best quality, absurdres 等质量词由预设提供)。",
      "示例：[照片:不使用参考图:1boy, adult man, blonde hair, blue eyes, shirtless, loose shorts, defined abs, sitting on bed, holding smartphone, from above, smirk, dim bedroom, warm lamp light]",
    ].join("\n");

    const syncNaiPhotoHint = () => {
      if (typeof ctx.prompts?.set !== "function") return;
      if (isNaiRelay()) ctx.prompts.set(NAI_PHOTO_HINT);
      else if (typeof ctx.prompts.clear === "function") ctx.prompts.clear();
      else ctx.prompts.set("");
    };

    const setNaiRelay = (on) => {
      const next = loadStore();
      next.naiRelay = on === true;
      saveStore(next);
      syncNaiPhotoHint();
    };

    const getWebpackRequire = () => {
      if (webpackRequire) return webpackRequire;
      const g = typeof globalThis !== "undefined" ? globalThis : window;
      if (!g) return null;
      const name = Object.getOwnPropertyNames(g).find((k) => k.startsWith("webpackChunk"));
      if (!name || !Array.isArray(g[name])) return null;
      try {
        g[name].push([["iap-host-" + Date.now()], {}, (req) => { webpackRequire = req; }]);
      } catch { /* ignore */ }
      return webpackRequire;
    };

    const eachWebpackExport = (visit) => {
      const req = getWebpackRequire();
      const cache = req && req.c;
      if (!cache) return;
      for (const id of Object.keys(cache)) {
        const exp = cache[id] && cache[id].exports;
        if (!exp) continue;
        try { visit(exp); } catch { /* ignore */ }
      }
    };

    const srcOf = (fn) => {
      try { return Function.prototype.toString.call(fn); } catch { return ""; }
    };

    const pickHostFns = () => {
      if (typeof loadFn === "function" && typeof saveFn === "function") return true;
      const found = { load: null, save: null };
      eachWebpackExport((exp) => {
        if (!exp || typeof exp !== "object") return;
        if (typeof exp.loadImageGenerationSettings === "function") found.load = exp.loadImageGenerationSettings;
        if (typeof exp.saveImageGenerationSettings === "function") found.save = exp.saveImageGenerationSettings;
        if (exp.default) {
          if (typeof exp.default.loadImageGenerationSettings === "function") found.load = exp.default.loadImageGenerationSettings;
          if (typeof exp.default.saveImageGenerationSettings === "function") found.save = exp.default.saveImageGenerationSettings;
        }
        if (found.load && found.save) return;
        for (const key of Object.keys(exp)) {
          const fn = exp[key];
          if (typeof fn !== "function") continue;
          const src = srcOf(fn);
          if (!src.includes("ai_phone_image_generation_settings_v1")) continue;
          if (src.includes("settings-image-generation-updated") && fn.length >= 1) found.save = fn;
          else if (fn.length === 0) found.load = fn;
        }
      });
      if (found.load) loadFn = found.load;
      if (found.save) saveFn = found.save;
      return typeof loadFn === "function" && typeof saveFn === "function";
    };

    const hostLoad = () => {
      pickHostFns();
      if (typeof loadFn !== "function") return null;
      try {
        const s = loadFn();
        return s && typeof s === "object" ? s : null;
      } catch { return null; }
    };

    const hostSave = (settings) => {
      pickHostFns();
      if (typeof saveFn !== "function") return false;
      saveFn(settings);
      return true;
    };

    const flash = (text, isErr) => {
      notice = String(text || "");
      noticeErr = isErr === true;
      try { ctx.ui.toast(notice); } catch { /* 设置页不一定看得到 toast */ }
      try { ctx.system.log(notice); } catch { /* ignore */ }
      scheduleScan();
    };

    const activeNaiPreset = (s) => {
      const nai = s && s.novelai;
      const list = nai && Array.isArray(nai.presets) ? nai.presets : [];
      if (!list.length) return null;
      return list.find((p) => p.id === nai.activePresetId) || list[0];
    };

    const readField = (root, label) => {
      const el = root && fieldControl(root, label);
      return el && typeof el.value === "string" ? el.value : "";
    };

    const snapshotApi = () => {
      const s = hostLoad();
      const root = findPageRoot();
      const providerRaw = readField(root, "生图提供方 / 引擎");
      const requestRaw = readField(root, "请求方式");
      const provider = providerRaw === "novelai" || (!providerRaw && s && s.provider === "novelai")
        ? "novelai"
        : "openai";
      const requestMode = requestRaw === "direct" || (!requestRaw && s && s.requestMode === "direct")
        ? "direct"
        : "server";
      const snap = {
        provider,
        requestMode,
        apiKey: readField(root, "API Key") || String((s && s.apiKey) || ""),
        baseUrl: readField(root, "Base URL") || String((s && s.baseUrl) || ""),
        model: readField(root, "模型名") || String((s && s.model) || ""),
        size: readField(root, "尺寸") || String((s && s.size) || "1024x1024"),
        quality: readField(root, "质量") || String((s && s.quality) || "auto"),
        novelaiApiKey: readField(root, "NovelAI API Token") || String((s && s.novelai && s.novelai.apiKey) || ""),
        naiRelay: isNaiRelay(),
      };
      if (!root && !s) throw new Error("请停在「图像生成 API」这一页，保存的是下面填的内容");
      if (snap.provider !== "novelai" && !snap.baseUrl && !snap.apiKey && !snap.model) {
        throw new Error("下面还没填地址 / Key / 模型");
      }
      return snap;
    };

    const snapshotPrompt = () => {
      const s = hostLoad();
      const root = findPageRoot();
      const nai = activeNaiPreset(s);
      const extraPrompt = readField(root, "补充提示词") || String((s && s.extraPrompt) || "");
      const naiPositive = readField(root, "画师串 / 正面质量提示词 (Positive / Quality)")
        || String((nai && nai.positivePrompt) || "");
      const naiNegative = readField(root, "负面提示词 (Undesired Content / Negative)")
        || String((nai && nai.negativePrompt) || "");
      const negEl = root && fieldControl(root, "负面提示词（NAI 中转）");
      const negativePrompt = negEl && typeof negEl.value === "string"
        ? negEl.value
        : String(loadStore().liveNegative || "");
      if (!root && !s) throw new Error("请停在「图像生成 API」这一页，保存的是下面填的内容");
      return { extraPrompt, negativePrompt, naiPositive, naiNegative };
    };

    const hostLabel = (p) => {
      if (p.provider === "novelai") return "NovelAI";
      try {
        const u = new URL(p.baseUrl);
        return u.host || p.baseUrl;
      } catch {
        return p.baseUrl || "未填地址";
      }
    };

    const promptPreview = (p) => {
      const text = String(p.extraPrompt || p.naiPositive || "").replace(/\s+/g, " ").trim();
      if (!text) return "空提示词";
      return text.length > 24 ? text.slice(0, 24) + "…" : text;
    };

    const setNativeValue = (el, value) => {
      if (!el) return;
      const proto = el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : el.tagName === "SELECT"
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const tracker = el._valueTracker;
      if (tracker && typeof tracker.setValue === "function") tracker.setValue("");
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const fieldControl = (root, labelText) => {
      const nodes = root.querySelectorAll("label, .menu-desc");
      for (const node of nodes) {
        if ((node.textContent || "").trim() !== labelText) continue;
        const wrap = node.parentElement;
        if (!wrap) continue;
        const el = wrap.querySelector("input:not([type=checkbox]), textarea, select");
        if (el) return el;
      }
      return null;
    };

    const waitFrames = (n) => new Promise((resolve) => {
      const step = (left) => {
        if (left <= 0) resolve();
        else requestAnimationFrame(() => step(left - 1));
      };
      step(n);
    });

    const findPageRoot = () => {
      const h2s = document.querySelectorAll("h2");
      for (const h of h2s) {
        if ((h.textContent || "").trim() !== "Image Generation") continue;
        return h.closest(".flex.flex-col.gap-6") || (h.parentElement && h.parentElement.parentElement);
      }
      return null;
    };

    const currentNegative = () => {
      if (!isNaiRelay()) return "";
      const page = findPageRoot();
      const el = page && fieldControl(page, "负面提示词（NAI 中转）");
      if (el && typeof el.value === "string" && el.value.trim()) return el.value.trim();
      const state = loadStore();
      if (typeof state.liveNegative === "string" && state.liveNegative.trim()) return state.liveNegative.trim();
      const p = pickById(state.prompts, state.activePromptId);
      return String((p && (p.negativePrompt || p.naiNegative)) || "").trim();
    };

    const syncApiForm = async (p) => {
      const root = findPageRoot();
      if (!root) return;
      setNativeValue(fieldControl(root, "生图提供方 / 引擎"), p.provider);
      setNativeValue(fieldControl(root, "请求方式"), p.requestMode);
      await waitFrames(6);
      const page = findPageRoot() || root;
      if (p.provider === "novelai") {
        setNativeValue(fieldControl(page, "NovelAI API Token"), p.novelaiApiKey);
        return;
      }
      setNativeValue(fieldControl(page, "Base URL"), p.baseUrl);
      setNativeValue(fieldControl(page, "API Key"), p.apiKey);
      setNativeValue(fieldControl(page, "模型名"), p.model);
      setNativeValue(fieldControl(page, "尺寸"), p.size);
      setNativeValue(fieldControl(page, "质量"), p.quality);
    };

    const syncPromptForm = (p) => {
      const page = findPageRoot();
      if (!page) return;
      setNativeValue(fieldControl(page, "补充提示词"), p.extraPrompt);
      setNativeValue(fieldControl(page, "画师串 / 正面质量提示词 (Positive / Quality)"), p.naiPositive);
      setNativeValue(fieldControl(page, "负面提示词 (Undesired Content / Negative)"), p.naiNegative);
      const neg = fieldControl(page, "负面提示词（NAI 中转）");
      if (neg) setNativeValue(neg, p.negativePrompt || "");
    };

    const applyApi = async (p) => {
      const s = hostLoad();
      if (s) {
        const next = {
          ...s,
          provider: p.provider,
          requestMode: p.requestMode,
          apiKey: p.apiKey,
          baseUrl: p.baseUrl,
          model: p.model,
          size: p.size,
          quality: p.quality,
        };
        if (p.provider === "novelai") {
          next.novelai = { ...(s.novelai || {}), apiKey: p.novelaiApiKey };
        }
        hostSave(next);
      }
      setNaiRelay(p.naiRelay === true);
      await syncApiForm(p);
    };

    const applyPrompt = (p) => {
      const s = hostLoad();
      if (s) {
        const next = { ...s, extraPrompt: p.extraPrompt || "" };
        if (next.novelai && Array.isArray(next.novelai.presets) && next.novelai.presets.length) {
          const activeId = next.novelai.activePresetId;
          next.novelai = {
            ...next.novelai,
            presets: next.novelai.presets.map((item, i) => {
              const isActive = activeId ? item.id === activeId : i === 0;
              if (!isActive) return item;
              return {
                ...item,
                positivePrompt: p.naiPositive || "",
                negativePrompt: p.naiNegative || "",
              };
            }),
          };
        }
        hostSave(next);
      }
      const stateNow = loadStore();
      stateNow.liveNegative = typeof p.negativePrompt === "string" ? p.negativePrompt : "";
      saveStore(stateNow);
      syncPromptForm(p);
    };

    const extraPromptWrap = (root) => {
      const nodes = root.querySelectorAll("label, .menu-desc");
      for (const node of nodes) {
        if ((node.textContent || "").trim() !== "补充提示词") continue;
        return node.parentElement;
      }
      return null;
    };

    const mountNegativeField = (root) => {
      const extra = extraPromptWrap(root);
      const existing = root.querySelector("[" + NEG + "]");
      if (!isNaiRelay() || !extra) {
        if (existing) existing.remove();
        return;
      }
      if (existing) {
        const ta = existing.querySelector("textarea");
        if (ta && document.activeElement !== ta) {
          const val = String(loadStore().liveNegative || "");
          if (ta.value !== val) ta.value = val;
        }
        return;
      }
      const wrap = document.createElement("div");
      wrap.setAttribute(NEG, "1");
      wrap.className = "flex flex-col gap-1";
      const label = document.createElement("label");
      label.className = "menu-desc ml-1";
      label.textContent = "负面提示词（NAI 中转）";
      const ta = document.createElement("textarea");
      ta.className = "ui-input";
      ta.rows = 4;
      ta.placeholder = "lowres, bad anatomy, bad hands… 单独发给中转，不要写进上面。";
      ta.value = String(loadStore().liveNegative || "");
      ta.addEventListener("input", () => {
        const stateNow = loadStore();
        stateNow.liveNegative = ta.value;
        saveStore(stateNow);
      });
      const hint = document.createElement("p");
      hint.className = "menu-desc ml-1";
      hint.style.opacity = ".7";
      hint.textContent = "单独进官方负面栏，不写进正面。空着则让中转自己用默认 UC。gpt-image 请关掉上面的 NAI 中转。";
      wrap.appendChild(label);
      wrap.appendChild(ta);
      wrap.appendChild(hint);
      if (extra.parentElement) extra.parentElement.insertBefore(wrap, extra.nextSibling);
    };

    const naiGenerateUrl = (baseOrUrl) => {
      let s = String(baseOrUrl || "").trim();
      try {
        const u = new URL(s, typeof location !== "undefined" ? location.href : "http://local");
        s = u.origin + u.pathname;
      } catch { /* keep raw */ }
      s = s
        .replace(/\/+$/, "")
        .replace(/\/images\/(?:generations|edits)$/i, "")
        .replace(/\/images$/i, "")
        .replace(/\/v1$/i, "");
      return s + "/ai/generate-image";
    };

    const stripDescToken = (text) => String(text || "")
      .replace(/\{\{\s*description\s*\}\}/gi, "")
      .replace(/,\s*,/g, ",")
      .replace(/^\s*,\s*|\s*,\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const splitNaiPrompt = (prompt) => {
      const raw = String(prompt || "").trim();
      const idx = raw.lastIndexOf("\n\n");
      let scene = raw;
      let extra = "";
      if (idx >= 0) {
        scene = raw.slice(0, idx).trim();
        extra = stripDescToken(raw.slice(idx + 2));
      }
      scene = scene.replace(/\b1man\b/gi, "1boy");
      if (!scene && extra) return { base: extra, char: extra };
      if (!scene) scene = raw.replace(/\b1man\b/gi, "1boy");
      return { base: extra, char: scene };
    };

    const parseWxH = (size) => {
      const m = String(size || "").match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (m) {
        let w = Math.round(Math.max(64, Math.min(2048, parseInt(m[1], 10))) / 64) * 64;
        let h = Math.round(Math.max(64, Math.min(2048, parseInt(m[2], 10))) / 64) * 64;
        if (w >= 64 && h >= 64) return { width: w, height: h };
      }
      return { width: 832, height: 1216 };
    };

    const isNaiV5 = (model) => /nai-diffusion-5/i.test(String(model || ""));
    const isNaiV45 = (model) => /nai-diffusion-4-5/i.test(String(model || ""));

    const preferredRefMode = (model) => {
      if (isNaiV5(model)) return "img2img";
      if (isNaiV45(model)) return "director";
      return "vibe";
    };

    const fallbackRefModes = (mode) => {
      if (mode === "director") return ["vibe", "img2img"];
      if (mode === "vibe") return ["img2img"];
      return [];
    };

    const dataUrlToRawB64 = (value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      const m = s.match(/^data:[^;]+;base64,([\s\S]+)$/i);
      if (m) return m[1].replace(/\s+/g, "");
      if (s.length > 64 && !s.startsWith("http")) return s.replace(/\s+/g, "");
      return "";
    };

    const blobToRawB64 = async (blob) => {
      if (!blob || typeof blob.arrayBuffer !== "function") return "";
      return bufToB64(await blob.arrayBuffer());
    };

    const stripReference = (body) => {
      body.action = "generate";
      const p = body.parameters;
      delete p.image;
      delete p.strength;
      delete p.noise;
      delete p.img2img;
      delete p.reference_image_multiple;
      delete p.reference_information_extracted_multiple;
      delete p.reference_strength_multiple;
      delete p.director_reference_images;
      delete p.director_reference_information_extracted;
      delete p.director_reference_strength_values;
      delete p.director_reference_secondary_strength_values;
      delete p.director_reference_descriptions;
      p.add_original_image = false;
    };

    const attachReference = (body, rawB64, mode) => {
      stripReference(body);
      if (!rawB64 || mode === "none") return "none";
      const p = body.parameters;
      if (mode === "img2img") {
        body.action = "img2img";
        p.image = rawB64;
        p.strength = 0.7;
        p.noise = 0;
        p.add_original_image = true;
        p.img2img = { color_correct: true, strength: 0.7 };
        return "img2img";
      }
      if (mode === "vibe") {
        p.reference_image_multiple = [rawB64];
        p.reference_information_extracted_multiple = [1];
        p.reference_strength_multiple = [0.6];
        return "vibe";
      }
      p.director_reference_images = [rawB64];
      p.director_reference_information_extracted = [1];
      p.director_reference_strength_values = [1];
      p.director_reference_secondary_strength_values = [0.5];
      p.director_reference_descriptions = [{
        caption: { base_caption: "character&style", char_captions: [] },
        legacy_uc: false,
      }];
      return "director";
    };

    const noteReferenceMode = (mode) => {
      if (mode === "img2img") {
        try { ctx.ui.toast("V5 官方还没开角色参考，这张按图生图带上参考图。要锁脸把模型换成 4.5"); } catch { /* ignore */ }
        try { ctx.system.log("NAI 参考图：V5 走 img2img"); } catch { /* ignore */ }
      } else if (mode === "director") {
        try { ctx.system.log("NAI 参考图：4.5 角色参考 director character&style"); } catch { /* ignore */ }
      } else if (mode === "vibe") {
        try { ctx.system.log("NAI 参考图：氛围转移 vibe"); } catch { /* ignore */ }
      }
    };

    const shouldFallbackRef = (err, mode) => {
      if (mode === "none") return false;
      const msg = err instanceof Error ? err.message : String(err);
      const status = err && err.status;
      if (status === 400) return true;
      if (/ 400[:\s]|non-200 response:\s*400/i.test(msg)) return true;
      if (mode === "director" && /director/i.test(msg)) return true;
      return false;
    };

    const loadRefImage = async (rawB64) => {
      const loadImg = (src) => new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("参考图读不出来"));
        el.src = src;
      });
      try {
        return await loadImg("data:image/png;base64," + rawB64);
      } catch {
        return await loadImg("data:image/jpeg;base64," + rawB64);
      }
    };

    const canvasToPngB64 = (canvas) => dataUrlToRawB64(canvas.toDataURL("image/png"));

    const normalizeRefPng = async (rawB64) => {
      if (!rawB64) return "";
      try {
        const img = await loadRefImage(rawB64);
        const max = 1024;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (!w || !h) return rawB64;
        if (w > max || h > max) {
          const scale = max / Math.max(w, h);
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d");
        if (!g) return rawB64;
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        return canvasToPngB64(canvas) || rawB64;
      } catch {
        return rawB64;
      }
    };

    const DIRECTOR_CANVASES = [
      [1024, 1536],
      [1536, 1024],
      [1472, 1472],
    ];

    const pickDirectorCanvas = (w, h) => {
      const ar = w / Math.max(1, h);
      let best = DIRECTOR_CANVASES[0];
      let bestDiff = Infinity;
      for (let i = 0; i < DIRECTOR_CANVASES.length; i += 1) {
        const cw = DIRECTOR_CANVASES[i][0];
        const ch = DIRECTOR_CANVASES[i][1];
        const diff = Math.abs(ar - cw / ch);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = DIRECTOR_CANVASES[i];
        }
      }
      return best;
    };

    const padDirectorPng = async (rawB64) => {
      if (!rawB64) return "";
      try {
        const img = await loadRefImage(rawB64);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return rawB64;
        const canvasSize = pickDirectorCanvas(w, h);
        const cw = canvasSize[0];
        const ch = canvasSize[1];
        const scale = Math.min(cw / w, ch / h);
        const nw = Math.max(1, Math.round(w * scale));
        const nh = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const g = canvas.getContext("2d");
        if (!g) return rawB64;
        g.fillStyle = "#000000";
        g.fillRect(0, 0, cw, ch);
        g.drawImage(img, Math.floor((cw - nw) / 2), Math.floor((ch - nh) / 2), nw, nh);
        return canvasToPngB64(canvas) || rawB64;
      } catch {
        return rawB64;
      }
    };

    const buildNaiOfficialBody = ({ prompt, model, size, negative }) => {
      const { base, char } = splitNaiPrompt(prompt);
      const { width, height } = parseWxH(size);
      const neg = String(negative || "").trim();
      const charCaptions = char
        ? [{ char_caption: char, centers: [{ x: 0.5, y: 0.5 }] }]
        : [];
      return {
        input: base || char,
        model,
        action: "generate",
        parameters: {
          params_version: 3,
          width,
          height,
          scale: 6,
          sampler: "k_euler_ancestral",
          steps: 28,
          n_samples: 1,
          ucPreset: 0,
          qualityToggle: !base,
          sm: false,
          sm_dyn: false,
          dynamic_thresholding: false,
          controlnet_strength: 1,
          legacy: false,
          add_original_image: false,
          uncond_scale: 1,
          cfg_rescale: 0,
          noise_schedule: "karras",
          negative_prompt: neg,
          v4_prompt: {
            caption: {
              base_caption: base,
              char_captions: charCaptions,
            },
            use_coords: false,
            use_order: true,
          },
          v4_negative_prompt: {
            caption: {
              base_caption: neg,
              char_captions: [],
            },
            use_coords: false,
            use_order: true,
          },
        },
      };
    };

    const bufToB64 = (buf) => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      return btoa(binary);
    };

    const readU16 = (u8, o) => u8[o] | (u8[o + 1] << 8);
    const readU32 = (u8, o) => (u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24)) >>> 0;

    const inflateRaw = async (bytes) => {
      if (typeof DecompressionStream !== "function") {
        throw new Error("当前浏览器解不开 NAI 返回的 zip");
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    };

    const unzipPng = async (u8) => {
      let offset = 0;
      let firstFile = null;
      while (offset + 30 <= u8.length) {
        if (readU32(u8, offset) !== 0x04034b50) break;
        const flags = readU16(u8, offset + 6);
        const method = readU16(u8, offset + 8);
        let compSize = readU32(u8, offset + 18);
        const nameLen = readU16(u8, offset + 26);
        const extraLen = readU16(u8, offset + 28);
        const nameStart = offset + 30;
        const name = new TextDecoder().decode(u8.subarray(nameStart, nameStart + nameLen));
        const dataStart = nameStart + nameLen + extraLen;
        if ((flags & 8) && compSize === 0) {
          let p = dataStart;
          while (p + 4 <= u8.length) {
            const sig = readU32(u8, p);
            if (sig === 0x08074b50 || sig === 0x02014b50 || sig === 0x04034b50) {
              compSize = p - dataStart;
              break;
            }
            p += 1;
          }
          if (!compSize) break;
        }
        const data = u8.subarray(dataStart, dataStart + compSize);
        let raw = null;
        try {
          if (method === 0) raw = data;
          else if (method === 8) raw = await inflateRaw(data);
        } catch { raw = null; }
        offset = dataStart + compSize;
        if ((flags & 8) && offset + 4 <= u8.length && readU32(u8, offset) === 0x08074b50) {
          offset += 16;
        }
        if (!raw || !raw.length) continue;
        const isPng = /\.png$/i.test(name) || (raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4e && raw[3] === 0x47);
        if (isPng) return raw;
        if (!firstFile) firstFile = raw;
      }
      return firstFile;
    };

    const pickB64FromJson = (data) => {
      if (!data || typeof data !== "object") return null;
      const list = Array.isArray(data.data) ? data.data : [data];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const raw = item.b64_json || item.b64 || item.base64 || item.image;
        if (typeof raw === "string" && raw.trim() && !/^https?:\/\//i.test(raw.trim())) {
          return {
            b64: raw.replace(/^data:[^;]+;base64,/, "").trim(),
            mimeType: "image/png",
          };
        }
      }
      return null;
    };

    const parseNaiImageBuf = async (buf, contentType) => {
      const u8 = new Uint8Array(buf);
      const ct = String(contentType || "").toLowerCase();
      const isZip = (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) || ct.includes("zip");
      if (isZip) {
        const png = await unzipPng(u8);
        if (png) return { b64: bufToB64(png), mimeType: "image/png" };
      }
      if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) {
        return { b64: bufToB64(u8), mimeType: "image/png" };
      }
      if (ct.startsWith("image/")) {
        return { b64: bufToB64(u8), mimeType: ct.split(";")[0] || "image/png" };
      }
      try {
        return pickB64FromJson(JSON.parse(new TextDecoder().decode(u8)));
      } catch {
        return null;
      }
    };

    const jsonResponse = (body, status) => new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

    const getReqUrl = (input) => {
      if (typeof input === "string") return input;
      if (typeof URL !== "undefined" && input instanceof URL) return input.href;
      if (input && typeof input.url === "string") return input.url;
      return "";
    };

    const getHeader = (input, init, name) => {
      try {
        if (init && init.headers) {
          const h = new Headers(init.headers);
          const v = h.get(name);
          if (v) return v;
        }
        if (typeof Request !== "undefined" && input instanceof Request) {
          return input.headers.get(name) || "";
        }
      } catch { /* ignore */ }
      return "";
    };

    const classifyUrl = (url) => {
      try {
        const path = new URL(url, location.href).pathname.replace(/\/+$/, "") || "/";
        if (/\/images\/edits$/i.test(path)) return "edits";
        if (/\/images\/generations$/i.test(path)) return "openai";
        if (path === "/api/image-generation" || path.endsWith("/api/image-generation")) return "host";
        return "";
      } catch {
        return "";
      }
    };

    const readBodyText = async (input, init) => {
      if (init && init.body != null) {
        if (typeof init.body === "string") return init.body;
        if (typeof Blob !== "undefined" && init.body instanceof Blob) return init.body.text();
        return null;
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        try { return await input.clone().text(); } catch { return null; }
      }
      return null;
    };

    const isHtmlChallenge = (text, ct) => {
      const s = String(text || "");
      const t = String(ct || "").toLowerCase();
      if (t.includes("text/html")) return true;
      return /<!DOCTYPE html|<html[\s>]|Just a moment|cf-browser-verification|netlify-deploy|Attention Required|Enable JavaScript and cookies/i.test(s);
    };

    const summarizeHttpBody = (status, errText, ct) => {
      if (isHtmlChallenge(errText, ct)) {
        return "被网站防护拦了（HTTP " + status + " Cloudflare/Netlify 人机验证），不是 NAI 拒图";
      }
      return String(errText || "").slice(0, 600);
    };

    const throwNaiHttp = (status, errText, ct) => {
      const err = new Error("NAI generate-image " + status + ": " + summarizeHttpBody(status, errText, ct));
      err.status = status;
      err.htmlChallenge = isHtmlChallenge(errText, ct);
      throw err;
    };

    const b64ToU8 = (b64) => {
      const bin = atob(String(b64 || "").replace(/\s+/g, ""));
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
      return u8;
    };

    const isTransportFail = (err) => {
      if (!err || err.name === "AbortError") return false;
      const msg = err instanceof Error ? err.message : String(err);
      if (err.htmlChallenge || isHtmlChallenge(msg)) return true;
      if (err.status === 400 || err.status === 401 || err.status === 402) return false;
      if (err.status === 403 && !/人机验证|Just a moment|html|Cloudflare|Netlify/i.test(msg)) return false;
      if (err.name === "TypeError") return true;
      if (/failed to fetch|networkerror|load failed|工具代理|DNS 解析|连接被|CORS|跨域|payload too large|413|人机验证/i.test(msg)) return true;
      if (err.status === 404 || err.status === 413 || err.status === 405) return true;
      return false;
    };

    const parseNaiRes = async (res) => {
      const buf = await res.arrayBuffer();
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!res.ok) {
        let errText = "";
        try { errText = new TextDecoder().decode(buf); } catch { errText = ""; }
        throwNaiHttp(res.status, errText, ct);
      }
      const parsed = await parseNaiImageBuf(buf, ct);
      if (!parsed) throw new Error("NAI 返回了无法识别的图片格式");
      return parsed;
    };

    const parseToolProxyRes = async (res) => {
      const buf = await res.arrayBuffer();
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      let text = "";
      try { text = new TextDecoder().decode(buf); } catch { text = ""; }
      if (ct.includes("json") && text) {
        let data = null;
        try { data = JSON.parse(text); } catch { data = null; }
        if (data && data._binary && typeof data.data === "string") {
          const raw = b64ToU8(data.data);
          const parsed = await parseNaiImageBuf(raw, data.contentType || "application/zip");
          if (!parsed) throw new Error("NAI 返回了无法识别的图片格式");
          return parsed;
        }
        if (!res.ok || (data && data.error && !data.b64 && !data.b64_json)) {
          throwNaiHttp(res.status || 502, text, ct);
        }
      }
      if (!res.ok) {
        if (res.status === 404 || res.status === 405) throwNaiHttp(res.status, "tool-proxy 不可用", ct);
        throwNaiHttp(res.status, text, ct);
      }
      const parsed = await parseNaiImageBuf(buf, ct);
      if (!parsed) throw new Error("NAI 返回了无法识别的图片格式");
      return parsed;
    };

    const runNaiOfficial = async ({ baseUrl, apiKey, prompt, model, size, signal, origFetch, refB64, preferProxy }) => {
      const body = buildNaiOfficialBody({
        prompt,
        model,
        size,
        negative: currentNegative(),
      });
      const png = refB64 ? await normalizeRefPng(refB64) : "";
      const directorPng = refB64 ? await padDirectorPng(refB64) : "";
      const modes = png
        ? [preferredRefMode(model), ...fallbackRefModes(preferredRefMode(model))]
        : ["none"];
      const naiUrl = naiGenerateUrl(baseUrl);
      const naiHeaders = {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      };
      const postDirect = async () => {
        const res = await origFetch(naiUrl, {
          method: "POST",
          headers: naiHeaders,
          body: JSON.stringify(body),
          signal,
        });
        return parseNaiRes(res);
      };
      const postViaProxy = async () => {
        const res = await origFetch("/api/tool-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: naiUrl,
            method: "POST",
            headers: naiHeaders,
            body,
            timeoutMs: 120000,
          }),
          signal,
        });
        return parseToolProxyRes(res);
      };
      const postOnce = async () => {
        const first = preferProxy === true ? postViaProxy : postDirect;
        const second = preferProxy === true ? postDirect : postViaProxy;
        try {
          return await first();
        } catch (err) {
          if (err && err.name === "AbortError") throw err;
          if (!isTransportFail(err)) throw err;
          try { ctx.system.log("NAI 传输失败，换一条路：" + (err && err.message)); } catch { /* ignore */ }
          return await second();
        }
      };
      let lastErr = null;
      for (let i = 0; i < modes.length; i += 1) {
        const mode = modes[i];
        attachReference(body, mode === "director" ? directorPng : png, mode);
        if (i === 0) noteReferenceMode(mode);
        try {
          return await postOnce();
        } catch (err) {
          lastErr = err;
          if (err && err.name === "AbortError") throw err;
          const next = modes[i + 1];
          if (next && shouldFallbackRef(err, mode)) {
            try { ctx.system.log("NAI 参考图 " + mode + " 失败，改走 " + next); } catch { /* ignore */ }
            if (i === 0) {
              try { ctx.ui.toast("角色参考官方不认，改走氛围/图生图"); } catch { /* ignore */ }
            }
            continue;
          }
          throw err;
        }
      }
      throw lastErr || new Error("NAI generate-image 失败");
    };

    const failNai = (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const name = err && err.name;
      let text = msg || "NAI 请求失败";
      if (name === "TypeError" || /failed to fetch|networkerror|load failed/i.test(msg)) {
        text = (msg && msg !== "TypeError" ? msg : "Failed to fetch")
          + "。浏览器直连中转失败（常见是跨域），已尝试走小手机服务端转发。";
      }
      return jsonResponse({ error: text }, 502);
    };

    const readFormPayload = async (input, init) => {
      const fromFd = async (fd) => ({
        prompt: String(fd.get("prompt") || "").trim(),
        model: String(fd.get("model") || "").trim(),
        size: String(fd.get("size") || ""),
        refB64: await blobToRawB64(fd.get("image")),
      });
      const body = init && init.body;
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        return fromFd(body);
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        const ct = (input.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("multipart/form-data")) {
          try { return await fromFd(await input.clone().formData()); } catch { return null; }
        }
      }
      return null;
    };

    const hijackHostGeneration = async (input, init, origFetch) => {
      const text = await readBodyText(input, init);
      if (!text) return origFetch(input, init);
      let payload;
      try { payload = JSON.parse(text); } catch { return origFetch(input, init); }
      if (!payload || payload.provider === "novelai") {
        return origFetch(input, init);
      }
      const baseUrl = String(payload.baseUrl || "").trim();
      const apiKey = String(payload.apiKey || "").trim();
      const model = String(payload.model || "").trim();
      const prompt = String(payload.prompt || "").trim();
      if (!baseUrl || !apiKey || !model || !prompt) {
        return jsonResponse({ error: "NAI 中转缺地址 / Key / 模型 / 提示词" }, 502);
      }
      const signal = (init && init.signal) || (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined);
      try {
        const parsed = await runNaiOfficial({
          baseUrl,
          apiKey,
          prompt,
          model,
          size: payload.size,
          signal,
          origFetch,
          refB64: dataUrlToRawB64(payload.referenceImageDataUrl),
          preferProxy: false,
        });
        return jsonResponse({ b64: parsed.b64, mimeType: parsed.mimeType || "image/png" }, 200);
      } catch (err) {
        if (err && err.name === "AbortError") throw err;
        return failNai(err);
      }
    };

    const hijackOpenAiGeneration = async (input, init, origFetch) => {
      const form = await readFormPayload(input, init);
      let prompt = "";
      let model = "";
      let size = "";
      let refB64 = "";
      if (form) {
        prompt = form.prompt;
        model = form.model;
        size = form.size;
        refB64 = form.refB64 || "";
      } else {
        const text = await readBodyText(input, init);
        if (!text) return origFetch(input, init);
        let payload;
        try { payload = JSON.parse(text); } catch { return origFetch(input, init); }
        prompt = String((payload && payload.prompt) || "").trim();
        model = String((payload && payload.model) || "").trim();
        size = payload && payload.size;
        refB64 = dataUrlToRawB64(payload && payload.referenceImageDataUrl);
      }
      if (!prompt || !model) {
        return jsonResponse({ error: "NAI 中转缺模型或提示词" }, 502);
      }
      const reqUrl = getReqUrl(input);
      const auth = getHeader(input, init, "Authorization").replace(/^Bearer\s+/i, "").trim();
      if (!reqUrl || !auth) {
        return jsonResponse({ error: "NAI 中转缺地址或 Key" }, 502);
      }
      const signal = (init && init.signal) || (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined);
      try {
        const parsed = await runNaiOfficial({
          baseUrl: reqUrl,
          apiKey: auth,
          prompt,
          model,
          size,
          signal,
          origFetch,
          refB64,
          preferProxy: false,
        });
        return jsonResponse({ created: Math.floor(Date.now() / 1000), data: [{ b64_json: parsed.b64 }] }, 200);
      } catch (err) {
        if (err && err.name === "AbortError") throw err;
        return failNai(err);
      }
    };

    const patchFetch = () => {
      if (typeof window === "undefined" || !window.fetch || window.fetch.__iapNeg) {
        return () => {};
      }
      const orig = window.fetch.bind(window);
      const wrapped = function (input, init) {
        if (!alive || !isNaiRelay()) return orig(input, init);
        let kind = "";
        try { kind = classifyUrl(getReqUrl(input)); } catch { return orig(input, init); }
        if (!kind) return orig(input, init);
        if (kind === "host") {
          return Promise.resolve().then(() => hijackHostGeneration(input, init, orig));
        }
        return Promise.resolve().then(() => hijackOpenAiGeneration(input, init, orig));
      };
      wrapped.__iapNeg = true;
      window.fetch = wrapped;
      return () => {
        if (window.fetch === wrapped) window.fetch = orig;
      };
    };

    const askName = (kind, title, initial) => new Promise((resolve) => {
      if (editor && typeof editor.finish === "function") editor.finish(null);
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        editor = null;
        resolve(value);
        scheduleScan();
      };
      editor = { kind, title, value: initial || "", finish };
      scheduleScan();
    });

    const defaultApiName = (p) => {
      const host = hostLabel(p);
      const model = p.provider === "novelai" ? "NovelAI" : (p.model || "未命名模型");
      return (p.naiRelay ? "NAI · " : "") + model + " · " + host;
    };

    const defaultPromptName = (p) => {
      const text = String(p.extraPrompt || p.naiPositive || "").replace(/\s+/g, " ").trim();
      if (!text) return "提示词 " + (loadStore().prompts.length + 1);
      return text.length > 16 ? text.slice(0, 16) + "…" : text;
    };

    const makeBtn = (label, className, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = className;
      btn.textContent = label;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      return btn;
    };

    const renderGroup = ({ title, hint, kind, extra, items, activeId, optionText, emptyText, onSelect, onNew, onUpdate, onRename, onDelete, deleteMsg }) => {
      const box = document.createElement("div");
      box.className = "iap-box";

      const t = document.createElement("div");
      t.className = "iap-title";
      t.textContent = title;
      box.appendChild(t);

      const h = document.createElement("div");
      h.className = "iap-hint";
      h.textContent = hint;
      box.appendChild(h);

      if (typeof extra === "function") extra(box);

      if (editor && editor.kind === kind) {
        const nameHint = document.createElement("div");
        nameHint.className = "iap-hint";
        nameHint.textContent = (editor.title || "预设名称") + " · 保存的是这一页下面正在填的内容";
        box.appendChild(nameHint);
        const nameRow = document.createElement("div");
        nameRow.className = "iap-row";
        const nameWrap = document.createElement("div");
        nameWrap.className = "iap-grow";
        const nameInput = document.createElement("input");
        nameInput.className = "ui-input";
        nameInput.placeholder = "预设名称";
        nameInput.value = editor.value || "";
        nameInput.addEventListener("input", () => {
          if (editor && editor.kind === kind) editor.value = nameInput.value;
        });
        nameInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const name = nameInput.value.trim();
            if (!name) {
              flash("先写个名字", true);
              return;
            }
            editor.finish(name);
          }
        });
        nameWrap.appendChild(nameInput);
        nameRow.appendChild(nameWrap);
        nameRow.appendChild(makeBtn("确定", "ui-btn ui-btn-success", () => {
          const name = nameInput.value.trim();
          if (!name) {
            flash("先写个名字", true);
            return;
          }
          editor.finish(name);
        }));
        nameRow.appendChild(makeBtn("取消", "ui-btn ui-btn-ghost", () => editor.finish(null)));
        box.appendChild(nameRow);
        setTimeout(() => nameInput.focus(), 30);
      }

      const selectRow = document.createElement("div");
      selectRow.className = "iap-row";
      const selectWrap = document.createElement("div");
      selectWrap.className = "iap-grow";
      const select = document.createElement("select");
      select.className = "ui-select";
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = items.length ? "选择预设…" : emptyText;
      select.appendChild(blank);
      for (const item of items) {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = optionText(item);
        select.appendChild(opt);
      }
      select.value = activeId && items.some((x) => x.id === activeId) ? activeId : "";
      select.addEventListener("change", () => {
        if (!select.value) return;
        onSelect(select.value);
      });
      selectWrap.appendChild(select);
      selectRow.appendChild(selectWrap);
      box.appendChild(selectRow);

      const btnRow = document.createElement("div");
      btnRow.className = "iap-row";
      btnRow.appendChild(makeBtn("新建", "ui-btn ui-btn-soft-action", onNew));
      btnRow.appendChild(makeBtn("更新选中", "ui-btn ui-btn-ghost", onUpdate));
      btnRow.appendChild(makeBtn("改名", "ui-btn ui-btn-ghost", onRename));
      btnRow.appendChild(makeBtn("删除", "ui-btn ui-btn-danger", () => {
        const stateNow = loadStore();
        const id = kind === "prompt" ? stateNow.activePromptId : stateNow.activeId;
        const list = kind === "prompt" ? stateNow.prompts : stateNow.presets;
        const p = list.find((x) => x.id === id);
        if (!p) {
          flash("先选一个预设", true);
          return;
        }
        if (!window.confirm(deleteMsg(p))) return;
        onDelete();
      }));
      box.appendChild(btnRow);
      return box;
    };

    const pickById = (list, id) => list.find((x) => x.id === id);

    const mountNaiToggle = (box) => {
      const state = loadStore();
      const row = document.createElement("label");
      row.className = "iap-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.naiRelay === true;
      const copy = document.createElement("span");
      copy.textContent = "NAI 中转：开了走官方 generate-image，人物进角色栏，负面词单独发。gpt-image / Flux 请关。";
      cb.addEventListener("change", () => {
        setNaiRelay(cb.checked);
        flash(cb.checked ? "NAI 中转已开：走官方角色栏，照片描述改成英文标签" : "NAI 中转已关，照片描述恢复原版");
        scheduleScan();
      });
      row.appendChild(cb);
      row.appendChild(copy);
      box.appendChild(row);
    };

    const mountBar = (root) => {
      const state = loadStore();
      const sig = [
        state.activeId,
        state.activePromptId,
        state.naiRelay ? "1" : "0",
        editor ? editor.kind + (editor.title || "") : "",
        notice,
        state.presets.map((p) => p.id + p.name + (p.naiRelay ? "n" : "")).join(","),
        state.prompts.map((p) => p.id + p.name).join(","),
      ].join("|");
      const existing = root.querySelector("[" + MARK + "]");
      if (existing && existing.getAttribute(SIG) === sig) return;
      if (existing) existing.remove();

      const wrap = document.createElement("div");
      wrap.className = "menu-group";
      wrap.setAttribute(MARK, "1");
      wrap.setAttribute(SIG, sig);

      if (notice) {
        const n = document.createElement("div");
        n.className = "iap-notice" + (noticeErr ? " iap-err" : "");
        n.textContent = notice;
        wrap.appendChild(n);
      }

      wrap.appendChild(renderGroup({
        title: "API 预设",
        kind: "api",
        hint: "保存的是这一页下面正在填的 Base URL / Key / 模型。切换不影响提示词、参考图、图床。",
        extra: mountNaiToggle,
        items: state.presets,
        activeId: state.activeId,
        emptyText: "还没有 API 预设",
        optionText: (p) => p.name + "（" + hostLabel(p) + (p.naiRelay ? " · NAI中转" : "") + "）",
        deleteMsg: (p) => "删除 API 预设「" + p.name + "」？当前正在用的接口不会被清空。",
        onSelect: async (id) => {
          const p = pickById(loadStore().presets, id);
          if (!p) return;
          try {
            await applyApi(p);
            const next = loadStore();
            next.activeId = p.id;
            next.naiRelay = p.naiRelay === true;
            saveStore(next);
            flash("已切换 API：" + p.name);
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onNew: async () => {
          try {
            const preview = snapshotApi();
            const name = await askName("api", "保存下面这套 API", defaultApiName(preview));
            if (!name) return;
            const snap = snapshotApi();
            const stateNow = loadStore();
            const preset = { id: newId(), name, ...snap };
            stateNow.presets.push(preset);
            stateNow.activeId = preset.id;
            saveStore(stateNow);
            flash("已保存 API：" + name);
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onUpdate: async () => {
          const stateNow = loadStore();
          const p = pickById(stateNow.presets, stateNow.activeId);
          if (!p) { flash("先选一个 API 预设", true); return; }
          try {
            Object.assign(p, snapshotApi());
            saveStore(stateNow);
            flash("已更新 API：" + p.name + "（用的是下面正在填的）");
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onRename: async () => {
          const stateNow = loadStore();
          const p = pickById(stateNow.presets, stateNow.activeId);
          if (!p) { flash("先选一个 API 预设", true); return; }
          const name = await askName("api", "API 预设名称", p.name);
          if (!name) return;
          p.name = name;
          saveStore(stateNow);
          flash("已改名：" + name);
        },
        onDelete: () => {
          const stateNow = loadStore();
          const id = stateNow.activeId;
          stateNow.presets = stateNow.presets.filter((x) => x.id !== id);
          if (stateNow.activeId === id) stateNow.activeId = "";
          saveStore(stateNow);
          flash("已删除 API 预设");
        },
      }));

      wrap.appendChild(renderGroup({
        title: "提示词预设",
        kind: "prompt",
        hint: "保存的是下面正在填的补充提示词 / 中转负面词。和 API 分开切。",
        items: state.prompts,
        activeId: state.activePromptId,
        emptyText: "还没有提示词预设",
        optionText: (p) => p.name + "（" + promptPreview(p) + "）",
        deleteMsg: (p) => "删除提示词预设「" + p.name + "」？当前输入框里的提示词不会被清空。",
        onSelect: (id) => {
          const p = pickById(loadStore().prompts, id);
          if (!p) return;
          try {
            applyPrompt(p);
            const next = loadStore();
            next.activePromptId = p.id;
            saveStore(next);
            flash("已切换提示词：" + p.name);
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onNew: async () => {
          try {
            const preview = snapshotPrompt();
            const name = await askName("prompt", "保存下面这套提示词", defaultPromptName(preview));
            if (!name) return;
            const snap = snapshotPrompt();
            const stateNow = loadStore();
            const preset = { id: newId(), name, ...snap };
            stateNow.prompts.push(preset);
            stateNow.activePromptId = preset.id;
            saveStore(stateNow);
            flash("已保存提示词：" + name);
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onUpdate: async () => {
          const stateNow = loadStore();
          const p = pickById(stateNow.prompts, stateNow.activePromptId);
          if (!p) { flash("先选一个提示词预设", true); return; }
          try {
            Object.assign(p, snapshotPrompt());
            saveStore(stateNow);
            flash("已更新提示词：" + p.name + "（用的是下面正在填的）");
          } catch (err) {
            flash(err instanceof Error ? err.message : String(err), true);
          }
        },
        onRename: async () => {
          const stateNow = loadStore();
          const p = pickById(stateNow.prompts, stateNow.activePromptId);
          if (!p) { flash("先选一个提示词预设", true); return; }
          const name = await askName("prompt", "提示词预设名称", p.name);
          if (!name) return;
          p.name = name;
          saveStore(stateNow);
          flash("已改名：" + name);
        },
        onDelete: () => {
          const stateNow = loadStore();
          const id = stateNow.activePromptId;
          stateNow.prompts = stateNow.prompts.filter((x) => x.id !== id);
          if (stateNow.activePromptId === id) stateNow.activePromptId = "";
          saveStore(stateNow);
          flash("已删除提示词预设");
        },
      }));

      const h2 = root.querySelector("h2");
      const head = h2 && h2.parentElement;
      if (head && head.parentElement === root) {
        if (head.nextSibling) root.insertBefore(wrap, head.nextSibling);
        else root.appendChild(wrap);
      } else {
        root.insertBefore(wrap, root.firstChild);
      }
    };

    const removeInjected = () => {
      for (const node of document.querySelectorAll("[" + MARK + "], [" + NEG + "]")) node.remove();
    };

    const scan = () => {
      if (!alive) return;
      const root = findPageRoot();
      if (!root) {
        removeInjected();
        return;
      }
      mountBar(root);
      mountNegativeField(root);
    };

    const scheduleScan = () => {
      if (!alive || scanTimer) return;
      scanTimer = ctx.system.timers.setTimeout(() => {
        scanTimer = null;
        if (alive) scan();
      }, 40);
    };

    const unpatchFetch = patchFetch();
    syncNaiPhotoHint();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.system.timers.setTimeout(scan, 0);
    const poll = ctx.system.timers.setInterval(scan, 1200);

    return () => {
      alive = false;
      observer.disconnect();
      poll();
      if (scanTimer) {
        scanTimer();
        scanTimer = null;
      }
      unpatchFetch();
      removeInjected();
      if (typeof ctx.prompts?.clear === "function") ctx.prompts.clear();
      else if (typeof ctx.prompts?.set === "function") ctx.prompts.set("");
    };
  },
};
