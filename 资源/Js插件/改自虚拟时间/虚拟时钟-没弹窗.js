export default {
  manifest: {
    id: "virtual-clock",
    name: "虚拟时钟",
    apiVersion: 1,
    version: "7.1.0",
    author: "小坊",
    description:
      "虚拟世界时间系统，时间跟随剧情流转，支持自然语言时间跳跃/悬浮时钟/隐藏真实时间/古代时辰制/农历/节假日感知/时差换算",
    permissions: ["chat.read"],
    settings: [
      { key: "paused", label: "暂停时间", type: "boolean", default: false },
      {
        key: "speed",
        label: "时间流速",
        type: "select",
        default: "1",
        options: [
          { value: "0.5", label: "0.5x" },
          { value: "1", label: "1x" },
          { value: "2", label: "2x" },
          { value: "5", label: "5x" },
          { value: "10", label: "10x" },
          { value: "60", label: "60x" },
        ],
      },
      {
        key: "timeStyle",
        label: "时间风格",
        type: "select",
        default: "modern",
        options: [
          { value: "modern", label: "现代（公历24小时制）" },
          { value: "ancient", label: "古代（农历时辰制）" },
        ],
      },
      {
        key: "eraName",
        label: "年号名称（古代模式）",
        type: "text",
        default: "",
      },
      {
        key: "eraStartNum",
        label: "年号起始年数（古代模式）",
        type: "number",
        default: 1,
      },
      {
        key: "eraBaseYear",
        label: "年号对应公历年（古代模式）",
        type: "number",
        default: 2026,
      },
      {
        key: "charTimezone",
        label: "角色所在时区",
        type: "select",
        default: "0",
        options: [
          { value: "0", label: "北京/上海/台北/新加坡 (UTC+8)" },
          { value: "1", label: "东京/首尔 (UTC+9)" },
          { value: "2", label: "悉尼 (UTC+10)" },
          { value: "4", label: "奥克兰 (UTC+12)" },
          { value: "-8", label: "伦敦 (UTC+0)" },
          { value: "-7", label: "巴黎/柏林/罗马 (UTC+1)" },
          { value: "-6", label: "开罗/雅典 (UTC+2)" },
          { value: "-5", label: "莫斯科/伊斯坦布尔 (UTC+3)" },
          { value: "-3.5", label: "德黑兰 (UTC+4:30)" },
          { value: "-3", label: "迪拜 (UTC+5)" },
          { value: "-2.5", label: "新德里 (UTC+5:30)" },
          { value: "-1", label: "曼谷/河内 (UTC+7)" },
          { value: "-11", label: "夏威夷 (UTC-2)" },
          { value: "-13", label: "纽约/华盛顿 (UTC-5)" },
          { value: "-14", label: "芝加哥/休斯顿 (UTC-6)" },
          { value: "-15", label: "丹佛/凤凰城 (UTC-7)" },
          { value: "-16", label: "洛杉矶/旧金山 (UTC-8)" },
        ],
      },
      {
        key: "jumpMode",
        label: "时间跳转模式",
        type: "select",
        default: "confirm",
        options: [
          { value: "auto", label: "自动跟随角色" },
          { value: "confirm", label: "跳转前确认" },
          { value: "manual", label: "仅手动设定" },
        ],
      },
      {
        key: "jumpThreshold",
        label: "跳转确认阈值",
        type: "select",
        default: "86400000",
        options: [
          { value: "0", label: "始终确认" },
          { value: "600000", label: "超过10分钟" },
          { value: "3600000", label: "超过1小时" },
          { value: "86400000", label: "超过1天" },
          { value: "604800000", label: "超过1周" },
          { value: "2592000000", label: "超过1个月" },
        ],
      },
      {
        key: "timelineCount",
        label: "时间线条数（建议30，上限200）",
        type: "number",
        default: 30,
      },
      {
        key: "showFloating",
        label: "显示悬浮时钟",
        type: "boolean",
        default: true,
      },
      {
        key: "showMsgTime",
        label: "气泡下方显示虚拟时间",
        type: "boolean",
        default: true,
      },
      {
        key: "hideRealTime",
        label: "隐藏真实时间戳",
        type: "boolean",
        default: false,
      },
      {
        key: "showHolidays",
        label: "节假日感知",
        type: "boolean",
        default: true,
      },
    ],
  },

  setup(ctx) {
    var WEEKDAYS = [
      "星期日",
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
      "星期六",
    ];
    var LB = "[",
      RB = "]";
    var tagFormat = LB + "时间:YYYY-MM-DD HH:MM" + RB;
    var tagExample = LB + "时间:" + RB;
    function padN(n) {
      return String(n).padStart(2, "0");
    }

    // ===== 农历 =====
    var LUNAR_INFO = [
      0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0,
      0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540,
      0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50,
      0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0,
      0x0ea50, 0x16a95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
      0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2,
      0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573,
      0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4,
      0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5,
      0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
      0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
      0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58,
      0x05ac0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50,
      0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0,
      0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
      0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260,
      0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0,
      0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0,
      0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370,
      0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0,
      0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0,
      0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50,
      0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0,
      0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520,
      0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
      0x0d520,
    ];
    var LUNAR_MONTH_CN = [
      "正",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
      "十",
      "冬",
      "腊",
    ];
    var LUNAR_DAY_CN = [
      "初一",
      "初二",
      "初三",
      "初四",
      "初五",
      "初六",
      "初七",
      "初八",
      "初九",
      "初十",
      "十一",
      "十二",
      "十三",
      "十四",
      "十五",
      "十六",
      "十七",
      "十八",
      "十九",
      "二十",
      "廿一",
      "廿二",
      "廿三",
      "廿四",
      "廿五",
      "廿六",
      "廿七",
      "廿八",
      "廿九",
      "三十",
    ];
    var LUNAR_NUM_CN = [
      "零",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
      "十",
    ];

    function lunarYearDays(y) {
      var i,
        sum = 348;
      for (i = 0x8000; i > 0x8; i >>= 1)
        sum += LUNAR_INFO[y - 1900] & i ? 1 : 0;
      return sum + lunarLeapDays(y);
    }
    function lunarLeapMonth(y) {
      return LUNAR_INFO[y - 1900] & 0xf;
    }
    function lunarLeapDays(y) {
      if (lunarLeapMonth(y)) return LUNAR_INFO[y - 1900] & 0x10000 ? 30 : 29;
      return 0;
    }
    function lunarMonthDays(y, m) {
      return LUNAR_INFO[y - 1900] & (0x10000 >> m) ? 30 : 29;
    }

    function solarToLunar(sy, sm, sd) {
      if (sy < 1900 || sy > 2100)
        return { year: sy, month: 1, day: 1, leap: false };
      var baseDate = Date.UTC(1900, 0, 31);
      var objDate = Date.UTC(sy, sm - 1, sd);
      var offset = Math.floor((objDate - baseDate) / 86400000);
      var i,
        leap = 0,
        temp = 0,
        ly = 1900;
      for (i = 1900; i < 2101 && offset > 0; i++) {
        temp = lunarYearDays(i);
        offset -= temp;
      }
      if (offset < 0) {
        offset += temp;
        i--;
      }
      ly = i;
      leap = lunarLeapMonth(ly);
      var isLeap = false;
      var lm = 1,
        ld;
      for (i = 1; i < 13 && offset > 0; i++) {
        if (leap > 0 && i === leap + 1 && !isLeap) {
          --i;
          isLeap = true;
          temp = lunarLeapDays(ly);
        } else {
          temp = lunarMonthDays(ly, i);
        }
        if (isLeap && i === leap + 1) isLeap = false;
        offset -= temp;
        if (!isLeap) lm = i;
      }
      if (offset === 0 && leap > 0 && i === leap + 1) {
        isLeap = true;
      }
      if (offset < 0) {
        offset += temp;
        --i;
        if (isLeap) {
          isLeap = true;
          lm = i;
        } else {
          lm = i;
        }
      }
      ld = offset + 1;
      return { year: ly, month: lm, day: ld, leap: isLeap };
    }

    function lunarToSolar(ly, lm, ld, isLeap) {
      if (ly < 1900 || ly > 2100) return { year: ly, month: lm, day: ld };
      var baseDate = Date.UTC(1900, 0, 31);
      var offset = 0;
      for (var i = 1900; i < ly; i++) offset += lunarYearDays(i);
      var leap = lunarLeapMonth(ly);
      var leapProcessed = false;
      for (var j = 1; j < lm; j++) {
        if (leap > 0 && j === leap && !leapProcessed) {
          offset += lunarLeapDays(ly);
          leapProcessed = true;
          --j;
        } else offset += lunarMonthDays(ly, j);
      }
      if (isLeap) offset += lunarLeapDays(ly);
      offset += ld - 1;
      var resultMs = baseDate + offset * 86400000;
      var result = new Date(resultMs);
      return {
        year: result.getUTCFullYear(),
        month: result.getUTCMonth() + 1,
        day: result.getUTCDate(),
      };
    }

    function formatLunarDate(lunar) {
      return (
        (lunar.leap ? "闰" : "") +
        LUNAR_MONTH_CN[lunar.month - 1] +
        "月" +
        LUNAR_DAY_CN[lunar.day - 1]
      );
    }
    function numToCn(n) {
      if (n <= 0) return "元";
      if (n <= 10) return LUNAR_NUM_CN[n];
      if (n < 20) return "十" + (n % 10 ? LUNAR_NUM_CN[n % 10] : "");
      if (n < 100) {
        var t = Math.floor(n / 10),
          r = n % 10;
        return LUNAR_NUM_CN[t] + "十" + (r ? LUNAR_NUM_CN[r] : "");
      }
      var s = "",
        v = n;
      if (v >= 1000) {
        s += LUNAR_NUM_CN[Math.floor(v / 1000)] + "千";
        v %= 1000;
      }
      if (v >= 100) {
        s += LUNAR_NUM_CN[Math.floor(v / 100)] + "百";
        v %= 100;
      }
      if (v >= 10) {
        s += LUNAR_NUM_CN[Math.floor(v / 10)] + "十";
        v %= 10;
      }
      if (v > 0) s += LUNAR_NUM_CN[v];
      return s;
    }

    // ===== 时辰 =====
    var SHICHEN_NAMES = [
      "子",
      "丑",
      "寅",
      "卯",
      "辰",
      "巳",
      "午",
      "未",
      "申",
      "酉",
      "戌",
      "亥",
    ];
    var SHICHEN_PERIOD = [
      "深夜",
      "凌晨",
      "凌晨",
      "凌晨",
      "凌晨",
      "清晨",
      "清晨",
      "早晨",
      "早晨",
      "上午",
      "上午",
      "午间",
      "午间",
      "午后",
      "午后",
      "下午",
      "下午",
      "傍晚",
      "傍晚",
      "入夜",
      "入夜",
      "夜间",
      "夜间",
      "深夜",
    ];
    function hourToShichen(h, m) {
      var idx = Math.floor(((h + 1) % 24) / 2);
      var totalMin = ((h + 1) % 2) * 60 + m;
      var ke = Math.floor(totalMin / 15);
      if (ke > 7) ke = 7;
      var keStr = ["初", "一", "二", "三", "四", "五", "六", "七"][ke];
      var geng = "";
      var GENG_CN = ["一", "二", "三", "四", "五"];
      var DIAN_CN = ["一", "二", "三", "四", "五"];
      var nightMin = -1;
      if (h >= 19) nightMin = (h - 19) * 60 + m;
      else if (h < 5) nightMin = (h + 5) * 60 + m;
      if (nightMin >= 0 && nightMin < 600) {
        var gIdx = Math.floor(nightMin / 120);
        if (gIdx > 4) gIdx = 4;
        var dMin = nightMin - gIdx * 120;
        var dIdx = Math.floor(dMin / 24);
        if (dIdx > 4) dIdx = 4;
        geng = " " + GENG_CN[gIdx] + "更" + DIAN_CN[dIdx] + "点";
      }
      return {
        name: SHICHEN_NAMES[idx] + "时",
        ke: keStr + "刻",
        geng: geng,
        period: SHICHEN_PERIOD[h],
      };
    }

    // ===== 节假日 =====
    function nthWeekday(year, month, weekday, n) {
      var d = new Date(year, month - 1, 1);
      var count = 0;
      for (var i = 1; i <= 31; i++) {
        d.setDate(i);
        if (d.getMonth() !== month - 1) break;
        if (d.getDay() === weekday) {
          count++;
          if (count === n) return i;
        }
      }
      return 1;
    }
    function getHolidays(sy, sm, sd) {
      var holidays = [];
      var solarFests = [
        [1, 1, "元旦"],
        [2, 14, "情人节"],
        [3, 8, "妇女节"],
        [3, 12, "植树节"],
        [4, 1, "愚人节"],
        [4, 5, "清明节"],
        [5, 1, "劳动节"],
        [5, 4, "青年节"],
        [6, 1, "儿童节"],
        [7, 1, "建党节"],
        [8, 1, "建军节"],
        [9, 10, "教师节"],
        [10, 1, "国庆节"],
        [10, 31, "万圣夜"],
        [11, 11, "双十一"],
        [12, 24, "平安夜"],
        [12, 25, "圣诞节"],
      ];
      solarFests.push([5, nthWeekday(sy, 5, 0, 2), "母亲节"]);
      solarFests.push([6, nthWeekday(sy, 6, 0, 3), "父亲节"]);
      solarFests.push([11, nthWeekday(sy, 11, 4, 4), "感恩节"]);
      var lunarFests = [
        [1, 1, false, "春节"],
        [1, 15, false, "元宵节"],
        [5, 5, false, "端午节"],
        [7, 7, false, "七夕"],
        [7, 15, false, "中元节"],
        [8, 15, false, "中秋节"],
        [9, 9, false, "重阳节"],
        [12, 30, false, "除夕"],
      ];
      var lastMonthDays = lunarMonthDays(sy, 12);
      if (lastMonthDays === 29) {
        for (var f = 0; f < lunarFests.length; f++) {
          if (lunarFests[f][3] === "除夕") lunarFests[f][1] = 29;
        }
      }
      var now = new Date(sy, sm - 1, sd).getTime();
      for (var i = 0; i < solarFests.length; i++) {
        var ft = new Date(sy, solarFests[i][0] - 1, solarFests[i][1]).getTime();
        var diff = Math.floor((ft - now) / 86400000);
        if (diff >= -1 && diff <= 30)
          holidays.push({ name: solarFests[i][2], diff: diff });
      }
      for (var j = 0; j < lunarFests.length; j++) {
        var sol = lunarToSolar(
          sy,
          lunarFests[j][0],
          lunarFests[j][1],
          lunarFests[j][2]
        );
        var ft2 = new Date(sol.year, sol.month - 1, sol.day).getTime();
        var diff2 = Math.floor((ft2 - now) / 86400000);
        if (diff2 >= -1 && diff2 <= 30)
          holidays.push({ name: lunarFests[j][3], diff: diff2 });
        if (lunarFests[j][3] === "春节" && sm >= 11) {
          var sol2 = lunarToSolar(sy + 1, 1, 1, false);
          var ft3 = new Date(sol2.year, sol2.month - 1, sol2.day).getTime();
          var diff3 = Math.floor((ft3 - now) / 86400000);
          if (diff3 >= 0 && diff3 <= 60)
            holidays.push({ name: "春节", diff: diff3 });
        }
      }
      holidays.sort(function (a, b) {
        return a.diff - b.diff;
      });
      return holidays;
    }
    function formatHolidayHint(holidays) {
      if (!holidays || holidays.length === 0) return "";
      var parts = [];
      for (var i = 0; i < Math.min(holidays.length, 5); i++) {
        var h = holidays[i];
        if (h.diff === 0) parts.push(h.name + "（今天）");
        else if (h.diff === -1) parts.push(h.name + "（昨天）");
        else if (h.diff === 1) parts.push(h.name + "（明天）");
        else parts.push(h.name + "（" + h.diff + "天后）");
      }
      return "丨临近节日：" + parts.join("、");
    }

    // ===== 时差 =====
    function applyTimezone(ts) {
      var offset = parseFloat(ctx.system.settings.get("charTimezone")) || 0;
      if (offset === 0) return ts;
      return ts + offset * 3600000;
    }

    // ===== 星期 / 节假日 跟随现实 =====
    function pickWeekDay(d) {
      if (ctx.system.storage.get("followWeek") === "true") return new Date().getDay();
      return d.getDay();
    }
    function pickHolidayYMD(d) {
      if (ctx.system.storage.get("followHoliday") === "true") {
        var n = new Date();
        return [n.getFullYear(), n.getMonth() + 1, n.getDate()];
      }
      return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    }

    // ===== 格式化 =====
function formatModernFull(d) {
  return (
    d.getFullYear() + "年" + padN(d.getMonth() + 1) + "月" + padN(d.getDate()) + "日 " +
    padN(d.getHours()) + ":" + padN(d.getMinutes()) + ":" + padN(d.getSeconds()) + " " +
    WEEKDAYS[pickWeekDay(d)]
  );
}

    // ===== 修改在这里：第1年显示“元年” =====
    function getEraString(solarYear) {
      var eraName = ctx.system.settings.get("eraName") || "";
      if (!eraName) return "";
      var baseYear =
        parseInt(ctx.system.settings.get("eraBaseYear")) || solarYear;
      var startNum = parseInt(ctx.system.settings.get("eraStartNum")) || 1;
      var currentNum = startNum + (solarYear - baseYear);
      if (currentNum <= 0) currentNum = 1;
      // 第1年显示“元年”
      if (currentNum === 1) return eraName + "元年";
      return eraName + numToCn(currentNum) + "年";
    }
    // ===== 修改结束 =====

    function formatAncientFull(d) {
      var lunar = solarToLunar(d.getFullYear(), d.getMonth() + 1, d.getDate());
      var sc = hourToShichen(d.getHours(), d.getMinutes());
      var eraStr = getEraString(d.getFullYear());
      return (
        eraStr +
        " " +
        formatLunarDate(lunar) +
        " " +
        sc.name +
        sc.ke +
        (sc.geng ? sc.geng : "") +
        "（" +
        sc.period +
        "）"
      );
    }
    function formatFull(ts) {
      var style = ctx.system.settings.get("timeStyle") || "modern";
      var charTs = applyTimezone(ts);
      var d = new Date(charTs);
      if (style === "ancient") return formatAncientFull(d);
      return formatModernFull(d);
    }
    function formatTag(ts) {
      var d = new Date(ts);
      return (
        d.getFullYear() +
        "-" +
        padN(d.getMonth() + 1) +
        "-" +
        padN(d.getDate()) +
        " " +
        padN(d.getHours()) +
        ":" +
        padN(d.getMinutes())
      );
    }
    function formatDisplay(ts) {
      var d = new Date(ts);
      return (
        d.getFullYear() +
        "/" +
        padN(d.getMonth() + 1) +
        "/" +
        padN(d.getDate()) +
        " " +
        padN(d.getHours()) +
        ":" +
        padN(d.getMinutes())
      );
    }
    function formatFloating(ts) {
      var style = ctx.system.settings.get("timeStyle") || "modern";
      var charTs = applyTimezone(ts);
      var d = new Date(charTs);
      if (style === "ancient") {
        var lunar = solarToLunar(
          d.getFullYear(),
          d.getMonth() + 1,
          d.getDate()
        );
        var sc = hourToShichen(d.getHours(), d.getMinutes());
        var eraStr = getEraString(d.getFullYear());
        var parts = [];
        if (eraStr) parts.push(eraStr);
        parts.push(formatLunarDate(lunar));
        parts.push(sc.name + sc.ke + (sc.geng ? sc.geng : ""));
        return parts.join(" ");
      }
      return (
        d.getFullYear() +
        "/" +
        padN(d.getMonth() + 1) +
        "/" +
        padN(d.getDate()) +
        " " +
        padN(d.getHours()) +
        ":" +
        padN(d.getMinutes()) +
        ":" +
        padN(d.getSeconds()) +
        " " +
        WEEKDAYS[pickWeekDay(d)]
      );
    }

    // ===== 状态管理 =====
    function loadState() {
      var raw = ctx.system.storage.get("clockState");
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch (e) {}
      }
      var now = Date.now();
      var s = {
        virtualEpoch: now,
        realEpoch: now,
        paused: false,
        pausedVirtualTime: now,
        speed: 1,
      };
      saveState(s);
      return s;
    }
    function saveState(s) {
      ctx.system.storage.set("clockState", JSON.stringify(s));
    }
function getVirtualNow(s) {
  if (isFollowMode()) return getFollowNow();
  return s.paused
    ? s.pausedVirtualTime
    : s.virtualEpoch + (Date.now() - s.realEpoch) * s.speed;
}
    function isFollowMode() {
  return (
    ctx.system.storage.get("followYear") === "true" ||
    ctx.system.storage.get("followDate") === "true" ||
    ctx.system.storage.get("followTime") === "true"
  );
}
function getFollowNow() {
  var now = new Date();
  var fY = ctx.system.storage.get("followYear") === "true";
  var fD = ctx.system.storage.get("followDate") === "true";
  var fT = ctx.system.storage.get("followTime") === "true";

  var year = fY ? now.getFullYear() : (parseInt(ctx.system.storage.get("customYear")) || now.getFullYear());
  var month = fD ? now.getMonth() : ((parseInt(ctx.system.storage.get("customMonth")) || 1) - 1);
  var day = fD ? now.getDate() : (parseInt(ctx.system.storage.get("customDay")) || 1);
  var hour = fT ? now.getHours() : (parseInt(ctx.system.storage.get("customHour")) || 0);
  var min = fT ? now.getMinutes() : (parseInt(ctx.system.storage.get("customMinute")) || 0);
  var sec = fT ? now.getSeconds() : 0;

  return new Date(year, month, day, hour, min, sec).getTime();
}
    function setVirtualTime(s, ts) {
      s.virtualEpoch = ts;
      s.realEpoch = Date.now();
      if (s.paused) s.pausedVirtualTime = ts;
      saveState(s);
    }

    var TAG_RE =
      /\[时间[:：](\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\]/g;
    var TAG_STRIP_RE = /\s*\[时间[:：][^\]]*\]/g;
    function parseTimeTag(text) {
      var last = null,
        m;
      TAG_RE.lastIndex = 0;
      while ((m = TAG_RE.exec(text)) !== null) {
        var d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
        if (!isNaN(d.getTime())) last = d.getTime();
      }
      return last;
    }
    function stripTimeTag(text) {
      return text.replace(TAG_STRIP_RE, "").trim();
    }
    function stripTrailingTime(text) {
      text = text
        .replace(
          /\n?\s*\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\s+\d{1,2}:\d{1,2}(?::\d{1,2})?\s*$/,
          ""
        )
        .trim();
      text = text.replace(/\n?\s*\d{8,14}\s*$/g, "").trim();
      return text;
    }
    function cnToNum(s) {
      if (!s) return null;
      s = s.trim();
      if (/^\d+$/.test(s)) return parseInt(s);
      var map = {
        零: 0,
        一: 1,
        二: 2,
        两: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        七: 7,
        八: 8,
        九: 9,
        十: 10,
        半: 0.5,
        几: 3,
        数: 3,
      };
      if (s === "半") return 0.5;
      if (s === "十") return 10;
      if (s.length === 1) return map[s] || null;
      if (s[0] === "十") return 10 + (map[s[1]] || 0);
      if (s[s.length - 1] === "十") return (map[s[0]] || 1) * 10;
      var idx = s.indexOf("十");
      if (idx > 0) return (map[s[0]] || 1) * 10 + (map[s[idx + 1]] || 0);
      return map[s[0]] || null;
    }
    function getTimeOfDay(k) {
      if (!k) return null;
      if (/凌晨|深夜/.test(k)) return { h: 3, m: 0 };
      if (/早上?|早晨|清[早晨]/.test(k)) return { h: 8, m: 0 };
      if (/上午/.test(k)) return { h: 10, m: 0 };
      if (/中午|午间|正午/.test(k)) return { h: 12, m: 0 };
      if (/下午|午后/.test(k)) return { h: 15, m: 0 };
      if (/傍晚|黄昏/.test(k)) return { h: 18, m: 0 };
      if (/晚上?|夜[里晚间]?/.test(k)) return { h: 21, m: 0 };
      return null;
    }

    function parseNaturalTimeJump(text, nowTs) {
      var d = new Date(nowTs),
        NUM = "([一二两三四五六七八九十百半几数多\\d]+)";
      var P = [
        {
          re: new RegExp(NUM + "\\s*年\\s*后(?:\\s*的?\\s*(.+?))?$"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(d);
            if (n === 0.5) r.setMonth(r.getMonth() + 6);
            else r.setFullYear(r.getFullYear() + Math.floor(n));
            var t = m[2] ? getTimeOfDay(m[2]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: new RegExp(NUM + "\\s*年\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(d);
            r.setFullYear(r.getFullYear() - Math.floor(n));
            return r.getTime();
          },
        },
        {
          re: /半\s*年\s*后(?:\s*的?\s*(.+?))?$/,
          fn: function (m) {
            var r = new Date(d);
            r.setMonth(r.getMonth() + 6);
            var t = m[1] ? getTimeOfDay(m[1]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: /半\s*年\s*前/,
          fn: function () {
            var r = new Date(d);
            r.setMonth(r.getMonth() - 6);
            return r.getTime();
          },
        },
        {
          re: new RegExp(NUM + "\\s*个?\\s*月\\s*后(?:\\s*的?\\s*(.+?))?$"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(d);
            r.setMonth(r.getMonth() + Math.floor(n));
            var t = m[2] ? getTimeOfDay(m[2]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: new RegExp(NUM + "\\s*个?\\s*月\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(d);
            r.setMonth(r.getMonth() - Math.floor(n));
            return r.getTime();
          },
        },
        {
          re: new RegExp(
            NUM + "\\s*(?:周|星期|礼拜)\\s*后(?:\\s*的?\\s*(.+?))?$"
          ),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(nowTs + Math.floor(n) * 7 * 86400000);
            var t = m[2] ? getTimeOfDay(m[2]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: new RegExp(NUM + "\\s*(?:周|星期|礼拜)\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs - Math.floor(n) * 7 * 86400000;
          },
        },
        {
          re: new RegExp(NUM + "\\s*天\\s*后(?:\\s*的?\\s*(.+?))?$"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            var r = new Date(nowTs + Math.floor(n) * 86400000);
            var t = m[2] ? getTimeOfDay(m[2]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: new RegExp(NUM + "\\s*天\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs - Math.floor(n) * 86400000;
          },
        },
        {
          re: new RegExp(NUM + "\\s*(?:小时|个?\\s*钟头)\\s*后"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs + n * 3600000;
          },
        },
        {
          re: new RegExp(NUM + "\\s*(?:小时|个?\\s*钟头)\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs - n * 3600000;
          },
        },
        {
          re: /半\s*(?:小时|个?\s*钟头)\s*后/,
          fn: function () {
            return nowTs + 1800000;
          },
        },
        {
          re: /半\s*(?:小时|个?\s*钟头)\s*前/,
          fn: function () {
            return nowTs - 1800000;
          },
        },
        {
          re: new RegExp(NUM + "\\s*分钟?\\s*后"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs + n * 60000;
          },
        },
        {
          re: new RegExp(NUM + "\\s*分钟?\\s*前"),
          fn: function (m) {
            var n = cnToNum(m[1]);
            if (!n) return null;
            return nowTs - n * 60000;
          },
        },
        {
          re: /(?:第二天|次日|隔天|翌日)(?:\s*的?\s*(.+?))?$/,
          fn: function (m) {
            var r = new Date(nowTs + 86400000);
            var t = m[1] ? getTimeOfDay(m[1]) : null;
            if (t) r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
        {
          re: /(?:当天|今天)\s*(?:的?\s*)?(.+?)$/,
          fn: function (m) {
            var t = getTimeOfDay(m[1]);
            if (!t) return null;
            var r = new Date(d);
            r.setHours(t.h, t.m, 0, 0);
            return r.getTime();
          },
        },
      ];
      for (var i = 0; i < P.length; i++) {
        var m = text.match(P[i].re);
        if (m) {
          var r = P[i].fn(m);
          if (r) return r;
        }
      }
      return null;
    }

    function syncSettings(s) {
      var p = ctx.system.settings.get("paused");
      var sp = parseFloat(ctx.system.settings.get("speed")) || 1;
      if (p && !s.paused) {
        s.pausedVirtualTime = getVirtualNow(s);
        s.paused = true;
        saveState(s);
      } else if (!p && s.paused) {
        s.virtualEpoch = s.pausedVirtualTime;
        s.realEpoch = Date.now();
        s.paused = false;
        saveState(s);
      }
      if (sp !== s.speed) {
        var nv = getVirtualNow(s);
        s.virtualEpoch = nv;
        s.realEpoch = Date.now();
        s.speed = sp;
        if (s.paused) s.pausedVirtualTime = nv;
        saveState(s);
      }
      return s;
    }

    var state = loadState(), lastAssistantVt = null, currentSessionId = null, currentCharId = null;
var currentIsGroup = false;
    var lastManualPauseToggle = 0;
    ctx.system.settings.onChange(function () {
      if (Date.now() - lastManualPauseToggle < 500) return;
      state = syncSettings(state);
      refreshPrompt();
      updateFloating();
      updatePanelTime();
      applyHideRealTime();
    });

    function isCharEnabled(charId) {
      if (!charId) return false;
      if (ctx.system.storage.get("vc_all_enabled") === "true") return true;
      return (
        ctx.data.variables.get("vc_enabled", "character", charId) === "true"
      );
    }
    function isGroupEnabled(sessionId) {
      if (!sessionId) return false;
      return ctx.system.storage.get("vc_group_" + sessionId) === "true";
    }
    function getGroupList() {
      try {
        return ctx.data.sessions.list().filter(function(s) { return s.isGroup; });
      } catch(e) { return []; }
    }
    function isCurrentCharEnabled(sessionId) {
      var sid = sessionId || currentSessionId;
      if (sid) return isSessionEnabled(sid);
      if (currentIsGroup) return isGroupEnabled(currentSessionId);
      return isCharEnabled(currentCharId);
    }

    var hideStyleId = "vc-hide-real-time";
    function applyHideRealTime() {
      var h = ctx.system.settings.get("hideRealTime");
      var e = document.getElementById(hideStyleId);
      if (h && !e) {
        var s = document.createElement("style");
        s.id = hideStyleId;
        s.textContent = ".chat-sys-msg:not(:has(svg)){display:none!important}";
        document.head.appendChild(s);
      } else if (!h && e) {
        e.remove();
      }
    }
    applyHideRealTime();

    ctx.hooks.on("session.opened", function (p) {
    currentSessionId = p.sessionId;
    currentIsGroup = p.isGroup || false;
    try {
        var s = ctx.data.sessions.get(p.sessionId);
        if (s) {
            currentCharId = s.contactId|| [];
        }
    } catch (e) {}
});

    function buildTimelineFromMessages() {
      if (!currentSessionId) return "";
      try {
        var msgs = ctx.data.messages.list(currentSessionId);
        if (!msgs || msgs.length === 0) return "";
        var mx = parseInt(ctx.system.settings.get("timelineCount")) || 30;
        if (mx < 1) mx = 1;
        if (mx > 200) mx = 200;
        var rc = [];
        for (var i = msgs.length - 1; i >= 0 && rc.length < mx; i--) {
          if (msgs[i].role === "user" || msgs[i].role === "assistant")
            rc.unshift(msgs[i]);
        }
        if (rc.length === 0) return "";
        var ln = [];
        for (var j = 0; j < rc.length; j++) {
          var vt =
            rc[j].extra && rc[j].extra.virtualTime
              ? rc[j].extra.virtualTime
              : null;
          if (!vt) continue;
          var w = rc[j].role === "user" ? "用户" : "你";
          var pv = stripTimeTag(rc[j].content || "").substring(0, 40);
          if (!pv) continue;
          ln.push("[" + formatTag(vt) + "] " + w + ": " + pv);
        }
        return ln.length ? "\n\n【最近对话时间线】\n" + ln.join("\n") : "";
      } catch (e) {
        return "";
      }
    }

    function buildTimeHint(ts) {
      var charTs = applyTimezone(ts);
      var d = new Date(charTs);
      var timeStr = formatFull(ts);
  // 计算节假日和星期时，如果月日跟随系统，用系统真实年份
      var hy = pickHolidayYMD(d);
      var holidayStr = "";
      if (ctx.system.settings.get("showHolidays") !== false) {
        holidayStr = formatHolidayHint(getHolidays(hy[0], hy[1], hy[2]));
      }
      var tzOffset = parseFloat(ctx.system.settings.get("charTimezone")) || 0;
      var tzStr = "";
      if (tzOffset !== 0)
        tzStr = "丨角色所在时区：UTC" + (tzOffset >= 0 ? "+" : "") + tzOffset;
      return timeStr + holidayStr + tzStr;
    }

    function refreshPrompt() {
      // 时间注入统一由 prompt.system / llm.request 两个 hook 负责，
      // 这里不再设持久片段，避免重复注入与切会话残留
      ctx.prompts.clear();
    }
    refreshPrompt();

    ctx.hooks.transform(
      "prompt.system",
      function (payload) {
        state = syncSettings(state);
        if (payload.sessionId) currentSessionId = payload.sessionId;
        if (!isCurrentCharEnabled()) {
          var tl = buildTimelineFromMessages();
          if (tl) payload.hint = (payload.hint || "") + tl;
          return payload;
        }
        var t = buildTimeHint(getVirtualNow(state));
        var style = ctx.system.settings.get("timeStyle") || "modern";
        var styleNote = "";
        if (style === "ancient")
          styleNote =
            "\n你处于古代时间体系中，使用农历日期和时辰刻来感知时间，不要使用公历或24小时制表述。";
        payload.hint =
          (payload.hint || "") +
          "\n【虚拟时间系统】当前准确时间：" +
          t +
          styleNote +
          "\n以此时间为准感知日期、星期、时刻、季节和昼夜，忽略其他来源的时间。\n你的回复最末尾必须附带一个格式严格为 " +
          tagFormat +
          " 的标记，例如" +
          tagExample +
          "。整个回复只在最末尾放一个。\n如果剧情发生时间跳跃，标记写跳跃后的时间。没有跳跃则写当前时间。\n不要在正文里提及时间标记，也不要用其他格式输出时间数字串。" +
          buildTimelineFromMessages();
        return payload;
      },
      { priority: 10 }
    );

    // ===== 线下模式兜底：prompt.system 覆盖不到的生成路径，从 llm.request 补注入 =====
    function isSessionEnabled(sessionId) {
      if (!sessionId) return false;
      var sess = null;
      try { sess = ctx.data.sessions.get(sessionId); } catch (e) {}
      if (!sess) return false;
      if (sess.isGroup) return isGroupEnabled(sessionId);
      return isCharEnabled(sess.contactId);
    }

    ctx.hooks.transform(
      "llm.request",
      function (payload) {
        if (!payload.messages || !payload.messages.length) return payload;
        if (!payload.sessionId) return payload;
        currentSessionId = payload.sessionId;
        if (!isSessionEnabled(payload.sessionId)) return payload;

        // prompt.system 已注入过就别重复插
        for (var i = 0; i < payload.messages.length; i++) {
          var c = payload.messages[i].content;
          if (typeof c === "string" && c.indexOf("【虚拟时间系统】") >= 0) return payload;
        }

        state = syncSettings(state);
        var t = buildTimeHint(getVirtualNow(state));
        var style = ctx.system.settings.get("timeStyle") || "modern";
        var styleNote =
          style === "ancient"
            ? "\n你处于古代时间体系中，使用农历日期和时辰刻来感知时间，不要使用公历或24小时制表述。"
            : "";
        var block =
          "【虚拟时间系统】当前准确时间：" + t + styleNote +
          "\n以此时间为准感知日期、星期、时刻、季节和昼夜，忽略其他来源的时间。" +
          "\n你的回复最末尾必须附带一个格式严格为 " + tagFormat + " 的标记，例如" + tagExample +
          "。整个回复只在最末尾放一个。" +
          "\n如果剧情发生时间跳跃，标记写跳跃后的时间。没有跳跃则写当前时间。" +
          "\n不要在正文里提及时间标记，也不要用其他格式输出时间数字串。" +
          buildTimelineFromMessages();

        // 插在最后一条 system 之后；没有 system 就插到最前
        var lastSys = -1;
        for (var j = 0; j < payload.messages.length; j++) {
          if (payload.messages[j].role === "system") lastSys = j;
        }
        payload.messages.splice(lastSys + 1, 0, { role: "system", content: block });
        return payload;
      },
      { priority: 20 }
    );

    ctx.system.timers.setInterval(function () {
      if (Date.now() - lastManualPauseToggle < 500) return;
      state = syncSettings(state);
      refreshPrompt();
    }, 30000);

function handleTimeJump(ts, source) {
      if (isFollowMode()) return;
      var mode = ctx.system.settings.get("jumpMode") || "confirm";
      if (mode === "manual") return;
      var cur = getVirtualNow(state);
      var diff = ts - cur;
      if (diff <= 0) return;
      var threshold = parseInt(ctx.system.settings.get("jumpThreshold"));
      if (isNaN(threshold)) threshold = 86400000;
      if (threshold > 0 && diff < threshold) {
        setVirtualTime(state, ts);
        refreshPrompt();
        updateFloating();
        return;
      }
      if (mode === "auto") {
        setVirtualTime(state, ts);
        refreshPrompt();
        updateFloating();
        ctx.ui.toast("时钟已跳转至 " + formatDisplay(ts));
      } else if (mode === "confirm") {
        ctx.ui.openModal(function (el, modal) {
          el.style.cssText =
            "padding:24px;max-width:320px;text-align:center;background:#fff;border-radius:14px;";
          el.innerHTML =
            '<div style="font-size:16px;color:#1a1a1a;font-weight:600;margin-bottom:14px">检测到时间跳转</div><div style="font-size:13px;color:#999;margin-bottom:8px">来源：' +
            source +
            '</div><div style="font-size:13px;color:#666;margin-bottom:4px">当前：' +
            formatDisplay(cur) +
            '</div><div style="font-size:20px;color:#1a1a1a;font-weight:600;margin-bottom:22px">\u2192 ' +
            formatDisplay(ts) +
            '</div><div style="display:flex;gap:10px;justify-content:center"><button id="vc-jy" style="padding:10px 24px;border:1.5px solid #e8e0ce;border-radius:10px;background:#FDF8F0;color:#555;font-size:14px;font-weight:500;cursor:pointer">确认</button><button id="vc-je" style="padding:10px 20px;border:1.5px solid #ece6d8;border-radius:10px;background:#FEFBF5;color:#555;font-size:14px;font-weight:500;cursor:pointer">修改</button><button id="vc-jn" style="padding:10px 20px;border:1.5px solid #f0e8d8;border-radius:10px;background:#FFFCF5;color:#555;font-size:14px;font-weight:500;cursor:pointer">忽略</button></div><div id="vc-ea" style="display:none;margin-top:18px"><div style="display:flex;gap:6px;align-items:center;justify-content:center;margin-bottom:8px"><input id="vc-jY" type="number" style="width:64px;padding:6px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center"><span style="font-size:12px;color:#aaa">年</span><input id="vc-jM" type="number" style="width:44px;padding:6px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center"><span style="font-size:12px;color:#aaa">月</span><input id="vc-jD" type="number" style="width:44px;padding:6px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center"><span style="font-size:12px;color:#aaa">日</span></div><div style="display:flex;gap:6px;align-items:center;justify-content:center;margin-bottom:12px"><input id="vc-jH" type="number" style="width:44px;padding:6px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center"><span style="font-size:12px;color:#aaa">时</span><input id="vc-jm" type="number" style="width:44px;padding:6px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center"><span style="font-size:12px;color:#aaa">分</span></div><button id="vc-jc" style="padding:8px 24px;border:1.5px solid #e8e0ce;border-radius:8px;background:#FDF8F0;color:#555;font-size:13px;font-weight:500;cursor:pointer">确认</button></div>';
          var jd = new Date(ts);
          el.querySelector("#vc-jY").value = jd.getFullYear();
          el.querySelector("#vc-jM").value = jd.getMonth() + 1;
          el.querySelector("#vc-jD").value = jd.getDate();
          el.querySelector("#vc-jH").value = jd.getHours();
          el.querySelector("#vc-jm").value = jd.getMinutes();
          el.querySelector("#vc-jy").onclick = function () {
            setVirtualTime(state, ts);
            refreshPrompt();
            updateFloating();
            ctx.ui.toast("已跳转至 " + formatDisplay(ts));
            modal.close();
          };
          el.querySelector("#vc-je").onclick = function () {
            el.querySelector("#vc-ea").style.display = "block";
          };
          el.querySelector("#vc-jc").onclick = function () {
            var c = new Date(
              +el.querySelector("#vc-jY").value || 2025,
              (+el.querySelector("#vc-jM").value || 1) - 1,
              +el.querySelector("#vc-jD").value || 1,
              +el.querySelector("#vc-jH").value || 0,
              +el.querySelector("#vc-jm").value || 0
            ).getTime();
            if (isNaN(c)) {
              ctx.ui.toast("无效时间");
              return;
            }
            setVirtualTime(state, c);
            refreshPrompt();
            updateFloating();
            ctx.ui.toast("已跳转至 " + formatDisplay(c));
            modal.close();
          };
          el.querySelector("#vc-jn").onclick = function () {
            modal.close();
          };
        });
      }
    }

    ctx.hooks.transform("user.beforeSend", function (payload) {
      if (payload.sessionId) currentSessionId = payload.sessionId;
      if (!isCurrentCharEnabled(payload.sessionId)) return payload;
      state = syncSettings(state);
      var tp = parseTimeTag(payload.text);
      if (tp) {
        handleTimeJump(tp, "用户消息");
        payload.text = stripTimeTag(payload.text);
        return payload;
      }
      var nj = parseNaturalTimeJump(payload.text, getVirtualNow(state));
      if (nj)
        handleTimeJump(nj, "用户「" + payload.text.substring(0, 15) + "」");
      payload.text = stripTimeTag(payload.text);
      return payload;
    });

    ctx.hooks.transform("llm.response", function (payload) {
      if (!payload.text) return payload;
      if (!isCurrentCharEnabled(payload.sessionId)) return payload;
      var parsed = parseTimeTag(payload.text);
      var cur = getVirtualNow(state);
      if (parsed) {
        if (parsed > cur) {
          lastAssistantVt = parsed;
          handleTimeJump(parsed, "角色回复");
        } else {
          lastAssistantVt = cur;
        }
      } else {
        var nj = parseNaturalTimeJump(payload.text, cur);
        if (nj && nj > cur) {
          lastAssistantVt = nj;
          handleTimeJump(nj, "角色回复");
        } else {
          lastAssistantVt = cur;
        }
      }
      payload.text = stripTimeTag(payload.text);
      payload.text = stripTrailingTime(payload.text);
      return payload;
    });

    ctx.hooks.transform("message.beforePersist", function (payload) {
      if (!payload.message) return payload;
      var role = payload.message.role;
      if (role !== "user" && role !== "assistant") return payload;
      if (!isCurrentCharEnabled(payload.message.sessionId)) return payload;
      if (!payload.message.extra) payload.message.extra = {};
      payload.message.extra.virtualTime =
        role === "assistant"
          ? lastAssistantVt || getVirtualNow(state)
          : getVirtualNow(state);
      return payload;
    });

    ctx.ui.slot("message.footer", function (el, props) {
      if (ctx.system.settings.get("showMsgTime") === false) return;
      if (!props.message) return;
      if (props.message.role !== "user" && props.message.role !== "assistant")
        return;
      var vt = props.message.extra && props.message.extra.virtualTime;
      if (!vt) return;
      el.textContent = "\ud83d\udd50 " + formatDisplay(vt);
      el.style.cssText =
        "font-size:10px;color:rgba(150,150,200,.5);margin-top:2px;";
    });
    // ===== 悬浮时钟 + 面板 =====
    ctx.ui.injectCSS(
      "#vc-float{position:fixed;z-index:9999;padding:4px 12px;border-radius:16px;font-size:11px;color:rgba(200,200,255,.8);background:rgba(20,20,40,.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(120,120,255,.15);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;font-variant-numeric:tabular-nums;letter-spacing:.5px;white-space:nowrap;box-shadow:0 2px 12px rgba(0,0,0,.3)}#vc-float:active{cursor:grabbing;opacity:.9}" +
        "#vc-panel-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.3);display:none;align-items:center;justify-content:center}#vc-panel-overlay.vc-open{display:flex}" +
        "#vc-panel{background:#fff;border-radius:14px;padding:20px;width:min(320px,calc(100vw - 40px));max-height:80vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.15)}" +
        ".vc-qb{padding:6px 12px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#555;font-size:12px;cursor:pointer;white-space:nowrap}.vc-qb:active{background:#f0f0f0}" +
        ".vc-sw{width:40px;height:22px;min-width:40px;border-radius:11px;position:relative;cursor:pointer;transition:background 0.2s}.vc-sw>div{width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)}"
    );

    var floatEl = null,
      floatTimer = null,
      panelOverlay = null;
    function getCharList() {
      try {
        return ctx.data.characters.list();
      } catch (e) {
        return [];
      }
    }
    function buildPanelCharHtml() {
      var chars = getCharList(),
        html = "";
      for (var i = 0; i < chars.length; i++) {
        var cid = chars[i].id,
          cn = chars[i].name || cid,
          on = isCharEnabled(cid);
        html +=
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #f5f5f5"><span style="font-size:12px;color:#444;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          cn +
          '</span><div class="vc-sw vc-p-csw" data-cid="' +
          cid +
          '" style="background:' +
          (on ? "#34C759" : "#ccc") +
          '"><div style="left:' +
          (on ? "20px" : "2px") +
          '"></div></div></div>';
      }
      return html;
    }
    function panelCharCount() {
      var chars = getCharList(),
        c = 0;
      for (var i = 0; i < chars.length; i++) {
        if (isCharEnabled(chars[i].id)) c++;
      }
      return "已启用 " + c + "/" + chars.length;
    }

    function createPanel() {
      if (panelOverlay) return;
      panelOverlay = document.createElement("div");
      panelOverlay.id = "vc-panel-overlay";

      var panelHtml = '<div id="vc-panel">';
      panelHtml +=
        '<div style="font-size:15px;color:#1a1a1a;font-weight:600;margin-bottom:14px;text-align:center">虚拟时钟</div>';
      panelHtml +=
        '<div id="vc-panel-time" style="font-size:13px;color:#666;text-align:center;margin-bottom:6px"></div>';
      panelHtml +=
        '<div id="vc-panel-holiday" style="font-size:11px;color:#e67e22;text-align:center;margin-bottom:16px"></div>';
            panelHtml +=
        '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px"><button id="vc-p-pause" class="vc-qb" style="flex:1">\u23f8 暂停</button><button id="vc-p-reset" class="vc-qb" style="flex:1">\ud83d\udd04 重置为现在</button><button id="vc-p-repos" class="vc-qb" style="flex:1">\ud83d\udccd 复位悬浮岛</button></div>';
      // 时间风格
      panelHtml +=
        '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">时间风格</div>';
      panelHtml +=
        '<div style="margin-bottom:16px"><select id="vc-p-style" style="width:100%;padding:8px 10px;border:1px solid #f0f0f0;border-radius:10px;background:#fefefe;color:#444;font-size:12px;outline:none">';
      panelHtml +=
        '<option value="modern">现代（公历）</option><option value="ancient">古代（农历时辰）</option></select></div>';
      // 角色时区
      panelHtml +=
        '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">角色时区</div>';
      panelHtml +=
        '<div style="margin-bottom:12px"><select id="vc-p-tz" style="width:100%;padding:8px 10px;border:1px solid #f0f0f0;border-radius:10px;background:#fefefe;color:#444;font-size:12px;outline:none">';
      panelHtml +=
        '<option value="0">北京/上海/台北/新加坡</option><option value="1">东京/首尔</option><option value="2">悉尼</option><option value="4">奥克兰</option>';
      panelHtml +=
        '<option value="-8">伦敦</option><option value="-7">巴黎/柏林/罗马</option><option value="-6">开罗/雅典</option><option value="-5">莫斯科/伊斯坦布尔</option>';
      panelHtml +=
        '<option value="-3.5">德黑兰</option><option value="-3">迪拜</option><option value="-2.5">新德里</option><option value="-1">曼谷/河内</option>';
      panelHtml +=
        '<option value="-11">夏威夷</option><option value="-13">纽约/华盛顿</option><option value="-14">芝加哥/休斯顿</option><option value="-15">丹佛/凤凰城</option><option value="-16">洛杉矶/旧金山</option>';
      panelHtml += "</select></div>";
      panelHtml +=
        '<div style="height:1px;background:#f0f0f0;margin:12px 0"></div>';
      panelHtml +=
        '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">角色 / 群聊开关</div>';
      panelHtml +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #f0f0f0;border-radius:10px;background:#fefefe;margin-bottom:8px"><span style="font-size:12px;color:#555;font-weight:500">全部角色启用</span><div id="vc-p-all" class="vc-sw" style="background:#ccc"><div style="left:2px"></div></div></div>';
      panelHtml +=
        '<div style="margin-bottom:12px">' +
        '<div style="display:flex;gap:6px;margin-bottom:6px">' +
        '<button id="vc-p-tab-char" style="flex:1;padding:7px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:12px;font-weight:600;cursor:pointer">角色</button>' +
        '<button id="vc-p-tab-group" style="flex:1;padding:7px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:12px;font-weight:500;cursor:pointer">群聊</button>' +
        '</div>' +
        '<div id="vc-p-char-count" style="font-size:11px;color:#aaa;margin-bottom:4px;text-align:right"></div>' +
        '<div id="vc-p-char-list" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;background:#fefefe"></div>' +
        '<div id="vc-p-group-list" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;background:#fefefe;display:none"></div>' +
        '</div>';
      panelHtml +=
        '<div style="height:1px;background:#f0f0f0;margin:12px 0"></div>';
      // 快捷跳转
      panelHtml +=
        '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">快捷跳转</div>';
      panelHtml +=
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">';
      panelHtml +=
        '<button class="vc-qb vc-pq" data-ms="900000">+15分钟</button><button class="vc-qb vc-pq" data-ms="1800000">+30分钟</button><button class="vc-qb vc-pq" data-ms="3600000">+1小时</button>';
      panelHtml +=
        '<button class="vc-qb vc-pq" data-ms="10800000">+3小时</button><button class="vc-qb vc-pq" data-ms="86400000">+1天</button><button class="vc-qb vc-pq" data-ms="259200000">+3天</button><button class="vc-qb vc-pq" data-ms="604800000">+1周</button>';
      panelHtml +=
        '<button class="vc-qb vc-pq" data-months="1">+1个月</button><button class="vc-qb vc-pq" data-months="6">+半年</button><button class="vc-qb vc-pq" data-months="12">+1年</button></div>';
      panelHtml +=
        '<div style="height:1px;background:#f0f0f0;margin:12px 0"></div>';
      // 设定时间
      // 跟随系统开关
panelHtml += '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">跟随系统时间</div>';
panelHtml += '<div style="margin-bottom:16px">';
var _fItems = [
  ["followYear", "年份跟随系统"],
  ["followDate", "月份日期跟随系统"],
  ["followTime", "时间跟随系统"],
  ["followWeek", "星期跟随系统"],
  ["followHoliday", "节假日跟随系统"]
];
for (var _fi = 0; _fi < _fItems.length; _fi++) {
  var _fk = _fItems[_fi][0], _fl = _fItems[_fi][1];
  var _fon = ctx.system.storage.get(_fk) === "true";
  panelHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #f5f5f5"><span style="font-size:12px;color:#444">' + _fl + '</span><div class="vc-sw vc-follow-sw" data-fkey="' + _fk + '" style="background:' + (_fon ? "#34C759" : "#ccc") + '"><div style="left:' + (_fon ? "20px" : "2px") + '"></div></div></div>';
}
panelHtml += '</div>';
panelHtml += '<div style="height:1px;background:#f0f0f0;margin:12px 0"></div>';
panelHtml +=
  '<div style="font-size:13px;color:#555;margin-bottom:10px;font-weight:500">设定时间</div>';
      panelHtml +=
        '<div style="display:flex;align-items:center;gap:4px;margin-bottom:8px;flex-wrap:wrap"><input id="vc-pY" type="number" style="width:60px;padding:5px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;color:#333;font-size:13px;text-align:center"><span style="font-size:11px;color:#aaa">年</span><input id="vc-pM" type="number" style="width:42px;padding:5px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;color:#333;font-size:13px;text-align:center"><span style="font-size:11px;color:#aaa">月</span><input id="vc-pD" type="number" style="width:42px;padding:5px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;color:#333;font-size:13px;text-align:center"><span style="font-size:11px;color:#aaa">日</span></div>';
      panelHtml +=
        '<div style="display:flex;align-items:center;gap:4px;margin-bottom:12px"><input id="vc-pH" type="number" style="width:42px;padding:5px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;color:#333;font-size:13px;text-align:center"><span style="font-size:11px;color:#aaa">时</span><input id="vc-pm" type="number" style="width:42px;padding:5px;border:1px solid #e5e5e5;border-radius:6px;background:#fafafa;color:#333;font-size:13px;text-align:center"><span style="font-size:11px;color:#aaa">分</span></div>';
      panelHtml +=
        '<div style="display:flex;gap:8px"><button id="vc-p-set" class="vc-qb" style="flex:1;padding:10px;background:#34C759;color:#fff;border:none;font-size:14px;font-weight:500;border-radius:10px">确认设定</button><button id="vc-p-cancel" class="vc-qb" style="flex:1;padding:10px;background:#fff;color:#777;border:1px solid #ddd;font-size:14px;border-radius:10px">取消</button></div>';
      panelHtml += "</div>";

      panelOverlay.innerHTML = panelHtml;
      document.body.appendChild(panelOverlay);

      panelOverlay.addEventListener("click", function (e) {
        if (e.target === panelOverlay) closePanel();
      });
      panelOverlay
        .querySelector("#vc-p-cancel")
        .addEventListener("click", function () {
          closePanel();
        });

      // 时间风格下拉框
      var pStyleSel = panelOverlay.querySelector("#vc-p-style");
      pStyleSel.value = ctx.system.settings.get("timeStyle") || "modern";
      pStyleSel.addEventListener("change", function () {
        ctx.system.settings.set("timeStyle", this.value);
        refreshPrompt();
        updateFloating();
        updatePanelTime();
        ctx.ui.toast(
          this.value === "ancient" ? "已切换为古代时辰制" : "已切换为现代公历制"
        );
      });

      // 时区下拉框
      var pTzSel = panelOverlay.querySelector("#vc-p-tz");
      pTzSel.value = ctx.system.settings.get("charTimezone") || "0";
      pTzSel.addEventListener("change", function () {
        ctx.system.settings.set("charTimezone", this.value);
        refreshPrompt();
        updateFloating();
        updatePanelTime();
        ctx.ui.toast("时区已切换");
      });

      // 暂停
      panelOverlay
        .querySelector("#vc-p-pause")
        .addEventListener("click", function () {
          if (isFollowMode()) { ctx.ui.toast("跟随系统模式下不可用"); return; }
          state = syncSettings(state);
          var newPaused = !state.paused;
          if (newPaused) {
            state.pausedVirtualTime = getVirtualNow(state);
            state.paused = true;
          } else {
            state.virtualEpoch = state.pausedVirtualTime;
            state.realEpoch = Date.now();
            state.paused = false;
          }
          saveState(state);
          lastManualPauseToggle = Date.now();
          ctx.system.settings.set("paused", newPaused);
          refreshPrompt();
          updateFloating();
          updatePanelTime();
          this.textContent = state.paused ? "\u25b6 继续" : "\u23f8 暂停";
        });

      // 重置
      panelOverlay
        .querySelector("#vc-p-reset")
        .addEventListener("click", function () {
          if (isFollowMode()) { ctx.ui.toast("跟随系统模式下不可用"); return; }
          var n = Date.now();
          setVirtualTime(state, n);
          refreshPrompt();
          updateFloating();
          updatePanelInputs();
          updatePanelTime();
          ctx.ui.toast("已重置为当前真实时间");
        });

      // 悬浮岛复位
panelOverlay.querySelector("#vc-p-repos").addEventListener("click", function() {
        ctx.system.storage.remove("floatPos");
        if (floatEl) {
          floatEl.style.top = "max(48px, calc(env(safe-area-inset-top, 0px) + 12px))";
          floatEl.style.left = "50%";
          floatEl.style.transform = "translateX(-50%)";
        }
        ctx.ui.toast("已复位到顶部居中");
      });

      // 全选
      var pAll = panelOverlay.querySelector("#vc-p-all");
      pAll.addEventListener("click", function () {
        var on = ctx.system.storage.get("vc_all_enabled") === "true";
        var nv = !on;
        ctx.system.storage.set("vc_all_enabled", nv ? "true" : "false");
        var chars = getCharList();
        for (var a = 0; a < chars.length; a++) {
          ctx.data.variables.set(
            "vc_enabled",
            nv ? "true" : "false",
            "character",
            chars[a].id
          );
        }
        pAll.style.background = nv ? "#34C759" : "#ccc";
        pAll.firstChild.style.left = nv ? "20px" : "2px";
        refreshPanelCharList();
        refreshPrompt();
        ctx.ui.toast(nv ? "已启用全部角色虚拟时间" : "已关闭全部角色虚拟时间");
      });

      // 角色/群聊 tab 切换（悬浮面板）
      var pTabChar = panelOverlay.querySelector("#vc-p-tab-char");
      var pTabGroup = panelOverlay.querySelector("#vc-p-tab-group");
      var pCharList = panelOverlay.querySelector("#vc-p-char-list");
      var pGroupListEl = panelOverlay.querySelector("#vc-p-group-list");
      function setPanelTab(tab) {
        var isChar = tab === "char";
        pCharList.style.display = isChar ? "block" : "none";
        pGroupListEl.style.display = isChar ? "none" : "block";
        pTabChar.style.cssText = isChar
          ? "flex:1;padding:7px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:12px;font-weight:600;cursor:pointer"
          : "flex:1;padding:7px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:12px;font-weight:500;cursor:pointer";
        pTabGroup.style.cssText = isChar
          ? "flex:1;padding:7px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:12px;font-weight:500;cursor:pointer"
          : "flex:1;padding:7px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:12px;font-weight:600;cursor:pointer";
      }
      pTabChar.addEventListener("click", function() { setPanelTab("char"); });
      pTabGroup.addEventListener("click", function() { setPanelTab("group"); refreshPanelGroupList(); });

      // 快捷跳转
      var pqBtns = panelOverlay.querySelectorAll(".vc-pq");
      for (var q = 0; q < pqBtns.length; q++) {
        pqBtns[q].addEventListener("click", function () {
          if (isFollowMode()) { ctx.ui.toast("跟随系统模式下不可用"); return; }
          var newTime,
            months = this.getAttribute("data-months");
          if (months) {
            var nd = new Date(getVirtualNow(state));
            nd.setMonth(nd.getMonth() + parseInt(months));
            newTime = nd.getTime();
          } else {
            var ms = parseInt(this.getAttribute("data-ms"));
            if (isNaN(ms)) return;
            newTime = getVirtualNow(state) + ms;
          }
          setVirtualTime(state, newTime);
          refreshPrompt();
          updateFloating();
          updatePanelInputs();
          updatePanelTime();
          ctx.ui.toast("已跳转至 " + formatDisplay(newTime));
        });
      }

      // 跟随开关事件
      var followSws = panelOverlay.querySelectorAll(".vc-follow-sw");
      for (var fi = 0; fi < followSws.length; fi++) {
        followSws[fi].addEventListener("click", function () {
          var fkey = this.getAttribute("data-fkey");
          var cur = ctx.system.storage.get(fkey) === "true";
          ctx.system.storage.set(fkey, cur ? "false" : "true");
          var on = !cur;
          this.style.background = on ? "#34C759" : "#ccc";
          this.firstChild.style.left = on ? "20px" : "2px";
          if (!on) {
            var now = new Date();
            if (fkey === "followYear") ctx.system.storage.set("customYear", String(now.getFullYear()));
            if (fkey === "followDate") {
              ctx.system.storage.set("customMonth", String(now.getMonth() + 1));
              ctx.system.storage.set("customDay", String(now.getDate()));
            }
            if (fkey === "followTime") {
              ctx.system.storage.set("customHour", String(now.getHours()));
              ctx.system.storage.set("customMinute", String(now.getMinutes()));
            }
          }
          refreshPrompt();
          updateFloating();
          updatePanelTime();
          updatePanelInputs();
          updatePanelInputDisabled();
        });
      }

      // 确认设定
      panelOverlay
        .querySelector("#vc-p-set")
        .addEventListener("click", function () {
    var pe = panelOverlay;
    var fY = ctx.system.storage.get("followYear") === "true";
    var fD = ctx.system.storage.get("followDate") === "true";
    var fT = ctx.system.storage.get("followTime") === "true";
    // 存自定义值
    if (!fY) ctx.system.storage.set("customYear", pe.querySelector("#vc-pY").value);
    if (!fD) {
      ctx.system.storage.set("customMonth", pe.querySelector("#vc-pM").value);
      ctx.system.storage.set("customDay", pe.querySelector("#vc-pD").value);
    }
    if (!fT) {
      ctx.system.storage.set("customHour", pe.querySelector("#vc-pH").value);
      ctx.system.storage.set("customMinute", pe.querySelector("#vc-pm").value);
    }
    if (isFollowMode()) {
      refreshPrompt();
      updateFloating();
      updatePanelTime();
      ctx.ui.toast("自定义值已保存");
      closePanel();
      return;
    }
    var t = new Date(
      +pe.querySelector("#vc-pY").value || 2025,
      (+pe.querySelector("#vc-pM").value || 1) - 1,
      +pe.querySelector("#vc-pD").value || 1,
      +pe.querySelector("#vc-pH").value || 0,
      +pe.querySelector("#vc-pm").value || 0
    ).getTime();
          if (isNaN(t)) {
            ctx.ui.toast("无效日期时间");
            return;
          }
          setVirtualTime(state, t);
          refreshPrompt();
          updateFloating();
          updatePanelTime();
          ctx.ui.toast("虚拟时间已设定为：" + formatFull(t));
          closePanel();
        });
    }

        function buildPanelGroupHtml() {
      var groups = getGroupList(), html = "";
      if (!groups.length) return '<div style="padding:14px;text-align:center;color:#bbb;font-size:12px">暂无群聊</div>';
      for (var i = 0; i < groups.length; i++) {
        var sid = groups[i].id;
        var sn = groups[i].groupName || groups[i].name || sid;
        var on = isGroupEnabled(sid);
        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #f5f5f5">' +
          '<span style="font-size:12px;color:#444;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + sn + '</span>' +
          '<div class="vc-sw vc-p-gsw" data-gsid="' + sid + '" style="background:' + (on ? "#34C759" : "#ccc") + '">' +
          '<div style="left:' + (on ? "20px" : "2px") + '"></div></div></div>';
      }
      return html;
    }
    function refreshPanelGroupList() {
      if (!panelOverlay) return;
      var el = panelOverlay.querySelector("#vc-p-group-list");
      if (!el) return;
      el.innerHTML = buildPanelGroupHtml();
      var sws = el.querySelectorAll(".vc-p-gsw");
      for (var i = 0; i < sws.length; i++) {
        sws[i].addEventListener("click", function() {
          var sid = this.getAttribute("data-gsid");
          var cur = isGroupEnabled(sid);
          ctx.system.storage.set("vc_group_" + sid, cur ? "false" : "true");
          var on = !cur;
          this.style.background = on ? "#34C759" : "#ccc";
          this.firstChild.style.left = on ? "20px" : "2px";
          refreshPrompt();
          ctx.ui.toast(on ? "已为该群聊启用虚拟时间" : "已关闭该群聊虚拟时间");
        });
      }
    }

    function refreshPanelCharList() {
      if (!panelOverlay) return;
      var listEl = panelOverlay.querySelector("#vc-p-char-list");
      var countEl = panelOverlay.querySelector("#vc-p-char-count");
      if (listEl) listEl.innerHTML = buildPanelCharHtml();
      if (countEl) countEl.textContent = panelCharCount();
      var pAll = panelOverlay.querySelector("#vc-p-all");
      if (pAll) {
        var on = ctx.system.storage.get("vc_all_enabled") === "true";
        pAll.style.background = on ? "#34C759" : "#ccc";
        pAll.firstChild.style.left = on ? "20px" : "2px";
      }
      var sws = panelOverlay.querySelectorAll(".vc-p-csw");
      for (var i = 0; i < sws.length; i++) {
        sws[i].addEventListener("click", function () {
          var cid = this.getAttribute("data-cid");
          var cur =
            ctx.data.variables.get("vc_enabled", "character", cid) === "true";
          ctx.data.variables.set(
            "vc_enabled",
            cur ? "false" : "true",
            "character",
            cid
          );
          var on = isCharEnabled(cid);
          this.style.background = on ? "#34C759" : "#ccc";
          this.firstChild.style.left = on ? "20px" : "2px";
          var countEl = panelOverlay.querySelector("#vc-p-char-count");
          if (countEl) countEl.textContent = panelCharCount();
          refreshPrompt();
        });
      }
    }

    function updatePanelTime() {
      if (!panelOverlay) return;
      var vt = getVirtualNow(state);
      var te = panelOverlay.querySelector("#vc-panel-time");
      if (te) {
        var style = ctx.system.settings.get("timeStyle") || "modern";
        var tzOffset = parseFloat(ctx.system.settings.get("charTimezone")) || 0;
        var mainTime = "";
        if (style === "ancient") {
          var charTs = applyTimezone(vt);
          var dm = new Date(charTs);
          mainTime =
            formatFull(vt) +
            '<div style="font-size:11px;color:#aaa;margin-top:4px">' +
            formatModernFull(dm) +
            "</div>";
        } else {
          mainTime = formatFull(vt);
        }
        if (tzOffset !== 0) {
          var userD = new Date(vt);
          var charD = new Date(applyTimezone(vt));
          mainTime +=
            '<div style="font-size:11px;color:#8e8ea0;margin-top:6px;display:flex;justify-content:center;gap:12px"><span>\ud83d\udc64 ' +
            formatModernFull(userD) +
            "</span><span>\ud83c\udfad " +
            formatModernFull(charD) +
            "</span></div>";
        }
        te.innerHTML = mainTime;
      }
      var he = panelOverlay.querySelector("#vc-panel-holiday");
      if (he) {
        if (ctx.system.settings.get("showHolidays") !== false) {
          var d2 = new Date(applyTimezone(vt));
          var hy2 = pickHolidayYMD(d2);
          var holidays = getHolidays(hy2[0], hy2[1], hy2[2]);
          he.textContent = holidays.length
            ? formatHolidayHint(holidays).replace("丨", "")
            : "";
        } else {
          he.textContent = "";
        }
      }
      var pb = panelOverlay.querySelector("#vc-p-pause");
      if (pb) pb.textContent = state.paused ? "\u25b6 继续" : "\u23f8 暂停";
      var pStyleSel = panelOverlay.querySelector("#vc-p-style");
      if (pStyleSel)
        pStyleSel.value = ctx.system.settings.get("timeStyle") || "modern";
      var pTzSel = panelOverlay.querySelector("#vc-p-tz");
      if (pTzSel) pTzSel.value = ctx.system.settings.get("charTimezone") || "0";
    }

function updatePanelInputs() {
  if (!panelOverlay) return;
  var d = new Date(getVirtualNow(state)),
    pe = panelOverlay;
  var fY = ctx.system.storage.get("followYear") === "true";
  var fD = ctx.system.storage.get("followDate") === "true";
  var fT = ctx.system.storage.get("followTime") === "true";
  var y = pe.querySelector("#vc-pY");
  if (y) y.value = fY ? new Date().getFullYear() : (parseInt(ctx.system.storage.get("customYear")) || d.getFullYear());
      var mo = pe.querySelector("#vc-pM");
      if (mo) mo.value = d.getMonth() + 1;
      var da = pe.querySelector("#vc-pD");
      if (da) da.value = d.getDate();
      var h = pe.querySelector("#vc-pH");
      if (h) h.value = d.getHours();
      var mi = pe.querySelector("#vc-pm");
      if (mi) mi.value = d.getMinutes();
    }
    function updatePanelInputDisabled() {
  if (!panelOverlay) return;
  var fY = ctx.system.storage.get("followYear") === "true";
  var fD = ctx.system.storage.get("followDate") === "true";
  var fT = ctx.system.storage.get("followTime") === "true";
  var y = panelOverlay.querySelector("#vc-pY");
  var mo = panelOverlay.querySelector("#vc-pM");
  var da = panelOverlay.querySelector("#vc-pD");
  var h = panelOverlay.querySelector("#vc-pH");
  var mi = panelOverlay.querySelector("#vc-pm");
  if (y) { y.disabled = fY; y.style.opacity = fY ? "0.4" : "1"; }
  if (mo) { mo.disabled = fD; mo.style.opacity = fD ? "0.4" : "1"; }
  if (da) { da.disabled = fD; da.style.opacity = fD ? "0.4" : "1"; }
  if (h) { h.disabled = fT; h.style.opacity = fT ? "0.4" : "1"; }
  if (mi) { mi.disabled = fT; mi.style.opacity = fT ? "0.4" : "1"; }
}

function openPanel() {
  if (!panelOverlay) createPanel();
  refreshPanelCharList();
  refreshPanelGroupList();
  updatePanelTime();
  updatePanelInputs();
  updatePanelInputDisabled();
  panelOverlay.classList.add("vc-open");
}
    function closePanel() {
      if (panelOverlay) panelOverlay.classList.remove("vc-open");
    }
    function removePanel() {
      closePanel();
      if (panelOverlay && panelOverlay.parentNode)
        panelOverlay.parentNode.removeChild(panelOverlay);
      panelOverlay = null;
    }

    function createFloat() {
      if (floatEl) return;
      floatEl = document.createElement("div");
      floatEl.id = "vc-float";
      var pos = ctx.system.storage.get("floatPos");
      if (pos) {
        try {
          pos = JSON.parse(pos);
        } catch (e) {
          pos = null;
        }
      }
      if (pos && pos.top != null) {
        floatEl.style.top = pos.top + "px";
        floatEl.style.left = pos.left + "px";
      } else {
        floatEl.style.top = "max(48px, calc(env(safe-area-inset-top, 0px) + 12px))";
        floatEl.style.left = "50%";
        floatEl.style.transform = "translateX(-50%)";
      }
      document.body.appendChild(floatEl);
      updateFloating();
      if (!floatTimer)
        floatTimer = setInterval(function () {
          if (Date.now() - lastManualPauseToggle < 500) return;
          state = syncSettings(state);
          updateFloating();
          updatePanelTime();
        }, 1000);
      var dragging = false,
        hasMoved = false,
        startX,
        startY,
        origX,
        origY;
      floatEl.addEventListener("mousedown", onS);
      floatEl.addEventListener("touchstart", onS, { passive: false });
      document.addEventListener("mousemove", onM);
      document.addEventListener("touchmove", onM, { passive: false });
      document.addEventListener("mouseup", onE);
      document.addEventListener("touchend", onE);
      function onS(e) {
        dragging = true;
        hasMoved = false;
        var t = e.touches ? e.touches[0] : e;
        var r = floatEl.getBoundingClientRect();
        startX = t.clientX;
        startY = t.clientY;
        origX = r.left;
        origY = r.top;
        // 先把视觉位置固定为绝对坐标，再清 transform，防止复位居中后点击跳位
        floatEl.style.left = r.left + "px";
        floatEl.style.top = r.top + "px";
        floatEl.style.transform = "none";
        e.preventDefault();
      }
      function onM(e) {
        if (!dragging) return;
        var t = e.touches ? e.touches[0] : e;
        var dx = t.clientX - startX,
          dy = t.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
        floatEl.style.left =
          Math.max(
            0,
            Math.min(window.innerWidth - floatEl.offsetWidth, origX + dx)
          ) + "px";
        floatEl.style.top =
          Math.max(
            0,
            Math.min(window.innerHeight - floatEl.offsetHeight, origY + dy)
          ) + "px";
      }
      function onE() {
        if (!dragging) return;
        dragging = false;
var rect = floatEl.getBoundingClientRect();
ctx.system.storage.set(
  "floatPos",
  JSON.stringify({
    top: Math.round(rect.top),
    left: Math.round(rect.left),
  })
);
        if (!hasMoved) openPanel();
      }
    }
    function removeFloat() {
      if (floatEl && floatEl.parentNode)
        floatEl.parentNode.removeChild(floatEl);
      floatEl = null;
      if (floatTimer) {
        clearInterval(floatTimer);
        floatTimer = null;
      }
    }
    function updateFloating() {
      if (ctx.system.settings.get("showFloating") === false) {
        removeFloat();
        return;
      }
      if (!floatEl) createFloat();
      if (!floatEl) return;
      var vt = getVirtualNow(state);
      floatEl.textContent =
        (state.paused ? "\u23f8 " : "\ud83d\udd50 ") +
        formatFloating(vt) +
        (state.speed !== 1 ? " " + state.speed + "x" : "") +
        (state.paused ? " \u23f8" : "");
    }
    if (ctx.system.settings.get("showFloating") !== false) createFloat();

    // ===== 设置区 =====
    var inputStyle =
      "width:56px;padding:6px 4px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center;outline:none;";
    var yearInputStyle =
      "width:68px;padding:6px 4px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#333;font-size:14px;text-align:center;outline:none;";
    var labelStyle =
      "font-size:12px;color:#aaa;margin-left:2px;margin-right:10px;";
    var quickBtnStyle =
      "padding:6px 12px;border:1px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#555;font-size:12px;cursor:pointer;white-space:nowrap;";

    ctx.ui.slot("settings.section", function (el) {
      var chars = getCharList();
      var charListHtml = "";
      for (var i = 0; i < chars.length; i++) {
        var cid = chars[i].id,
          cn = chars[i].name || cid,
          en = isCharEnabled(cid);
        charListHtml +=
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #f5f5f5"><span style="font-size:13px;color:#444;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          cn +
          '</span><div class="vc-char-sw" data-cid="' +
          cid +
          '" style="width:40px;height:22px;min-width:40px;border-radius:11px;background:' +
          (en ? "#34C759" : "#ccc") +
          ';position:relative;cursor:pointer;transition:background 0.2s;margin-left:12px"><div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' +
          (en ? "20px" : "2px") +
          ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div></div></div>';
      }
      var allEnabled = ctx.system.storage.get("vc_all_enabled") === "true";
      el.innerHTML =
'<div style="padding:16px 0"><div style="font-size:14px;color:#555;margin-bottom:14px;font-weight:500">角色 / 群聊开关</div><div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:10px;border:1px solid #f0f0f0;border-radius:10px;background:#fefefe"><span style="font-size:13px;color:#555;font-weight:500">全部角色启用</span><div id="vc-all-toggle" style="width:40px;height:22px;min-width:40px;border-radius:11px;background:' +
        (allEnabled ? "#34C759" : "#ccc") +
        ';position:relative;cursor:pointer;transition:background 0.2s"><div id="vc-all-knob" style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' +
        (allEnabled ? "20px" : "2px") +
        ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div></div></div><div style="margin-bottom:8px;display:flex;gap:6px"><button id="vc-set-tab-char" style="flex:1;padding:8px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:13px;font-weight:600;cursor:pointer">角色</button><button id="vc-set-tab-group" style="flex:1;padding:8px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:13px;font-weight:500;cursor:pointer">群聊</button></div><span id="vc-char-count" style="display:block;font-size:12px;color:#aaa;margin-bottom:4px;text-align:right"></span><div id="vc-char-list" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;background:#fefefe;margin-bottom:4px">' +
        (charListHtml ||
          '<div style="padding:16px;text-align:center;color:#bbb;font-size:13px">暂无角色</div>') +
        '</div><div id="vc-group-list" style="border:1px solid #f0f0f0;border-radius:10px;overflow:hidden;background:#fefefe;display:none;margin-bottom:4px"></div></div><div style="height:1px;background:#f0f0f0;margin:16px 0"></div><button id="vc-reposition" style="width:100%;padding:10px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa;color:#555;font-size:13px;cursor:pointer;margin-bottom:16px">\ud83d\udccd 复位悬浮岛到顶部居中</button><div style="font-size:14px;color:#555;margin-bottom:10px;font-weight:500">快捷跳转</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"><button class="vc-quick" data-ms="900000" style="' +
        quickBtnStyle +
        '">+15分钟</button><button class="vc-quick" data-ms="1800000" style="' +
        quickBtnStyle +
        '">+30分钟</button><button class="vc-quick" data-ms="3600000" style="' +
        quickBtnStyle +
        '">+1小时</button><button class="vc-quick" data-ms="10800000" style="' +
        quickBtnStyle +
        '">+3小时</button><button class="vc-quick" data-ms="86400000" style="' +
        quickBtnStyle +
        '">+1天</button><button class="vc-quick" data-ms="259200000" style="' +
        quickBtnStyle +
        '">+3天</button><button class="vc-quick" data-ms="604800000" style="' +
        quickBtnStyle +
        '">+1周</button><button class="vc-quick" data-months="1" style="' +
        quickBtnStyle +
        '">+1个月</button><button class="vc-quick" data-months="6" style="' +
        quickBtnStyle +
        '">+半年</button><button class="vc-quick" data-months="12" style="' +
        quickBtnStyle +
'">+1年</button></div><div style="height:1px;background:#f0f0f0;margin:16px 0"></div>' +
'<div style="font-size:14px;color:#555;margin-bottom:10px;font-weight:500">跟随系统时间</div>' +
'<div style="margin-bottom:16px">' +
(function(){
  var items = [["followYear","年份跟随系统"],["followDate","月份日期跟随系统"],["followTime","时间跟随系统"],["followWeek","星期跟随系统"],["followHoliday","节假日跟随系统"]];
  var h = "";
  for (var i = 0; i < items.length; i++) {
    var k = items[i][0], l = items[i][1], on = ctx.system.storage.get(k) === "true";
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #f5f5f5"><span style="font-size:13px;color:#444">' + l + '</span><div class="vc-follow-set-sw" data-fkey="' + k + '" style="width:40px;height:22px;min-width:40px;border-radius:11px;background:' + (on ? "#34C759" : "#ccc") + ';position:relative;cursor:pointer;transition:background 0.2s"><div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' + (on ? "20px" : "2px") + ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div></div></div>';
  }
  return h;
})() +
'</div><div style="height:1px;background:#f0f0f0;margin:16px 0"></div>' +
'<div style="font-size:14px;color:#555;margin-bottom:14px;font-weight:500">设定虚拟时间</div><div style="display:flex;align-items:center;margin-bottom:10px;flex-wrap:wrap"><input id="vc-year" type="number" placeholder="年" style="' +
        yearInputStyle +
        '"><span style="' +
        labelStyle +
        '">年</span><input id="vc-month" type="number" placeholder="月" min="1" max="12" style="' +
        inputStyle +
        '"><span style="' +
        labelStyle +
        '">月</span><input id="vc-day" type="number" placeholder="日" min="1" max="31" style="' +
        inputStyle +
        '"><span style="' +
        labelStyle +
        '">日</span></div><div style="display:flex;align-items:center;margin-bottom:14px"><input id="vc-hour" type="number" placeholder="时" min="0" max="23" style="' +
        inputStyle +
        '"><span style="' +
        labelStyle +
        '">时</span><input id="vc-min" type="number" placeholder="分" min="0" max="59" style="' +
        inputStyle +
        '"><span style="' +
        labelStyle +
        '">分</span></div><div style="display:flex;gap:10px"><button id="vc-set" style="padding:8px 22px;border:none;border-radius:8px;background:#34C759;color:#fff;font-size:13px;cursor:pointer;font-weight:500">确认设定</button><button id="vc-now" style="padding:8px 18px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#777;font-size:13px;cursor:pointer">重置为现在</button></div></div>';

      var allToggleEl = el.querySelector("#vc-all-toggle"),
        allKnobEl = el.querySelector("#vc-all-knob");
      function updateAllToggleUI(on) {
        allToggleEl.style.background = on ? "#34C759" : "#ccc";
        allKnobEl.style.left = on ? "20px" : "2px";
      }
      function updateCharCount() {
        var c = 0;
        for (var i = 0; i < chars.length; i++) {
          if (isCharEnabled(chars[i].id)) c++;
        }
        el.querySelector("#vc-char-count").textContent =
          "已启用 " + c + "/" + chars.length;
      }
      updateCharCount();
      function refreshCharListUI() {
        var sw = el.querySelectorAll(".vc-char-sw");
        for (var s = 0; s < sw.length; s++) {
          var cid = sw[s].getAttribute("data-cid");
          var on = isCharEnabled(cid);
          sw[s].style.background = on ? "#34C759" : "#ccc";
          sw[s].firstChild.style.left = on ? "20px" : "2px";
        }
        updateCharCount();
      }

      // 角色/群聊 tab 切换（设置页）
      var setTabChar = el.querySelector("#vc-set-tab-char");
      var setTabGroup = el.querySelector("#vc-set-tab-group");
      var setCharListEl = el.querySelector("#vc-char-list");
      var setGroupListEl = el.querySelector("#vc-group-list");
      function setSettingsTab(tab) {
        var isChar = tab === "char";
        setCharListEl.style.display = isChar ? "block" : "none";
        setGroupListEl.style.display = isChar ? "none" : "block";
        setTabChar.style.cssText = isChar
          ? "flex:1;padding:8px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:13px;font-weight:600;cursor:pointer"
          : "flex:1;padding:8px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:13px;font-weight:500;cursor:pointer";
        setTabGroup.style.cssText = isChar
          ? "flex:1;padding:8px 0;border:1.5px solid #e5e5e5;border-radius:8px;background:#fafafa;color:#888;font-size:13px;font-weight:500;cursor:pointer"
          : "flex:1;padding:8px 0;border:1.5px solid #34C759;border-radius:8px;background:#f0faf3;color:#34C759;font-size:13px;font-weight:600;cursor:pointer";
      }
      function refreshSettingsGroupList() {
        if (!setGroupListEl) return;
        var groups = getGroupList();
        if (!groups.length) {
          setGroupListEl.innerHTML = '<div style="padding:14px;text-align:center;color:#bbb;font-size:13px">暂无群聊</div>';
          return;
        }
        var gHtml = "";
        for (var gi = 0; gi < groups.length; gi++) {
          var gsid = groups[gi].id;
          var gsn = groups[gi].groupName || groups[gi].name || gsid;
          var gon = isGroupEnabled(gsid);
          gHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #f5f5f5">' +
            '<span style="font-size:13px;color:#444;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + gsn + '</span>' +
            '<div class="vc-set-gsw" data-gsid="' + gsid + '" style="width:40px;height:22px;min-width:40px;border-radius:11px;background:' + (gon ? "#34C759" : "#ccc") + ';position:relative;cursor:pointer;transition:background 0.2s"><div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;left:' + (gon ? "20px" : "2px") + ';transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15)"></div></div>' +
            '</div>';
        }
        setGroupListEl.innerHTML = gHtml;
        var gsws = setGroupListEl.querySelectorAll(".vc-set-gsw");
        for (var gsi = 0; gsi < gsws.length; gsi++) {
          gsws[gsi].addEventListener("click", function() {
            var gsid2 = this.getAttribute("data-gsid");
            var gcur = isGroupEnabled(gsid2);
            ctx.system.storage.set("vc_group_" + gsid2, gcur ? "false" : "true");
            var gon2 = !gcur;
            this.style.background = gon2 ? "#34C759" : "#ccc";
            this.firstChild.style.left = gon2 ? "20px" : "2px";
            refreshPrompt();
            ctx.ui.toast(gon2 ? "已为该群聊启用虚拟时间" : "已关闭该群聊虚拟时间");
          });
        }
      }
      setTabChar.addEventListener("click", function() { setSettingsTab("char"); });
      setTabGroup.addEventListener("click", function() { setSettingsTab("group"); refreshSettingsGroupList(); });
      // 复位悬浮岛
      var reposBtn = el.querySelector("#vc-reposition");
      if (reposBtn) reposBtn.addEventListener("click", function() {
        ctx.system.storage.remove("floatPos");
        if (floatEl) {
          floatEl.style.top = "max(48px, calc(env(safe-area-inset-top, 0px) + 12px))";
          floatEl.style.left = "50%";
          floatEl.style.transform = "translateX(-50%)";
        }
        ctx.ui.toast("已复位到顶部居中");
      });

      allToggleEl.addEventListener("click", function () {
        allEnabled = !allEnabled;
        ctx.system.storage.set("vc_all_enabled", allEnabled ? "true" : "false");
        for (var a = 0; a < chars.length; a++) {
          ctx.data.variables.set(
            "vc_enabled",
            allEnabled ? "true" : "false",
            "character",
            chars[a].id
          );
        }
        updateAllToggleUI(allEnabled);
        refreshCharListUI();
        refreshPrompt();
        ctx.ui.toast(
          allEnabled ? "已启用全部角色虚拟时间" : "已关闭全部角色虚拟时间"
        );
      });

      var charSwitches = el.querySelectorAll(".vc-char-sw");
      for (var cs = 0; cs < charSwitches.length; cs++) {
        charSwitches[cs].addEventListener("click", function () {
          var cid = this.getAttribute("data-cid");
          var cur =
            ctx.data.variables.get("vc_enabled", "character", cid) === "true";
          ctx.data.variables.set(
            "vc_enabled",
            cur ? "false" : "true",
            "character",
            cid
          );
          var on = isCharEnabled(cid);
          this.style.background = on ? "#34C759" : "#ccc";
          this.firstChild.style.left = on ? "20px" : "2px";
          updateCharCount();
          refreshPrompt();
        });
      }

      var quickBtns = el.querySelectorAll(".vc-quick");
      for (var q = 0; q < quickBtns.length; q++) {
            quickBtns[q].addEventListener("click", function () {
          if (isFollowMode()) { ctx.ui.toast("跟随系统模式下不可用"); return; }
          var newTime,
            months = this.getAttribute("data-months");
          if (months) {
            var nd = new Date(getVirtualNow(state));
            nd.setMonth(nd.getMonth() + parseInt(months));
            newTime = nd.getTime();
          } else {
            var ms = parseInt(this.getAttribute("data-ms"));
            if (isNaN(ms)) return;
            newTime = getVirtualNow(state) + ms;
          }
          setVirtualTime(state, newTime);
          refreshPrompt();
          updateFloating();
          var ud = new Date(newTime);
          el.querySelector("#vc-year").value = ud.getFullYear();
          el.querySelector("#vc-month").value = ud.getMonth() + 1;
          el.querySelector("#vc-day").value = ud.getDate();
          el.querySelector("#vc-hour").value = ud.getHours();
          el.querySelector("#vc-min").value = ud.getMinutes();
          ctx.ui.toast("已跳转至 " + formatDisplay(newTime));
        });
      }

      var d = new Date(getVirtualNow(state));
      el.querySelector("#vc-year").value = d.getFullYear();
      el.querySelector("#vc-month").value = d.getMonth() + 1;
      el.querySelector("#vc-day").value = d.getDate();
      el.querySelector("#vc-hour").value = d.getHours();
      el.querySelector("#vc-min").value = d.getMinutes();
      var followSetSws = el.querySelectorAll(".vc-follow-set-sw");
for (var fsi = 0; fsi < followSetSws.length; fsi++) {
  followSetSws[fsi].addEventListener("click", function () {
    var fkey = this.getAttribute("data-fkey");
    var cur = ctx.system.storage.get(fkey) === "true";
    ctx.system.storage.set(fkey, cur ? "false" : "true");
    var on = !cur;
    this.style.background = on ? "#34C759" : "#ccc";
    this.firstChild.style.left = on ? "20px" : "2px";
    if (!on) {
      var now = new Date();
      if (fkey === "followYear") ctx.system.storage.set("customYear", String(now.getFullYear()));
      if (fkey === "followDate") {
        ctx.system.storage.set("customMonth", String(now.getMonth() + 1));
        ctx.system.storage.set("customDay", String(now.getDate()));
      }
      if (fkey === "followTime") {
        ctx.system.storage.set("customHour", String(now.getHours()));
        ctx.system.storage.set("customMinute", String(now.getMinutes()));
      }
    }
    // 更新输入框 disabled
    var fYs = ctx.system.storage.get("followYear") === "true";
    var fDs = ctx.system.storage.get("followDate") === "true";
    var fTs = ctx.system.storage.get("followTime") === "true";
    var ye = el.querySelector("#vc-year"), me = el.querySelector("#vc-month"), de = el.querySelector("#vc-day");
    var he = el.querySelector("#vc-hour"), mi = el.querySelector("#vc-min");
    if (ye) { ye.disabled = fYs; ye.style.opacity = fYs ? "0.4" : "1"; }
    if (me) { me.disabled = fDs; me.style.opacity = fDs ? "0.4" : "1"; }
    if (de) { de.disabled = fDs; de.style.opacity = fDs ? "0.4" : "1"; }
    if (he) { he.disabled = fTs; he.style.opacity = fTs ? "0.4" : "1"; }
    if (mi) { mi.disabled = fTs; mi.style.opacity = fTs ? "0.4" : "1"; }
    refreshPrompt();
    updateFloating();
  });
}
// 初始化 disabled 状态
(function(){
  var fYi = ctx.system.storage.get("followYear") === "true";
  var fDi = ctx.system.storage.get("followDate") === "true";
  var fTi = ctx.system.storage.get("followTime") === "true";
  var ye = el.querySelector("#vc-year"), me = el.querySelector("#vc-month"), de = el.querySelector("#vc-day");
  var he = el.querySelector("#vc-hour"), mi = el.querySelector("#vc-min");
  if (ye) { ye.disabled = fYi; ye.style.opacity = fYi ? "0.4" : "1"; }
  if (me) { me.disabled = fDi; me.style.opacity = fDi ? "0.4" : "1"; }
  if (de) { de.disabled = fDi; de.style.opacity = fDi ? "0.4" : "1"; }
  if (he) { he.disabled = fTi; he.style.opacity = fTi ? "0.4" : "1"; }
  if (mi) { mi.disabled = fTi; mi.style.opacity = fTi ? "0.4" : "1"; }
})();
el.querySelector("#vc-set").onclick = function () {
  var fY = ctx.system.storage.get("followYear") === "true";
  var fD = ctx.system.storage.get("followDate") === "true";
  var fT = ctx.system.storage.get("followTime") === "true";
  if (!fY) ctx.system.storage.set("customYear", el.querySelector("#vc-year").value);
  if (!fD) {
    ctx.system.storage.set("customMonth", el.querySelector("#vc-month").value);
    ctx.system.storage.set("customDay", el.querySelector("#vc-day").value);
  }
  if (!fT) {
    ctx.system.storage.set("customHour", el.querySelector("#vc-hour").value);
    ctx.system.storage.set("customMinute", el.querySelector("#vc-min").value);
  }
  if (isFollowMode()) {
    refreshPrompt();
    updateFloating();
    ctx.ui.toast("自定义值已保存");
    return;
  }
  var t = new Date(
    +el.querySelector("#vc-year").value || 2025,
          (+el.querySelector("#vc-month").value || 1) - 1,
          +el.querySelector("#vc-day").value || 1,
          +el.querySelector("#vc-hour").value || 0,
          +el.querySelector("#vc-min").value || 0
        ).getTime();
        if (isNaN(t)) {
          ctx.ui.toast("无效日期时间");
          return;
        }
        setVirtualTime(state, t);
        refreshPrompt();
        updateFloating();
        ctx.ui.toast("虚拟时间已设定为：" + formatFull(t));
      };
      el.querySelector("#vc-now").onclick = function () {
        if (isFollowMode()) { ctx.ui.toast("跟随系统模式下不可用"); return; }
        var n = Date.now();
        setVirtualTime(state, n);
        refreshPrompt();
        updateFloating();
        var d = new Date(n);
        el.querySelector("#vc-year").value = d.getFullYear();
        el.querySelector("#vc-month").value = d.getMonth() + 1;
        el.querySelector("#vc-day").value = d.getDate();
        el.querySelector("#vc-hour").value = d.getHours();
        el.querySelector("#vc-min").value = d.getMinutes();
        ctx.ui.toast("已重置为当前真实时间");
      };
    });

    return function () {
      removeFloat();
      removePanel();
      var s = document.getElementById(hideStyleId);
      if (s) s.remove();
    };
  },
};