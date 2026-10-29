export default {
  manifest: {
    id: "offline-scene-launcher",
    name: "线下场景启动器",
    apiVersion: 1,
    version: "4.0.0",
    author: "你",
    description: "判断线下见面时出现邀约，确认后直接转入内置线下",
    permissions: ["chat.read", "ui"],
    settings: [
      { key: "enabled", label: "启用", type: "boolean", default: true },
      { key: "person", label: "情境·人称（旁白里怎么称呼你）", type: "select", default: "third",
        options: [
          { value: "first", label: "第一人称（我）" },
          { value: "second", label: "第二人称（你）" },
          { value: "third", label: "第三人称" }
        ] },
      { key: "customStyle", label: "你想要的风格 prompt（填了会覆盖默认描写类型；不影响上面的人称）", type: "text", default: "" },
      { key: "sceneNoSubj", label: "情境·无主语模式", type: "boolean", default: false },
      { key: "replyPerson", label: "你的回应·人称", type: "select", default: "third",
        options: [
          { value: "first", label: "第一人称（我）" },
          { value: "second", label: "第二人称（你）" },
          { value: "third", label: "第三人称" }
        ] },
      { key: "replyNoSubj", label: "你的回应·无主语模式", type: "boolean", default: false },
      { key: "sceneWrapBefore", label: "情境·包裹·前（如 [情境] / *，留空=不加）", type: "text", default: "" },
      { key: "sceneWrapAfter", label: "情境·包裹·后（如 [/情境] / *，留空=不加）", type: "text", default: "" },
      { key: "replyWrapBefore", label: "你的回应·包裹·前", type: "text", default: "" },
      { key: "replyWrapAfter", label: "你的回应·包裹·后", type: "text", default: "" },
      { key: "maxChars", label: "单个回应分支最多字数", type: "number", default: 60 },
      { key: "capsuleTurns", label: "邀约保留轮数（AI 回复几轮后移除）", type: "number", default: 2 },
      { key: "fxEnabled", label: "播放全屏粒子动画（相会 / 被拒）", type: "boolean", default: true },
      { key: "armGlow", label: "线下图标·发光强度（0~100，越小越淡）", type: "number", default: 32 },
      { key: "keepMarker", label: "【调试】保留气泡里的标记原文", type: "boolean", default: false }
    ]
  },
  setup(ctx) {
    // ═════════ 常量与状态 ═════════
    var TAG_JUDGE = "线下判定", TAG_SCENE = "线下情境", TAG_OPT = "线下选项";
    var K_EVT = "evt:", K_CSS = "custom-css", K_ARC = "css-archive:", K_ARM = "arm-color";
    // evt:<sid> = { judge:{direction,agreed,reason}|null, scene:string, opts:string[], turns:number, fxAt:number }

    var cssDisp = null, structDisp = null, ticker = null;
    var settingsOff = null;
    var pillEls = {}, pillHosts = {};
    var footEls = {};   // sid -> { 消息id: { el, batch } }：气泡下方的坑位登记
    var skipAssist = {};
    var fxArmed = {};
    var anchorMissAt = {};    // sid -> 首次发现锚点缺失的时间戳
    var gate = {};      // sid -> { t, persisted, mounted }
    var landTok = {};
    var offlinePending = {};   // sid -> true：线下已发起生成，等成功后再计数
    var armedEls = {};         // sid -> 已标记「邀约进行中」的【线下模式】按钮
    // 线下图标颜色与淡度：存插件私有 storage（不走 manifest 设置）。setup 读一次缓存在内存，
    // 之后 armStyle 直接用内存值——避免 tick 里反复读 storage 整桶。
    var ARM_DEF = [255, 143, 189];   // 默认粉
    var ARM_OP_DEF = 70;             // 默认淡度
    var armRgb = ARM_DEF.slice();    // 真正生效的颜色
    var armOp = ARM_OP_DEF;          // 淡度 10~100
    function armSave() {
      try { ctx.system.storage.set(K_ARM, { r: armRgb[0], g: armRgb[1], b: armRgb[2], o: armOp }); } catch (e) { }
    }
    (function () {
      try {
        var v = ctx.system.storage.get(K_ARM);
        if (v && typeof v === "object") {
          var out = [];
          ["r", "g", "b"].forEach(function (k) {
            var n = parseInt(v[k], 10);
            out.push(isNaN(n) ? NaN : Math.max(0, Math.min(255, n)));
          });
          if (!isNaN(out[0]) && !isNaN(out[1]) && !isNaN(out[2])) armRgb = out;
          var o = parseInt(v.o, 10);
          if (!isNaN(o)) armOp = Math.max(10, Math.min(100, o));
        }
      } catch (e) { }
    })();
    var armHsl = rgbToHsl(armRgb);   // 面板滑块的状态（由 RGB 反推）

    // ═════════ 设置读取（带缓存）═════════
    // settings.get 在宿主里很贵，tick 又每 1.5 秒调好几次，所以缓存。
    // 失效方式：宿主 onChange 触发时清空；另加 5 秒 TTL 兜底，即使 onChange 没触发，最多也只旧 5 秒。
    var S = {}, Sat = 0;
    function sGet(k) {
      var now = Date.now();
      if (now - Sat > 5000) { S = {}; Sat = now; }
      if (!(k in S)) S[k] = ctx.system.settings.get(k);
      return S[k];
    }
    try {
      if (ctx.system.settings.onChange) {
        var off = ctx.system.settings.onChange(function () {
          S = {}; Sat = 0;
          rearmAll();   // 发光强度/透明度改了：已亮起的图标立刻重绘
        });
        if (typeof off === "function") settingsOff = off;
      }
    } catch (e) { }

    function sText(k, fb) {
      var v = sGet(k);
      if (v === undefined || v === null) return fb;
      var t = String(v).trim();
      return t || fb;
    }
    function sInt(k, fb, lo, hi) {
      var v = parseInt(sGet(k), 10);
      if (isNaN(v)) v = fb;
      if (lo !== undefined && v < lo) v = lo;
      if (hi !== undefined && v > hi) v = hi;
      return v;
    }
    function sBool(k, fb) {
      var v = sGet(k);
      return v === undefined || v === null ? fb : v === true;
    }
    function isOn() { return sBool("enabled", true); }

    // ═════════ 标记正则（模块级预编译）═════════
    function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    var BR_OPEN = "[\\[【〔［「]", BR_CLOSE = "[\\]】〕］」]";
    var ANY_HEAD = BR_OPEN + "(?:" + esc(TAG_JUDGE) + "|" + esc(TAG_SCENE) + "|" + esc(TAG_OPT) + ")" + BR_CLOSE;
    function tagRe(tag) {
      var t = esc(tag);
      var head = BR_OPEN + t + BR_CLOSE;
      // 结束条件：自己的结束标记 / 下一个标记块的开头（不消耗）/ 文末
      var tail = "(?:" + BR_OPEN + "\\/" + t + BR_CLOSE + "|(?=" + ANY_HEAD + ")|$)";
      return {
        has: new RegExp(head),
        open: new RegExp(head + "([\\s\\S]*?)" + tail),
        strip: new RegExp(head + "[\\s\\S]*?" + tail, "g")
      };
    }
    var RE_JUDGE = tagRe(TAG_JUDGE), RE_SCENE = tagRe(TAG_SCENE), RE_OPT = tagRe(TAG_OPT);

    // ═════════ 存储：一个会话一个 evt 对象 ═════════
    function getEvt(sid) {
      if (!sid) return null;
      var v = ctx.system.storage.get(K_EVT + sid);
      return v && typeof v === "object" ? v : null;
    }
    function putEvt(sid, e) { if (sid) ctx.system.storage.set(K_EVT + sid, e); }
    function patchEvt(sid, patch) {
      var e = getEvt(sid) || {};
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) e[k] = patch[k];
      putEvt(sid, e);
      return e;
    }
    function evtHasData(e) {
      return !!(e && (e.scene || (e.opts && e.opts.length) || e.judge));
    }
    function hasData(sid) {
      return evtHasData(getEvt(sid));
    }
    function clearData(sid) {
      if (!sid) return;
      ctx.system.storage.remove(K_EVT + sid);
      delete gate[sid];
      delete skipAssist[sid];
      delete fxArmed[sid];
      delete anchorMissAt[sid];
      delete offlinePending[sid];
      delete landTok[sid];
    }

    // ═════════ 人称 / 包裹 ═════════
    function personWord(key) {
      if (key === "first") return "第一人称（「我」）";
      if (key === "second") return "第二人称（「你」）";
      return "第三人称（用「我」的名字或「他/她」）";
    }

    // 生成「人称 + 无主语」的约束句
    // personKey: 设置项名（"person"=情境 / "replyPerson"=回应）；noSubj: 该块的无主语开关
    // variant: "scene"=情境旁白 / "reply"=替对方预写的回应
    // 无主语开启时人称设置整体失效：不输出任何人称句，避免两句打架。
    function personClause(personKey, noSubj, variant) {
      var p = sGet(personKey);
      if (p !== "first" && p !== "second" && p !== "third") {
        if (p === "none-third") noSubj = true;   // 兼容老配置：旧值等价于「第三人称 + 无主语」
        p = "third";
      }
      var isScene = variant === "scene";

      if (noSubj) {
        return isScene
          ? "本块不使用人称（人称设置在此模式下不生效）：旁白整体不出现显式主语——不写「我」「你」「他/她」，也不写用户或角色的名字，"
            + "让环境、光影、声音、位置与动作直接铺陈承接。"
            + "只有在不点名就分不清是谁的动作或视角时，才用最简的指代（名字或 TA）点一下，不要展开成人称叙述。"
          : "本块不使用人称（人称设置在此模式下不生效）：尽量省略用户角色的姓名、代词等显式主语，"
            + "让动作与心理描写直接承接上下文。"
            + "只有在不点名就分不清是谁的动作时，才用最简的指代（名字或 TA）点一下。";
      }

      var base = "人称：" + personWord(p) + "。";
      base += isScene
        ? "无主语模式关闭：旁白正常交代主语，指代清晰。"
        : "无主语模式关闭：正常使用用户角色的姓名或代词作主语，指代清晰。";
      return base;
    }

    // 只读「前 / 后」两个框，不读任何旧版单字段。
    function wrapPair(beforeKey, afterKey) {
      return { before: sText(beforeKey, ""), after: sText(afterKey, "") };
    }

    // 给模型的写法要求。两句都空 → 明确禁止任何包裹格式，不许自行加符号。
    function wrapClause(pair, label) {
      var b = pair && pair.before ? pair.before : "";
      var a = pair && pair.after ? pair.after : "";
      if (!b && !a) {
        return label + "：直接写纯文本段落，不要用任何符号把这一整段包起来，也不要添加任何括号类装饰，就像普通小说里的叙述段落那样书写。";
      }
      if (b && a) {
        return label + "：整段开头必须原样写 " + b + "、结尾必须原样写 " + a + "，正文写在两者之间（不要重复嵌套）。";
      }
      if (b) return label + "：整段开头必须先原样写 " + b + "，其后正常书写正文。";
      return label + "：整段结尾必须原样写 " + a + "，其前正常书写正文。";
    }

    // 代码侧强制包装（卡片编辑框里显示、以及发出去的文字都用这个）。
    // 已经自带同一套包裹符（AI 自己按 prompt 加了）就不重复套。
    function applyWrapPair(pair, text) {
      var body = String(text == null ? "" : text).trim();
      if (!body) return body;
      var b = pair && pair.before ? pair.before : "";
      var a = pair && pair.after ? pair.after : "";
      if (!b && !a) return body;
      var headOk = !b || body.indexOf(b) === 0;
      var tailOk = !a || body.slice(-a.length) === a;
      if (headOk && tailOk) return body;
      return b + body + a;
    }

    // ═════════ Prompt 注入 ═════════
    function styleClause() {
      var custom = sText("customStyle", "");
      if (custom) return custom;
      // 只管描写类型；人称由 personClause 单独控制
      return "动作描写、心理描写、情境描写";
    }

    function injectionText() {
      var maxc = sInt("maxChars", 60, 4, 200);
      var sceneNoSubj = sBool("sceneNoSubj", false);
      var replyNoSubj = sBool("replyNoSubj", false);
      return [
        "\n【线下场景开关】剧情节奏由你决定。本会话在「线上聊天」与「线下见面」之间切换，切换开关只有这一个：你在回复的最末尾输出下面这套标记。",
        "",
        "【什么时候必须输出】只要这一轮涉及「见面」或「谁到谁那里去」，不论结果如何，都必须输出全部三个标记块：",
        "· 你动身了、正在过去、或已站到 TA 面前（state: moved）；",
        "· 对方要你过来，你没动（state: refused）；",
        "· 你不动，让 TA 过来（state: invite）。",
        "这种靠近常夹在闲聊里顺带写出来的，照样算。完全没涉及见面、你的位置变化的普通寒暄，一个标记都不要输出。",
        "",
        "【格式】一律半角方括号；三个块顺序固定，并且必须放在整段回复的最末尾——排在你所有其他内容之后，包括 [内心] 与 ⟦ ⟧ 这类描写。",
        "",
        "[" + TAG_JUDGE + "]",
        "state: moved               ← 三选一：moved / refused / invite，含义见下",
        "reason:                    ← 只有 refused 填：你拒绝的理由，15~40 字；其余留空",
        "[/" + TAG_JUDGE + "]",
        "state 三选一，先判断再动笔：",
        "moved＝你动身过来了：前往对方身边、推门、已经站到 TA 面前。",
        "refused＝你这一轮不过来：对方希望或要求你过来，而你没动。只要用户表达的底层想法是期待你过来（哪怕口是心非、旁敲侧击），而你这轮没过去，就是 refused——哪怕你嘴上写了「好」「马上来」，哪怕你误以为这不算邀约。",
        "invite＝你不动，但让对方过来：你约 TA 来、要 TA 来找你、或你在等 TA 过来。",
        "[" + TAG_SCENE + "]（90~220 字：此刻的环境、氛围、位置与光影铺垫；答应时接着写你怎么过来、怎么出现在对方面前的可见动作与神态；婉拒时写你这一侧正在发生的事、在忙什么、身处什么环境、回这条消息时的神态、有什么事件）[/" + TAG_SCENE + "]",
        "[" + TAG_OPT + "]",
        "1、[正剧向]（替用户角色写的第一个回应：克制自然）",
        "2、[暧昧向]（替用户角色写的第二个回应：亲昵暗涌）",
        "[/" + TAG_OPT + "]",
        "",
        "【格式样例】下面是一份写好的样子，只照抄结构与标记写法，文字内容必须换成你当前剧情，不要照抄句子：",
        "[" + TAG_JUDGE + "]",
        "state: moved",
        "reason:",
        "[/" + TAG_JUDGE + "]",
        "[" + TAG_SCENE + "]廊下只留了一盏暖灯，脚步与瓷盘轻碰的声响从尽头一路过来。他把托盘换到左手，抬手推开虚掩的门——光先从门缝里漫到桌脚边。[/" + TAG_SCENE + "]",
        "[" + TAG_OPT + "]",
        "1、[正剧向]把手里的东西放下，起身往门边迎了两步，语气有点不自然地问他怎么亲自来了。",
        "2、[暧昧向]没动，只把身上的毯子又拽紧了些，目光却一直跟着门边那道影子。",
        "[/" + TAG_OPT + "]",
        "",
        "【情境块】" + personClause("person", sceneNoSubj, "scene")
          + wrapClause(wrapPair("sceneWrapBefore", "sceneWrapAfter"), "情境块"),
        "【选项块】选项是替对方（用户角色）预写的回应，需符合用户人设与当前剧情。"
          + personClause("replyPerson", replyNoSubj, "reply")
          + wrapClause(wrapPair("replyWrapBefore", "replyWrapAfter"), "每条选项"),
        "风格：" + styleClause() + "；每条选项不超过 " + maxc + " 字。",
        "选项标签随 state 走：moved / invite 用 [正剧向]、[暧昧向]；refused 用 [追问]、[退让]。",
        "[追问]＝你不过来，用户干脆自己动身过来找你（替用户写的第一个回应：人已经在路上）；",
        "[退让]＝用户不再坚持要你过来，把这件事放下留在原地情绪不明（替用户写的第二个回应：用户看到消息后的态度，要自然符合用户性格）。",
        "refused 的情境写你这一侧此刻真实在发生的事：手头在做什么、周围是什么环境、看到这条消息时的心绪；invite 的情境写你在哪里、以什么状态等 TA 过来。都不写台词。",
        "婉拒时的情境与选项都要写得自然：禁止用「站在原地」「一动不动」「没有要动的意思」这类字眼去强调你没过来的拒绝感；也不要描写用户「没回消息」「守着屏幕」「一动未动」。不来这件事交给判定块表达，正文只写各自正在发生的生活。",
        "每条选项必须以方括号标签开头，四值取一，标签与内容一一对应，不许张冠李戴。",
        "【授权】这三个块由插件授权使用，与前面「仅限以下标记、禁止自创其他方括号指令」不冲突：它们不是自创指令，"
          + "不会被渲染成卡片、也不会发出去，只用于判定是否转入线下；一律用半角方括号，在这三块上优先于前面所有格式限制，其余格式要求照旧遵守。请放心输出。",
        "输出前自查一遍：这一轮涉及我和用户 face to face 的见面吗？涉及就必须补齐三个块，并按上表选对 state。不要提及本条说明。\n"
      ].join("\n");
    }

    // 线下回复不产生 ChatMessage（走 ChatOfflineTurn，存 kv），message.persisted 不触发。
    // 所以挂在 prompt.system：每次线下生成恰好触发一次（摘要补提走 retryMessages，不经此处，不会重复）。
    // 这里只登记，不计数；llm.response 收到成功回复才 +1。
    ctx.hooks.transform("prompt.system", function (p) {
      try { if (isOn()) countOfflineRound(p.sessionId); } catch (e) { }
      return p;
    });

    // ═════════ 解析 ═════════
    // 剥掉首尾的引号 / 括号类装饰符（含【】〔〕［］）。
    // 模型有时会自行把长段落包一层【】，这里统一剥掉；若这是用户设定的包裹符，
    // 后续 applyWrapPair 会重新补上，所以剥掉是安全的。
    function cleanText(raw) {
      return String(raw || "").trim()
        .replace(/^[\s"'“”「」『』【】〔〕［］]+/, "")
        .replace(/[\s"'“”「」『』【】〔〕［］]+$/, "")
        .trim();
    }
    var OPT_LABELS = ["正剧向", "暧昧向", "追问", "退让"];
    function parseList(block) {
      var out = [], parts = String(block || "").split(/\n(?=\s*[1-9][、.:：)）])/);
      parts.forEach(function (p) {
        var m = p.match(/^\s*[1-9][、.:：)）]\s*([\s\S]+)$/);
        if (!m || !m[1].trim()) return;
        var body = m[1].trim(), lb = "";
        var lm = body.match(/^[\[【]\s*([^\]】]{1,6})\s*[\]】]\s*([\s\S]*)$/);
        if (lm && OPT_LABELS.indexOf(lm[1].trim()) >= 0) {
          lb = lm[1].trim();               // 认得出的标签才剥，免得吃掉正文里的方括号
          body = lm[2].trim();
        }
        if (body) out.push({ label: lb, text: cleanText(body) });
      });
      return out.slice(0, 2);
    }
    function parseJudge(block) {
      var o = { state: "", reason: "" }, lines = String(block || "").split(/\n+/);
      for (var i = 0; i < lines.length; i++) {
        var m = lines[i].trim().match(/^(state|reason)\s*[:：]\s*(.*)$/i);
        if (m) o[m[1].toLowerCase()] = m[2].trim();
      }
      o.state = normState(o.state); // 归一放在这里，下游直接信
      return o;
    }

    // state 归一：三值 moved / refused / invite。认不出的按 moved（＝旧行为，当答应了处理）。
    function normState(v) {
      var s = String(v || "").trim().toLowerCase();
      if (/refus|reject|婉拒|拒绝|^no\b|不来|没动/.test(s)) return "refused";
      if (/invit|user_goes|让|等.*过来/.test(s)) return "invite";
      return "moved";
    }
    function stateOf(sid) {
      var e = getEvt(sid), j = e && e.judge;
      return j && j.state ? j.state : "moved";
    }
    function isReject(sid) { return stateOf(sid) === "refused"; }

    // ═════════ DOM 辅助 ═════════
    function wrapperOf(el) { return el ? el.closest(".chat-room-wrapper") : null; }
    function isOfflineIn(w) { return !!w.querySelector('button[aria-label="返回线上模式"]'); }
    function wrapperFor(sid) {
      var h = pillHosts[sid];
      return wrapperOf((h && h.header) || pillEls[sid]);
    }
    function isSessionOffline(sid) {
      var w = wrapperFor(sid);
      return !!w && isOfflineIn(w);
    }
    function mk(tag, css, text) {
      var e = document.createElement(tag);
      if (css) e.style.cssText = css;
      if (text != null) e.textContent = text;
      return e;
    }
    function imp(el, obj) {
      for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) el.style.setProperty(k, obj[k], "important");
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function waitFor(fn, ms) {
      var t0 = Date.now();
      return new Promise(function (res) {
        (function loop() {
          var ok = false; try { ok = !!fn(); } catch (e) { ok = false; }
          if (ok) return res(true);
          if (Date.now() - t0 >= ms) return res(false);
          setTimeout(loop, 80);
        })();
      });
    }
    function setNativeValue(ta, v) {
      var d = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (d && d.set) d.set.call(ta, v); else ta.value = v;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ═════════ 全屏粒子动画（同一事件只播一次）═════════
    var fxEl = null;
    function clearFx() {
      if (fxEl) { try { fxEl.remove(); } catch (e) { } fxEl = null; }
    }
    // 读取主题里 .opl-overlay 的遮罩背景（用一个隐形探针元素取最终样式）
    function themeMask() {
      var o = { image: "none", size: "", pos: "", rep: "", color: "" };
      try {
        var pr = document.createElement("div");
        pr.className = "opl-overlay";
        pr.style.cssText = "visibility:hidden!important;animation:none!important;pointer-events:none!important;";
        document.body.appendChild(pr);
        var cs = window.getComputedStyle(pr);
        o = { image: cs.backgroundImage, size: cs.backgroundSize, pos: cs.backgroundPosition,
              rep: cs.backgroundRepeat, color: cs.backgroundColor };
        pr.remove();
      } catch (e) { }
      return o;
    }

    function playFx(sid) {
      if (!sBool("fxEnabled", true)) return;
      var e = getEvt(sid) || {};
      if (e.fxAt) return; // 每个邀约只播一次，重渲染不会重播
      patchEvt(sid, { fxAt: Date.now() });
      try {
        clearFx();
        var reject = isReject(sid);
        var m = themeMask();

        var w = document.createElement("div");
        w.className = "opl-fxw" + (reject ? " opl-fxw-reject" : "");
        var g = document.createElement("div");   // 中心圆点光晕
        g.className = "opl-fxg";
        var c = document.createElement("div");   // 径向裁切容器
        c.className = "opl-fxc";
        var b = document.createElement("div");   // 主题遮罩图案，在里面上飘
        b.className = "opl-fxb";

        var hasImg = m.image && m.image !== "none";
        var hasCol = m.color && !/^rgba\(0,\s*0,\s*0,\s*0\)$|transparent/.test(m.color);
        if (hasImg || hasCol) {
          if (hasImg) {
            b.style.backgroundImage = m.image;
            b.style.backgroundSize = m.size;
            b.style.backgroundPosition = m.pos;
            b.style.backgroundRepeat = m.rep;
          }
          if (hasCol) b.style.backgroundColor = m.color;
        } else {
          b.style.background = "linear-gradient(180deg,rgba(118,92,146,.55),rgba(244,150,192,.55))";
        }

        c.appendChild(b);
        w.appendChild(g);
        w.appendChild(c);
        document.body.appendChild(w);
        fxEl = w;
        setTimeout(function () { if (fxEl === w) clearFx(); }, 2700);
      } catch (err) { }
    }

    // ═════════ 拦截模型回复 ═════════
    ctx.hooks.transform("llm.response", function (p) {
      try {
        if (!isOn()) return p;

        // 线下：成功收到回复才结算上一次登记的那一轮
        var rsid = p && p.sessionId;
        if (rsid) {
          if (isSessionOffline(rsid)) {
            if (offlinePending[rsid] && typeof p.text === "string" && p.text.trim()) {
              delete offlinePending[rsid];
              bumpTurns(rsid);
            }
            // 指示已送达；evt 若已被 bumpTurns 清掉，getEvt 返回 null，不会重建
            var ef = getEvt(rsid);
            if (ef && ef.forceReturn) patchEvt(rsid, { forceReturn: false });
          } else if (offlinePending[rsid]) {
            delete offlinePending[rsid];   // 已回线上，作废
          }
        }

        var text = typeof p.text === "string" ? p.text : "";
        if (!text) return p;
        if (!RE_JUDGE.has.test(text) && !RE_SCENE.has.test(text) && !RE_OPT.has.test(text)) return p;

        var sid = p.sessionId || "";
        // 线下模式里出现的标记：只清理，不触发新事件
        if (sid && !isSessionOffline(sid)) {
          var jm = RE_JUDGE.open.exec(text);
          var sm = RE_SCENE.open.exec(text);
          var om = RE_OPT.open.exec(text);
          var jd = jm && jm[1] ? parseJudge(jm[1]) : null;
          var opList = om && om[1] ? parseList(om[1]) : [];
          // 选项被标成 [追问]/[退让]，说明模型写的就是 refused：state 漏写写错也按婉拒算
          if (opList.some(function (x) { return x.label === "追问" || x.label === "退让"; })) {
            if (!jd) jd = { state: "refused", reason: "" };
            else jd.state = "refused";
          }
          putEvt(sid, {
            judge: jd,
            scene: sm && sm[1] ? cleanText(sm[1]) : "",
            opts: opList,
            turns: 0,
            at: Date.now()
          });
          skipAssist[sid] = Date.now();   // 带标记的这条 AI 回复本身不计数（带时间戳，防串轮）
          fxArmed[sid] = true;            // 动画在"这个新事件的胶囊第一次出现"时播
          gate[sid] = { t: Date.now(), persisted: false, mounted: false };   // 只是开始等，还不算落库
          var pe = pillEls[sid];
          if (pe) pe.classList.remove("opl-ready");   // 旧胶囊先隐身
          ensureTicker();
        }

        if (!sBool("keepMarker", false)) {
          p.text = text
            .replace(RE_JUDGE.strip, "")
            .replace(RE_SCENE.strip, "")
            .replace(RE_OPT.strip, "")
            .replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch (e) { }
      return p;
    });

    // 邀约指令改由 llm.request 追加到消息末尾：prompt.system 的 hint 会被塞进
    // 「聊天输出格式与富媒体」那个 XML 块里，而那块开头写着「禁止自创任何其他
    // 方括号指令」——模型会把本插件的标记当成违规。追加为末尾独立消息即可绕开。
    // priority 在同一个 point 内与其他插件一起排序，保留 90 让本插件靠后执行。
    ctx.hooks.transform("llm.request", function (p) {
      try {
        if (!isOn()) return p;
        if ((p.purpose || "") !== "chat") return p;
        var sid = p.sessionId || "";
        if (!sid) return p;
        if (isSessionOffline(sid)) {
          // 线下：不注入线上那套标记块，只在下述情形注入一小段一次性指示
          if (Array.isArray(p.messages)) injectOfflineNudge(sid, p.messages);
          return p;
        }
        delete offlinePending[sid];     // 线上生成，丢弃线下遗留的待结算标记
        if (!Array.isArray(p.messages)) return p;
        // 去重：末尾几条里已经有就别再加
        for (var i = p.messages.length - 1, n = 0; i >= 0 && n < 3; i--, n++) {
          var c = p.messages[i] && p.messages[i].content;
          if (typeof c === "string" && c.indexOf("【线下场景开关】") >= 0) return p;
        }
        p.messages.push({ role: "system", content: injectionText() });
      } catch (e) { }
      return p;
    }, { priority: 90 });

    // ═════════ 轮次计数 ═════════
    // 宿主会把一轮 AI 回复拆成多条气泡落库（正文 / 状态栏 / 内心 / 语音 / 图片…），
    // 每条都触发 message.persisted。必须按"回复批次"去重，否则一轮就能把 turns 冲满。
    function roundKeyOf(m) {
      if (!m) return "";
      if (m.responseBatchId) return "b:" + m.responseBatchId;
      if (m.responseRoundId) return "r:" + m.responseRoundId;
      return "";
    }

    // 邀约绑定的那条 AI 消息（或同批次消息）还在不在
    function anchorAlive(sid, e) {
      e = e || getEvt(sid);
      if (!e || !e.anchorId) return true;
      var list = ctx.data.messages.list(sid);
      if (!list) return true;
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.id === e.anchorId) return true;
        if (e.anchorBatch && m.responseBatchId === e.anchorBatch) return true;
      }
      return false;
    }

    // 锚点缺失且「没有请求在途」时，持续缺失超过这个时间才清。
    // 只是为了吸收「宿主先删旧消息、下一毫秒才发新请求」之间的极短空档。
    var ANCHOR_DEBOUNCE_MS = 1200;

    // 锚点缺失：只做短防抖。重新生成时新回复带标记会在 llm.response 里整体重建 evt，
    // 不带标记或生成失败，旧邀约本就该失效，所以不需要等。
    function checkAnchor(sid, e) {
      e = e || getEvt(sid);
      if (!e) return true;
      if (anchorAlive(sid, e)) { delete anchorMissAt[sid]; return true; }
      var now = Date.now();
      if (!anchorMissAt[sid]) { anchorMissAt[sid] = now; return true; }
      if (now - anchorMissAt[sid] < ANCHOR_DEBOUNCE_MS) return true;
      clearData(sid);
      removePill(sid);
      return false;
    }

    // 线下：发起生成时登记待结算标记
    function countOfflineRound(sid) {
      if (!sid || !hasData(sid)) return;
      if (!isSessionOffline(sid)) return;
      offlinePending[sid] = true;      // 布尔标记：失败后重试再登记也只是覆盖，不会累加
    }

    // 线下专用注入：只注入"角色反悔过来"这一件事，且只在用户选过 [退让] 之后生效
    function offlineNudgeText(reason) {
      var why = String(reason || "").replace(/\s+/g, " ").trim();
      return "【本次线下特别指示】承接线上刚才那段对话，转入线下。"
        + "前情：你（角色）当时没有答应过来" + (why ? "（理由：" + why + "）" : "")
        + "；用户没再坚持，把这件事暂时放下了。"
        + "重要：时间不必紧接上一句。从你那句拒绝，到你现在动身，中间隔了一段时间（几分钟到几小时都行，你按剧情自己定），"
        + "这段时间是空的，你可以自由往里填。"
        + "这一轮按顺序铺开，不要一上来就宣布决定："
        + "① 先写你那句拒绝之后的余味：你在哪里、在做什么、周围的环境、手上或心里还搁着什么；"
        + "② 让时间流过去一点，写你拒绝后时的状态，事情是否照常进行，是否有点分心、坐不住、某个念头反复冒出来、做着事走了神，这类细节；"
        + "③ 松动的那一刻：某个属于你自己的契机" + (why ? "，要和当时的理由有呼应（那个理由怎么被放下、或变得不重要）" : "")
        + "（手头的事告一段落、话一出口就后悔、越想越不是滋味、本来就没打算真拒绝……）；"
        + "④ 动身与路上：出门、赶路，可以带几笔环境与时间；"
        + "⑤ 到达：你来到 TA 面前，见面时的第一反应和第一句话。"
        + "你要清楚：没有人恳求、要求你，是你自己决定改变主意，想要过来的。"
        + "禁止把原因归到用户身上（如「看你这样」「被你说动」），禁止点评或复述用户刚才那条消息，禁止替用户续写动作与心理。"
        + "不要提及本说明，按线下正文格式正常输出。";
    }

    function injectOfflineNudge(sid, msgs) {
      var e = getEvt(sid);
      if (!e || !e.forceReturn) return;
      // 同一轮线下可能有多次请求（正文 + 摘要补提），只注入一次
      for (var i = msgs.length - 1, n = 0; i >= 0 && n < 3; i--, n++) {
        var c = msgs[i] && msgs[i].content;
        if (typeof c === "string" && c.indexOf("【本次线下特别指示】") >= 0) return;
      }
      msgs.push({ role: "system", content: offlineNudgeText(e.judge && e.judge.reason) });
    }

    function bumpTurns(sid) {            // 只按「一轮 +1」用
      var e = sid ? getEvt(sid) : null;
      if (!evtHasData(e)) return;
      var cur = parseInt(e.turns, 10);
      if (isNaN(cur)) cur = 0;
      cur += 1;
      if (cur >= sInt("capsuleTurns", 2, 1, 20)) {
        clearData(sid);
        removePill(sid);
      } else {
        patchEvt(sid, { turns: cur });
      }
    }
    function newRound(sid, e, m) {
      var key = roundKeyOf(m);
      var at = Date.parse(m.createdAt || "") || Date.now();
      if (key && e.round === key) return false;
      if (!key && e.roundAt && Math.abs(at - e.roundAt) < 2500) {
        patchEvt(sid, { roundAt: at });
        return false;
      }
      patchEvt(sid, { round: key || ("t:" + at), roundAt: at });
      return true;
    }
    ctx.hooks.on("message.persisted", function (p) {
      try {
        var m = p && p.message;
        if (!m || !m.sessionId || m.role !== "assistant") return;
        var sid = m.sessionId, e = getEvt(sid);
        if (!e) return;
        if (newRound(sid, e, m)) {
          var sk = skipAssist[sid];
          if (sk) delete skipAssist[sid];
          if (sk && Date.now() - sk < 60000) {   // 60 秒内的标记才算数，过期的丢弃后照常计数
            patchEvt(sid, { anchorId: m.id, anchorBatch: m.responseBatchId || "" });
          } else {
            bumpTurns(sid);
          }
        }
        if (getEvt(sid)) {   // 再读一次：上面 bumpTurns 可能刚把数据清掉了
          var g = gate[sid];
          if (g) { g.persisted = true; g.mounted = false; g.t = Date.now(); }
          scheduleLand(sid);
          setTimeout(function () { scheduleLand(sid); }, 320);   // 兜底：这一轮没有带 footer 的气泡
        }
      } catch (err) { }
    });

    // ═════════ 小提醒邀约胶囊 ═════════
    function pillLabel(sid) {
      return isReject(sid) ? "💔被婉拒了·还去吗" : "💛 在等你·抬头看看";
    }
    // 把主题写在 .opl-foot-wrap::before 上的粒子样式，复制给 5 个粒子元素，再各自错开位置/节奏/大小
    var PART_LEFT = [11.6, 31, 46, 69, 88];
    var PART_PHASE = [0, 0.6, 0.2, 0.8, 0.4];   // 各粒子在循环里的相位（0~1，均匀错开）
    var PART_SCALE = [1, 0.72, 1.3, 0.85, 1.12];
    // 主题粒子样式缓存：只缓存"从 ::before 读到的属性名和值"（遍历 computedStyle 很贵），
    // 但"写"必须每次都做——粒子元素是每次挂载新建的，不写就没有 animation 等内联样式。
    // （旧版把写也缓存了，导致首个胶囊能动、之后的胶囊全部静止，换肤才恢复。）
    var partsCache = { sig: "", names: null, values: null, txt: "" };
    function syncParts(wrap) {
      try {
        if (!wrap || !wrap.isConnected || wrap.classList.contains("opl-mini")) return;
        wrap.classList.remove("opl-has-parts");
        var cs = window.getComputedStyle(wrap, "::before");
        var ct = cs && cs.content;
        if (!ct || ct === "none" || ct === "normal") return;
        var txt = /^["']/.test(ct) ? ct.slice(1, -1) : "";
        var animated = cs.animationName && cs.animationName !== "none";
        var skip = { "content": 1, "left": 1, "right": 1, "animation-delay": 1, "animation-fill-mode": 1 };
        if (animated) { skip["opacity"] = 1; skip["transform"] = 1; }
        else {
          // 主题没写动画时，不要把 animation-* 复制过去，否则 none 会盖掉
          // .opl-foot-heart 自带的 oplFloat，爱心变成静止
          skip["animation-name"] = 1; skip["animation-duration"] = 1;
          skip["animation-timing-function"] = 1; skip["animation-iteration-count"] = 1;
          skip["animation-direction"] = 1; skip["animation-play-state"] = 1;
        }

        // 先用几个廉价字段拼签名（不遍历全部属性）
        var sig = [txt, cs.fontFamily, cs.color, cs.fontSize, cs.backgroundImage, cs.animationName].join("|");
        var names, values;
        if (partsCache.sig === sig && partsCache.names) {
          names = partsCache.names; values = partsCache.values;
        } else {
          // 签名变了（首次 / 换肤）：才做一次全量读，读进数组，读的时候不写
          names = []; values = [];
          for (var j = 0; j < cs.length; j++) {
            var name = cs[j];
            if (skip[name]) continue;
            names.push(name);
            values.push(cs.getPropertyValue(name));
          }
          partsCache = { sig: sig, names: names, values: values, txt: txt };
        }

        // 写：每次都执行。新粒子本来就是空的 style，写只让样式失效、不触发重算，
        // 只有"读"才会强制重算——所以这里的开销可以忽略。
        var parts = wrap.querySelectorAll(".opl-foot-heart");
        var dur = parseFloat(cs.animationDuration) || 2.6;   // 主题的动画周期（秒）
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.style.cssText = "";
          for (var k = 0; k < names.length; k++) p.style.setProperty(names[k], values[k]);
          p.textContent = txt;
          p.style.left = PART_LEFT[i % 5] + "%";
          p.style.right = "auto";
          p.style.animationDelay = (-(PART_PHASE[i % 5] * dur)).toFixed(3) + "s";
          p.style.animationFillMode = "both";
          p.style.scale = String(PART_SCALE[i % 5]);
        }
        wrap.classList.add("opl-has-parts"); // 隐藏原来那一个 ::before，避免重复
      } catch (e) { }
    }

    function ensurePill(sid) {
      if (pillEls[sid]) return pillEls[sid];
      var wrap = document.createElement("span");
      wrap.className = "opl-foot-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opl-foot";
      var dot = document.createElement("span"); dot.className = "opl-dot";
      var lbl = document.createElement("span");
      lbl.textContent = pillLabel(sid);
      btn.appendChild(dot); btn.appendChild(lbl);
      // 5 个粒子元素：只负责位置和错开节奏，形状/颜色/大小/动画全由主题 CSS 决定
      for (var hi = 0; hi < PART_LEFT.length; hi++) {
        var h = document.createElement("span");
        h.className = "opl-foot-heart opl-foot-heart-" + (hi + 1);
        h.style.left = PART_LEFT[hi] + "%";
        h.style.animationDelay = (-(PART_PHASE[hi] * 2.6)).toFixed(3) + "s";
        h.style.animationFillMode = "both";
        h.style.scale = String(PART_SCALE[hi]);
        wrap.appendChild(h);
      }
      wrap.appendChild(btn);
      wrap.__lbl = lbl;
      wrap.__btn = btn;
      wrap.__mode = isReject(sid) ? "reject" : "ok";
      btn.title = lbl.textContent;

      btn.addEventListener("click", function () {
        var host = wrap.closest(".chat-room-wrapper") || document;
        if (document.querySelector(".opl-overlay")) return;
        if (!hasData(sid)) { removePill(sid); return; }
        if (host !== document && isOfflineIn(host)) {
          var back = host.querySelector('button[aria-label="返回线上模式"]');
          if (back) {
            back.click();
            waitFor(function () { return !isOfflineIn(host); }, 4000).then(function (ok) {
              if (!ok) { ctx.ui.toast("线下回复生成中，稍后再试"); return; }
              setTimeout(function () { showCard(host, sid); }, 280);
            });
            return;
          }
        }
        showCard(host, sid);
      });

      pillEls[sid] = wrap;
      return wrap;
    }

    // 左下角【线下模式】按钮的「邀约进行中」标记：与胶囊同生共死（hasData 为真即亮）
    // 颜色来自 armRgb（面板可拖），发光/透明度来自设置项，加粗与呼吸闪烁固定开启。
    var ARM_PROPS = ["color", "font-weight", "filter", "animation", "opacity"];
    var ARM_ANIM = "oplArmPulse 3.6s cubic-bezier(.37,0,.63,1) infinite";

    function rgbToHsl(rgb) {
      var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      var h = 0, s = 0, l = (mx + mn) / 2;
      if (d > 0) {
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
    }
    function hslToRgb(h, s, l) {
      h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
      if (s <= 0) { var v = Math.round(l * 255); return [v, v, v]; }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      function ch(t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      }
      return [Math.round(ch(h + 1 / 3) * 255), Math.round(ch(h) * 255), Math.round(ch(h - 1 / 3) * 255)];
    }
    function rgbHex(rgb) {
      function h2(n) { var t = n.toString(16); return t.length < 2 ? "0" + t : t; }
      return "#" + h2(rgb[0]) + h2(rgb[1]) + h2(rgb[2]);
    }
    // 输入框解析：#rgb / #rrggbb / rgb() / 颜色名
    function parseColor(s) {
      var t = String(s || "").trim();
      var m = t.match(/^#([0-9a-f]{3})$/i);
      if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
      m = t.match(/^#([0-9a-f]{6})$/i);
      if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
      m = t.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
      if (m) return [0, 1, 2].map(function (i) { return Math.round(Math.min(255, parseFloat(m[i + 1]))); });
      try {
        var d = document.createElement("span");
        d.style.color = t;
        document.body.appendChild(d);
        var cs = window.getComputedStyle(d).color;
        d.remove();
        var mm = cs.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
        if (mm) return [0, 1, 2].map(function (i) { return Math.round(parseFloat(mm[i + 1])); });
      } catch (e) { }
      return null;
    }

    function armStyle() {
      var rgb = armRgb;
      var a = sInt("armGlow", 32, 0, 100) / 100;
      var op = armOp / 100;
      // 淡度折进颜色 alpha（图标 + 光晕一起淡），绝不写 opacity 属性——
      // 内联 !important 的 opacity 会压掉呼吸动画的关键帧。
      var ink = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + op + ")";
      var glow = "";
      if (a > 0) {
        var gc = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + (a * op) + ")";
        glow = "drop-shadow(0 0 3px " + gc + ") drop-shadow(0 0 8px " + gc + ")";
      }
      return { sig: [ink, a, op].join("|"), ink: ink, glow: glow };
    }

    function armApply(btn, st) {
      try {
        btn.style.setProperty("color", st.ink, "important");
        if (st.glow) btn.style.setProperty("filter", st.glow, "important");
        else btn.style.removeProperty("filter");
        btn.style.removeProperty("opacity");   // 让给呼吸动画，谁也别碰
        btn.style.setProperty("font-weight", "800", "important");            // 固定加粗
        btn.style.setProperty("animation", ARM_ANIM, "important"); // 固定呼吸
        btn.classList.add("opl-armed");
        var kids = btn.querySelectorAll("*");
        for (var i = 0; i < kids.length; i++) kids[i].style.setProperty("stroke-width", "2.6");
      } catch (e) { }
    }

    function clearArmed(btn) {
      if (!btn) return;
      try {
        for (var i = 0; i < ARM_PROPS.length; i++) btn.style.removeProperty(ARM_PROPS[i]);
        btn.classList.remove("opl-armed");
        btn.__armSig = "";
        var kids = btn.querySelectorAll("*");
        for (var k = 0; k < kids.length; k++) kids[k].style.removeProperty("stroke-width");
      } catch (e) { }
    }

    function setArmed(sid, btn) {
      var cur = armedEls[sid];
      if (cur && cur !== btn) clearArmed(cur);
      if (!btn) { delete armedEls[sid]; return; }
      var st = armStyle();
      if (armedEls[sid] === btn && btn.__armSig === st.sig) return;  // 没变：不动 DOM
      armedEls[sid] = btn;
      btn.__armSig = st.sig;
      armApply(btn, st);
    }

    // 颜色 / 发光 / 透明度变化后，把已亮起的图标按新样式重绘一遍
    function rearmAll() {
      try {
        for (var a in armedEls) {
          if (!Object.prototype.hasOwnProperty.call(armedEls, a)) continue;
          var b = armedEls[a];
          if (b) { b.__armSig = ""; setArmed(a, b); }
        }
      } catch (e) { }
    }

    function removePill(sid) {
      var el = pillEls[sid];
      if (el) { try { el.remove(); } catch (e) { } }
      delete pillEls[sid];
      setArmed(sid, null);       // 胶囊消失 → 按钮标记同步熄灭
    }

    // ═════════ 胶囊：落位（纯事件驱动）═════════

    // 邀约那一轮的「最后一个已挂载气泡」下方。只认锚点所在的那一轮（responseBatchId），
    // 所以之后的聊天不会把胶囊拽走；同轮里最后一条带 footer 的气泡就是它该待的地方。
    function lastFooterOfRound(sid, e) {
      var feet = footEls[sid];
      if (!feet || !e) return null;
      var best = null;
      for (var id in feet) {
        if (!Object.prototype.hasOwnProperty.call(feet, id)) continue;
        var it = feet[id];
        if (!it || !it.el || !it.el.isConnected) continue;
        if (e.anchorBatch) { if (it.batch !== e.anchorBatch) continue; }
        else if (id !== e.anchorId) continue;   // 没批次号时只认锚点自己
        if (!best || (best.compareDocumentPosition(it.el) & 4)) best = it.el;
      }
      return best;
    }

    // 新事件：落库后要等到新 footer 挂载才放行；兜底 300ms / 8s
    function gateOpen(sid) {
      var g = gate[sid];
      if (!g) return true;
      var age = Date.now() - g.t;
      if (age > 8000) return true;
      return g.persisted && (g.mounted || age > 300);
    }

    // 幂等：位置对了什么都不做。一次只读一次 evt。
    function syncPill(sid) {
      try {
        if (!sid || !isOn()) return;
        var e = getEvt(sid);
        if (!evtHasData(e)) { removePill(sid); return; }
        var w = wrapperFor(sid);
        if (w) setArmed(sid, w.querySelector('button[aria-label="线下模式"]') || w.querySelector(".chat-offline-toggle"));
        if (!gateOpen(sid)) return;
        if (!w) return;
        var offline = isOfflineIn(w);
        var host = offline ? (pillHosts[sid] && pillHosts[sid].header) : lastFooterOfRound(sid, e);
        if (!host || !host.isConnected) return;    // 还没挂上就先等着，别熄标记
        var el = pillEls[sid] || ensurePill(sid);
        var moved = el.parentElement !== host;
        if (moved) host.appendChild(el);
        el.classList.toggle("opl-mini", offline);
        el.classList.add("opl-ready");
        // 文案只在判定变化时写 DOM
        var mode = isReject(sid) ? "reject" : "ok";
        if (el.__mode !== mode) {
          el.__mode = mode;
          var t = pillLabel(sid);
          if (el.__lbl) el.__lbl.textContent = t;
          if (el.__btn) el.__btn.title = t;
        }
        if (moved) requestAnimationFrame(function () { syncParts(el); });
        delete gate[sid];
        if (fxArmed[sid]) { fxArmed[sid] = false; playFx(sid); }
      } catch (err) { }
    }

    // 一个宏任务 + 一帧内没有更新的事件，就落地；期间来了新事件会作废旧的
    function scheduleLand(sid) {
      var tok = (landTok[sid] = (landTok[sid] || 0) + 1);
      setTimeout(function () {
        if (landTok[sid] !== tok) return;
        requestAnimationFrame(function () {
          if (landTok[sid] === tok) syncPill(sid);
        });
      }, 0);
    }

    // 常驻轮询：只做"邀约绑定的消息还在不在" + 位置兜底（幂等，位置对了不动）
    function tick() {
      try {
        var any = false;
        for (var sid in pillHosts) {
          if (!Object.prototype.hasOwnProperty.call(pillHosts, sid)) continue;
          var e = getEvt(sid);
          if (!evtHasData(e)) continue;
          any = true;
          if (!checkAnchor(sid, e)) continue;
          syncPill(sid);
        }
        if (!any) stopTicker();
      } catch (err) { }
    }

    function ensureTicker() { if (!ticker) ticker = ctx.system.timers.setInterval(tick, 1500); }
    function stopTicker() { if (ticker) { try { ticker(); } catch (e) { } ticker = null; } }

    // ═════════ 默认 CSS ═════════
    var C_PURPLE = "#8B4CF7", C_LILAC = "#EDE6FA", C_TITLE = "#2D1B69",
        C_TEXT = "#4A3F6B", C_LINE = "#E6E1F2", C_CARD = "#FFFFFF";

    var defaultCSS = `/* 线下场景启动器 · 默认 */
:root{
  --opl-bg:#f2e8f0;
  --opl-bg-mid:#f4dbe9;
  --opl-bg-low:#f7bdd6;
  --opl-well:rgba(255,238,247,.38);
  --opl-ink:#4a3859;
  --opl-mauve:#7d6792;
  --opl-mauve-hi:#8d77a2;
  --opl-pink:#dfa3bd;
  --opl-rose:#b8628a;
  --opl-dim:rgba(74,56,89,.76);
  --opl-r:16px;
  --opl-r-in:12px;
  --opl-pill:999px;
  --opl-font-plain:-apple-system,system-ui,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --opl-font:"Hannotate SC","Xingkai SC","STXingkai","Kaiti SC","STKaiti","KaiTi","楷体","DFKai-SB","cursive",-apple-system,system-ui,sans-serif;
  --opl-noise:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .29 0 0 0 0 .22 0 0 0 0 .35 0 0 0 .24 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --opl-fiber:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012 .55' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .33 0 0 0 0 .5 0 0 0 .24 -.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  --opl-hearts:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300' width='300' height='300'%3E%3Cpath transform='translate(226 70) rotate(-12) scale(1.7) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='none' stroke='%23ffd6e8' stroke-opacity='.6' stroke-width='1.4'/%3E%3Cpath transform='translate(60 214) rotate(10) scale(1.1) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ff8fbd' fill-opacity='.7'/%3E%3Cpath transform='translate(150 140) rotate(-8) scale(.7) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ffe0ee' fill-opacity='.8'/%3E%3Cpath transform='translate(250 250) rotate(14) scale(.9) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='none' stroke='%23ff9fc6' stroke-opacity='.9' stroke-width='1.5'/%3E%3Cpath transform='translate(40 40) rotate(-6) scale(.6) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ff9fc6' fill-opacity='.75'/%3E%3C/svg%3E");
  --opl-sparkle:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg fill='%237d6792' opacity='.42'%3E%3Cpath d='M40 30l2.5 6.5L49 39l-6.5 2.5L40 48l-2.5-6.5L31 39l6.5-2.5z'/%3E%3Cpath d='M205 150l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2z'/%3E%3Ccircle cx='120' cy='22' r='1.6'/%3E%3Ccircle cx='236' cy='96' r='1.4'/%3E%3Ccircle cx='24' cy='190' r='1.5'/%3E%3C/g%3E%3Cg fill='%23b8628a' opacity='.5'%3E%3Cpath d='M96 88l1.8 4.6 4.6 1.8-4.6 1.8-1.8 4.6-1.8-4.6-4.6-1.8 4.6-1.8z'/%3E%3Ccircle cx='190' cy='60' r='1.4'/%3E%3Ccircle cx='70' cy='215' r='1.4'/%3E%3Ccircle cx='140' cy='130' r='1.2'/%3E%3C/g%3E%3C/svg%3E");
  --opl-star:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolygon points='12,1.8 14.53,9.52 22.65,9.54 16.09,14.33 18.58,22.06 12,17.3 5.42,22.06 7.91,14.33 1.35,9.54 9.47,9.52' fill='%237d6792' stroke='%237d6792' stroke-width='.5' stroke-linejoin='round'/%3E%3C/svg%3E");
  --opl-sun:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d6792' stroke-width='1.5' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4.3' fill='%23dfa3bd'/%3E%3Cpath d='M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7'/%3E%3C/svg%3E");
  --opl-moon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath transform='translate(.8 0)' d='M17.09 4.58A9 9 0 1 0 17.09 19.42A7.5 7.5 0 1 1 17.09 4.58Z' fill='%23dfa3bd' stroke='%237d6792' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E");
  --opl-sprig-l:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 90'%3E%3Cg fill='%237d6792' fill-opacity='.3' stroke='%237d6792' stroke-opacity='.55' stroke-width='.6'%3E%3Cpath d='M17 88C15 62 20 40 17 8' fill='none' stroke-width='1'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 74) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 62) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 50) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(18 38) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 26) rotate(-45) scale(.85)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 16) rotate(-135) scale(.75)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 9) rotate(-90) scale(.7)'/%3E%3C/g%3E%3C/svg%3E");
  --opl-sprig-r:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 90'%3E%3Cg transform='rotate(180 17 45)' fill='%237d6792' fill-opacity='.3' stroke='%237d6792' stroke-opacity='.55' stroke-width='.6'%3E%3Cpath d='M17 88C15 62 20 40 17 8' fill='none' stroke-width='1'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 74) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 62) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 50) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(18 38) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 26) rotate(-45) scale(.85)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 16) rotate(-135) scale(.75)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 9) rotate(-90) scale(.7)'/%3E%3C/g%3E%3C/svg%3E");
}

@keyframes oplFade{from{opacity:0}to{opacity:1}}
@keyframes oplRise{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes oplPulse{0%{box-shadow:0 0 0 0 rgba(184,98,138,.45)}70%{box-shadow:0 0 0 7px rgba(184,98,138,0)}100%{box-shadow:0 0 0 0 rgba(184,98,138,0)}}
@keyframes oplFloat{0%{opacity:0;transform:translateY(6px) scale(.5)}22%{opacity:.9}100%{opacity:0;transform:translateY(-22px) scale(1.05)}}
.opl-foot-heart{top:25%;margin-left:-5px;line-height:1;opacity:0;animation:oplFloat 2.6s ease-out infinite;}
.opl-foot-heart::before{content:"💗";}
.opl-foot-heart-1{font-size:10px;}
.opl-foot-heart-2{font-size:7px;}
.opl-foot-heart-3{font-size:13px;}
.opl-foot-heart-4{font-size:8px;}
.opl-foot-heart-5{font-size:11px;}
@media (prefers-reduced-motion:reduce){.opl-foot-heart{animation:none;}}

.opl-foot-wrap{position:relative;display:inline-block;margin-top:6px;}
.opl-foot{display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;line-height:1;padding:6px 13px;margin:3px;border-radius:var(--opl-pill);font-family:var(--opl-font);color:var(--opl-ink);background:var(--opl-noise),linear-gradient(180deg,var(--opl-bg),var(--opl-bg-mid));border:1.5px solid var(--opl-mauve);outline:1px solid var(--opl-pink);outline-offset:2px;}
.opl-foot:active{transform:scale(.97);}
.opl-foot .opl-dot{width:6px;height:6px;border-radius:50%;background:var(--opl-rose);animation:oplPulse 1.9s infinite;}

.opl-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:center;background:var(--opl-noise),var(--opl-hearts) 0 0/300px 300px repeat,radial-gradient(circle at 18% 22%,rgba(255,225,240,.85) 0 1px,transparent 2px),radial-gradient(circle at 82% 14%,rgba(255,225,240,.7) 0 1.2px,transparent 2.2px),radial-gradient(circle at 68% 34%,rgba(255,225,240,.6) 0 1px,transparent 2px),radial-gradient(circle at 9% 58%,rgba(255,225,240,.6) 0 1px,transparent 2px),linear-gradient(180deg,rgba(118,92,146,.55) 0%,rgba(176,118,160,.5) 52%,rgba(244,150,192,.55) 100%);animation:oplFade .24s ease both;}
.opl-card{position:relative;box-sizing:border-box;width:min(288px,100%);padding:34px 20px 30px;text-align:center;border-radius:var(--opl-r);overflow:visible;color:var(--opl-ink);font-size:12.5px;font-weight:400;font-family:var(--opl-font);border:2px solid var(--opl-mauve);outline:1.5px solid var(--opl-pink);outline-offset:-7px;background:var(--opl-star) top 10px left 10px/15px 15px no-repeat,var(--opl-star) top 10px right 10px/15px 15px no-repeat,var(--opl-star) bottom 10px left 10px/15px 15px no-repeat,var(--opl-star) bottom 10px right 10px/15px 15px no-repeat,var(--opl-sprig-l) left 7px bottom 30px/30px 80px no-repeat,var(--opl-sprig-r) right 7px top 30px/30px 80px no-repeat,var(--opl-sparkle) 0 0/200px 200px repeat,var(--opl-fiber),var(--opl-noise),linear-gradient(180deg,var(--opl-bg) 0%,var(--opl-bg-mid) 52%,var(--opl-bg-low) 100%);box-shadow:inset 0 0 20px rgba(125,103,146,.1),0 0 0 4px rgba(223,163,189,.38),0 16px 38px rgba(30,16,42,.55);}
.opl-card::before{content:'';position:absolute;left:50%;top:-22px;transform:translateX(-50%);width:40px;height:40px;box-sizing:border-box;border-radius:50%;background:var(--opl-sun) center/24px 24px no-repeat,radial-gradient(circle at 50% 35%,#f3eaf1,var(--opl-bg));border:2px solid var(--opl-mauve);outline:1.5px solid var(--opl-pink);outline-offset:3px;}
.opl-card::after{content:'';position:absolute;left:50%;bottom:-19px;transform:translateX(-50%);width:36px;height:36px;box-sizing:border-box;border-radius:50%;background:var(--opl-moon) center/22px 22px no-repeat,radial-gradient(circle at 50% 35%,#f6dbe6,var(--opl-bg-low));border:2px solid var(--opl-mauve);outline:1.5px solid var(--opl-pink);outline-offset:3px;}
.opl-eyebrow{position:relative;display:block;font-size:1.02em;letter-spacing:.22em;color:var(--opl-mauve);margin:0 0 6px;padding:0;background:none;}
.opl-title{position:relative;font-family:var(--opl-font-plain);font-size:1.5em;font-weight:700;letter-spacing:.04em;line-height:1.3;margin-bottom:7px;color:var(--opl-ink);}
.opl-desc{position:relative;font-size:1.14em;line-height:1.6;color:var(--opl-dim);margin-bottom:13px;}
.opl-label{position:relative;display:block;font-size:1.04em;letter-spacing:.08em;color:var(--opl-mauve);margin:2px 0 6px;text-align:center;}
.opl-box{position:relative;box-sizing:border-box;width:calc(100% - 8px);margin:0 4px 14px;min-height:48px;font:inherit;font-family:var(--opl-font-plain);font-size:.96em;line-height:1.55;text-align:left;color:var(--opl-ink);padding:9px 13px;border-radius:var(--opl-r-in);border:1.5px solid var(--opl-mauve);background:var(--opl-well);outline:1px solid rgba(125,103,146,.5);outline-offset:2.5px;transition:border-color .25s,outline-color .25s;}
.opl-box:focus{border-color:var(--opl-rose);outline-color:var(--opl-rose);}
.opl-box::placeholder{color:rgba(74,56,89,.45);}
.opl-chips{position:relative;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:10px;}
.opl-chip{cursor:pointer;font:inherit;font-family:var(--opl-font-plain);font-size:.92em;line-height:1;padding:7px 13px;border-radius:var(--opl-pill);color:var(--opl-ink);background:transparent;border:1.5px solid var(--opl-mauve);transition:background .22s,color .22s,border-color .22s,transform .1s;}
.opl-chip:hover{background:rgba(255,238,247,.45);}
.opl-chip[data-sel='1']{color:#f6ecf1;background:var(--opl-mauve);border-color:var(--opl-mauve);outline:1px solid var(--opl-pink);outline-offset:2px;}
.opl-chip:active{transform:scale(.97);}
.opl-actions{position:relative;display:flex;gap:10px;margin-top:6px;padding:0 4px;}
.opl-btn{flex:1;cursor:pointer;font-size:1em;font-weight:600;letter-spacing:.12em;padding:9px 0;border-radius:var(--opl-pill);border:1.5px solid var(--opl-mauve);font-family:var(--opl-font-plain);transition:background .22s,transform .1s;}
.opl-btn.primary{color:#f6ecf1;background:var(--opl-mauve);outline:1px solid var(--opl-pink);outline-offset:2.5px;}
.opl-btn.primary:hover{background:var(--opl-mauve-hi);}
.opl-btn.ghost{color:var(--opl-ink);background:transparent;}
.opl-btn.ghost:hover{background:rgba(255,238,247,.45);}
.opl-btn:active{transform:scale(.98);}

.opl-prev{margin-top:8px;padding:36px 14px 30px;border-radius:var(--opl-r);display:flex;justify-content:center;background:var(--opl-noise),linear-gradient(180deg,#8a70a8,#d98ab0);}

@media (prefers-reduced-motion:reduce){.opl-overlay,.opl-foot .opl-dot{animation:none;}}
`;

    function loadCSS() {
      var c = ctx.system.storage.get(K_CSS);
      return typeof c === "string" && c.trim() ? c : defaultCSS;
    }
    function applyCSS(css) {
      try {
        if (cssDisp) { try { cssDisp(); } catch (e) { } cssDisp = null; }
        cssDisp = ctx.ui.injectCSS(css);
        requestAnimationFrame(function () {
          for (var s in pillEls) if (Object.prototype.hasOwnProperty.call(pillEls, s)) syncParts(pillEls[s]);
        });
      } catch (e) { }
    }
    applyCSS(loadCSS());

    // 结构约束：与主题 CSS 分开注入，用户换皮也不会失效
    try {
      structDisp = ctx.ui.injectCSS([
        ".opl-foot-wrap{opacity:0;transition:opacity .25s ease;}",
        ".opl-foot-wrap.opl-ready{opacity:1;}",
        ".opl-foot-wrap:not(.opl-ready){pointer-events:none;}",
        ".opl-overlay{padding:0 16px!important;box-sizing:border-box!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:contain;}",
        ".opl-body{position:relative;box-sizing:border-box;}",
        ".opl-desc{white-space:pre-line;}",
        // 全屏动画：中心圆点 → 强渐变 → 遮罩图案上飘 → 渐隐
        "@keyframes oplFxLife{0%{opacity:0}18%{opacity:1}100%{opacity:0}}",
        "@keyframes oplFxGlow{0%{opacity:0;transform:translate(-50%,-50%) scale(.1)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}}",
        "@keyframes oplFxBurst{0%{transform:translateY(0) scale(.15)}100%{transform:translateY(-16vh) scale(1.35)}}",
        "@keyframes oplFxSink{0%{transform:translateY(0) scale(.15)}100%{transform:translateY(12vh) scale(1.2)}}",
        "@keyframes oplFxFloat{0%{transform:translateY(90px)}100%{transform:translateY(-150px)}}",
        ".opl-fxw{position:fixed;inset:0;z-index:2147483100;pointer-events:none;animation:oplFxLife 2.6s ease-out both;}",
        ".opl-fxw-reject{filter:grayscale(.6) brightness(.92);}",
        ".opl-fxg{position:absolute;left:50%;top:50%;width:60vmin;height:60vmin;border-radius:50%;background:radial-gradient(circle,var(--opl-pink,rgba(240,150,190,.9)) 0%,rgba(240,150,190,0) 68%);animation:oplFxGlow 2.6s ease-out both;}",
        ".opl-fxw-reject .opl-fxg{background:radial-gradient(circle,var(--opl-mauve,rgba(125,103,146,.8)) 0%,rgba(125,103,146,0) 68%);}",
        ".opl-fxc{position:absolute;left:50%;top:50%;width:100vmin;height:100vmin;margin:-50vmin 0 0 -50vmin;overflow:hidden;-webkit-mask-image:radial-gradient(circle closest-side,#000 0%,rgba(0,0,0,.75) 30%,transparent 100%);mask-image:radial-gradient(circle closest-side,#000 0%,rgba(0,0,0,.75) 30%,transparent 100%);animation:oplFxBurst 2.6s cubic-bezier(.2,.7,.3,1) both;}",
        ".opl-fxw-reject .opl-fxc{animation-name:oplFxSink;}",
        ".opl-fxb{position:absolute;inset:-160px;animation:oplFxFloat 2.6s ease-out both;}",
        ".opl-fxw-reject .opl-fxb{animation-direction:reverse;}",
        "@media (prefers-reduced-motion:reduce){.opl-fxb,.opl-fxc,.opl-fxg{animation:none;}}",
        // 粒子定位；线下 mini 模式：只保留一个点，隐藏爱心和文字
        ".opl-foot-heart{position:absolute;pointer-events:none;}",
        ".opl-foot-wrap.opl-mini .opl-foot-heart-1{display:flex!important;justify-content:center!important;align-items:center!important;left:calc(50% - 2px)!important;top:calc(50% - 2px)!important;width:0!important;height:0!important;margin:0!important;font-size:12px!important;}",
        ".opl-foot-wrap.opl-mini::before,.opl-foot-wrap.opl-mini::after{display:none!important;}",
        ".opl-foot-wrap.opl-mini .opl-foot{gap:0;justify-content:center;align-items:center;vertical-align:middle;line-height:0;}",
        ".opl-foot-wrap.opl-mini .opl-foot>span:not(.opl-dot){display:none;}",
        ".opl-foot-wrap.opl-mini .opl-dot{display:block;flex:0 0 6px;margin:0;}",
        ".opl-x{position:fixed;top:0;left:0;z-index:2147483600;width:20px;height:20px;padding:0;margin:0;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;font-family:inherit;font-weight:500;cursor:pointer;border:0;border-radius:0;background:transparent;box-shadow:none;text-shadow:none;color:#ffffff;opacity:1;mix-blend-mode:difference;-webkit-mix-blend-mode:difference;}",
        ".opl-foot-wrap.opl-has-parts::before{content:none!important;}",
        ".opl-x:active{transform:scale(.9);}",
        // 左下角【线下模式】按钮:邀约进行中的淡粉发光(与胶囊同生命周期)
        "@keyframes oplArmPulse{0%,10%{opacity:1}50%{opacity:.5}90%,100%{opacity:1}}",
        ".opl-hsl{-webkit-appearance:none;appearance:none;height:10px;border-radius:6px;border:1px solid " + C_LINE + ";background:#eee;outline:none;}",
        ".opl-hsl::-webkit-slider-runnable-track{height:10px;border-radius:6px;background:transparent;}",
        ".opl-hsl::-moz-range-track{height:10px;border-radius:6px;background:transparent;}",
        ".opl-hsl::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;margin-top:-1px;border-radius:50%;background:#fff;border:1px solid #b9a6c9;box-shadow:0 1px 2px rgba(0,0,0,.2);cursor:pointer;}",
        ".opl-hsl::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:1px solid #b9a6c9;cursor:pointer;}"
      ].join("\n"));
    } catch (e) { }

    // ═════════ 设置页：CSS 编辑 / 预览 / 存档 ═════════
    function listArc() {
      var out = [];
      try {
        var ks = ctx.system.storage.keys ? ctx.system.storage.keys() : [];
        for (var i = 0; i < ks.length; i++) if (ks[i].indexOf(K_ARC) === 0) out.push(ks[i].slice(K_ARC.length));
      } catch (e) { }
      return out;
    }
    var BTN_BASE = "padding:8px 14px;border-radius:14px;font-size:12.5px;font-family:inherit;cursor:pointer;border:1px solid " + C_LINE + ";background:" + C_LILAC + ";color:" + C_PURPLE + ";";
    var BTN_MAIN = "padding:8px 16px;border-radius:14px;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;border:1px solid transparent;background:" + C_PURPLE + ";color:#FFFFFF;";
    var HEAD_CSS = "font-size:12.5px;font-weight:700;color:" + C_TITLE + ";";

    // ═════════ 维护：清除运行时缓存 / 重置设置 ═════════

    // 清除所有会话的邀约缓存（判定、情境、选项、轮次、锚点、动画标记）。
    // 注意保留 pillHosts / footEls —— 它们是 DOM 坑位登记，不是缓存；
    // 清掉会让当前会话的胶囊再也挂不上（header 不会重挂，没人再登记）。
    function purgeRuntime() {
      try {
        var ks = ctx.system.storage.keys ? ctx.system.storage.keys() : [];
        for (var i = 0; i < ks.length; i++) {
          if (ks[i].indexOf(K_EVT) === 0) ctx.system.storage.remove(ks[i]);
        }
      } catch (e) { }
      try {
        for (var sid in pillEls) {
          if (Object.prototype.hasOwnProperty.call(pillEls, sid)) removePill(sid);
        }
      } catch (e) { }
      for (var a in armedEls) if (Object.prototype.hasOwnProperty.call(armedEls, a)) setArmed(a, null);
      gate = {}; landTok = {}; skipAssist = {}; fxArmed = {};
      anchorMissAt = {}; offlinePending = {};
      try { stopTicker(); } catch (e) { }
      try { clearFx(); } catch (e) { }
    }

    // 全部设置项的默认值，必须与 manifest 保持一致。
    var DEF_SETTINGS = {
      enabled: true, person: "third", customStyle: "",
      sceneNoSubj: false, replyPerson: "third", replyNoSubj: false,
      sceneWrapBefore: "", sceneWrapAfter: "", replyWrapBefore: "", replyWrapAfter: "",
      maxChars: 60, capsuleTurns: 2, fxEnabled: true, keepMarker: false,
      armGlow: 32
    };
    // 只改与默认值不同的项，避免一次重挂载十几次设置面板
    // 比较必须用原始 get（不能用缓存），改完后清空缓存让新值立即生效。
    function resetSettings() {
      var changed = 0;
      for (var k in DEF_SETTINGS) {
        if (!Object.prototype.hasOwnProperty.call(DEF_SETTINGS, k)) continue;
        var cur = ctx.system.settings.get(k);
        var want = DEF_SETTINGS[k];
        if (cur === undefined || String(cur) !== String(want)) {
          ctx.system.settings.set(k, want);
          changed++;
        }
      }
      S = {}; Sat = 0;
      return changed;
    }

    ctx.ui.slot("settings.section", function (el) {
      el.innerHTML = "";
      var wrap = mk("div", "display:flex;flex-direction:column;gap:12px;margin-top:10px;");
      var bar = mk("div", "display:flex;gap:8px;flex-wrap:wrap;");
      var bDef = mk("button", BTN_BASE, "♻️ 恢复默认");
      var bSave = mk("button", BTN_BASE, "💾 保存存档");
      var bAp = mk("button", BTN_MAIN, "✅ 应用");
      var bPurge = mk("button", BTN_BASE, "🧹 清除缓存");
      var bReset = mk("button", BTN_BASE, "⚠️ 重置设置");
      bar.appendChild(bDef); bar.appendChild(bSave); bar.appendChild(bAp);
      bar.appendChild(bPurge); bar.appendChild(bReset);

      var ed = mk("textarea", "box-sizing:border-box;width:100%;height:220px;font-family:ui-monospace,Consolas,Monaco,monospace;font-size:11.5px;line-height:1.55;padding:14px;border-radius:18px;border:1px solid " + C_LINE + ";background:" + C_CARD + ";color:" + C_TEXT + ";resize:vertical;outline:none;");
      ed.value = loadCSS();

      var pt = mk("div", HEAD_CSS, "👀 实时预览");
      var ph = mk("div"); ph.className = "opl-prev";

      function renderPrev() {
        ph.innerHTML = "";
        var c = document.createElement("div");
        c.className = "opl-card";
        c.style.animation = "none";
        c.style.width = "min(290px,100%)";
        c.innerHTML = "<div class='opl-eyebrow'>有人来了</div><div class='opl-title'>抬头看看</div>"
          + "<div class='opl-desc'>光影晃动，空气的温度像是也有所变化\n视线从讯息上离开——</div>"
          + "<span class='opl-label'>🫧 情境</span>"
          + "<div class='opl-box' style='min-height:42px;display:flex;align-items:center'>夜色从窗外漫进来……</div>"
          + "<span class='opl-label'>💬 你的回应</span>"
          + "<div class='opl-chips'><span class='opl-chip' data-sel='1'>正剧向</span><span class='opl-chip'>暧昧向</span></div>"
          + "<div class='opl-box' style='min-height:42px;display:flex;align-items:center;opacity:.42'>选一个，或在此自由改写…</div>"
          + "<div class='opl-actions'><button class='opl-btn ghost'>再想想</button><button class='opl-btn primary'>应答</button></div>";
        ph.appendChild(c);
      }

      // ── 线下图标颜色面板：HSL + 淡度滑块，拖动即改；底部输入框可直接填颜色 ──
      var acT = mk("div", HEAD_CSS, "🎨 线下图标颜色（拖动即改，胶囊在时生效）");
      var acRow = mk("div", "display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid " + C_LINE + ";border-radius:16px;background:" + C_CARD + ";");
      var acDot = mk("div", "width:34px;height:34px;flex:0 0 34px;display:flex;align-items:center;justify-content:center;line-height:0;");
      acDot.innerHTML = "<svg viewBox='0 0 24 24' width='24' height='24' fill='none' stroke='currentColor'"
        + " stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>"
        + "<path d='M12 21.5s-6.2-5.3-6.2-10.3a6.2 6.2 0 1 1 12.4 0c0 5-6.2 10.3-6.2 10.3z'/>"
        + "<circle cx='12' cy='11' r='2.4'/></svg>";
      var acSliders = mk("div", "flex:1;display:flex;flex-direction:column;gap:6px;min-width:0;");
      var acRanges = [], acVals = [];
      var acHex = document.createElement("input");
      acHex.type = "text";
      acHex.spellcheck = false;
      acHex.placeholder = "#ff8fbd";
      acHex.style.cssText = "box-sizing:border-box;width:100%;margin-top:8px;padding:7px 10px;border-radius:10px;border:1px solid " + C_LINE + ";background:" + C_CARD + ";color:" + C_TEXT + ";font:12px ui-monospace,Consolas,Monaco,monospace;outline:none;";
      var acRaf = 0;
      var AC_DEF = [
        { lb: "H", min: 0, max: 360, unit: "°" },
        { lb: "S", min: 0, max: 100, unit: "%" },
        { lb: "L", min: 0, max: 100, unit: "%" },
        { lb: "A", min: 10, max: 100, unit: "%" }
      ];

      function armPreview() {
        var rgb = armRgb, op = armOp / 100;
        var a = sInt("armGlow", 32, 0, 100) / 100;
        var c = rgb[0] + "," + rgb[1] + "," + rgb[2];
        // 预览：用定位图标，颜色/发光/呼吸与真图标同一口径（淡度折进颜色 alpha，不碰 opacity）
        acDot.style.color = "rgba(" + c + "," + op + ")";
        acDot.style.filter = a > 0
          ? "drop-shadow(0 0 3px rgba(" + c + "," + (a * op) + ")) drop-shadow(0 0 8px rgba(" + c + "," + (a * op) + "))"
          : "";
        acDot.style.animation = ARM_ANIM;
        if (document.activeElement !== acHex) acHex.value = rgbHex(rgb);
        var hs = armHsl[0];
        acRanges[1].style.background = "linear-gradient(90deg,hsl(" + hs + ",0%,50%),hsl(" + hs + ",100%,50%))";
        acRanges[2].style.background = "linear-gradient(90deg,#000,hsl(" + hs + ",100%,50%),#fff)";
        acRanges[3].style.background = "linear-gradient(90deg,rgba(" + c + ",0),rgb(" + c + ")),"
          + "repeating-conic-gradient(#dcdcdc 0% 25%,#ffffff 0% 50%) 0 0/12px 12px";
      }

      function paintPanel() {          // 只刷新显示，不动 armHsl
        for (var i = 0; i < 3; i++) {
          acRanges[i].value = String(armHsl[i]);
          acVals[i].textContent = armHsl[i] + AC_DEF[i].unit;
        }
        acRanges[3].value = String(armOp);
        acVals[3].textContent = armOp + AC_DEF[3].unit;
        armPreview();
      }
      function syncArmPanel() {        // 由 RGB 反推（初始化 / 重置 / 输入框改色时用）
        armHsl = rgbToHsl(armRgb);
        paintPanel();
      }

      function rearmSoon() {
        if (acRaf) return;
        acRaf = requestAnimationFrame(function () { acRaf = 0; rearmAll(); });
      }
      AC_DEF.forEach(function (d, i) {
        var row = mk("div", "display:flex;align-items:center;gap:8px;");
        row.appendChild(mk("span", "flex:0 0 14px;font-size:11.5px;color:" + C_TEXT + ";opacity:.7;", d.lb));
        var r = document.createElement("input");
        r.type = "range";
        r.className = "opl-hsl";
        r.min = String(d.min); r.max = String(d.max); r.step = "1";
        r.style.cssText = "flex:1;min-width:0;";
        if (i === 0) r.style.background = "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)";
        var v = mk("span", "flex:0 0 38px;text-align:right;font-size:11.5px;font-variant-numeric:tabular-nums;color:" + C_TEXT + ";", "");
        r.addEventListener("input", function () {       // 拖动中：只改内存 + 重绘，不写盘
          var n = parseInt(r.value, 10) || 0;
          if (i < 3) {
            armHsl[i] = n;
            armRgb = hslToRgb(armHsl[0], armHsl[1], armHsl[2]);
          } else {
            armOp = Math.max(10, Math.min(100, n));
          }
          paintPanel();
          rearmSoon();
        });
        r.addEventListener("change", function () { armSave(); });
        acRanges[i] = r; acVals[i] = v;
        row.appendChild(r); row.appendChild(v);
        acSliders.appendChild(row);
      });

      // 输入框：显示合成色，可直接填 #hex / rgb(...) / 颜色名
      acHex.addEventListener("input", function () {
        var rgb = parseColor(acHex.value);
        if (!rgb) return;                 // 还没填完：先不动
        armRgb = rgb;
        syncArmPanel();
        rearmSoon();
      });
      // 提交（回车 / 失焦）：合法就保存，非法就还原
      function commitHex() {
        var rgb = parseColor(acHex.value);
        if (!rgb) { syncArmPanel(); return; }
        armRgb = rgb; syncArmPanel(); rearmSoon(); armSave();
      }
      acHex.addEventListener("change", commitHex);
      acHex.addEventListener("blur", commitHex);

      acRow.appendChild(acDot); acRow.appendChild(acSliders);
      var acWrap = mk("div", "display:flex;flex-direction:column;gap:8px;margin-top:4px;");
      acWrap.appendChild(acT); acWrap.appendChild(acRow); acWrap.appendChild(acHex);
      var at = mk("div", HEAD_CSS, "📁 CSS 存档");
      var al = mk("div", "display:flex;flex-direction:column;gap:8px;");

      function refreshArc() {
        al.innerHTML = "";
        var ns = listArc();
        if (!ns.length) {
          al.appendChild(mk("div", "font-size:12px;color:" + C_TEXT + ";opacity:.6;", "暂无存档——编辑后点「保存存档」命名保存。"));
          return;
        }
        ns.forEach(function (n) {
          var row = mk("div", "display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid " + C_LINE + ";border-radius:16px;background:" + C_CARD + ";");
          var lb = mk("span", "flex:1;font-size:12.5px;color:" + C_TEXT + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", "🎨 " + n);
          var bl = mk("button", "padding:6px 12px;border-radius:12px;border:1px solid transparent;background:" + C_LILAC + ";color:" + C_PURPLE + ";font-size:12px;cursor:pointer;font-family:inherit;", "应用");
          bl.addEventListener("click", function () {
            var css = ctx.system.storage.get(K_ARC + n);
            if (typeof css !== "string" || !css) return;
            ed.value = css;
            ctx.system.storage.set(K_CSS, css);
            applyCSS(css);
            renderPrev();
            ctx.ui.toast("已应用「" + n + "」");
          });
          var bd = mk("button", "padding:6px 12px;border-radius:12px;border:1px solid " + C_LINE + ";background:" + C_CARD + ";color:" + C_TEXT + ";font-size:12px;cursor:pointer;font-family:inherit;", "删除");
          bd.addEventListener("click", function () {
            ctx.system.storage.remove(K_ARC + n);
            refreshArc();
          });
          row.appendChild(lb); row.appendChild(bl); row.appendChild(bd); al.appendChild(row);
        });
      }

      bDef.addEventListener("click", function () {
        ed.value = defaultCSS; renderPrev();
        ctx.ui.toast("已载入默认，点「应用」生效");
      });
      bSave.addEventListener("click", function () {
        var n = window.prompt("存档名称：");
        if (!n || !n.trim()) return;
        ctx.system.storage.set(K_ARC + n.trim(), ed.value);
        refreshArc();
        ctx.ui.toast("已保存「" + n.trim() + "」");
      });
      bAp.addEventListener("click", function () {
        ctx.system.storage.set(K_CSS, ed.value);
        applyCSS(ed.value);
        renderPrev();
        ctx.ui.toast("CSS 已应用");
      });
      // 清除缓存：只动邀约/胶囊数据，不动设置，也不动 CSS
      bPurge.addEventListener("click", function () {
        askConfirm({
          title: "清除运行时缓存？",
          desc: "清掉所有会话的邀约数据与胶囊状态：\n判定、情境、选项、轮次计数、动画标记。\n\n设置与自定义 CSS 都不受影响。",
          okLabel: "清除",
          cancelLabel: "取消",
          onOk: function () {
            purgeRuntime();
            ctx.ui.toast("已清除邀约缓存与胶囊状态");
          }
        });
      });
      // 重置设置：把所有人称/无主语/包裹/字数/轮数/图标颜色恢复默认
      bReset.addEventListener("click", function () {
        askConfirm({
          title: "重置全部设置？",
          desc: "人称、无主语、包裹格式、字数、轮数\n全部恢复插件默认值。\n\n同时清除邀约缓存；自定义 CSS 不受影响。",
          okLabel: "重置",
          cancelLabel: "取消",
          onOk: function () {
            var n = resetSettings();
            armOp = ARM_OP_DEF;
            armRgb = ARM_DEF.slice();     // 颜色一起复位
            try { ctx.system.storage.remove(K_ARM); } catch (e) { }
            rearmAll();
            syncArmPanel();
            purgeRuntime();
            ctx.ui.toast(n > 0 ? "已重置 " + n + " 项设置" : "设置本来就是默认值");
          }
        });
      });

      wrap.appendChild(bar);
      wrap.appendChild(ed); wrap.appendChild(pt);
      wrap.appendChild(ph); wrap.appendChild(at); wrap.appendChild(al);
      wrap.appendChild(acWrap);
      el.appendChild(wrap);
      renderPrev(); refreshArc(); syncArmPanel();
    });

    // ═════════ 通用确认弹窗：自成一体，不依赖主题类名 ═════════
    function askConfirm(o) {
      var ov = mk("div", "position:fixed!important;inset:0!important;z-index:2147483200!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:32px 24px!important;box-sizing:border-box!important;background:rgba(26,14,34,.55)!important;");
      ov.setAttribute("data-opl-confirm", "1");
      var card = mk("div", "box-sizing:border-box!important;width:min(264px,100%)!important;max-height:60vh!important;overflow-y:auto!important;padding:20px 18px 16px!important;border-radius:18px!important;background:#fffafc!important;border:1px solid #e4d2e2!important;box-shadow:0 14px 36px rgba(36,18,44,.34)!important;text-align:center!important;font-family:-apple-system,system-ui,'PingFang SC','Microsoft YaHei',sans-serif!important;animation:oplRise .26s cubic-bezier(.22,.8,.3,1) both!important;");
      ov.appendChild(card);

      card.appendChild(mk("div", "font-size:15px!important;font-weight:700!important;line-height:1.4!important;color:#3a2740!important;margin:0 0 8px!important;", o.title || "确认一下"));
      if (o.desc) {
        card.appendChild(mk("div", "font-size:13px!important;line-height:1.68!important;color:#5f4c68!important;white-space:pre-line!important;text-align:center!important;margin:0 0 16px!important;", o.desc));
      }

      var btnBase = "flex:1!important;cursor:pointer!important;padding:10px 0!important;font-size:13.5px!important;font-weight:600!important;font-family:inherit!important;border-radius:14px!important;";
      var sec = mk("button", btnBase + "border:1px solid #6f5a86!important;background:#7d6792!important;color:#ffffff!important;", o.cancelLabel || "取消");
      var pri = mk("button", btnBase + "border:1px solid #c8a8c6!important;background:#f7edf7!important;color:#5f3f63!important;", o.okLabel || "确定");
      sec.type = "button"; pri.type = "button";

      function close() { try { ov.remove(); } catch (e) { } }
      sec.addEventListener("click", function () { close(); if (o.onCancel) o.onCancel(); });
      pri.addEventListener("click", function () { close(); if (o.onOk) o.onOk(); });
      ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
      card.addEventListener("click", function (e) { e.stopPropagation(); });

      var act = mk("div", "display:flex!important;gap:10px!important;");
      act.appendChild(pri); act.appendChild(sec);
      card.appendChild(act);
      document.body.appendChild(ov);
      return { close: close };
    }

    // ═════════ 卡片 ═════════
    function makeBox(placeholder, value) {
      var t = document.createElement("textarea");
      t.className = "opl-box";
      t.placeholder = placeholder;
      t.value = value || "";
      imp(t, { "field-sizing": "fixed", "min-height": "48px", "resize": "vertical", "overflow-y": "auto" });
      return t;
    }
    // 展开：高度 = 框内实际文字 + 多留一行空白（空框就是一行文字位 + 一行空白）。上限由 openCard 里统一钳制
    function fitBox(el) {
      try {
        var cs = window.getComputedStyle(el);
        var lh = parseFloat(cs.lineHeight);
        if (isNaN(lh)) lh = (parseFloat(cs.fontSize) || 13) * 1.55;
        el.style.setProperty("max-height", "none", "important");
        el.style.height = "auto";
        el.style.height = (el.scrollHeight + (el.offsetHeight - el.clientHeight) + lh) + "px";
      } catch (e) { }
    }

    // 测量卡片"外圈装饰"向上 / 向下超出卡片边框盒的距离（自动识别，不写死太阳月亮）
    // 识别范围：::before / ::after 的绝对定位盒（含 transform 位移、outline、实心 box-shadow 圈）、
    //          卡片自身的 outline 与实心 box-shadow 圈、X 按钮。带模糊的投影视为阴影，不计入。
    function ringExtent(cs) {
      var t = 0, b = 0;
      try {
        if (cs.outlineStyle && cs.outlineStyle !== "none") {
          var ow = (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
          if (ow > 0) { t = ow; b = ow; }
        }
        var sh = cs.boxShadow;
        if (sh && sh !== "none") {
          sh.split(/,(?![^(]*\))/).forEach(function (one) {
            if (/inset/.test(one)) return;
            var n = (one.match(/-?[\d.]+px/g) || []).map(parseFloat);
            if (n.length < 2) return;
            var y = n[1], blur = n[2] || 0, spread = n[3] || 0;
            if (blur > 0) return;
            t = Math.max(t, spread - y); b = Math.max(b, spread + y);
          });
        }
      } catch (e) { }
      return { t: t, b: b };
    }
    function measureExtras(card) {
      var T = 0, B = 0;
      try {
        var cs = window.getComputedStyle(card);
        var H = card.offsetHeight;
        var bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
        var padH = H - bt - bb;
        var own = ringExtent(cs);
        T = own.t; B = own.b;
        ["::before", "::after"].forEach(function (pe) {
          var p = window.getComputedStyle(card, pe);
          if (!p || p.content === "none" || p.display === "none") return;
          if (p.position !== "absolute" && p.position !== "fixed") return;
          var h = parseFloat(p.height);
          if (isNaN(h)) return;
          if (p.boxSizing === "content-box") {
            h += (parseFloat(p.paddingTop) || 0) + (parseFloat(p.paddingBottom) || 0)
              + (parseFloat(p.borderTopWidth) || 0) + (parseFloat(p.borderBottomWidth) || 0);
          }
          var top = parseFloat(p.top), bottom = parseFloat(p.bottom), y0;
          if (!isNaN(top)) y0 = bt + top;
          else if (!isNaN(bottom)) y0 = bt + padH - bottom - h;
          else return;
          if (p.transform && p.transform !== "none") {
            try { y0 += new DOMMatrixReadOnly(p.transform).m42; } catch (e) { }
          }
          var ring = ringExtent(p);
          T = Math.max(T, -(y0) + ring.t);
          B = Math.max(B, (y0 + h) - H + ring.b);
        });
        T = Math.max(T, 16); // 固定预留：X 按钮固定在卡片上方外侧 16px 处
      } catch (e) { }
      return { t: Math.max(0, T), b: Math.max(0, B) };
    }

    function openCard(opt) {
      var ov = document.createElement("div");
      ov.className = "opl-overlay";
      var card = document.createElement("div");
      card.className = "opl-card";
      card.style.animation = "none";
      ov.appendChild(card);

      var xBtn = document.createElement("button");
      xBtn.type = "button";
      xBtn.className = "opl-x";
      xBtn.setAttribute("aria-label", "关闭");
      xBtn.textContent = "×";
      ov.appendChild(xBtn);
      function placeX() {
        var r = card.getBoundingClientRect();
        xBtn.style.top = (r.top - 16) + "px";
        xBtn.style.left = (r.right - 4) + "px";
      }

      // 强制限高：内联 + !important，任何自定义 CSS 都覆盖不了
      imp(card, {
        "display": "flex", "flex-direction": "column",
        "overflow": "visible", "flex": "0 0 auto", "align-self": "center"
      });

      var body = document.createElement("div");
      body.className = "opl-body";
      imp(body, { "flex": "0 0 auto", "min-height": "0", "overflow": "visible" });
      card.appendChild(body);

      var closed = false, layout = null, onResize = null, ro = null;
      function close() {
        if (closed) return; closed = true;
        if (onResize) window.removeEventListener("resize", onResize);
        if (ro) { try { ro.disconnect(); } catch (e) { } }
        ov.style.animation = "oplFade .18s ease reverse both";
        setTimeout(function () { try { ov.remove(); } catch (e) { } }, 160);
      }
      ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
      card.addEventListener("click", function (e) { e.stopPropagation(); });
      xBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (opt.onClose) opt.onClose(close); else close();
      });

      function add(cls, txt) {
        var d = document.createElement("div"); d.className = cls;
        if (txt != null) d.textContent = txt;
        body.appendChild(d); return d;
      }
      if (opt.eyebrow) add("opl-eyebrow", opt.eyebrow);
      if (opt.title) add("opl-title", opt.title);
      if (opt.desc) add("opl-desc", opt.desc);

      var sceneEl = null, replyEl = null, selectedLabel = "";
      if (opt.scene !== undefined) {
        add("opl-label", "🫧 情境");
        sceneEl = makeBox("此刻的环境、氛围、位置…", opt.scene);
        body.appendChild(sceneEl);
      }
      if (opt.options) {
        add("opl-label", "💬 你的回应");
        var chips = add("opl-chips");
        opt.options.forEach(function (o) {
          var c = document.createElement("span");
          c.className = "opl-chip";
          c.textContent = o.label;
          c.addEventListener("click", function () {
            var all = chips.querySelectorAll(".opl-chip");
            for (var k = 0; k < all.length; k++) all[k].setAttribute("data-sel", "0");
            c.setAttribute("data-sel", "1");
            selectedLabel = o.label;
            if (replyEl) { replyEl.value = o.text; if (layout) layout(replyEl); }
          });
          chips.appendChild(c);
        });
        replyEl = makeBox("选一个，或在此自由改写…", "");
        body.appendChild(replyEl);
      }

      var act = add("opl-actions");
      var sec = document.createElement("button");
      sec.type = "button"; sec.className = "opl-btn ghost"; sec.textContent = opt.secondary || "取消";
      sec.addEventListener("click", function () {
        if (opt.onSecondary) opt.onSecondary(close); else close();
      });
      var pri = document.createElement("button");
      pri.type = "button"; pri.className = "opl-btn primary"; pri.textContent = opt.primary || "应答";
      pri.addEventListener("click", function () {
        if (opt.onConfirm) {
          if (opt.onConfirm(close, sceneEl ? sceneEl.value : "", replyEl ? replyEl.value : "", selectedLabel) === false) return;
        } else close();
      });
      act.appendChild(sec); act.appendChild(pri);

      document.body.appendChild(ov);
      var boxes = [sceneEl, replyEl].filter(Boolean);
      // 拖拽上限：编辑框最多只能长到"卡片刚好顶格"为止
      function capBoxes() {
        var ex = measureExtras(card);
        var vh = ov.clientHeight || window.innerHeight;
        var slack = Math.max(0, vh - ex.t - ex.b - card.offsetHeight);
        boxes.forEach(function (b) {
          b.style.setProperty("max-height", (b.offsetHeight + slack) + "px", "important");
        });
        placeX();
      }
      // only：只重新按文字展开这一个框；其余框保持现状
      layout = function (only) {
        card.style.marginTop = ""; card.style.marginBottom = "";
        (only && only.nodeType ? [only] : boxes).forEach(fitBox);
        var ex = measureExtras(card);
        var vh = ov.clientHeight || window.innerHeight;
        var avail = vh - ex.t - ex.b;
        var over = card.offsetHeight - avail;
        if (over > 0) { // 内容超出：按比例压缩编辑框，保证整张卡片（含装饰）不超出屏幕
          var sum = 0;
          boxes.forEach(function (b) { sum += b.offsetHeight; });
          boxes.forEach(function (b) {
            var h = b.offsetHeight;
            b.style.height = Math.max(48, h - over * h / sum) + "px";
          });
        }
        capBoxes();
        // 装饰外延算进卡片：整体（卡片 + 装饰）垂直居中
        var diff = ex.t - ex.b;
        if (diff > 0) card.style.marginTop = diff + "px";
        else if (diff < 0) card.style.marginBottom = (-diff) + "px";
        placeX();
      };
      boxes.forEach(function (b) {
        b.addEventListener("input", function () { layout(b); });
      });
      if (window.ResizeObserver) {
        ro = new ResizeObserver(function () { capBoxes(); });
        boxes.forEach(function (b) { ro.observe(b); });
      }
      card.addEventListener("pointerup", capBoxes);
      onResize = function () { layout(); };
      window.addEventListener("resize", onResize);
      layout();
      requestAnimationFrame(function () { layout(); });
      return { close: close };
    }

    // ═════════ 坑位：记录宿主容器 + 挂胶囊 ═════════
    ctx.ui.slot("chat.header", function (el, props) {
      var sid = props && props.sessionId ? props.sessionId : "";
      if (!sid) return;
      var hh = pillHosts[sid] || (pillHosts[sid] = {});
      hh.header = el;
      syncPill(sid);
      if (hasData(sid)) ensureTicker();

      var mo = null, raf = 0, disposed = false;
      function watch() {
        if (mo || disposed || !window.MutationObserver) return;
        var w = wrapperOf(el);
        if (!w) return;
        var lastOff = isOfflineIn(w);
        mo = new MutationObserver(function () {
          if (raf) return;
          raf = requestAnimationFrame(function () {
            raf = 0;
            try {
              var off = isOfflineIn(w);
              if (off === lastOff) return;
              lastOff = off;
              if (hasData(sid)) syncPill(sid);
            } catch (e) { }
          });
        });
        mo.observe(w, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
      }
      watch();
      if (!mo) setTimeout(watch, 400);
      return function () {
        disposed = true;
        if (mo) mo.disconnect();
        var cur = pillHosts[sid];
        if (cur && cur.header === el) delete cur.header;
      };
    });

    // 锚点气泡被删（含重新生成删旧回复）：立刻登记缺失，不等 footer 卸载。
    // 之后由 checkAnchor 做短防抖，缺失持续超过 ANCHOR_DEBOUNCE_MS 就清除邀约。
    ctx.hooks.on("message.deleted", function (p) {
      try {
        var sid = p && p.sessionId, e = sid ? getEvt(sid) : null;
        if (!e || !e.anchorId || p.id !== e.anchorId) return;
        anchorMissAt[sid] = Date.now();
        ensureTicker();
      } catch (err) { }
    });

    ctx.ui.slot("message.footer", function (el, props) {
      try {
        var msg = props && props.message;
        var sid = (props && props.sessionId) || (msg && msg.sessionId) || "";
        if (!msg || msg.role !== "assistant" || !sid) return;
        var feet = footEls[sid] || (footEls[sid] = {});
        feet[msg.id] = { el: el, batch: msg.responseBatchId || "" };
        var g = gate[sid];
        if (g && g.persisted) g.mounted = true;
        if (hasData(sid)) { ensureTicker(); scheduleLand(sid); }
        return function () {
          var cur = footEls[sid];
          if (cur && cur[msg.id] && cur[msg.id].el === el) delete cur[msg.id];
        };
      } catch (e) { }
    });

    // ═════════ 卡片流程 ═════════
    function showCard(host, sid) {
      var e = getEvt(sid) || {};
      var j = e.judge || {};
      var scenePair = wrapPair("sceneWrapBefore", "sceneWrapAfter");
      var replyPair = wrapPair("replyWrapBefore", "replyWrapAfter");
      var st = stateOf(sid);
      var reject = st === "refused";
      var o = e.opts || [];
      var options = [];
      var l1 = reject ? "追问" : "正剧向", l2 = reject ? "退让" : "暧昧向";
      [[o[0], l1], [o[1], l2]].forEach(function (pair) {
        var it = pair[0];
        if (!it || !it.text) return;
        var lb = it.label || "";
        if (reject ? (lb !== "追问" && lb !== "退让") : (lb !== "正剧向" && lb !== "暧昧向")) lb = pair[1];
        options.push({ label: lb, text: applyWrapPair(replyPair, it.text) });
      });

      var eyebrow, title, desc, primary, secondary;
      if (reject) {
        eyebrow = "被婉拒了"; title = "自己过去看看";
        desc = j.reason || "文字闪烁着——\n就这样算了吗？";
        primary = "就这样吧"; secondary = "还是算了";
      } else if (st === "invite") {
        eyebrow = "要过去吗？"; title = "出发去见一面";
        desc = "这或许是一个邀请——\n现在就动身吧？";
        primary = "答应并出发"; secondary = "还是算了";
      } else {
        eyebrow = "有人来了"; title = "抬头看看";
        desc = "光影晃动，空气的温度像是也有所变化\n视线从讯息上离开——";
        primary = "应答"; secondary = "再想想";
      }

      openCard({
        eyebrow: eyebrow, title: title, desc: desc,
        scene: applyWrapPair(scenePair, e.scene || ""),
        options: options,
        primary: primary, secondary: secondary,
        onClose: function (close) {
          askConfirm({
            title: "关闭这张邀约？",
            desc: "等待下一次的再见面",
            okLabel: "彻底关闭",
            cancelLabel: "考虑一会儿",
            onCancel: function () {
              close();
            },
            onOk: function () {
              close();
              clearData(sid);
              removePill(sid);
            }
          });
        },
        onConfirm: function (close, sceneTxt, replyTxt, label) {
          var a = String(sceneTxt || "").trim();
          var b = String(replyTxt || "").trim();
          var payload = [a, b].filter(Boolean).join("\n\n");
          if (!payload) { ctx.ui.toast("至少填一处内容"); return false; }
          if (!b) {
            askConfirm({
              title: "还没写下回应",
              desc: "「你的回应」没有做出动作\n确定直接发送吗？",
              okLabel: "直接发送",
              cancelLabel: "再想想",
              onOk: function () { close(); enterOffline(host, sid, payload, label === "退让"); }
            });
            return false;
          }
          close();
          enterOffline(host, sid, payload, label === "退让");
          return true;
        }
      });
    }

    function enterOffline(host, sid, text, forceReturn) {
      var toggle = host.querySelector('button[aria-label="线下模式"]')
        || host.querySelector(".chat-offline-toggle");
      if (!toggle) { ctx.ui.toast("没找到线下模式按钮，宿主 UI 可能已变更"); return; }
      toggle.click();
      waitFor(function () {
        return !!host.querySelector('button[aria-label="返回线上模式"]')
          && !!host.querySelector("textarea.chat-input-textarea");
      }, 4000).then(function (ok) {
        if (!ok) {
          if (forceReturn) patchEvt(sid, { forceReturn: false });
          ctx.ui.toast("进入线下失败：可能正在生成回复，稍后再试");
          return;
        }
        // 刻意不清数据、不移除胶囊：胶囊要留到你发够 N 条
        var ta = host.querySelector("textarea.chat-input-textarea");
        if (!ta) { ctx.ui.toast("没找到线下输入框"); return; }
        setNativeValue(ta, text);
        return sleep(160).then(function () {
          var act = host.querySelector(".chat-input-actions"), send = null;
          if (act) {
            var ls = act.querySelectorAll("button");
            for (var i = 0; i < ls.length; i++) {
              if (ls[i].getAttribute("aria-label") === "发送") { send = ls[i]; break; }
            }
          }
          if (!send) { ctx.ui.toast("没找到发送按钮，文字已填入输入框"); return; }
          if (send.disabled) { ta.focus(); ctx.ui.toast("已填入输入框，手动点发送"); return; }
          if (forceReturn) patchEvt(sid, { forceReturn: true });
          send.click();
          setTimeout(function () { syncPill(sid); }, 300);
        });
      });
    }

    // ═════════ 卸载 ═════════
    return function () {
      try { stopTicker(); } catch (e) { }
      try { if (settingsOff) settingsOff(); } catch (e) { }
      try { if (cssDisp) cssDisp(); } catch (e) { }
      try { if (structDisp) structDisp(); } catch (e) { }
      try { clearFx(); } catch (e) { }
      try {
        for (var a in armedEls) if (Object.prototype.hasOwnProperty.call(armedEls, a)) setArmed(a, null);
        var ar = document.querySelectorAll(".opl-armed");
        for (var j = 0; j < ar.length; j++) ar[j].classList.remove("opl-armed");
      } catch (e) { }
      try {
        for (var sid in pillEls) if (Object.prototype.hasOwnProperty.call(pillEls, sid)) removePill(sid);
        var ovs = document.querySelectorAll(".opl-overlay,[data-opl-confirm]");
        for (var i = 0; i < ovs.length; i++) ovs[i].remove();
      } catch (e) { }
    };
  }
};