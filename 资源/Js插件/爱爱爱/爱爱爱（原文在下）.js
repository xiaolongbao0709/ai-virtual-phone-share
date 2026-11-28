export default {
  manifest: {
    id: "chat-user-auto-translate",
    name: "自动翻译·用户消息",
    apiVersion: 1,
    version: "1.4.3",
    author: "小坊",
    description: "点气泡展示原文，原文字体颜色自动跟随气泡默认颜色",
    permissions: ["chat.read", "ai"],
    settings: [
      { key: "enabled", label: "启用自动翻译", type: "boolean", default: true },
      { key: "fallbackLang", label: "兜底目标语言", type: "text", default: "English" },
      { key: "tapBubble", label: "点击气泡查看原文", type: "boolean", default: true }
    ]
  },

  setup(ctx) {
    var CFG_KEY = "charCfg";
    var ORIG_KEY = "originals";
    var MAX_ORIG = 800;
    var MAX_OUT_TOKENS = 6000;

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
      return (v === undefined || v === null) ? def : !!v;
    }

    function ensureLoaded() {
      if (loadedPromise) return loadedPromise;
      loadedPromise = Promise.all([
        Promise.resolve(ctx.system.storage.get(CFG_KEY)).catch(function () {}),
        Promise.resolve(ctx.system.storage.get(ORIG_KEY)).catch(function () {})
      ]).then(function (res) {
        if (res[0] && typeof res[0] === "object") charCfg = res[0];
        if (res[1] && typeof res[1] === "object") originals = res[1];
        loadedDone = true;
      });
      return loadedPromise;
    }

    function schedSaveCfg() {
      if (cfgTimer) { try { ctx.system.timers.clearTimeout(cfgTimer); } catch (e) {} }
      cfgTimer = ctx.system.timers.setTimeout(function () {
        cfgTimer = null;
        ctx.system.storage.set(CFG_KEY, charCfg);
      }, 200);
    }

    function schedSaveOriginals() {
      if (origTimer) { try { ctx.system.timers.clearTimeout(origTimer); } catch (e) {} }
      origTimer = ctx.system.timers.setTimeout(function () {
        origTimer = null;
        ctx.system.storage.set(ORIG_KEY, originals);
      }, 300);
    }

    function getCfg(id) {
      var c = charCfg[id];
      return { checked: !!(c && c.checked), lang: (c && typeof c.lang === "string") ? c.lang : "" };
    }

    function setCfg(id, patch) {
      if (!id) return;
      var cur = getCfg(id);
      charCfg[id] = { 
        checked: patch.checked !== undefined ? patch.checked : cur.checked, 
        lang: patch.lang !== undefined ? patch.lang : cur.lang 
      };
      schedSaveCfg();
    }

    function translate(text, lang) {
      var mt = Math.min(MAX_OUT_TOKENS, Math.ceil(text.length * 3) + 200);
      return Promise.resolve(ctx.ai.chat({
        system: "翻译成" + lang + "，只输出译文，不解释。",
        prompt: text,
        temperature: 0.1,
        maxTokens: mt
      })).then(function (res) {
        var t = String(res || "").trim();
        if ((t.charAt(0) === '"' && t.charAt(t.length - 1) === '"')) t = t.slice(1, -1).trim();
        return t;
      }).catch(function () { return ""; });
    }

    ctx.hooks.transform("user.beforeSend", function (payload) {
      if (!payload || typeof payload.text !== "string" || !sBool("enabled", true)) return payload;
      return ensureLoaded().then(function () {
        var s = null; try { s = ctx.data.sessions.get(payload.sessionId); } catch (e) {}
        if (!s) return payload;
        var charId = s.characterId || s.charId || s.cardId || s.contactId;
        var cfg = getCfg(charId);
        if (!cfg.checked) return payload;

        var tip = ctx.ui.toast("翻译中...", { durationMs: 0 });
        var targetLang = cfg.lang.trim() || ctx.system.settings.get("fallbackLang") || "English";
        
        return translate(payload.text, targetLang).then(function (out) {
          try { tip.close(); } catch (e) {}
          if (!out) return payload;
          pending.push({ sessionId: payload.sessionId, original: payload.text, translated: out, ts: Date.now() });
          payload.text = out;
          return payload;
        });
      });
    }, { priority: 50, timeoutMs: 60000 });

    ctx.hooks.on("message.persisted", function (p) {
      var msg = p.message; if (!msg || msg.role !== "user") return;
      var content = (msg.content || "").trim();
      for (var j = 0; j < pending.length; j++) {
        if (pending[j].sessionId === msg.sessionId && pending[j].translated.trim() === content) {
          var rec = pending.splice(j, 1)[0];
          var msgId = msg.id;
          originals[msgId] = { original: rec.original, ts: rec.ts };
          var keys = Object.keys(originals);
          if (keys.length > MAX_ORIG) {
            keys.sort(function (a, b) { return (originals[a].ts || 0) - (originals[b].ts || 0); });
            delete originals[keys[0]];
          }
          schedSaveOriginals();
          break;
        }
      }
    });

    function findBubble(fromEl) {
      var node = fromEl;
      for (var i = 0; i < 6; i++) {
        if (!node || node === document.body) return null;
        var cs = window.getComputedStyle(node);
        if (cs.borderRadius !== "0px" && (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none")) return node;
        node = node.parentElement;
      }
      return null;
    }

    ctx.ui.slot("message.footer", function (el, props) {
      el.style.display = "none";
      var msg = props.message; if (!msg || msg.role !== "user") return;

      ensureLoaded().then(function () {
        var rec = originals[msg.id]; if (!rec) return;
        var bubble = findBubble(el); if (!bubble || tapBound.has(bubble)) return;
        tapBound.add(bubble);

        bubble.style.cursor = "pointer";
        bubble.addEventListener("click", function (ev) {
          if (window.getSelection().toString()) return;
          ev.stopPropagation();
          if (OPEN.has(bubble)) {
            var items = OPEN.get(bubble);
            items.divider.remove(); items.originalBox.remove();
            OPEN.delete(bubble);
          } else {
            var divider = document.createElement("div");
            divider.style.cssText = "margin: 8px 0; border-top: 1px dashed rgba(128,128,128,0.3); width: 100%;";
            var originalBox = document.createElement("div");
            // 修改点：移除 color 属性，设为 inherit 继承气泡文本颜色
            originalBox.style.cssText = "color: inherit; font-weight: normal; font-size: 0.95em; line-height: 1.5; white-space: pre-wrap; word-break: break-word; opacity: 0.8;";
            originalBox.textContent = rec.original;
            bubble.appendChild(divider); bubble.appendChild(originalBox);
            OPEN.set(bubble, { divider: divider, originalBox: originalBox });
          }
        });
      });
    });

    ctx.ui.slot("settings.section", function (root) {
      ensureLoaded().then(function () {
        var wrap = document.createElement("div");
        wrap.style.padding = "10px";
        wrap.innerHTML = "<h3>翻译设置</h3>";
        (ctx.data.characters.list() || []).forEach(function (ch) {
          var cfg = getCfg(ch.id);
          var row = document.createElement("div");
          row.style.cssText = "display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid rgba(128,128,128,0.1)";
          var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = cfg.checked;
          cb.onchange = function() { setCfg(ch.id, { checked: cb.checked }); };
          var name = document.createElement("div"); name.style.width = "80px"; name.textContent = ch.name || ch.id;
          var input = document.createElement("input"); input.style.cssText = "flex:1; padding:4px; border:1px solid #ccc; border-radius:4px; background:transparent; color:inherit";
          input.value = cfg.lang; input.onchange = function() { setCfg(ch.id, { lang: input.value }); };
          row.appendChild(cb); row.appendChild(name); row.appendChild(input);
          wrap.appendChild(row);
        });
        root.appendChild(wrap);
      });
    });
  }
};