// 天气伴侣 · 小手机扩展插件（配合「天气」APP 使用）
// 1. 让角色像真人一样「本来就知道」你那边的地点和天气：
//    在角色每次回复、组装提示词的那一刻，把你那边的实时天气告诉 TA（和日历节假日插件同一种方式）。
//    地点叫法跟随天气 APP 里的设置（全局改名 / 按角色单独起名 / 真实地名），天气和时间永远是真实的。
//    不在后台拉起 APP、不写聊天记录，所以不会让聊天变卡。
// 2. 修复聊天里 HTML 样式的 APP 卡片（如天气卡片）点了打不开 APP 的问题。
// 安装：聊天 → 我 → 扩展插件 → 导入插件，选择本文件（会覆盖旧的「聊天卡片点击修复」）。

const WMO = {
  0: "晴", 1: "大致晴朗", 2: "多云", 3: "阴", 45: "雾", 48: "雾凇",
  51: "小毛毛雨", 53: "毛毛雨", 55: "大毛毛雨", 56: "冻毛毛雨", 57: "冻毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒", 80: "阵雨", 81: "阵雨", 82: "强阵雨",
  85: "阵雪", 86: "强阵雪", 95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "强雷雨伴冰雹",
};
const isWet = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;
const isSnowy = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
const APP_DATA_PREFIX = "ai_phone_custom_app_data_v1:";
const REFRESH_MS = 20 * 60 * 1000;

export default {
  manifest: {
    id: "app-card-tap-fix",
    name: "天气伴侣",
    apiVersion: 1,
    version: "2.0.0",
    author: "Claude & fish",
    description: "配合天气 APP：让角色自然知道你那边的地点和实时天气（下雨降温会顺口关心你）；并让聊天里的天气卡片点一下就能打开 APP。",
    settings: [
      { key: "aware", label: "让角色知道我这边的天气", type: "boolean", default: true },
      { key: "fallbackName", label: "读不到天气 APP 设置时用的地名（可不填）", type: "text", default: "" },
    ],
  },

  setup(ctx) {
    // ── 卡片点击修复：卡片里的小窗口只显示、不接收点击 ──
    ctx.ui.injectCSS(`.chat-app-custom-card-frame{pointer-events:none!important;}.chat-app-custom-card:not([data-disabled]){cursor:pointer;}`);

    let conf = {};
    try { conf = (ctx.system.settings.all && ctx.system.settings.all()) || {}; } catch (_) {}
    ctx.system.settings.onChange && ctx.system.settings.onChange((all) => { if (all && typeof all === "object") conf = { ...all }; });
    const opt = (k, d) => (conf[k] === undefined || conf[k] === null ? d : conf[k]);

    let appSettings = null;   // 天气 APP 的设置（叫法、单位等）
    let appHere = null;       // 天气 APP 里「我的位置」
    let wx = null;            // 最近一次天气
    let busy = false;

    // ── 读取天气 APP 的设置（只读、只读小条目，不解析大数据） ──
    function idbGetAll(keysFilter) {
      return new Promise((resolve) => {
        let req;
        try { req = indexedDB.open("AiPhoneKvDB"); } catch (_) { resolve([]); return; }
        req.onerror = () => resolve([]);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const store = db.transaction("entries", "readonly").objectStore("entries");
            const kr = store.getAllKeys();
            kr.onsuccess = () => {
              const keys = (kr.result || []).filter(k => typeof k === "string" && keysFilter(k));
              if (!keys.length) { db.close(); resolve([]); return; }
              const out = [];
              let left = keys.length;
              for (const k of keys) {
                const g = store.get(k);
                g.onsuccess = () => { out.push([k, g.result && g.result.value]); if (--left === 0) { db.close(); resolve(out); } };
                g.onerror = () => { if (--left === 0) { db.close(); resolve(out); } };
              }
            };
            kr.onerror = () => { db.close(); resolve([]); };
          } catch (_) { try { db.close(); } catch (e) {} resolve([]); }
        };
      });
    }
    async function loadAppData() {
      const rows = await idbGetAll(k => k.startsWith(APP_DATA_PREFIX) && (k.endsWith("/settings") || k.endsWith("/places")));
      let found = null;
      for (const [k, v] of rows) {
        if (!k.endsWith("/settings")) continue;
        try {
          const arr = JSON.parse(v || "[]");
          const s = Array.isArray(arr) ? arr[0] : null;
          if (s && ("charViews" in s || "aware" in s || "vPlace" in s)) { found = { base: k.slice(0, -"/settings".length), s }; break; }
        } catch (_) {}
      }
      if (!found) return;
      appSettings = found.s;
      const pl = rows.find(([k]) => k === found.base + "/places");
      try { const arr = JSON.parse((pl && pl[1]) || "[]"); appHere = (arr || []).find(p => p && p.here) || null; } catch (_) {}
    }

    // ── 位置：优先实时定位（省电模式，允许用 30 分钟内的缓存），拿不到就用天气 APP 上次的定位 ──
    function locate() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        const t = setTimeout(() => resolve(null), 8000);
        navigator.geolocation.getCurrentPosition(
          p => { clearTimeout(t); resolve({ lat: p.coords.latitude, lon: p.coords.longitude }); },
          () => { clearTimeout(t); resolve(null); },
          { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 7500 },
        );
      });
    }

    async function refresh(force) {
      if (busy || !opt("aware", true)) return;
      if (!force && wx && Date.now() - wx.at < REFRESH_MS) return;
      busy = true;
      try {
        await loadAppData();
        if (appSettings && appSettings.aware === "off") { wx = null; return; }
        let pos = null;
        // 只有用户已经给过定位权限时才实时定位，绝不在聊天时突然弹授权框
        try {
          const st = navigator.permissions ? await navigator.permissions.query({ name: "geolocation" }) : null;
          if (!st || st.state === "granted") pos = await locate();
        } catch (_) { pos = await locate(); }
        if (!pos && appHere) pos = { lat: appHere.lat, lon: appHere.lon };
        if (!pos) return;
        const u = new URL("https://api.open-meteo.com/v1/forecast");
        u.searchParams.set("latitude", pos.lat); u.searchParams.set("longitude", pos.lon);
        u.searchParams.set("timezone", "auto"); u.searchParams.set("forecast_days", "1");
        u.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m");
        u.searchParams.set("hourly", "weather_code,precipitation_probability");
        u.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max");
        const r = await fetch(u.toString());
        if (!r.ok) return;
        const d = await r.json();
        const c = d.current || {}, H = d.hourly || {}, D = d.daily || {};
        const nowKey = String(c.time || "").slice(0, 13);
        let idx = (H.time || []).findIndex(t => String(t).slice(0, 13) >= nowKey);
        if (idx < 0) idx = 0;
        const next = [];
        for (let i = idx + 1; i < Math.min(idx + 9, (H.time || []).length); i++) next.push({ code: H.weather_code[i], pop: H.precipitation_probability?.[i] });
        let aqi = null;
        try {
          const a = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${pos.lat}&longitude=${pos.lon}&current=us_aqi`);
          if (a.ok) aqi = (await a.json()).current?.us_aqi ?? null;
        } catch (_) {}
        const realName = appHere && Math.abs(appHere.lat - pos.lat) + Math.abs(appHere.lon - pos.lon) < 0.05 ? appHere.name : (appHere ? appHere.name : "");
        wx = {
          at: Date.now(), offset: Number(d.utc_offset_seconds) || 0, realName,
          t: c.temperature_2m, feels: c.apparent_temperature, code: c.weather_code, humidity: c.relative_humidity_2m,
          hi: D.temperature_2m_max?.[0], lo: D.temperature_2m_min?.[0], pop: D.precipitation_probability_max?.[0], uv: D.uv_index_max?.[0],
          next, aqi,
        };
      } catch (e) {
        ctx.system.log("天气刷新失败", String(e));
      } finally { busy = false; }
    }

    // ── 按角色的叫法（和天气 APP 的规则完全一致） ──
    function viewFor(characterId) {
      const S = appSettings || {};
      const b = characterId && S.charViews ? S.charViews[characterId] : null;
      if (b && b.mode === "alias") return { place: b.place || "", dateAlias: b.dateAlias || "" };
      if (b && b.mode === "real") return { place: "", dateAlias: "" };
      if (S.virt === "on") return { place: S.vPlace || "", dateAlias: S.vDate || "" };
      return { place: "", dateAlias: "" };
    }
    const unitF = () => appSettings && appSettings.unit === "f";
    const tp = v => v == null ? "--" : Math.round(unitF() ? v * 9 / 5 + 32 : v) + "°";

    function buildHint(characterId) {
      if (!wx || !opt("aware", true)) return "";
      if (appSettings && appSettings.aware === "off") return "";
      const V = viewFor(characterId);
      const name = V.place || wx.realName || String(opt("fallbackName", "") || "").trim() || "TA所在的地方";
      const local = new Date(Date.now() + wx.offset * 1000);
      const p2 = n => String(n).padStart(2, "0");
      const clock = `${p2(local.getUTCHours())}:${p2(local.getUTCMinutes())}`;
      const date = V.dateAlias || `${local.getUTCMonth() + 1}月${local.getUTCDate()}日 周${"日一二三四五六"[local.getUTCDay()]}`;
      let s = `用户那边（${name}）现在是${date} ${clock}，${WMO[wx.code] || "天气未知"}，${tp(wx.t)}，体感${tp(wx.feels)}；今天最高${tp(wx.hi)}、最低${tp(wx.lo)}`;
      if (isWet(wx.code) || isSnowy(wx.code)) s += `，外面正在${WMO[wx.code]}`;
      else {
        const i = wx.next.findIndex(h => isWet(h.code) || isSnowy(h.code) || h.pop >= 60);
        if (i >= 0) s += `，大概${(local.getUTCHours() + i + 1) % 24}点左右可能会下雨`;
      }
      if (wx.hi != null && wx.lo != null && wx.hi - wx.lo >= 10) s += "，早晚温差大";
      if (wx.aqi != null && wx.aqi > 150) s += "，空气质量不太好";
      if (wx.uv != null && wx.uv >= 8) s += "，紫外线很强";
      return `【你知道的现实背景】${s}。这是你本来就知道的情况：平时不用特意提天气；遇到下雨、降温、很热、空气差这类值得在意的变化，可以像真人一样自然地关心一句。想让用户看看天气卡片时，可以用「查询天气」。`;
    }

    // 组装提示词的那一刻注入（单聊）；很轻，只拼一段字符串
    ctx.hooks.transform("prompt.system", (p) => {
      if (!p || p.isGroup) return p;
      if (wx && Date.now() - wx.at > REFRESH_MS) refresh(false);   // 过期就后台刷新，这一轮先用旧的
      const hint = buildHint(p.characterId);
      if (hint) p.hint = (p.hint ? p.hint + "\n" : "") + hint;
      return p;
    });

    ctx.hooks.on("app.ready", () => refresh(true));
    ctx.hooks.on("session.opened", () => refresh(false));
    ctx.system.timers.setInterval(() => refresh(false), REFRESH_MS);
    ctx.system.timers.setTimeout(() => refresh(true), 1500);
  },
};
