// 钱包加钱器  wallet-money-injector  (apiVersion 1 / ES Module)
// ------------------------------------------------------------------
// 给小手机里的「钱包」余额 / 储蓄卡 / 黑市影子币直接加钱（本地虚拟数值）。
// 原理：宿主数据落在 IndexedDB（库 AiPhoneKvDB，store entries）：
//   - 钱包：key ai_phone_wallet_state_v1，事件 wallet-state-updated
//   - 黑市：key ai_phone_black_market_state_v1，事件 ai-phone:black-market-updated
// 插件直接改写持久层、补一条合规流水（adjustment / manual_adjust）并派发刷新事件。
// 注意：宿主读数据走内存缓存，外部直写 IDB 后需要刷新一次页面才能让界面与缓存
//   重新水合，所以默认「加钱后自动刷新」（刷新后必定到账，且不会被后续操作覆盖）。

export default {
  manifest: {
    id: "wallet-money-injector",
    name: "钱包加钱器",
    apiVersion: 1,
    version: "1.0.0",
    author: "Doubao",
    description: "外挂式加钱：给钱包余额/储蓄卡/黑市影子币直接加钱、扣减或设为指定金额，自动补流水，迷你悬浮按钮唤起面板",
    settings: [
      { key: "showBall", label: "显示右下角悬浮 ¥ 按钮", type: "boolean", default: true },
      { key: "autoReload", label: "操作后自动刷新页面（立即到账，建议开启）", type: "boolean", default: true },
      { key: "quickAmounts", label: "快捷金额（逗号分隔，支持 万/w、千/k）", type: "text", default: "1万,10万,100万,1000万" },
    ],
  },

  setup(ctx) {
    // ============================== 常量 ==============================
    const WALLET_KEY = "ai_phone_wallet_state_v1";
    const BM_KEY = "ai_phone_black_market_state_v1";
    const WALLET_EVT = "wallet-state-updated";
    const BM_EVT = "ai-phone:black-market-updated";
    const BALANCE_ACCOUNT = "wallet_balance_account";
    const DEFAULT_CARD = "wallet_default_bank_card";
    const POS_KEY = "wallet-injector/ball-pos";

    const settings = ctx.system.settings;
    const storage = ctx.system.storage;
    const toast = (t, o) => ctx.ui.toast(t, o);
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const fmt = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function h(tag, props, ...children) {
      const el = document.createElement(tag);
      if (props) for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
      for (const c of children.flat()) {
        if (c == null || c === false) continue;
        el.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
      return el;
    }
    // 支持 10000 / 1万 / 10w / 5千 / 1百万
    function parseAmount(s) {
      const t = String(s == null ? "" : s).trim().toLowerCase().replace(/[¥￥,\s元]/g, "");
      const m = t.match(/^(\d+(?:\.\d+)?)(万|w|千|k|百万|m)?$/);
      if (!m) return NaN;
      let n = parseFloat(m[1]);
      if (m[2] === "万" || m[2] === "w") n *= 10000;
      else if (m[2] === "千" || m[2] === "k") n *= 1000;
      else if (m[2] === "百万" || m[2] === "m") n *= 1e6;
      return n;
    }

    // ====================== IndexedDB（宿主 KV 库）直读直写 ======================
    function openKvDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open("AiPhoneKvDB");
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("entries")) req.result.createObjectStore("entries");
        };
        req.onsuccess = () => {
          const db = req.result;
          if (db.objectStoreNames.contains("entries")) return resolve(db);
          // 极端兜底：库存在但缺 store，升版本补建
          const v = db.version || 1;
          db.close();
          const req2 = indexedDB.open("AiPhoneKvDB", v + 1);
          req2.onupgradeneeded = () => {
            if (!req2.result.objectStoreNames.contains("entries")) req2.result.createObjectStore("entries");
          };
          req2.onsuccess = () => resolve(req2.result);
          req2.onerror = () => reject(req2.error);
        };
        req.onerror = () => reject(req.error);
      });
    }
    async function kvGetRaw(key) {
      const db = await openKvDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readonly");
        const rq = tx.objectStore("entries").get(key);
        rq.onsuccess = () => resolve(rq.result ? rq.result.value ?? null : null);
        rq.onerror = () => reject(rq.error);
      });
    }
    async function kvPutRaw(key, value) {
      const db = await openKvDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readwrite");
        tx.objectStore("entries").put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    // ============================== 默认结构（与宿主一致） ==============================
    function createDefaultWallet() {
      const now = new Date().toISOString();
      return {
        balance: 10000,
        cards: [{
          id: DEFAULT_CARD, title: "储蓄卡", bankLabel: "CHAT WALLET",
          maskedNumber: "**** **** **** 0214", cardStyle: "graphite",
          balance: 0, note: "系统自动创建的默认银行卡", accentLabel: "储蓄",
          isDefault: true, createdAt: now, updatedAt: now,
        }],
        transactions: [{
          id: "wallet_initial_balance", cardId: BALANCE_ACCOUNT, accountType: "balance",
          title: "初始余额", amount: 10000, kind: "transfer_in", category: "初始化",
          createdAt: now, detail: "系统自动创建余额账户", balanceAfter: 10000,
        }],
        defaultCardId: DEFAULT_CARD,
        updatedAt: now,
      };
    }
    function createDefaultBm() {
      const now = new Date().toISOString();
      return {
        wallet: {
          userId: "bm_user_" + uid(), displayName: "本地玩家", balance: 1000,
          transactions: [{
            id: "sc_tx_" + uid(), type: "initial_grant", amount: 1000,
            title: "初始额度", detail: "黑市终端首次初始化。", balanceAfter: 1000, createdAt: now,
          }],
          updatedAt: now,
        },
        ownedTheaters: [], activeTheaters: [], updatedAt: now,
      };
    }
    async function readWallet() {
      try {
        const raw = await kvGetRaw(WALLET_KEY);
        if (raw) { const p = JSON.parse(raw); if (p && typeof p === "object") return p; }
      } catch (e) { ctx.system.log("钱包读取失败，使用默认结构", e); }
      return createDefaultWallet();
    }
    async function readBm() {
      try {
        const raw = await kvGetRaw(BM_KEY);
        if (raw) { const p = JSON.parse(raw); if (p && p.wallet) return p; }
      } catch (e) { ctx.system.log("黑市钱包读取失败", e); }
      return null;
    }

    // ============================== 加钱核心 ==============================
    // target: 'balance' | 'card:<id>' | 'shadow'；mode: 'add' | 'sub' | 'set'
    async function applyMoney(target, amount, mode) {
      amount = round2(amount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("金额不合法");
      const nowIso = () => new Date().toISOString();

      if (target === "shadow") {
        const st = (await readBm()) || createDefaultBm();
        const cur = Math.round(Number(st.wallet.balance) || 0);
        const next = Math.max(0, Math.round(mode === "add" ? cur + amount : mode === "sub" ? cur - amount : amount));
        st.wallet.balance = next;
        st.wallet.transactions = Array.isArray(st.wallet.transactions) ? st.wallet.transactions : [];
        st.wallet.transactions.unshift({
          id: "sc_tx_" + uid(),
          type: "manual_adjust",
          amount: mode === "sub" ? -Math.round(amount) : Math.round(amount),
          title: mode === "set" ? "额度校准" : "额度调整",
          detail: "钱包加钱器：" + (mode === "add" ? "增加" : mode === "sub" ? "扣减" : "设为") + " " + Math.round(amount) + "，操作后 " + next,
          balanceAfter: next, createdAt: nowIso(),
        });
        st.wallet.transactions = st.wallet.transactions.slice(0, 200);
        st.wallet.updatedAt = nowIso();
        st.updatedAt = st.wallet.updatedAt;
        await kvPutRaw(BM_KEY, JSON.stringify(st));
        window.dispatchEvent(new CustomEvent(BM_EVT, { detail: st }));
        return next;
      }

      const st = await readWallet();
      const isCard = target.indexOf("card:") === 0;
      const cardId = isCard ? target.slice(5) : BALANCE_ACCOUNT;
      let cur;
      if (isCard) {
        const card = (st.cards || []).find((c) => c.id === cardId);
        if (!card) throw new Error("找不到该银行卡");
        cur = round2(card.balance);
      } else {
        st.cards = Array.isArray(st.cards) && st.cards.length ? st.cards : [createDefaultWallet().cards[0]];
        cur = round2(st.balance);
      }
      const next = round2(mode === "add" ? cur + amount : mode === "sub" ? Math.max(0, cur - amount) : amount);
      if (isCard) {
        const card = st.cards.find((c) => c.id === cardId);
        card.balance = next; card.updatedAt = nowIso();
      } else {
        st.balance = next;
      }
      st.transactions = Array.isArray(st.transactions) ? st.transactions : [];
      st.transactions.unshift({
        id: "wmi_tx_" + uid(),
        cardId, accountType: isCard ? "card" : "balance",
        title: mode === "set" ? "余额校准" : "余额调整",
        amount: round2(mode === "set" ? next : mode === "sub" ? -amount : amount),
        kind: "adjustment", category: "余额调整",
        createdAt: nowIso(),
        detail: "钱包加钱器" + (mode === "add" ? "增加" : mode === "sub" ? "扣减" : "设为") + " " + fmt(amount) + "，操作后余额 " + fmt(next),
        balanceAfter: next,
      });
      st.transactions = st.transactions.slice(0, 300);
      st.updatedAt = nowIso();
      await kvPutRaw(WALLET_KEY, JSON.stringify(st));
      window.dispatchEvent(new CustomEvent(WALLET_EVT, { detail: st }));
      return next;
    }
    async function readCurrent(target) {
      if (target === "shadow") {
        const st = await readBm();
        return st ? Math.round(Number(st.wallet.balance) || 0) : 1000;
      }
      const st = await readWallet();
      if (target === "balance") return round2(st.balance);
      const card = (st.cards || []).find((c) => c.id === target.slice(5));
      return card ? round2(card.balance) : 0;
    }

    // ============================== 样式 ==============================
    ctx.ui.injectCSS(`
.wmi-ball{position:fixed;z-index:2147483646;width:24px;height:24px;border-radius:50%;
  background:rgba(12,10,7,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:0 2px 8px rgba(0,0,0,.5),inset 0 0 0 1px rgba(217,179,92,.55);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#e3c47a;
  cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;
  transition:transform .25s ease,left .25s ease,right .25s ease,opacity .2s}
.wmi-ball.peek-left{transform:translateX(-56%)}
.wmi-ball.peek-right{transform:translateX(56%)}
.wmi-panel{position:fixed;z-index:2147483647;width:300px;max-width:calc(100vw - 18px);
  border-radius:16px;padding:12px;display:none;color:#e8d5a3;font-size:13px;
  background:rgba(13,11,8,.72);-webkit-backdrop-filter:blur(18px) saturate(1.25);backdrop-filter:blur(18px) saturate(1.25);
  box-shadow:0 12px 40px rgba(0,0,0,.55),inset 0 0 0 1px rgba(217,179,92,.32);
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.wmi-panel.open{display:block}
.wmi-phead{display:flex;align-items:center;margin-bottom:10px}
.wmi-ptitle{font-size:12px;font-weight:700;letter-spacing:1.5px;color:#d9b35c;margin-right:auto}
.wmi-x{border:1px solid rgba(217,179,92,.5);background:transparent;color:#d9b35c;border-radius:50%;
  width:20px;height:20px;font-size:11px;line-height:1;cursor:pointer;padding:0}
.wmi-wrap{width:100%}
.wmi-targets{display:flex;gap:6px;margin-bottom:10px}
.wmi-tg{flex:1;border:1px solid rgba(217,179,92,.35);border-radius:10px;padding:7px 4px;
  background:rgba(28,23,14,.7);color:#c9a85c;font-size:12.5px;cursor:pointer}
.wmi-tg.on{background:linear-gradient(135deg,#e9cc84,#c99a3e);border-color:transparent;color:#1a1408;font-weight:700;
  box-shadow:0 1px 6px rgba(201,154,62,.45)}
.wmi-bal{border-radius:12px;padding:10px 13px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:baseline;
  background:rgba(32,26,14,.62);box-shadow:inset 0 0 0 1px rgba(217,179,92,.28)}
.wmi-bal span{font-size:11.5px;color:#b39a5e}
.wmi-bal b{font-size:20px;color:#f0d48a;letter-spacing:.3px}
.wmi-sel{width:100%;border:1px solid rgba(217,179,92,.4);border-radius:9px;padding:8px 10px;font-size:12.5px;
  background:rgba(0,0,0,.4);outline:none;margin-bottom:10px;color:#ecd9a8}
.wmi-sel option{background:#1a160f;color:#ecd9a8}
.wmi-quicks{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.wmi-q{border:1px solid rgba(217,179,92,.4);border-radius:999px;padding:5px 12px;background:rgba(0,0,0,.3);
  color:#d9b35c;font-size:12px;cursor:pointer}
.wmi-q:active{background:rgba(217,179,92,.25)}
.wmi-row{display:flex;gap:6px;margin-bottom:8px}
.wmi-inp{flex:1;min-width:0;border:1px solid rgba(217,179,92,.4);border-radius:9px;padding:8px 10px;font-size:13px;
  outline:none;background:rgba(0,0,0,.4);color:#f2e3b8}
.wmi-inp::placeholder{color:#8f7c4e}
.wmi-inp:focus{border-color:#d9b35c}
.wmi-act{border-radius:9px;padding:8px 12px;font-size:12.5px;cursor:pointer;font-weight:700}
.wmi-add{border:1px solid #d9b35c;background:linear-gradient(135deg,#e9cc84,#c99a3e);color:#1a1408}
.wmi-sub,.wmi-set{border:1px solid rgba(217,179,92,.5);background:rgba(0,0,0,.3);color:#d9b35c}
.wmi-act:active{opacity:.85}
.wmi-note{font-size:11px;line-height:1.65;color:#a08a57;margin-top:4px}
.wmi-err{color:#e09383;font-size:11.5px;margin-top:6px;min-height:16px}
`);

    // ============================== 控制面板 ==============================
    const ui = {
      target: "balance",   // balance | card:<id> | shadow
      current: 0,
      cards: [],
    };

    function quickAmounts() {
      return String(settings.get("quickAmounts") || "1万,10万,100万,1000万")
        .split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    }

    // 自建悬浮面板（点空白处关闭并贴边半隐藏，不使用 openModal）
    const panelBody = h("div", { class: "wmi-wrap", "data-role": "body" });
    const panel = h("div", { class: "wmi-panel" },
      h("div", { class: "wmi-phead" },
        h("span", { class: "wmi-ptitle" }, "钱包加钱器"),
        h("button", { class: "wmi-x", title: "关闭并贴边", onclick: () => hidePanel() }, "×"),
      ),
      panelBody,
    );
    function buildPanelContent() {
      const wrap = panelBody;
      wrap.innerHTML = "";

        // 目标切换
        const tgBar = h("div", { class: "wmi-targets" },
          h("button", { class: "wmi-tg", "data-t": "balance", onclick: () => switchTarget("balance") }, "钱包余额"),
          h("button", { class: "wmi-tg", "data-t": "card", onclick: () => switchTarget(ui.cards.length ? "card:" + ui.cards[0].id : "card:none") }, "储蓄卡"),
          h("button", { class: "wmi-tg", "data-t": "shadow", onclick: () => switchTarget("shadow") }, "黑市影子币"),
        );
        const balBox = h("div", { class: "wmi-bal" }, h("span", {}, "当前余额"), h("b", {}, "读取中…"));
        const cardSel = h("select", { class: "wmi-sel", style: "display:none" });
        cardSel.addEventListener("change", () => switchTarget("card:" + cardSel.value));
        const quickBox = h("div", { class: "wmi-quicks" });
        const inp = h("input", { class: "wmi-inp", placeholder: "输入金额，如 100万", inputmode: "decimal" });
        const errBox = h("div", { class: "wmi-err" });
        const actRow = h("div", { class: "wmi-row" },
          inp,
          h("button", { class: "wmi-act wmi-add", onclick: () => doAct("add") }, "加钱"),
          h("button", { class: "wmi-act wmi-sub", onclick: () => doAct("sub") }, "扣减"),
          h("button", { class: "wmi-act wmi-set", onclick: () => doAct("set") }, "设为"),
        );
        const note = h("div", { class: "wmi-note" },
          "快捷按钮 = 直接加钱；改的是本机虚拟数值，只影响本应用。",
          h("br"),
          settings.get("autoReload") === false
            ? "已关闭自动刷新：操作后请手动刷新页面到账，刷新前不要在钱包内做其他操作。"
            : "操作后页面会自动轻刷新一次，余额立即到账。",
        );
        wrap.append(tgBar, balBox, cardSel, quickBox, actRow, errBox, note);

        function paintTabs() {
          tgBar.querySelectorAll(".wmi-tg").forEach((b) => {
            const t = b.getAttribute("data-t");
            const on = ui.target === t || (t === "card" && ui.target.indexOf("card:") === 0);
            b.classList.toggle("on", !!on);
          });
          cardSel.style.display = ui.target.indexOf("card:") === 0 ? "block" : "none";
        }
        function paintBalance() {
          balBox.querySelector("b").textContent = ui.target === "shadow"
            ? Math.round(ui.current).toLocaleString("zh-CN")
            : fmt(ui.current);
        }
        function paintQuicks() {
          quickBox.innerHTML = "";
          quickAmounts().forEach((txt) => {
            quickBox.append(h("button", {
              class: "wmi-q", onclick: () => { inp.value = txt; doAct("add"); },
            }, "＋" + txt));
          });
        }
        async function refreshBalance() {
          try { ui.current = await readCurrent(ui.target === "card:none" ? "balance" : ui.target); paintBalance(); }
          catch (e) { balBox.querySelector("b").textContent = "读取失败"; }
        }
        async function switchTarget(t) {
          ui.target = t;
          paintTabs();
          paintQuicks();
          await refreshBalance();
        }
        async function doAct(mode) {
          errBox.textContent = "";
          const amount = parseAmount(inp.value);
          if (!Number.isFinite(amount) || amount < 0) { errBox.textContent = "金额格式不对，例：10000、10万、5千"; return; }
          const target = ui.target === "card:none" ? "balance" : ui.target;
          const loading = toast("正在写入…", { durationMs: 0 });
          try {
            const next = await applyMoney(target, amount, mode);
            ui.current = next; paintBalance();
            loading.close();
            const label = mode === "add" ? "已加钱" : mode === "sub" ? "已扣减" : "已设为";
            toast(label + "，当前 " + (target === "shadow" ? next : fmt(next)));
            inp.value = "";
            if (settings.get("autoReload") !== false) {
              setTimeout(() => { try { window.location.reload(); } catch (e) { /* ignore */ } }, 650);
            } else {
              errBox.textContent = "已写入，刷新页面后界面同步。";
            }
          } catch (e) {
            loading.close();
            errBox.textContent = "操作失败：" + (e && e.message ? e.message : "未知错误");
          }
        }

        // 初始化：读钱包卡列表
        readWallet().then((st) => {
          ui.cards = Array.isArray(st.cards) ? st.cards : [];
          cardSel.innerHTML = "";
          ui.cards.forEach((c) => cardSel.append(h("option", { value: c.id }, c.title + "（" + (c.maskedNumber || "") + "）")));
          paintTabs();
          return refreshBalance();
        });
        paintTabs();
        paintQuicks();
    }
    function placePanel() {
      const r = ball.getBoundingClientRect();
      panel.style.top = clampPx(r.top - 6, 8, Math.max(8, window.innerHeight - 320)) + "px";
      panel.style.left = ""; panel.style.right = "";
      panel.style[ballPos.side === "left" ? "left" : "right"] = "9px";
    }
    function showPanel() {
      ball.classList.remove("peek-left", "peek-right");
      placePanel();
      buildPanelContent();
      panel.classList.add("open");
    }
    function hidePanel() {
      panel.classList.remove("open");
      ball.classList.add(ballPos.side === "left" ? "peek-left" : "peek-right");
    }
    function openPanel() { showPanel(); }
    function togglePanel() { panel.classList.contains("open") ? hidePanel() : showPanel(); }
    // 点面板/悬浮球之外的空白处 → 收起并贴边半隐藏
    function onDocPointerDown(e) {
      if (!panel.classList.contains("open")) return;
      if (panel.contains(e.target) || ball.contains(e.target)) return;
      hidePanel();
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);

    // ============================== 悬浮 ¥ 按钮（迷你，吸附两侧半隐藏） ==============================
    const BALL_SIZE = 24;
    const ball = h("div", { class: "wmi-ball", title: "钱包加钱器" }, "¥");
    let ballPos = null;
    try { ballPos = storage.get(POS_KEY); } catch (e) { /* ignore */ }
    if (!ballPos || typeof ballPos !== "object" || (ballPos.side !== "left" && ballPos.side !== "right")) {
      ballPos = { side: "right", top: 200 };
    }
    const clampPx = (v, min, max) => Math.min(max, Math.max(min, v));
    function placeBall() {
      ballPos.top = clampPx(Number(ballPos.top) || 200, 8, window.innerHeight - BALL_SIZE - 8);
      ball.style.top = ballPos.top + "px";
      if (ballPos.side === "left") { ball.style.left = "4px"; ball.style.right = ""; }
      else { ball.style.right = "4px"; ball.style.left = ""; }
    }
    // 初始即贴边半隐藏
    ball.classList.add(ballPos.side === "left" ? "peek-left" : "peek-right");
    let drag = null;
    ball.addEventListener("pointerdown", (e) => {
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      ball.setPointerCapture(e.pointerId);
    });
    ball.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) {
        ball.classList.remove("peek-left", "peek-right");
        ball.style.left = clampPx(e.clientX - BALL_SIZE / 2, 0, window.innerWidth - BALL_SIZE) + "px";
        ball.style.top = clampPx(e.clientY - BALL_SIZE / 2, 0, window.innerHeight - BALL_SIZE) + "px";
        ball.style.right = "auto";
      }
    });
    ball.addEventListener("pointerup", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved; drag = null;
      if (!moved) { togglePanel(); return; }
      const r = ball.getBoundingClientRect();
      ballPos.side = (r.left + BALL_SIZE / 2) < window.innerWidth / 2 ? "left" : "right";
      ballPos.top = Math.round(clampPx(r.top, 8, window.innerHeight - BALL_SIZE - 8));
      try { storage.set(POS_KEY, ballPos); } catch (e2) { /* ignore */ }
      placeBall();
      if (panel.classList.contains("open")) placePanel();
      else ball.classList.add(ballPos.side === "left" ? "peek-left" : "peek-right");
    });

    function setBallVisible(visible) {
      ball.style.display = visible ? "flex" : "none";
      if (!visible) panel.classList.remove("open");
    }
    window.addEventListener("resize", () => {
      placeBall();
      if (panel.classList.contains("open")) placePanel();
    });

    // 设置页兜底入口
    const slotOff = ctx.ui.slot("settings.section", (el) => {
      el.innerHTML = "";
      el.style.margin = "8px 0";
      const btn = document.createElement("button");
      btn.textContent = "打开「钱包加钱器」面板";
      btn.style.cssText = "width:100%;padding:10px;border-radius:10px;border:1px solid #d9b35c;cursor:pointer;background:linear-gradient(135deg,#e9cc84,#c99a3e);color:#1a1408;font-weight:700;font-size:13px;";
      btn.addEventListener("click", openPanel);
      el.append(btn);
    });

    // ============================== 挂载 / 设置联动 / 清理 ==============================
    function mount() {
      if (!document.body || ball.isConnected) return;
      document.body.append(ball, panel);
      placeBall();
      setBallVisible(settings.get("showBall") !== false);
    }
    if (document.body) mount();
    else ctx.hooks.on("app.ready", mount);

    const offSettings = settings.onChange(() => {
      setBallVisible(settings.get("showBall") !== false);
    });

    return () => {
      ball.remove();
      panel.remove();
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      if (slotOff) try { slotOff(); } catch (e) { /* ignore */ }
      if (offSettings) try { offSettings(); } catch (e) { /* ignore */ }
    };
  },
};
