// ─────────────────────────────────────────────────────────────
// 网页抓取 · 小手机聊天插件（apiVersion 1）
//
// 你在聊天里发一个链接，插件把网页正文抓下来：
//   · 消息下面挂一张网页卡片（站点 / 标题 / 摘要 / 字数），可展开全文、打开原网页；
//   · 角色能真正"读到"正文——下一次请求前插件把正文注入 messages，
//     所以它能就文章内容跟你聊，而不是只会复述标题。
//
// 抓取走宿主自带的 /api/tool-proxy（服务端转请求，绕开浏览器 CORS），
// 失败再退回直连；两条都不行时卡片上如实显示失败原因，不装作用。
// ─────────────────────────────────────────────────────────────

const MAX_HTML_BYTES = 3 * 1024 * 1024;   // 单页 HTML 上限，防止把内存拉爆
const MAX_TEXT_CHARS = 40000;             // 落库的正文上限
const FETCH_TIMEOUT_MS = 15000;
const INJECT_WAIT_MS = 5000;              // llm.request 里最多等抓取这么久

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const URL_RE = /https?:\/\/[^\s<>"'`）】。，；！？、]+/gi;
const TRAILING_PUNCT = /[.,;:!?)\]}>"'，。；：！？）】》、]+$/;

const CSS = `
.cw-card{margin-top:6px;border:1px solid rgba(140,140,140,.28);border-radius:12px;padding:10px 12px;background:rgba(140,140,140,.08);max-width:100%;box-sizing:border-box;text-align:left;font-size:12px;line-height:1.5}
.cw-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;opacity:.65;margin-bottom:4px}
.cw-site{font-weight:600;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cw-title{font-size:13px;font-weight:600;margin:2px 0 4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cw-excerpt{opacity:.8;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word}
.cw-actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.cw-actions button{font:inherit;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid rgba(140,140,140,.35);background:transparent;color:inherit;cursor:pointer}
.cw-actions button:active{opacity:.7}
.cw-err{color:#d0574f}
.cw-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;opacity:.5;animation:cw-pulse 1s ease-in-out infinite}
@keyframes cw-pulse{0%,100%{opacity:.25}50%{opacity:.7}}
.cw-sheet{display:flex;flex-direction:column;gap:10px;padding:18px;text-align:left;max-width:560px;box-sizing:border-box}
.cw-sheet h3{margin:0;font-size:16px;line-height:1.4;padding-right:8px}
.cw-sheet input{font:inherit;font-size:14px;padding:9px 11px;border-radius:9px;border:1px solid rgba(140,140,140,.4);background:transparent;color:inherit;width:100%;box-sizing:border-box}
.cw-sheet .cw-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.cw-sheet button{font:inherit;font-size:13px;padding:6px 14px;border-radius:9px;border:1px solid rgba(140,140,140,.4);background:rgba(140,140,140,.12);color:inherit;cursor:pointer}
.cw-sheet button:active{opacity:.75}
.cw-full{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.65;max-height:56vh;overflow:auto;padding:10px;border-radius:10px;background:rgba(140,140,140,.08)}
.cw-hint{font-size:11px;opacity:.6;margin:0;line-height:1.5}
.cw-meta{font-size:11px;opacity:.6;margin:0}
.chat-plugin-input-toolbar:empty{display:none}
`;

export default {
  manifest: {
    id: "chat-webpage-reader",
    name: "网页抓取",
    apiVersion: 1,
    version: "1.0.0",
    author: "you",
    description: "在聊天里发链接即可抓取网页正文：消息下挂网页卡片，角色也能读到正文内容。",
    permissions: ["chat.read", "chat.write", "network", "storage", "ui"],
    settings: [
      { key: "autoFetch", label: "看到链接就自动读取", type: "boolean", default: true },
      { key: "injectToModel", label: "把正文交给模型（让角色读懂网页）", type: "boolean", default: true },
      { key: "maxChars", label: "每页注入模型的正文字数", type: "number", default: 3000 },
      { key: "autoReply", label: "「读取网页」发出后自动让角色回复", type: "boolean", default: true },
      {
        key: "proxy",
        label: "自定义抓取代理（可选）",
        type: "text",
        default: "",
        description: "留空用 App 自带的 /api/tool-proxy。填了会优先用它，格式如 https://r.jina.ai/（拼在网址前面）。",
      },
    ],
  },

  setup(ctx) {
    // ── 基础工具 ────────────────────────────────────────────
    const notify = (text) => {
      try { ctx.ui.toast(text); } catch { /* ignore */ }
    };
    const log = (...args) => {
      try { ctx.system.log("[chat-webpage-reader]", ...args); } catch { /* ignore */ }
    };
    const setting = (key, fallback) => {
      try {
        const value = ctx.system.settings.get(key);
        return value === undefined || value === null ? fallback : value;
      } catch {
        return fallback;
      }
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // ── URL 识别 ────────────────────────────────────────────
    const extractUrls = (text) => {
      if (!text || typeof text !== "string") return [];
      const found = text.match(URL_RE) || [];
      const out = [];
      for (const raw of found) {
        const cleaned = raw.replace(TRAILING_PUNCT, "");
        if (!cleaned) continue;
        try {
          const url = new URL(cleaned);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
          if (!out.includes(url.href)) out.push(url.href);
        } catch { /* 不是合法 URL，跳过 */ }
      }
      return out;
    };

    /** 对话框里手输的 "example.com/x" 也要能补成 https:// */
    const normalizeUrl = (input) => {
      const raw = String(input || "").trim();
      if (!raw) return { error: "先填个网址吧" };
      const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
      let url;
      try {
        url = new URL(candidate);
      } catch {
        return { error: "网址格式不对" };
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "只支持 http / https" };
      if (!url.hostname.includes(".") && url.hostname !== "localhost") return { error: "网址格式不对" };
      return { url: url.href };
    };

    const siteOf = (url) => {
      try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
    };

    const hashKey = (url) => {
      let h = 5381;
      for (let i = 0; i < url.length; i += 1) h = ((h << 5) + h + url.charCodeAt(i)) >>> 0;
      return h.toString(36);
    };
    const storageKey = (url) => `page:${hashKey(url)}`;

    // ── HTML → 正文（正则剥离，浏览器与测试环境行为一致）──
    const decodeEntities = (text) => {
      const named = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", ldquo: "“", rdquo: "”", hellip: "…", mdash: "—", ndash: "–", middot: "·" };
      return text
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(Number(dec)))
        .replace(/&([a-z]+);/gi, (whole, name) => (named[name.toLowerCase()] !== undefined ? named[name.toLowerCase()] : whole));
    };

    const safeFromCodePoint = (code) => {
      try { return String.fromCodePoint(code); } catch { return ""; }
    };

    const stripNoise = (html) => html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template|svg|canvas|iframe|object|embed|select|textarea)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(nav|aside|footer|form)\b[\s\S]*?<\/\1\s*>/gi, " ");

    const htmlToText = (html) => {
      let text = stripNoise(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|pre|dd|dt|td|th|figcaption)\s*>/gi, "\n")
        .replace(/<li[^>]*>/gi, "\n· ")
        .replace(/<(h[1-6])[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      text = decodeEntities(text);
      return tidyText(text);
    };

    const tidyText = (text) => text
      .replace(/\r\n?/g, "\n")
      .replace(/[\u00a0\t\f\v ]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const parseMetaTags = (html) => {
      const tags = html.match(/<meta\b[^>]*>/gi) || [];
      return tags.map((tag) => {
        const attrs = {};
        const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
        let match;
        while ((match = attrRe.exec(tag)) !== null) {
          attrs[match[1].toLowerCase()] = decodeEntities(match[3] ?? match[4] ?? match[5] ?? "");
        }
        return attrs;
      });
    };

    const metaValue = (metas, keys) => {
      for (const attrs of metas) {
        const name = (attrs.property || attrs.name || "").toLowerCase();
        if (!keys.includes(name)) continue;
        if (attrs.content && attrs.content.trim()) return attrs.content.trim();
      }
      return "";
    };

    const extractFromHtml = (html, url) => {
      const metas = parseMetaTags(html);
      const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1Tag = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const rawTitle = metaValue(metas, ["og:title", "twitter:title"])
        || (titleTag ? tidyText(decodeEntities(titleTag[1])) : "")
        || (h1Tag ? tidyText(decodeEntities(h1Tag[1].replace(/<[^>]+>/g, ""))) : "")
        || siteOf(url);
      const description = metaValue(metas, ["og:description", "twitter:description", "description"]);
      const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
      return { title: rawTitle.slice(0, 160), description, text };
    };

    const extractFromJson = (body) => {
      try {
        const parsed = JSON.parse(body);
        if (parsed && parsed._binary) {
          const size = typeof parsed.data === "string" ? Math.round(parsed.data.length * 0.75) : 0;
          return {
            title: "二进制内容",
            description: `服务端返回的是 ${parsed.contentType || "二进制文件"}，无法当网页解析`,
            text: `（该地址返回 ${parsed.contentType || "二进制文件"}${size ? `，约 ${Math.round(size / 1024)} KB` : ""}，不是可读网页）`,
          };
        }
        return { title: "", description: "", text: JSON.stringify(parsed, null, 2).slice(0, MAX_TEXT_CHARS) };
      } catch {
        return { title: "", description: "", text: body.slice(0, MAX_TEXT_CHARS) };
      }
    };

    const buildPage = (url, body, contentType) => {
      const ct = String(contentType || "").toLowerCase();
      let parsed;
      if (ct.includes("json") || (!ct && /^\s*[[{]/.test(body))) {
        parsed = extractFromJson(body);
      } else if (ct.includes("html") || (!ct && /<html|<body|<div|<p[\s>]/i.test(body.slice(0, 2000)))) {
        parsed = extractFromHtml(body, url);
      } else {
        parsed = { title: siteOf(url), description: "", text: tidyText(body).slice(0, MAX_TEXT_CHARS) };
      }
      const text = (parsed.text || "").trim();
      if (!text) throw new Error("页面里没有可读正文（可能需要登录或是纯前端渲染）");
      return {
        url,
        ok: true,
        site: siteOf(url),
        title: parsed.title || siteOf(url),
        excerpt: (parsed.description || text).slice(0, 240).replace(/\s+/g, " "),
        text,
        chars: text.length,
        contentType: ct,
        fetchedAt: Date.now(),
      };
    };

    // ── 抓取：自定义代理 → 宿主代理 → 直连 ──────────────────
    const withAbort = async (runner) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        return await runner(controller.signal);
      } finally {
        clearTimeout(timer);
      }
    };

    const readTextResponse = async (res) => {
      const contentType = res.headers.get("content-type") || "";
      let body = "";
      // 中文站不少还是 GBK/GB18030：fetch 默认按 UTF-8 解会变乱码，这里自己嗅探 charset
      try {
        if (typeof res.arrayBuffer === "function") {
          const bytes = new Uint8Array(await res.arrayBuffer());
          const charset = detectCharset(contentType, bytes);
          try {
            body = new TextDecoder(charset, { fatal: false }).decode(bytes);
          } catch {
            body = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
          }
        } else {
          body = await res.text();
        }
      } catch {
        try { body = await res.text(); } catch { body = ""; }
      }
      return { body, contentType };
    };

    const detectCharset = (contentType, bytes) => {
      const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType || "");
      if (fromHeader) return fromHeader[1].toLowerCase();
      let head = "";
      const limit = Math.min(bytes.length, 2048);
      for (let i = 0; i < limit; i += 1) head += String.fromCharCode(bytes[i]);
      const fromMeta = /charset\s*=\s*["']?([\w-]+)/i.exec(head);
      if (fromMeta) {
        const name = fromMeta[1].toLowerCase();
        return name === "gb2312" || name === "gbk" ? "gb18030" : name;
      }
      return "utf-8";
    };

    const errorFromBody = (body) => {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed.error === "string") return parsed.error;
      } catch { /* ignore */ }
      return "";
    };

    const viaCustomProxy = async (url, proxy) => withAbort(async (signal) => {
      const res = await ctx.system.fetch(proxy + url, { signal, method: "GET" });
      if (!res.ok) throw new Error(`自定义代理 HTTP ${res.status}`);
      const { body, contentType } = await readTextResponse(res);
      return { body, contentType: contentType || "text/plain" };
    });

    const viaHostProxy = async (url) => withAbort(async (signal) => {
      const res = await ctx.system.fetch("/api/tool-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          url,
          method: "GET",
          timeoutMs: FETCH_TIMEOUT_MS,
          headers: {
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.5",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          },
        }),
      });
      const { body, contentType } = await readTextResponse(res);
      if (!res.ok) {
        const reason = errorFromBody(body);
        throw new Error(reason || `服务端代理 HTTP ${res.status}`);
      }
      return { body, contentType };
    });

    const viaDirectFetch = async (url) => withAbort(async (signal) => {
      const res = await ctx.system.fetch(url, { signal, method: "GET", mode: "cors", credentials: "omit" });
      const { body, contentType } = await readTextResponse(res);
      if (!res.ok) throw new Error(`直连 HTTP ${res.status}`);
      return { body, contentType };
    });

    const inflight = new Map();

    const readPage = (url) => {
      try {
        const value = ctx.system.storage.get(storageKey(url));
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    };

    const writePage = (url, page) => {
      try {
        ctx.system.storage.set(storageKey(url), page);
      } catch (err) {
        log("缓存写入失败", err && err.message ? err.message : err);
      }
    };

    const loadPage = async (url, options = {}) => {
      const cached = readPage(url);
      if (cached && cached.ok && !options.force) return cached;
      const running = inflight.get(url);
      if (running && !options.force) return running;

      const task = (async () => {
        const errors = [];
        const proxy = String(setting("proxy", "") || "").trim();
        const attempts = [];
        if (proxy) attempts.push({ name: "自定义代理", run: () => viaCustomProxy(url, proxy) });
        attempts.push({ name: "服务端代理", run: () => viaHostProxy(url) });
        attempts.push({ name: "直连", run: () => viaDirectFetch(url) });

        for (const attempt of attempts) {
          try {
            const { body, contentType } = await attempt.run();
            if (!body) throw new Error("返回内容为空");
            if (body.length > MAX_HTML_BYTES) throw new Error("页面过大");
            const page = buildPage(url, body, contentType);
            writePage(url, page);
            return page;
          } catch (err) {
            const message = err && err.message ? err.message : String(err);
            errors.push(`${attempt.name}：${message}`);
            log("抓取失败", attempt.name, message);
          }
        }

        const failed = {
          url,
          ok: false,
          site: siteOf(url),
          title: siteOf(url),
          error: errors[errors.length - 1] || "读取失败",
          detail: errors,
          fetchedAt: Date.now(),
        };
        writePage(url, failed);
        return failed;
      })();

      inflight.set(url, task);
      try {
        return await task;
      } finally {
        inflight.delete(url);
      }
    };

    // ── 卡片重绘注册（消息挂载后数据才到，需要主动刷新）────
    const footerRenders = new Set();
    const refreshFooters = () => {
      for (const render of [...footerRenders]) {
        try { render(); } catch { /* 单个容器出错不影响其它 */ }
      }
    };

    // ── 打开原网页 / 全文 ──────────────────────────────────
    const openExternal = (url) => {
      try {
        const shell = typeof window !== "undefined" ? window.AndroidShell : null;
        if (shell && typeof shell.openUrl === "function" && shell.openUrl(url)) return true;
      } catch { /* 落到浏览器路径 */ }
      try {
        const opened = window.open(url, "_blank", "noopener,noreferrer");
        if (opened) return true;
      } catch { /* 落到复制路径 */ }
      try {
        navigator.clipboard.writeText(url);
        notify("打不开浏览器，链接已复制");
      } catch {
        notify("打不开这个链接");
      }
      return false;
    };

    const openFullText = (page) => {
      try {
        ctx.ui.openModal((root, api) => {
          root.classList.add("cw-sheet");

          const head = document.createElement("div");
          head.className = "cw-row";
          head.style.justifyContent = "space-between";
          const title = document.createElement("h3");
          title.textContent = page.title || "网页正文";
          const closeBtn = document.createElement("button");
          closeBtn.type = "button";
          closeBtn.textContent = "关闭";
          closeBtn.addEventListener("click", () => api.close());
          head.append(title, closeBtn);

          const meta = document.createElement("p");
          meta.className = "cw-meta";
          meta.textContent = `${page.site || ""} · ${page.chars || 0} 字 · ${new Date(page.fetchedAt || Date.now()).toLocaleString()}`;

          const body = document.createElement("div");
          body.className = "cw-full";
          body.textContent = page.text || "";

          const row = document.createElement("div");
          row.className = "cw-row";
          const copyBtn = document.createElement("button");
          copyBtn.type = "button";
          copyBtn.textContent = "复制正文";
          copyBtn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(page.text || "");
              notify("正文已复制");
            } catch {
              notify("复制失败");
            }
          });
          const openBtn = document.createElement("button");
          openBtn.type = "button";
          openBtn.textContent = "打开原网页";
          openBtn.addEventListener("click", () => openExternal(page.url));
          row.append(copyBtn, openBtn);

          root.append(head, meta, body, row);
        });
      } catch (err) {
        log("打开全文失败", err && err.message ? err.message : err);
      }
    };

    // ── 卡片渲染 ────────────────────────────────────────────
    const buildCard = (url, page, actions) => {
      const card = document.createElement("div");
      card.className = "cw-card";

      const head = document.createElement("div");
      head.className = "cw-head";
      const site = document.createElement("span");
      site.className = "cw-site";
      site.textContent = (page && page.site) || siteOf(url);
      const status = document.createElement("span");
      head.append(site, status);

      const title = document.createElement("div");
      title.className = "cw-title";
      const excerpt = document.createElement("div");
      excerpt.className = "cw-excerpt";

      if (!page) {
        status.innerHTML = '<span class="cw-dot"></span>读取中';
        title.textContent = "正在读取网页…";
        excerpt.textContent = url;
      } else if (!page.ok) {
        status.textContent = "读取失败";
        title.className = "cw-title cw-err";
        title.textContent = "这个网页没读下来";
        excerpt.className = "cw-excerpt cw-err";
        excerpt.textContent = page.error || "未知原因";
      } else {
        status.textContent = `${page.chars || 0} 字`;
        title.textContent = page.title || siteOf(url);
        excerpt.textContent = page.excerpt || "";
      }

      const row = document.createElement("div");
      row.className = "cw-actions";

      const mkBtn = (label, onClick) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", (event) => {
          if (event && typeof event.stopPropagation === "function") event.stopPropagation();
          onClick();
        });
        return button;
      };

      if (page && page.ok) {
        row.appendChild(mkBtn("查看全文", () => openFullText(page)));
        row.appendChild(mkBtn("打开原网页", () => openExternal(url)));
        row.appendChild(mkBtn("重新读取", () => actions.reload()));
      } else if (page && !page.ok) {
        row.appendChild(mkBtn("重试", () => actions.reload()));
        row.appendChild(mkBtn("打开原网页", () => openExternal(url)));
      } else {
        row.appendChild(mkBtn("取消读取", () => actions.cancel()));
      }

      card.append(head, title, excerpt, row);
      return card;
    };

    // ── 消息下方挂卡片 ──────────────────────────────────────
    const isRecentMessage = (msg) => {
      try {
        const list = ctx.data.messages.list(msg.sessionId);
        if (!Array.isArray(list) || list.length === 0) return false;
        const index = list.findIndex((item) => item && item.id === msg.id);
        if (index < 0) return true;
        return index >= list.length - 5;
      } catch {
        return true;
      }
    };

    const mountFooter = (el, props) => {
      const msg = props && props.message;
      if (!msg || msg.role !== "user") return;
      const content = typeof msg.content === "string" ? msg.content : "";
      if (!content || content.length > 4000) return;
      const urls = extractUrls(content);
      if (urls.length === 0) return;

      const url = urls[0];
      let cancelled = false;
      let started = false;

      const render = () => {
        if (cancelled) return;
        const page = readPage(url);
        el.textContent = "";
        const actions = {
          reload: () => {
            el.textContent = "";
            el.appendChild(buildCard(url, null, actions));
            void loadPage(url, { force: true }).then((next) => {
              if (cancelled) return;
              render();
              refreshFooters();
              if (next && next.ok) notify(`已重新读取：${next.title.slice(0, 20)}`);
              else if (next) notify(next.error || "读取失败");
            });
          },
          cancel: () => {
            cancelled = true;
            el.textContent = "";
            footerRenders.delete(render);
          },
        };
        el.appendChild(buildCard(url, page, actions));
      };

      footerRenders.add(render);
      render();

      const autoFetch = setting("autoFetch", true) !== false;
      if (autoFetch && !readPage(url) && !started && isRecentMessage(msg)) {
        started = true;
        void loadPage(url).then(() => {
          if (cancelled) return;
          render();
          refreshFooters();
        });
      }

      return () => {
        cancelled = true;
        footerRenders.delete(render);
      };
    };

    // ── 「读取网页」对话框 ─────────────────────────────────
    let currentSessionId = null;

    const pushUrlMessage = (sessionId, url) => {
      const message = ctx.data.messages.push({ sessionId, role: "user", content: url });
      try {
        window.dispatchEvent(new CustomEvent("chat-messages-updated", { detail: { sessionId } }));
      } catch { /* ignore */ }
      return message;
    };

    const requestReply = (sessionId) => {
      try {
        const event = new CustomEvent("chat-request-reply", { detail: { sessionId } });
        window.dispatchEvent(event);
        return Boolean(event.detail && event.detail.handled);
      } catch {
        return false;
      }
    };

    const readUrlFromDialog = async (rawInput, api) => {
      const sessionId = currentSessionId;
      if (!sessionId) {
        notify("还没进入聊天，先打开一个会话");
        return;
      }
      const normalized = normalizeUrl(rawInput);
      if (normalized.error) {
        notify(normalized.error);
        return;
      }
      const url = normalized.url;
      const busy = ctx.ui.toast("正在读取网页…", { durationMs: 0 });
      try {
        api.close();
        pushUrlMessage(sessionId, url);
        const page = await loadPage(url);
        if (page.ok) {
          notify(`已读取：${page.title.slice(0, 24)}`);
          if (setting("autoReply", true) !== false) {
            ctx.system.timers.setTimeout(() => {
              if (!requestReply(sessionId)) notify("网页已读取。对方没反应的话，点一下输入栏右侧的生成按钮");
            }, 150);
          }
        } else {
          notify(page.error || "网页读取失败");
        }
        refreshFooters();
      } finally {
        busy.close();
      }
    };

    const openUrlDialog = () => {
      if (!currentSessionId) {
        notify("还没进入聊天，先打开一个会话");
        return;
      }
      try {
        ctx.ui.openModal((root, api) => {
          root.classList.add("cw-sheet");

          const title = document.createElement("h3");
          title.textContent = "🔗 读取网页";
          const hint = document.createElement("p");
          hint.className = "cw-hint";
          hint.textContent = "贴一个网址，插件会抓正文挂在这条消息下面，角色也能读到内容。";

          const input = document.createElement("input");
          input.type = "url";
          input.placeholder = "https://example.com/article";
          input.setAttribute("inputmode", "url");
          input.setAttribute("autocomplete", "off");

          const error = document.createElement("p");
          error.className = "cw-hint cw-err";

          const row = document.createElement("div");
          row.className = "cw-row";
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.textContent = "取消";
          cancel.addEventListener("click", () => api.close());
          const submit = document.createElement("button");
          submit.type = "button";
          submit.textContent = "读取";
          const submitNow = () => {
            const normalized = normalizeUrl(input.value);
            if (normalized.error) {
              error.textContent = normalized.error;
              return;
            }
            void readUrlFromDialog(input.value, api);
          };
          submit.addEventListener("click", submitNow);
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitNow();
            }
          });
          row.append(cancel, submit);

          root.append(title, hint, input, error, row);
          ctx.system.timers.setTimeout(() => {
            try { if (input.focus) input.focus(); } catch { /* ignore */ }
          }, 60);
        });
      } catch (err) {
        notify("打不开对话框");
        log("openModal 失败", err && err.message ? err.message : err);
      }
    };

    // ── 注册 ────────────────────────────────────────────────
    ctx.ui.injectCSS(CSS);

    // 借 chat.header 拿 sessionId（inputToolbar 的 props 不带它），容器本身不占位
    ctx.ui.slot("chat.header", (el, props) => {
      el.style.display = "none";
      try { if (el.parentElement) el.parentElement.style.display = "none"; } catch { /* ignore */ }
      if (props && props.sessionId) currentSessionId = props.sessionId;
    });

    ctx.hooks.on("session.opened", (payload) => {
      if (payload && payload.sessionId) currentSessionId = payload.sessionId;
    });

    // 用户发链接时提前抓，别等模型请求才开始
    ctx.hooks.on("message.persisted", (payload) => {
      const msg = payload && payload.message;
      if (!msg || msg.role !== "user") return;
      if (setting("autoFetch", true) === false) return;
      const urls = extractUrls(typeof msg.content === "string" ? msg.content : "");
      if (urls.length === 0) return;
      for (const url of urls.slice(0, 2)) {
        void loadPage(url).then((page) => {
          if (page && page.ok) refreshFooters();
        });
      }
    });

    ctx.ui.slot("message.footer", mountFooter);

    ctx.ui.slot("chat.inputToolbar", (el) => {
      el.textContent = "";
      const row = document.createElement("div");
      row.className = "cfs-row";
      row.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;padding:4px 16px 12px";

      const item = document.createElement("div");
      item.className = "cw-item chat-plus-menu-item";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("title", "读取网页");

      const iconBox = document.createElement("div");
      iconBox.className = "chat-plus-icon-box";
      iconBox.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a15 15 0 010 18a15 15 0 010-18z"/></svg>';

      const label = document.createElement("span");
      label.className = "ts-11";
      label.textContent = "网页";

      item.append(iconBox, label);
      item.addEventListener("click", openUrlDialog);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openUrlDialog();
        }
      });

      row.appendChild(item);
      el.appendChild(row);
      return () => { el.textContent = ""; };
    });

    // 老消息也能手动抓
    ctx.ui.messageAction({
      id: "chat-webpage-reader.fetch",
      label: "🔗 读取网页",
      filter: (msg) => Boolean(msg)
        && msg.role === "user"
        && typeof msg.content === "string"
        && extractUrls(msg.content).length > 0,
      onSelect: async (msg, helpers) => {
        const urls = extractUrls(msg.content || "");
        if (urls.length === 0) return;
        helpers.toast("正在读取网页…");
        const page = await loadPage(urls[0], { force: true });
        refreshFooters();
        helpers.toast(page.ok ? `已读取：${page.title.slice(0, 20)}` : (page.error || "读取失败"));
      },
    });

    // ── 把正文喂给模型 ─────────────────────────────────────
    const contentToText = (message) => {
      const content = message && message.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part.text === "string") return part.text;
            return "";
          })
          .join("\n");
      }
      return "";
    };

    ctx.hooks.transform("llm.request", async (payload) => {
      if (setting("injectToModel", true) === false) return payload;
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      if (messages.length === 0) return payload;

      const urls = [];
      const from = Math.max(0, messages.length - 8);
      for (let i = from; i < messages.length; i += 1) {
        const found = extractUrls(contentToText(messages[i]));
        for (const url of found) if (!urls.includes(url)) urls.push(url);
      }
      if (urls.length === 0) return payload;

      const blocks = [];
      let budget = 6000;
      const perPage = Math.max(300, Number(setting("maxChars", 3000)) || 3000);

      for (const url of urls.slice(0, 2)) {
        let page = readPage(url);
        if (!page || !page.ok) {
          const task = inflight.get(url) || loadPage(url);
          page = await Promise.race([task, sleep(INJECT_WAIT_MS).then(() => null)]);
        }
        if (!page || !page.ok) continue;
        const cap = Math.min(perPage, budget);
        if (cap < 200) break;
        budget -= cap;
        const body = String(page.text || "").slice(0, cap);
        blocks.push(`【网页资料】${page.title}\n来源：${url}\n\n${body}`);
      }

      if (blocks.length === 0) return payload;

      const note = {
        role: "system",
        content: `以下是用户分享网页的正文，回答时可以参考，但不要逐字复述，也不要假装自己亲眼看过：\n\n${blocks.join("\n\n---\n\n")}`,
      };
      messages.splice(Math.max(0, messages.length - 1), 0, note);
      return payload;
    }, { priority: 100, timeoutMs: 25000 });
  },
};
