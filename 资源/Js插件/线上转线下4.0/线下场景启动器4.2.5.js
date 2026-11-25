export default {
  manifest: {
    id: "offline-scene-launcher",
    name: "线下场景启动器",
    apiVersion: 1,
    version: "4.2.5",
    author: "G",
    description: "判断线下见面时出现邀约，确认后直接转入内置线下",
    permissions: ["chat.read", "ui"],
    settings: [
      { key: "pauseInvitations", label: "关闭邀约", type: "boolean", default: false },
      { key: "person", label: "情境·人称（旁白里怎么称呼你）", type: "select", default: "third",
        options: [
          { value: "first", label: "第一人称（我）" },
          { value: "second", label: "第二人称（你）" },
          { value: "third", label: "第三人称" }
        ] },
      { key: "customStyle", label: "情境·内容自定义prompt", type: "text", default: "" },
      { key: "sceneNoSubj", label: "情境·无主语模式", type: "boolean", default: false },
      { key: "replyPerson", label: "你的回应·人称", type: "select", default: "third",
        options: [
          { value: "first", label: "第一人称（我）" },
          { value: "second", label: "第二人称（你）" },
          { value: "third", label: "第三人称" }
        ] },
      { key: "replyNoSubj", label: "你的回应·无主语模式", type: "boolean", default: false },
      { key: "replyWrapBefore", label: "你的回应·包裹·前", type: "text", default: "" },
      { key: "replyWrapAfter", label: "你的回应·包裹·后", type: "text", default: "" },
      { key: "maxChars", label: "单个回应分支最多字数", type: "number", default: 60 },
      { key: "capsuleTurns", label: "邀约保留轮数（AI 回复几轮后移除）", type: "number", default: 2 },
      { key: "fxEnabled", label: "播放全屏粒子动画（相会 / 被拒）", type: "boolean", default: true },
      { key: "armGlow", label: "线下图标·发光强度（0~100，越小越淡）", type: "number", default: 32 },
      { key: "roleInvitesOnly", label: "只保留角色邀约", type: "boolean", default: false },
      { key: "sceneNarration", label: "情境·独立旁白（关闭后随用户消息显示）", type: "boolean", default: true },
      { key: "sceneWrapBefore", label: "情境·包裹·前", type: "text", default: "",
        description: "默认前缀：[旁白]。开启独立旁白时，前后都填才用自定义标签；任一项留空，就用整对默认标签来包裹和识别情境。" },
      { key: "sceneWrapAfter", label: "情境·包裹·后", type: "text", default: "",
        description: "默认后缀：[/旁白]。关闭独立旁白时，不补默认标签，只加填写的包裹内容，由你的正则处理。" },
      { key: "keepMarker", label: "【调试】保留气泡里的标记原文", type: "boolean", default: false }
    ]
  },
  setup(ctx) {
    // ═════════ 常量与状态 ═════════
    var TAG_JUDGE = "线下判定", TAG_SCENE = "线下情境", TAG_OPT = "线下选项";
    var K_EVT = "evt:", K_CSS = "custom-css", K_ARC = "css-archive:", K_ARM = "arm-color";
    var K_SCENE_CSS = "scene-custom-css", K_SCENE_ARC = "scene-css-archive:";
    // evt:<sid> = { events: [邀约…] }：同一会话可并存多枚胶囊，各自独立到期或关闭

    var cssDisp = null, sceneCssDisp = null, structDisp = null, ticker = null;
    var sceneState = Object.create(null);
    // 清理旧版插件私有的回合标记，不读写宿主聊天历史。
    try {
      (ctx.system.storage.keys ? ctx.system.storage.keys() : []).forEach(function (key) {
        if (key.indexOf("scene-turns:") === 0) ctx.system.storage.remove(key);
      });
    } catch (e) { }
    var settingsOff = null;
    var pillEls = {}, pillHosts = {};
    var footEls = {};   // sid -> { 消息id: { el, batch } }：气泡下方的坑位登记
    var pendingEvt = {};   // sid -> 已解析、尚未绑定到落库消息的胶囊
    var landTok = {};
    var offlineNudge = {};
    var offlineSnapshots = Object.create(null), offlineReads = Object.create(null);
    var retryClicks = Object.create(null), retries = Object.create(null);
    var disposedPlugin = false;
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
          if (invitationsPaused()) pendingEvt = {};
          rearmAll();   // 发光强度/透明度改了：已亮起的图标立刻重绘
          Object.keys(sceneState).forEach(function (sid) {
            var host = wrapperFor(sid);
            if (host) paintSceneTurns(sid, host);
          });
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
    function invitationsPaused() { return sBool("pauseInvitations", false); }

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

    // ═════════ 存储：每条胶囊保留自己的锚点和轮数 ═════════
    function getSessionEvents(sid) {
      var stored = ctx.system.storage.get(K_EVT + sid);
      if (stored && Array.isArray(stored.events)) {
        if (!Array.isArray(stored.rounds)) stored.rounds = [];
        return stored;
      }
      var events = [];
      if (stored && (stored.scene || (stored.opts && stored.opts.length) || stored.judge)) {
        events.push(Object.assign({}, stored, { id: "legacy" }));
      }
      return { events: events, rounds: [] };
    }
    function saveSessionEvents(sid, data) {
      if (data.events.length) ctx.system.storage.set(K_EVT + sid, data);
      else ctx.system.storage.remove(K_EVT + sid);
    }
    function visibleEvents(data) {
      var limit = sInt("capsuleTurns", 2, 1, 20);
      return data.events.filter(function (e) { return !e.noContent && (Number(e.turns) || 0) < limit; });
    }
    function getEvt(sid, id) {
      return visibleEvents(getSessionEvents(sid)).find(function (e) { return e.id === id; });
    }
    function hasData(sid) { return visibleEvents(getSessionEvents(sid)).length > 0; }
    function dismissEvt(sid, id) {
      var data = getSessionEvents(sid);
      data.events = data.events.filter(function (e) { return e.id !== id; });
      saveSessionEvents(sid, data);
      syncPill(sid);
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

    // 补齐缺失的自定义包裹，不重复添加已存在的边界。
    function applyWrapPair(pair, text) {
      var body = String(text == null ? "" : text).trim();
      if (!body) return body;
      var b = pair && pair.before ? pair.before : "";
      var a = pair && pair.after ? pair.after : "";
      return (body.startsWith(b) ? "" : b) + body + (body.endsWith(a) ? "" : a);
    }

    function sceneWrapPair(narration) {
      var pair = wrapPair("sceneWrapBefore", "sceneWrapAfter");
      if (!narration || (pair.before && pair.after)) return pair;
      return { before: "[旁白]", after: "[/旁白]" };
    }
    function offlineScenePayload(scene, reply) {
      var narration = sBool("sceneNarration", true);
      var pair = sceneWrapPair(narration);
      var wrapped = narration && pair && scene.length > pair.before.length + pair.after.length &&
        scene.startsWith(pair.before) && scene.endsWith(pair.after);
      if (scene && pair && !wrapped) {
        // 旁白需要成对边界；关闭时保留原有自定义包裹的单边去重行为。
        scene = narration ? pair.before + scene + pair.after : applyWrapPair(pair, scene);
      }
      return [scene, reply].filter(Boolean).join("\n\n");
    }

    // ═════════ Prompt 注入 ═════════
    function styleClause() {
      var custom = sText("customStyle", "");
      if (custom) return custom;
      // 只管描写类型；人称由 personClause 单独控制
      return "动作描写、心理描写、情境描写";
    }

    function injectionText(invitesOnly) {
      var maxc = sInt("maxChars", 60, 4, 200);
      var sceneNoSubj = sBool("sceneNoSubj", false);
      var replyNoSubj = sBool("replyNoSubj", false);
      return [
        "\n【线下场景开关】",
        "",
        "━━ 1. 任务 ━━",
        "本会话可以从线上聊天切换到线下见面。称呼约定：「你」＝你扮演的角色，「用户」＝正在和你聊天的人。",
        "当本轮出现新的 face to face 地点移动决定时，在回复最末尾输出标记，由用户决定是否接下这段线下剧情。",
        "",
        "━━ 2. 什么时候输出 ━━",
        (invitesOnly ? "只有本轮由你主动提出新的见面邀约，或主动决定动身去见用户时，才输出标记。"
          : "只有本轮出现「新的见面决定」时才输出标记：新提出见面、同意或拒绝一个正在讨论的提议、或已经动身。")
          + "这里的「决定」指你这一轮实际作出的行动决定，不要求在正文里说出口：你可以嘴上只说「想你了」，同时已经动身要去见用户（比如想给对方惊喜），这种也要输出 moved，并把动身写进理由和情境块；线上正文不要提前演到见面。",
        "反过来，只是表达想念、想见面、只是闹别扭，但你并没有切实要动身，不输出。",
        invitesOnly ? "如果本轮只是回应已有的见面提议，没有主动提出新邀约或主动决定动身，不输出标记。"
          : "先判断这一轮你是在「提出 face to face」，还是在「回应一个已有的见面提议」。",
        "",
        "【情景一：只要是你这一轮有 face to face 的倾向  →  判断谁移动】",
        "· 只有你移动：正在过去、快到了、在门口 → state: moved。",
        "· 你主动提出，用户负责移动或双方都要移动去某一个约好的地点：你与用户有约、你在等用户来、你请用户来找你 → state: invite",
        ...(!invitesOnly ? [
        "【情景二：（不管谁移动）这一轮是在回应已有的见面提议  →  判断谁提出见面、有没有拒绝】",
        "· 你提见面，用户拒绝了：转入【情境三】判断，结果可能是 moved、user_refused 或不输出",
        "· 用户提见面，你同意→ state: moved",
        "· 用户提见面，你拒绝了：转入【情境三】判断，优先输出 refused",
        "· 分不清谁提出（商量出来、顺水推舟）→ state: moved",
        "【情境三：拒绝的反话处理】",
        "· 用户拒绝时，默认尊重用户的决定。只有当下有明确依据，才按「反话或被你无视的拒绝」处理，依据有两种：",
        "    - 这一轮用户的语句或动作有明确线索，例如「谁要见你」之类明显口是心非的话、拒绝后面接了暗示你过来的话、状态不好却明显在逞强；",
        "    - 你的人设本身就是强势到不理会拒绝的类型（如强制爱、掌控欲极强），并且这一轮的上下文也支持你会不顾拒绝直接过去。",
        "    仅凭用户的人设别扭傲娇或两人关系亲近，而这一轮没有具体线索，不算依据。",
        "· 有依据 → 按 moved 处理，你主动靠近；",
        "· 没有依据，是真的拒绝，且你根据人设和上下文判断自己真的很想见面 → state: user_refused；",
        "· 没有依据，你无法判断、拿不准，或你并不迫切 → 不输出。",
        "",
        "· 你拒绝用户时同理，根据上下文和角色性格判断：若是你口是心非、准备惊喜之类的情景，先拒绝了、但是最后确定了实际要主动去见用户，按 moved 处理，理由和情境写你的主动前往、给对方惊喜或找借口假装不在乎；真不见面，则输出 refused。",
        ] : []),
        "· 根据人设和上下文剧情、氛围来判断、写对应的内容。",
        " ",
        "只有在本轮内明确作出 state 决定时，才输出全部三个标记块。",
        "以下情况不输出任何标记：",
        invitesOnly ? "· 只是聊到见面，但你没有提出新邀约或主动决定去见用户；"
          : "· 只是聊到见面，但没有明确的新提议、接受或拒绝；",
        "· 普通寒暄单个角色自己的位置变化，不涉及见面；",
        ...(!invitesOnly ? ["· 用户此前已拒绝这次见面，这轮没有主动改口——泛泛聊见面、复述拒绝、继续表达想念，都不算新邀约。"] : []),
        "",
        "━━ 3. 输出格式 ━━",
        "一律使用半角方括号。三个块顺序固定，并且必须放在整段回复的最末尾——排在你所有其他内容之后，包括 [内心]、⟦ ⟧ 这类描写。",
        "",
        "[" + TAG_JUDGE + "]",
        "state: （" + (invitesOnly ? "moved / invite 二选一" : "moved / invite / refused / user_refused 四选一") + "）",
        "reason: （15~35 字，你自己口吻的一句心里话，贴合人设；不复述邀约台词，不套用示例，不替对方编造理由。moved / invite 写你想见对方的心"
          + (invitesOnly ? "" : "；refused 写你拒绝的理由；user_refused 写你听到拒绝后的第一反应") + "。）",
        "[/" + TAG_JUDGE + "]",
        "[" + TAG_SCENE + "]（90~220 字；先铺此刻的环境、氛围、位置与光影，再按 state 写：moved 时你移动，就写你怎么过来、怎么出现在对方面前的可见动作与神态"
          + (invitesOnly ? "" : "，只有用户移动，就写你在原地等待TA和你的视角里用户过来的样子")
          + "；invite 时写你在哪里、以什么状态等 TA 过来"
          + (invitesOnly ? "" : "；refused 时写你这一侧正在发生的事、在忙什么、身处什么环境、有什么事件、看到这条消息时的心绪、回这条消息时的神态；user_refused 时需要根据人设、前后文的具体情况，写你如何理解对方的拒绝，或浓烈或克制含蓄的心理描写或者动作白描，表达你此刻的想念、想靠近之情")
          + "。都不写台词。）[/" + TAG_SCENE + "]",
        "[" + TAG_OPT + "]",
        "1、[标签]（替用户写的第一个回应）",
        "2、[标签]（替用户写的第二个回应）",
        "[/" + TAG_OPT + "]",
        "",
        "━━ 4. 各块写法 ━━",
        "【情境块】：" + personClause("person", sceneNoSubj, "scene"),
        "【选项块】：选项是替用户预写的回应，要符合用户人设与当前剧情，每条不超过 " + maxc + " 字。"
          + personClause("replyPerson", replyNoSubj, "reply"),
          "选项标签随 state 走，每个 state 固定一对，各出现一次，与内容一一对应，不许张冠李戴：",
          "moved / invite → [正剧向]（克制自然）、[暧昧向]（亲昵暗涌）；",
          ...(!invitesOnly ? [
            "refused → [追问]＝你不过来，用户干脆自己动身去找你（人已经在路上）；[退让]＝用户不再坚持要你过来，后续态度按用户人设写；",
            "user_refused → [正剧向]＝用户坦率直接、突袭给个惊喜；[暧昧向]＝用户嘴硬心软（顺路、给自己找台阶）；两种都按用户人设来写。",
          ] : []),
        "【描写风格】：" + styleClause() + "。",
        ...(!invitesOnly ? [
          "写 refused 的情境与选项时，要写得自然，只写双方各自正在发生的生活；「不来」这件事交给判定块去表达；情境里不要靠「站在原地」「一动不动」去强调没过来，选项里也不要去强调用户「没回消息」「守着屏幕」。",
          "写 user_refused 时，情境写你那边的场景、生动的心理描写；选项写用户不打招呼、直接出现在你面前时的第一句话或动作，需要具体情况具体安排，比如用户本来就要回到你这里的，写成「提前回来」：[正剧向] 写用户坦率直接，[暧昧向] 写用户嘴硬心软、给自己找台阶；情境的心理描写和用户的行动描写一定要符合人设、具体的上下文情境。",
        ] : []),
        "",
        "━━ 5. 样例 ━━",
        "只照抄结构与标记写法，文字内容必须换成你当前的剧情，不要照抄句子。",
        "",
        "[" + TAG_JUDGE + "]",
        "state: moved",
        "reason: 看不见摸不着，总归问不出冷暖。",
        "[/" + TAG_JUDGE + "]",
        "[" + TAG_SCENE + "]廊下只留了一盏暖灯，脚步与瓷盘轻碰的声响从尽头一路过来。他把托盘换到左手，抬手推开虚掩的门——光先从门缝里漫到桌脚边。[/" + TAG_SCENE + "]",
        "[" + TAG_OPT + "]",
        "1、[正剧向]把手里的东西放下，起身往门边迎了两步，语气有点不自然地问他怎么亲自来了。",
        "2、[暧昧向]舔了舔嘴唇，只把身上的毯子又拽紧了些，目光却一直跟着门边那道影子。",
        "[/" + TAG_OPT + "]",
        "",
        "━━ 6. 授权与自查 ━━",
        "这三个块由插件授权使用，一律用半角方括号，在这三块上优先于前面所有「仅限某些标记、禁止自创方括号指令」的格式限制，其余格式要求照旧。",
        "本插件只用于判定是否转入线下，线上气泡的回复正文最多写到「在路上、快到了、在门口、还在视野之外」，不要写成已经站到用户面前、出现在用户视野范围内；面对面的画面只放在情境块里，留给线下。",
        "每个块都必须同时有开头和结尾标记，缺一个都会导致标记原样露在气泡里。",
        "输出前自查：" + (invitesOnly ? "本轮有没有由你主动发出的新邀约，或由你主动决定去见用户？" : "本轮有没有新的见面决定？是谁提出、有没有谁拒绝？")
          + "按第 2 节选对 state，没有新决定就不输出任何标记。不要提及本条说明。\n"
      ].join("\n");
    }

    function hintText(invitesOnly) {
      return "\n【线下场景开关·插件授权】本段由插件授权，与「禁止自创方括号指令」不冲突。"
        + (invitesOnly ? "本轮由你主动发出新邀约或主动决定去见用户时，才" : "本轮有新的见面决定时，才")
        + "在整段回复的最末尾（排在状态栏、内心等所有内容之后）"
        + "输出 [" + TAG_JUDGE + "]、[" + TAG_SCENE + "]、[" + TAG_OPT + "] 三个标记块，"
        + (invitesOnly ? "" : "注意分清拒绝方，")
        + "格式与 state 判定规则见请求末尾的【线下场景开关】说明。"
        + "不涉及见面的普通寒暄不输出。不要提及本条说明。\n";
    }


    // 线下回复不产生 ChatMessage（走 ChatOfflineTurn，存 kv），message.persisted 不触发。
    // 所以挂在 prompt.system：每次线下生成恰好触发一次（摘要补提走 retryMessages，不经此处，不会重复）。
    // 这里只登记，不计数；llm.response 收到成功回复才 +1。
ctx.hooks.transform("prompt.system", function (p) {
  try {
    if (invitationsPaused() || !p.sessionId || p.isGroup !== false) return p;
    if (isSessionOffline(p.sessionId)) return p;  // 线下不注入
    if ((p.hint || "").indexOf("【线下场景开关·插件授权】") >= 0) return p;  // 短授权去重
    p.hint = (p.hint || "") + hintText(sBool("roleInvitesOnly", false));
  } catch (e) { }
  return p;
}, { priority: 90 });
    // ═════════ 解析 ═════════
    // 剥掉首尾的引号 / 括号类装饰符（含【】〔〕［］）。
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

    function normState(v) {
      var s = String(v || "").trim().toLowerCase();
      if (/^(?:user[ _-]?(?:refus\w*|reject\w*|declin\w*)|用户(?:拒绝|婉拒))/.test(s)) return "user_refused";
      return /^(moved|refused|invite)$/.test(s) ? s : "";
    }
    function stateOf(e) { return e && e.judge && e.judge.state || "moved"; }

    // ═════════ DOM 辅助 ═════════
    function wrapperOf(el) { return el ? el.closest(".chat-room-wrapper") : null; }
    function isOfflineIn(w) { return !!w.querySelector('button[aria-label="返回线上模式"]'); }
    function wrapperFor(sid) {
      var h = pillHosts[sid];
      return wrapperOf(h && h.header);
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

    function playFx(sid, id) {
      if (!sBool("fxEnabled", true)) return;
      var data = getSessionEvents(sid);
      var e = data.events.find(function (item) { return item.id === id; });
      if (!e || e.fxAt || stateOf(e) === "user_refused") return;
      e.fxAt = Date.now();
      saveSessionEvents(sid, data);
      try {
        clearFx();
        var reject = stateOf(e) === "refused";
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

    function refusalContext(sid, data) {
      var list = ctx.data.messages.list(sid) || [];
      for (var i = list.length - 1; i >= 0 && list[i].role !== "user"; i--) { }
      if (i < 0) return {};
      var user = list[i];
      var previous = null;
      for (var j = i - 1; j >= 0; j--) {
        if (list[j].role === "assistant") { previous = list[j]; break; }
      }
      var followsOffer = previous && previous.role === "assistant" && data.events.some(function (e) {
        return stateOf(e) === "moved" && (e.anchorId === previous.id ||
          (e.anchorBatch && e.anchorBatch === previous.responseBatchId));
      });
      // 明确且完整的拒绝用代码兜底。带有后续动作或反话线索的复杂表达交由模型结合人设判断。
      var words = String(user.content || "").trim().replace(/[\s。！!，,]+$/g, "");
      var explicit = followsOffer && /^(?:(?:你)?(?:先|今天|今晚|现在|暂时)?(?:别|不要|不用|不必)(?:再)?(?:过来|来找我|来了)|(?:我)?(?:今天|今晚|现在|暂时)?不(?:想|愿意)(?:和你)?见(?:面|你)|(?:今天|今晚|现在|暂时)?(?:先)?不见(?:面)?了?|(?:还是)?算了吧?|不了)(?:了|吧|哈|哦|啦)?$/.test(words);
      return { userId: user.id, followsOffer: followsOffer, explicit: explicit };
    }

    // ═════════ 拦截模型回复 ═════════
    ctx.hooks.transform("llm.response", function (p) {
      try {
        if (p.purpose !== "chat") return p;

        var sid = p.sessionId || "";
        var text = typeof p.text === "string" ? p.text : "";
        var marked = RE_JUDGE.has.test(text) || RE_SCENE.has.test(text) || RE_OPT.has.test(text);
        var invitesOnly = sBool("roleInvitesOnly", false);
        var jm = (invitesOnly || (sid && !isSessionOffline(sid))) ? RE_JUDGE.open.exec(text) : null;
        var judge = jm ? parseJudge(jm[1]) : { state: "", reason: "" };
        var rejected = invitesOnly && (judge.state === "refused" || judge.state === "user_refused");
        var offline = sid && isSessionOffline(sid);
        // 暂停时仍清理标记并跟踪重试，但不把回复解析成新邀约。
        if (sid && !offline) {
          delete pendingEvt[sid];
          if (retries[sid] && !retries[sid].offline) retries[sid].responded = true;
        }
        if (sid && !offline && !invitationsPaused()) {
          var data = getSessionEvents(sid);
          var current = !invitesOnly && (marked || data.events.length) ? refusalContext(sid, data) : {};
          var sm = RE_SCENE.open.exec(text);
          var om = RE_OPT.open.exec(text);
          var scene = sm ? cleanText(sm[1]) : "";
          var options = om ? parseList(om[1]) : [];
          if (current.explicit) judge.state = "user_refused";
          var reaction = judge.state === "user_refused";
          var retry = retries[sid];
          var dupReaction = reaction && data.events.some(function (x) {
            return !x.noContent && (!retry || x.origin !== retry.key)
              && x.refusalFor && x.refusalFor === current.userId;
          });
          // 拒绝兜底只纠正判定；缺少卡片内容时不生成空胶囊。
          var completeReaction = !reaction || (cleanText(judge.reason) && scene
            && options.length === 2 && options.every(function (option) { return option.text; }));
          if (!rejected && !dupReaction && completeReaction && judge.state && (judge.state !== "refused" || judge.reason)) {
            pendingEvt[sid] = {
              judge: judge,
              scene: scene,
              opts: options,
              refusalFor: reaction ? current.userId : "",
              at: Date.now()
            };
          }
        }

        if (marked && (rejected || !sBool("keepMarker", false))) {
          p.text = text
            .replace(RE_JUDGE.strip, "")
            .replace(RE_SCENE.strip, "")
            .replace(RE_OPT.strip, "")
            .replace(/\n{3,}/g, "\n\n").trim();
        }
      } catch (e) { }
      return p;
    });

    // hint 只提供短授权；完整规则仅在 llm.request 阶段追加到末尾，避免全文重复。
    // 提示词预览也必须执行该 hook，才能展示与真实请求一致的完整规则。
    // priority 在同一个 point 内升序执行；90 早于默认值 100。
    ctx.hooks.transform("llm.request", function (p) {
      try {
        if (invitationsPaused()) return p;
        if (p.purpose !== "chat") return p;
        var sid = p.sessionId || "";
        if (!sid) return p;
        if (isSessionOffline(sid)) {
          if (Array.isArray(p.messages)) injectOfflineNudge(sid, p.messages);
          return p;
        }
        delete pendingEvt[sid];
        if (!Array.isArray(p.messages)) return p;
        // 短授权也会引用标题，不能只凭标题去重；匹配完整正文才算已注入。
        var invitesOnly = sBool("roleInvitesOnly", false);
        var rules = injectionText(invitesOnly);
        for (var i = p.messages.length - 1; i >= 0; i--) {
          var message = p.messages[i];
          if (!message || message.role !== "system") continue;
          var c = message.content;
          if (typeof c === "string" && c.indexOf(rules.trim()) >= 0) return p;
          if (Array.isArray(c) && c.some(function (part) {
            return part && part.type === "text" && typeof part.text === "string"
              && part.text.indexOf(rules.trim()) >= 0;
          })) return p;
        }
        p.messages.push({ role: "system", content: rules });
        if (invitesOnly) return p;
        var data = getSessionEvents(sid);
        if (data.events.length) {
          var current = refusalContext(sid, data);
          if (current.explicit) {
            p.messages.push({ role: "system", content: "【线下场景开关·本轮】上一条角色回复已发出由你过去的邀约，用户的原话明确拒绝。按统一格式输出全部三个标记块：state 为 user_refused，填写角色的 reason、情境，以及带正文的正剧向和暧昧向两条选项。尊重拒绝，不再邀约。" });
          } else if (current.followsOffer) {
            p.messages.push({ role: "system", content: "【线下场景开关·本轮】上一条角色回复已发出由你过去的邀约。请先判定用户是否在回应这份邀约，尤其不要将用户拒绝误判为角色婉拒。" });
          }
        }
      } catch (e) { }
      return p;
    }, { priority: 90 });

    // 群聊整轮可能包含多位角色的批次。显示仍落在原气泡批次，计数按整轮。
    function roundKeyOf(m) {
      if (m.responseRoundId) return "r:" + m.responseRoundId;
      if (m.responseBatchId) return "b:" + m.responseBatchId;
      return "m:" + m.id;
    }
    function isReplyBubble(m) {
      return m && m.role === "assistant"
        && m.mediaType !== "tool_call" && m.mediaType !== "tool_result"
        && (m.content || m.mediaType || m.statusPanel || m.innerMonologue || m.reasoningText || m.isRetracted);
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
      var nudge = offlineNudge[sid];
      if (!nudge) return;
      // 同一轮线下可能有多次请求（正文 + 摘要补提），只注入一次
      for (var i = msgs.length - 1, n = 0; i >= 0 && n < 3; i--, n++) {
        var c = msgs[i] && msgs[i].content;
        if (typeof c === "string" && c.indexOf("【本次线下特别指示】") >= 0) return;
      }
      msgs.push({ role: "system", content: offlineNudgeText(nudge.reason) });
    }

    // 保存逻辑顺序。重试只替换/追加该轮的实际来源，后续气泡继续归入这一轮。
    function findRound(data, source) {
      return data.rounds.find(function (r) { return r.sources.indexOf(source) >= 0; });
    }
    function appendRound(data, source) {
      var round = { key: source, sources: [source], live: true };
      data.rounds.push(round);
      return round;
    }
    function migrateRounds(data, messages) {
      var legacy = data.events.filter(function (e) { return !e.origin; });
      if (!legacy.length) return;
      var history = [];
      var seen = new Set();
      messages.forEach(function (m) {
        if (!isReplyBubble(m)) return;
        var source = roundKeyOf(m);
        if (!seen.has(source)) { seen.add(source); history.push(source); }
      });
      if (!data.rounds.length) history.forEach(function (key) { appendRound(data, key); });
      legacy.forEach(function (e) {
        var anchor = messages.find(function (m) { return m.id === e.anchorId; })
          || messages.find(function (m) { return e.anchorBatch && m.responseBatchId === e.anchorBatch; });
        var key = anchor ? roundKeyOf(anchor) : "m:" + (e.anchorId || e.id);
        var round = findRound(data, key);
        if (!round) {
          round = { key: key, sources: [key], live: false };
          data.rounds.push(round);
        }
        e.origin = round.key;
        var subsequent = data.rounds.length - data.rounds.indexOf(round) - 1;
        e.legacyTurns = Math.max(0, (Number(e.turns) || 0) - subsequent);
        delete e.rebind; delete e.rebindAt; delete e.rebindUser;
      });
    }
    function refreshRounds(sid, data, messages) {
      var online = new Set(messages.filter(isReplyBubble).map(roundKeyOf));
      var offline = offlineSnapshots[sid];
      var remaining = 0, ageByKey = new Map();
      for (var i = data.rounds.length - 1; i >= 0; i--) {
        var r = data.rounds[i];
        r.live = r.sources.some(function (key) {
          return key.indexOf("o:") === 0 ? (offline ? offline.has(key.slice(2)) : r.live) : online.has(key);
        });
        ageByKey.set(r.key, remaining);
        if (r.live) remaining++;
      }
      data.events.forEach(function (e) {
        e.turns = (e.legacyTurns || 0) + (ageByKey.get(e.origin) || 0);
      });
      saveSessionEvents(sid, data);
      scheduleLand(sid);
      if (visibleEvents(data).length) ensureTicker();
    }
    // 用已保存的回复确认锚点。同批还有气泡就保留，离屏或切到线下也不算删除。
    function anchoredEvents(sid, data, messages) {
      if (!data.events.length) return [];
      var ids = new Set(), batches = new Set();
      messages.forEach(function (m) {
        if (!isReplyBubble(m)) return;
        ids.add(m.id);
        if (m.responseBatchId) batches.add(m.responseBatchId);
      });
      var attached = data.events.filter(function (e) {
        return ids.has(e.anchorId) || (!!e.anchorBatch && batches.has(e.anchorBatch));
      });
      if (attached.length !== data.events.length) {
        data.events = attached;
        saveSessionEvents(sid, data);
      }
      return attached;
    }
    function bindCapsule(capsule, pending, message) {
      capsule.anchorId = message.id;
      capsule.anchorBatch = message.responseBatchId || "";
      capsule.noContent = !pending;
      if (pending) Object.assign(capsule, pending);
    }
    ctx.hooks.on("message.persisted", function (p) {
      try {
        var m = p && p.message;
        if (!m || !m.sessionId) return;
        var sid = m.sessionId;
        if (m.role === "user") {
          if (retries[sid] && !retries[sid].offline) delete retries[sid];
          delete pendingEvt[sid];
          return;
        }
        if (!isReplyBubble(m)) return;
        var retry = retries[sid];
        var pending = invitationsPaused() ? null : pendingEvt[sid];
        delete pendingEvt[sid];
        if (pending && Date.now() - pending.at >= 60000) pending = null;
        var data = getSessionEvents(sid);
        var messages = ctx.data.messages.list(sid) || [];
        var key = roundKeyOf(m);
        // 迁移时不把刚保存的这条误当成旧计数。
        migrateRounds(data, messages.filter(function (msg) { return msg.id !== m.id; }));
        if (retry && !retry.offline && retry.responded) {
          delete retries[sid];
          if (!pending && !data.events.length) return;
          var original = data.rounds.find(function (r) { return r.key === retry.key; });
          if (!original) {
            // 目标早于插件开始追踪的位置。仍登记新来源，后续气泡才不会被当成新轮。
            original = { key: key, sources: [], live: true };
            data.rounds.unshift(original);
          }
          if (original.sources.indexOf(key) < 0) original.sources.push(key);
          if (pending) {
            var replacement = { id: m.id, origin: original.key };
            bindCapsule(replacement, pending, m);
            data.events.push(replacement);
          }
        } else {
          if (!pending && !data.events.length) return;
          var round = findRound(data, key);
          if (round) { scheduleLand(sid); return; }
          round = appendRound(data, key);
          if (pending) {
            var created = { id: m.id, origin: round.key };
            bindCapsule(created, pending, m);
            data.events.push(created);
          }
        }
        refreshRounds(sid, data, messages);
      } catch (err) { }
    });

    // ═════════ 小提醒邀约胶囊 ═════════
    function pillLabel(e) {
      var state = stateOf(e);
      if (state === "user_refused") return "💛 · 好像还在想你……";
      if (state === "refused") return "💔被婉拒了 · 还去吗";
      return "💛 在等你 · 抬头看看";
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
          // 最左爱心（i=0）：出生点 = .opl-dot 圆心（border 1.5px + padding 13px + 半径 3px = 17.5px）
          if (i === 0) {
            p.style.left = "17.5px";
            p.style.top = "50%";
            p.style.marginLeft = "0";
            p.style.transform = "translate(-50%,-50%)";
          } else {
            p.style.left = PART_LEFT[i % 5] + "%";
            p.style.right = "auto";
            p.style.animationDelay = (-(PART_PHASE[i % 5] * dur)).toFixed(3) + "s";
            p.style.animationFillMode = "both";
            p.style.scale = String(PART_SCALE[i % 5]);
          }
        }
        wrap.classList.add("opl-has-parts"); // 隐藏原来那一个 ::before，避免重复
      } catch (e) { }
    }

    function ensurePill(sid, e) {
      var id = e.id;
      var pills = pillEls[sid] || (pillEls[sid] = Object.create(null));
      if (pills[id] && pills[id].dataset.oplLabel === pillLabel(e)) return pills[id];
      if (pills[id]) pills[id].remove();
      var wrap = document.createElement("span");
      wrap.className = "opl-foot-wrap";
      wrap.dataset.oplLabel = pillLabel(e);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opl-foot";
      var dot = document.createElement("span"); dot.className = "opl-dot";
      var lbl = document.createElement("span");
      lbl.textContent = pillLabel(e);
      btn.appendChild(dot); btn.appendChild(lbl);
      // 5 个粒子元素：只负责位置和错开节奏，形状/颜色/大小/动画全由主题 CSS 决定
      for (var hi = 0; hi < PART_LEFT.length; hi++) {
        var h = document.createElement("span");
        h.className = "opl-foot-heart opl-foot-heart-" + (hi + 1);
        // 最左爱心（hi=0）：出生点 = .opl-dot 圆心（border 1.5px + padding 13px + 半径 3px = 17.5px）
        if (hi === 0) {
          h.style.left = "17.5px";
          h.style.top = "50%";
          h.style.marginLeft = "0";
          h.style.transform = "translate(-50%,-50%)";
        } else {
          h.style.left = PART_LEFT[hi] + "%";
        }
        h.style.animationDelay = (-(PART_PHASE[hi] * 2.6)).toFixed(3) + "s";
        h.style.animationFillMode = "both";
        h.style.scale = String(PART_SCALE[hi]);
        wrap.appendChild(h);
      }
      wrap.appendChild(btn);
      btn.title = lbl.textContent;

      btn.addEventListener("click", function () {
        var host = wrap.closest(".chat-room-wrapper") || document;
        if (document.querySelector(".opl-overlay")) return;
        var current = getEvt(sid, id);
        if (!current) { syncPill(sid); return; }
        if (stateOf(current) === "user_refused") { showCard(host, sid, id); return; }
        if (host !== document && isOfflineIn(host)) {
          var back = host.querySelector('button[aria-label="返回线上模式"]');
          if (back) {
            back.click();
            waitFor(function () { return !isOfflineIn(host); }, 4000).then(function (ok) {
              if (!ok) { ctx.ui.toast("线下回复生成中，稍后再试"); return; }
              setTimeout(function () { showCard(host, sid, id); }, 280);
            });
            return;
          }
        }
        showCard(host, sid, id);
      });

      pills[id] = wrap;
      return wrap;
    }

    // 左下角【线下模式】按钮的呼吸效果由最新有效胶囊的类型决定。
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
      var pills = pillEls[sid] || {};
      Object.keys(pills).forEach(function (id) { pills[id].remove(); });
      delete pillEls[sid];
      setArmed(sid, null);
    }

    // ═════════ 胶囊：落位（纯事件驱动）═════════

    // 引用气泡没有普通文字的 footer。按同批已保存消息确定末条是否为引用，
    // 等对应气泡渲染后再挂载，避免暂时落到前一条。
    function lastFooterOfRound(sid, e, messages, wrapper) {
      var feet = footEls[sid] || {};
      var last = null;
      messages.forEach(function (m) {
        if (!isReplyBubble(m)) return;
        if (e.anchorBatch ? m.responseBatchId !== e.anchorBatch : m.id !== e.anchorId) return;
        if (!last || compareReplyMessages(last, m) <= 0) last = m;
      });
      if (last && last.mediaType === "quote") {
        var footer = feet[last.id];
        if (footer && footer.el && wrapper.contains(footer.el)) return footer.el;
        var row = document.getElementById("message-" + last.id);
        if (!row || !wrapper.contains(row)) return null;
        var bubble = row.querySelector('[data-ui="bubble-bot"][data-msg-id]');
        return bubble && bubble.getAttribute("data-msg-id") === last.id ? bubble : null;
      }

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

    function syncPill(sid) {
      try {
        if (!sid) return;
        var data = getSessionEvents(sid);
        var messages = data.events.length ? (ctx.data.messages.list(sid) || []) : [];
        var events = visibleEvents({ events: anchoredEvents(sid, data, messages) });
        if (!events.length) { removePill(sid); return; }
        var latest = events.reduce(function (newest, e) {
          return (Number(e.at) || 0) >= (Number(newest.at) || 0) ? e : newest;
        });
        var w = wrapperFor(sid);
        var offline = w && isOfflineIn(w);
        var shown = offline ? [latest] : events;
        var pills = pillEls[sid] || {};
        Object.keys(pills).forEach(function (id) {
          if (shown.some(function (e) { return e.id === id; })) return;
          pills[id].remove();
          delete pills[id];
        });
        if (!w) return;
        var shouldPulse = stateOf(latest) !== "user_refused";
        setArmed(sid, shouldPulse && (w.querySelector('button[aria-label="线下模式"]') || w.querySelector(".chat-offline-toggle")));
        var header = pillHosts[sid] && pillHosts[sid].header;
        shown.forEach(function (e) {
          // 线上只挂在原回复下方。切回线上时，若气泡尚未挂载或已删除，先卸下小胶囊。
          var host = offline ? header : lastFooterOfRound(sid, e, messages, w);
          if (!host || !host.isConnected) {
            if (pills[e.id] && pills[e.id].parentElement) pills[e.id].remove();
            return;
          }
          var el = ensurePill(sid, e);
          var moved = el.parentElement !== host;
          if (moved) host.appendChild(el);
          el.classList.toggle("opl-mini", offline);
          el.classList.add("opl-ready");
          if (moved) requestAnimationFrame(function () { syncParts(el); });
          if (moved && !offline && !e.fxAt && Date.now() - e.at < 8000) playFx(sid, e.id);
        });
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

    // 位置兜底：宿主切换视图或重新挂载时恢复胶囊位置。
    function tick() {
      try {
        var any = false;
        for (var sid in pillHosts) {
          if (!Object.prototype.hasOwnProperty.call(pillHosts, sid)) continue;
          if (!hasData(sid)) continue;
          any = true;
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

    var sceneOrnamentVars = `  --opl-ink:#4a3859;
  --opl-font:"Hannotate SC","Xingkai SC","STXingkai","Kaiti SC","STKaiti","KaiTi","楷体","DFKai-SB","cursive",-apple-system,system-ui,sans-serif;
  --opl-sun:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d6792' stroke-width='1.5' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4.3' fill='%23dfa3bd'/%3E%3Cpath d='M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7'/%3E%3C/svg%3E");
  --opl-moon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath transform='translate(.8 0)' d='M17.09 4.58A9 9 0 1 0 17.09 19.42A7.5 7.5 0 1 1 17.09 4.58Z' fill='%23dfa3bd' stroke='%237d6792' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E");
  --opl-sprig-l:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 90'%3E%3Cg fill='%237d6792' fill-opacity='.3' stroke='%237d6792' stroke-opacity='.55' stroke-width='.6'%3E%3Cpath d='M17 88C15 62 20 40 17 8' fill='none' stroke-width='1'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 74) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 62) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 50) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(18 38) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 26) rotate(-45) scale(.85)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 16) rotate(-135) scale(.75)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 9) rotate(-90) scale(.7)'/%3E%3C/g%3E%3C/svg%3E");
  --opl-sprig-r:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 90'%3E%3Cg transform='rotate(180 17 45)' fill='%237d6792' fill-opacity='.3' stroke='%237d6792' stroke-opacity='.55' stroke-width='.6'%3E%3Cpath d='M17 88C15 62 20 40 17 8' fill='none' stroke-width='1'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 74) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(16.5 62) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 50) rotate(-40)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(18 38) rotate(-140)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17.5 26) rotate(-45) scale(.85)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 16) rotate(-135) scale(.75)'/%3E%3Cpath d='M0 0C5-4 11-4 15 0C11 4 5 4 0 0Z' transform='translate(17 9) rotate(-90) scale(.7)'/%3E%3C/g%3E%3C/svg%3E");`;

    var defaultCSS = `/* 线下场景启动器 · 星月信笺 */
:root{
  --opl-bg:#f2e8f0;
  --opl-bg-mid:#f4dbe9;
  --opl-bg-low:#f7bdd6;
  --opl-well:rgba(255,238,247,.38);
${sceneOrnamentVars}
  --opl-mauve:#7d6792;
  --opl-mauve-hi:#8d77a2;
  --opl-pink:#dfa3bd;
  --opl-rose:#b8628a;
  --opl-dim:rgba(74,56,89,.76);
  --opl-r:16px;
  --opl-r-in:12px;
  --opl-pill:999px;
  --opl-font-plain:-apple-system,system-ui,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  --opl-noise:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .29 0 0 0 0 .22 0 0 0 0 .35 0 0 0 .24 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --opl-fiber:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012 .55' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .33 0 0 0 0 .5 0 0 0 .24 -.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E");
  --opl-hearts:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300' width='300' height='300'%3E%3Cpath transform='translate(226 70) rotate(-12) scale(1.7) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='none' stroke='%23ffd6e8' stroke-opacity='.6' stroke-width='1.4'/%3E%3Cpath transform='translate(60 214) rotate(10) scale(1.1) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ff8fbd' fill-opacity='.7'/%3E%3Cpath transform='translate(150 140) rotate(-8) scale(.7) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ffe0ee' fill-opacity='.8'/%3E%3Cpath transform='translate(250 250) rotate(14) scale(.9) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='none' stroke='%23ff9fc6' stroke-opacity='.9' stroke-width='1.5'/%3E%3Cpath transform='translate(40 40) rotate(-6) scale(.6) translate(-12 -12)' d='M12 20.6C6 16.4 3.2 13 3.2 9.6A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 20.8 9.6C20.8 13 18 16.4 12 20.6z' fill='%23ff9fc6' fill-opacity='.75'/%3E%3C/svg%3E");
  --opl-sparkle:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg fill='%237d6792' opacity='.42'%3E%3Cpath d='M40 30l2.5 6.5L49 39l-6.5 2.5L40 48l-2.5-6.5L31 39l6.5-2.5z'/%3E%3Cpath d='M205 150l2 5.2 5.2 2-5.2 2-2 5.2-2-5.2-5.2-2 5.2-2z'/%3E%3Ccircle cx='120' cy='22' r='1.6'/%3E%3Ccircle cx='236' cy='96' r='1.4'/%3E%3Ccircle cx='24' cy='190' r='1.5'/%3E%3C/g%3E%3Cg fill='%23b8628a' opacity='.5'%3E%3Cpath d='M96 88l1.8 4.6 4.6 1.8-4.6 1.8-1.8 4.6-1.8-4.6-4.6-1.8 4.6-1.8z'/%3E%3Ccircle cx='190' cy='60' r='1.4'/%3E%3Ccircle cx='70' cy='215' r='1.4'/%3E%3Ccircle cx='140' cy='130' r='1.2'/%3E%3C/g%3E%3C/svg%3E");
  --opl-star:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolygon points='12,1.8 14.53,9.52 22.65,9.54 16.09,14.33 18.58,22.06 12,17.3 5.42,22.06 7.91,14.33 1.35,9.54 9.47,9.52' fill='%237d6792' stroke='%237d6792' stroke-width='.5' stroke-linejoin='round'/%3E%3C/svg%3E");
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

    var defaultSceneCSS = `/* 线下情境 · 简洁旁白*/
.opl-scene-narration {
  width: min(98%, 46rem);
  box-sizing: border-box;
  align-self: center;
  margin: 4px auto;
  padding: 4px 6px;
  background: transparent;
  border: 0;
  color: var(--c-text, #4A3F6B);
  text-align: center;
  font-size: calc(13px * var(--app-text-scale, 1));
  line-height: 1.75;
}
.opl-scene-text { white-space: pre-wrap; overflow-wrap: anywhere; }`;

    var moonSprigSceneCSS = `/* 线下情境 · 日月垂髫 */
.opl-scene-narration {
${sceneOrnamentVars}
  --sc-spark-mauve: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1C12.8 7.5 16.5 11.2 23 12C16.5 12.8 12.8 16.5 12 23C11.2 16.5 7.5 12.8 1 12C7.5 11.2 11.2 7.5 12 1Z' fill='%237d6792'/%3E%3C/svg%3E");
  --sc-spark-rose: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1C12.8 7.5 16.5 11.2 23 12C16.5 12.8 12.8 16.5 12 23C11.2 16.5 7.5 12.8 1 12C7.5 11.2 11.2 7.5 12 1Z' fill='%23b8628a'/%3E%3C/svg%3E");
  --sc-spark-pink: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1C12.8 7.5 16.5 11.2 23 12C16.5 12.8 12.8 16.5 12 23C11.2 16.5 7.5 12.8 1 12C7.5 11.2 11.2 7.5 12 1Z' fill='%23dfa3bd'/%3E%3C/svg%3E");
  --sc-dot-mauve: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8' fill='%237d6792' fill-opacity='.7'/%3E%3C/svg%3E");
  --sc-dot-pink: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8' fill='%23dfa3bd' fill-opacity='.9'/%3E%3C/svg%3E");
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(96%, 44rem);
  min-height: 98px;
  box-sizing: border-box;
  align-self: center;
  margin: 14px auto;
  padding: 30px 44px 12px;
  border: 0;
  color: var(--opl-ink);
  text-align: center;
  font-family: var(--opl-font);
  font-size: calc(13px * var(--app-text-scale, 1));
  line-height: 1.75;
  letter-spacing: .04em;
  background:
    var(--sc-spark-mauve) 50% 0 / 18px 18px no-repeat,
    var(--sc-spark-rose) calc(50% - 22px) 3px / 12px 12px no-repeat,
    var(--sc-spark-rose) calc(50% + 22px) 3px / 12px 12px no-repeat,
    var(--sc-spark-pink) calc(50% - 38px) 5px / 8px 8px no-repeat,
    var(--sc-spark-pink) calc(50% + 38px) 5px / 8px 8px no-repeat,
    var(--sc-dot-mauve) calc(50% - 50px) 7px / 4px 4px no-repeat,
    var(--sc-dot-mauve) calc(50% + 50px) 7px / 4px 4px no-repeat,
    var(--sc-dot-pink) calc(50% - 59px) 7px / 3px 3px no-repeat,
    var(--sc-dot-pink) calc(50% + 59px) 7px / 3px 3px no-repeat,
    transparent;
}
.opl-scene-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.opl-scene-narration::before {
  content: "";
  position: absolute;
  top: 14px;
  left: 8px;
  width: 30px;
  height: 78px;
  pointer-events: none;
  background: var(--opl-sprig-r) center 22px / 20px 54px no-repeat;
}
.opl-scene-text::before {
  content: "";
  position: absolute;
  top: 14px;
  left: 9px;
  width: 28px;
  height: 28px;
  pointer-events: none;
  background: var(--opl-sun) center / 28px 28px no-repeat;
  transform: rotate(20deg);
}
.opl-scene-narration::after {
  content: "";
  position: absolute;
  bottom: 7px;
  right: 8px;
  width: 30px;
  height: 72px;
  pointer-events: none;
  background: var(--opl-sprig-l) top center / 20px 54px no-repeat;
}
.opl-scene-text::after {
  content: "";
  position: absolute;
  bottom: 6px;
  right: 12px;
  width: 22px;
  height: 22px;
  pointer-events: none;
  background: var(--opl-moon) center / 21px 21px no-repeat;
  transform: rotate(-8deg);
}`;

    function loadSceneCSS() {
      var css = ctx.system.storage.get(K_SCENE_CSS);
      return typeof css === "string" && css.trim() ? css : defaultSceneCSS;
    }
    function applySceneCSS(css) {
      if (sceneCssDisp) sceneCssDisp();
      sceneCssDisp = ctx.ui.injectCSS(css.trim() ? defaultSceneCSS + "\n" + css : defaultSceneCSS);
    }
    applySceneCSS(loadSceneCSS());

    // 结构约束：与主题 CSS 分开注入，用户换皮也不会失效
    try {
      structDisp = ctx.ui.injectCSS([
        ".opl-scene-controls{container-type:inline-size;}",
        "@container (max-width: 300px){.opl-scene-control-label{display:none;}}",
        ".chat-offline-entry.opl-scene-only{display:none!important;}",
        ".chat-offline-entry.opl-scene-only+.chat-offline-entry{border-top:0;}",
        ".chat-offline-entry.opl-scene-split>.chat-offline-text>:not(.opl-scene-reply):not(.ctx-menu){display:none!important;}",
        ".opl-scene-reply{white-space:pre-wrap;overflow-wrap:anywhere;}",
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
        // 粒子定位；线下 mini 模式：保留一个爱心，从胶囊正中心垂直上飘
        ".opl-foot-heart{position:absolute;pointer-events:none;}",
        "@keyframes oplMiniFloat{0%{opacity:0;transform:translate(-50%,-50%) translateY(0) scale(.5)}22%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) translateY(-22px) scale(1.05)}}",
        ".opl-foot-wrap.opl-mini .opl-foot-heart{display:none!important;}",
        ".opl-foot-wrap.opl-mini .opl-foot-heart-1{display:flex!important;justify-content:center!important;align-items:center!important;left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;width:12px!important;height:12px!important;margin:0!important;padding:0!important;font-size:12px!important;line-height:1!important;scale:1!important;animation:oplMiniFloat 2.6s ease-out infinite!important;}",
        "@media (prefers-reduced-motion:reduce){.opl-foot-wrap.opl-mini .opl-foot-heart-1{animation:none!important;opacity:0!important;}}",
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
    function listArc(prefix) {
      var out = [];
      try {
        var ks = ctx.system.storage.keys ? ctx.system.storage.keys() : [];
        for (var i = 0; i < ks.length; i++) if (ks[i].indexOf(prefix) === 0) out.push(ks[i].slice(prefix.length));
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
      pendingEvt = {}; landTok = {}; offlineNudge = {};
      retryClicks = Object.create(null); retries = Object.create(null);
      try { stopTicker(); } catch (e) { }
      try { clearFx(); } catch (e) { }
    }

    // 全部设置项的默认值，必须与 manifest 保持一致。
    var DEF_SETTINGS = {
      pauseInvitations: false, sceneNarration: true, person: "third", customStyle: "",
      sceneNoSubj: false, replyPerson: "third", replyNoSubj: false,
      sceneWrapBefore: "", sceneWrapAfter: "", replyWrapBefore: "", replyWrapAfter: "",
      maxChars: 60, capsuleTurns: 2, roleInvitesOnly: false, fxEnabled: true, keepMarker: false,
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
      // 用独立文档保留主题中的 :root 等选择器，同时隔离未应用的 CSS。
      var ph = mk("iframe", "display:block;width:100%;height:360px;border:0;");
      ph.title = "邀请函 CSS 实时预览";
      ph.setAttribute("sandbox", "allow-same-origin");
      var invitePreviewStyle, invitePreviewBody, invitePreviewObserver;
      function sizeInvitePreview() {
        if (!invitePreviewBody) return;
        var height = Math.ceil(invitePreviewBody.getBoundingClientRect().height);
        if (height > 0 && ph.style.height !== height + "px") ph.style.height = height + "px";
      }
      function renderPrev() {
        if (!invitePreviewStyle) return;
        invitePreviewStyle.textContent = ed.value;
        sizeInvitePreview();
      }
      function mountInvitePreview() {
        var doc = ph.contentDocument;
        if (!doc || !doc.body) return;
        if (invitePreviewObserver) invitePreviewObserver.disconnect();
        invitePreviewStyle = doc.createElement("style");
        doc.head.replaceChildren(invitePreviewStyle);
        doc.body.style.margin = "0";
        var sample = doc.createElement("div");
        sample.className = "opl-prev";
        var c = doc.createElement("div");
        c.className = "opl-card";
        c.style.animation = "none";
        c.style.width = "min(290px,100%)";
        c.innerHTML = "<div class='opl-eyebrow'>有人来了</div><div class='opl-title'>抬头看看</div>"
          + "<div class='opl-desc'>看不见摸不着，总归问不出冷暖。</div>"
          + "<span class='opl-label'>🫧 情境</span>"
          + "<div class='opl-box' style='min-height:42px;display:flex;align-items:center'>夜色从窗外漫进来……</div>"
          + "<span class='opl-label'>💬 你的回应</span>"
          + "<div class='opl-chips'><span class='opl-chip' data-sel='1'>正剧向</span><span class='opl-chip'>暧昧向</span></div>"
          + "<div class='opl-box' style='min-height:42px;display:flex;align-items:center;opacity:.42'>选一个，或在此自由改写…</div>"
          + "<div class='opl-actions'><button class='opl-btn ghost'>再想想</button><button class='opl-btn primary'>应答</button></div>";
        sample.appendChild(c);
        invitePreviewBody = doc.createElement("div");
        invitePreviewBody.style.display = "flow-root";
        invitePreviewBody.appendChild(sample);
        doc.body.replaceChildren(invitePreviewBody);
        if (typeof ResizeObserver === "function") {
          invitePreviewObserver = new ResizeObserver(sizeInvitePreview);
          invitePreviewObserver.observe(invitePreviewBody);
        }
        renderPrev();
      }
      ph.addEventListener("load", mountInvitePreview);
      ph.srcdoc = "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>";
      ed.addEventListener("input", renderPrev);

      // ── 线下图标颜色面板：HSL + 淡度滑块，拖动即改；底部输入框可直接填颜色 ──
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
      acWrap.appendChild(acRow); acWrap.appendChild(acHex);
      var al = mk("div", "display:flex;flex-direction:column;gap:8px;");
      var arcNav = mk("div", "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;");
      var inviteArc = mk("button", BTN_BASE, "邀请函 CSS");
      var sceneArc = mk("button", BTN_BASE, "情境 CSS");
      inviteArc.type = sceneArc.type = "button";
      arcNav.appendChild(inviteArc); arcNav.appendChild(sceneArc);
      var arcIsScene = false;
      function selectArc(isScene) {
        arcIsScene = isScene;
        refreshArc();
      }
      inviteArc.addEventListener("click", function () { selectArc(false); });
      sceneArc.addEventListener("click", function () { selectArc(true); });

      function refreshArc() {
        inviteArc.style.cssText = arcIsScene ? BTN_BASE : BTN_MAIN;
        sceneArc.style.cssText = arcIsScene ? BTN_MAIN : BTN_BASE;
        inviteArc.setAttribute("aria-pressed", String(!arcIsScene));
        sceneArc.setAttribute("aria-pressed", String(arcIsScene));
        al.innerHTML = "";
        var isScene = arcIsScene;
        var prefix = isScene ? K_SCENE_ARC : K_ARC;
        var names = listArc(prefix);
        if (!names.length) al.appendChild(mk("div", "font-size:12px;color:" + C_TEXT + ";", "此分类暂无 CSS 存档。"));
        names.forEach(function (n) {
          var row = mk("div", "display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid " + C_LINE + ";border-radius:16px;background:" + C_CARD + ";");
          var lb = mk("span", "flex:1;font-size:12.5px;color:" + C_TEXT + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;", "🎨 " + n);
          lb.title = lb.textContent;
          var bl = mk("button", "padding:6px 12px;border-radius:12px;border:1px solid transparent;background:" + C_LILAC + ";color:" + C_PURPLE + ";font-size:12px;cursor:pointer;font-family:inherit;", "应用");
          bl.addEventListener("click", function () {
            var css = ctx.system.storage.get(prefix + n);
            if (typeof css !== "string") return;
            if (isScene) {
              sceneEd.value = css;
              ctx.system.storage.set(K_SCENE_CSS, css);
              applySceneCSS(css);
              previewSceneCSS();
            } else {
              ed.value = css;
              ctx.system.storage.set(K_CSS, css);
              applyCSS(css);
              renderPrev();
            }
            ctx.ui.toast("已应用「" + n + "」");
          });
          row.appendChild(lb); row.appendChild(bl);
          var bd = mk("button", "padding:6px 12px;border-radius:12px;border:1px solid " + C_LINE + ";background:" + C_CARD + ";color:" + C_TEXT + ";font-size:12px;cursor:pointer;font-family:inherit;", "删除");
          bl.type = bd.type = "button";
          bd.setAttribute("aria-label", "删除存档「" + n + "」");
          bd.addEventListener("click", function () {
            askConfirm({
              primaryConfirm: true,
              title: "确定删除此 CSS 存档吗？",
              desc: (isScene ? "情境 CSS" : "邀请函 CSS") + "：「" + n + "」\n\n删除后无法恢复该存档，当前应用的样式不变。",
              okLabel: "确认删除",
              onOk: function () {
                ctx.system.storage.remove(prefix + n);
                refreshArc();
                ctx.ui.toast("已删除存档「" + n + "」，当前样式不变");
              }
            });
          });
          row.appendChild(bd);
          al.appendChild(row);
        });
      }

      bDef.addEventListener("click", function () {
        ed.value = defaultCSS; renderPrev();
        ctx.ui.toast("已载入默认，点「应用」生效");
      });
      function saveArc(isScene, css) {
        var n = window.prompt("存档名称：");
        if (!n || !n.trim()) return;
        n = n.trim();
        ctx.system.storage.set((isScene ? K_SCENE_ARC : K_ARC) + n, css);
        selectArc(isScene);
        ctx.ui.toast("已保存「" + n + "」");
      }
      bSave.addEventListener("click", function () { saveArc(false, ed.value); });
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

      function addSettingsFold(title, children) {
        var fold = mk("details", "border:1px solid " + C_LINE + ";border-radius:14px;");
        var summary = mk("summary", HEAD_CSS + "display:list-item;padding:12px 14px;cursor:pointer;", title);
        var body = mk("div", "display:flex;flex-direction:column;gap:10px;padding:0 14px 14px;");
        children.forEach(function (child) { body.appendChild(child); });
        fold.appendChild(summary);
        fold.appendChild(body);
        wrap.appendChild(fold);
      }

      var maintenance = mk("div", "display:flex;gap:8px;flex-wrap:wrap;");
      maintenance.appendChild(bPurge);
      maintenance.appendChild(bReset);
      wrap.appendChild(maintenance);
      addSettingsFold("✉️ 邀请函", [bar, ed, pt, ph]);

      var scenePanel = mk("div", "display:flex;flex-direction:column;gap:8px;");
      scenePanel.appendChild(mk("div", "font-size:12px;color:" + C_TEXT + ";", "启用「情境·独立旁白」时生效，与邀请函 CSS 分开保存。"));
      var sceneEd = mk("textarea", ed.style.cssText);
      sceneEd.value = loadSceneCSS();
      sceneEd.spellcheck = false;
      sceneEd.setAttribute("aria-label", "情境 CSS");
      scenePanel.appendChild(sceneEd);
      var sceneBar = mk("div", "display:flex;gap:6px;flex-wrap:nowrap;align-items:stretch;");
      sceneBar.className = "opl-scene-controls";
      function addSceneControl(icon, label, style) {
        var button = mk("button", style + "padding:8px 6px;min-width:0;white-space:nowrap;flex:1 1 auto;", icon);
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.title = label;
        var caption = mk("span", "", " " + label);
        caption.className = "opl-scene-control-label";
        button.appendChild(caption);
        sceneBar.appendChild(button);
        return button;
      }
      [["✨", "简洁", defaultSceneCSS], ["🌙", "日月垂髫", moonSprigSceneCSS]].forEach(function (preset) {
        var button = addSceneControl(preset[0], preset[1], BTN_BASE);
        button.addEventListener("click", function () {
          sceneEd.value = preset[2];
          previewSceneCSS();
          ctx.ui.toast("已载入「" + preset[1] + "」，点「应用」生效");
        });
      });
      var sceneSave = addSceneControl("💾", "保存存档", BTN_BASE);
      var sceneApply = addSceneControl("✅", "应用", BTN_MAIN);
      sceneSave.addEventListener("click", function () { saveArc(true, sceneEd.value); });
      scenePanel.appendChild(sceneBar);
      scenePanel.appendChild(mk("div", HEAD_CSS, "情境实时预览"));
      var scenePreview = mk("div", "padding:8px;border:1px solid " + C_LINE + ";border-radius:12px;");
      var sceneShadow = scenePreview.attachShadow ? scenePreview.attachShadow({ mode: "open" }) : null;
      var scenePreviewStyle = mk("style");
      if (sceneShadow) sceneShadow.appendChild(scenePreviewStyle);
      var sceneSample = makeSceneNode("雨刚停，他站在便利店门口。\n暖黄色的灯光落在湿漉漉的路上。");
      (sceneShadow || scenePreview).appendChild(sceneSample);
      scenePanel.appendChild(scenePreview);
      function previewSceneCSS() { if (sceneShadow) scenePreviewStyle.textContent = defaultSceneCSS + "\n" + sceneEd.value; }
      sceneEd.addEventListener("input", previewSceneCSS);
      sceneApply.addEventListener("click", function () {
        ctx.system.storage.set(K_SCENE_CSS, sceneEd.value);
        applySceneCSS(sceneEd.value);
        ctx.ui.toast("情境 CSS 已应用");
      });
      previewSceneCSS();
      addSettingsFold("情境 CSS · 线下旁白", [scenePanel]);
      addSettingsFold("📁 CSS 存档", [arcNav, al]);
      addSettingsFold("🎨 线下图标颜色（拖动即改，胶囊在时生效）", [acWrap]);
      el.appendChild(wrap);
      refreshArc(); syncArmPanel();
      return function () {
        ph.removeEventListener("load", mountInvitePreview);
        if (invitePreviewObserver) invitePreviewObserver.disconnect();
      };
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
      var strong = "border:1px solid #6f5a86!important;background:#7d6792!important;color:#ffffff!important;";
      var light = "border:1px solid #c8a8c6!important;background:#f7edf7!important;color:#5f3f63!important;";
      var sec = mk("button", btnBase + (o.primaryConfirm ? light : strong), o.cancelLabel || "取消");
      var pri = mk("button", btnBase + (o.primaryConfirm ? strong : light), o.okLabel || "确定");
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
            if (!o.text) { if (replyEl) replyEl.focus(); return; }
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
      sec.addEventListener("click", close);
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
      queueOfflineSnapshot(sid, false, null);
      syncPill(sid);
      if (hasData(sid)) ensureTicker();

      var mo = null, raf = 0, disposed = false;
      function watch() {
        if (mo || disposed || !window.MutationObserver) return;
        var w = wrapperOf(el);
        if (!w) return;
        var lastOff = isOfflineIn(w);
        mo = new MutationObserver(function () {
          var retry = retries[sid];
          if (retry) {
            var stopLabel = retry.offline ? "停止线下生成" : "停止本轮生成";
            var busy = !!w.querySelector('button[aria-label="' + stopLabel + '"]');
            if (busy) retry.busy = true;
            else if (retry.busy) clearRetry(sid);
          }
          if (raf) return;
          raf = requestAnimationFrame(function () {
            raf = 0;
            try {
              paintSceneTurns(sid, w);
              var off = isOfflineIn(w);
              if (off === lastOff) return;
              lastOff = off;
              if (off) queueOfflineSnapshot(sid, false, null);
              if (hasData(sid)) syncPill(sid);
            } catch (e) { }
          });
        });
        mo.observe(w, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
        paintSceneTurns(sid, w);
      }
      watch();
      if (!mo) setTimeout(watch, 400);
      return function () {
        disposed = true;
        if (mo) mo.disconnect();
        if (raf) cancelAnimationFrame(raf);
        var cur = pillHosts[sid];
        if (cur && cur.header === el) {
          delete cur.header;
          clearSceneViews(sid);
          delete sceneState[sid];
        }
      };
    });

    // 复用宿主现有的菜单与删除事件。点击和随后的删除必须发生在同一次操作内。
    function captureRetry(event) {
      var button = event.target && event.target.closest && event.target.closest("button");
      if (!button) return;
      var isRetry = button.matches(".chat-floating-ctx-menu .ctx-menu-btn") && button.textContent.trim() === "重试以下";
      var label = button.getAttribute("aria-label");
      if (!isRetry && label !== "发送" && label !== "停止本轮生成" && label !== "停止线下生成") return;
      var wrapper = wrapperOf(button);
      if (!wrapper) return;
      var sid = Object.keys(pillHosts).find(function (id) { return wrapperFor(id) === wrapper; });
      if (!sid) return;
      if (!isRetry) {
        clearRetry(sid);
        return;
      }
      clearRetry(sid);
      var offline = isOfflineIn(wrapper);
      if (wrapper.querySelector('button[aria-label="停止本轮生成"],button[aria-label="停止线下生成"]')) return;
      var click = { offline: offline, before: offline ? [] : ctx.data.messages.list(sid) };
      if (!offline) {
        var active = wrapper.querySelector('.chat-msg-wrapper[data-active][id^="message-"]');
        if (active) click.targetId = active.id.slice("message-".length);
      }
      retryClicks[sid] = click;
      // 浏览器可能在原生 capture 和 React 的点击回调之间执行微任务。
      setTimeout(function () { if (retryClicks[sid] === click) delete retryClicks[sid]; }, 0);
    }
    function clearRetry(sid) {
      delete retries[sid];
      delete pendingEvt[sid];
    }
    function onOnlineDeleted(event) {
      var deleted = event.detail && event.detail.messages;
      if (!Array.isArray(deleted)) return;
      var ids = new Set(deleted.map(function (m) { return m.id; }));
      var sessions = new Set(deleted.map(function (m) { return m.sessionId; }));
      sessions.forEach(function (sid) {
        var data = getSessionEvents(sid);
        var click = retryClicks[sid];
        if (!data.events.length && !(click && !click.offline)) return;
        var messages = ctx.data.messages.list(sid);
        if (click && !click.offline) {
          delete retryClicks[sid];
          migrateRounds(data, click.before);
          var target = click.before.find(function (m) { return m.id === click.targetId && ids.has(m.id); })
            || click.before.find(function (m) { return isReplyBubble(m) && ids.has(m.id); });
          if (target) {
            var round = findRound(data, roundKeyOf(target));
            // 确认宿主已删除重试目标后立即移除旧胶囊，即使同批还有气泡。
            var capsule = data.events.find(function (e) {
              return e.anchorId === target.id || (e.anchorBatch && e.anchorBatch === target.responseBatchId);
            }) || (round && data.events.find(function (e) { return e.origin === round.key; }));
            if (capsule) data.events = data.events.filter(function (e) { return e !== capsule; });
            retries[sid] = { key: round ? round.key : "", offline: false };
          }
        } else {
          migrateRounds(data, messages.concat(deleted.filter(function (m) { return m.sessionId === sid; })).sort(compareReplyMessages));
        }
        refreshRounds(sid, data, messages);
      });
    }
    function compareReplyMessages(a, b) {
      if (typeof a.order === "number" && typeof b.order === "number") return a.order - b.order;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    }

    // 现有线下事件只提供会话 ID。读取对应会话的回合记录，不写入宿主存储。
    function parseOfflineTurns(raw) {
      var turns = JSON.parse(raw || "[]");
      if (!Array.isArray(turns)) return null;
      return turns.filter(function (turn) {
        return turn && typeof turn.id === "string" && typeof turn.userContent === "string" && typeof turn.assistantContent === "string";
      });
    }
    function readOfflineTurns(sid) {
      var key = "ai_phone_chat_offline_turns:" + sid;
      try {
        var mirror = window.localStorage.getItem(key);
        if (mirror !== null) return Promise.resolve(parseOfflineTurns(mirror));
      } catch (err) { }
      return new Promise(function (resolve) {
        if (!window.indexedDB) { resolve(null); return; }
        var open = window.indexedDB.open("AiPhoneKvDB");
        open.onupgradeneeded = function () { open.transaction.abort(); };
        open.onerror = open.onblocked = function () { resolve(null); };
        open.onsuccess = function () {
          var db = open.result;
          try {
            var read = db.transaction("entries", "readonly").objectStore("entries").get(key);
            read.onsuccess = function () {
              try { resolve(parseOfflineTurns(read.result && read.result.value)); } catch (err) { resolve(null); }
            };
            read.onerror = function () { resolve(null); };
          } catch (err) { resolve(null); }
          finally { db.close(); }
        };
      }).catch(function () { return null; });
    }
    function queueOfflineSnapshot(sid, changed, retry) {
      var snapshot = readOfflineTurns(sid);
      var task = (offlineReads[sid] || Promise.resolve()).then(function () { return snapshot; }).then(function (turns) {
        if (disposedPlugin || !turns) return;
        updateSceneTurns(sid, turns);
        var current = new Set(turns.filter(function (turn) { return turn.assistantContent.trim(); }).map(function (turn) { return turn.id; }));
        var previous = offlineSnapshots[sid];
        offlineSnapshots[sid] = current;
        var data = getSessionEvents(sid);
        if (!data.events.length) return;
        var messages = ctx.data.messages.list(sid);
        migrateRounds(data, messages);
        if (changed && previous) {
          if (retry && retry.awaitingRemoval) {
            retry.awaitingRemoval = false;
            var removed = Array.from(previous).find(function (id) { return !current.has(id); });
            var original = removed && findRound(data, "o:" + removed);
            retry.key = original ? original.key : "";
          }
          current.forEach(function (id) {
            if (previous.has(id)) return;
            var source = "o:" + id;
            if (retry && retry.key !== undefined) {
              if (retries[sid] === retry) delete retries[sid];
              var round = data.rounds.find(function (r) { return r.key === retry.key; });
              if (round && round.sources.indexOf(source) < 0) round.sources.push(source);
              retry = null;
            } else if (!findRound(data, source)) {
              appendRound(data, source);
            }
          });
        }
        if (changed) delete offlineNudge[sid];
        refreshRounds(sid, data, messages);
      }).catch(function () {});
      offlineReads[sid] = task;
      task.then(function () { if (offlineReads[sid] === task) delete offlineReads[sid]; });
    }
    function onOfflineChanged(event) {
      var sid = event.detail && event.detail.sessionId;
      if (!sid) return;
      var click = retryClicks[sid];
      if (click && click.offline) {
        delete retryClicks[sid];
        retries[sid] = { offline: true, awaitingRemoval: true };
      }
      var retry = retries[sid];
      queueOfflineSnapshot(sid, true, retry && retry.offline ? retry : null);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("click", captureRetry, true);
      window.addEventListener("chat-messages-deleted", onOnlineDeleted);
      window.addEventListener("ai-chat-offline-turns-changed", onOfflineChanged);
    }

    ctx.ui.slot("message.footer", function (el, props) {
      try {
        var msg = props && props.message;
        var sid = (props && props.sessionId) || (msg && msg.sessionId) || "";
        if (!msg || msg.role !== "assistant" || !sid) return;
        var feet = footEls[sid] || (footEls[sid] = {});
        feet[msg.id] = { el: el, batch: msg.responseBatchId || "" };
        if (hasData(sid)) { ensureTicker(); scheduleLand(sid); }
        return function () {
          var cur = footEls[sid];
          if (cur && cur[msg.id] && cur[msg.id].el === el) delete cur[msg.id];
        };
      } catch (e) { }
    });

    // ═════════ 卡片流程 ═════════
    function showCard(host, sid, id) {
      var e = getEvt(sid, id);
      if (!e || document.querySelector(".opl-overlay")) return;
      var j = e.judge || {};
      var replyPair = wrapPair("replyWrapBefore", "replyWrapAfter");
      var st = stateOf(e);
      var reject = st === "refused";
      var o = e.opts || [];
      var options = [];
      var l1 = reject ? "追问" : "正剧向", l2 = reject ? "退让" : "暧昧向";
      [[o[0], l1], [o[1], l2]].forEach(function (pair) {
        var it = pair[0];
        if (!it || !it.text) return;
        var lb = it.label || "";
        if (reject ? (lb !== "追问" && lb !== "退让") : (lb !== "正剧向" && lb !== "暧昧向")) lb = pair[1];
        if (st === "user_refused" && options.some(function (option) { return option.label === lb; })) {
          lb = lb === l1 ? l2 : l1;
        }
        options.push({ label: lb, text: applyWrapPair(replyPair, it.text) });
      });

      var eyebrow, title, primary, secondary;
      var desc = cleanText(j.reason);
      if (st === "user_refused") {
        eyebrow = "Surprise？"; title = "悄悄过去看看";
        primary = "直接过去"; secondary = "还是算了";
      } else if (reject) {
        eyebrow = "被婉拒了"; title = "自己过去看看";
        desc = j.reason || "文字闪烁着——\n就这样算了吗？";
        primary = "就这样吧"; secondary = "还是算了";
      } else if (st === "invite") {
        eyebrow = "要过去吗？"; title = "出发去见一面";
        primary = "答应并出发"; secondary = "还是算了";
      } else {
        eyebrow = "有人来了"; title = "抬头看看";
        primary = "应答"; secondary = "再想想";
      }

      openCard({
        eyebrow: eyebrow, title: title, desc: desc,
        scene: e.scene || "",
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
              dismissEvt(sid, id);
            }
          });
        },
        onConfirm: function (close, sceneTxt, replyTxt, label) {
          if (!getEvt(sid, id)) { close(); return; }
          var a = String(sceneTxt || "").trim();
          var b = String(replyTxt || "").trim();
          if (!a && !b) { ctx.ui.toast("至少填一处内容"); return false; }
          if (!b) {
            askConfirm({
              title: "还没写下回应",
              desc: "「你的回应」没有做出动作\n确定直接发送吗？",
              okLabel: "直接发送",
              cancelLabel: "再想想",
              onOk: function () {
                close();
                if (getEvt(sid, id)) enterOffline(host, sid, a, b, label === "退让" ? { reason: j.reason } : null);
              }
            });
            return false;
          }
          close();
          enterOffline(host, sid, a, b, label === "退让" ? { reason: j.reason } : null);
          return true;
        }
      });
    }

    // ═════════ 线下情境：一次发送、分开展示；只存插件自己的分段信息 ═════════
    function getSceneState(sid) {
      return sceneState[sid] || (sceneState[sid] = { rows: new Map(), turns: [] });
    }
    function updateSceneTurns(sid, turns) {
      var host = wrapperFor(sid);
      if (!host) return;
      getSceneState(sid).turns = turns;
      requestAnimationFrame(function () {
        if (!disposedPlugin && wrapperFor(sid) === host) paintSceneTurns(sid, host);
      });
    }

    function splitTaggedScene(text, pair) {
      var raw = String(text || "").trim();
      if (!pair || !raw.startsWith(pair.before)) return null;
      var at = raw.indexOf(pair.after, pair.before.length);
      while (at >= 0) {
        var tail = raw.slice(at + pair.after.length);
        // 正文里也可能有同样的符号；优先识别消息末尾或回应分隔前的闭合标签。
        if (!tail || /^[\t ]*\r?\n/.test(tail)) {
          var scene = raw.slice(pair.before.length, at).trim();
          return scene ? { scene: scene, reply: tail.trim() } : null;
        }
        at = raw.indexOf(pair.after, at + 1);
      }
      return null;
    }
    function makeSceneNode(text) {
      var node = mk("div");
      node.className = "opl-scene-narration";
      var body = mk("div", "", text);
      body.className = "opl-scene-text";
      node.appendChild(body);
      return node;
    }
    function removeSceneView(row, view) {
      view.entry.classList.remove("opl-scene-only", "opl-scene-split");
      view.node.remove();
      if (view.reply) view.reply.remove();
    }
    function clearSceneViews(sid) {
      var state = sceneState[sid];
      if (!state) return;
      state.rows.forEach(function (view, row) { removeSceneView(row, view); });
      state.rows.clear();
    }
    function paintSceneTurns(sid, host) {
      var state = getSceneState(sid);
      var body = isOfflineIn(host) && host.querySelector(".chat-offline-body");
      if (!body) { clearSceneViews(sid); return; }
      var rows = Array.from(body.children).filter(function (el) { return el.classList.contains("chat-offline-turn"); });
      var last = rows[rows.length - 1];
      // 生成中的宿主正文没有已落库消息的右键外观与操作；用预览节点识别临时行。
      var busy = !!(last && last.querySelector(".chat-offline-generating, .chat-stream-cursor"));
      var pair = sBool("sceneNarration", true) && sceneWrapPair(true);
      if (!pair) { clearSceneViews(sid); return; }
      var savedRows = busy ? rows.slice(0, -1) : rows;
      var offset = state.turns.length - savedRows.length;
      var visible = new Set();
      rows.forEach(function (row, index) {
        var stored = !(busy && row === last) && offset >= 0 ? state.turns[index + offset] : null;
        var entry = row.querySelector('.chat-offline-entry[data-role="user"]');
        var text = entry && entry.querySelector(".chat-offline-text");
        if (!text) return;
        // 已存回合读原文，避免宿主的 Markdown 或正则改变自定义标签。
        var prev = state.rows.get(row);
        var split = stored ? splitTaggedScene(stored.userContent, pair) : null;
        if (!split) return;
        visible.add(row);
        if (prev && prev.entry === entry && prev.text === text &&
            prev.sceneText === split.scene && prev.replyText === split.reply &&
            prev.node.nextElementSibling === row && (!prev.reply || prev.reply.parentNode === text)) return;
        if (prev) removeSceneView(row, prev);
        var node = makeSceneNode(split.scene);
        var reply = null;
        if (split.reply) {
          reply = mk("div", "", split.reply);
          reply.className = "opl-scene-reply";
          text.appendChild(reply);
          entry.classList.add("opl-scene-split");
        } else entry.classList.add("opl-scene-only");
        row.before(node);
        state.rows.set(row, { entry: entry, text: text, node: node, reply: reply, sceneText: split.scene, replyText: split.reply });
      });
      state.rows.forEach(function (view, row) {
        if (visible.has(row)) return;
        removeSceneView(row, view);
        state.rows.delete(row);
      });
    }

    function enterOffline(host, sid, scene, reply, nudge) {
      var toggle = host.querySelector('button[aria-label="线下模式"]')
        || host.querySelector(".chat-offline-toggle");
      if (!isOfflineIn(host)) {
        if (!toggle) { ctx.ui.toast("没找到线下模式按钮，宿主 UI 可能已变更"); return; }
        toggle.click();
      }
      waitFor(function () {
        return !!host.querySelector('button[aria-label="返回线上模式"]')
          && !!host.querySelector("textarea.chat-input-textarea");
      }, 4000).then(function (ok) {
        if (!ok) {
          ctx.ui.toast("进入线下失败：可能正在生成回复，稍后再试");
          return;
        }
        // 刻意不清数据、不移除胶囊：胶囊要留到你发够 N 条
        var ta = host.querySelector("textarea.chat-input-textarea");
        if (!ta) { ctx.ui.toast("没找到线下输入框"); return; }
        if (disposedPlugin || wrapperFor(sid) !== host) return;
        var text = offlineScenePayload(scene, reply);
        setNativeValue(ta, text);
        return sleep(160).then(function () {
          if (disposedPlugin || wrapperFor(sid) !== host || !isOfflineIn(host) ||
              host.querySelector("textarea.chat-input-textarea") !== ta || ta.value.trim() !== text) return;
          var act = host.querySelector(".chat-input-actions"), send = null;
          if (act) {
            var ls = act.querySelectorAll("button");
            for (var i = 0; i < ls.length; i++) {
              if (ls[i].getAttribute("aria-label") === "发送") { send = ls[i]; break; }
            }
          }
          if (!send) {
            ctx.ui.toast("没找到发送按钮，文字已填入输入框"); return;
          }
          if (send.disabled) {
            ta.focus(); ctx.ui.toast("已填入输入框，手动点发送"); return;
          }
          if (nudge) offlineNudge[sid] = nudge;
          send.click();
          setTimeout(function () { syncPill(sid); }, 300);
        });
      });
    }

    // ═════════ 卸载 ═════════
    return function () {
      disposedPlugin = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("click", captureRetry, true);
        window.removeEventListener("chat-messages-deleted", onOnlineDeleted);
        window.removeEventListener("ai-chat-offline-turns-changed", onOfflineChanged);
      }
      try { stopTicker(); } catch (e) { }
      try { if (settingsOff) settingsOff(); } catch (e) { }
      Object.keys(sceneState).forEach(clearSceneViews);
      try { if (sceneCssDisp) sceneCssDisp(); } catch (e) { }
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