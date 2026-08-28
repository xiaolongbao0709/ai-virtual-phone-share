export default {
  manifest: {
    id: "vision-bridge",
    name: "图片理解桥（让文本模型看懂图）",
    apiVersion: 1,
    version: "2.5.2",
    author: "float",
    description: "用户发图时，自动用一个视觉模型把图转成文字，注入上下文，让纯文本聊天模型也能读懂图片（OCR / 描述）。配置界面由插件自绘浮层。",
    permissions: ["chat.read", "chat.write", "network"],
    // 不再用静态设置表单，全部配置放进插件自绘的浮层（ctx.ui.openModal）
  },

  setup(ctx) {
    // ── 超时预算 ──
    // 宿主 transform 上限只是保险丝（10 分钟）；真实节奏由插件内部按配置控制：
    // 单图超时（可配，默认 120s）→ 总预算 = 单图 × 张数（封顶 570s，留 30s 余量给宿主）。
    // 永远是插件自己先放弃（能优雅收尾、关 toast），而不是被宿主掐掉后 fetch 还在后台裸奔。
    const HOST_TIMEOUT_MS = 600000;

    // ── 配置读写（存在插件私有 storage，不依赖静态表单）──
    const S = ctx.system.storage;
    const cfg = (k, d) => { const v = S.get(k); return v === null || v === undefined ? d : v; };
    const getBaseUrl = () => String(cfg("baseUrl", "https://api.openai.com/v1")).trim().replace(/\/$/, "");
    const getKey = () => String(cfg("apiKey", "")).trim();
    const getModel = () => String(cfg("model", "gpt-4o")).trim();
    const getMode = () => String(cfg("mode", "auto"));
    const getMaxImages = () => Math.max(1, Number(cfg("maxImages", 3)) || 3);
    const getTimeoutSec = () => Math.min(570, Math.max(10, Number(cfg("timeoutSec", 120)) || 120));

    const PROMPTS = {
      extract: "提取这张图片里的所有文字，按原有的排版顺序原样输出。只输出文字本身，不要任何解释、不要 markdown 包裹。如果图中没有文字，就回复「（无文字）」。",
      describe: "详细、客观地描述这张图片的内容：主体、场景、动作、可见的文字。用中文，控制在 200 字内。",
      auto: "如果这张图片以文字为主（截图、文档、聊天记录等），就完整提取其中所有文字，按原排版原样输出；如果主要是画面（照片、插画等），就用中文客观描述图片内容（200 字内）。只输出结果本身，不要额外解释。",
    };

    // ── 图片预压缩：手机原图的 base64 动辄好几 MB，整包上传是识别慢的根源。
    // 先缩到长边 ≤1280 的 JPEG（OCR/描述完全够用），上传和识别快一个量级。
    // 任何一步失败都回退原图，绝不因压缩挡住识别。──
    async function downscale(dataURL) {
      try {
        if (typeof document === "undefined") return dataURL;
        if (dataURL.length < 300 * 1024) return dataURL; // 本来就小，不折腾
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("图片解码失败"));
          el.src = dataURL;
        });
        const MAX = 1280;
        const scale = Math.min(1, MAX / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 1) * scale));
        const h = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", 0.85);
        // 压完反而更大（比如原图是高压缩 webp）就用原图
        return out && out.length < dataURL.length ? out : dataURL;
      } catch (e) {
        ctx.system.log("图片压缩失败，用原图", String(e && e.message || e));
        return dataURL;
      }
    }

    // ── 调视觉模型识别一张图（自带中止：超时/卡死都会在配置的单图超时内返回）──
    async function recognize(dataURL) {
      const baseUrl = getBaseUrl(), apiKey = getKey(), model = getModel(), mode = getMode();
      if (!baseUrl || !apiKey) throw new Error("未配置视觉模型 API 地址或 Key");
      const fetchTimeoutMs = getTimeoutSec() * 1000;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), fetchTimeoutMs);
      try {
        const res = await ctx.system.fetch(baseUrl + "/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [
              { type: "text", text: PROMPTS[mode] || PROMPTS.auto },
              { type: "image_url", image_url: { url: dataURL } },
            ]}],
            max_tokens: 1500, temperature: 0,
          }),
          signal: ctrl.signal,
        });
        if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error("视觉 API " + res.status + ": " + t.slice(0, 200)); }
        const data = await res.json();
        return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();
      } catch (e) {
        if (ctrl.signal.aborted) throw new Error("识别超时（" + getTimeoutSec() + "s，可在配置里调大）");
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }

    // 同一张图并发只识别一次：正在识别时第二个请求直接等同一个 Promise，
    // 不会重复调 API、重复弹 toast
    const inflight = new Map();

    function getRecognition(msg) {
      const cacheKey = "ocr:" + msg.id;
      const cached = S.get(cacheKey);
      if (cached && typeof cached === "object" && cached.text !== undefined) return Promise.resolve(cached.text);
      if (inflight.has(msg.id)) return inflight.get(msg.id);
      const task = (async () => {
        const media = await ctx.data.messages.resolveMedia(msg);
        if (!media || !media.dataURL) return "";
        if (media.category && media.category !== "image") return "";
        // 常驻加载 toast，识别结束（无论成败）一定关闭
        const loading = ctx.ui.toast("正在识别图片…", { durationMs: 0 });
        try {
          const small = await downscale(media.dataURL);
          let text = "";
          try { text = await recognize(small); }
          catch (e) {
            const m = String(e && e.message || e);
            ctx.system.log("识别失败", m);
            ctx.ui.toast("图片识别失败：" + m.slice(0, 40));
            return ""; // 失败不缓存，下轮还会重试
          }
          S.set(cacheKey, { text, at: new Date().toISOString() });
          return text;
        } finally { loading.close(); }
      })().finally(() => inflight.delete(msg.id));
      inflight.set(msg.id, task);
      return task;
    }

    // ── 核心：生成回复前注入图片识别结果 ──
    ctx.hooks.transform("llm.request", async (payload) => {
      if (!payload.sessionId || !getKey()) return payload;
      const all = ctx.data.messages.list(payload.sessionId) || [];
      // 只认"本轮"的图：最后一条角色回复之后、用户新发的消息里的图片。
      // 历史轮次的图不再重复注入——角色已经在当轮回复里"看过"它们了。
      let lastAssistantIdx = -1;
      for (let i = all.length - 1; i >= 0; i--) {
        if (all[i].role === "assistant") { lastAssistantIdx = i; break; }
      }
      const images = all.slice(lastAssistantIdx + 1)
        .filter(m => m.role === "user" && m.mediaType === "image")
        .slice(-getMaxImages());
      if (images.length === 0) return payload;
      // 总预算 = 单图超时 × 张数，封顶 570s（宿主保险丝是 600s，留余量优雅收尾）
      const totalBudgetMs = Math.min(570000, getTimeoutSec() * 1000 * images.length + 5000);
      const deadline = Date.now() + totalBudgetMs;
      const notes = [];
      for (let i = 0; i < images.length; i++) {
        if (Date.now() > deadline) { ctx.system.log("识别总预算用尽，跳过剩余 " + (images.length - i) + " 张图"); break; }
        const t = await getRecognition(images[i]);
        if (t) notes.push("图片" + (i + 1) + "：" + t);
      }
      if (notes.length === 0) return payload;
      const note = { role: "system", content: "【图片识别】用户本轮发送的图片内容如下（由视觉模型转写，供你理解，不要向用户复述这段说明）：\n" + notes.join("\n\n") };
      // 插在最后一条 user 消息之后：紧邻用户发图那一轮，先于输出格式/富媒体指令
      let idx = -1;
      for (let i = payload.messages.length - 1; i >= 0; i--) {
        if (payload.messages[i].role === "user") { idx = i; break; }
      }
      if (idx >= 0) payload.messages.splice(idx + 1, 0, note);
      else payload.messages.push(note);
      return payload;
    }, { timeoutMs: HOST_TIMEOUT_MS });

    // ── 插件自绘的配置浮层 ──
    function openConfig() {
      ctx.ui.openModal((root, { close }) => {
        const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        root.style.padding = "0";
        root.innerHTML = `
          <div style="display:flex;flex-direction:column;max-height:88vh">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--c-card-border,#e5e5e5)">
              <div style="font-size:16px;font-weight:600">视觉 API 配置</div>
              <button data-x style="border:none;background:transparent;font-size:22px;line-height:1;color:var(--c-text);cursor:pointer">×</button>
            </div>
            <div style="padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:14px">
              <label style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">API 地址（Base URL）</span>
                <span style="font-size:11px;opacity:.55">OpenAI 兼容接口，末尾不用加 /chat/completions</span>
                <input data-f="baseUrl" value="${esc(getBaseUrl())}" style="width:100%;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none" />
              </label>
              <label style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">API Key</span>
                <span style="font-size:11px;opacity:.55">只存在你本机浏览器里，勿把带 key 的插件分享给别人</span>
                <input data-f="apiKey" value="${esc(getKey())}" style="width:100%;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none" />
              </label>
              <div style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">视觉模型</span>
                <div style="display:flex;gap:8px">
                  <input data-f="model" value="${esc(getModel())}" placeholder="如 gpt-4o" style="flex:1;min-width:0;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none" />
                  <button data-fetch style="white-space:nowrap;padding:9px 14px;font-size:13px;border:none;border-radius:9px;background:var(--c-accent,#4a7c59);color:#fff;cursor:pointer">拉取模型</button>
                </div>
                <div data-status style="font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all"></div>
                <div data-models style="display:flex;flex-wrap:wrap;gap:6px"></div>
              </div>
              <label style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">识别模式</span>
                <select data-f="mode" style="width:100%;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none">
                  <option value="auto">智能：有字提字，没字描述</option>
                  <option value="extract">只提取文字（OCR）</option>
                  <option value="describe">描述整张图</option>
                </select>
              </label>
              <label style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">每轮最多处理几张图</span>
                <input data-f="maxImages" type="number" value="${esc(getMaxImages())}" style="width:120px;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none" />
              </label>
              <label style="display:flex;flex-direction:column;gap:5px">
                <span style="font-size:13px;font-weight:600">单图识别超时（秒）</span>
                <span style="font-size:11px;opacity:.55">模型慢就调大（10~570）。超时后角色不带图先回复，识别结果留给下一轮</span>
                <input data-f="timeoutSec" type="number" value="${esc(getTimeoutSec())}" style="width:120px;box-sizing:border-box;padding:9px 11px;font-size:14px;border:1px solid var(--c-card-border,#ccc);border-radius:9px;background:transparent;color:var(--c-text);outline:none" />
              </label>
            </div>
            <div style="padding:14px 18px;border-top:1px solid var(--c-card-border,#e5e5e5);display:flex;gap:10px;justify-content:flex-end">
              <button data-save style="padding:9px 20px;font-size:14px;font-weight:600;border:none;border-radius:9px;background:var(--c-accent,#4a7c59);color:#fff;cursor:pointer">保存</button>
            </div>
          </div>`;

        const q = s => root.querySelector(s);
        q("select[data-f='mode']").value = getMode();
        const statusEl = q("[data-status]"), modelsEl = q("[data-models]");
        const setStatus = (t, c) => { statusEl.textContent = t || ""; statusEl.style.color = c || "var(--c-text)"; statusEl.style.opacity = ".85"; };

        const saveAll = () => {
          S.set("baseUrl", q("input[data-f='baseUrl']").value.trim());
          S.set("apiKey", q("input[data-f='apiKey']").value.trim());
          S.set("model", q("input[data-f='model']").value.trim());
          S.set("mode", q("select[data-f='mode']").value);
          S.set("maxImages", Number(q("input[data-f='maxImages']").value) || 3);
          S.set("timeoutSec", Number(q("input[data-f='timeoutSec']").value) || 120);
        };

        q("[data-x]").addEventListener("click", close);
        q("[data-save]").addEventListener("click", () => { saveAll(); ctx.ui.toast("已保存视觉 API 配置"); close(); });

        q("[data-fetch]").addEventListener("click", async () => {
          saveAll(); // 先存当前输入，再用它拉取
          const baseUrl = getBaseUrl(), apiKey = getKey();
          modelsEl.innerHTML = "";
          if (!baseUrl || !apiKey) { setStatus("请先填好 API 地址和 Key", "#c0392b"); return; }
          setStatus("正在请求 " + baseUrl + "/models …");
          try {
            const res = await ctx.system.fetch(baseUrl + "/models", { headers: { Authorization: "Bearer " + apiKey } });
            if (!res.ok) { const b = await res.text().catch(()=>" "); setStatus("拉取失败 · HTTP " + res.status + "：" + b.slice(0,160), "#c0392b"); return; }
            const rawTxt = await res.text();
            let data; try { data = JSON.parse(rawTxt); } catch { setStatus("返回不是 JSON：\n" + rawTxt.slice(0,200), "#c0392b"); return; }
            let models = Array.isArray(data.data) ? data.data.map(m=>m.id||m.name) : Array.isArray(data.models) ? data.models.map(m=>typeof m==="string"?m:m.id||m.name) : Array.isArray(data) ? data.map(m=>typeof m==="string"?m:m.id||m.name) : [];
            models = [...new Set(models.filter(Boolean))].sort();
            if (!models.length) { setStatus("接口通了但没解析到模型：\n" + rawTxt.slice(0,200), "#b8860b"); return; }
            setStatus("拉到 " + models.length + " 个模型，下拉选择 ↓", "var(--c-accent,#4a7c59)");
            // 长列表用下拉框而不是平铺 chip
            modelsEl.innerHTML = "";
            const sel = document.createElement("select");
            sel.className = "ui-select";
            sel.style.cssText = "width:100%";
            const cur = q("input[data-f='model']").value.trim();
            const ph = document.createElement("option");
            ph.value = ""; ph.textContent = "选择模型…（共 " + models.length + " 个）";
            sel.appendChild(ph);
            for (const id of models) {
              const o = document.createElement("option");
              o.value = id; o.textContent = id;
              if (id === cur) o.selected = true;
              sel.appendChild(o);
            }
            sel.addEventListener("change", () => {
              if (sel.value) { q("input[data-f='model']").value = sel.value; setStatus("已选择：" + sel.value, "var(--c-accent,#4a7c59)"); }
            });
            modelsEl.appendChild(sel);
          } catch (e) {
            const m = String(e && e.message || e);
            const hint = /fail|load|fetch|network/i.test(m) ? "\n多半是该接口不允许浏览器跨域（CORS）访问 /models。直接在上面手填模型名即可，不影响识别。" : "";
            setStatus("拉取失败 · " + m + hint, "#c0392b");
            ctx.system.log("拉取模型异常", m);
          }
        });
      });
    }

    // 管理页设置区：一条与宿主菜单行同构的整行入口（图标框 + 标题/说明 + 箭头）
    ctx.ui.slot("settings.section", (el) => {
      el.innerHTML = `
        <button data-open style="display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;border:none;background:transparent;padding:2px 0 8px;margin:0;cursor:pointer;color:var(--c-text);text-align:left;font:inherit">
          <span style="width:38px;height:38px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:11px;background:color-mix(in srgb, var(--c-accent,#4a7c59) 14%, transparent);font-size:18px">⚙️</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <span style="font-size:14.5px;font-weight:600">配置视觉 API</span>
            <span style="font-size:11.5px;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">地址 / Key / 模型 / 识别模式 / 超时</span>
          </span>
          <span style="flex:none;font-size:17px;opacity:.35;line-height:1">›</span>
        </button>`;
      el.querySelector("[data-open]").addEventListener("click", openConfig);
    });

    ctx.system.log("图片理解桥已启动 v2.5（压图 + 可配置超时，当前单图 " + getTimeoutSec() + "s）");
  },
};
