export default {
  manifest: {
    id: "chat-user-auto-translate",
    name: "自动翻译·用户消息",
    apiVersion: 1,
    version: "1.3.2",
    author: "小坊",
    description: "发送前翻译用户输入（上限提升至 6000 Token）；点气泡原文以白色加粗描边字体覆盖",
    permissions: ["chat.read", "ai"],
    settings: [
      { key: "enabled", label: "启用自动翻译", type: "boolean", default: true },
      { key: "fallbackLang", label: "兜底目标语言（角色没配语言时用它）", type: "text", default: "English" },
      { key: "autoDetectOnCheck", label: "勾选角色时按人设卡自动识别目标语言", type: "boolean", default: true },
      { key: "skipSameLang", label: "输入已是目标语言时跳过翻译", type: "boolean", default: false },
      { key: "translateUnknown", label: "会话里找不到角色卡时也用兜底语言翻译", type: "boolean", default: false },
      { key: "tapBubble", label: "点击气泡查看原文", type: "boolean", default: true },
      {
        key: "failMode",
        label: "翻译失败时",
        type: "select",
        default: "sendOriginal",
        options: [
          { value: "sendOriginal", label: "仍发送原文（提示失败）" },
          { value: "cancel", label: "取消发送（不发出这条）" }
        ]
      },
      { key: "debug", label: "输出调试日志", type: "boolean", default: false }
    ]
  },

  setup(ctx) {
    var CFG_KEY = "charCfg";
    var ORIG_KEY = "originals";
    var MAX_ORIG = 800;
    var FADE = 0.2;
    var MAX_OUT_TOKENS = 6000; // 提升至 6000

    var charCfg = {};
    var originals = {};
    var pending = [];
    var loadedPromise = null;
    var loadedDone = false;
    var cfgTimer = null;
    var origTimer = null;
    var OPEN = new Map();
    var tapBound = new WeakSet();

    function sBool(key, def) {
      var v = ctx.system.settings.get(key);
      if (v === undefined || v === null) return def;
      return !!v;
    }

    function sStr(key, def) {
      var v = ctx.system.settings.get(key);
      if (typeof v === "string" && v.trim()) return v.trim();
      return def;
    }

    function fallbackLang() {
      return sStr("fallbackLang", "English");
    }

    function dbg() {
      if (!sBool("debug", false)) return;
      var args = Array.prototype.slice.call(arguments);
      try {
        ctx.system.log.apply(ctx.system, ["[自动翻译]"].concat(args));
      } catch (e) {}
    }

    function ensureLoaded() {
      if (loadedPromise) return loadedPromise;
      loadedPromise = Promise.all([
        Promise.resolve(ctx.system.storage.get(CFG_KEY)).catch(function (e) {
          ctx.system.log("[自动翻译] 读取角色配置失败", e);
        }),
        Promise.resolve(ctx.system.storage.get(ORIG_KEY)).catch(function (e) {
          ctx.system.log("[自动翻译] 读取原文缓存失败", e);
        })
      ]).then(function (res) {
        var c = res[0];
        var o = res[1];
        if (c && typeof c === "object") charCfg = c;
        if (o && typeof o === "object") originals = o;
        loadedDone = true;
      });
      return loadedPromise;
    }

    function schedSaveCfg() {
      if (cfgTimer) {
        try { ctx.system.timers.clearTimeout(cfgTimer); } catch (e) {}
      }
      cfgTimer = ctx.system.timers.setTimeout(function () {
        cfgTimer = null;
        Promise.resolve(ctx.system.storage.set(CFG_KEY, charCfg)).catch(function (e) {
          ctx.system.log("[自动翻译] 保存角色配置失败", e);
        });
      }, 200);
    }

    function schedSaveOriginals() {
      if (origTimer) {
        try { ctx.system.timers.clearTimeout(origTimer); } catch (e) {}
      }
      origTimer = ctx.system.timers.setTimeout(function () {
        origTimer = null;
        Promise.resolve(ctx.system.storage.set(ORIG_KEY, originals)).catch(function (e) {
          ctx.system.log("[自动翻译] 保存原文缓存失败", e);
        });
      }, 300);
    }

    function getCfg(id) {
      var c = charCfg[id];
      return {
        checked: !!(c && c.checked),
        lang: (c && typeof c.lang === "string") ? c.lang : ""
      };
    }

    function setCfg(id, patch) {
      if (!id) return;
      var cur = getCfg(id);
      var next = { checked: cur.checked, lang: cur.lang };
      if (patch && typeof patch.checked === "boolean") next.checked = patch.checked;
      if (patch && typeof patch.lang === "string") next.lang = patch.lang;
      charCfg[id] = next;
      schedSaveCfg();
    }

    function rememberOriginal(msgId, rec) {
      if (!msgId) return;
      originals[msgId] = rec;
      var keys = Object.keys(originals);
      if (keys.length > MAX_ORIG) {
        keys.sort(function (a, b) {
          return (originals[a].ts || 0) - (originals[b].ts || 0);
        });
        var drop = keys.length - MAX_ORIG;
        for (var i = 0; i < drop; i++) delete originals[keys[i]];
      }
      schedSaveOriginals();
    }

    function characters() {
      try {
        var list = ctx.data.characters.list();
        return list || [];
      } catch (e) {
        return [];
      }
    }

    function charName(ch) {
      if (!ch) return "未命名角色";
      return ch.name || ch.nickname || ch.title || ch.id || "未命名角色";
    }

    function charById(id) {
      if (!id) return null;
      var list = characters();
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return list[i];
      }
      return null;
    }

    function resolveCharacter(sessionId) {
      if (!sessionId) return null;
      var s = null;
      try {
        s = ctx.data.sessions.get(sessionId);
      } catch (e) {
        s = null;
      }
      if (!s) return null;

      var direct = [s.characterId, s.charId, s.cardId, s.contactId];
      for (var i = 0; i < direct.length; i++) {
        var c = charById(direct[i]);
        if (c) return c;
      }

      var contacts = [];
      try {
        contacts = ctx.data.contacts.list() || [];
      } catch (e) {
        contacts = [];
      }
      var cids = [s.contactId, s.contact_id, s.peerId, s.targetId];
      for (var j = 0; j < cids.length; j++) {
        if (!cids[j]) continue;
        var ct = null;
        for (var k = 0; k < contacts.length; k++) {
          if (contacts[k] && (contacts[k].id === cids[j] || contacts[k].contactId === cids[j])) {
            ct = contacts[k];
            break;
          }
        }
        if (!ct) continue;
        var pools = [ct.characterId, ct.charId, ct.cardId, ct.id];
        for (var m = 0; m < pools.length; m++) {
          var cc = charById(pools[m]);
          if (cc) return cc;
        }
      }

      var members = s.memberIds || s.members || s.characterIds;
      if (Array.isArray(members)) {
        for (var n = 0; n < members.length; n++) {
          var item = members[n];
          var mid = typeof item === "string" ? item : (item && item.id);
          var mc = charById(mid);
          if (mc && getCfg(mc.id).checked) return mc;
        }
      }
      return null;
    }

    function resolveTarget(sessionId) {
      var ch = resolveCharacter(sessionId);
      if (ch) {
        var cfg = getCfg(ch.id);
        if (!cfg.checked) return { on: false, char: ch, reason: "角色未勾选" };
        var lang = cfg.lang.trim();
        if (!lang) return { on: true, char: ch, lang: fallbackLang(), reason: "兜底语言" };
        return { on: true, char: ch, lang: lang, reason: "角色语言" };
      }
      if (sBool("translateUnknown", false)) {
        return { on: true, char: null, lang: fallbackLang(), reason: "兜底语言" };
      }
      return { on: false, char: null, reason: "找不到角色卡" };
    }

    function firstString(obj, keys) {
      if (!obj) return "";
      for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    }

    function cardBrief(ch) {
      var keys = [
        "name", "nickname", "description", "persona", "personality", "identity",
        "scenario", "world", "setting", "background", "firstMessage", "greeting",
        "systemPrompt", "prompt", "tags", "language", "lang"
      ];
      var parts = [];
      for (var i = 0; i < keys.length; i++) {
        var v = ch ? ch[keys[i]] : null;
        if (typeof v === "string" && v.trim()) parts.push(keys[i] + ": " + v.trim());
        else if (Array.isArray(v) && v.length) parts.push(keys[i] + ": " + v.join(" / "));
      }
      var s = parts.join("\n");
      if (!s) {
        try { s = JSON.stringify(ch || {}); } catch (e) { s = ""; }
      }
      return s.slice(0, 1600);
    }

    function normalizeLang(raw) {
      if (!raw) return "";
      var t = String(raw).trim();
      t = t.replace(/```[a-zA-Z]*/g, "").replace(/```/g, "").trim();
      t = t.replace(/^[\s"'“”‘’《》]+/, "");
      t = t.replace(/[\s"'“”‘’《》。，、!！]+$/, "");
      t = t.split("\n")[0];
      t = t.split("，")[0];
      t = t.split(",")[0];
      t = t.split("；")[0];
      t = t.split(";")[0];
      t = t.trim();
      t = t.replace(/^(语言|语种|目标语言)\s*[:：]\s*/, "").trim();
      if (!t) return "";
      if (t.length > 20) return "";
      if (/无法|不能|不确定|未知|unknown|抱歉/i.test(t)) return "";
      return t;
    }

    function detectLang(ch) {
      var explicit = normalizeLang(firstString(ch, ["language", "lang", "targetLanguage", "语种"]));
      if (explicit) return Promise.resolve(explicit);
      var brief = cardBrief(ch);
      if (!brief) return Promise.resolve("");
      return Promise.resolve(ctx.ai.chat({
        system: "你是语言判定器。根据角色卡内容，判断这个角色日常对话最可能使用的语言。只输出一个语言名称，例如：中文 / English / 日本語 / 한국어 / Français / Español。不要解释、不要标点、不要换行。",
        prompt: brief,
        temperature: 0,
        maxTokens: 24
      })).then(function (res) {
        return normalizeLang(res);
      });
    }

    function cleanOutput(raw) {
      if (!raw) return "";
      var t = String(raw).trim();
      t = t.replace(/^```[a-zA-Z]*\n?/, "").trim();
      t = t.replace(/\n?```$/, "").trim();
      t = t.replace(/^(译文|翻译|翻译结果|Translation)\s*[:：]\s*/i, "").trim();
      if ((t.charAt(0) === '"' && t.charAt(t.length - 1) === '"') ||
          (t.charAt(0) === "“" && t.charAt(t.length - 1) === "”")) {
        t = t.slice(1, -1).trim();
      }
      return t;
    }

    function sameText(a, b) {
      function n(s) {
        return String(s === undefined || s === null ? "" : s).replace(/\s+/g, "").trim();
      }
      return n(a) === n(b);
    }

    function translateOnce(text, lang, strict) {
      var system = strict
        ? "你是翻译引擎。必须把用户给的整段文本翻译成" + lang + "，禁止原样返回、禁止解释、禁止保留原文。只输出" + lang + "译文。"
        : "你是翻译引擎。把用户给的文本翻译成" + lang + "。要求：只输出译文本身，不要引号、不要前缀、不要解释、不要标注语言；保留 emoji、颜文字、换行、标点风格和口语语气；人名与专有名词保留原写法。";
      
      // 动态计算 maxTokens，封顶 6000
      var mt = Math.ceil(text.length * 3) + 200;
      if (mt < 512) mt = 512;
      if (mt > MAX_OUT_TOKENS) mt = MAX_OUT_TOKENS;

      return Promise.resolve(ctx.ai.chat({
        system: system,
        prompt: text,
        temperature: 0.1,
        maxTokens: mt
      })).then(function (res) {
        return cleanOutput(res);
      });
    }

    function translate(text, lang) {
      var last = "";
      function step(i) {
        if (i >= 3) return Promise.resolve(last);
        return translateOnce(text, lang, i > 0).then(function (out) {
          if (out && out.trim()) {
            last = out.trim();
            if (i > 0 || !sameText(last, text)) {
              if (i > 0) dbg("重试成功", i + 1);
              return last;
            }
            dbg("第 1 次与原文相同，重试");
          } else {
            dbg("第", i + 1, "次返回空");
          }
          return step(i + 1);
        }).catch(function (e) {
          dbg("第", i + 1, "次翻译报错", (e && e.message) || e);
          return step(i + 1);
        });
      }
      return step(0);
    }

    function looksTranslatable(text) {
      if (!text || !text.trim()) return false;
      var t = String(text).replace(/https?:\/\/\S+/g, "");
      t = t.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
      t = t.replace(/\s/g, "");
      t = t.replace(/[0-9]/g, "");
      t = t.replace(/[\u0000-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007f]/g, "");
      t = t.replace(/[\u2000-\u206f\u3000-\u303f\uff00-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]/g, "");
      return t.length > 0;
    }

    function probablySameLang(text, lang) {
      var target = String(lang).toLowerCase();
      var isCJKTarget = /中文|汉语|chinese|zh|繁體|繁体/.test(target);
      var hasCJK = /[\u4e00-\u9fff]/.test(text);
      if (isCJKTarget && hasCJK) return true;
      if (!hasCJK && /[A-Za-z]/.test(text) &&
          /english|français|francais|deutsch|español|espanol|italiano|português/i.test(lang)) {
        return true;
      }
      return false;
    }

    ctx.hooks.transform("user.beforeSend", function (payload) {
      if (!payload || typeof payload.text !== "string") return payload;
      if (sBool("enabled", true) === false) return payload;

      return ensureLoaded().then(function () {
        var original = payload.text;
        if (!looksTranslatable(original)) return payload;

        var target = resolveTarget(payload.sessionId);
        if (!target.on) {
          dbg("跳过：" + target.reason);
          return payload;
        }

        var lang = target.lang;
        if (sBool("skipSameLang", false) && probablySameLang(original, lang)) {
          dbg("跳过：已是目标语言 " + lang);
          return payload;
        }

        var tip = ctx.ui.toast("翻译中 → " + lang, { durationMs: 0 });
        return translate(original, lang).then(function (out) {
          try { tip.close(); } catch (e) {}

          if (!out) {
            var mode = ctx.system.settings.get("failMode") || "sendOriginal";
            ctx.ui.toast("翻译失败（目标语言：" + lang + "），已按设置处理", { durationMs: 4000 });
            ctx.system.log("[自动翻译] 翻译失败", {
              sessionId: payload.sessionId,
              lang: lang,
              char: target.char ? target.char.id : null
            });
            if (mode === "cancel") payload.cancelled = true;
            return payload;
          }

          pending.push({
            sessionId: payload.sessionId,
            original: original,
            translated: out,
            lang: lang,
            ts: Date.now()
          });
          if (pending.length > 20) pending.splice(0, pending.length - 20);

          payload.text = out;
          dbg("已翻译", { lang: lang, len: out.length });
          return payload;
        });
      }).catch(function (e) {
        ctx.system.log("[自动翻译] beforeSend 异常", (e && e.message) || e);
        return payload;
      });
    }, { priority: 50, timeoutMs: 60000 });

    function matchPending(message) {
      if (!message || message.role !== "user") return;
      var content = typeof message.content === "string" ? message.content : "";
      var now = Date.now();
      for (var i = pending.length - 1; i >= 0; i--) {
        if (now - pending[i].ts > 120000) pending.splice(i, 1);
      }
      var idx = -1;
      for (var j = 0; j < pending.length; j++) {
        if (pending[j].sessionId === message.sessionId && sameText(content, pending[j].translated)) {
          idx = j;
          break;
        }
      }
      if (idx < 0) return;
      var rec = pending.splice(idx, 1)[0];
      rememberOriginal(message.id, { original: rec.original, lang: rec.lang, ts: rec.ts });
      dbg("原文已绑定 " + message.id);
    }

    ctx.hooks.on("message.persisted", function (payload) {
      try {
        if (payload && payload.message) matchPending(payload.message);
      } catch (e) {}
    });

    ctx.hooks.transform("message.beforePersist", function (payload) {
      try {
        if (payload && payload.message) matchPending(payload.message);
      } catch (e) {}
      return payload;
    }, { priority: 200 });

    function openOriginalModal(rec) {
      if (!rec) return;
      ctx.ui.openModal(function (el, api) {
        el.style.padding = "16px 18px";

        var h = document.createElement("div");
        h.style.cssText = "font-weight:600;font-size:15px;margin-bottom:8px;";
        h.textContent = rec.lang ? "原文（已译为 " + rec.lang + "）" : "原文";

        var body = document.createElement("div");
        body.style.cssText = "font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;opacity:.9;max-height:52vh;overflow:auto;";
        body.textContent = rec.original;

        var foot = document.createElement("div");
        foot.style.cssText = "margin-top:14px;text-align:right;";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "atp-btn";
        btn.textContent = "关闭";
        btn.addEventListener("click", function () {
          try { api.close(); } catch (e) {}
        });

        foot.appendChild(btn);
        el.appendChild(h);
        el.appendChild(body);
        el.appendChild(foot);
      });
    }

    ctx.ui.messageAction({
      id: "atp.viewOriginal",
      label: "查看原文",
      filter: function (msg) {
        return !!(msg && msg.role === "user" && originals[msg.id]);
      },
      onSelect: function (msg) {
        openOriginalModal(originals[msg.id]);
      }
    });

    ctx.ui.injectCSS(
      ".atp-panel{font-size:13px;line-height:1.5;padding:2px 0}" +
      ".atp-title{font-weight:600;font-size:14px;margin-bottom:2px}" +
      ".atp-sub{font-size:12px;opacity:.65;margin-bottom:10px}" +
      ".atp-bar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}" +
      ".atp-btn{font-size:12px;padding:4px 9px;border-radius:8px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;cursor:pointer;font-family:inherit}" +
      ".atp-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(128,128,128,.14)}" +
      ".atp-row:last-child{border-bottom:none}" +
      ".atp-name{flex:0 0 34%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".atp-lang{flex:1;min-width:0;font-size:12px;padding:4px 7px;border-radius:7px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font-family:inherit}" +
      ".atp-st{font-size:11px;opacity:.6;min-width:52px;text-align:right}" +
      ".atp-empty{font-size:12px;opacity:.6;padding:8px 0}"
    );

    function normText(s) {
      return String(s === undefined || s === null ? "" : s).replace(/\s+/g, "");
    }

    function deepestWithText(root, probe) {
      var all = root.querySelectorAll("*");
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if (n.hasAttribute && n.hasAttribute("data-atp-overlay")) continue;
        var t = normText(n.textContent);
        if (!t || t.indexOf(probe) < 0) continue;
        var deeper = false;
        for (var j = 0; j < n.children.length; j++) {
          var c = n.children[j];
          if (c.hasAttribute && c.hasAttribute("data-atp-overlay")) continue;
          if (normText(c.textContent).indexOf(probe) >= 0) {
            deeper = true;
            break;
          }
        }
        if (!deeper) return n;
      }
      return null;
    }

    function findTextLayer(fromEl, text) {
      var n = normText(text);
      var plain = n.replace(/[*_`#>~\[\]()!|]/g, "");
      var probes = [];
      function push(p) {
        if (p && probes.indexOf(p) < 0) probes.push(p);
      }
      if (plain) {
        push(plain.slice(0, 12));
        push(plain.slice(0, 6));
      }
      push(n.slice(0, 12));
      push(n.slice(0, 6));
      if (!probes.length) return null;

      for (var i = 0; i < probes.length; i++) {
        var probe = probes[i];
        var row = fromEl;
        var found = null;
        for (var d = 0; d < 4 && row; d++) {
          row = row.parentElement;
          if (!row || row === document.body) break;
          if (normText(row.textContent).indexOf(probe) >= 0) {
            found = row;
            break;
          }
        }
        if (!found) continue;
        var deep = deepestWithText(found, probe);
        if (deep) return deep;
      }
      return null;
    }

    function hasOpaqueBg(el) {
      try {
        var c = window.getComputedStyle(el).backgroundColor;
        if (!c || c === "transparent") return false;
        var m = c.match(/rgba?\(([^)]+)\)/);
        if (m) {
          var p = m[1].split(",");
          if (p.length > 3 && parseFloat(p[3]) === 0) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    function fadeText(el, factor) {
      if (hasOpaqueBg(el)) {
        var cs = window.getComputedStyle(el);
        var m = String(cs.color || "").match(/rgba?\(([^)]+)\)/);
        if (m) {
          var p = m[1].split(",");
          var r = parseFloat(p[0]) || 0;
          var g = parseFloat(p[1]) || 0;
          var b = parseFloat(p[2]) || 0;
          var a = p.length > 3 ? parseFloat(p[3]) : 1;
          var prevColor = el.style.color;
          var prevTransition = el.style.transition;
          el.style.transition = "color .18s ease";
          el.style.color = "rgba(" + r + "," + g + "," + b + "," + (a * factor) + ")";
          return function () {
            try {
              el.style.color = prevColor;
              el.style.transition = prevTransition;
            } catch (e) {}
          };
        }
      }
      var prevOpacity = el.style.opacity;
      var prevTr = el.style.transition;
      el.style.transition = "opacity .18s ease";
      el.style.opacity = String(factor);
      return function () {
        try {
          el.style.opacity = prevOpacity;
          el.style.transition = prevTr;
        } catch (e) {}
      };
    }

    function makeOverlay(layer, rec) {
      var parent = layer.parentElement;
      if (!parent) return null;

      var pr, lr;
      try {
        pr = parent.getBoundingClientRect();
        lr = layer.getBoundingClientRect();
      } catch (e) {
        return null;
      }
      if (!lr || lr.width < 4) return null;

      var pcs = window.getComputedStyle(parent);
      if (pcs.position === "static") parent.style.position = "relative";

      var lcs = window.getComputedStyle(layer);
      var left = lr.left - pr.left - (parent.clientLeft || 0);
      var top = lr.top - pr.top - (parent.clientTop || 0);
      var align = lcs.textAlign;
      if (!align || align === "start" || align === "justify") align = "left";

      var ov = document.createElement("div");
      ov.setAttribute("data-atp-overlay", "1");
      ov.style.cssText =
        "position:absolute;box-sizing:border-box;" +
        "left:" + Math.max(0, left) + "px;" +
        "top:" + Math.max(0, top) + "px;" +
        "width:" + lr.width + "px;" +
        "max-height:60vh;overflow:auto;" +
        "margin:0;padding:0;border:0;background:transparent;" +
        "pointer-events:none;opacity:1;" +
        "color:#FFFFFF;" +
        "font-size:" + lcs.fontSize + ";" +
        "font-weight:bold;" +
        "font-family:" + lcs.fontFamily + ";" +
        "line-height:" + (lcs.lineHeight === "normal" ? "1.5" : lcs.lineHeight) + ";" +
        "letter-spacing:" + lcs.letterSpacing + ";" +
        "text-align:" + align + ";" +
        "white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;" +
        "text-shadow: 1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000, 0px 1px 1px #000, 0px -1px 1px #000, 1px 0px 1px #000, -1px 0px 1px #000;" +
        "z-index:20;";
      ov.textContent = rec.original;
      parent.appendChild(ov);
      return ov;
    }

    function closeOverlay(layer) {
      var cur = OPEN.get(layer);
      if (!cur) return;
      try {
        if (cur.overlay) cur.overlay.remove();
      } catch (e) {}
      try {
        if (cur.restore) cur.restore();
      } catch (e) {}
      OPEN.delete(layer);
    }

    function toggleOverlay(layer, rec) {
      if (!layer || !rec || !rec.original) return;
      if (!layer.isConnected) return;
      if (OPEN.has(layer)) {
        closeOverlay(layer);
        return;
      }
      var par = layer.parentElement;
      if (par) {
        var stale = par.querySelector('[data-atp-overlay="1"]');
        if (stale) {
          try { stale.remove(); } catch (e) {}
        }
      }
      var ov = makeOverlay(layer, rec);
      if (!ov) return;
      var restore = fadeText(layer, FADE);
      OPEN.set(layer, { overlay: ov, restore: restore });
    }

    function sweepOpened() {
      if (!OPEN.size) return;
      var keys = Array.from(OPEN.keys());
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!k || !k.isConnected) closeOverlay(k);
      }
    }

    function bindBubbleTap(el, props) {
      var msg = props && props.message;
      if (!msg || msg.role !== "user") return;
      var rec = originals[msg.id];
      if (!rec || !rec.original) return;

      var layer = findTextLayer(el, msg.content);
      if (!layer || tapBound.has(layer)) return;
      tapBound.add(layer);

      var handler = function (ev) {
        try {
          var sel = window.getSelection ? window.getSelection() : null;
          if (sel && String(sel).trim()) return;
        } catch (e) {}

        var t = ev && ev.target;
        if (t && t.closest && t.closest("a,button,input,textarea,[data-atp-skip]")) return;

        toggleOverlay(layer, originals[msg.id] || rec);
      };

      layer.addEventListener("click", handler);

      return function () {
        try { layer.removeEventListener("click", handler); } catch (e) {}
        tapBound.delete(layer);
        closeOverlay(layer);
      };
    }

    ctx.ui.slot("message.footer", function (el, props) {
      el.style.display = "none";
      el.innerHTML = "";
      try {
        sweepOpened();
        if (sBool("tapBubble", true) === false) return;
        if (!loadedDone) {
          ensureLoaded().then(function () {
            try { bindBubbleTap(el, props); } catch (e) {}
          });
          return;
        }
        return bindBubbleTap(el, props);
      } catch (e) {
        return;
      }
    });

    ctx.hooks.on("session.opened", function () {
      try {
        var keys = Array.from(OPEN.keys());
        for (var i = 0; i < keys.length; i++) closeOverlay(keys[i]);
      } catch (e) {}
    });

    function mkBtn(text, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "atp-btn";
      b.textContent = text;
      b.addEventListener("click", onClick);
      return b;
    }

    ctx.ui.slot("settings.section", function (root) {
      var wrap = document.createElement("div");
      wrap.className = "atp-panel";
      root.appendChild(wrap);
      var alive = true;

      function detectInto(ch, rowSt, input) {
        if (rowSt) rowSt.textContent = "识别中…";
        return detectLang(ch).then(function (lang) {
          if (!alive) return;
          if (lang) {
            setCfg(ch.id, { lang: lang });
            if (input) input.value = lang;
            if (rowSt) rowSt.textContent = "已识别";
            ctx.ui.toast("「" + charName(ch) + "」目标语言：" + lang, { durationMs: 2200 });
          } else {
            if (rowSt) rowSt.textContent = "需手填";
            ctx.ui.toast("「" + charName(ch) + "」语言识别失败，请手动填写", { durationMs: 3500 });
          }
        }).catch(function (e) {
          if (rowSt) rowSt.textContent = "识别失败";
          ctx.ui.toast("识别失败，请手动填写目标语言", { durationMs: 3500 });
          ctx.system.log("[自动翻译] 识别语言失败", (e && e.message) || e);
        });
      }

      function statusText(id) {
        var cfg = getCfg(id);
        if (!cfg.checked) return "未勾选";
        return cfg.lang ? "已启用" : "用兜底";
      }

      function makeRow(ch) {
        var cfg = getCfg(ch.id);
        var row = document.createElement("div");
        row.className = "atp-row";

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = cfg.checked;
        cb.title = "勾选后该角色的每条用户消息都会翻译";

        var name = document.createElement("div");
        name.className = "atp-name";
        name.textContent = charName(ch);
        name.title = charName(ch);

        var input = document.createElement("input");
        input.className = "atp-lang";
        input.type = "text";
        input.placeholder = "目标语言（留空用兜底：" + fallbackLang() + "）";
        input.value = cfg.lang;

        var st = document.createElement("div");
        st.className = "atp-st";
        st.textContent = statusText(ch.id);

        var reBtn = mkBtn("识别", function () {
          detectInto(ch, st, input);
        });

        input.addEventListener("change", function () {
          var v = normalizeLang(input.value) || input.value.trim();
          input.value = v;
          setCfg(ch.id, { lang: v });
          st.textContent = statusText(ch.id);
        });

        cb.addEventListener("change", function () {
          setCfg(ch.id, { checked: cb.checked });
          st.textContent = statusText(ch.id);
          if (cb.checked && sBool("autoDetectOnCheck", true) && !getCfg(ch.id).lang.trim()) {
            detectInto(ch, st, input);
          }
        });

        row.appendChild(cb);
        row.appendChild(name);
        row.appendChild(input);
        row.appendChild(reBtn);
        row.appendChild(st);
        return row;
      }

      function render() {
        return ensureLoaded().then(function () {
          if (!alive) return;
          wrap.innerHTML = "";

          var title = document.createElement("div");
          title.className = "atp-title";
          title.textContent = "自动翻译 · 角色目标语言";

          var sub = document.createElement("div");
          sub.className = "atp-sub";
          sub.textContent = "勾选的角色：每次发送都会把用户消息翻成这里填的语言。";

          wrap.appendChild(title);
          wrap.appendChild(sub);

          var bar = document.createElement("div");
          bar.className = "atp-bar";

          bar.appendChild(mkBtn("刷新角色", function () { render(); }));

          bar.appendChild(mkBtn("全部勾选", function () {
            var list = characters();
            for (var i = 0; i < list.length; i++) setCfg(list[i].id, { checked: true });
            render();
          }));

          bar.appendChild(mkBtn("全部取消", function () {
            var list = characters();
            for (var i = 0; i < list.length; i++) setCfg(list[i].id, { false: false });
            render();
          }));

          bar.appendChild(mkBtn("识别所有已勾选角色", function () {
            var list = characters().filter(function (c) {
              var cf = getCfg(c.id);
              return cf.checked && !cf.lang;
            });
            var chain = Promise.resolve();
            list.forEach(function (c) {
              chain = chain.then(function () {
                return detectLang(c).then(function (lang) {
                  if (lang) setCfg(c.id, { lang: lang });
                }).catch(function () {});
              });
            });
            chain.then(function () { render(); });
          }));

          wrap.appendChild(bar);

          var list = characters().slice().sort(function (a, b) {
            return String(charName(a)).localeCompare(String(charName(b)), "zh");
          });

          if (!list.length) {
            var empty = document.createElement("div");
            empty.className = "atp-empty";
            empty.textContent = "还没有角色卡。";
            wrap.appendChild(empty);
            return;
          }

          for (var i = 0; i < list.length; i++) wrap.appendChild(makeRow(list[i]));
        });
      }

      render();

      return function () { alive = false; };
    });

    ensureLoaded();

    return function () {
      try { if (cfgTimer) ctx.system.timers.clearTimeout(cfgTimer); } catch (e) {}
      try { if (origTimer) ctx.system.timers.clearTimeout(origTimer); } catch (e) {}
      try {
        var keys = Array.from(OPEN.keys());
        for (var i = 0; i < keys.length; i++) closeOverlay(keys[i]);
      } catch (e) {}
    };
  }
};