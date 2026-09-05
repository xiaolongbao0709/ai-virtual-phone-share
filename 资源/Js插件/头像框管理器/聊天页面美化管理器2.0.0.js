// 聊天页面美化管理器 · float 聊天插件
// ─────────────────────────────────────────────────────────────
// 给聊天头像套一层外扩的装饰框（QQ 头像挂件那种）。
// 支持上传、实时预览、缩放 / 上下左右微调、分别作用于「对方」「我」或全部。
// 每个框各自记住自己的缩放与位移，切换回来还是上次调好的样子。
//
// 界面形态：管理页里只放一个入口按钮（避免把插件管理页撑得很长），
// 点开是浮层，内部三段式——头部（预览+范围/对象+滑块）固定、素材库独立滚动、
// 底部（启停+批量）固定，滑素材时按钮不会跟着跑。
//
// 作用范围：可设「全局默认」，也可为单个聊天室单独指定；每个范围下再分
// 「对方头像」和「我的头像」两个槽位，各自独立记忆框与缩放位移。
// 按会话的规则靠聊天室根节点的 .session-<id> 类名定位（chat-room.tsx:5431），
// 它比全局规则多一个类选择器，特异度天然更高，覆盖关系无需 !important。
//
// 兼容性设计（不与其他外挂 CSS 打架）：
//   1. 全部规则挂在 html[data-avframe="1"] 之下，插件停用即整体失效；
//   2. 不使用 !important —— 会话自定义 CSS 经 scopeSessionCSS 加前缀后特异度
//      约 (0,2,0)，本插件为 (0,2,0)+属性选择器，默认压得住，但用户想覆盖时
//      只要写得更具体就能盖回去，不会被锁死；
//   3. 只碰 4 处：.chat-msg-avatar 的 overflow / position、直接子 img 的圆角，
//      以及新增的 ::after 图层。不改头像尺寸、背景色、布局；
//   4. 样式表带 data-chat-plugin 标记，禁用时由宿主自动移除。
//
// 关于放开 overflow 的两种情形（实测过，别想当然）：
//   变体A（角色，chat-room.tsx:5980）.chat-msg-avatar 是 flex-col 外壳，本就
//     没有 overflow-hidden → 放开是空操作；内层 40px 圆框继续裁剪，头像仍是圆的。
//     其中的 img 是 .chat-msg-avatar > div > img，不是直接子元素，故不受下面那条
//     border-radius 规则影响。
//   变体B（我）.chat-msg-avatar 自己就是 40px 圆框。这里有个坑：
//     chat-room.tsx:6073 的 img 自带 rounded-[20px]，但 mascot-chat-room.tsx:112
//     的 img 没有圆角，纯靠父级裁圆 —— 放开 overflow 后那种头像会变成方的。
//     所以对直接子 img 补一条 border-radius: inherit：值取自头像盒自身的圆角，
//     圆头像保持圆，主题若把头像改成方的也会跟着变方，不写死 50%。

const STORE_FRAMES = "frames";
const STORE_CONFIG = "config";

const ART = {"paper": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCACAAIADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAEH/8QAGRABAAMBAQAAAAAAAAAAAAAAAAERQTFh/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAID/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1sgGKwAAkAAAAAAAAAAAAjpIAAAABoAAAAAC4gAAAAAigAAAAAAAAAAAAAAC2gAABgASSAAAAAAFgAUABwAAAAAAAAAKAAADAAAAAALAAAADgAAEFgCpoAAAAAAAAAAABgAQHgAAAAEgAAaAAACApoAGgD//2Q==", "s_tape_yellow": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA0CAYAAABB/vzFAAARkUlEQVR42u1ca4gk13U+91bVdNf0Y6Y0b2dnZa/lWc+Olg02JiaSvGviSHZkkyis1j+MwHYgIcgGBRHHPwKtBhni/IhBCEKCYhL0J9YKssEixDLYu7FlW8SyrcfsrCbOypqRtLPdM9PTz+qeetz8mL61t0/de6t6ekQwSYNQb1fNfZ17zvnOd869BH7NP14YWkfZnkmeDX12nprk2fDy5VUyanvnzq0wQi4E79b8GXvG8Nl5alHqSedzmAW1KPVGXViTlAOAFXLxIsAD5w8WdOhGyIWQKCY24ic46k24c33TmTqxWDuqNn/5+lXLsQp5Qm6v6MZrqjQiWvCLAPBg/+Fjq4xQ6jH2jEHIkS5s8G5p8M7N3Yna3lbHoa69396YHPPJwCJXb253p9jrAABgdH9K6cqf/b7bC35iZ4yPGsSbTurfCmuJY++8/q17c9R4f/e/XtS3ZRcDz20YiYtVWPYWJgCY4f/Mbdz4Vr2y//P5O26vSHVApp2jaHCjslb06p2DfxizBuy+5ON39k3mAAAUZpc+1eu1Kvv1d17KZ8NPqxaw2eqF2eJ8rD/CggXTpJ9JXJD9+hgAgDE2sa96zp9lzN4ysexbJtBeDIi7aQAAGM4S+F03AAAg7qYhPuPPg9o6GM4SkKBCAAA8r+DzdyOtytoGbwf/JranNMv2YmBm7eg9t5f5Zce3/mpm/sQ3sQwJFtzO1uqU18obxbnMV3vNXQK1V3rRO90myYznl2nQfD40CvfaY/6nlYMIuizqxMgS8Tf+b2LZwDwX+Hfdhy8enyBfZN0iJC0WFh4AAF74gQ2FBJVGGNr+PTdx3mk+hrMEoTkT1HdqD04dO3VJFLIJAFAqlahFqXd99WdLlGS/OjtX/zwAgGm5ASmYBgCAWZwkfsPsC+22vmDV1pFYNkn5Wzob3hdumoVlngsENMLvbyrw1g3o98/bJwCGuPB4A4p9jyogsY9RBR22NsDrzv8o5oO5tPfevnqGjo3/w3g+cyao/px3Gk3Gb+wx2cTTTEJ8l1g2hN0aI0aW8GejTFQ1JlW7OosRdmuMZh2Cn6nGdBTah8ectl1ufZi9GITmDLTDztPzd9xewSaa/vDKlT7cDu4Zz2fOhK2NWCdht8Z451iwoilOLRBuspFAkyYW6xstDgu6TBwP89yojzSLR7MO0ZlQ3t5RCBW3lea7yhc36q3v9sKJr8hwET13rhoCAIRgvJUkELxAfDFVQsbaK/4dsezYc3HifFMlLSr29bKxDiNk1fgPI1hx/Hgukcnvr0M0VrRBldaj7ypCcybI5grX5hemt3eubzoYJFNCLgSlUolWmuHznY73l6odxjsKuzUWdmsMC1XUHnFhRWGKgsAT5e9GGwABM5VpFtuKbUDJYqbVxmgN0JzSClW2mfE4ZG2qlEn6aawb1K8aYyb78s5bV/+Am2hRkwkOjzrNrb/JQuUR78aLA4tMjCyRLbY4IFEwacCEqFkyQeO2xPZlflf326j+EY9z1DZZ0GXYJaT9W2z56Hs+EQAA1Orun0zOvvfpAR8MACDGtf7+/s3QnAk42MCmA5tBvkOxJst8oU4TBxYTta8znaI2cNOONWaUEGYYjJAWRHF/L5r/NC4AW4HIzVVfMKhfNXK58TtF8scLQ4tiEqPn+VUx1sTaioUn0zqZFmNhhd1azNeIv8mELCJvpcCRyR5FIDqzP0qcK7Nio1qGoLYOtPaLT3jtytdbW9f+em3ttfFIgyPWSHTQjXUjQqESf6gTpCgM7Hs5eBLNU2T+kFBFMyZaihgeSDDTw8amsrAqLUDD76cdx1GgcwNad2ah8giB4OOOVchblHoxDTbD7mkAACguBSoQwBc9AjmiOVZoN/9PpoVSrelvIC54FZgSxzKKRsgEIwo6VWyKwFWS8EY1/7L+MRNHMcgaGzPup37V0IEb3W6jWScy4zK0HcXVgtB1YZZW2xDgGkaw2AXhxT6KBcdWQYUnjkyLi0sBAIBHc09MnVissVKJUgCAf3n2IHPUeOfa/Rbbe59IeuNBiSBGFCrXMtGPyoQh46hlpjmm5QmLM9ROl+ALmQketn1i2QfjRy4IC1dG2OgQelrBm1nbaHuFJ2fmT3wTAICUy6EpZofaW6uPmVnb8CsvAwgmUOicxGLJA4GA4CtjoCym4UJ8fJAUuvUOzTqRnx4wu33TruVjBQpUR+9hPjkNL5wUIulCMz5PFXmSZBVTbdjGuhGaM4GR8bbEODjywY13rt2fd6ZX/MrLyrgLgxtdgC9qJxd05FMte1DQggaL7YqCTqNNSZsAZ4Nk5lglXF04oxMOdh/Yrw/j43XzMmfPQNjagL03//NZi1Lv8XI5AAAwORftus3jE+AcgCvJDh8QuKCZqpgVkyMyIfb9tdKMYzOX6JNTaJ4sE6XTPlliRCtQTZgmWK6Y+daRHmmQu991g8oePLrwmw9siJiK3n32LAAA2HZhI2xtAM0f1wIQJQ/c18oBoQjCleaHhdBIDKuwJg5rvoZlsgZIA+FvcayOrZqWclRQpuIGEBVGtIqipdCSRPZiwDwXarW9mx1vfLXp556KcdEWpV6pVKJTx05davYKD4atDTCztoFNsoxzVoVFUuKfm2kJ6yWmETmIE/lwmYlWAZWjCjlE8ChLCuhYr9hYeUQh0JRKECqGlWnmU1wKHGdyrtsp3nvHyVNeLF0IAFAul0MvDK2pY6cu7TbCz/ldN0iDYnUoVIx7B74LG0BcQF1cnJbKS5O6xNqRZA5V2ikDZ7LkiYookloRpBADIZZsrO6mwUt39hs/LRxERJ8NpTVZIvJqVd/4uxzdfgga69JQSTVgEUzJ4ug0vkSVaEgKIfCi8+T9qKUzIl5Iq/mYcsXuCUcNmJMfYPCENeG/4bmRmbuCVm17dfOlH//26c/8cWfAB2Oa0qLUy4zn9sysbeiyOknCFTVZxSGrNJAnOnQkiI6AH9ZnD1sEkGTFMA0rm6PICHK3JPX5wprwZErM4lVfMPLO9MqxD9/9NZw8orhWmTEgbn33P3hGSckySfxrmoXgv+PJiKYM88tpTCv2wWK2ZlQumLuWpPYw7x7RqAKQ5EAUvyv7P0fw2IzLQCirvmAUHOdLtXeufoMnGmICBgDwWWjyIi5saqS5XiTomA/rC1+2O6VhjNDPwPcEIkIGwtLihiTwJlqTYapB0mi8slhBtIbCBsNATzTt1K8aBIKPi1pMB4VbMixKPXvito8NACEZilUg6Rgtl2ABZDwt/i4ibS2RgflkTbZLZg1EYCRaGREYpgV9OJwSN38SohYrW2TfVdmv0JwJWAhPLS/fGflhikGW27hxn9l988siea3TCJlgMMGBtVAGSKRmvg820uR40yBiFcOEE/Fi+jK2yAlhmyq0wSFnbBML/lWGppOqMMnMXUHY2oBa3XseAIAzWQSfVmhW/vtfJ3PuJ8UK/rQmT5eU12VYVMn9JPR86GSDolQIa4QsTNS5DBUXLiv6k7UtQ85p6FhmLwY0fxxate3V3PzKR0TgbHBH/PDDD9NZu/mHzszsn5OwQ1nzDUr8Bh1GuAe9+cD8LhBq3krU979Hk2E+AOuT78J7wPyDCQjvE8Pqa5OFJmrFNSj0le+Lz/mzgXdDH1WGWNHvfF4AADRTIBD6wLwWi+bQb4dmCgT3K4413nfrYG36bTO/C8S0CfNatzYTGzz5Q6gZ64P4DcoYsMzEwuzO5urVianjr55eWSEXL15khGvvpUtPFX7vrtO7NH8cwtbGgOYOQ3rI+OeBDIoiptbxwNhkp024JwE0GUpVaR7vW5WAOUwxgJhwSeIYVDlwQEdY9tr2vzPYf6g4u9wwSTmIEv4nT340aHuFJ7FZVi0chv66uFY1CRkIwhmpgThXwuMqfaukZEjsQxRuUl23OA8cd2sTC7hKBAElVUEEjpVV64X7DmrrUJzI/y6Bsad3rm86AGUWHRxeXr6zk5//4FfcjR+sJ9GAMgJEFUKJNKXqPVVaTqTpcEIgTaikqvHGmiA7rpIU+uh4YjG0koGqVGEWonBlmos5ex4q0bD7nurad1qEAIvKZhl7xrAo9byA/D3PJslOLoj5XRWbJcsH69grXFyuOms0DG2pOjkwbDIi2gB4wSVF9CoyJq1wpZk4SQJDF2P7XTegVsH/0cKHbp0u9MLQIuTgABqQ4AsAnZh/kqA9UchEVhkpPbKiKKDH7SSRGGk1+KgQuExzZBtSVfyfRmMjFC7RVhk5JIsEzKxt+G2v4nz7OgEAoIyVqFkmgdu4cR+Q4J/yzvQKhuPYx3LuVHnKTxGoy2LlWD0W0tSkNKHyIJpEq46igD1N0SHGKrHEiSSVmrYaU3Vgj3kuQHEp8LtusLfTfORC+cI+YyVKCSmHfokZvdb21/PO9Ar1qwY01g0VkOCOX6at+HyRblIqky4734T9clIxgMokj1IznVR1qeXJNee4lOlCoYAv6TyT+HtlDx49sfKh9VKpRAkpH/DOO9c3nWyfnvYrL8fKSmSmVJZFwofGpGGKRshpGBvVDh7GZB9Wg3Whl4wRk7m5NKlSXGiYlPjnzys9ePTYB37riYET/n2KstbauvZ9AFjpD5bIKjRwIl8wybGTgbgGS+XPdeZK5++GKdUZpoRHdSxGldPW/XsgWaDgBpKO4KbBCz0/s+bnlv/WNBb+GZ8RpiYpBxalXq/ZfrzT6r1sOEtqP4f8p6y6Eh9Ak5mngVpqMVMjiUtlE0yqV1Jp82GpTVWdGE5KyIQtxuVi4iYNytYJXSQ33Fb9OefY6SfnfvC9Gj6CRAkph6VSiU594MMNr9d5vNEkr0BxKYguOpGk8hKT8BKt5ILEZocXiaviUh3ISnuIa5hjJ2JYpQutsI9MBIHCu0qSRlg3XRWMuH5+1w1yt3/sgcbOxl/cyL6YwdU5sVt21tZeG58vsC8Wpqa/wasFsA9QnV7QkR54gJiY153FTVN8NmrB3bAF77JyV9n5Zy05pKjt0t0tImXtZu4KAACajc7Tk3Pv/yM/DE2uxcp7sqqrlz43MbvwjwAAIqpOixTTCjyt0IY5QThsPCyrg0qbxdIJVXYoXlZfJcvApQ0Po7XoZ5S2397/jakTi7XHy+WgXC6HNH73YYnubK1OmdOnf8fM2gZxNw0ZRafza7oqj7TV/FLGSOS2kyY85DFOWXVnmiIBqfVR4A7V+iTF92lCQWisG2FrA8Yn2L81KmtFXikbEzAh5dBr5Y0c3X5IdymYrDBs1GS8EsEK93EcpkQmbX2XiixR+XzV+7ENriI1Eo7lqJQJKxxvx8zaRug1zVfWKg3QXUY67pAvmGO2IV4+ltbnDnDLkphYlwRP9DUJKbph4uPDFgwM8zdJfSTx40m/4SsX/a4LHp154u6zK9Hldia+ShcAIPC9k+H4TMBsd+AsT8qFHeqGu2EnOfKNcEJZjK5cSBct7DW6FQCAyWJ2lhhZUqvt3ZwsZmf5s8lidnav0a04zuRcAPnXeu3ar/C1j7K2ebu8bdVvsni6bRae9Gn2VX50VHkZKQBA+8a1U4zA53NW80u8cl6nzap7IXEhOtboWm3vJoWgaWVyxOu1EzMuViZHxEtFfT/8drQ5WeMtjzqGFdYCjzoGAEC3seUBAMguMu1Yx1l+vHCFseCeXrf4DOy+5O+bzBnLHd+D+ubBWCYWiTUxDl69A9bEOHhsTuoipuZuqx92w+3c3J2YmrutvnNzdwLabdooTO8DALxvxm7L3lX1x8Gx8jJS6U59++oZxoJ7AADM9tqfuq36c77XfTNiUFrbYSY/TbPFeYsUPxi4b12O3flsFRbrBvGmA2Zt4+t59zPHblSvvvrczPJ9+ZrXbOXc1xfa9skbjlXIixN9o+rmZBOO3Svyf/jDGBCf3QqPtALmmiy+nOaq4f+ticFjJQKPrRzidvZVBhdXCKyuMr9UMn6dBaySDUm6G/qHV67A3WfPHhQFAJDL3y8Z586tsPh19+cIwOWhqhbOVVeYf/48fTcm9v+fg8//AKJ0gGO9PMz7AAAAAElFTkSuQmCC"};
const GLOBAL = "global";                 // 作用范围的特殊键
const ROLES = [["assistant", "对方头像"], ["user", "我的头像"]];
// 设置对象的三档：「全部」是同时改两侧的快捷档，不是第三种角色
const ROLE_TABS = [["all", "双方"], ["assistant", "对方"], ["user", "我方"]];
const entryKey = (scope, role) => `${scope}:${role}`;

const AVATAR_BOX = 40;          // 宿主头像框边长，见 chat-room.tsx
const DEFAULT_PARAMS = { scale: 1.9, dx: 0, dy: 0 };

/** 把一小段 SVG 变成 data URI（供占位图用；内置框走 base64，不经过这里） */
const svgURI = (s) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s.replace(/\s+/g, " ").trim());

// ── 内置素材 ──────────────────────────────────────────────
// 只留一个作为示例，让拿到插件的人一眼看懂「头像框长什么样、该怎么调」。
// 用户自己上传的素材只存在本地 IndexedDB（ctx.system.storage），不会写进本文件。
//
// 内置示例框（269KB 动图）已移除：只是演示素材，占了插件一半体积。
// 老配置若还指着它，frameById 返回 null，等同「不套框」。
const BUILTIN_FRAMES = [];

const TARGET_SCOPE = {
    all: "",
    assistant: '.chat-msg-wrapper[data-role="assistant"] ',
    user: '.chat-msg-wrapper[data-role="user"] ',
};

export default {
    manifest: {
        id: "avatar-frame",
        name: "聊天页面美化管理器",
        apiVersion: 1,
        version: "2.0.0",
        description: "头像框、聊天气泡、输入栏三合一美化。素材上传、九宫格拉伸、图层编辑、文字颜色字体、位置微调，支持按单个聊天单独设置、气泡包导入导出。",
        permissions: ["ui", "storage"],
    },
    setup(ctx) {
        // ── 状态 ────────────────────────────────────────────
        // entries 以 `${scope}:${role}` 为键，scope 为 "global" 或某个 sessionId。
        // 会话若没有自己的条目，就继承全局；条目里 frameId 为空串表示「这一格明确不套框」。
        let frames = ctx.system.storage.get(STORE_FRAMES) || [];
        let config = ctx.system.storage.get(STORE_CONFIG) || {};

        if (!config.entries) {
            // 从 v1.0/v1.1 迁移：原来是单框 + target(all/assistant/user)
            const old = config.frameId
                ? { frameId: config.frameId,
                    ...((config.params && config.params[config.frameId]) || DEFAULT_PARAMS) }
                : { layers: [] };
            config.entries = {};
            const t = config.target || "all";
            if (t === "all" || t === "assistant") config.entries[entryKey(GLOBAL, "assistant")] = { ...old };
            if (t === "all" || t === "user") config.entries[entryKey(GLOBAL, "user")] = { ...old };
            delete config.frameId; delete config.params; delete config.target;
            delete config.scale; delete config.dx; delete config.dy;
        }
        if (typeof config.enabled !== "boolean") config.enabled = false;
        /** 配置各分区保底：老版本存的、清空后残留的、别处误删的，统统补成空对象 */
        function ensureConfig() {
            if (!config || typeof config !== "object") config = {};
            for (const k of ["entries", "bubbles", "inputBar", "packSel"]) {
                if (!config[k] || typeof config[k] !== "object") config[k] = {};
            }
            if (typeof config.enabled !== "boolean") config.enabled = false;
            if (typeof config.bubbleEnabled !== "boolean") config.bubbleEnabled = false;
            // 气泡分「草稿 bubbles」和「已生效 bubblesLive」：面板里改的是草稿，点主按钮才落成已生效并注入 CSS
            if (!config.bubblesLive || typeof config.bubblesLive !== "object") {
                config.bubblesLive = JSON.parse(JSON.stringify(config.bubbles || {}));
            }
            return config;
        }
        ensureConfig();

        /** 当前生效的 injectCSS 反注册函数 */
        let disposeCSS = null;

        const allFrames = () => BUILTIN_FRAMES.concat(frames);
        let uidSeq = 0;
        const newFUid = () => `fl_${Date.now().toString(36)}_${uidSeq++}`;
        /** 老结构 {frameId,scale,dx,dy} → 新结构 {layers:[{uid,id,scale,dx,dy,back}]}。
         *  back=true 表示画在头像后面（光晕、翅膀），默认在前面（外框、猫耳）。 */
        function normEntry(e) {
            if (!e) return e;
            if (!Array.isArray(e.layers)) {
                e.layers = e.frameId
                    ? [{ uid: newFUid(), id: e.frameId,
                         scale: e.scale == null ? DEFAULT_PARAMS.scale : e.scale,
                         dx: e.dx || 0, dy: e.dy || 0, back: false }]
                    : [];
                delete e.frameId; delete e.scale; delete e.dx; delete e.dy;
            }
            e.layers.forEach((L) => { if (!L.uid) L.uid = newFUid(); });
            // 整体调整：所有图层一起缩放/位移，和每层自己的参数叠加
            if (!e.g || typeof e.g !== "object") e.g = { scale: 1, dx: 0, dy: 0, alpha: 1 };
            if (e.g.alpha == null) e.g.alpha = 1;
            // 头像本体：单独一个缩放（图层列表里的「头像」行）
            if (!e.av || typeof e.av !== "object") e.av = { scale: 1 };
            if (e.av.scale == null) e.av.scale = 1;
            return e;
        }
        /** 一层的最终缩放/位移 = 自己的 × 整体的 */
        const effL = (L, g) => ({
            scale: (L.scale || 1) * ((g && g.scale) || 1),
            dx: (L.dx || 0) + ((g && g.dx) || 0),
            dy: (L.dy || 0) + ((g && g.dy) || 0),
        });
        Object.values(config.entries || {}).forEach(normEntry);
        /** 这个条目还有没有真正能画的图层 */
        const liveLayers = (e) => (e && e.layers ? e.layers.filter((L) => frameById(L.id)) : []);
        const frameById = (id) => allFrames().find((f) => f.id === id) || null;
        /** 头像本体的缩放（没设就是 1） */
        const avScale = (e) => (e && e.av && e.av.scale != null && +e.av.scale > 0) ? +e.av.scale : 1;
        /** 条目有没有东西要画：有图层，或头像本体被缩放过 */
        const isLive = (e) => !!e && (liveLayers(e).length > 0 || Math.abs(avScale(e) - 1) > 0.005);
        /** 头像本体的缩放规则：整个圆头像一起变大/变小（外层盒子已放开裁剪，圆角随 img 自带） */
        function avatarSelfCSS(base, entry, scope) {
            const s = avScale(entry);
            // 对方那侧的头像是 .chat-msg-avatar 里的第一个子节点（一个 40px 圆形 div 包着 img），
            // 我方那侧直接是 img/svg——统一缩放第一个子节点
            if (Math.abs(s - 1) > 0.005)
                return `\n${base} > :first-child { transform: scale(${s.toFixed(2)}); }`;
            return scope === GLOBAL ? "" : `\n${base} > :first-child { transform: none; }`;
        }

        /** 读一个槽位的设置；scope 为会话且无覆盖时回退到全局，返回 null 表示不套框 */
        function resolveEntry(scope, role) {
            const own = normEntry(config.entries[entryKey(scope, role)]);
            if (own) return isLive(own) ? own : null;
            if (scope === GLOBAL) return null;
            const g = normEntry(config.entries[entryKey(GLOBAL, role)]);
            return isLive(g) ? g : null;
        }
        /** 该会话是否对这个槽位做了自己的覆盖 */
        const hasOverride = (scope, role) => scope !== GLOBAL && !!config.entries[entryKey(scope, role)];
        /** 取可写条目（不存在则按继承值或默认值创建） */
        function editableEntry(scope, role) {
            const k = entryKey(scope, role);
            if (!config.entries[k]) {
                const inherited = resolveEntry(scope, role);
                config.entries[k] = inherited
                    ? { ...inherited }
                    : { layers: [] };
            }
            return config.entries[k];
        }

        function persist() {
            ensureConfig();
            ctx.system.storage.set(STORE_FRAMES, frames);
            ctx.system.storage.set(STORE_CONFIG, config);
            ctx.system.storage.set("bubbleAssets", bubbleAssets);
            ctx.system.storage.set("bubblePacks", bubblePacks);
            ctx.system.storage.set("bubbleFonts", bubbleFonts);
            ctx.system.storage.set("avatarPacks", avatarPacks);
            ctx.system.storage.set(STORE_CONFIG, config);
        }

        /** 会话列表（带可读名字），用于「作用范围」选择 */
        function sessionList() {
            try {
                // 注意：session.contactId 里实际存的是 characterId（不是 contact.id），
                // 直接拿它去匹配 contact.id 会全部落空——名字会退化成一串 sess_xxx。
                const chars = ctx.data.characters.list();
                const byCharId = new Map(chars.map((c) => [c.id, c]));
                const contacts = ctx.data.contacts.list();
                return ctx.data.sessions.list().map((s) => {
                    let name = s.alias || s.groupName || "";   // 群聊用群名
                    if (!name) {
                        const ch = byCharId.get(s.contactId);
                        if (ch) name = ch.name || "";
                    }
                    if (!name) {
                        const c = contacts.find((x) => x.characterId === s.contactId || x.id === s.contactId);
                        if (c) {
                            name = c.nickname || "";
                            if (!name && byCharId.get(c.characterId)) name = byCharId.get(c.characterId).name || "";
                        }
                    }
                    return { id: s.id, name: (name || "未命名会话") + (s.isGroup ? "（群）" : ""), sub: s.lastMessagePreview || "" };
                });
            } catch (e) { ctx.system.log("会话列表读取失败", e); return []; }
        }

        // ── 样式生成与应用 ──────────────────────────────────
        // :not(.avf-preview) 把设置面板里的预览节点排除在外——预览用的是真实 class，
        // 不排除的话「已生效的框」会由这里的 ::after 画出来，跟草稿框重叠成两层。
        const ROLE_SEL = {
            assistant: '.chat-msg-wrapper[data-role="assistant"]:not(.avf-preview) ',
            user: '.chat-msg-wrapper[data-role="user"]:not(.avf-preview) ',
        };

        // 伪元素画布放大到头像的 3 倍，缩放大于 1 的框才不会被裁掉
        const FBOX = AVATAR_BOX * 3;
        /** 一组图层 → 一个伪元素的声明；每层各自的大小位置写进 background 列表 */
        function layerCSS(list, g) {
            const imgs = list.map((x) => `url("${x.f.src}")`).join(", ");
            const sizes = list.map((x) => `${(AVATAR_BOX * effL(x.L, g).scale).toFixed(1)}px auto`).join(", ");
            const poss = list.map((x) => { const e2 = effL(x.L, g);
                return `calc(50% + ${Math.round(e2.dx)}px) calc(50% + ${Math.round(e2.dy)}px)`; }).join(", ");
            return `  background-image: ${imgs};
  background-size: ${sizes};
  background-position: ${poss};
  background-repeat: ${list.map(() => "no-repeat").join(", ")};`;
        }
        function ruleFor(scope, role, entry) {
            const scopeSel = scope === GLOBAL ? "" : `.session-${scope} `;
            const base = `html[data-avframe="1"] ${scopeSel}${ROLE_SEL[role]}.chat-msg-avatar`;
            const pairs = liveLayers(entry).map((L) => ({ L, f: frameById(L.id) }));
            const selfCSS = avatarSelfCSS(base, entry, scope);
            if (!pairs.length) {
                // 会话显式关闭：盖掉继承来的全局框（比全局多一个类，特异度更高）
                return (scope === GLOBAL ? "" : `\n${base}::before, ${base}::after { background-image: none; }`) + selfCSS;
            }
            // 列表里越靠前画得越上层；CSS 的 background 列表同样是先写的在上面
            const front = pairs.filter((x) => !x.L.back);
            const back = pairs.filter((x) => x.L.back);
            const box = `  content: "";
  position: absolute;
  left: 50%;
  top: ${AVATAR_BOX / 2}px;
  width: ${FBOX}px;
  height: ${FBOX}px;
  transform: translate(-50%, -50%);
  opacity: ${(entry.g && entry.g.alpha != null) ? entry.g.alpha : 1};
  pointer-events: none;`;
            let out = "";
            out += `\n${base}::after {\n${box}\n  z-index: 3;\n`
                + (front.length ? layerCSS(front, entry.g) : "  background-image: none;") + "\n}";
            out += `\n${base}::before {\n${box}\n  z-index: 1;\n`
                + (back.length ? layerCSS(back, entry.g) : "  background-image: none;") + "\n}";
            return out + selfCSS;
        }

        function buildCSS() {
            const keys = Object.keys(config.entries);
            if (!keys.length) return "";
            // 头像盒本身的处理只需一份：放开裁剪 + 让直接子 img 继承圆角
            let css = `
html[data-avframe="1"] .chat-msg-avatar {
  overflow: visible;
  position: relative;
}
html[data-avframe="1"] .chat-msg-avatar > img {
  border-radius: inherit;
}
html[data-avframe="1"] .chat-msg-avatar > * {
  position: relative;
  z-index: 2;   /* 头像本体压在 ::before(z1，头像后的层) 之上、::after(z3，头像前的层) 之下 */
}`;
            // 先全局后会话：会话规则在后且特异度更高，双保险
            const ordered = keys.slice().sort((a, b) =>
                (a.startsWith(GLOBAL) ? 0 : 1) - (b.startsWith(GLOBAL) ? 0 : 1));
            for (const k of ordered) {
                const i = k.lastIndexOf(":");
                const scope = k.slice(0, i), role = k.slice(i + 1);
                if (!ROLE_SEL[role]) continue;
                const e = config.entries[k];
                css += ruleFor(scope, role, isLive(normEntry(e)) ? e : null);
            }
            return css;
        }

        function apply() {
            if (disposeCSS) { disposeCSS(); disposeCSS = null; }
            const css = (config.enabled ? buildCSS() : "") + buildBubbleCSS() + buildInputCSS();
            if (css) {
                disposeCSS = ctx.ui.injectCSS(css);
                document.documentElement.setAttribute("data-avframe", "1");
            } else {
                document.documentElement.removeAttribute("data-avframe");
            }
        }
        // ── 工具 ────────────────────────────────────────────
        const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(new Error("读取失败"));
            r.readAsDataURL(file);
        });

        /** 无头像时的占位：画一个中性剪影，避免预览里出现空白灰块 */
        const PLACEHOLDER = svgURI(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
            <rect width="80" height="80" fill="#dfe3ea"/>
            <circle cx="40" cy="31" r="14" fill="#b9c0cc"/>
            <path d="M12 76c0-15.5 12.5-26 28-26s28 10.5 28 26z" fill="#b9c0cc"/>
        </svg>`);

        // 宿主没通过插件 API 暴露用户头像，会话级 customCSS 也只在聊天室挂载时注入
        // （<style> 作用域是 .session-<id>，弹窗挂在 body 上读不到）。所以进聊天室时
        // 把「两侧头像 + 该会话解析后的主题变量 + 最后一轮对话」快照下来，预览时按会话回放。
        // 不快照的话预览只能读到 :root 的值——用户把气泡改成蓝色，预览还是主题默认的绿色。
        const THEME_VARS = [
            "--c-bubble-self", "--c-bubble-other", "--c-text-title", "--c-text",
            "--c-page-body-bg", "--c-card", "--c-card-border", "--c-input",
            "--c-icon", "--app-text-scale",
        ];
        const SNAP_PREFIX = "snap:";

        function captureChatSnapshot() {
            try {
                const room = document.querySelector(".chat-room-wrapper");
                if (!room) return;
                const m = String(room.className).match(/session-(\S+)/);
                const sid = m ? m[1] : null;
                const rs = getComputedStyle(room);
                const theme = {};
                THEME_VARS.forEach((v) => {
                    const val = rs.getPropertyValue(v).trim();
                    if (val) theme[v] = val;
                });
                const q = (role, sel) => document.querySelector(
                    `.chat-msg-wrapper[data-role="${role}"]:not(.avf-preview) ${sel}`);
                const avatarOf = (role) => {
                    const img = q(role, ".chat-msg-avatar img");
                    return img && img.src && !img.src.startsWith("data:image/svg") ? img.src : "";
                };
                const textOf = (role) => {
                    const n = q(role, ".chat-markdown");
                    return n ? (n.innerText || "").trim().slice(0, 24) : "";
                };
                // 气泡真实的底色：主题/自定义 CSS 可能不改变量、直接给 .chat-bubble-role-* 上色，
                // 只抄变量会得到默认绿，和聊天室里看到的蓝不一样。抄元素算出来的颜色最保险。
                // （套了本插件皮肤时底色是透明的，那就不抄，保留变量）
                const bubbleBg = (role) => {
                    const n = q(role, `.chat-bubble-role-${role}:not(.chat-bubble-media):not(.chat-bubble-html-preview)`);
                    if (!n || !n.querySelector(".chat-markdown")) return "";   // 只认普通文字气泡
                    const c = getComputedStyle(n).backgroundColor;
                    return c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent" ? c : "";
                };
                // 只在房间上读不到变量时才用元素颜色兜底：页面里第一条「用户气泡」可能是转账卡/表情这类
                // 自带底色的特殊气泡，拿它的颜色去覆盖主题变量会把预览染错（用户反馈蓝色变成了绿色）
                const sb = bubbleBg("user"), ob = bubbleBg("assistant");
                if (sb && !theme["--c-bubble-self"]) theme["--c-bubble-self"] = sb;
                if (ob && !theme["--c-bubble-other"]) theme["--c-bubble-other"] = ob;
                const snap = {
                    theme,
                    aAvatar: avatarOf("assistant"), uAvatar: avatarOf("user"),
                    aText: textOf("assistant"), uText: textOf("user"),
                };
                if (sid) ctx.system.storage.set(SNAP_PREFIX + sid, snap);
                ctx.system.storage.set(SNAP_PREFIX + "last", snap);
            } catch (e) { ctx.system.log("聊天快照失败", e); }
        }

        const snapOf = (k) => ctx.system.storage.get(SNAP_PREFIX + k) || null;

        /**
         * 预览素材。分两种情况：
         *  · 该会话进过聊天室 → 用它自己的快照，文字/头像/配色全都是真的；
         *  · 没进过 → 文字与头像改从插件 API 取「该会话」的真实数据，
         *    只有配色借用最近一次进过的聊天室（会话级 customCSS 只在聊天室挂载时存在，
         *    设置页读不到，没法凭空还原）。
         * 之前这里回退时连文字头像一起借用，导致切换作用范围看起来毫无变化。
         */
        /** 从一段 CSS 文本里把气泡颜色变量抠出来（同名多次声明取最后一次） */
        function cssVars(text) {
            const out = {};
            if (!text) return out;
            ["--c-bubble-self", "--c-bubble-other"].forEach((v) => {
                const re = new RegExp(v + "\\s*:\\s*([^;}]+)", "g");
                let m, lastV = null;
                while ((m = re.exec(text))) lastV = m[1].trim();
                if (lastV) out[v] = lastV;
            });
            return out;
        }
        /**
         * 没进过聊天室（没有快照）时的配色兜底：先看该会话自己的自定义 CSS，
         * 再看页面里已挂上的样式表（聊天 app 的外观 CSS 就在里面），有快照则以快照为准。
         * 之前没有这一步，装完插件第一次打开面板预览就是宿主默认的绿色，进一次聊天才变对。
         */
        function themeFallback(sessCss, snapTheme) {
            // 页面样式表可能是 <link> 加载的，textContent 读不到，走 CSSOM 逐条规则找变量声明（后声明的覆盖前面的）
            const fromSheets = {};
            try {
                const walk = (rules) => {
                    for (const r of rules) {
                        // 注意：新 Chrome 里普通样式规则也带 cssRules（CSS 嵌套），要先看 style 再往下钻
                        if (r.style) {
                            ["--c-bubble-self", "--c-bubble-other"].forEach((v) => {
                                const val = r.style.getPropertyValue(v);
                                if (val && val.trim()) fromSheets[v] = val.trim();
                            });
                        }
                        if (r.cssRules && r.cssRules.length) walk(r.cssRules);
                    }
                };
                for (const sh of document.styleSheets) {
                    if (sh.ownerNode && sh.ownerNode.id === "avf-panel-style") continue;
                    try { walk(sh.cssRules); } catch { /* 跨域样式表读不了，跳过 */ }
                }
            } catch { /* ignore */ }
            const merged = { ...fromSheets, ...cssVars(sessCss), ...(snapTheme || {}) };
            return Object.keys(merged).length ? merged : null;
        }
        function sampleChat(scope) {
            const exact = scope !== GLOBAL ? snapOf(scope) : null;
            const last = snapOf("last");
            // 群聊：预览里对方气泡上方要放发言人名字（取最近一条对方消息的发言人）
            let isGroup = false, aName = "";
            try {
                const sess0 = scope !== GLOBAL ? ctx.data.sessions.list().find((x) => x.id === scope) : null;
                if (sess0 && sess0.isGroup) {
                    isGroup = true;
                    const ms = ctx.data.messages.list(sess0.id);
                    const lastNamed = [...ms].reverse().find((m) => m.role === "assistant" && m.senderName);
                    aName = lastNamed ? lastNamed.senderName : "";
                    if (!aName) { const c0 = ctx.data.characters.get(sess0.contactId); aName = (c0 && c0.name) || "成员"; }
                }
            } catch { /* ignore */ }
            if (exact) {
                return {
                    aText: exact.aText || "刚忙完，怎么了？",
                    uText: exact.uText || "在吗",
                    aAvatar: exact.aAvatar || PLACEHOLDER,
                    uAvatar: exact.uAvatar || PLACEHOLDER,
                    theme: exact.theme || null,
                    borrowedTheme: false,
                    isGroup, aName,
                };
            }
            let aText = "", uText = "", aAvatar = "", sessCss = "";
            let globalSnap = null;   // 全局默认：借 AI助手 那个聊天的快照（人人都有它）
            try {
                const sessions = ctx.data.sessions.list();
                const isMascot = (s) => {
                    if (s.alias === "AI助手" || s.groupName === "AI助手") return true;
                    try { const c = ctx.data.characters.get(s.contactId); return !!(c && c.name === "AI助手"); } catch { return false; }
                };
                const sess = scope !== GLOBAL
                    ? sessions.find((x) => x.id === scope)
                    : (sessions.find(isMascot) || sessions[0]);
                if (scope === GLOBAL && sess) globalSnap = snapOf(sess.id);
                if (sess) {
                    const msgs = ctx.data.messages.list(sess.id).filter(
                        (m) => m && typeof m.content === "string" && m.content.trim() && !m.mediaType);
                    const lastA = [...msgs].reverse().find((m) => m.role === "assistant");
                    const lastU = [...msgs].reverse().find((m) => m.role === "user");
                    if (lastA) aText = lastA.content;
                    if (lastU) uText = lastU.content;
                    // session.contactId 存的其实是 characterId
                    const c = ctx.data.characters.get(sess.contactId);
                    if (c && c.avatar) aAvatar = c.avatar;
                    if (scope !== GLOBAL && sess.customCSS) sessCss = sess.customCSS;
                }
            } catch (e) { ctx.system.log("预览取数失败", e); }
            const clip = (t) => (t.length > 24 ? t.slice(0, 24) + "…" : t);
            return {
                aText: clip(aText || "刚忙完，怎么了？"),
                uText: clip(uText || "在吗"),
                aAvatar: aAvatar || PLACEHOLDER,
                // 「我」的头像与会话无关，任意快照里的都能用
                uAvatar: (last && last.uAvatar) || ctx.system.storage.get("avatarUser") || PLACEHOLDER,
                theme: themeFallback(sessCss, (globalSnap && globalSnap.theme) || (last && last.theme)),
                isGroup, aName,
                borrowedTheme: !!(last && last.theme),
            };
        }

        function el(tag, style, text) {
            const n = document.createElement(tag);
            if (style) n.style.cssText = style;
            if (text != null) n.textContent = text;
            return n;
        }

        // 手账主题令牌：米白纸、鹅黄主色、奶茶棕描边、墨色文字（对照 Codex 设计图）
        const T = {
            paper: "#F6F1E7", card: "#FFFDF8", ink: "#5B4636", sub: "#9A8877",
            line: "#E6DCCB", blue: "#5B8DD6", yellow: "#F5D76E", yellowDeep: "#E9C34A", brown: "#C9A887",
            pink: "#F4B8C1", red: "#D9534F", shadow: "0 2px 6px rgba(91,70,54,.12)",
        };
        const BTN = "font-size:12px;padding:6px 14px;border-radius:12px;cursor:pointer;line-height:1.2;"
            + `border:1px solid ${T.line};background:${T.card};color:${T.ink};`
            + `box-shadow:${T.shadow};font-family:inherit`;
        /** 贴纸风主按钮（鹅黄） */
        const BTN_MAIN = "flex:1;min-width:0;white-space:nowrap;font-size:14px;padding:11px 0;border-radius:14px;cursor:pointer;font-weight:700;"
            + `border:1px solid ${T.yellowDeep};background:linear-gradient(180deg,#FBE38E,${T.yellow});color:${T.ink};`
            + "box-shadow:0 3px 0 rgba(201,168,135,.35),0 6px 14px rgba(91,70,54,.15)";
        /** 面板内的输入弹窗：手机 WebView / PWA 里 window.prompt 可能直接被屏蔽，
         *  所以自己画一个。返回 null 表示取消。 */
        function askText(title, placeholder, value, hint) {
            return new Promise((res) => {
                const mask = el("div",
                    "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;"
                    + "justify-content:center;background:rgba(91,70,54,.35);padding:24px");
                const box = el("div",
                    `background:${T.card};border:1px solid ${T.line};border-radius:16px;padding:16px;`
                    + "max-width:320px;width:100%;box-shadow:0 12px 32px rgba(91,70,54,.28);"
                    + "display:flex;flex-direction:column;gap:10px");
                const inp = el("input",
                    `font-size:13px;padding:9px 10px;border-radius:10px;border:1px solid ${T.line};`
                    + `background:${T.paper};color:${T.ink};width:100%;box-sizing:border-box`);
                inp.placeholder = placeholder || ""; inp.value = value || "";
                box.append(el("div", `font-size:14px;font-weight:700;color:${T.ink}`, title), inp);
                if (hint) box.append(el("div", `font-size:10px;line-height:1.5;color:${T.sub}`, hint));
                const row = el("div", "display:flex;gap:8px");
                const ok = el("button", BTN_MAIN + ";padding:9px 0;font-size:13px", "确定");
                const no = el("button", BTN + ";flex:1;padding:9px 0;font-size:13px", "取消");
                row.append(no, ok); box.append(row);
                const done = (v) => { mask.remove(); res(v); };
                ok.addEventListener("click", () => done(inp.value));
                no.addEventListener("click", () => done(null));
                inp.addEventListener("keydown", (e) => { if (e.key === "Enter") done(inp.value); });
                mask.addEventListener("click", (e) => { if (e.target === mask) done(null); });
                mask.append(box); document.body.appendChild(mask);
                setTimeout(() => { try { inp.focus(); inp.select(); } catch { /* ignore */ } }, 30);
            });
        }

        /** 内联 SVG 线条图标（和宿主 Lucide 图标同风格：1.6 描边、圆头），颜色跟按钮文字色 */
        const ICON_PATHS = {
            upload: '<path d="M12 16V5"/><path d="m7 10 5-5 5 5"/><path d="M4 20h16"/>',
            download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
            pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
            trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
            reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5.5h5.5"/>',
            sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
            moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
            ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
            plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
            eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
        };
        /** 数值标签点一下弹输入框改精确值 */
        function numEdit(valEl, title, get, set) {
            valEl.style.cursor = "pointer"; valEl.title = "点击输入精确值";
            valEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                const v = await askText(title, "数值", String(get()), "");
                if (v == null || v === "" || isNaN(+v)) return;
                set(+v);
            });
        }
        function svgIcon(name, size) {
            return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
                + ` stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block">${ICON_PATHS[name] || ""}</svg>`;
        }
        /** 只有图标的小按钮：base 是 BTN / BTN_DANGER 这类基础样式 */
        function iconBtn(base, name, size) {
            const b = el("button", base + ";padding:5px 7px;display:inline-flex;align-items:center;justify-content:center;line-height:1;flex:0 0 auto");
            b.innerHTML = svgIcon(name, size);
            return b;
        }
        /** 预览卡外观：三个页签共用，只有气泡页额外吸顶 */
        // 内宽 = 375 − 12(外边距) − 2(边框) − 18(内边距) = 343，和聊天室消息列表一样宽；行距 16px 也照聊天室
        const PREV_CARD = "margin:0 6px 12px;border-radius:16px;padding:10px 9px;overflow:hidden;flex:0 0 auto;"
            + "box-shadow:0 10px 24px rgba(91,70,54,.18),0 1px 2px rgba(91,70,54,.06);"
            + `background:${T.card};border:1px solid ${T.line}`;
        /** 预览卡右上角的 ☀/☾：白底/黑底切换，三个页签共用一个状态（记在配置里，下次打开还在） */
        const dayNightCards = [];
        function paintDayNight() {
            const dark = !!config.prevDark;
            dayNightCards.forEach(({ card, btn }) => {
                if (dark) card.setAttribute("data-dark", "1"); else card.removeAttribute("data-dark");
                btn.innerHTML = svgIcon(dark ? "moon" : "sun", 14);
                btn.title = dark ? "黑底预览（点击换白底）" : "白底预览（点击换黑底）";
            });
        }
        function mountDayNight(card) {
            if (!card.style.position) card.style.position = "relative";
            const btn = el("button", null, "☀");
            btn.className = "avfp-daynight";
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                config.prevDark = !config.prevDark;
                persist(); paintDayNight();
            });
            card.append(btn);
            dayNightCards.push({ card, btn });
            paintDayNight();
        }
        /**
         * 滑块防误触：面板里所有 range 都不吃原生触摸（pointer-events:none），由这里统一接管。
         * 手指按在滑块上：先横向动 → 当作拖滑块（按手指 x 直接算值）；先纵向动 → 什么都不做，
         * 浏览器按 touch-action:pan-y 正常滚页面。原生 range 在手机上会把纵向滑动也吃掉，
         * 结果是页面滚不动、值还被误改。
         */
        function armSliders(root) {
            let st = null;   // { r, x0, y0, dir }
            const sliderAt = (x, y) => {
                const list = root.querySelectorAll('input[type="range"]');
                for (const r of list) {
                    if (r.offsetParent === null) continue;
                    const b = r.getBoundingClientRect();
                    if (x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 6 && y <= b.bottom + 6) return r;
                }
                return null;
            };
            const setFromX = (r, x, fire) => {
                const b = r.getBoundingClientRect();
                const mn = +r.min || 0, mx = r.max === "" ? 100 : +r.max;
                setFromValue(r, mn + Math.min(1, Math.max(0, (x - b.left) / Math.max(1, b.width))) * (mx - mn), fire);
            };
            const setFromValue = (r, raw, fire) => {
                const mn = +r.min || 0, mx = r.max === "" ? 100 : +r.max, step = +r.step || 1;
                let v = raw;
                v = Math.round((v - mn) / step) * step + mn;
                v = Math.min(mx, Math.max(mn, v));
                const dec = (String(step).split(".")[1] || "").length;
                const nv = v.toFixed(dec);
                if (r.value !== nv) { r.value = nv; if (fire) r.dispatchEvent(new Event("input", { bubbles: true })); }
            };
            // 拖的是「相对量」：按下时记住当前值，之后按手指横向位移换算，不按手指绝对位置定值。
            // 这样手指没正好压在圆钮上也不会跳；有些手机内核给出的 pointer 坐标不可靠（会是 0），
            // 直接按绝对坐标定值就会一划就归到最小——所以触摸一律走 touch 事件，pointer 只留给鼠标。
            const begin = (r, x, y) => {
                const b = r.getBoundingClientRect();
                const mn = +r.min || 0, mx = r.max === "" ? 100 : +r.max;
                st = { r, x0: x, y0: y, v0: +r.value, pxPerUnit: Math.max(1, b.width) / (mx - mn || 1), dir: null };
            };
            const move = (x, y) => {
                if (!st) return false;
                if (!st.dir) {
                    const dx = Math.abs(x - st.x0), dy = Math.abs(y - st.y0);
                    if (dx < 5 && dy < 5) return false;
                    st.dir = dx >= dy ? "h" : "v";
                    if (st.dir === "v") { st = null; return false; }   // 交给页面滚动
                }
                setFromValue(st.r, st.v0 + (x - st.x0) / st.pxPerUnit, true);
                return true;
            };
            const finish = (x, tapped) => {
                if (!st) return;
                const s = st; st = null;
                if (s.dir === "h") {
                    setFromValue(s.r, s.v0 + (x - s.x0) / s.pxPerUnit, true);
                    s.r.dispatchEvent(new Event("change", { bubbles: true }));
                } else if (!s.dir && tapped) {
                    // 原地点一下 = 点到哪值到哪（和原生一样）
                    setFromX(s.r, x, true);
                    s.r.dispatchEvent(new Event("change", { bubbles: true }));
                }
            };
            // 触摸
            root.addEventListener("touchstart", (e) => {
                if (e.touches.length !== 1) return;
                const t = e.touches[0];
                const r = sliderAt(t.clientX, t.clientY);
                if (r) begin(r, t.clientX, t.clientY);
            }, { passive: true });
            root.addEventListener("touchmove", (e) => {
                if (!st || e.touches.length !== 1) return;
                const t = e.touches[0];
                if (move(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
            }, { passive: false });
            root.addEventListener("touchend", (e) => {
                const t = e.changedTouches[0];
                if (t) finish(t.clientX, true);
            });
            root.addEventListener("touchcancel", () => { st = null; });
            // 鼠标（桌面调试用）
            root.addEventListener("pointerdown", (e) => {
                if (e.pointerType !== "mouse" || e.button !== 0) return;
                const r = sliderAt(e.clientX, e.clientY);
                if (r) begin(r, e.clientX, e.clientY);
            });
            root.addEventListener("pointermove", (e) => {
                if (e.pointerType !== "mouse" || !st) return;
                if (move(e.clientX, e.clientY)) e.preventDefault();
            });
            root.addEventListener("pointerup", (e) => { if (e.pointerType === "mouse") finish(e.clientX, true); });
            root.addEventListener("pointercancel", () => { st = null; });
        }
        /** 整体调整的一格：标签 · 滑块 · 数值 同一行（两页共用） */
        const CELL = "display:flex;align-items:center;gap:6px;flex:1;min-width:0";
        const CELL_LAB = `font-size:11px;color:${T.ink};flex:0 0 auto;width:24px`;
        const CELL_VAL = `font:10px ui-monospace,monospace;color:${T.sub};flex:0 0 auto;width:34px;text-align:right`;
        /** 标题行点一下收起/展开 body；默认收起（滑块太多容易误触）。标题里的 ↺ 不受影响 */
        function collapsible(cap, titleEl, body, defaultOpen) {
            const bodies = Array.isArray(body) ? body : [body];
            const shown = bodies.map((b) => b.style.display || "");
            const arrow = el("span", "display:inline-block;width:7px;font-size:9px;line-height:1;margin-right:1px;color:" + T.sub, "");
            titleEl.style.cursor = "pointer";
            titleEl.prepend(arrow);
            let open = !!defaultOpen;
            const paint = () => {
                bodies.forEach((b, i) => { b.style.display = open ? shown[i] : "none"; });
                arrow.textContent = open ? "▾" : "▸";
            };
            titleEl.addEventListener("click", () => { open = !open; paint(); });
            paint();
            return { isOpen: () => open, set: (v) => { open = !!v; paint(); } };
        }
        /** 库格子左上角的 ✎ 重命名钮（和右上角的 × 成对，头像库/气泡库共用） */
        function renameBtn(title, getName, onDone) {
            const b = el("button",
                "position:absolute;top:-5px;left:-5px;width:16px;height:16px;border-radius:50%;border:none;"
                + "background:rgba(0,0,0,.55);color:#fff;font-size:10px;line-height:16px;padding:0;cursor:pointer", "✎");
            b.title = "重命名";
            b.addEventListener("click", async (e) => {
                e.stopPropagation();
                const v = ((await askText(title, "输入新名字", getName(), "留空 = 不改")) || "").trim();
                if (v && v !== getName()) onDone(v);
            });
            return b;
        }
        /** 危险按钮（红描边贴纸） */
        // 危险按钮：除了颜色，尺寸参数必须和 BTN 完全一致，否则同一行里高度对不齐
        const BTN_DANGER = "font-size:12px;padding:6px 14px;border-radius:12px;cursor:pointer;line-height:1.2;"
            + `border:1px solid ${T.red};background:${T.card};color:${T.red};`
            + `box-shadow:${T.shadow};font-family:inherit`;

        // ══ 气泡框 ════════════════════════════════════════════
        // 数据模型：一个气泡 = 一张可拉伸底板（九宫格）+ 若干张锚定装饰 + 文字样式。
        // 这与 QQ 的做法一致，也解释了为什么每个气泡在缓存里是 2~3 个文件。
        //
        // 为什么装饰不用 border-image：border-image 里的动图只显示第一帧（实测），
        // 而多重 background-image 能正常播放动态 WebP。底板用 border-image（要拉伸），
        // 装饰用 background 图层（要锚定），两者叠在同一个元素上，不额外增加 DOM。
        const BUBBLE_ROLES = [["assistant", "对方"], ["user", "我的"]];
        const ANCHORS = [
            ["lt", "左上"], ["ct", "上中"], ["rt", "右上"],
            ["lc", "左中"], ["cc", "居中"], ["rc", "右中"],
            ["lb", "左下"], ["cb", "下中"], ["rb", "右下"],
        ];
        // 这类气泡整张都是边框，没有可拉伸的图案区——只有正中间那一点填充色能拉。
        // 所以默认切到只剩中心 1px：四周原样不变形，中间 1px 负责撑开。
        // 素材是 @3x 的（QQ 把 112px 高的源图渲染成约 60 CSS px），故默认缩放取 1/3。
        const centerSlice = (w, h) => {
            const l = Math.floor((w - 1) / 2), t = Math.floor((h - 1) / 2);
            return [l, t, w - 1 - l, h - 1 - t];
        };
        // 文字区默认：水平占 10%~90%，垂直取中间三分之一——这样单行正好贴合
        // 边角高度（不虚高），换行时才开始长高。
        const contentDefault = (a) => [
            Math.round(a.w * 0.10), Math.round(a.h * 0.33),
            Math.round(a.w * 0.90), Math.round(a.h * 0.67),
        ];
        let _uid = 0;
        const newUid = () => `u${Date.now().toString(36)}_${_uid++}`;
        const DEFAULT_BUBBLE = () => ({
            baseId: "", slice: [63, 55, 64, 56], layers: [],
            color: "", size: 13.5, scale: 0.54, content: null,
            zorder: ["text"],      // 底→顶；"text" 是文字层，其余是图层 uid
        });
        /** 补齐 uid 与 zorder；老模型的 baseId 迁移为最底下的拉伸图层 */
        function normalizeBubble(b) {
            if (b.baseId) {
                const a0 = assetById(b.baseId);
                const L0 = { uid: newUid(), id: b.baseId, mode: "stretch",
                    slice: (b.slice || (a0 ? centerSlice(a0.w, a0.h) : [63, 55, 64, 56])).slice(),
                    anchor: "lc", dx: 0, dy: 0,
                    w: a0 ? a0.w : 128, h: a0 ? a0.h : 112 };
                b.layers = [L0].concat(b.layers || []);
                if (!Array.isArray(b.zorder)) b.zorder = [];
                b.zorder.unshift(L0.uid);
                delete b.baseId;
            }
            (b.layers || []).forEach((L) => { if (!L.uid) L.uid = newUid(); });
            const uids = (b.layers || []).map((L) => L.uid);
            if (!Array.isArray(b.zorder)) b.zorder = [];
            b.zorder = b.zorder.filter((z) => z === "text" || uids.includes(z));
            uids.forEach((u) => { if (!b.zorder.includes(u)) b.zorder.splice(Math.max(0, b.zorder.length - 1), 0, u); });
            if (!b.zorder.includes("text")) b.zorder.push("text");
            return b;
        }

        let bubbleAssets = ctx.system.storage.get("bubbleAssets") || [];
        let bubblePacks = ctx.system.storage.get("bubblePacks") || [];
        let bubbleFonts = ctx.system.storage.get("bubbleFonts") || [];
        /** 头像包：一个包 = 一整套图层（两侧各一份），和气泡包同构 */
        let avatarPacks = ctx.system.storage.get("avatarPacks") || [];

        // ══ 输入栏 ═══════════════════════════════════════════
        // 分元素上传：整条栏、输入框、按钮区各自一张图，各铺各的元素，
        // 不存在「图和框对不上」的问题（一张大图包住整条才需要标线对位）。
        // 每张图可选九宫格切线，保证圆角花边拉伸时不变形。
        const BAR_PARTS = [
            ["bar", "整条栏", ".chat-input-bar"],
            ["box", "输入框", ".chat-input-bar .chat-input-textarea"],
            ["act", "按钮区", ".chat-input-bar .chat-input-actions"],
        ];
        if (!config.inputBar) config.inputBar = {};
        if (typeof config.inputEnabled !== "boolean") config.inputEnabled = false;

        /** 一个部件的样式：有图走九宫格，无图则只应用颜色等覆盖 */
        function barPartRule(sel, cfg) {
            if (!cfg) return "";
            const out = [];
            const a = cfg.id ? assetById(cfg.id) : null;
            if (a) {
                const k = cfg.scale || 1;
                const sl = cfg.slice || centerSlice(a.w, a.h);
                const bw = sl.map((v) => Math.max(1, Math.round(v * k)));
                out.push(`  border-style: solid;`);
                out.push(`  border-width: ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px;`);
                out.push(`  border-image: url("${a.src}") ${sl[1]} ${sl[2]} ${sl[3]} ${sl[0]} fill`
                    + ` / ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px / 0 stretch;`);
                out.push(`  background-color: transparent;`);
                out.push(`  backdrop-filter: none; -webkit-backdrop-filter: none;`);
            } else if (cfg.bg) {
                out.push(`  background: ${cfg.bg};`);
                out.push(`  backdrop-filter: none; -webkit-backdrop-filter: none;`);
            }
            if (cfg.radius != null) out.push(`  border-radius: ${cfg.radius}px;`);
            if (cfg.color) out.push(`  color: ${cfg.color};`);
            return out.length ? `\n${sel} {\n${out.join("\n")}\n}` : "";
        }

        function buildInputCSS() {
            if (!config.inputEnabled) return "";
            let css = "";
            Object.keys(config.inputBar).forEach((key) => {
                const i = key.lastIndexOf(":");
                const scope = key.slice(0, i), part = key.slice(i + 1);
                const meta = BAR_PARTS.find((p) => p[0] === part);
                if (!meta) return;
                const scopeSel = scope === GLOBAL ? "" : `.session-${scope} `;
                css += barPartRule(`html[data-avframe="1"] ${scopeSel}${meta[2]}`, config.inputBar[key]);
            });
            // 输入框文字与占位符颜色跟着走
            Object.keys(config.inputBar).forEach((key) => {
                const cfg = config.inputBar[key];
                if (!cfg || !cfg.color || !key.endsWith(":box")) return;
                const scope = key.slice(0, key.lastIndexOf(":"));
                const scopeSel = scope === GLOBAL ? "" : `.session-${scope} `;
                css += `\nhtml[data-avframe="1"] ${scopeSel}.chat-input-bar .chat-input-textarea::placeholder`
                    + ` { color: color-mix(in srgb, ${cfg.color} 55%, transparent); }`;
            });
            return css;
        }
        const fontById = (id) => bubbleFonts.find((f) => f.id === id) || null;
        const fontFamily = (id) => `avf-font-${id}`;
        /** 字体的 @font-face 单独常驻（dataURL 很大，跟着 apply 反复注入会卡） */
        function ensureFontStyle(f) {
            if (document.getElementById(`avf-font-style-${f.id}`)) return;
            const st = document.createElement("style");
            st.id = `avf-font-style-${f.id}`;
            st.textContent = `@font-face { font-family: "${fontFamily(f.id)}"; src: url("${f.src}"); font-display: swap; }`;
            document.head.appendChild(st);
        }
        bubbleFonts.forEach(ensureFontStyle);
        // 一次性修复：3.11.5～3.11.7 会把贴纸的宽高分别压到底图尺寸以内（贴纸被压扁）。
        // 贴纸基本都来自气泡包，包里还留着原始宽高，按素材 id 对回去。
        if (config.stickerFix !== 1) {
            try {
                const orig = new Map();
                bubblePacks.forEach((pk) => Object.values(pk.sides || {}).forEach((sd) =>
                    (sd && sd.layers || []).forEach((L) => { if (L.mode !== "stretch" && L.w && L.h) orig.set(L.id, [L.w, L.h]); })));
                let fixed = 0;
                Object.values(config.bubbles || {}).forEach((b) => (b && b.layers || []).forEach((L) => {
                    if (L.mode === "stretch") return;
                    const o = orig.get(L.id);
                    if (o && (L.w !== o[0] || L.h !== o[1]) && !L.fw && !L.fh) { L.w = o[0]; L.h = o[1]; fixed++; }
                }));
                config.stickerFix = 1;
                ctx.system.storage.set(STORE_CONFIG, config);
                if (fixed) ctx.system.log(`已修复 ${fixed} 个被压扁的贴纸尺寸`);
            } catch (e) { ctx.system.log("贴纸尺寸修复失败", e); }
        }
        /** 设置面板的公共样式：inline 盖不到的部分（滑块、按压反馈、分区标题）在这里定 */
        const PANEL_STYLE_VER = "2.0.0";
        function ensurePanelStyle() {
            const old = document.getElementById("avf-panel-style");
            if (old && old.getAttribute("data-ver") === PANEL_STYLE_VER) return;
            if (old) old.remove();                       // 旧版残留会压住新样式，必须换掉
            const st = document.createElement("style");
            st.id = "avf-panel-style";
            st.setAttribute("data-ver", PANEL_STYLE_VER);
            st.textContent = `
.avfp{background-color:${T.paper}!important;background-image:url("${ART.paper}")!important;
  background-size:128px 128px!important;color:${T.ink}!important;
  font-family:-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif;
  /* 拖滑块/拖切线时手指一划就把界面文字选中了，很碍事：整块禁选，
     只有真正要输入的地方放开 */
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.avfp input,.avfp textarea,.avfp select{-webkit-user-select:auto;user-select:auto}
/* 滑块：默认那个钮太小按不住，自己画一个 26px 的大钮 + 加粗轨道 */
.avfp input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;
  height:34px;margin:0;width:100%;touch-action:pan-y;pointer-events:none}
.avfp{touch-action:pan-y}
.avfp .avfp-tabstrip::-webkit-scrollbar{display:none}
.avfp input[type=range]::-webkit-slider-runnable-track{height:10px;border-radius:5px;
  background:linear-gradient(90deg,${T.yellow},${T.yellowDeep});border:1px solid ${T.line}}
.avfp input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
  width:26px;height:26px;border-radius:50%;background:${T.card};border:2px solid ${T.yellowDeep};
  box-shadow:0 2px 5px rgba(91,70,54,.3);margin-top:-9px;cursor:pointer}
.avfp input[type=range]:active::-webkit-slider-thumb{transform:scale(1.12)}
.avfp input[type=range]::-moz-range-track{height:10px;border-radius:5px;background:${T.yellow};border:1px solid ${T.line}}
.avfp input[type=range]::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:${T.card};
  border:2px solid ${T.yellowDeep};box-shadow:0 2px 5px rgba(91,70,54,.3)}
.avfp input[type=range]:disabled::-webkit-slider-thumb{background:${T.line};border-color:${T.line}}
.avfp button{transition:transform .08s ease,box-shadow .15s ease,filter .15s ease;font-family:inherit}
.avfp button:active{transform:scale(.95)}
.avfp select{outline:none;font-family:inherit;color:${T.ink};background:${T.card};border:1px solid ${T.line};border-radius:12px}
.avfp input[type=text],.avfp input:not([type]){color:${T.ink};background:${T.card};border:1px solid ${T.line};border-radius:12px}
.avfp ::-webkit-scrollbar{width:0;height:0}
/* 胶带式分段按钮：宿主 .chat-list-tab 在面板内换皮 */
.avfp .chat-list-tab{background:${T.card}!important;color:${T.sub}!important;border:1px solid ${T.line}!important;
  border-radius:10px!important;box-shadow:${T.shadow}!important;font-weight:500!important}
.avfp .chat-list-tab.active{background-image:url("${ART.s_tape_yellow}")!important;background-size:100% 100%!important;
  background-color:${T.yellow}!important;color:${T.ink}!important;border-color:${T.yellowDeep}!important;font-weight:700!important}
/* 分区标题：胶带小条 + 手绘星星 */
.avfp .avfp-sec{display:flex;align-items:center;gap:6px;font-weight:700;color:${T.ink}}
/* 便签卡 */
.avfp .avfp-card{background:${T.card};border:1px solid ${T.line};border-radius:14px;box-shadow:${T.shadow}}
.avfp .avfp-sec{position:relative;padding-left:8px;letter-spacing:.02em}
.avfp .avfp-sec::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:4px;height:13px;border-radius:2px;background:${T.yellowDeep}}
.avfp .avfp-card[data-dark="1"]{background:#1b1c1f !important;border-color:#33353a !important}
.avfp input[type=range]{touch-action:pan-y}
.avfp .avfp-daynight{position:absolute;display:inline-flex;align-items:center;justify-content:center;top:6px;right:8px;z-index:6;width:26px;height:26px;border-radius:50%;border:1px solid ${T.line};background:${T.card};color:${T.ink};font-size:14px;line-height:24px;text-align:center;padding:0;cursor:pointer;box-shadow:${T.shadow}}
.avfp .avfp-card[data-dark="1"] .avfp-daynight{background:#2a2b30;border-color:#44464c;color:#f2d98a}
.avfp .avfp-cell:active{transform:scale(.97)}
/* 胶带式开关（气泡/贴纸） */
.avfp .avfp-sw{display:inline-block;width:44px;height:24px;border-radius:12px;position:relative;
  border:1px solid ${T.line};background:${T.card};vertical-align:middle;flex:0 0 auto}
.avfp .avfp-sw::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
  background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow};transition:left .15s}
.avfp .avfp-sw.on{background:${T.yellow};border-color:${T.yellowDeep}}
.avfp .avfp-sw.on::after{left:22px}
`;
            document.head.appendChild(st);
        }
        if (!config.bubbles) config.bubbles = {};
        if (typeof config.bubbleEnabled !== "boolean") config.bubbleEnabled = false;

        const assetById = (id) => bubbleAssets.find((a) => a.id === id) || null;
        // 旧版「单图导入」的包：整张原图按 0.54 铺开、切线在正中 1px，大图会撑满屏。
        // 这里把已经存下来的这类气泡就地修正（缩到约 72px 高、四周留 30% 角），不用重新导。
        function fixSingleImageBubble(b) {
            if (!b || !Array.isArray(b.layers) || b.layers.length !== 1) return false;
            const L = b.layers[0]; const a0 = assetById(L.id);
            if (!a0 || L.mode !== "stretch" || !Array.isArray(L.slice)) return false;
            const sl = L.slice;
            const midW = a0.w - sl[0] - sl[2], midH = a0.h - sl[1] - sl[3];
            // 中间可拉伸的部分不到 10%：整张图都被当成角，撑开后中间只剩一条被拉糊的线
            if (midW > a0.w * 0.1 && midH > a0.h * 0.1) return false;
            const k = b.scale == null ? 0.54 : b.scale;
            if (a0.h * k > 120) b.scale = Math.max(0.05, Math.min(1, +(72 / a0.h).toFixed(3)));
            L.slice = [Math.round(a0.w * 0.3), Math.round(a0.h * 0.3), Math.round(a0.w * 0.3), Math.round(a0.h * 0.3)];
            b.content = null;
            return true;
        }
        {
            let fixed = 0;
            Object.values(config.bubbles).forEach((b) => { if (fixSingleImageBubble(b)) fixed++; });
            bubblePacks.forEach((pk) => Object.values(pk.sides || {}).forEach((b) => { if (fixSingleImageBubble(b)) fixed++; }));
            if (fixed) {
                ctx.system.storage.set(STORE_CONFIG, config);
                ctx.system.storage.set("bubblePacks", bubblePacks);
                ctx.system.log(`已修正 ${fixed} 个撑满屏的单图气泡`);
            }
        }
        const bubbleKey = (scope, role) => `${scope}:${role}`;

        function resolveBubble(scope, role) {
            const own = config.bubbles[bubbleKey(scope, role)];
            if (own) return own.baseId || own.layers.length ? own : null;
            if (scope === GLOBAL) return null;
            const g = config.bubbles[bubbleKey(GLOBAL, role)];
            return g && (g.baseId || g.layers.length) ? g : null;
        }
        /** 某一侧「已生效」的气泡（会话没有就回落全局，都没有就默认空） */
        function liveBubble(scope, role) {
            // 没启用时聊天室里就是宿主默认气泡，「已生效」也得按默认画（否则停用后另一侧还挂着旧皮肤）
            if (!config.bubbleEnabled) return normalizeBubble(DEFAULT_BUBBLE());
            const L = config.bubblesLive || {};
            const has = (b) => b && (b.baseId || (b.layers || []).length || b.color);
            const own = L[bubbleKey(scope, role)];
            if (own && has(own)) return normalizeBubble(JSON.parse(JSON.stringify(own)));
            if (scope !== GLOBAL) {
                const g = L[bubbleKey(GLOBAL, role)];
                if (g && has(g)) return normalizeBubble(JSON.parse(JSON.stringify(g)));
            }
            return normalizeBubble(DEFAULT_BUBBLE());
        }
        function editableBubble(scope, role) {
            const k = bubbleKey(scope, role);
            if (!config.bubbles[k]) {
                const inherited = resolveBubble(scope, role);
                config.bubbles[k] = inherited
                    ? JSON.parse(JSON.stringify(inherited))
                    : DEFAULT_BUBBLE();
            }
            return normalizeBubble(config.bubbles[k]);
        }

        /** 锚点 → background-position。已知图层尺寸，居中直接算成偏移，避免三值语法的兼容坑 */
        function anchorPos(L) {
            const an = L.anchor || "lc", ax = an[0], ay = an[1];
            // fw/fh = 该轴跟随气泡拉伸（铺满），位置只剩偏移量有意义
            const x = (L.fw || ax === "l") ? `left ${L.dx}px`
                : ax === "r" ? `right ${L.dx}px`
                : `left calc(50% - ${L.w / 2 - L.dx}px)`;
            const y = (L.fh || ay === "t") ? `top ${L.dy}px`
                : ay === "b" ? `bottom ${L.dy}px`
                : `top calc(50% - ${L.h / 2 - L.dy}px)`;
            return `${x} ${y}`;
        }
        const anchorSize = (L) => `${L.fw ? "100%" : L.w + "px"} ${L.fh ? "100%" : L.h + "px"}`;


        /** 把 zorder 解析成渲染栈：最底下的拉伸图层承担气泡主体（border-image），
         * 其上最多两个图层走伪元素（真 z 序），再多的垫底；文字按 zorder 拿 z-index。 */
        function resolveStack(b) {
            normalizeBubble(b);
            const items = b.zorder.map((z) => {
                if (z === "text") return { kind: "text", key: "text" };
                const L = b.layers.find((x) => x.uid === z);
                const a = L && assetById(L.id);
                return L && a ? { kind: "img", key: L.uid, L, a } : null;
            }).filter(Boolean);
            let base = null;
            const above = [];
            for (const it of items) {
                if (it.kind === "img" && !base && it.L.mode === "stretch") { base = it; continue; }
                above.push(it);
            }
            if (!base) {
                // 一个拉伸层都没有：最底下的图片层顶上（否则气泡没有身体，正文裸奔）
                const i = above.findIndex((it) => it.kind === "img");
                if (i >= 0) base = above.splice(i, 1)[0];
            }
            // 层级真正按 zorder 来：
            //   base 之下的图层 → 元素背景（画在边框图之下）
            //   base 之上、文字之下 → ::before（z 1）
            //   文字之上           → ::after（z 100）
            // 每个伪元素里：贴纸走 background-image（列表越靠前越在上面），拉伸层走 border-image（永远压在同桶贴纸之上）。
            const extras = [], buckets = [
                { pseudo: "before", z: 1, stretch: null, stickers: [] },
                { pseudo: "after", z: 100, stretch: null, stickers: [] },
            ];
            let seenBase = !base, seenText = false;
            for (const it of items) {
                if (it === base) { seenBase = true; continue; }
                if (it.kind === "text") { seenText = true; continue; }
                if (!seenBase) { extras.push(it); continue; }
                const bk = buckets[seenText ? 1 : 0];
                if (it.L.mode === "stretch") {
                    // 同一桶里只能有一张拉伸图；多出来的退化成铺满的贴纸
                    if (bk.stretch) bk.stickers.push({ ...it, L: { ...it.L, mode: "anchor", fw: true, fh: true, dx: 0, dy: 0, anchor: "lt" } });
                    else bk.stretch = it;
                } else bk.stickers.push(it);
            }
            const overlays = buckets.flatMap((bk) => bk.stickers.concat(bk.stretch ? [bk.stretch] : []));
            const zPos = { text: 50 };
            return { base, overlays, extras, buckets, zPos };
        }
        /** 一个桶里的贴纸/拉伸层 → CSS 声明串（伪元素和预览的覆盖层共用） */
        function bucketCSS(bk, bw, baseSl, k) {
            let css = "";
            if (bk.stickers.length) {
                const ss = bk.stickers.slice().reverse();   // background-image 列表：先写的在上面
                css += ` background-image: ${ss.map((x) => imgSrc(x.a.src)).join(", ")};`
                    + ` background-repeat: ${ss.map(() => "no-repeat").join(", ")};`
                    + ` background-size: ${ss.map((x) => anchorSize(x.L)).join(", ")};`
                    + ` background-position: ${ss.map((x) => anchorPos(x.L)).join(", ")};`
                    + ` background-origin: border-box; background-clip: border-box;`;
            }
            if (bk.stretch) {
                // 关键：和底板用同一组切线，否则两张各拉各的，中间会露出透明缝
                // 每层用自己的切线，边框宽也按自己的切线×倍率算：四角永远不变形（否则脸/嘴会错位），
                // 切线编辑器改哪层就动哪层。两层切线不一致时拉伸区会错开，靠编辑器把线对齐即可。
                const sl = layerSlice(bk.stretch, baseSl);
                const lw = (sl === baseSl || k == null) ? bw : sl.map((v) => Math.max(1, Math.round(v * k)));
                css += ` border-style: solid; border-width: ${lw[1]}px ${lw[2]}px ${lw[3]}px ${lw[0]}px;`
                    + ` border-image: ${imgSrc(bk.stretch.a.src)} ${sl[1]} ${sl[2]} ${sl[3]} ${sl[0]} fill`
                    + ` / ${lw[1]}px ${lw[2]}px ${lw[3]}px ${lw[0]}px / 0 stretch;`;
            }
            return css;
        }

        /** 图片值：alpha<1 时用 cross-fade 到透明来降低不透明度（元素 opacity 会连文字一起变淡） */
        function imgSrc(src) { return `url("${src}")`; }
        /** 透明度 <1 时的分层方案：元素本身只留透明边框撑位置，
         *  底板搬到 ::before、其余图层合到 ::after（文字之下），两者各自 opacity。
         *  代价：本来排在文字之上的图层会落到文字之下（只在开了透明时）。 */
        const useAlpha = (b) => b && b.alpha != null && +b.alpha < 0.995;
        function alphaBuckets(st) {
            const all = st.buckets.flatMap((bk) => bk.stickers.concat(bk.stretch ? [bk.stretch] : []));
            const stretches = all.filter((x) => x.L.mode === "stretch");
            const stickers = all.filter((x) => x.L.mode !== "stretch")
                .concat(stretches.slice(1).map((x) => ({ ...x, L: { ...x.L, mode: "anchor", fw: true, fh: true, dx: 0, dy: 0, anchor: "lt" } })));
            return [
                { pseudo: "before", z: 1, stretch: st.base, stickers: st.extras.slice().reverse() },
                { pseudo: "after", z: 2, stretch: stretches[0] || null, stickers },
            ];
        }
        function layerSlice(it, fallback) {
            return it.L.slice || fallback || centerSlice(it.a.w, it.a.h);
        }

        function bubbleRule(scope, role, b, excludeSessions) {
            const st = resolveStack(b);
            if (!st.base && !st.overlays.length && !st.extras.length && !b.color) return "";
            // 全局规则要绕开那些明确「不使用」的聊天（它们没有自己的规则可覆盖，只能从全局里排除）。
            // 用 :where() 包住排除项，特异度不增加，会话自己的规则（多一个 .session-x）仍然压得住全局。
            const excl = (scope === GLOBAL && excludeSessions && excludeSessions.length)
                ? `:where(${excludeSessions.map((s) => `:not(.session-${s})`).join("")})` : "";
            // 头像框页的预览卡（.avfp-card，会话时带 .session-x）也要能套上已生效的气泡皮肤，所以和聊天室并列
            const scopeSel = scope === GLOBAL
                ? `:is(.chat-room-wrapper, .avfp-card)${excl} `
                : `:is(.chat-room-wrapper, .avfp-card).session-${scope} `;
            // 媒体卡片（转账/图片/贴纸/红包…带 .chat-bubble-media）与 HTML 卡片不套皮肤、不挪位置。
            // 设置面板里的预览气泡也要排除：它用真实类名，但样式由草稿实时写在行内，
            // 不排除的话「已应用的那份」会用伪元素再画一遍，看起来像贴纸被复制了。
            const sel = `html[data-avframe="1"] ${scopeSel}.chat-bubble-role-${role}`
                + `:not(.chat-bubble-media):not(.chat-bubble-html-preview):not(.avf-prev-bubble)`;
            const k = b.scale || 1;
            const baseSl = st.base ? layerSlice(st.base) : null;
            const bw = baseSl ? baseSl.map((v) => Math.max(1, Math.round(v * k))) : [0, 0, 0, 0];
            const out = [];
            out.push(`  padding: 0;`);
            out.push(`  overflow: visible;`);
            out.push(`  background-color: transparent;`);
            out.push(`  box-shadow: none;`);
            out.push(`  width: fit-content;`);
            out.push(`  max-width: 100%;`);
            out.push(`  position: relative;`);
            out.push(`  isolation: isolate;`);   // 内部 z-index 不外泄，否则文字会盖到输入栏上
            // 纵向 flex + 文字块 flex:1：气泡被 min-height 撑高时，多出来的空间归文字块，
            // 它内部再居中，文字才会真的跟着文字区一起走（否则只贴在上边）
            out.push(`  display: flex;`);
            out.push(`  flex-direction: column;`);

            // 镜像（左右翻转整套皮肤）也走分层方案：图全搬到伪元素上翻，文字不翻
            const alphaMode = (useAlpha(b) || !!b.mirror) && !!st.base;
            if (st.base) {
                out.push(`  box-sizing: border-box;`);
                out.push(`  min-width: ${Math.round(st.base.a.w * k)}px;`);
                out.push(`  min-height: ${Math.round(st.base.a.h * k)}px;`);
                out.push(`  border-style: solid;`);
                out.push(`  border-width: ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px;`);
                if (alphaMode) out.push(`  border-color: transparent;`);
                else out.push(`  border-image: ${imgSrc(st.base.a.src)} ${baseSl[1]} ${baseSl[2]} ${baseSl[3]} ${baseSl[0]} fill`
                    + ` / ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px / 0 stretch;`);
                out.push(`  border-radius: 0;`);
            }
            if (st.extras.length && !alphaMode) {
                // 排在气泡主体之下的图层：元素背景，画在边框图之下
                out.push(`  background-image: ${st.extras.map((x) => imgSrc(x.a.src)).join(", ")};`);
                out.push(`  background-position: ${st.extras.map((x) => anchorPos(x.L)).join(", ")};`);
                out.push(`  background-size: ${st.extras.map((x) => anchorSize(x.L)).join(", ")};`);
                out.push(`  background-repeat: ${st.extras.map(() => "no-repeat").join(", ")};`);
                out.push(`  background-origin: border-box; background-clip: border-box;`);
            }
            // 左右位置的语义是「推离自己头像的距离」：对方在左往右推，我在右往左推（镜像）
            const tx = (role === "user" ? -b.ox : b.ox) || 0, ty = b.oy || 0;
            if (b.ox || b.oy) out.push(`  transform: translate(${tx}px, ${ty}px);`);
            if (b.color) out.push(`  color: ${b.color};`);
            if (b.size) out.push(`  font-size: ${b.size}px;`);
            let inner = "";
            if (b.ox || b.oy) {
                // 群聊里气泡上方有发言人名字：位移改挂到「名字+气泡」这个整体上，气泡自己不再位移，
                // 否则往上挪会把名字盖住
                const wrapSel = `html[data-avframe="1"] ${scopeSel}.chat-msg-wrapper[data-role="${role}"]:not(.avf-preview)`
                    + ` .chat-msg-content-wrap:has(> .chat-group-sender-name)`;
                inner += `\n${wrapSel} { transform: translate(${tx}px, ${ty}px); }`
                    + `\n${wrapSel} > .chat-bubble-role-${role} { transform: none; }`;
            }
            (alphaMode ? alphaBuckets(st) : st.buckets).forEach((bk) => {
                if (!bk.stretch && !bk.stickers.length) return;
                inner += `\n${sel}::${bk.pseudo} { content: ""; position: absolute; pointer-events: none;`
                    + ` inset: ${-bw[1]}px ${-bw[2]}px ${-bw[3]}px ${-bw[0]}px; z-index: ${bk.z};`
                    + (useAlpha(b) ? ` opacity: ${(+b.alpha).toFixed(2)};` : "")
                    + (b.mirror ? ` transform: scaleX(-1);` : "")
                    + bucketCSS(bk, bw, baseSl, k) + ` }`;
            });
            if (st.base) {
                const cb0 = b.content || contentDefault(st.base.a);
                const mT = Math.round(cb0[1] * k) - bw[1];
                const mL = Math.round(cb0[0] * k) - bw[0];
                const mR = Math.round((st.base.a.w - cb0[2]) * k) - bw[2];
                const mB = Math.round((st.base.a.h - cb0[3]) * k) - bw[3];
                // 文字在「文字区」里上下左右居中：气泡被撑大时不会贴着左上角
                const rh = Math.max(0, Math.round((cb0[3] - cb0[1]) * k));   // 文字区高度
                // 黄线对的是「字的墨迹」而不是行框：行高 1.5 时字上下各有 0.25em 空白，
                // 把上下边距各收回 0.25em、文字区高度补回 0.5em，字的顶端才真的贴到上边线
                // 镜像时文字区左右也要跟着翻
                const [mLx, mRx] = b.mirror ? [mR, mL] : [mL, mR];
                inner += `\n${sel} .chat-markdown { margin: calc(${mT}px - .25em) ${mRx}px calc(${mB}px - .25em) ${mLx}px;`
                    + ` position: relative; z-index: ${st.zPos["text"] || 99}; line-height: 1.5;`
                    // 文字块至少撑满文字区，块内上下居中：短文字落在区中心，多行就把区（连同气泡）撑高。
                    // 不用 transform/max()——部分手机 WebView 不认 max()，整条 transform 会被丢掉导致文字偏上。
                    + ` flex: 1 1 auto; min-height: calc(${rh}px + .5em); box-sizing: border-box;`
                    + ` display: flex; flex-direction: column; justify-content: center;`
                    + ` align-items: center; text-align: left; transform: none; }`;
                // 引用消息：气泡里是「引用预览 + 正文」被 .chat-quote-message 包着，文字区规则要套在这个外壳上，
                // 里面的 .chat-markdown 恢复普通排版，否则引用条会跑到文字区外面
                inner += `\n${sel} > .chat-quote-message { margin: calc(${mT}px - .25em) ${mRx}px calc(${mB}px - .25em) ${mLx}px;`
                    + ` position: relative; z-index: ${st.zPos["text"] || 99}; flex: 1 1 auto; min-height: calc(${rh}px + .5em);`
                    + ` box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; max-width: none; }`
                    // 引用里的正文按普通块排：靠左，不再在壳里水平居中
                    + `\n${sel} .chat-quote-message .chat-markdown { margin: 0; min-height: 0; flex: 0 0 auto; transform: none;`
                    + ` display: block; text-align: left; align-items: flex-start; }`;
                // 语音条：波形条整体当作「文字」放进文字区居中（用户要求语音条也套皮肤）
                inner += `\n${sel} .voice-msg-bubble { margin: calc(${mT}px - .25em) ${mRx}px calc(${mB}px - .25em) ${mLx}px;`
                    + ` position: relative; z-index: ${st.zPos["text"] || 99}; flex: 1 1 auto; min-height: calc(${rh}px + .5em);`
                    + ` box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0 6px; }`;
            }
            if (b.color) inner += `\n${sel} .chat-markdown, ${sel} .chat-markdown * { color: ${b.color}; }`
                // 语音条的图标 / 波形 / 时长也跟文字颜色走
                + `\n${sel} .voice-msg-icon, ${sel} .voice-msg-dur { color: ${b.color}; }`
                + `\n${sel} .voice-msg-bar { background: ${b.color}; }`
                + `\n${sel} .voice-msg-icon-shell { background: color-mix(in srgb, ${b.color} 14%, transparent); }`;
            if (b.font && fontById(b.font)) inner += `\n${sel}, ${sel} .chat-markdown, ${sel} .chat-markdown * {`
                + ` font-family: "${fontFamily(b.font)}", -apple-system, sans-serif; }`;
            return `\n${sel} {\n${out.join("\n")}\n}${inner}`;
        }


        function buildBubbleCSS() {
            if (!config.bubbleEnabled) return "";
            let css = "";
            // 注入的是「已生效」那份，不是面板里正在改的草稿
            const live = config.bubblesLive || {};
            const keys = Object.keys(live);
            const ordered = keys.slice().sort((a, b) =>
                (a.startsWith(GLOBAL) ? 0 : 1) - (b.startsWith(GLOBAL) ? 0 : 1));
            // 哪些聊天对某一侧明确「不使用」（有自己的条目但空着）：全局皮肤要绕开它们
            const isEmpty = (b) => !(b && (b.baseId || (b.layers || []).length || b.color));
            const offBy = { assistant: [], user: [] };
            for (const k of keys) {
                const i = k.lastIndexOf(":");
                const scope = k.slice(0, i), role = k.slice(i + 1);
                if (scope !== GLOBAL && offBy[role] && isEmpty(live[k])) offBy[role].push(scope);
            }
            for (const k of ordered) {
                const i = k.lastIndexOf(":");
                const scope = k.slice(0, i), role = k.slice(i + 1);
                if (role !== "assistant" && role !== "user") continue;
                css += bubbleRule(scope, role, normalizeBubble(live[k]), offBy[role]);
            }
            return css;
        }


        /** 输入栏 tab：三个部件各自上传各自的图，各铺各的元素，无需对位。
         *  预览用真实类名渲染一条输入栏，改动即时可见。 */
        function buildInputView(root, api) {
            let scope = GLOBAL, sel = "bar";
            const cur = () => {
                const k = `${scope}:${sel}`;
                if (!config.inputBar[k]) config.inputBar[k] = { id: "", scale: 1, radius: null, color: "", bg: "" };
                return config.inputBar[k];
            };
            const persistI = () => { persist(); if (config.inputEnabled) apply(); };

            // ═ 作用范围 ═
            const head = el("div", "flex:0 0 auto;padding:0 16px");
            const scopeRow = el("div", "display:flex;align-items:center;gap:8px;padding:0 0 10px");
            scopeRow.append(el("div", "font-size:12px;width:56px;flex:0 0 auto", "作用范围"));
            const scopeSel = el("select",
                "flex:0 0 auto;width:98px;min-width:0;font-size:12px;padding:5px 6px;border-radius:8px;text-overflow:ellipsis;"
                + "border:1px solid var(--c-card-border,#e0e0e0);background:var(--c-card,#fff);"
                + "color:var(--c-text-title,#2c3440)");
            const fillScopes = () => {
                scopeSel.innerHTML = "";
                const o0 = document.createElement("option");
                o0.value = GLOBAL; o0.textContent = "全局默认"; scopeSel.append(o0);
                sessionList().forEach((ss) => {
                    const o = document.createElement("option");
                    o.value = ss.id; o.textContent = ss.name; scopeSel.append(o);
                });
                scopeSel.value = scope;
            };
            scopeSel.addEventListener("change", () => { scope = scopeSel.value; refresh(); });
            scopeRow.append(scopeSel);

            // ═ 预览：真实类名的一条输入栏 ═
            const prevBox = el("div", PREV_CARD);
            prevBox.className = "avfp-card";
            mountDayNight(prevBox);
            const pBar = el("div", "position:relative;padding:8px 12px;border-radius:0");
            pBar.className = "chat-input-bar avf-prev-bar";
            const pBox = el("div",
                "width:100%;min-height:34px;padding:8px 12px;font-size:13px;box-sizing:border-box");
            pBox.className = "chat-input-textarea"; pBox.textContent = "说点什么…";
            const pAct = el("div", "display:flex;gap:14px;align-items:center;padding-top:8px;font-size:15px");
            pAct.className = "chat-input-actions";
            pAct.append(el("span", null, "☺"), el("span", null, "＋"), el("span", null, "🎙"));
            pBar.append(pBox, pAct);
            prevBox.append(el("div", "font-size:11px;color:var(--c-text,#797e85);margin-bottom:8px", "预览"), pBar);

            // ═ 部件选择 ═
            const partRow = el("div", "display:flex;gap:8px;padding:0 16px 10px;flex:0 0 auto");
            const partBtns = [];
            BAR_PARTS.forEach(([k, label]) => {
                const b = el("button", null, label);
                b.className = "chat-list-tab";
                b.addEventListener("click", () => { sel = k; refresh(); });
                partBtns.push([k, b]); partRow.append(b);
            });

            // ═ 编辑区 ═
            const body = el("div", "padding:0 16px 12px;display:flex;flex-direction:column;gap:10px");
            const upRow = el("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap");
            const upBtn = el("button", BTN, "上传图片");
            const upIn = el("input", "display:none");
            upIn.type = "file"; upIn.accept = "image/*";
            upBtn.addEventListener("click", () => upIn.click());
            upIn.addEventListener("change", async () => {
                const f = (upIn.files || [])[0]; upIn.value = "";
                if (!f) return;
                const src = await readFileAsDataURL(f);
                let a2 = bubbleAssets.find((x) => x.src === src);
                if (!a2) {
                    const dim = await new Promise((res) => {
                        const im = new Image();
                        im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
                        im.onerror = () => res({ w: 100, h: 40 });
                        im.src = src;
                    });
                    a2 = { id: `bs_${Date.now().toString(36)}_${bubbleAssets.length}`,
                           name: f.name.replace(/\.[^.]+$/, ""), src, w: dim.w, h: dim.h };
                    bubbleAssets.push(a2);
                }
                const c = cur(); c.id = a2.id;
                if (!c.slice) c.slice = centerSlice(a2.w, a2.h);
                persistI(); refresh();
            });
            const clrBtn = el("button", BTN, "清除图片");
            clrBtn.addEventListener("click", () => { const c = cur(); c.id = ""; c.slice = null; persistI(); refresh(); });
            const thumb = el("div",
                "width:56px;height:34px;border-radius:8px;flex:0 0 auto;background-size:contain;"
                + "background-repeat:no-repeat;background-position:center;"
                + "border:1px solid var(--c-card-border,#e0e0e0)");
            upRow.append(thumb, upBtn, upIn, clrBtn);

            const mkSlider = (label, min, max, step, get, set, fmt) => {
                const row = el("div", "display:flex;align-items:center;gap:8px");
                const rin = el("input", "flex:1"); rin.type = "range";
                rin.min = min; rin.max = max; rin.step = step;
                const vv = el("span", "font:10px ui-monospace,monospace;width:44px;text-align:right;color:var(--c-text,#797e85)");
                rin.addEventListener("input", () => { set(+rin.value); vv.textContent = fmt(+rin.value); paintPrev(); });
                rin.addEventListener("change", () => persistI());
                row.append(el("span", "font-size:11px;width:44px;color:var(--c-text,#797e85)", label), rin, vv);
                return { row, rin, vv, get, fmt };
            };
            const sScale = mkSlider("缩放", 0.2, 3, 0.05,
                () => cur().scale == null ? 1 : cur().scale, (v) => { cur().scale = v; }, (v) => v.toFixed(2));
            const sRadius = mkSlider("圆角", 0, 40, 1,
                () => cur().radius == null ? 0 : cur().radius, (v) => { cur().radius = v; }, (v) => v + "px");

            const colorRow = el("div", "display:flex;align-items:center;gap:10px;flex-wrap:wrap");
            const bgIn = el("input", "width:34px;height:26px;padding:0;border:1px solid var(--c-card-border,#e0e0e0);border-radius:6px;background:none");
            bgIn.type = "color";
            bgIn.addEventListener("input", () => { cur().bg = bgIn.value; paintPrev(); });
            bgIn.addEventListener("change", () => persistI());
            const bgClr = el("button", BTN + ";padding:3px 10px;font-size:11px", "透明");
            bgClr.addEventListener("click", () => { cur().bg = ""; persistI(); refresh(); });
            const txtIn = el("input", "width:34px;height:26px;padding:0;border:1px solid var(--c-card-border,#e0e0e0);border-radius:6px;background:none");
            txtIn.type = "color";
            txtIn.addEventListener("input", () => { cur().color = txtIn.value; paintPrev(); });
            txtIn.addEventListener("change", () => persistI());
            const txtClr = el("button", BTN + ";padding:3px 10px;font-size:11px", "默认");
            txtClr.addEventListener("click", () => { cur().color = ""; persistI(); refresh(); });
            colorRow.append(el("span", "font-size:11px;color:var(--c-text,#797e85)", "底色"), bgIn, bgClr,
                            el("span", "font-size:11px;color:var(--c-text,#797e85)", "文字"), txtIn, txtClr);

            const hint = el("div", "font-size:11px;color:var(--c-text,#797e85);line-height:1.5");
            body.append(upRow, sScale.row, sRadius.row, colorRow, hint);

            // ═ 底部动作 ═
            const footer = el("div",
                "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:stretch;padding:10px 16px 14px;flex:0 0 auto;"
                + "border-top:1px solid var(--c-card-border,#e0e0e0)");   // 左侧让开宿主悬浮按钮
            const useBtn = el("button", BTN_MAIN);
            useBtn.addEventListener("click", () => {
                config.inputEnabled = true; persistI(); paintActions();
                ctx.ui.toast("输入栏样式已应用");
            });
            const offBtn = el("button", BTN + ";padding:9px 10px;font-size:12px", "停用");
            offBtn.addEventListener("click", () => {
                config.inputEnabled = false; persistI(); paintActions();
                ctx.ui.toast("输入栏样式已停用");
            });
            const wipeBtn = el("button", BTN_DANGER + ";padding:6px 10px;font-size:12px", "清空");
            let armed = null;
            wipeBtn.addEventListener("click", () => {
                if (!armed) {
                    wipeBtn.textContent = "确认清空？";
                    armed = setTimeout(() => { armed = null; wipeBtn.textContent = "清空"; }, 3000);
                    return;
                }
                clearTimeout(armed); armed = null; wipeBtn.textContent = "清空";
                config.inputBar = {}; persistI(); refresh();
                ctx.ui.toast("输入栏设置已清空");
            });
            footer.append(useBtn, offBtn, wipeBtn);
            function paintActions() {
                useBtn.textContent = config.inputEnabled ? "更新设置" : "启用输入栏";
                offBtn.style.display = config.inputEnabled ? "" : "none";
            }

            // ═ 绘制 ═
            function applyPartStyle(node, cfg) {
                node.style.cssText = node.getAttribute("data-base") || node.style.cssText;
                const a = cfg && cfg.id ? assetById(cfg.id) : null;
                node.style.borderImage = ""; node.style.borderStyle = ""; node.style.borderWidth = "";
                node.style.background = ""; node.style.backdropFilter = "none";
                if (a) {
                    const k = cfg.scale || 1;
                    const sl = cfg.slice || centerSlice(a.w, a.h);
                    const bw = sl.map((v) => Math.max(1, Math.round(v * k)));
                    node.style.borderStyle = "solid";
                    node.style.borderWidth = `${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px`;
                    node.style.borderImage = `url("${a.src}") ${sl[1]} ${sl[2]} ${sl[3]} ${sl[0]} fill`
                        + ` / ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px / 0 stretch`;
                    node.style.backgroundColor = "transparent";
                } else if (cfg && cfg.bg) {
                    node.style.background = cfg.bg;
                }
                if (cfg && cfg.radius != null) node.style.borderRadius = cfg.radius + "px";
                if (cfg && cfg.color) node.style.color = cfg.color;
            }
            function paintPrev() {
                const g = (part) => config.inputBar[`${scope}:${part}`];
                applyPartStyle(pBar, g("bar"));
                applyPartStyle(pBox, g("box"));
                applyPartStyle(pAct, g("act"));
            }
            function refresh() {
                fillScopes();
                partBtns.forEach(([k, b]) => { b.className = sel === k ? "chat-list-tab active" : "chat-list-tab"; });
                const c = cur();
                const a = c.id ? assetById(c.id) : null;
                thumb.style.backgroundImage = a ? `url("${a.src}")` : "none";
                sScale.row.style.display = a ? "flex" : "none";
                sScale.rin.value = sScale.get(); sScale.vv.textContent = sScale.fmt(+sScale.rin.value);
                sRadius.rin.value = sRadius.get(); sRadius.vv.textContent = sRadius.fmt(+sRadius.rin.value);
                bgIn.value = /^#[0-9a-f]{6}$/i.test(c.bg || "") ? c.bg : "#ffffff";
                txtIn.value = /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : "#2c3440";
                const meta = BAR_PARTS.find((p) => p[0] === sel);
                hint.textContent = sel === "bar"
                    ? "整条输入栏的底。图会按九宫格拉伸：四角不变形，中间随宽高铺开。"
                    : sel === "box"
                        ? "输入框自己的底。图铺在输入框上，和整条栏各画各的，不需要对位。"
                        : "右侧按钮区。通常只改文字/图标颜色即可。";
                hint.textContent += `　（作用于 ${meta ? meta[2] : ""}）`;
                paintPrev(); paintActions();
            }

            root.append(head, prevBox, partRow, body);
            head.append(scopeRow);
            const scrollAll = el("div", "flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;overflow-anchor:none");
            // 把已 append 的内容改挂到滚动容器里
            scrollAll.append(head, prevBox, partRow, body);
            root.innerHTML = "";
            root.append(scrollAll, footer);
            refresh();
            return refresh;
        }

        /** 气泡框 tab 的界面。返回一个刷新函数，切到该 tab 时调用。 */
        /** 气泡框 tab：一个图层列表统治一切。
         * 所有图片都是图层，文字也是图层；上层盖住下层，↑↓ 调层级；
         * 点行选中，下方编辑区随选中对象变化（拉伸→红线；锚定→位置大小；文字→蓝线+颜色字号）。 */
        function buildBubbleView(root, api) {
            let scope = GLOBAL, role = "all";   // all = 两侧一起改（镜像）
            let sampleText = "这是一条测试消息，用来看拉伸效果";
            let sel = "text";
            let firstPaint = true;
            /** 默认落在「气泡」页：选最上面那张拉伸层（真正的图案），没有图片才退回文字 */
            function selDefault() {
                const b2 = cur();
                const top = [...(b2.zorder || [])].reverse()
                    .map((z) => (b2.layers || []).find((L) => L.uid === z))
                    .find((L) => L && L.mode === "stretch");
                sel = top ? top.uid
                    : ((b2.layers || []).find((L) => L.mode === "stretch") || (b2.layers || [])[0] || {}).uid || "text";
            }
            const primary = () => (role === "all" ? "assistant" : role);   // 双方档以对方那份为准（落库时镜像给我方）
            const cur = () => editableBubble(scope, primary());
            /** 「全部」档下把对方侧镜像到我的侧，保证两侧一致后再落库 */
            const persistB = () => {
                if (role === "all") {
                    // 镜像是每侧自己的（对方不翻、我方翻），镜像抄对方那份时要把我方的镜像保住
                    const keepMirror = !!(config.bubbles[bubbleKey(scope, "user")] || {}).mirror;
                    config.bubbles[bubbleKey(scope, "user")] =
                        JSON.parse(JSON.stringify(editableBubble(scope, "assistant")));
                    config.bubbles[bubbleKey(scope, "user")].mirror = keepMirror;
                }
                // 「＋」新建的空白卡片：每次改动都同步存回卡片
                const pid = (config.packSel || {})[scope];
                const fresh = pid && bubblePacks.find((x) => x.id === pid && x.fresh);
                if (fresh) BUBBLE_ROLES.forEach(([r]) => { fresh.sides[r] = JSON.parse(JSON.stringify(editableBubble(scope, r))); });
                persist();
                // 只存草稿，不注 CSS：真实聊天要等主按钮「启用 / 更新设置」才变（和头像框页一致）
            };
            const selLayer = () => cur().layers.find((L) => L.uid === sel) || null;
            /** 承担气泡主体的那一层（最底下的拉伸层） */
            const baseItem = () => resolveStack(cur()).base;

            // ═ 顶部：范围 / 对象 ═
            const head = el("div", "flex:0 0 auto;padding:0 16px");
            const scopeRow = el("div", "display:flex;align-items:center;gap:8px;padding:0 0 10px");
            scopeRow.append(el("div", "font-size:12px;width:56px;flex:0 0 auto", "作用范围"));
            const scopeSel = el("select",
                "flex:0 0 auto;width:98px;min-width:0;font-size:12px;padding:5px 6px;border-radius:8px;text-overflow:ellipsis;"
                + "border:1px solid var(--c-card-border,#e0e0e0);background:var(--c-card,#fff);color:var(--c-text-title,#2c3440)");
            const og = document.createElement("option");
            og.value = GLOBAL; og.textContent = "全局默认"; scopeSel.append(og);
            sessionList().forEach((s2) => {
                const o = document.createElement("option"); o.value = s2.id; o.textContent = s2.name;
                scopeSel.append(o);
            });
            scopeSel.addEventListener("change", () => { scope = scopeSel.value; chatCache = {}; refresh(); });
            const clearBtn = el("button", BTN, "跟随全局");
            clearBtn.addEventListener("click", () => {
                BUBBLE_ROLES.forEach(([r]) => { delete config.bubbles[bubbleKey(scope, r)]; });
                persistB(); apply(); refresh(); paintEntry();
                ctx.ui.toast("本会话已恢复为跟随全局");
            });
            scopeRow.append(scopeSel, clearBtn);
            // 设置对象单独一行（双方 / 对方 / 我方）
            const roleRow = el("div", "display:flex;align-items:center;gap:8px;padding:0 0 10px");
            const roleBtns = [];
            ROLE_TABS.forEach(([v, label]) => {
                const b2 = el("button", "flex:1 1 0;padding:5px 9px;font-size:12px", label);
                b2.className = "chat-list-tab";
                b2.addEventListener("click", () => {
                    role = v;
                    if (v === "all") persistB();   // 切到全部时先把两侧对齐
                    refresh();
                });
                roleBtns.push([v, b2]); roleRow.append(b2);
            });
            scopeRow.style.flexWrap = "wrap";
            head.append(scopeRow, roleRow);

            // ═ 预览（吸顶）═
            const prevBox = el("div", "position:sticky;top:0;z-index:5;" + PREV_CARD);
            prevBox.className = "avfp-card";
            mountDayNight(prevBox);
            const textInput = el("input",
                "width:100%;font-size:12px;padding:6px 9px;border-radius:8px;margin-bottom:8px;"
                + "border:1px solid var(--c-card-border,#e0e0e0);background:var(--c-card,#fff);color:var(--c-text-title,#2c3440)");
            textInput.value = ""; textInput.placeholder = "输入预览文字（留空 = 用真实聊天记录）";
            textInput.addEventListener("input", () => { sampleText = textInput.value; paintPreview(); });
            sampleText = "";
            // 真实双侧对话：真头像 + 两条气泡 + 会话主题色（复用头像框的快照机制）
            let chatCache = {};
            const getChat = () => chatCache[scope] || (chatCache[scope] = sampleChat(scope));
            const mkPrevRow = (r) => {
                const wrap = el("div"); wrap.className = "chat-msg-wrapper avf-preview";
                wrap.style.pointerEvents = "none";
                wrap.setAttribute("data-role", r);
                const avBox = el("div", "position:relative;width:40px;height:40px;flex:0 0 auto");
                const av = el("img",
                    "width:40px;height:40px;border-radius:20px;object-fit:cover;display:block;"
                    + "background:var(--c-input,#ebebeb)");
                // 头像框陪衬层：画布和真实渲染一样是头像的 3 倍、以头像中心为中心
                //（之前没有 translate(-50%,-50%)，整个框往右下偏了半个头像）
                const fr = el("div",
                    `position:absolute;left:50%;top:50%;width:${FBOX}px;height:${FBOX}px;transform:translate(-50%,-50%);`
                    + "pointer-events:none;display:none;z-index:3");
                av.style.position = "relative"; av.style.zIndex = "1";
                avBox.append(av, fr);
                const content = el("div");
                content.className = "chat-msg-content-wrap flex flex-col min-w-0 max-w-[70%]";   // 和聊天室一样 70%
                const bubble = el("div");
                const md = el("div"); md.className = "chat-markdown hide-scrollbar break-words";
                bubble.append(md);
                // 群聊里对方气泡上方有发言人名字，预览也照样放一个（非群聊时藏起来）
                const nm = el("span"); nm.className = "chat-group-sender-name"; nm.style.display = "none";
                content.append(nm, bubble);
                if (r === "user") wrap.append(content, avBox);
                else wrap.append(avBox, content);
                return { wrap, av, fr, bubble, md, nm };
            };
            const rowA = mkPrevRow("assistant");
            const rowU = mkPrevRow("user");
            const pWrap = el("div", "display:flex;flex-direction:column;gap:16px;min-height:150px;justify-content:center");
            pWrap.append(rowA.wrap, rowU.wrap);
            const scaleRow = el("div", CELL);
            const scaleIn = el("input", "flex:1;min-width:0;margin:0"); scaleIn.type = "range";
            scaleIn.min = 0.15; scaleIn.max = 1.2; scaleIn.step = 0.01;
            const scaleVal = el("div", CELL_VAL);
            scaleIn.addEventListener("input", () => {
                cur().scale = +scaleIn.value; scaleVal.textContent = (+scaleIn.value).toFixed(2); schedulePaint();
            });
            scaleRow.append(el("span", CELL_LAB, "缩放"), scaleIn, scaleVal);
            numEdit(scaleVal, "缩放", () => +(+(cur().scale || 0.54)).toFixed(2),
                (v) => { cur().scale = Math.min(1.2, Math.max(0.15, v)); persistB(); refresh(); });
            // 气泡整体位置微调：只挪普通文字气泡的视觉位置（transform），
            // 转账/图片等媒体卡片和整体布局都不受影响
            const offSliders = {};
            const mkOff = (lab, key) => {
                const row = el("div", CELL);
                const rin = el("input", "flex:1;min-width:0;margin:0"); rin.type = "range"; rin.min = -40; rin.max = 40; rin.step = 1;
                const vv = el("div", CELL_VAL);
                rin.addEventListener("input", () => {
                    cur()[key] = +rin.value; vv.textContent = rin.value; schedulePaint();
                });
                rin.addEventListener("change", () => { persistB(); paintPreview(); });
                row.append(el("span", CELL_LAB, lab), rin, vv);
                numEdit(vv, lab, () => cur()[key] || 0,
                    (v) => { cur()[key] = Math.round(Math.min(40, Math.max(-40, v))); persistB(); refresh(); });
                offSliders[key] = { rin, vv };
                return row;
            };
            const offRowY = mkOff("上下", "oy");
            const offRowX = mkOff("左右", "ox");
            // 透明：只淡化气泡的图，文字不变
            const alphaRow = el("div", CELL);
            const alphaIn = el("input", "flex:1;min-width:0;margin:0"); alphaIn.type = "range";
            alphaIn.min = 0; alphaIn.max = 1; alphaIn.step = 0.01;
            const alphaVal = el("div", CELL_VAL);
            alphaIn.addEventListener("input", () => {
                cur().alpha = +alphaIn.value; alphaVal.textContent = Math.round(+alphaIn.value * 100) + "%"; schedulePaint();
            });
            alphaIn.addEventListener("change", () => { persistB(); paintPreview(); });
            alphaRow.append(el("span", CELL_LAB, "透明"), alphaIn, alphaVal);
            numEdit(alphaVal, "透明（%）", () => Math.round((cur().alpha == null ? 1 : cur().alpha) * 100),
                (v) => { cur().alpha = Math.min(1, Math.max(0, v / 100)); persistB(); refresh(); });
            // 一个总复位：缩放回 0.54（QQ 素材 @3x 的实测贴合值），位移归零
            const ctlReset = iconBtn(BTN, "reset", 15);
            ctlReset.title = "整体复位：缩放回默认、位置归零";
            ctlReset.addEventListener("click", () => {
                const b2 = cur(); b2.scale = 0.54; b2.ox = 0; b2.oy = 0; b2.alpha = 1; persistB(); refresh();
            });
            // 两行、每行两个：缩放 上下 / 左右 透明
            const ctlRow = el("div", "display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding:2px 0 10px");
            // 镜像开关：QQ 的气泡素材只有一个朝向，另一侧要左右翻过来才对。两个开关各管一侧，不随「设置对象」变
            const mirrorRow = el("div", "grid-column:1/-1;display:flex;gap:8px;align-items:center;padding-top:2px");
            mirrorRow.append(el("span", CELL_LAB + ";width:auto", "镜像"));
            const mirBtns = {};
            [["assistant", "对方镜像"], ["user", "我方镜像"]].forEach(([r, lab]) => {
                const bt = el("button", "flex:0 0 auto;padding:5px 8px;font-size:12px;line-height:1.2", lab);
                bt.className = "chat-list-tab";
                bt.addEventListener("click", () => {
                    const bb = editableBubble(scope, r);
                    bb.mirror = !bb.mirror;
                    persistB(); refresh();
                });
                mirBtns[r] = bt; mirrorRow.append(bt);
            });
            ctlRow.append(scaleRow, offRowX, offRowY, alphaRow, mirrorRow);
            prevBox.append(pWrap);

            // ═ 图层列表 ═
            const scroll = el("div", "padding:0 16px 12px;overflow-anchor:none");
            const layerHead = el("div", "display:flex;align-items:center;gap:8px;padding:4px 0 6px");
            const addBtn = el("button", BTN, "＋添加图片");
            const addInput = el("input", "display:none");
            addInput.type = "file"; addInput.accept = "image/*"; addInput.multiple = true;
            addBtn.addEventListener("click", () => addInput.click());
            /** 小弹窗：新加的这张图当气泡本体还是贴纸 */
            function askKind(n) {
                return new Promise((res) => {
                    const mask = el("div",
                        "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;"
                        + "justify-content:center;background:rgba(91,70,54,.35);padding:24px");
                    const box = el("div",
                        `background:${T.card};border:1px solid ${T.line};border-radius:16px;padding:16px;`
                        + "max-width:280px;width:100%;box-shadow:0 12px 32px rgba(91,70,54,.28);"
                        + "display:flex;flex-direction:column;gap:10px");
                    box.append(el("div", `font-size:14px;font-weight:700;color:${T.ink}`,
                        n > 1 ? `这 ${n} 张图怎么用？` : "这张图怎么用？"));
                    /** 一张示意图：左边短文字、右边长文字，看得出这一层会怎么变 */
                    const demo = (isBubble) => {
                        const box2 = el("div", "display:flex;flex-direction:column;gap:5px;align-items:center");
                        [46, 96].forEach((w) => {
                            const wrap = el("div", `position:relative;width:${w}px;height:26px;flex:0 0 auto`);
                            if (isBubble) {
                                // 气泡本体：整块跟着文字变宽，边框始终裹住文字
                                wrap.style.cssText += `;border:2px solid ${T.brown};border-radius:8px;background:${T.paper}`;
                            } else {
                                // 贴纸：气泡变宽，贴纸大小位置不变
                                wrap.style.cssText += `;border:2px dashed ${T.line};border-radius:8px;background:${T.paper}`;
                                const st2 = el("div",
                                    `position:absolute;left:-6px;top:-7px;width:16px;height:16px;border-radius:50%;`
                                    + `background:${T.pink};border:2px solid ${T.card}`);
                                wrap.append(st2);
                            }
                            const line = el("div",
                                `position:absolute;left:8px;right:8px;top:9px;height:6px;border-radius:3px;background:${T.line}`);
                            wrap.append(line);
                            box2.append(wrap);
                        });
                        box2.append(el("div", `font-size:10px;color:${T.sub}`, isBubble ? "整块跟着文字长" : "只有底框变，它不变"));
                        return box2;
                    };
                    const cmp = el("div", "display:flex;gap:12px;justify-content:center;padding:4px 0");
                    const mk = (isBubble, title, desc, style) => {
                        const col = el("div",
                            `flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;`
                            + `padding:10px 6px;border-radius:12px;${style}`);
                        col.append(el("div", `font-size:13px;font-weight:700;color:${T.ink}`, title),
                                   demo(isBubble),
                                   el("div", `font-size:10px;line-height:1.4;color:${T.sub};text-align:center`, desc));
                        return col;
                    };
                    const bBubble = mk(true, "气泡本体",
                        "当气泡的底，四角不变形、中间随文字拉伸",
                        `border:2px solid ${T.yellowDeep};background:#FFFBEC`);
                    const bStick = mk(false, "贴纸",
                        "贴在气泡上的装饰，大小位置固定",
                        `border:1px solid ${T.line};background:${T.card}`);
                    cmp.append(bBubble, bStick); box.append(cmp);
                    const done = (v) => { mask.remove(); res(v); };
                    bBubble.addEventListener("click", () => done("stretch"));
                    bStick.addEventListener("click", () => done("anchor"));
                    mask.addEventListener("click", (e) => { if (e.target === mask) done(null); });
                    box.append(el("div", `font-size:10px;color:${T.sub};text-align:center`, "点空白处取消"));
                    mask.append(box); document.body.appendChild(mask);
                });
            }

            /** 把若干张图（dataURL）加成图层；kind 为 stretch=气泡本体 / anchor=贴纸 */
            async function addImages(items, kind) {
                const b2 = cur();
                let last = null;
                for (const it of items) {
                    try {
                        const src = it.src;
                        let a2 = bubbleAssets.find((x) => x.src === src);
                        if (!a2) {
                            const dim = await new Promise((res) => {
                                const im = new Image();
                                im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
                                im.onerror = () => res({ w: 128, h: 112 });
                                im.src = src;
                            });
                            a2 = { id: `bs_${Date.now().toString(36)}_${bubbleAssets.length}`,
                                   name: it.name || "图片", src, w: dim.w, h: dim.h };
                            bubbleAssets.push(a2);
                        }
                        if (kind === "stretch") {
                            // 手机相册里的图动辄一两千像素，直接按现有缩放铺开会撑满整屏。
                            // 这一层要当气泡的底时，按它自己的高度把缩放调到约 72px 高。
                            const hasBase = (b2.layers || []).some((L) => L.mode === "stretch");
                            if (!hasBase && a2.h * (b2.scale || 0.54) > 120) {
                                b2.scale = Math.max(0.05, Math.min(1, +(72 / a2.h).toFixed(3)));
                                b2.content = null;      // 文字区按新尺寸重算
                            }
                            const L3 = { uid: newUid(), id: a2.id, mode: "stretch",
                                slice: centerSlice(a2.w, a2.h), anchor: "lc",
                                dx: 0, dy: 0, w: a2.w, h: a2.h };
                            b2.layers.push(L3);
                            const ti3 = b2.zorder.indexOf("text");
                            b2.zorder.splice(ti3 < 0 ? b2.zorder.length : ti3, 0, L3.uid);
                            last = L3.uid;
                            continue;
                        }
                        // 手动加的图当贴纸用（居中固定），这才符合「往气泡上贴个东西」的直觉；
                        // 要让它当气泡主体，改成「跟随拉伸」即可。
                        // 贴纸尺寸要跟气泡同一个缩放尺度（素材是 @3x 的，直接用原始
                        // 像素会比整个气泡还大），再按气泡自身高度封顶，保证一进来就看得全。
                        const k0 = b2.scale || 0.54;
                        let sw0 = Math.max(4, Math.round(a2.w * k0));
                        let sh0 = Math.max(4, Math.round(a2.h * k0));
                        const stB = resolveStack(b2);
                        if (stB.base) {
                            const sl0 = layerSlice(stB.base);
                            const bubH = Math.round((sl0[1] + sl0[3]) * k0);   // 气泡本体高度
                            if (bubH > 8 && sh0 > bubH) {
                                const r0 = bubH / sh0;
                                sw0 = Math.max(4, Math.round(sw0 * r0)); sh0 = bubH;
                            }
                        }
                        const L2 = { uid: newUid(), id: a2.id, mode: "anchor",
                            slice: centerSlice(a2.w, a2.h), anchor: "lt",
                            dx: 0, dy: 0, w: sw0, h: sh0 };
                        b2.layers.push(L2);
                        const ti = b2.zorder.indexOf("text");
                        b2.zorder.splice(ti < 0 ? b2.zorder.length : ti, 0, L2.uid);
                        last = L2.uid;
                    } catch (e) { ctx.system.log("加图失败", it.name, e); }
                }
                if (last) { sel = last; persistB(); refresh(); }
                return last;
            }

            addInput.addEventListener("change", async () => {
                const files = Array.from(addInput.files || []); addInput.value = "";
                if (!files.length) return;
                const kind = await askKind(files.length);
                if (!kind) return;
                const items = [];
                for (const f of files) {
                    try { items.push({ src: await readFileAsDataURL(f), name: f.name.replace(/\.[^.]+$/, "") }); }
                    catch (e) { ctx.system.log("读图失败", f.name, e); }
                }
                await addImages(items, kind);
            });

            // 链接导入：手机上存图麻烦，直接贴 URL 更快。跨域图会被浏览器挡下，
            // 所以拉回来转成 dataURL 存本地，之后离线也能用。
            const urlBtn = el("button", BTN, "链接导入");
            urlBtn.addEventListener("click", async () => {
                const u = ((await askText("链接导入", "https://…/xxx.png", "",
                    "支持 http/https 图片链接。会先下载存到本地，下载不成功就直接用链接（离线时可能显示不出来）。")) || "").trim();
                if (!u) return;
                if (!/^(https?:|data:image\/)/i.test(u)) { ctx.ui.toast("只支持 http/https 图片链接"); return; }
                let src = u, name = "链接图片";
                try { name = decodeURIComponent((u.split("?")[0].split("/").pop() || "")).replace(/\.[^.]+$/, "") || name; }
                catch { /* 名字取不到就用默认 */ }
                if (!/^data:/i.test(u)) {
                    ctx.ui.toast("正在下载…");
                    try {
                        const r = await fetch(u, { mode: "cors" });
                        if (!r.ok) throw new Error("HTTP " + r.status);
                        const blob = await r.blob();
                        if (!/^image\//.test(blob.type)) throw new Error("不是图片");
                        src = await new Promise((res, rej) => {
                            const rd = new FileReader();
                            rd.onload = () => res(rd.result); rd.onerror = rej;
                            rd.readAsDataURL(blob);
                        });
                    } catch (e) {
                        // 对方不给跨域时 fetch 会失败，但 <img> 照样能显示，
                        // 那就直接把链接当图源用（代价：以后要联网才看得到）
                        ctx.system.log("链接下载失败，改为直接引用", u, e);
                        const okImg = await new Promise((r2) => {
                            const im = new Image();
                            im.onload = () => r2(true); im.onerror = () => r2(false);
                            im.src = u;
                        });
                        if (!okImg) { ctx.ui.toast("这个链接打不开，换一个试试"); return; }
                        ctx.ui.toast("跨域拿不到文件，已改为直接引用链接");
                        src = u;
                    }
                }
                const kind = await askKind(1);
                if (!kind) return;
                await addImages([{ src, name }], kind);
                ctx.ui.toast("已导入");
            });
            const secLayers = el("div", `flex:1;font-size:13px;font-weight:700;color:${T.ink}`, "图层");
            secLayers.className = "avfp-sec";
            // 复位：把选中的那一层恢复默认（拉伸层=切线回正中；贴纸=回左上角、默认大小；文字=文字区回默认）
            const resetLayerBtn = el("button", BTN + ";padding:5px 8px;font-size:12px;line-height:1.2", "复位");
            resetLayerBtn.addEventListener("click", () => {
                const b2 = cur();
                if (sel === "text") {
                    const bi = baseItem();
                    if (bi) b2.content = contentDefault(bi.a);
                } else {
                    const L = selLayer(); const a2 = L && assetById(L.id);
                    if (!L) return;
                    if (L.mode === "stretch") { if (a2) L.slice = centerSlice(a2.w, a2.h); }
                    else {
                        const k1 = b2.scale || 0.54;
                        L.anchor = "lt"; L.dx = 0; L.dy = 0; L.fw = false; L.fh = false;
                        if (a2) { L.w = Math.max(4, Math.round(a2.w * k1)); L.h = Math.max(4, Math.round(a2.h * k1)); }
                    }
                }
                persistB(); refresh();
            });
            const clearLayersB = el("button", BTN_DANGER + ";padding:5px 8px;font-size:12px;line-height:1.2", "清空图层");
            clearLayersB.addEventListener("click", () => {
                const b2 = cur();
                b2.layers = []; b2.zorder = ["text"]; b2.content = null;
                sel = "text"; persistB(); refresh();
            });
            addBtn.style.cssText += ";padding:5px 8px;font-size:12px;line-height:1.2";
            urlBtn.style.cssText += ";padding:5px 8px;font-size:12px;line-height:1.2";
            layerHead.append(secLayers, clearLayersB, addBtn, urlBtn, addInput);
            const layerList = el("div", "display:flex;flex-direction:column;gap:4px;padding-bottom:8px");

            function paintLayers() {
                const b2 = cur();
                layerList.innerHTML = "";
                const valid = ["text"].concat(b2.layers.map((L) => L.uid));
                if (!valid.includes(sel)) sel = "text";
                const st = resolveStack(b2);
                const mkRow = (key, thumb, label, tag, removable) => {
                    const row = el("div",
                        "display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:8px;cursor:pointer;"
                        + (sel === key
                            ? `background:#FFF6D6;border:1px solid ${T.yellowDeep};box-shadow:${T.shadow}`
                            : `background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow}`));
                    row.addEventListener("click", () => { sel = key; refresh(); });
                    row.append(thumb,
                        el("div", `flex:1;min-width:0;font-size:12px;color:${T.ink};`
                            + "overflow:hidden;text-overflow:ellipsis;white-space:nowrap", label),
                        typeof tag === "string"
                            ? el("div", "font-size:10px;color:var(--c-icon,#a0a3a8);flex:0 0 auto", tag)
                            : tag);
                    const mv = (delta, sym) => {
                        const bt = el("button", BTN + ";padding:3px 9px;font-size:13px;line-height:1.1", sym);
                        bt.addEventListener("click", (e) => {
                            e.stopPropagation();
                            const i = b2.zorder.indexOf(key), j = i + delta;
                            if (i < 0 || j < 0 || j >= b2.zorder.length) return;
                            [b2.zorder[i], b2.zorder[j]] = [b2.zorder[j], b2.zorder[i]];
                            refresh();
                        });
                        return bt;
                    };
                    row.append(mv(1, "↑"), mv(-1, "↓"));
                    if (removable) {
                        const x = el("button", BTN + `;padding:3px 9px;font-size:13px;line-height:1.1;color:${T.red}`, "✕");
                        x.addEventListener("click", (e) => {
                            e.stopPropagation();
                            b2.layers = b2.layers.filter((L) => L.uid !== key);
                            b2.zorder = b2.zorder.filter((z) => z !== key);
                            if (sel === key) sel = "text";
                            refresh();
                        });
                        row.append(x);
                    }
                    return row;
                };
                // 没有图层（还没选气泡框、也没加图）时，图层列表和编辑区都不出现，只留标题行的添加按钮
                const hasL = b2.layers.length > 0;
                // 新建模式下没有图层也把列表露出来（里面自带「文字」这一行）
                const showL = hasL || newLayerMode;
                layerHead.style.display = showL ? "flex" : "none";
                layerList.style.display = editSec.style.display = (showL && layersFold.isOpen()) ? "flex" : "none";
                [...b2.zorder].reverse().forEach((z) => {
                    if (z === "text") {
                        const th = el("div",
                            "width:26px;height:24px;flex:0 0 auto;border-radius:5px;display:flex;align-items:center;"
                            + "justify-content:center;font-size:12px;background:var(--c-card,#fff);"
                            + `color:${b2.color || "var(--c-text-title,#2c3440)"}`, "字");
                        layerList.append(mkRow("text", th, "文字", "文字区 · 颜色 · 字号", false));
                    } else {
                        const L = b2.layers.find((x) => x.uid === z);
                        if (!L) return;
                        const a2 = assetById(L.id);
                        const th = el("div",
                            "width:26px;height:24px;flex:0 0 auto;border-radius:5px;background-size:contain;"
                            + "background-repeat:no-repeat;background-position:center;background-color:var(--c-card,#fff)");
                        if (a2) th.style.backgroundImage = `url("${a2.src}")`;
                        // 每个图片层自带一个「气泡 / 贴纸」切换钮——加完图当场就能切，
                        // 不用去下面的编辑区找选择器
                        const isSticker = L.mode !== "stretch";
                        const sw = el("button",
                            "flex:0 0 auto;display:flex;align-items:center;gap:6px;border:none;background:transparent;"
                            + `cursor:pointer;padding:0;font-size:11px;color:${T.ink}`);
                        const swLab = el("span",
                            `padding:2px 7px;border-radius:7px;font-weight:600;border:1px solid ${T.line};`
                            + `background:${isSticker ? "#FCEAEE" : "#FFF6D6"}`,
                            isSticker ? "贴纸" : "气泡");
                        const swKnob = el("span"); swKnob.className = "avfp-sw" + (isSticker ? "" : " on");
                        sw.append(swLab, swKnob);
                        sw.title = isSticker ? "点击改成气泡本体（随文字拉伸）" : "点击改成贴纸（大小位置固定）";
                        sw.addEventListener("click", (e) => {
                            e.stopPropagation();
                            L.mode = isSticker ? "stretch" : "anchor";
                            if (L.mode === "stretch" && !L.slice && a2) L.slice = centerSlice(a2.w, a2.h);
                            sel = L.uid; persistB(); refresh();
                        });
                        layerList.append(mkRow(L.uid, th, (a2 ? a2.name : "图层"), sw, true));
                    }
                });
                if (!b2.layers.length) {
                    layerList.append(el("div",
                        `font-size:11px;color:${T.sub};padding:6px 2px`,
                        "还没有图片。点「＋添加图片」，或在下面的气泡库导入现成气泡包。"));
                }
            }

            // ═ 编辑区（随选中变化）═
            const editSec = el("div", "display:flex;flex-direction:column;gap:8px;padding-bottom:8px");
            // 「气泡 / 文字」两页：气泡页调选中图层（红线九宫格 / 贴纸位置），文字页调文字区（蓝线）。
            // 切到气泡页时回到上次编辑的图层，没有就回气泡本体。
            // 记住每页上次编辑的图层：气泡页记拉伸层，贴纸页记贴纸层
            let lastBaseSel = null, lastStickSel = null;
            const isStickL = (L) => L && L.mode !== "stretch";
            const editTabs = el("div", "display:flex;gap:8px;align-items:center");
            const editTabBtns = [["img", "气泡"], ["sticker", "贴纸"], ["text", "文字"]].map(([v, lab]) => {
                const b = el("button", "", lab);
                b.className = "chat-list-tab";
                b.addEventListener("click", () => {
                    const b2 = cur();
                    if (v === "text") { sel = "text"; }
                    else if (v === "sticker") {
                        const cand = (lastStickSel && b2.layers.some((L) => L.uid === lastStickSel && isStickL(L))) ? lastStickSel
                            : (b2.layers.filter(isStickL).slice(-1)[0] || {}).uid;
                        if (!cand) { ctx.ui.toast("还没有贴纸：先「＋添加图片」，再把那一层切成贴纸"); return; }
                        sel = cand;
                    } else {
                        // 一个气泡常是「底板 + 图案」两层拉伸层，底板在最底下但只是一块纯色，
                        // 直接跳过去会以为素材丢了——所以优先选最上面那张（真正的图案）。
                        const top = [...b2.zorder].reverse()
                            .map((z) => b2.layers.find((L) => L.uid === z))
                            .find((L) => L && !isStickL(L));
                        const stT = resolveStack(b2);
                        const cand = (lastBaseSel && b2.layers.some((L) => L.uid === lastBaseSel && !isStickL(L))) ? lastBaseSel
                            : (top ? top.uid : (stT.base ? stT.base.L.uid : (b2.layers.find((L) => !isStickL(L)) || {}).uid));
                        if (!cand) { ctx.ui.toast("先添加一张图片"); return; }
                        sel = cand;
                    }
                    refresh();
                });
                return [v, b];
            });
            editTabs.append(...editTabBtns.map(([, b]) => b));
            const editTabHint = el("span", `font-size:11px;color:${T.sub};margin-left:auto`);
            editTabs.append(editTabHint);
            const stage = el("div",
                "position:relative;flex:0 0 46%;min-width:0;align-self:flex-start;aspect-ratio:128/112;"
                + "border-radius:14px;overflow:hidden;touch-action:none;"
                + `box-shadow:inset 0 0 0 1px ${T.line},${T.shadow};`
                + "background:repeating-conic-gradient(#EFE8DA 0 25%,#FFFDF8 0 50%) 50%/14px 14px");
            const stageImg = el("div",
                "position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center");
            const stageComp = el("div", "position:absolute;inset:0;display:none");
            stage.append(stageImg, stageComp);
            /** 调文字区时：按 zorder 把全部图层合成（拉伸层铺满气泡，贴纸按真实锚点换算），
             *  蓝线画在合成结果上——文字区是对整个气泡说的，不是对最底那张图。 */
            function paintComposite(b2, baseA) {
                stageComp.innerHTML = "";
                const k2 = b2.scale || 1;
                const pw = (px) => (px / k2 / baseA.w * 100);   // 渲染px → 占气泡宽的百分比
                const ph = (px) => (px / k2 / baseA.h * 100);
                for (const z of b2.zorder) {
                    if (z === "text") continue;
                    const L = b2.layers.find((x) => x.uid === z);
                    const a3 = L && assetById(L.id);
                    if (!a3) continue;
                    const im = el("img", "position:absolute;pointer-events:none");
                    im.src = a3.src;
                    if (L.mode === "stretch" || L.uid === (resolveStack(b2).base || {}).L?.uid) {
                        im.style.inset = "0"; im.style.width = "100%"; im.style.height = "100%";
                    } else {
                        const ax = (L.anchor || "lc")[0], ay = (L.anchor || "lc")[1];
                        im.style.width = L.fw ? "100%" : pw(L.w) + "%";
                        im.style.height = L.fh ? "100%" : ph(L.h) + "%";
                        if (L.fw || ax === "l") im.style.left = pw(L.dx) + "%";
                        else if (ax === "r") im.style.right = pw(L.dx) + "%";
                        else im.style.left = (50 - pw(L.w / 2 - L.dx)) + "%";
                        if (L.fh || ay === "t") im.style.top = ph(L.dy) + "%";
                        else if (ay === "b") im.style.bottom = ph(L.dy) + "%";
                        else im.style.top = (50 - ph(L.h / 2 - L.dy)) + "%";
                    }
                    stageComp.append(im);
                }
            }
            // 气泡拉伸线 = 奶油粉，文字区线 = 奶油黄
            const LINE_RED = "#F2A5B8", LINE_BLUE = "#EFC65A";
            const lineStyle = (vert) =>
                "position:absolute;opacity:.95;pointer-events:none;"
                + (vert ? "top:0;bottom:0;width:2px;margin-left:-1px"
                        : "left:0;right:0;height:2px;margin-top:-1px");
            /** 把一条线画成奶油色虚线 */
            const dressLine = (ln, vert, color) => {
                ln.style.background = `repeating-linear-gradient(${vert ? "180deg" : "90deg"},${color} 0 6px,transparent 6px 10px)`;
            };
            const lines = {};
            const stageAsset = () => {
                if (sel === "text") { const bi = baseItem(); return bi ? bi.a : null; }
                const L = selLayer(); return L ? assetById(L.id) : null;
            };
            const redRef = () => {
                const L = selLayer();
                if (L) { if (!L.slice) L.slice = centerSlice(...(assetById(L.id) ? [assetById(L.id).w, assetById(L.id).h] : [128, 112])); return L.slice; }
                return null;
            };
            [["l", true], ["r", true], ["t", false], ["b", false],
             ["cl", true], ["cr", true], ["ct", false], ["cb", false]].forEach(([k, vert]) => {
                const ln = el("div", lineStyle(vert));
                dressLine(ln, vert, k[0] === "c" ? LINE_BLUE : LINE_RED);
                const hit = el("div", "position:absolute;"
                    + (vert ? "top:0;bottom:0;width:16px;margin-left:-8px;cursor:ew-resize"
                            : "left:0;right:0;height:16px;margin-top:-8px;cursor:ns-resize"));
                hit.style.touchAction = "none";
                lines[k] = { ln, hit };
                stage.append(ln, hit);
                hit.addEventListener("pointerdown", (e) => {
                    e.preventDefault();
                    try { hit.setPointerCapture(e.pointerId); } catch { /* 个别环境拿不到 capture，照样能拖 */ }
                    const move = (ev) => {
                        const a2 = stageAsset(); if (!a2) return;
                        const r0 = stage.getBoundingClientRect();
                        const sc = Math.min(r0.width / a2.w, r0.height / a2.h);
                        const ox = (r0.width - a2.w * sc) / 2, oy = (r0.height - a2.h * sc) / 2;
                        const px = (ev.clientX - r0.left - ox) / sc;
                        const py = (ev.clientY - r0.top - oy) / sc;
                        const clamp = (v, mx) => Math.max(0, Math.min(mx, Math.round(v)));
                        const b2 = cur();
                        if (k[0] === "c") {
                            if (!b2.content) b2.content = contentDefault(a2);
                            const c = b2.content;
                            if (k === "cl") c[0] = clamp(px, c[2] - 2);
                            if (k === "cr") c[2] = Math.max(c[0] + 2, Math.min(a2.w, Math.round(px)));
                            if (k === "ct") c[1] = clamp(py, c[3] - 2);
                            if (k === "cb") c[3] = Math.max(c[1] + 2, Math.min(a2.h, Math.round(py)));
                        } else {
                            const rr = redRef(); if (!rr) return;
                            if (k === "l") rr[0] = clamp(px, a2.w - rr[2] - 2);
                            if (k === "r") rr[2] = clamp(a2.w - px, a2.w - rr[0] - 2);
                            if (k === "t") rr[1] = clamp(py, a2.h - rr[3] - 2);
                            if (k === "b") rr[3] = clamp(a2.h - py, a2.h - rr[1] - 2);
                        }
                        schedulePaint(); syncLineSliders();
                    };
                    const up = (ev) => {
                        hit.removeEventListener("pointermove", move);
                        hit.removeEventListener("pointerup", up);
                        hit.removeEventListener("pointercancel", up);
                        try { hit.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
                        persistB();
                    };
                    hit.addEventListener("pointermove", move);
                    hit.addEventListener("pointerup", up);
                    hit.addEventListener("pointercancel", up);
                });
            });

            const hintLine = el("div", `font-size:11px;color:${T.sub};text-align:center`);
            // 拉伸层控件：模式
            const modeRow = el("div", "display:flex;gap:8px;align-items:center;flex-wrap:wrap");
            const modeSel = el("select",
                "font-size:11px;padding:3px 8px;border-radius:8px;" + `border:1px solid ${T.line};`
                + `background:${T.card};color:${T.ink}`);
            [["stretch", "气泡本体 · 随文字拉伸"], ["anchor", "贴纸 · 大小位置固定"]].forEach(([v, lab]) => {
                const o = document.createElement("option"); o.value = v; o.textContent = lab; modeSel.append(o);
            });
            modeSel.addEventListener("change", () => {
                const L = selLayer(); if (L) { L.mode = modeSel.value; persistB(); refresh(); }
            });
            modeRow.append(el("span", "font-size:11px;color:var(--c-text,#797e85)", "这一层是"), modeSel);

            // 锚定控件
            const anchorBox = el("div", "display:none;flex-direction:column;gap:6px");
            const anSel = el("select",
                "font-size:11px;padding:3px 8px;border-radius:8px;" + `border:1px solid ${T.line};`
                + `background:${T.card};color:${T.ink}`);
            ANCHORS.forEach(([v, lab]) => {
                const o = document.createElement("option"); o.value = v; o.textContent = lab; anSel.append(o);
            });
            anSel.addEventListener("change", () => {
                const L = selLayer(); if (!L) return;
                // 换锚点时把 X/Y 换算过去，贴纸留在原地不跳。
                // dx/dy 是「离锚定那条边的距离」，换了参照边当然要重算。
                const box = bubbleBox();
                const old = L.anchor || "lt", neu = anSel.value;
                const absX = old[0] === "l" ? (L.dx || 0)
                    : old[0] === "r" ? box.w - L.w - (L.dx || 0)
                    : (box.w - L.w) / 2 + (L.dx || 0);
                const absY = old[1] === "t" ? (L.dy || 0)
                    : old[1] === "b" ? box.h - L.h - (L.dy || 0)
                    : (box.h - L.h) / 2 + (L.dy || 0);
                L.anchor = neu;
                L.dx = Math.round(neu[0] === "l" ? absX
                    : neu[0] === "r" ? box.w - L.w - absX
                    : absX - (box.w - L.w) / 2);
                L.dy = Math.round(neu[1] === "t" ? absY
                    : neu[1] === "b" ? box.h - L.h - absY
                    : absY - (box.h - L.h) / 2);
                clampSticker(L);
                persistB(); syncAnchorSliders(); paintPreview();
            });
            const anchorReset = el("button", BTN + ";padding:2px 8px;font-size:11px", "复位");
            anchorReset.addEventListener("click", () => {
                const L = selLayer(); const a2 = L && assetById(L.id);
                if (!L) return;
                const k1 = cur().scale || 0.54;
                L.anchor = "lt"; L.dx = 0; L.dy = 0; L.fw = false; L.fh = false;
                if (a2) { L.w = Math.max(4, Math.round(a2.w * k1)); L.h = Math.max(4, Math.round(a2.h * k1)); }
                persistB(); refresh();
            });
            const aRow0 = el("div", "display:flex;gap:8px;align-items:center");
            aRow0.append(el("span", "font-size:11px;color:var(--c-text,#797e85)", "锚点"), anSel, anchorReset);
            anchorBox.append(aRow0);
            // 中间态：贴在某处、但某一轴跟着气泡一起变——比如贴左边、高度随气泡撑开
            const followRow = el("div", "display:flex;gap:14px;align-items:center;flex-wrap:wrap");
            const mkFollow = (key, lab) => {
                const wrap2 = el("label", "display:flex;gap:5px;align-items:center;font-size:11px;color:var(--c-text,#797e85);cursor:pointer");
                const cb = el("input"); cb.type = "checkbox";
                cb.addEventListener("change", () => {
                    const L = selLayer(); if (!L) return;
                    L[key] = cb.checked; persistB(); refresh();
                });
                wrap2.append(cb, document.createTextNode(lab));
                return { wrap2, cb };
            };
            const fwCb = mkFollow("fw", "宽度跟随气泡拉伸");
            const fhCb = mkFollow("fh", "高度跟随气泡拉伸");
            followRow.append(fwCb.wrap2, fhCb.wrap2);
            followRow.style.display = "none";   // 按用户要求收起，字段仍兼容旧数据
            // 等比缩放：宽高分开调容易调歪，这个滑块按原始比例整体放大缩小
            const sizeRow = el("div", "display:flex;align-items:center;gap:4px");
            const sizeIn2 = el("input", "flex:1"); sizeIn2.type = "range";
            sizeIn2.min = 10; sizeIn2.max = 300; sizeIn2.step = 1;
            const sizeVal2 = el("span", `font:10px ui-monospace,monospace;width:32px;text-align:right;flex:0 0 auto;color:${T.sub}`);
            const baseSize = (L) => {
                const a3 = assetById(L.id); const k2 = cur().scale || 0.54;
                return a3 ? [Math.max(4, Math.round(a3.w * k2)), Math.max(4, Math.round(a3.h * k2))] : [L.w, L.h];
            };
            sizeIn2.addEventListener("input", () => {
                const L = selLayer(); if (!L) return;
                const [bw0, bh0] = baseSize(L);
                const p = +sizeIn2.value / 100;
                L.w = Math.max(2, Math.round(bw0 * p));
                L.h = Math.max(2, Math.round(bh0 * p));
                clampSticker(L);
                sizeVal2.textContent = sizeIn2.value + "%";
                syncAnchorSliders(); paintPreview();
            });
            sizeIn2.addEventListener("change", () => persistB());
            sizeRow.append(el("span", `font-size:11px;width:26px;flex:0 0 auto;color:${T.ink}`, "大小"), sizeIn2, sizeVal2);
            anchorBox.append(sizeRow);
            const anchorSliders = [];
            [["X", "dx", -200, 200], ["Y", "dy", -200, 200], ["宽", "w", 1, 400], ["高", "h", 1, 400]].forEach(([lab, key, mn, mx]) => {
                const row = el("div", "display:flex;align-items:center;gap:4px");
                const rin = el("input", "flex:1;min-width:0"); rin.type = "range"; rin.min = mn; rin.max = mx;
                const vv = el("span", `font:10px ui-monospace,monospace;width:30px;text-align:right;flex:0 0 auto;color:${T.sub}`);
                rin.addEventListener("input", () => {
                    const L = selLayer(); if (!L) return;
                    L[key] = +rin.value; clampSticker(L);
                    vv.textContent = L[key]; schedulePaint();
                });
                rin.addEventListener("change", () => persist());
                row.append(el("span", `font-size:11px;width:16px;flex:0 0 auto;color:${T.ink}`, lab), rin, vv);
                anchorSliders.push({ rin, vv, key }); anchorBox.append(row);
            });

            // 红滑块（拉伸切线）
            const redBox = el("div", "display:none;flex-direction:column;gap:6px");
            const redSliders = [];
            // 显示顺序 左/右/上/下；idx 仍是 [左,上,右,下] 里的下标，数据结构不变
            [["左", 0], ["右", 2], ["上", 1], ["下", 3]].forEach(([lab, idx]) => {
                const row = el("div", "display:flex;align-items:center;gap:4px");
                const rin = el("input", "flex:1;min-width:0"); rin.type = "range"; rin.min = 0; rin.max = 110;
                const vv = el("span", `font:10px ui-monospace,monospace;width:26px;text-align:right;flex:0 0 auto;color:${T.sub}`);
                rin.addEventListener("input", () => {
                    const rr = redRef(); if (!rr) return;
                    const L = selLayer(); const aR = L && assetById(L.id);
                    const lim = aR ? (idx % 2 ? aR.h : aR.w) : 9999;
                    // 滑块值 = 线的位置（离左/上边多远）；右/下两条存的是角宽，要换算
                    const pos = +rin.value;
                    if (idx < 2) rr[idx] = Math.max(0, Math.min(pos, lim - rr[idx + 2] - 2));
                    else rr[idx] = Math.max(0, Math.min(lim - pos, lim - rr[idx - 2] - 2));
                    const shown = idx < 2 ? rr[idx] : lim - rr[idx];
                    rin.value = shown; vv.textContent = shown;
                    schedulePaint();
                });
                rin.addEventListener("change", () => persist());
                vv.style.cursor = "pointer"; vv.title = "点击输入精确值";
                vv.addEventListener("click", async () => {
                    const rr = redRef(); if (!rr) return;
                    const L0 = selLayer(); const a0 = L0 && assetById(L0.id);
                    const lim0 = a0 ? (idx % 2 ? a0.h : a0.w) : 0;
                    const v = await askText(`${lab}线位置`, "像素", String(idx < 2 ? rr[idx] : lim0 - rr[idx]), "离左边/上边的距离");
                    if (v == null || v === "" || isNaN(+v)) return;
                    rr[idx] = Math.max(0, Math.round(idx < 2 ? +v : lim0 - +v)); persistB(); refresh();
                });
                row.append(el("span", `font-size:11px;width:14px;flex:0 0 auto;font-weight:600;color:${LINE_RED}`, lab), rin, vv);
                redSliders.push({ rin, vv, idx }); redBox.append(row);
            });
            const centerBtn = el("button", BTN + ";padding:4px 12px;font-size:11px;flex:0 0 auto", "自动切线");
            centerBtn.title = "只让正中 1px 参与拉伸，四角和边框整个保持原样";
            centerBtn.addEventListener("click", () => {
                if (sel === "text") {          // 文字页：文字区回到默认
                    const bi = baseItem();
                    if (bi) { cur().content = contentDefault(bi.a); persistB(); refresh(); }
                    return;
                }
                const L = selLayer(); const a2 = L && assetById(L.id);
                if (L && a2) { L.slice = centerSlice(a2.w, a2.h); persistB(); refresh(); }
            });

            // 蓝滑块 + 文字样式
            const blueBox = el("div", "display:none;flex-direction:column;gap:6px");
            const blueSliders = [];
            [["左", 0], ["右", 2], ["上", 1], ["下", 3]].forEach(([lab, idx]) => {
                const row = el("div", "display:flex;align-items:center;gap:4px");
                const rin = el("input", "flex:1;min-width:0"); rin.type = "range"; rin.min = 0; rin.max = 110;
                const vv = el("span", `font:10px ui-monospace,monospace;width:26px;text-align:right;flex:0 0 auto;color:${T.sub}`);
                rin.addEventListener("input", () => {
                    const b2 = cur(); const bi = baseItem(); if (!bi) return;
                    if (!b2.content) b2.content = contentDefault(bi.a);
                    const c = b2.content;
                    const v = +rin.value;   // 四条都是「线的位置」
                    if (idx === 0) c[0] = Math.min(v, c[2] - 2);
                    if (idx === 1) c[1] = Math.min(v, c[3] - 2);
                    if (idx === 2) c[2] = Math.max(c[0] + 2, Math.min(v, bi.a.w));
                    if (idx === 3) c[3] = Math.max(c[1] + 2, Math.min(v, bi.a.h));
                    rin.value = c[idx]; vv.textContent = c[idx];
                    schedulePaint();
                });
                rin.addEventListener("change", () => persist());
                vv.style.cursor = "pointer"; vv.title = "点击输入精确值";
                vv.addEventListener("click", async () => {
                    const b2 = cur(); const bi = baseItem(); if (!bi) return;
                    if (!b2.content) b2.content = contentDefault(bi.a);
                    const c = b2.content;
                    const v = await askText(`${lab}线位置`, "像素", String(c[idx]), "离左边/上边的距离");
                    if (v == null || v === "" || isNaN(+v)) return;
                    c[idx] = Math.max(0, Math.round(+v));
                    persistB(); refresh();
                });
                row.append(el("span", `font-size:11px;width:14px;flex:0 0 auto;font-weight:600;color:#D9A83A`, lab), rin, vv);
                blueSliders.push({ rin, vv, idx }); blueBox.append(row);
            });
            const textExtra = el("div", "display:none;flex-direction:column;gap:6px");
            const textStyleRow = el("div", "display:flex;align-items:center;gap:10px;flex-wrap:wrap");
            const colorIn = el("input", `width:34px;height:26px;padding:0;border:1px solid ${T.line};border-radius:8px;background:none`);
            colorIn.type = "color";
            colorIn.addEventListener("input", () => { cur().color = colorIn.value; paintPreview(); });
            colorIn.addEventListener("change", () => persist());
            const colorHex = el("div", "font:11px ui-monospace,monospace;color:var(--c-text,#797e85);width:62px");
            const sizeIn = el("input", "flex:1;min-width:80px"); sizeIn.type = "range";
            sizeIn.min = 10; sizeIn.max = 20; sizeIn.step = 0.5;
            const sizeVal = el("div", "font:11px ui-monospace,monospace;color:var(--c-text,#797e85);width:44px;text-align:right");
            sizeIn.addEventListener("input", () => { cur().size = +sizeIn.value; sizeVal.textContent = sizeIn.value + "px"; paintPreview(); });
            sizeIn.addEventListener("change", () => persist());
            textStyleRow.append(el("span", "font-size:11px;color:var(--c-text,#797e85)", "颜色"), colorIn, colorHex,
                               el("span", "font-size:11px;color:var(--c-text,#797e85)", "字号"), sizeIn, sizeVal);
            textExtra.append(textStyleRow);
            // 字体：上传的字体所有气泡共享，选哪个是每个气泡自己的事
            const fontRow = el("div", "display:flex;align-items:center;gap:8px;flex-wrap:wrap");
            const fontSel = el("select",
                "font-size:11px;padding:3px 8px;border-radius:8px;" + `border:1px solid ${T.line};`
                + `background:${T.card};color:${T.ink};max-width:150px`);
            const rebuildFontSel = () => {
                fontSel.innerHTML = "";
                const d0 = document.createElement("option"); d0.value = ""; d0.textContent = "默认字体";
                fontSel.append(d0);
                bubbleFonts.forEach((f) => {
                    const o = document.createElement("option"); o.value = f.id; o.textContent = f.name;
                    fontSel.append(o);
                });
            };
            rebuildFontSel();
            fontSel.addEventListener("change", () => {
                cur().font = fontSel.value; persistB(); refresh();
            });
            const fontUpBtn = el("button", BTN + ";padding:3px 10px;font-size:11px", "上传字体");
            const fontIn = el("input", "display:none");
            fontIn.type = "file"; fontIn.accept = ".ttf,.otf,.woff,.woff2,font/*";
            fontUpBtn.addEventListener("click", () => fontIn.click());
            fontIn.addEventListener("change", async () => {
                const f = (fontIn.files || [])[0]; fontIn.value = "";
                if (!f) return;
                const src = await new Promise((res, rej) => {
                    const rd = new FileReader();
                    rd.onload = () => res(rd.result); rd.onerror = rej;
                    rd.readAsDataURL(f);
                });
                const name = f.name.replace(/\.[a-z0-9]+$/i, "");
                let fo = bubbleFonts.find((x) => x.name === name);
                if (fo) fo.src = src;
                else { fo = { id: `bf_${Date.now().toString(36)}_${bubbleFonts.length}`, name, src }; bubbleFonts.push(fo); }
                const old = document.getElementById(`avf-font-style-${fo.id}`);
                if (old) old.remove();
                ensureFontStyle(fo);
                cur().font = fo.id;
                persistB(); rebuildFontSel(); refresh();
                ctx.ui.toast(`字体「${name}」已上传（${(f.size / 1024 / 1024).toFixed(1)}MB）`);
            });
            const fontDelBtn = el("button", BTN + ";padding:3px 10px;font-size:11px", "删除");
            fontDelBtn.addEventListener("click", () => {
                const id = fontSel.value; if (!id) return;
                bubbleFonts = bubbleFonts.filter((x) => x.id !== id);
                Object.values(config.bubbles).forEach((bb) => { if (bb && bb.font === id) bb.font = ""; });
                const st = document.getElementById(`avf-font-style-${id}`);
                if (st) st.remove();
                persistB(); rebuildFontSel(); refresh();
            });
            fontRow.append(el("span", "font-size:11px;color:var(--c-text,#797e85)", "字体"),
                fontSel, fontUpBtn, fontIn, fontDelBtn);
            textExtra.append(fontRow);

            // 舞台在左、滑块在右，一行放下；模式选择 / 颜色字号字体这些宽控件放整行下面
            const sideCol = el("div", "flex:1;min-width:0;display:flex;flex-direction:column;gap:6px");
            sideCol.append(redBox, anchorBox, blueBox);
            const editBody = el("div", "display:flex;gap:10px;align-items:flex-start");
            editBody.append(stage, sideCol);
            modeRow.append(centerBtn);
            editSec.append(editTabs, editBody, hintLine, modeRow, textExtra);

            function paintStage() {
                const a2 = stageAsset();
                const L = selLayer();
                if (L) { if (isStickL(L)) lastStickSel = L.uid; else lastBaseSel = L.uid; }
                const page = sel === "text" ? "text" : (isStickL(L) ? "sticker" : "img");
                const hasStick = (cur().layers || []).some(isStickL);
                editTabBtns.forEach(([v, b]) => {
                    b.className = v === page ? "chat-list-tab active" : "chat-list-tab";
                    // 没有贴纸就不显示「贴纸」页，少一个空按钮
                    b.style.display = (v === "sticker" && !hasStick) ? "none" : "";
                });
                editTabHint.textContent = page === "text" ? "黄线 = 文字区"
                    : (page === "sticker" ? "贴纸位置 · 大小" : "粉线 = 拉伸区");
                stage.style.display = a2 ? "" : "none";
                const stH = resolveStack(cur());
                const isBaseH = !!(L && stH.base && stH.base.L.uid === L.uid);
                const onlyImgH = (cur().layers || []).length <= 1;
                hintLine.textContent = sel === "text"
                    ? (a2 ? "黄线 = 文字区，画在所有图层合成后的完整气泡上，可压到边角" : "先添加一张图片")
                    : (isBaseH && onlyImgH
                        ? "这一层是气泡主体。粉线圈住的中间部分会随文字拉伸，四角不变形"
                        : (L && L.mode === "anchor"
                            ? "贴纸大小位置固定，不随文字拉伸；用右边的滑块调大小和位置"
                            : "粉线 = 该图层的九宫格切线：线外四角不变形，线内中间随气泡拉伸"));
                if (!a2) return;
                stage.style.aspectRatio = `${a2.w}/${a2.h}`;
                if (sel === "text") {
                    stageImg.style.display = "none"; stageComp.style.display = "";
                    paintComposite(cur(), a2);
                } else {
                    stageComp.style.display = "none"; stageImg.style.display = "";
                    stageImg.style.backgroundImage = `url("${a2.src}")`;
                }
                const showRed = sel !== "text" && L && L.mode === "stretch";
                const showBlue = sel === "text";
                ["l", "r", "t", "b"].forEach((k) => {
                    lines[k].ln.style.display = lines[k].hit.style.display = showRed ? "" : "none";
                });
                ["cl", "cr", "ct", "cb"].forEach((k) => {
                    lines[k].ln.style.display = lines[k].hit.style.display = showBlue ? "" : "none";
                });
                if (showRed) {
                    const rr = redRef();
                    lines.l.ln.style.left = lines.l.hit.style.left = (rr[0] / a2.w * 100) + "%";
                    lines.r.ln.style.left = lines.r.hit.style.left = ((a2.w - rr[2]) / a2.w * 100) + "%";
                    lines.t.ln.style.top = lines.t.hit.style.top = (rr[1] / a2.h * 100) + "%";
                    lines.b.ln.style.top = lines.b.hit.style.top = ((a2.h - rr[3]) / a2.h * 100) + "%";
                }
                if (showBlue) {
                    const b2 = cur();
                    if (!b2.content) b2.content = contentDefault(a2);
                    const c = b2.content;
                    lines.cl.ln.style.left = lines.cl.hit.style.left = (c[0] / a2.w * 100) + "%";
                    lines.cr.ln.style.left = lines.cr.hit.style.left = (c[2] / a2.w * 100) + "%";
                    lines.ct.ln.style.top = lines.ct.hit.style.top = (c[1] / a2.h * 100) + "%";
                    lines.cb.ln.style.top = lines.cb.hit.style.top = (c[3] / a2.h * 100) + "%";
                }
            }

            /** 气泡在预览里的实际盒子尺寸——贴纸的活动范围以它为准 */
            function bubbleBox() {
                // 贴纸的活动范围按「气泡本体的图 × 倍率」算，不按预览里实时渲染出来的气泡尺寸——
                // 预览气泡会随文字长短变，之前每刷新一次就按新尺寸夹一次，贴纸会一点点被推到中间
                // 取「底图×倍率」和「预览实际渲染」两者的较大值：既不随文字长短抖，也不会比真实气泡小
                const r = rowA.bubble.getBoundingClientRect();
                let w = Math.round(r.width) || 200, h = Math.round(r.height) || 60;
                const bi = baseItem();
                if (bi && bi.a && bi.a.w) {
                    const k = cur().scale || 0.54;
                    w = Math.max(w, Math.round(bi.a.w * k)); h = Math.max(h, Math.round(bi.a.h * k));
                }
                return { w, h };
            }
            /** 把贴纸夹回气泡范围内：只夹位置，不改大小
             *（3.11.5 曾按底图尺寸把贴纸的宽高分别压小，导致贴纸被压扁、整套气泡看起来乱了——不能再动尺寸）*/
            function clampSticker(L) {
                if (!L || L.mode === "stretch") return;
                const box = bubbleBox();
                const an = L.anchor || "cc";
                const roomX = Math.max(0, box.w - (L.fw ? box.w : L.w));
                const roomY = Math.max(0, box.h - (L.fh ? box.h : L.h));
                const rx = an[0] === "c" ? [-Math.round(roomX / 2), Math.round(roomX / 2)] : [0, roomX];
                const ry = an[1] === "c" ? [-Math.round(roomY / 2), Math.round(roomY / 2)] : [0, roomY];
                L.dx = Math.max(rx[0], Math.min(rx[1], L.dx || 0));
                L.dy = Math.max(ry[0], Math.min(ry[1], L.dy || 0));
                return { rx, ry, box };
            }

            function syncAnchorSliders() {
                const L = selLayer(); if (!L) return;
                const lim = clampSticker(L);
                anchorSliders.forEach(({ rin, vv, key }) => {
                    if (lim) {
                        // 滑块范围跟着气泡走，拉到头也只是贴边，不会跑出去看不见
                        if (key === "dx") { rin.min = lim.rx[0]; rin.max = lim.rx[1]; }
                        if (key === "dy") { rin.min = lim.ry[0]; rin.max = lim.ry[1]; }
                        if (key === "w") { rin.min = 2; rin.max = lim.box.w; }
                        if (key === "h") { rin.min = 2; rin.max = lim.box.h; }
                    }
                    rin.value = L[key]; vv.textContent = L[key];
                    const off = (key === "w" && L.fw) || (key === "h" && L.fh);
                    rin.disabled = off; rin.style.opacity = off ? 0.35 : 1;
                    if (off) vv.textContent = "跟随";
                });
            }

            /** 只同步四条线的滑块数值（拖线时每帧调用，不动别的控件） */
            function syncLineSliders() {
                const L = selLayer();
                if (L && L.mode === "stretch") {
                    const rr = redRef(); const aR = assetById(L.id);
                    const limR = aR ? [aR.w, aR.h] : [110, 110];
                    redSliders.forEach(({ rin, vv, idx }) => {
                        const shown = idx < 2 ? rr[idx] : limR[idx % 2] - rr[idx];
                        rin.value = shown; vv.textContent = shown;
                    });
                } else if (sel === "text") {
                    const bi = baseItem(); const c = cur().content;
                    if (bi && c) blueSliders.forEach(({ rin, vv, idx }) => { rin.value = c[idx]; vv.textContent = c[idx]; });
                }
            }
            function syncControls() {
                const b2 = cur();
                roleBtns.forEach(([v, x]) => { x.className = role === v ? "chat-list-tab active" : "chat-list-tab"; });
                clearBtn.style.display = scope === GLOBAL ? "none" : "";
                scaleIn.value = b2.scale == null ? 0.54 : b2.scale;
                scaleVal.textContent = (+scaleIn.value).toFixed(2);
                [["oy", offSliders.oy], ["ox", offSliders.ox]].forEach(([kk, o]) => {
                    o.rin.value = b2[kk] || 0; o.vv.textContent = String(b2[kk] || 0);
                });
                alphaIn.value = b2.alpha == null ? 1 : b2.alpha;
                BUBBLE_ROLES.forEach(([r]) => {
                    mirBtns[r].className = editableBubble(scope, r).mirror ? "chat-list-tab active" : "chat-list-tab";
                });
                alphaVal.textContent = Math.round(+alphaIn.value * 100) + "%";
                const L = selLayer();
                const stC = resolveStack(b2);
                const isBase = !!(L && stC.base && stC.base.L.uid === L.uid);
                // 只有「全场唯一的图片层」才不给选模式（它必须撑起气泡本体）；
                // 只要还有别的图片层，这一层就允许切成贴纸。
                const onlyImg = (b2.layers || []).length <= 1;
                const onSticker = !!(L && L.mode !== "stretch");
                centerBtn.style.display = onSticker ? "none" : "";     // 贴纸没有切线
                modeRow.style.display = ((L && !(isBase && onlyImg)) || !onSticker) ? "flex" : "none";
                if (L) modeSel.value = L.mode === "stretch" ? "stretch" : "anchor";
                redBox.style.display = (L && (L.mode === "stretch" || (isBase && onlyImg))) ? "flex" : "none";
                anchorBox.style.display = (L && L.mode !== "stretch" && !(isBase && onlyImg)) ? "flex" : "none";
                const hasImg = (b2.layers || []).length > 0;
                blueBox.style.display = (sel === "text" && hasImg) ? "flex" : "none";
                textExtra.style.display = blueBox.style.display;
                if (!hasImg) { redBox.style.display = "none"; anchorBox.style.display = "none"; modeRow.style.display = "none"; }
                if (L && L.mode === "stretch") {
                    const rr = redRef(); const aR = assetById(L.id);
                    redSliders.forEach(({ rin, vv, idx }) => {
                        // 量程跟图片走：大图的切线可能远超 110
                        const limR = aR ? (idx % 2 ? aR.h : aR.w) : 110;
                        rin.max = Math.max(110, limR);
                        const shown = idx < 2 ? rr[idx] : limR - rr[idx];
                        rin.value = shown; vv.textContent = shown;
                    });
                }
                if (L && L.mode !== "stretch") {
                    anSel.value = L.anchor || "lc";
                    fwCb.cb.checked = !!L.fw; fhCb.cb.checked = !!L.fh;
                    syncAnchorSliders();
                    const [bw0] = baseSize(L);
                    const pct = bw0 ? Math.round(L.w / bw0 * 100) : 100;
                    sizeIn2.value = Math.max(10, Math.min(300, pct));
                    sizeVal2.textContent = sizeIn2.value + "%";
                }
                if (sel === "text") {
                    const bi = baseItem();
                    if (bi) {
                        if (!b2.content) b2.content = contentDefault(bi.a);
                        const c = b2.content;
                        blueSliders.forEach(({ rin, vv, idx }) => {
                            rin.max = Math.max(110, idx % 2 ? bi.a.h : bi.a.w);
                            rin.value = c[idx]; vv.textContent = c[idx];
                        });
                    }
                    rebuildFontSel();
                    fontSel.value = (b2.font && fontById(b2.font)) ? b2.font : "";
                    colorIn.value = b2.color || "#2C3440";
                    colorHex.textContent = b2.color || "（未设）";
                    sizeIn.value = b2.size || 13.5;
                    sizeVal.textContent = (b2.size || 13.5) + "px";
                }
            }

            // ═ 预览渲染：两侧各按各的配置，与 bubbleRule 同一套逻辑 ═
            function styleBubble(row, bcfg, text) {
                const st = resolveStack(bcfg);
                const bubble = row.bubble, md = row.md;
                bubble.className = `chat-bubble-role-${row.wrap.getAttribute("data-role")} avf-prev-bubble`
                    + ` rounded-md break-words relative`;
                md.textContent = text || " ";
                const k = bcfg.scale || 1;
                const baseSl = st.base ? layerSlice(st.base) : null;
                const bw = baseSl ? baseSl.map((v) => Math.max(1, Math.round(v * k))) : [0, 0, 0, 0];
                const bare = !st.base && !st.extras.length && !st.overlays.length;
                bubble.style.cssText = bare
                    ? "position:relative;width:fit-content;max-width:100%;"   // 没套皮肤：就用宿主自己的气泡样式
                    : "position:relative;isolation:isolate;padding:0;overflow:visible;background-color:transparent;"
                      + "box-shadow:none;width:fit-content;max-width:100%;"
                      + "display:flex;flex-direction:column;";
                if (bcfg.ox || bcfg.oy) {
                    const mir = row.wrap.getAttribute("data-role") === "user" ? -bcfg.ox : bcfg.ox;
                    bubble.style.transform = `translate(${mir || 0}px, ${bcfg.oy || 0}px)`;
                }
                const alphaMode = (useAlpha(bcfg) || !!bcfg.mirror) && !!st.base;
                if (st.base) {
                    bubble.style.boxSizing = "border-box";
                    bubble.style.minWidth = Math.round(st.base.a.w * k) + "px";
                    bubble.style.minHeight = Math.round(st.base.a.h * k) + "px";
                    bubble.style.borderStyle = "solid";
                    bubble.style.borderWidth = `${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px`;
                    if (alphaMode) { bubble.style.borderImage = "none"; bubble.style.borderColor = "transparent"; }
                    else bubble.style.borderImage = `${imgSrc(st.base.a.src)} ${baseSl[1]} ${baseSl[2]} ${baseSl[3]} ${baseSl[0]} fill`
                        + ` / ${bw[1]}px ${bw[2]}px ${bw[3]}px ${bw[0]}px / 0 stretch`;
                }
                if (st.extras.length && !alphaMode) {
                    bubble.style.backgroundImage = st.extras.map((x) => imgSrc(x.a.src)).join(", ");
                    bubble.style.backgroundPosition = st.extras.map((x) => anchorPos(x.L)).join(", ");
                    bubble.style.backgroundSize = st.extras.map((x) => anchorSize(x.L)).join(", ");
                    bubble.style.backgroundRepeat = st.extras.map(() => "no-repeat").join(", ");
                    bubble.style.backgroundOrigin = "border-box";
                    bubble.style.backgroundClip = "border-box";
                }
                bubble.querySelectorAll(".avf-ov").forEach((n) => n.remove());
                (alphaMode ? alphaBuckets(st) : st.buckets).forEach((bk) => {
                    if (!bk.stretch && !bk.stickers.length) return;
                    const d = el("div"); d.className = "avf-ov";
                    d.style.cssText = `position:absolute;pointer-events:none;z-index:${bk.z};`
                        + `inset:${-bw[1]}px ${-bw[2]}px ${-bw[3]}px ${-bw[0]}px;`
                        + (useAlpha(bcfg) ? `opacity:${(+bcfg.alpha).toFixed(2)};` : "")
                        + (bcfg.mirror ? "transform:scaleX(-1);" : "") + bucketCSS(bk, bw, baseSl, k);
                    bubble.prepend(d);
                });
                md.style.position = "relative";
                md.style.zIndex = st.zPos["text"] || 99;
                md.style.flex = "1 1 auto"; md.style.minHeight = "0";
                md.style.display = "flex"; md.style.flexDirection = "column";
                md.style.justifyContent = "center"; md.style.alignItems = "center";
                md.style.textAlign = "left";
                if (st.base) {
                    const cbP = bcfg.content || contentDefault(st.base.a);
                    const rhP = Math.max(0, Math.round((cbP[3] - cbP[1]) * k));
                    md.style.minHeight = `calc(${rhP}px + .5em)`; md.style.boxSizing = "border-box"; md.style.transform = "";
                    md.style.lineHeight = "1.5";
                } else { md.style.minHeight = "0"; md.style.transform = ""; }
                if (st.base) {
                    const cb0 = bcfg.content || contentDefault(st.base.a);
                    let mLp = Math.round(cb0[0] * k) - bw[0], mRp = Math.round((st.base.a.w - cb0[2]) * k) - bw[2];
                    if (bcfg.mirror) [mLp, mRp] = [mRp, mLp];
                    md.style.margin = `calc(${Math.round(cb0[1] * k) - bw[1]}px - .25em) ${mRp}px `
                        + `calc(${Math.round((st.base.a.h - cb0[3]) * k) - bw[3]}px - .25em) ${mLp}px`;
                } else md.style.margin = "";
                // 没套皮肤时交给宿主默认样式；套了皮肤又没设色时用深色，浅色预览底上白字看不见
                const fallback = bare ? "" : (st.base ? "" : "var(--c-text-title,#2c3440)");
                md.style.color = bcfg.color || fallback;
                bubble.style.color = bcfg.color || fallback;
                bubble.style.fontSize = (bcfg.size || 13.5) + "px";
                bubble.style.fontFamily = (bcfg.font && fontById(bcfg.font))
                    ? `"${fontFamily(bcfg.font)}", -apple-system, sans-serif` : "";
            }
            function paintPreview() {
                const chat = getChat();
                THEME_VARS.forEach((v) => prevBox.style.removeProperty(v));
                if (chat.theme) Object.entries(chat.theme).forEach(([kk, vv]) => prevBox.style.setProperty(kk, vv));
                rowA.av.src = chat.aAvatar; rowU.av.src = chat.uAvatar;
                // 群聊：对方气泡上方显示发言人名字
                rowA.nm.textContent = chat.isGroup ? (chat.aName || "") : "";
                rowA.nm.style.display = rowA.nm.textContent ? "" : "none";
                // 头像框预览里有气泡，这里也叠上头像框——取已保存生效的设置
                [["assistant", rowA], ["user", rowU]].forEach(([r, row]) => {
                    const e = config.enabled ? resolveEntry(scope, r) : null;
                    const pairs = liveLayers(e).map((L) => ({ L, f: frameById(L.id) }));
                    // 头像本体的缩放也照搬过来，不然框和头像对不上
                    const avs = avScale(e);
                    row.av.style.transform = Math.abs(avs - 1) > 0.005 ? `scale(${avs.toFixed(2)})` : "";
                    if (pairs.length) {
                        // 这里只是给气泡预览做个陪衬，一个 div 叠所有层就够
                        row.fr.style.display = "block";
                        row.fr.style.opacity = String(e.g && e.g.alpha != null ? e.g.alpha : 1);
                        row.fr.style.backgroundImage = pairs.map((x) => `url("${x.f.src}")`).join(", ");
                        row.fr.style.backgroundSize = pairs.map((x) => `${(AVATAR_BOX * effL(x.L, e.g).scale).toFixed(1)}px auto`).join(", ");
                        row.fr.style.backgroundPosition = pairs.map((x) => { const e2 = effL(x.L, e.g);
                            return `calc(50% + ${Math.round(e2.dx)}px) calc(50% + ${Math.round(e2.dy)}px)`; }).join(", ");
                        row.fr.style.backgroundRepeat = pairs.map(() => "no-repeat").join(", ");
                        row.fr.removeAttribute("src");
                    } else row.fr.style.display = "none";
                });
                // 渲染规则（和头像框页一致）：正在编辑的那一侧画草稿；另一侧画它「已生效」的样子。
                // 「双方」档：两侧都画对方那份草稿（我方落库时会镜像成一样），镜像开关各自的。
                const aShow = (role === "all" || role === "assistant") ? editableBubble(scope, "assistant") : liveBubble(scope, "assistant");
                const uCfg = editableBubble(scope, "user");
                const uShow = role === "all" ? { ...editableBubble(scope, "assistant"), mirror: !!uCfg.mirror }
                    : role === "user" ? uCfg : liveBubble(scope, "user");
                styleBubble(rowA, aShow, sampleText || chat.aText);
                styleBubble(rowU, uShow, sampleText || chat.uText);
            }

            // ═ 气泡库（整包）═
            function applyPack(pk) {
                // 只套到当前「设置对象」：选了对方就只改对方、选我方只改我方，双方才两侧一起
                (role === "all" ? BUBBLE_ROLES.map(([r]) => r) : [role]).forEach((r) => {
                    const oldFont = (config.bubbles[bubbleKey(scope, r)] || {}).font || "";
                    const src0 = pk.sides[r] || pk.sides.assistant || pk.sides.user;
                    if (!src0) return;                                  // 空包：别把现有配置写没了
                    const nb = JSON.parse(JSON.stringify(src0));
                    if (oldFont && !nb.font) nb.font = oldFont;   // 包里没带字体时才沿用本机原来的字体
                    config.bubbles[bubbleKey(scope, r)] = nb;
                });
                if (!config.packSel) config.packSel = {};
                config.packSel[scope] = pk.id;
                persistB();
            }
            const pkgBtn = iconBtn(BTN, "upload"); pkgBtn.title = "导入气泡包或图片";
            const pkgIn = el("input", "display:none");
            pkgIn.type = "file"; pkgIn.accept = ".json,application/json,image/*"; pkgIn.multiple = true;
            pkgBtn.addEventListener("click", () => pkgIn.click());
            pkgIn.addEventListener("change", async () => {
                const files = Array.from(pkgIn.files || []); pkgIn.value = "";
                let ok = 0;
                for (const f of files) {
                    try {
                        let pkg;
                        if (/^image\//.test(f.type)) {
                            // 单张图片也算一个包：整张当气泡主体，默认中心 1px 切线
                            const src = await new Promise((res, rej) => {
                                const rd = new FileReader();
                                rd.onload = () => res(rd.result); rd.onerror = rej;
                                rd.readAsDataURL(f);
                            });
                            pkg = { name: f.name.replace(/\.[a-z0-9]+$/i, ""), images: [src], _single: true,
                                assistant: { base: 0, layers: [] }, user: { base: 0, layers: [] } };
                        } else {
                            pkg = JSON.parse(await f.text());
                        }
                        if (!pkg || !Array.isArray(pkg.images)) throw new Error("不是气泡包");
                        // 头像包和气泡包结构相近，导错库会得到一堆看不懂的条目，这里直接拦下
                        if (pkg.format === "float-avatar/1") throw new Error("这是头像包，请到头像库导入");
                        const ids = pkg.images.map((src, i) => {
                            const dup = bubbleAssets.find((a) => a.src === src);
                            if (dup) return dup.id;
                            const id = `bs_${Date.now().toString(36)}_${ok}_${i}_${bubbleAssets.length}`;
                            bubbleAssets.push({ id, name: `${pkg.name || "气泡"}-${i + 1}`, src, w: 128, h: 112 });
                            return id;
                        });
                        await Promise.all(ids.map((id, i) => new Promise((res) => {
                            const im = new Image();
                            im.onload = () => { const a = assetById(id); if (a) { a.w = im.naturalWidth; a.h = im.naturalHeight; } res(); };
                            im.onerror = () => res();
                            im.src = pkg.images[i];
                        })));
                        if (pkg._single) {
                            // 任意图片当气泡：按高度缩到约 72px 高，四周各留 30% 当不变形的角
                            const a0 = assetById(ids[0]);
                            if (a0 && a0.h) {
                                pkg.scale = Math.max(0.05, Math.min(1, +(72 / a0.h).toFixed(3)));
                                pkg.slice = [Math.round(a0.w * 0.3), Math.round(a0.h * 0.3),
                                             Math.round(a0.w * 0.3), Math.round(a0.h * 0.3)];
                            }
                        }
                        // 包里带的字体：同源（同名或同数据）的复用，没有的加进本机字体库
                        const fontIds = (pkg.fonts || []).map((fo) => {
                            if (!fo || !fo.src) return null;
                            let f = bubbleFonts.find((x) => x.src === fo.src) || bubbleFonts.find((x) => x.name === fo.name);
                            if (!f) {
                                f = { id: `bf_${Date.now().toString(36)}_${bubbleFonts.length}`, name: fo.name || "字体", src: fo.src };
                                bubbleFonts.push(f); ensureFontStyle(f);
                            }
                            return f.id;
                        });
                        const sides = {};
                        BUBBLE_ROLES.forEach(([r]) => {
                            const side = pkg[r] || {};
                            const layers = [];
                            // 包里的 base 也是一层：放到最底
                            if (side.base != null && ids[side.base]) {
                                const a0 = assetById(ids[side.base]);
                                layers.push({ uid: newUid(), id: ids[side.base], mode: "stretch",
                                    slice: ((side.slice || pkg.slice) || (a0 ? centerSlice(a0.w, a0.h) : [63, 55, 64, 56])).slice(),
                                    anchor: "lc", dx: 0, dy: 0, w: a0 ? a0.w : 128, h: a0 ? a0.h : 112 });
                            }
                            (side.layers || []).forEach((L) => {
                                if (!ids[L.img]) return;
                                const aX = assetById(ids[L.img]);
                                const kX = side.scale != null ? side.scale : (pkg.scale != null ? pkg.scale : 0.54);
                                const isStick = (L.mode || "anchor") !== "stretch";
                                // 贴纸尺寸按气泡缩放换算；包里给的是原始像素的话会比气泡还大
                                const o = { uid: newUid(), id: ids[L.img], mode: L.mode || "anchor",
                                    anchor: L.anchor || (isStick ? "lt" : "lc"),
                                    dx: L.dx || 0, dy: L.dy || 0,
                                    w: (isStick && aX) ? Math.max(4, Math.round(aX.w * kX)) : (L.w || 128),
                                    h: (isStick && aX) ? Math.max(4, Math.round(aX.h * kX)) : (L.h || 112),
                                    fw: !!L.fw, fh: !!L.fh };
                                if (Array.isArray(L.slice)) o.slice = L.slice.slice();
                                layers.push(o);
                            });
                            const zorder = layers.map((L) => L.uid).concat(["text"]);
                            sides[r] = {
                                layers, zorder,
                                ox: side.ox || 0, oy: side.oy || 0,
                                color: side.color || pkg.color || "", size: side.size || 13.5,
                                ...(side.alpha != null ? { alpha: side.alpha } : {}),
                                ...(side.mirror ? { mirror: true } : {}),
                                ...(side.font != null && fontIds[side.font] ? { font: fontIds[side.font] } : {}),
                                scale: side.scale != null ? side.scale : (pkg.scale != null ? pkg.scale : 0.54),
                                content: (side.content || pkg.content || null)
                                    ? ((side.content || pkg.content)).slice() : null,
                            };
                        });
                        const name = pkg.name || f.name.replace(/\.json$/i, "");
                        const old = bubblePacks.find((x) => x.name === name);
                        const pack = { id: old ? old.id : `bp_${Date.now().toString(36)}_${bubblePacks.length}`, name, sides };
                        if (old) Object.assign(old, pack); else bubblePacks.push(pack);
                        applyPack(pack);
                        ok++;
                    } catch (e) {
                        ctx.system.log("气泡包导入失败", f.name, e);
                        ctx.ui.toast(`「${f.name}」不是有效的气泡包或图片`);
                    }
                }
                if (ok) { persistB(); refresh(); ctx.ui.toast(`已导入 ${ok} 个气泡包`); }
            });
            const expBtn = iconBtn(BTN, "download"); expBtn.title = "导出当前气泡";
            expBtn.addEventListener("click", () => {
                const used = [];
                const idx = (id) => {
                    if (!id) return -1;
                    let i = used.indexOf(id);
                    if (i < 0) { used.push(id); i = used.length - 1; }
                    return i;
                };
                // 字体也打进包（dataURL），别人导入后能一起用；每种字体只放一份
                const usedFonts = [];
                const fidx = (id) => {
                    const f = id ? fontById(id) : null;
                    if (!f) return undefined;
                    let i = usedFonts.indexOf(f.id);
                    if (i < 0) { usedFonts.push(f.id); i = usedFonts.length - 1; }
                    return i;
                };
                const side = (r) => {
                    const b2 = resolveBubble(scope, r) || DEFAULT_BUBBLE();
                    normalizeBubble(b2);
                    const fi = fidx(b2.font);
                    return {
                        base: null,
                        scale: b2.scale, content: b2.content,
                        ...(b2.ox ? { ox: b2.ox } : {}), ...(b2.oy ? { oy: b2.oy } : {}),
                        // 透明 / 镜像 / 字号 / 字体 / 文字颜色：这一侧自己的
                        ...(b2.alpha != null && b2.alpha < 0.995 ? { alpha: b2.alpha } : {}),
                        ...(b2.mirror ? { mirror: true } : {}),
                        ...(b2.size ? { size: b2.size } : {}),
                        ...(b2.color ? { color: b2.color } : {}),
                        ...(fi != null ? { font: fi } : {}),
                        layers: (b2.layers || []).map((L) => ({
                            img: idx(L.id), mode: L.mode, anchor: L.anchor,
                            dx: L.dx, dy: L.dy, w: L.w, h: L.h,
                            ...(L.fw ? { fw: true } : {}), ...(L.fh ? { fh: true } : {}),
                            ...(L.slice ? { slice: L.slice } : {}),
                        })).filter((L) => L.img >= 0),
                        zorder: (b2.zorder || []).map((z) =>
                            z === "text" ? "text" : (b2.layers || []).findIndex((L) => L.uid === z))
                            .filter((z) => z === "text" || z >= 0),
                    };
                };
                const a = side("assistant"), u = side("user");
                const cb = cur();
                const pkg = {
                    format: "float-bubble/1",
                    name: (scopeSel.options[scopeSel.selectedIndex] || {}).textContent || "气泡",
                    color: cb.color, scale: cb.scale,
                    assistant: a, user: u,
                    images: used.map((id) => (assetById(id) || {}).src).filter(Boolean),
                    fonts: usedFonts.map((id) => { const f = fontById(id); return { name: f.name, src: f.src }; }),
                };
                if (!pkg.images.length) { ctx.ui.toast("当前没有素材可导出"); return; }
                try {
                    const blob = new Blob([JSON.stringify(pkg)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a2 = document.createElement("a");
                    a2.href = url; a2.download = `${pkg.name}.json`;
                    document.body.appendChild(a2); a2.click(); a2.remove();
                    ctx.system.timers.setTimeout(() => URL.revokeObjectURL(url), 4000);
                    ctx.ui.toast("已导出气泡包");
                } catch (e) {
                    ctx.ui.toast("导出失败"); ctx.system.log("导出失败", e);
                }
            });
            const packBar = el("div",
                "display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:8px;"
                + "font-size:12px;color:var(--c-text,#797e85)");
            const packCount = el("span");
            const secPacks = el("span", `font-size:13px;font-weight:700;color:${T.ink}`, "气泡库");
            secPacks.className = "avfp-sec";
            const packSearch = el("input",
                `flex:1;min-width:90px;font-size:12px;padding:5px 9px;border-radius:9px;border:1px solid ${T.line};`
                + `background:${T.card};color:${T.ink}`);
            packSearch.type = "search"; packSearch.placeholder = "搜气泡名…";
            packSearch.addEventListener("input", () => { packShown = PACK_PAGE; paintPacks(); });
            // 第二行：搜索框 + 紧跟其后的「搜索」按钮（输入时已即时过滤，按钮用来收键盘/再筛一次）
            const searchRow = el("div", "flex-basis:100%;display:flex;gap:6px;align-items:center");
            const searchB = el("button", BTN + ";padding:5px 8px;font-size:12px;line-height:1.2;flex:0 0 auto", "搜索");
            searchB.addEventListener("click", () => { packShown = PACK_PAGE; paintPacks(); packSearch.blur(); });
            searchRow.append(packSearch, searchB);
            // 选中包的操作：重命名 / 删除，只在库里有包被选中时出现（和头像库同构）
            let pickedBubblePack = null;
            const renBp = iconBtn(BTN, "pencil"); renBp.title = "重命名选中的气泡包";
            renBp.addEventListener("click", async () => {
                if (!pickedBubblePack) return;
                const pk = pickedBubblePack;
                const v = ((await askText("重命名气泡", "输入新名字", pk.name, "留空 = 不改")) || "").trim();
                if (v && v !== pk.name) { pk.name = v; persistB(); refresh(); }
            });
            const delBp = iconBtn(BTN_DANGER, "trash"); delBp.title = "删除选中的气泡包";
            delBp.addEventListener("click", () => {
                if (!pickedBubblePack) return;
                const pk = pickedBubblePack;
                bubblePacks = bubblePacks.filter((x) => x.id !== pk.id);
                // 没有任何包/任何设置再用到的素材一起清掉
                const usedIds = new Set();
                bubblePacks.forEach((x) => BUBBLE_ROLES.forEach(([r]) => {
                    ((x.sides[r] || {}).layers || []).forEach((L) => usedIds.add(L.id));
                }));
                Object.values(config.bubbles).forEach((bb) => {
                    (bb.layers || []).forEach((L) => usedIds.add(L.id));
                });
                bubbleAssets = bubbleAssets.filter((a3) => usedIds.has(a3.id));
                if (config.packSel) delete config.packSel[scope];
                pickedBubblePack = null;
                persistB(); refresh();
                ctx.ui.toast("已删除这个气泡包（当前图层保留）");
            });
            // 「不使用」：当前作用范围 + 设置对象 不套任何气泡皮肤（回到宿主默认气泡）
            // 「＋」新建：当前对象清成空白，并让图层区（添加图片 / 链接导入）出来，从零搭一套
            let newLayerMode = false;
            const plusB = iconBtn(BTN, "plus"); plusB.title = "新建一个空白气泡包";
            plusB.addEventListener("click", () => {
                // 库里立刻多一张空白卡片并选中；之后的每次改动都自动存回这张卡片（见 persistB）
                const pk = { id: `bp_${Date.now().toString(36)}_${bubblePacks.length}`, name: `新气泡 ${bubblePacks.length + 1}`,
                             sides: { assistant: DEFAULT_BUBBLE(), user: DEFAULT_BUBBLE() }, fresh: true };
                bubblePacks.push(pk);
                (role === "all" ? BUBBLE_ROLES.map(([r]) => r) : [role]).forEach((r) => {
                    config.bubbles[bubbleKey(scope, r)] = DEFAULT_BUBBLE();
                });
                if (!config.packSel) config.packSel = {};
                config.packSel[scope] = pk.id;
                sel = "text"; newLayerMode = true;
                persistB(); refresh();
                // 让人看得到反应：滚到图层区并提示下一步
                try { layerHead.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
                ctx.ui.toast("已清空，点「＋添加图片」或「链接导入」加第一层");
            });
            const noUseB = iconBtn(BTN, "ban");
            noUseB.title = "这个范围/对象不用气泡皮肤";
            noUseB.addEventListener("click", () => {
                (role === "all" ? BUBBLE_ROLES.map(([r]) => r) : [role]).forEach((r) => {
                    config.bubbles[bubbleKey(scope, r)] = DEFAULT_BUBBLE();
                });
                if (config.packSel) delete config.packSel[scope];
                sel = "text";
                persistB(); refresh(); paintEntry();
                ctx.ui.toast("已取消气泡皮肤");
            });
            packBar.append(secPacks, packCount, plusB, noUseB, pkgBtn, expBtn, renBp, delBp, pkgIn, searchRow);
            const PACK_PAGE = 60;
            let packShown = PACK_PAGE;
            const packGrid = el("div",
                "display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;padding:8px 0");
            function paintPacks() {
                packGrid.innerHTML = "";
                const q = packSearch.value.trim().toLowerCase();
                const list = q ? bubblePacks.filter((x) => (x.name || "").toLowerCase().includes(q)) : bubblePacks;
                packCount.textContent = q ? `${list.length}/${bubblePacks.length}` : `${bubblePacks.length}`;
                if (!bubblePacks.length) {
                    packGrid.append(el("div",
                        `grid-column:1/-1;font-size:11px;color:${T.sub};padding:6px 0`,
                        "还没有气泡，点「导入气泡包」选 .json（可多选）。"));
                    return;
                }
                if (!list.length) {
                    packGrid.append(el("div", `grid-column:1/-1;font-size:11px;color:${T.sub};padding:6px 0`,
                        `没有名字含「${packSearch.value.trim()}」的气泡`));
                    return;
                }
                const selId = (config.packSel || {})[scope];
                pickedBubblePack = bubblePacks.find((x) => x.id === selId) || null;
                renBp.style.display = delBp.style.display = pickedBubblePack ? "" : "none";
                // 几千个包一次全画会卡住，先画一批，点「显示更多」再续
                list.slice(0, packShown).forEach((pk) => {
                    const cell = el("div",
                        "position:relative;border-radius:12px;padding:7px 5px 5px;cursor:pointer;"
                        + `background:${T.card};display:flex;flex-direction:column;gap:4px;`
                        + `align-items:center;box-shadow:${T.shadow};transition:box-shadow .15s`);
                    cell.className = "avfp-cell";
                    cell.style.border = (selId === pk.id ? `2px solid ${T.yellowDeep}` : `1px solid ${T.line}`);
                    if (selId === pk.id) cell.style.boxShadow = "0 0 0 3px rgba(245,215,110,.45)";
                    const aSide = pk.sides.assistant || {};
                    const firstL = (aSide.layers || [])[aSide.layers && aSide.layers.length > 1 ? 1 : 0];
                    const th = (assetById(firstL && firstL.id) || assetById(((aSide.layers || [])[0] || {}).id) || {}).src || "";
                    const img = el("img", "width:100%;aspect-ratio:8/7;object-fit:contain;pointer-events:none");
                    if (th) img.src = th;
                    const nm = el("div",
                        "font-size:10px;color:var(--c-text,#797e85);max-width:100%;overflow:hidden;"
                        + "text-overflow:ellipsis;white-space:nowrap", pk.name);
                    cell.addEventListener("click", () => { newLayerMode = false; applyPack(pk); selDefault(); refresh(); });
                    cell.append(img, nm);
                    packGrid.append(cell);
                });
                if (list.length > packShown) {
                    const more = el("button", BTN + ";grid-column:1/-1;padding:7px 0;font-size:12px",
                        `显示更多（还有 ${list.length - packShown} 个）`);
                    more.addEventListener("click", () => { packShown += PACK_PAGE; paintPacks(); });
                    packGrid.append(more);
                }
            }

            // ═ 底部 ═
            const footer = el("div",
                "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:stretch;padding:10px 16px 14px;flex:0 0 auto;"
                + "border-top:1px solid var(--c-card-border,#e0e0e0)");   // 左侧 72px 让开宿主悬浮按钮
            const applyAll = el("button", BTN + ";padding:9px 10px;font-size:12px;white-space:nowrap;flex:0 0 auto", "应用到所有");
            // 两段式确认：这个按钮会删掉所有聊天的单独设置，误点一下就全没了
            let applyAllArmed = null;
            applyAll.addEventListener("click", () => {
                if (!applyAllArmed) {
                    applyAll.textContent = "确认覆盖？";
                    applyAll.title = "会把当前设置变成全局默认，并清掉每个聊天的单独设置";
                    applyAllArmed = setTimeout(() => { applyAllArmed = null; applyAll.textContent = "应用到所有"; }, 4000);
                    return;
                }
                clearTimeout(applyAllArmed); applyAllArmed = null; applyAll.textContent = "应用到所有";
                // 把本会话两侧的设置抄成全局默认，并删掉所有会话级覆盖。
                //（之前写的是 bubbleKey(GLOBAL, role)，「双方」档下 role 是 "all"，写出一个没人读的 global:all）
                const roles = role === "all" ? BUBBLE_ROLES.map(([r]) => r) : [role];
                const copies = {};
                roles.forEach((r) => { copies[r] = JSON.parse(JSON.stringify(editableBubble(scope, r))); });
                BUBBLE_ROLES.forEach(([r]) => {
                    Object.keys(config.bubbles).forEach((kk) => {
                        if (kk.endsWith(":" + r) && !kk.startsWith(GLOBAL + ":")) delete config.bubbles[kk];
                    });
                });
                roles.forEach((r) => { config.bubbles[bubbleKey(GLOBAL, r)] = copies[r]; });
                config.bubbleEnabled = true;
                scope = GLOBAL; scopeSel.value = GLOBAL;
                config.bubblesLive = JSON.parse(JSON.stringify(config.bubbles));   // 直接落成已生效
                persistB(); apply(); refresh(); paintEntry();
                ctx.ui.toast("已应用到所有聊天");
            });
            const useBtn = el("button", BTN_MAIN);
            useBtn.addEventListener("click", () => {
                // 把草稿整份落成「已生效」，再重注 CSS
                config.bubblesLive = JSON.parse(JSON.stringify(config.bubbles || {}));
                config.bubbleEnabled = true;
                persistB(); apply(); refresh(); paintEntry();
                ctx.ui.toast("气泡已应用");
            });
            const offBtn = el("button", BTN + ";padding:9px 10px;font-size:12px", "停用");
            offBtn.addEventListener("click", () => {
                config.bubbleEnabled = false;
                persistB(); apply(); paintActions(); paintEntry();
                ctx.ui.toast("气泡已停用");
            });
            // 清空气泡：配置、素材、气泡库一锅端（两段式确认，字体保留）
            const DANGER_B = "var(--c-danger,#e5484d)";
            const wipeB = iconBtn(BTN_DANGER, "eraser"); wipeB.title = "清空气泡库";
            let wipeArmed = null;
            wipeB.addEventListener("click", () => {
                if (!wipeArmed) {
                    wipeB.textContent = "确认清空库？";
                    wipeArmed = setTimeout(() => { wipeArmed = null; wipeB.innerHTML = svgIcon("eraser"); }, 3000);
                    return;
                }
                clearTimeout(wipeArmed); wipeArmed = null; wipeB.innerHTML = svgIcon("eraser");
                const n = bubblePacks.length, m = bubbleAssets.length;
                config.bubbles = {};
                config.packSel = {};
                bubbleAssets.length = 0;
                bubblePacks.length = 0;
                sel = "text";
                persist(); apply(); refresh(); paintEntry();
                ctx.ui.toast(`已清空气泡库：${n} 个包、${m} 张素材`);
            });
            // 和头像库同一顺序：库名 · 数量 · 导入 · 导出 · 清空库 · 搜索框
            packBar.insertBefore(wipeB, pkgIn);
            footer.append(applyAll, useBtn, offBtn);   // 应用到所有聊天放底栏，和启用/停用一起（非全局时才显示）
            /** 草稿（config.bubbles）和已生效那份（config.bubblesLive）有没有差别 */
            function bubblesDirty() {
                try { return JSON.stringify(config.bubbles || {}) !== JSON.stringify(config.bubblesLive || {}); } catch { return true; }
            }
            function paintActions() {
                // 没启用 → 启用气泡；改过还没应用 → 更新设置；否则 → 当前已生效
                useBtn.textContent = !config.bubbleEnabled ? "启用气泡" : (bubblesDirty() ? "更新设置" : "当前已生效");
                offBtn.style.display = config.bubbleEnabled ? "" : "none";
            }

            // ═ 组装 ═
            const ctlCap = el("div", `display:flex;align-items:center;font-size:11px;color:${T.sub};padding:6px 0 2px`);
            ctlReset.style.marginLeft = "auto";
            // 标题和「图层」一个样式（13px 粗体），后面的说明小字
            const ctlTitle = el("span", `flex:1;font-size:13px;font-weight:700;color:${T.ink}`, "整体调整");
            ctlTitle.className = "avfp-sec";
            ctlTitle.append(el("span", `font-size:11px;font-weight:400;color:${T.sub};margin-left:4px`, "所有图层一起"));
            ctlCap.append(ctlTitle, ctlReset);
            collapsible(ctlCap, ctlTitle, ctlRow, true);   // 默认收起，点标题展开
            // 预览文字输入框放在预览卡下面、卡片外面（卡片和头像框页保持一样，也不会跟着输入跳）
            const textWrap = el("div", "padding:2px 0 6px");
            textInput.style.width = "100%"; textInput.style.boxSizing = "border-box";
            textWrap.append(textInput);
            // 图层 / 气泡库 都能点标题折叠（默认展开）
            const layersFold = collapsible(layerHead, secLayers, [layerList, editSec], true);
            collapsible(packBar, secPacks, [packGrid], true);
            scroll.append(textWrap, ctlCap, ctlRow, layerHead, layerList, editSec, packBar, packGrid);
            const scrollAll = el("div",
                "flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column");
            scrollAll.append(head, prevBox, scroll);
            // 拖切线/拖滑块期间把预览区高度锁死：气泡随手势变高变矮时卡片不跟着跳，页面就不抖
            const PREV_MIN = "150px";
            let prevLocked = false;
            const lockPreview = () => {
                if (prevLocked) return;
                prevLocked = true;
                // 直接锁死高度（不只是最小高度）：气泡变得更高也只是溢出画在外面，卡片不动
                pWrap.style.height = Math.max(150, Math.ceil(pWrap.getBoundingClientRect().height)) + "px";
                const un = () => {
                    prevLocked = false; pWrap.style.height = ""; pWrap.style.minHeight = PREV_MIN;
                    document.removeEventListener("pointerup", un); document.removeEventListener("pointercancel", un);
                };
                document.addEventListener("pointerup", un); document.addEventListener("pointercancel", un);
            };
            scrollAll.addEventListener("pointerdown", (e) => {
                const tg = e.target;
                if ((tg instanceof HTMLInputElement && tg.type === "range") || stage.contains(tg)) lockPreview();
            }, true);
            root.append(scrollAll, footer);

            /** 拖滑块/拖线时每帧只重画一次，避免一次手势触发上百次重排 */
            let rafPending = 0;
            function schedulePaint() {
                if (rafPending) return;
                rafPending = requestAnimationFrame(() => { rafPending = 0; paintStage(); paintPreview(); paintActions(); });
            }
            function refresh() {
                // 第一次打开就停在「气泡」页（有图片的话），不用手点
                if (firstPaint) { firstPaint = false; if (sel === "text") selDefault(); }
                paintLayers(); syncControls(); paintStage(); paintPacks(); paintPreview(); paintActions();
                // 所有贴纸都夹回气泡范围（老配置、导入的包也一并归位），
                // 夹完若有改动再画一次，避免出现「看不见的贴纸」
                const b0 = cur();
                let moved = false;
                (b0.layers || []).forEach((L) => {
                    if (L.mode === "stretch") return;
                    const before = `${L.dx},${L.dy},${L.w},${L.h}`;
                    clampSticker(L);
                    if (`${L.dx},${L.dy},${L.w},${L.h}` !== before) moved = true;
                });
                if (moved) { paintPreview(); syncAnchorSliders(); }
            }
            refresh();
            return refresh;
        }


        // ── 浮层：完整设置界面 ──────────────────────────────
        // 交互约定：面板里的一切操作（选框、调缩放、拖位置）都只改草稿、只动预览，
        // 不碰真实聊天；按下「使用」才写入配置并生效。这样点素材就是纯预览。
        let paintEntry = () => { };

        function openPanel() {
            ensureConfig();
            // 打开面板那一刻若正在聊天室里，先抓一份最新快照：预览的配色/头像/文字才和当前聊天一致
            captureChatSnapshot();
            ctx.ui.openModal((host, api) => {
                let curScope = GLOBAL;
                let curRole = "all";
                /** 草稿：{ assistant: {layers:[{uid,id,scale,dx,dy,back}]}, user: {...} } */
                let draft = {};
                const AV = "__avatar__";    // 图层列表里的「头像」行（头像本体）
                let selL = null;            // 当前选中的图层 uid，或 AV

                function loadDraft() {
                    draft = {};
                    ROLES.forEach(([role]) => {
                        const own = normEntry(config.entries[entryKey(curScope, role)]);
                        const eff = own || resolveEntry(curScope, role);
                        draft[role] = { layers: eff ? JSON.parse(JSON.stringify(eff.layers)) : [],
                                        g: { scale: 1, dx: 0, dy: 0, alpha: 1, ...(eff && eff.g ? eff.g : {}) },
                                        av: { scale: 1, ...(eff && eff.av ? eff.av : {}) } };
                    });
                    const ls = draft[targets()[0]].layers;
                    if (selL !== AV && !ls.some((L) => L.uid === selL)) selL = ls.length ? ls[0].uid : AV;
                }
                /** 当前选中的图层（在所有目标角色里按下标对齐）；选中「头像」行时为 -1 */
                function selIndex() {
                    if (selL === AV) return -1;
                    const ls = draft[targets()[0]].layers;
                    const i = ls.findIndex((L) => L.uid === selL);
                    return i < 0 ? (ls.length ? 0 : -1) : i;
                }
                /** 「全部」档下两侧必须是同一套图层，否则按下标写入会错位甚至只改到一边 */
                function syncAll() {
                    if (curRole !== "all") return;
                    const ts = targets(), src = draft[ts[0]].layers;
                    const same = ts.every((r) => draft[r].layers.length === src.length
                        && draft[r].layers.every((L, i) => L.uid === src[i].uid));
                    if (same) return;
                    ts.slice(1).forEach((r) => { draft[r].layers = JSON.parse(JSON.stringify(src)); });
                }
                function eachSel(fn) {
                    syncAll();
                    const i = selIndex(); if (i < 0) return;
                    targets().forEach((r) => { const L = draft[r].layers[i]; if (L) fn(L); });
                }
                /** 重新读草稿但保留当前选中层 */
                function loadDraftKeep() { const k = selL; loadDraft(); if (k) selL = k; }
                /** 当前要改哪些角色（「全部」= 两个一起改） */
                const targets = () => (curRole === "all" ? ROLES.map(([r]) => r) : [curRole]);
                /** 读：取第一个目标的值；same 表示各目标是否一致（不一致时 UI 要提示） */
                function readField(key) {
                    const i = selIndex();
                    if (i < 0) return { value: DEFAULT_PARAMS[key], same: true };
                    const ts = targets();
                    const get = (r) => { const L = draft[r].layers[i]; return L ? L[key] : undefined; };
                    const v = get(ts[0]);
                    return { value: v, same: ts.every((r) => get(r) === v) };
                }
                /** 写：落到所有目标角色的同一层 */
                function setField(key, value) { eachSel((L) => { L[key] = value; }); }
                const cur = () => draft[targets()[0]];
                const curLayers = () => cur().layers;

                /** 草稿与已生效配置是否有差异（含未启用的情况） */
                function isDirty() {
                    if (!config.enabled) return true;
                    const key = (e) => JSON.stringify([((e && e.layers) || []).map((L) =>
                        [L.id, L.scale, L.dx, L.dy, !!L.back]), { scale: 1, dx: 0, dy: 0, alpha: 1, ...((e && e.g) || {}) },
                        { scale: 1, ...((e && e.av) || {}) }]);
                    return targets().some((role) => key(resolveEntry(curScope, role)) !== key(draft[role]));
                }
                /** 预览里某一侧该画什么：正在编辑的侧画草稿，另一侧画它现在真正生效的设置 */
                function shownEntry(role) {
                    if (curRole === "all" || curRole === role) return draft[role];
                    const eff = config.enabled ? resolveEntry(curScope, role) : null;   // 没启用 = 聊天室里没框
                    return eff ? normEntry(eff) : { layers: [], g: { scale: 1, dx: 0, dy: 0, alpha: 1 }, av: { scale: 1 } };
                }

                /** 把草稿写进指定范围并生效 */
                function commit(scope) {
                    // 只落当前「设置对象」那几侧：对方档只写对方，我方档只写我方，双方才两侧都写。
                    // 预览里另一侧显示的是它已生效的样子，所以「看到什么就应用什么」
                    targets().forEach((role) => {
                        config.entries[entryKey(scope, role)] = JSON.parse(JSON.stringify(draft[role]));
                    });
                    // 「＋」新建出来的空白卡片：应用时把当前图层存进去，卡片就有内容了
                    const fresh = pickedId && avatarPacks.find((pk) => pk.id === pickedId && pk.fresh);
                    if (fresh) {
                        targets().forEach((role) => {
                            fresh.sides[role] = draft[role].layers.map((L) => ({ id: L.id, scale: L.scale, dx: L.dx, dy: L.dy, back: !!L.back }));
                        });
                        const d0 = draft[targets()[0]];
                        fresh.g = { scale: 1, dx: 0, dy: 0, ...(d0.g || {}) }; fresh.av = { scale: 1, ...(d0.av || {}) };
                    }
                    config.enabled = true;
                    persist(); apply(); paintEntry();
                }

                // 全屏形态：编辑器内容多，居中小卡片放不下。占满视口并让出刘海/手势条。
                if (host.parentElement) host.parentElement.style.padding = "0";
                host.style.cssText =
                    "background-color:Canvas;"
                    + "background-image:linear-gradient(var(--c-card,#fff),var(--c-card,#fff)),"
                    + "linear-gradient(var(--c-page-body-bg,#fff),var(--c-page-body-bg,#fff));"
                    + "color:var(--c-text-title,#2c3440);border-radius:0;"
                    + "width:100vw;height:100vh;height:100dvh;max-height:none;"
                    + "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);"
                    + "display:flex;flex-direction:column;overflow:hidden";
                ensurePanelStyle();
                host.classList.add("avfp");
                armSliders(host);

                // ── 标题栏已去掉，只留下面两个元素挂到 tab 行上 ──
                const dirtyTag = el("div", `font-size:10px;color:${T.brown}`);
                const closeBtn = el("button",
                    "margin-left:auto;border:none;background:transparent;cursor:pointer;padding:0;width:30px;height:30px;"
                    + `font-size:20px;line-height:30px;color:${T.ink}`, "✕");
                closeBtn.addEventListener("click", () => api.close());


                // ── 作用范围 ──
                const scopeRow = el("div", "display:flex;align-items:center;gap:8px;padding:0 16px 10px;flex:0 0 auto");
                scopeRow.append(el("div", "font-size:12px;width:56px;flex:0 0 auto", "作用范围"));
                const scopeSel = el("select",
                    "flex:0 0 auto;width:98px;min-width:0;font-size:12px;padding:5px 6px;border-radius:8px;text-overflow:ellipsis;"
                    + "border:1px solid var(--c-card-border,#e0e0e0);background:var(--c-card,#fff);color:var(--c-text-title,#2c3440)");
                const optG = document.createElement("option");
                optG.value = GLOBAL; optG.textContent = "全局默认";
                scopeSel.append(optG);
                sessionList().forEach((s) => {
                    const o = document.createElement("option");
                    o.value = s.id; o.textContent = s.name;
                    scopeSel.append(o);
                });
                scopeSel.addEventListener("change", () => {
                    curScope = scopeSel.value;
                    // 预览卡带上会话 class，已生效的会话级气泡皮肤才会套到预览里
                    previewCard.className = "avfp-card" + (curScope !== GLOBAL ? ` session-${curScope}` : "");
                    chat = sampleChat(curScope);
                    // 头像也要跟着换——stage 是复用的，不改 src 的话会一直显示上一个会话的人
                    A.img.src = chat.aAvatar;
                    U.img.src = chat.uAvatar;
                    // 必须回写变量：replaceWith 之后原变量仍指向已脱离文档的旧节点，
                    // 后面 paintPreview 拿它做高亮会失效。
                    const nA = makeRow("assistant", chat.aText, A.stage);
                    const nU = makeRow("user", chat.uText, U.stage);
                    rowA.replaceWith(nA); rowU.replaceWith(nU);
                    rowA = nA; rowU = nU;
                    loadDraft(); refreshAll();
                });
                const clearBtn = el("button", BTN, "跟随全局");
                clearBtn.addEventListener("click", () => {
                    ROLES.forEach(([role]) => { delete config.entries[entryKey(curScope, role)]; });
                    persist(); apply(); loadDraft(); refreshAll(); paintEntry();
                    ctx.ui.toast("本会话已恢复为跟随全局");
                });
                scopeRow.append(scopeSel, clearBtn);

                // ── 设置对象 ──
                // 设置对象单独一行（双方 / 对方 / 我方），和气泡框页一样
                const roleRow = el("div", "display:flex;align-items:center;gap:8px;padding:0 16px 10px;flex:0 0 auto");
                /** 把某一侧的草稿重新从已保存的设置里读回来（丢掉这一侧没应用的改动） */
                function reloadRole(r) {
                    const own = normEntry(config.entries[entryKey(curScope, r)]);
                    const eff = own || resolveEntry(curScope, r);
                    draft[r] = { layers: eff ? JSON.parse(JSON.stringify(eff.layers)) : [],
                                 g: { scale: 1, dx: 0, dy: 0, alpha: 1, ...(eff && eff.g ? eff.g : {}) },
                                 av: { scale: 1, ...(eff && eff.av ? eff.av : {}) } };
                }
                const roleBtns = [];
                ROLE_TABS.forEach(([v, label]) => {
                    const b = el("button", "flex:1 1 0;padding:5px 9px;font-size:12px", label);
                    b.className = "chat-list-tab";
                    b.addEventListener("click", () => {
                        // 切到「双方」时把对方那份镜像给我方：双方档的含义就是两侧一致，
                        // 否则之前在单侧改过的草稿会让预览左右不一样，应用后也不一致（和气泡页同一规则）
                        if (v === "all") {
                            const src = draft.assistant;
                            draft.user = { layers: (src.layers || []).map((L) => ({ ...L, uid: newFUid() })),
                                           g: { ...(src.g || { scale: 1, dx: 0, dy: 0, alpha: 1 }) },
                                           av: { ...(src.av || { scale: 1 }) } };
                            const ls = draft.assistant.layers;
                            if (selL !== AV && !ls.some((L) => L.uid === selL)) selL = ls.length ? ls[0].uid : AV;
                        }
                        curRole = v; refreshAll();
                    });
                    roleBtns.push([v, b]); roleRow.append(b);
                });
                const inheritTag = el("div", "font-size:10px;flex:0 0 auto");
                scopeRow.append(inheritTag);
                scopeRow.style.flexWrap = "wrap";

                // ── 预览 ──
                let chat = sampleChat(curScope);
                const previewCard = el("div", "position:sticky;top:0;z-index:5;" + PREV_CARD + ";display:flex;flex-direction:column");
                previewCard.className = "avfp-card";
                mountDayNight(previewCard);
                let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, dragEl = null;
                function bindDrag(stage, role) {
                    stage.addEventListener("pointerdown", (e) => {
                        // 处于「全部」档时拖任一头像都两侧同动，不切档
                        if (curRole !== "all") { curRole = role; refreshAll(); }
                        const i0 = selIndex();
                        const p = i0 >= 0 ? draft[role].layers[i0] : null;
                        if (!p) return;
                        dragging = true; dragEl = stage;
                        sx = e.clientX; sy = e.clientY; ox = p.dx; oy = p.dy;
                        try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
                        stage.style.cursor = "grabbing";
                    });
                    stage.addEventListener("pointermove", (e) => {
                        if (!dragging || dragEl !== stage) return;
                        setField("dx", Math.round(ox + (e.clientX - sx)));
                        setField("dy", Math.round(oy + (e.clientY - sy)));
                        syncInputs(); paintPreview(); paintActions();
                    });
                    const end = (e) => {
                        if (!dragging || dragEl !== stage) return;
                        dragging = false; dragEl = null; stage.style.cursor = "grab";
                        try { stage.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                    };
                    stage.addEventListener("pointerup", end);
                    stage.addEventListener("pointercancel", end);
                }
                function makeStage(src, role) {
                    const stage = el("div",
                        `position:relative;width:${AVATAR_BOX}px;height:${AVATAR_BOX}px;flex:0 0 auto;touch-action:none;cursor:grab`);
                    stage.className = "chat-msg-avatar";
                    const img = el("img",
                        `width:${AVATAR_BOX}px;height:${AVATAR_BOX}px;border-radius:50%;object-fit:cover;`
                        + "display:block;background:var(--c-input,#ebebeb)");
                    img.src = src;
                    img.addEventListener("error", () => { img.src = PLACEHOLDER; });
                    // 前后各一个容器：后面那个画在头像下面，前面那个盖在头像上
                    const mk = (z) => el("div",
                        `position:absolute;left:50%;top:${AVATAR_BOX / 2}px;width:${FBOX}px;height:${FBOX}px;`
                        + `transform:translate(-50%,-50%);pointer-events:none;z-index:${z}`);
                    const back = mk(0), front = mk(2);
                    img.style.position = "relative"; img.style.zIndex = "1";
                    stage.append(back, img, front);
                    bindDrag(stage, role);
                    return { stage, back, front, img };
                }
                // 用宿主真实的 class 搭预览，样式由 styles/chat.css 提供，
                // 跟聊天室里长得一样；utility 类照抄 chat-room.tsx:6027 的写法。
                // 结构照抄 chat-room.tsx:6006 / message-bubble.tsx:547，
                // 一个内联样式都不加——布局(display/gap/对齐)、宽度(max-w-[70%])、
                // 气泡外观全部交给 styles/chat.css，这样预览和聊天室是同一套渲染。
                function makeRow(role, text, stage) {
                    const wrap = el("div");
                    wrap.className = "chat-msg-wrapper avf-preview";
                    wrap.setAttribute("data-role", role);
                    const content = el("div");
                    content.className = "chat-msg-content-wrap flex flex-col min-w-0 max-w-[70%]";
                    const bubble = el("div");
                    bubble.className =
                        `chat-bubble-role-${role} rounded-md break-words relative cursor-pointer select-none`;
                    const md = el("div");
                    md.className = "chat-markdown hide-scrollbar break-words";
                    md.append(el("div", null, text));
                    bubble.append(md);
                    // 群聊：对方气泡上方带发言人名字（用宿主同名 class，样式和聊天室一致）
                    if (role === "assistant" && chat.isGroup && chat.aName) {
                        const nm = el("span", null, chat.aName); nm.className = "chat-group-sender-name";
                        content.append(nm);
                    }
                    content.append(bubble);
                    if (role === "user") wrap.append(content, stage);
                    else wrap.append(stage, content);
                    return wrap;
                }
                const A = makeStage(chat.aAvatar, "assistant");
                const U = makeStage(chat.uAvatar, "user");
                let rowA = makeRow("assistant", chat.aText, A.stage);
                let rowU = makeRow("user", chat.uText, U.stage);
                const readout = el("div",
                    "font:11px/1.6 ui-monospace,SFMono-Regular,monospace;color:var(--c-text,#797e85);text-align:center");
                const themeNote = el("div",
                    "font-size:10px;color:var(--c-icon,#a0a3a8);text-align:center");
                // 和气泡框页同一套内层：两行 + 8px 间距 + 最小高度 150，两页卡片等高
                const pWrapA = el("div", "display:flex;flex-direction:column;gap:16px;min-height:150px;justify-content:center");
                pWrapA.append(rowA, rowU);
                themeNote.style.display = "none";
                previewCard.append(pWrapA, themeNote);

                // ── 滑块 ──
                function slider(label, key, min, max, step) {
                    const row = el("div", "display:flex;align-items:center;gap:10px");
                    const input = el("input", "flex:1;min-width:0");
                    input.type = "range"; input.min = min; input.max = max; input.step = step;
                    const val = el("div",
                        "font:11px ui-monospace,monospace;color:var(--c-text,#797e85);width:44px;text-align:right;flex:0 0 auto");
                    const refresh = () => {
                        const { value, same } = readField(key);
                        input.value = value;
                        const txt = key === "scale" ? Number(value).toFixed(2) : `${value}px`;
                        val.textContent = same ? txt : "不一致";
                        val.style.color = same ? "var(--c-text,#797e85)" : "var(--c-icon,#a0a3a8)";
                    };
                    input.addEventListener("input", () => {
                        setField(key, key === "scale" ? Number(input.value) : Math.round(Number(input.value)));
                        refresh(); paintPreview(); paintActions();
                    });
                    row.append(el("div", "font-size:12px;width:44px;flex:0 0 auto", label), input, val);
                    numEdit(val, label, () => readField(key).value,
                        (v) => { setField(key, key === "scale" ? Math.min(3, Math.max(0.6, v)) : Math.round(v)); refreshAll(); });
                    return { row, refresh };
                }
                // ── 整体调整：所有图层一起缩放/位移，放预览卡下面、图层之前 ──
                const gGet = (k) => (draft[targets()[0]].g || {})[k];
                const gSet = (k, v) => { targets().forEach((r) => { if (!draft[r].g) draft[r].g = { scale: 1, dx: 0, dy: 0, alpha: 1 }; draft[r].g[k] = v; }); };
                const gCells = [];
                const gCell = (lab, key, mn, mx, st, fmt) => {
                    const col = el("div", CELL);
                    const vv = el("div", CELL_VAL);
                    const rin = el("input", "flex:1;min-width:0;margin:0"); rin.type = "range";
                    rin.min = mn; rin.max = mx; rin.step = st;
                    rin.addEventListener("input", () => {
                        gSet(key, (key === "scale" || key === "alpha") ? +rin.value : Math.round(+rin.value));
                        vv.textContent = fmt(+rin.value); paintPreview(); paintActions();
                    });
                    col.append(el("span", CELL_LAB, lab), rin, vv);
                    numEdit(vv, key === "alpha" ? `${lab}（%）` : lab,
                        () => { const v = gGet(key); const d = (key === "scale" || key === "alpha") ? 1 : 0; const x = v == null ? d : v; return key === "alpha" ? Math.round(x * 100) : x; },
                        (v) => {
                            gSet(key, key === "alpha" ? Math.min(1, Math.max(0, v / 100))
                                : key === "scale" ? Math.min(3, Math.max(0.3, v))
                                : Math.round(Math.min(60, Math.max(-60, v))));
                            refreshAll();
                        });
                    gCells.push({ rin, vv, key, fmt });
                    return col;
                };
                const gRow = el("div", "display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding:0 16px 10px");
                const gReset = iconBtn(BTN, "reset", 15);
                gReset.title = "整体复位：缩放回 1、位置归零";
                gReset.addEventListener("click", () => { gSet("scale", 1); gSet("dx", 0); gSet("dy", 0); gSet("alpha", 1); refreshAll(); });
                gRow.append(gCell("缩放", "scale", 0.3, 3, 0.01, (v) => v.toFixed(2)),
                            gCell("左右", "dx", -60, 60, 1, (v) => String(Math.round(v))),
                            gCell("上下", "dy", -60, 60, 1, (v) => String(Math.round(v))),
                            gCell("透明", "alpha", 0, 1, 0.01, (v) => Math.round(v * 100) + "%"));
                const gCap = el("div", `display:flex;align-items:center;font-size:11px;color:${T.sub};padding:6px 16px 2px`);
                gReset.style.marginLeft = "auto";
                const gTitle = el("span", `flex:1;font-size:13px;font-weight:700;color:${T.ink}`, "整体调整");
                gTitle.className = "avfp-sec";
                gTitle.append(el("span", `font-size:11px;font-weight:400;color:${T.sub};margin-left:4px`, "所有图层一起 · 预览里可拖头像"));
                gCap.append(gTitle, gReset);
                collapsible(gCap, gTitle, gRow, true);   // 默认收起，点标题展开（和气泡框页一样）
                const syncG = () => gCells.forEach(({ rin, vv, key, fmt }) => {
                    const v = gGet(key); rin.value = v == null ? ((key === "scale" || key === "alpha") ? 1 : 0) : v; vv.textContent = fmt(+rin.value);
                });
                const sScale = slider("缩放", "scale", 0.6, 3, 0.01);
                const sX = slider("左右", "dx", -40, 40, 1);
                const sY = slider("上下", "dy", -40, 40, 1);
                // 头像本体：只有一个缩放（选中图层列表里的「头像」行时显示）
                const avGet = () => { const a = draft[targets()[0]].av; return a && a.scale > 0 ? +a.scale : 1; };
                const avSet = (v) => targets().forEach((r) => { if (!draft[r].av) draft[r].av = { scale: 1 }; draft[r].av.scale = v; });
                const avRow = el("div", "display:flex;align-items:center;gap:10px");
                const avIn = el("input", "flex:1;min-width:0"); avIn.type = "range"; avIn.min = 0.5; avIn.max = 2; avIn.step = 0.01;
                const avVal = el("div",
                    "font:11px ui-monospace,monospace;color:var(--c-text,#797e85);width:44px;text-align:right;flex:0 0 auto");
                avIn.addEventListener("input", () => {
                    avSet(+avIn.value); avVal.textContent = (+avIn.value).toFixed(2); paintPreview(); paintActions();
                });
                const avReset = iconBtn(BTN, "reset", 15);
                avReset.title = "头像还原为 1 倍";
                avReset.addEventListener("click", () => { avSet(1); syncInputs(); paintPreview(); paintActions(); });
                avRow.append(el("div", "font-size:12px;width:44px;flex:0 0 auto", "缩放"), avIn, avVal, avReset);
                numEdit(avVal, "头像缩放", () => avGet(), (v) => { avSet(Math.min(2, Math.max(0.5, v))); refreshAll(); });
                const avCap = el("div", `font-size:11px;color:${T.sub}`, "头像本体的调整（整个圆头像一起放大缩小，边框图层不动）");
                // 选中图层的标题行：说明 + ↺（把这一层的缩放/位置复原）
                const layerCap = el("div", `display:flex;align-items:center;font-size:11px;color:${T.sub}`);
                const layerReset = iconBtn(BTN + ";margin-left:auto", "reset", 15);
                layerReset.title = "这一层复原：缩放回默认、位置归零";
                layerReset.addEventListener("click", () => {
                    setField("scale", DEFAULT_PARAMS.scale);
                    setField("dx", 0); setField("dy", 0);
                    refreshAll();
                });
                layerCap.append(el("span", "", "选中图层的调整（只动这一层）"), layerReset);
                const syncInputs = () => {
                    syncG();
                    sScale.refresh(); sX.refresh(); sY.refresh();
                    avIn.value = avGet(); avVal.textContent = avGet().toFixed(2);
                    const avSel = selL === AV;
                    // 注意：滑块行是 display:flex 的内联样式，藏/显要写回 "flex"，写 "" 会退化成 block 而换行
                    layerCap.style.display = avSel ? "none" : "flex";
                    [sScale.row, sX.row, sY.row].forEach((x) => { x.style.display = avSel ? "none" : "flex"; });
                    avCap.style.display = avSel ? "block" : "none";
                    avRow.style.display = avSel ? "flex" : "none";
                    // 一层都没有且没选头像时滑块没有作用对象，藏起来
                    const has = (curLayers().length > 0 || avNewMode) && avLayersFold.isOpen();
                    sliderBox.style.display = has ? "flex" : "none";
                };
                const sliderBox = el("div",
                    "display:flex;flex-direction:column;gap:8px;padding:12px 16px 12px;flex:0 0 auto;"
                    + "border-bottom:1px solid var(--c-card-border,#e0e0e0)");
                sliderBox.append(layerCap, sScale.row, sX.row, sY.row, avCap, avRow);

                // ── 图层：标题行（复位/清空/加图片/链接导入）+ 列表，和气泡框同构 ──
                const avLayerHead = el("div", "display:flex;align-items:center;gap:6px;padding:4px 16px 6px;flex-wrap:wrap");
                const secAvL = el("span", `flex:1;font-size:13px;font-weight:700;color:${T.ink}`, "图层");
                secAvL.className = "avfp-sec";
                const avLayerBox = el("div", "padding:0 16px 8px;display:flex;flex-direction:column;gap:4px");
                function paintAvLayers() {
                    avLayerBox.innerHTML = "";
                    const ls = curLayers();
                    // 没有图层（还没选头像框、也没加图）时整个列表不出现，和气泡框页一样
                    // 新建模式下没有图层也把列表露出来（里面自带「头像」这一行）
                    avLayerHead.style.display = (ls.length || avNewMode) ? "flex" : "none";
                    avLayerBox.style.display = ((ls.length || avNewMode) && avLayersFold.isOpen()) ? "flex" : "none";
                    if (!ls.length && !avNewMode) return;
                    // 「头像」行：头像本体，永远在列表里（和气泡框的「文字」行一样），只能缩放
                    const avOn = selL === AV;
                    const avRowEl = el("div",
                        "display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:10px;cursor:pointer;"
                        + (avOn ? `background:#FFF6D6;border:1px solid ${T.yellowDeep}`
                                : `background:${T.card};border:1px solid ${T.line}`));
                    avRowEl.addEventListener("click", () => { selL = AV; refreshAll(); });
                    const avTh = el("div",
                        "width:26px;height:26px;flex:0 0 auto;border-radius:50%;background-size:cover;"
                        + `background-position:center;background-color:${T.card}`);
                    avTh.style.backgroundImage = `url("${(targets()[0] === "user" ? chat.uAvatar : chat.aAvatar) || PLACEHOLDER}")`;
                    avRowEl.append(avTh,
                        el("div", `flex:1;min-width:0;font-size:12px;color:${T.ink}`, "头像"),
                        el("div", "font-size:10px;color:var(--c-icon,#a0a3a8);flex:0 0 auto", "头像本体 · 缩放"));
                    const rowOf = (L, i) => {
                        const f = frameById(L.id);
                        const on = L.uid === selL || (selIndex() === i && !ls.some((x) => x.uid === selL));
                        const row = el("div",
                            "display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:10px;cursor:pointer;"
                            + (on ? `background:#FFF6D6;border:1px solid ${T.yellowDeep}`
                                  : `background:${T.card};border:1px solid ${T.line}`));
                        row.addEventListener("click", () => { selL = L.uid; refreshAll(); });
                        const th = el("div",
                            "width:26px;height:26px;flex:0 0 auto;border-radius:6px;background-size:contain;"
                            + `background-repeat:no-repeat;background-position:center;background-color:${T.card}`);
                        if (f) th.style.backgroundImage = `url("${f.src}")`;
                        row.append(th, el("div",
                            `flex:1;min-width:0;font-size:12px;color:${T.ink};overflow:hidden;`
                            + "text-overflow:ellipsis;white-space:nowrap", f ? f.name : "素材已删除"));
                        const mv = (d, sym) => {
                            const b = el("button", BTN + ";padding:3px 9px;font-size:13px;line-height:1.1", sym);
                            b.addEventListener("click", (e) => {
                                e.stopPropagation(); syncAll();
                                targets().forEach((r) => {
                                    const arr = draft[r].layers, j = i + d;
                                    if (j < 0 || j >= arr.length) return;
                                    [arr[i], arr[j]] = [arr[j], arr[i]];
                                });
                                selL = L.uid; refreshAll();
                            });
                            return b;
                        };
                        const bk = el("button", BTN + ";padding:3px 8px;font-size:11px",
                            L.back ? "头像后" : "头像前");
                        bk.title = "切换这一层画在头像前面还是后面";
                        bk.addEventListener("click", (e) => {
                            e.stopPropagation(); syncAll();
                            targets().forEach((r) => { const x = draft[r].layers[i]; if (x) x.back = !x.back; });
                            selL = L.uid; refreshAll();
                        });
                        const del = el("button", BTN + `;padding:3px 9px;font-size:13px;line-height:1.1;color:${T.red}`, "✕");
                        del.addEventListener("click", (e) => {
                            e.stopPropagation(); syncAll();
                            targets().forEach((r) => { draft[r].layers.splice(i, 1); });
                            const rest = curLayers();
                            selL = rest.length ? rest[Math.min(i, rest.length - 1)].uid : AV;
                            refreshAll();
                        });
                        row.append(bk, mv(-1, "↑"), mv(1, "↓"), del);
                        return row;
                    };
                    ls.forEach((L, i) => avLayerBox.append(rowOf(L, i)));
                    avLayerBox.append(avRowEl);
                }

                // ── 素材库（唯一滚动区）──
                const libBar = el("div",
                    "display:flex;align-items:center;gap:8px;padding:12px 16px 8px;flex:0 0 auto;"
                    + "font-size:12px;color:var(--c-text,#797e85)");
                const libCount = el("span");
                // 选中包的操作：重命名 / 删除，只在库里有一个包被选中（当前图层和它一致）时出现
                let pickedPack = null;
                let pickedId = null;   // 明确点过/新建的那张卡片（空白卡片没法靠图层比对认出来）
                const renPk = iconBtn(BTN, "pencil"); renPk.title = "重命名选中的头像包";
                renPk.addEventListener("click", async () => {
                    if (!pickedPack) return;
                    const pk = pickedPack;
                    const v = ((await askText("重命名头像框", "输入新名字", pk.name, "留空 = 不改")) || "").trim();
                    if (v && v !== pk.name) { pk.name = v; persist(); refreshAll(); }
                });
                const delPk = iconBtn(BTN_DANGER, "trash"); delPk.title = "删除选中的头像包";
                delPk.addEventListener("click", () => {
                    if (!pickedPack) return;
                    avatarPacks = avatarPacks.filter((x) => x.id !== pickedPack.id);
                    pickedPack = null;
                    persist(); refreshAll();
                    ctx.ui.toast("已删除这个头像包（当前图层保留）");
                });
                // 两段式确认，不用 window.confirm
                // （宿主在部分环境里会屏蔽原生弹窗，静默失败比误删更难排查）。
                const DANGER = "var(--c-danger,#e5484d)";
                const wipeBtn = iconBtn(BTN_DANGER, "eraser"); wipeBtn.title = "清空头像库";
                let armed = false;
                function disarm() {
                    armed = false;
                    wipeBtn.innerHTML = svgIcon("eraser");
                    wipeBtn.style.background = "transparent";
                    wipeBtn.style.color = DANGER;
                }
                wipeBtn.addEventListener("click", () => {
                    if (!armed) {
                        armed = true;
                        wipeBtn.textContent = "确认清空？";
                        wipeBtn.style.background = DANGER;
                        wipeBtn.style.color = "#fff";
                        ctx.system.timers.setTimeout(disarm, 5000);
                        return;
                    }
                    const n = avatarPacks.length, m = frames.length;
                    avatarPacks = [];
                    frames = [];
                    ROLES.forEach(([r]) => { if (draft[r]) draft[r].layers = []; });
                    selL = null;
                    Object.values(config.entries || {}).forEach((e) => { const ee = normEntry(e); ee.layers = []; });
                    persist(); apply();
                    disarm(); refreshAll(); paintEntry();
                    ctx.ui.toast(`已清空头像库：${n} 个包、${m} 张素材`);
                });

                const uploadBtn = el("button", BTN + ";padding:5px 8px;font-size:12px;line-height:1.2", "＋添加图片");
                const urlBtn2 = el("button", BTN + ";padding:5px 8px;font-size:12px;line-height:1.2", "链接导入");
                /** 存一张头像素材并加成图层 */
                function addFrameAsset(name, src) {
                    let f = frames.find((x) => x.src === src);
                    if (!f) {
                        f = { id: `f_${Date.now().toString(36)}_${frames.length}`, name: name || "素材", src };
                        frames.push(f);
                    }
                    const uid = newFUid();
                    syncAll();
                    targets().forEach((r) => {
                        draft[r].layers.unshift({ uid, id: f.id, ...DEFAULT_PARAMS, back: false });
                    });
                    selL = uid;
                    persist(); refreshAll();
                }
                urlBtn2.addEventListener("click", async () => {
                    const u = ((await askText("链接导入", "https://…/xxx.png", "",
                        "支持 http/https 图片链接。会先下载存到本地，下载不成功就直接用链接。")) || "").trim();
                    if (!u) return;
                    if (!/^(https?:|data:image\/)/i.test(u)) { ctx.ui.toast("只支持 http/https 图片链接"); return; }
                    let src = u, name = "链接素材";
                    try { name = decodeURIComponent((u.split("?")[0].split("/").pop() || "")).replace(/\.[^.]+$/, "") || name; }
                    catch { /* 名字取不到就用默认 */ }
                    if (!/^data:/i.test(u)) {
                        ctx.ui.toast("正在下载…");
                        try {
                            const r = await fetch(u, { mode: "cors" });
                            if (!r.ok) throw new Error("HTTP " + r.status);
                            const blob = await r.blob();
                            if (!/^image\//.test(blob.type)) throw new Error("不是图片");
                            src = await new Promise((res, rej) => {
                                const rd = new FileReader();
                                rd.onload = () => res(rd.result); rd.onerror = rej;
                                rd.readAsDataURL(blob);
                            });
                        } catch (e) {
                            ctx.system.log("头像链接下载失败，改为直接引用", u, e);
                            const okImg = await new Promise((r2) => {
                                const im = new Image();
                                im.onload = () => r2(true); im.onerror = () => r2(false);
                                im.src = u;
                            });
                            if (!okImg) { ctx.ui.toast("这个链接打不开，换一个试试"); return; }
                            ctx.ui.toast("跨域拿不到文件，已改为直接引用链接");
                        }
                    }
                    addFrameAsset(name, src);
                    ctx.ui.toast("已加为一层");
                });
                const fileInput = el("input", "display:none");
                fileInput.type = "file"; fileInput.accept = "image/*"; fileInput.multiple = true;
                uploadBtn.addEventListener("click", () => fileInput.click());
                fileInput.addEventListener("change", async () => {
                    const files = Array.from(fileInput.files || []);
                    fileInput.value = "";
                    if (!files.length) return;
                    const t = ctx.ui.toast(`导入中… 共 ${files.length} 个`, { durationMs: 0 });
                    let added = 0;
                    for (const f of files) {
                        try {
                            frames.push({
                                id: `f_${Date.now().toString(36)}_${added}_${frames.length}`,
                                name: f.name.replace(/\.[^.]+$/, ""),
                                src: await readFileAsDataURL(f),
                            });
                            added++;
                        } catch (e) { ctx.system.log("上传失败", f.name, e); }
                    }
                    t.close();
                    if (added) {
                        // 新传的图直接加成图层
                        syncAll();
                        frames.slice(-added).forEach((f) => {
                            const uid = newFUid();
                            targets().forEach((r) => {
                                draft[r].layers.unshift({ uid, id: f.id, ...DEFAULT_PARAMS, back: false });
                            });
                            selL = uid;
                        });
                        persist(); refreshAll(); ctx.ui.toast(`已加 ${added} 层`);
                    }
                });
                // ── 头像包导入/导出（一个包 = 一整套图层，和气泡包一个概念）──
                const packIn = el("input", "display:none");
                packIn.type = "file"; packIn.accept = ".json,application/json,image/*"; packIn.multiple = true;
                const packImp = iconBtn(BTN, "upload"); packImp.title = "导入头像包或图片";
                packImp.addEventListener("click", () => packIn.click());
                packIn.addEventListener("change", async () => {
                    const files = Array.from(packIn.files || []); packIn.value = "";
                    let ok = 0;
                    for (const f of files) {
                        try {
                            let pkg;
                            if (/^image\//.test(f.type)) {
                                // 单张图也算一个包：一层，盖在头像前面
                                pkg = { name: f.name.replace(/\.[^.]+$/, ""), images: [await readFileAsDataURL(f)],
                                        assistant: { layers: [{ img: 0, ...DEFAULT_PARAMS, back: false }] } };
                            } else {
                                pkg = JSON.parse(await f.text());
                            }
                            if (!pkg || !Array.isArray(pkg.images)) throw new Error("不是头像包");
                            if (pkg.format === "float-bubble/1") throw new Error("这是气泡包，请到气泡库导入");
                            const ids = pkg.images.map((src, i) => {
                                const dup = frames.find((x) => x.src === src);
                                if (dup) return dup.id;
                                const id = `f_${Date.now().toString(36)}_${ok}_${i}_${frames.length}`;
                                frames.push({ id, name: `${pkg.name || "头像"}-${i + 1}`, src });
                                return id;
                            });
                            const sides = {};
                            ROLES.forEach(([r]) => {
                                const sd = pkg[r] || pkg.assistant || {};
                                sides[r] = (sd.layers || []).filter((L) => ids[L.img] != null).map((L) => ({
                                    uid: newFUid(), id: ids[L.img],
                                    scale: L.scale == null ? DEFAULT_PARAMS.scale : L.scale,
                                    dx: L.dx || 0, dy: L.dy || 0, back: !!L.back,
                                }));
                            });
                            const name = pkg.name || f.name.replace(/\.json$/i, "");
                            const old = avatarPacks.find((x) => x.name === name);
                            const pk = { id: old ? old.id : `ap_${Date.now().toString(36)}_${avatarPacks.length}`, name, sides,
                                         g: pkg.g && typeof pkg.g === "object" ? { scale: 1, dx: 0, dy: 0, ...pkg.g } : { scale: 1, dx: 0, dy: 0 },
                                         av: pkg.av && typeof pkg.av === "object" ? { scale: 1, ...pkg.av } : { scale: 1 } };
                            if (old) Object.assign(old, pk); else avatarPacks.push(pk);
                            ok++;
                        } catch (e) { ctx.system.log("头像包导入失败", f.name, e); }
                    }
                    if (ok) { persist(); refreshAll(); ctx.ui.toast(`已导入 ${ok} 个头像包`); }
                    else ctx.ui.toast("没有可导入的头像包");
                });
                const packExp = iconBtn(BTN, "download"); packExp.title = "导出当前头像框";
                packExp.addEventListener("click", () => {
                    const used = [];
                    const idx = (id) => {
                        let i = used.indexOf(id);
                        if (i < 0) { used.push(id); i = used.length - 1; }
                        return i;
                    };
                    const side = (r) => ({
                        layers: (draft[r] ? draft[r].layers : []).filter((L) => frameById(L.id)).map((L) => ({
                            img: idx(L.id), scale: L.scale, dx: L.dx, dy: L.dy, ...(L.back ? { back: true } : {}),
                        })),
                    });
                    const pkg = { format: "float-avatar/1",
                        name: (scopeSel.options[scopeSel.selectedIndex] || {}).textContent || "头像",
                        g: { ...(draft.assistant && draft.assistant.g ? draft.assistant.g : { scale: 1, dx: 0, dy: 0 }) },
                        av: { ...(draft.assistant && draft.assistant.av ? draft.assistant.av : { scale: 1 }) },
                        assistant: side("assistant"), user: side("user"),
                        images: used.map((id) => (frameById(id) || {}).src).filter(Boolean) };
                    if (!pkg.images.length) { ctx.ui.toast("当前没有图层可导出"); return; }
                    try {
                        const blob = new Blob([JSON.stringify(pkg)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a2 = document.createElement("a");
                        a2.href = url; a2.download = `${pkg.name}.json`;
                        document.body.appendChild(a2); a2.click(); a2.remove();
                        ctx.system.timers.setTimeout(() => URL.revokeObjectURL(url), 4000);
                        ctx.ui.toast("已导出头像包");
                    } catch (e) { ctx.ui.toast("导出失败"); ctx.system.log("导出失败", e); }
                });
                libBar.style.flexWrap = "wrap";
                const secAv = el("span", `font-size:13px;font-weight:700;color:${T.ink}`, "头像库");
                secAv.className = "avfp-sec";
                const avSearch = el("input",
                    `flex:1;min-width:90px;font-size:12px;padding:5px 9px;border-radius:9px;border:1px solid ${T.line};`
                    + `background:${T.card};color:${T.ink}`);
                avSearch.type = "search"; avSearch.placeholder = "搜头像包…";
                avSearch.addEventListener("input", () => paintLibrary());
                // 和气泡库一样：第二行 搜索框 + 紧跟其后的「搜索」按钮
                const avSearchRow = el("div", "flex-basis:100%;display:flex;gap:6px;align-items:center");
                const avSearchB = el("button", BTN + ";padding:5px 8px;font-size:12px;line-height:1.2;flex:0 0 auto", "搜索");
                avSearchB.addEventListener("click", () => { paintLibrary(); avSearch.blur(); });
                avSearchRow.append(avSearch, avSearchB);
                // 「不使用」：当前作用范围 + 设置对象 不套头像框（立刻生效）
                // 「＋」新建：当前对象清成空白，并让图层区出来从零搭
                let avNewMode = false;
                const plusA = iconBtn(BTN, "plus"); plusA.title = "新建一个空白头像包";
                plusA.addEventListener("click", () => {
                    // 库里立刻多一张空白卡片并选中它；之后加的图层在「使用这个设置」时存进这张卡片
                    const pk = { id: `ap_${Date.now().toString(36)}_${avatarPacks.length}`, name: `新头像框 ${avatarPacks.length + 1}`,
                                 sides: { assistant: [], user: [] }, g: { scale: 1, dx: 0, dy: 0 }, av: { scale: 1 }, fresh: true };
                    avatarPacks.push(pk); pickedId = pk.id;
                    targets().forEach((r) => {
                        draft[r] = { layers: [], g: { scale: 1, dx: 0, dy: 0, alpha: 1 }, av: { scale: 1 } };
                    });
                    selL = AV; avNewMode = true;
                    persist(); refreshAll();
                    try { avLayerHead.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
                    ctx.ui.toast(`已新建「${pk.name}」，加图层后点「使用这个设置」存入`);
                });
                const noUseA = iconBtn(BTN, "ban");
                noUseA.title = "这个范围/对象不用头像框";
                noUseA.addEventListener("click", () => {
                    targets().forEach((r) => {
                        draft[r].layers = [];
                        draft[r].g = { scale: 1, dx: 0, dy: 0, alpha: 1 };
                        draft[r].av = { scale: 1 };
                    });
                    selL = AV;
                    commit(curScope); refreshAll();
                    ctx.ui.toast("已取消头像框");
                });
                libBar.append(secAv, libCount, plusA, noUseA, packImp, packExp, renPk, delPk, wipeBtn, packIn, avSearchRow);
                // 上传/链接导入属于「加图层」，挪到图层那一行去
                fileInput.style.display = "none";

                // 头像包网格本身不再单独滚动：整页（预览卡以下）一起滚，和气泡框页一样
                const scroller = el("div", "padding:0 16px 12px");
                const grid = el("div", "display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px");

                scroller.append(grid);

                function paintLibrary() {
                    grid.innerHTML = "";
                    const q = (avSearch.value || "").trim().toLowerCase();
                    const list = q ? avatarPacks.filter((x) => (x.name || "").toLowerCase().includes(q)) : avatarPacks;
                    libCount.textContent = q ? `${list.length}/${avatarPacks.length}` : `${avatarPacks.length}`;
                    if (!avatarPacks.length) {
                        grid.append(el("div", `grid-column:1/-1;font-size:11px;color:${T.sub};padding:6px 0`,
                            "还没有头像包。用上面的「＋添加图片」搭一套，再点「导出当前」存成包；或点「导入头像包」。"));
                        return;
                    }
                    if (!list.length) {
                        grid.append(el("div", `grid-column:1/-1;font-size:11px;color:${T.sub};padding:6px 0`,
                            `没有名字含「${avSearch.value.trim()}」的头像包`));
                        return;
                    }
                    // 当前这套图层和哪个包一致，就把那个包标成选中
                    const sig = (ls) => JSON.stringify((ls || []).map((L) => [L.id, L.scale, L.dx, L.dy, !!L.back]));
                    const nowSig = sig(curLayers());
                    pickedPack = (pickedId && avatarPacks.find((pk) => pk.id === pickedId))
                        || (curLayers().length ? (avatarPacks.find((pk) => sig(pk.sides.assistant) === nowSig) || null) : null);
                    renPk.style.display = delPk.style.display = pickedPack ? "" : "none";
                    list.forEach((pk) => {
                        const cell = el("div",
                            "position:relative;border-radius:12px;padding:7px 5px 5px;cursor:pointer;"
                            + `background:${T.card};display:flex;flex-direction:column;gap:4px;`
                            + `align-items:center;box-shadow:${T.shadow}`);
                        cell.className = "avfp-cell";
                        const picked = pk === pickedPack;
                        cell.style.border = picked ? `2px solid ${T.yellowDeep}` : `1px solid ${T.line}`;
                        if (picked) cell.style.boxShadow = "0 0 0 3px rgba(245,215,110,.45)";
                        // 缩略图：把这个包的图层原样叠出来
                        const th = el("div", "position:relative;width:100%;aspect-ratio:1");
                        const pairs = (pk.sides.assistant || []).map((L) => ({ L, f: frameById(L.id) })).filter((x) => x.f);
                        pairs.slice().reverse().forEach((x) => {
                            const im = el("img",
                                "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);"
                                + `width:${Math.round(60 * (x.L.scale || 1) / DEFAULT_PARAMS.scale)}%;object-fit:contain`);
                            im.src = x.f.src; th.append(im);
                        });
                        cell.append(th, el("div",
                            `font-size:10px;color:${T.sub};max-width:100%;overflow:hidden;`
                            + "text-overflow:ellipsis;white-space:nowrap", pk.name));
                        cell.addEventListener("click", () => {
                            avNewMode = false; pickedId = pk.id;
                            // 整套套用：两侧各按包里的那一份
                            // 只套到当前「设置对象」：选了对方就只改对方，双方才两侧一起
                            targets().forEach((r) => {
                                const src = pk.sides[r] || pk.sides.assistant || [];
                                draft[r].layers = src.map((L) => ({ ...L, uid: newFUid() }));
                                draft[r].g = { scale: 1, dx: 0, dy: 0, ...(pk.g || {}) };
                                draft[r].av = { scale: 1, ...(pk.av || {}) };
                            });
                            const ls = draft[targets()[0]].layers;
                            selL = ls.length ? ls[0].uid : AV;
                            refreshAll();
                        });
                        grid.append(cell);
                    });
                }

                // ── 底部 ──
                const footer = el("div",
                    "display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:stretch;padding:10px 16px 14px;flex:0 0 auto;"
                    + "border-top:1px solid var(--c-card-border,#e0e0e0)");   // 左侧让开宿主悬浮按钮
                const applyAllBtn = el("button", BTN + ";padding:9px 10px;font-size:12px;white-space:nowrap;flex:0 0 auto", "应用到所有");
                let applyAllArmedA = null;
                applyAllBtn.addEventListener("click", () => {
                    // 两段式确认：会清掉所有聊天的单独头像框设置
                    if (!applyAllArmedA) {
                        applyAllBtn.textContent = "确认覆盖？";
                        applyAllBtn.title = "会把当前设置变成全局默认，并清掉每个聊天的单独设置";
                        applyAllArmedA = setTimeout(() => { applyAllArmedA = null; applyAllBtn.textContent = "应用到所有"; }, 4000);
                        return;
                    }
                    clearTimeout(applyAllArmedA); applyAllArmedA = null; applyAllBtn.textContent = "应用到所有";
                    ROLES.forEach(([role]) => {
                        Object.keys(config.entries).forEach((k) => {
                            if (k.endsWith(":" + role) && !k.startsWith(GLOBAL + ":")) delete config.entries[k];
                        });
                    });
                    commit(GLOBAL);
                    curScope = GLOBAL; scopeSel.value = GLOBAL;
                    loadDraft(); refreshAll();
                    ctx.ui.toast("已应用到所有聊天");
                });
                const useBtn = el("button", BTN_MAIN);
                useBtn.addEventListener("click", () => {
                    commit(curScope); refreshAll();
                    ctx.ui.toast(curScope === GLOBAL ? "已应用到全部聊天" : "已应用到本聊天");
                });
                const offBtn = el("button", BTN + ";padding:9px 10px;font-size:12px", "停用");
                offBtn.addEventListener("click", () => {
                    config.enabled = false;
                    persist(); apply(); refreshAll(); paintEntry();
                    ctx.ui.toast("头像框已停用");
                });
                footer.append(applyAllBtn, useBtn, offBtn);   // 应用到所有聊天放底栏，和启用/停用一起

                /** 把该会话快照里的主题变量灌到预览容器上，让气泡颜色与真实聊天室一致 */
                function applyTheme() {
                    THEME_VARS.forEach((v) => previewCard.style.removeProperty(v));
                    if (chat.theme) {
                        Object.entries(chat.theme).forEach(([k, v]) => previewCard.style.setProperty(k, v));
                    }
                    // 预览卡里不放任何说明文字（用户要求）
                    themeNote.textContent = "";
                    themeNote.style.display = "none";
                }

                function paintPreview() {
                    [["assistant", A, rowA], ["user", U, rowU]].forEach(([role, S, row]) => {
                        const ent = shownEntry(role);   // 编辑侧 = 草稿；另一侧 = 已生效
                        const pairs = (ent.layers || [])
                            .map((L) => ({ L, f: frameById(L.id) })).filter((x) => x.f);
                        S.front.style.opacity = S.back.style.opacity = String(ent.g && ent.g.alpha != null ? ent.g.alpha : 1);
                        // 头像本体缩放：整个圆一起变大，和真实聊天室同一套
                        const avs = avScale(ent);
                        S.img.style.transform = Math.abs(avs - 1) > 0.005 ? `scale(${avs.toFixed(2)})` : "";
                        [[S.front, pairs.filter((x) => !x.L.back)], [S.back, pairs.filter((x) => x.L.back)]]
                            .forEach(([box, list]) => {
                                box.style.backgroundImage = list.length
                                    ? list.map((x) => `url("${x.f.src}")`).join(", ") : "none";
                                const g = ent.g;
                                box.style.backgroundSize = list.map((x) => `${(AVATAR_BOX * effL(x.L, g).scale).toFixed(1)}px auto`).join(", ");
                                box.style.backgroundPosition = list.map((x) => { const e2 = effL(x.L, g);
                                    return `calc(50% + ${Math.round(e2.dx)}px) calc(50% + ${Math.round(e2.dy)}px)`; }).join(", ");
                                box.style.backgroundRepeat = list.map(() => "no-repeat").join(", ");
                            });
                        row.style.background = "transparent";
                    });
                    const n = curLayers().length;
                    readout.textContent = n ? "拖动头像可调选中那一层" : "不套框：点「＋添加图片」加一层";
                }

                function paintRoles() {
                    roleBtns.forEach(([v, b]) => {
                        b.className = curRole === v ? "chat-list-tab active" : "chat-list-tab";
                    });
                    const isGlobal = curScope === GLOBAL;
                    clearBtn.style.display = isGlobal ? "none" : "";
                    // 状态小字不再显示：它把下拉框挤成只剩一个箭头；「跟随全局」按钮本身就说明了状态
                    inheritTag.textContent = "";
                    inheritTag.style.display = "none";
                }

                function paintActions() {
                    const dirty = isDirty();
                    useBtn.textContent = config.enabled
                        ? (dirty ? "使用这个设置" : "当前已生效")
                        : "启用头像框";
                    useBtn.disabled = !dirty;
                    // 手账风：有改动 = 鹅黄贴纸；无改动 = 灰纸（可点但不突出）
                    useBtn.style.background = dirty ? `linear-gradient(180deg,#FBE38E,${T.yellow})` : T.card;
                    useBtn.style.color = dirty ? T.ink : T.sub;
                    useBtn.style.borderColor = dirty ? T.yellowDeep : T.line;
                    useBtn.style.boxShadow = dirty ? "0 3px 0 rgba(201,168,135,.35),0 6px 14px rgba(91,70,54,.15)" : T.shadow;
                    useBtn.style.cursor = dirty ? "pointer" : "default";
                    offBtn.style.display = config.enabled ? "" : "none";
                    dirtyTag.textContent = (config.enabled && dirty) ? "· 预览中，未应用" : "";
                }

                function refreshAll() { applyTheme(); paintRoles(); paintAvLayers(); paintLibrary(); syncInputs(); paintPreview(); paintActions(); }

                // ── 顶部 tab：头像框 / 气泡框 ──────────────────────
                // 两块功能共用同一个浮层壳（背景、尺寸、滚动区约束），
                // 只切换中间那一坨，避免开两个弹窗来回跳。
                const avatarView = el("div", "display:flex;flex-direction:column;flex:1 1 auto;min-height:0");
                // 图层区的清空只清图层，不动素材和库
                const clearLayersBtn = el("button", BTN_DANGER + ";padding:5px 8px;font-size:12px;line-height:1.2", "清空图层");
                clearLayersBtn.addEventListener("click", () => {
                    syncAll();
                    targets().forEach((r) => { draft[r].layers = []; });
                    selL = null; refreshAll();
                });
                avLayerHead.append(secAvL, clearLayersBtn, uploadBtn, urlBtn2);
                // 和气泡框页同构：作用范围固定，预览卡吸顶，其余全部在同一个滚动区里
                const scrollAllA = el("div",
                    "flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;overflow-anchor:none");
                // 图层 / 头像库 都能点标题折叠（默认展开），和气泡框页一样
                const avLayersFold = collapsible(avLayerHead, secAvL, [avLayerBox, sliderBox], true);
                collapsible(libBar, secAv, [scroller], true);
                scrollAllA.append(previewCard, gCap, gRow, avLayerHead, avLayerBox, sliderBox, libBar, scroller);
                avatarView.append(scopeRow, roleRow, scrollAllA, footer);

                const bubbleView = el("div", "display:flex;flex-direction:column;flex:1 1 auto;min-height:0");
                bubbleView.style.display = "none";
                const inputView = el("div", "display:flex;flex-direction:column;flex:1 1 auto;min-height:0");
                inputView.style.display = "none";

                // tab 行：左边一条可横向滑动的页签带，右边固定一个 ✕
                const tabBar = el("div",
                    "display:flex;gap:8px;align-items:center;padding:12px 16px 10px;flex:0 0 auto");
                const tabStrip = el("div",
                    "display:flex;gap:8px;align-items:center;flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;"
                    + "touch-action:pan-x;scrollbar-width:none;-webkit-overflow-scrolling:touch");
                tabStrip.className = "avfp-tabstrip";
                const tabs = [];
                // 顶栏/挂件/背景还没做，先占位（页面里只写一句「开发中」）
                const wipView = el("div", "display:flex;flex-direction:column;flex:1 1 auto;min-height:0;align-items:center;justify-content:center");
                wipView.style.display = "none";
                const wipText = el("div", `font-size:13px;color:${T.sub};padding:40px 16px;text-align:center`, "开发中…");
                wipView.append(wipText);
                const TAB_DEFS = [["avatar", "头像框"], ["bubble", "气泡"], ["input", "底栏", true],
                                  ["top", "顶栏", true], ["widget", "挂件", true], ["bg", "背景", true]];
                TAB_DEFS.forEach(([k, label]) => {
                    const b = el("button", "white-space:nowrap;flex:0 0 auto", label);
                    b.className = "chat-list-tab";      // 复用宿主分段控件样式
                    b.addEventListener("click", () => { curTab = k; paintTabs(); });
                    tabs.push([k, b]); tabStrip.append(b);
                });
                let curTab = "avatar";
                function paintTabs() {
                    tabs.forEach(([k, b]) => { b.className = curTab === k ? "chat-list-tab active" : "chat-list-tab"; });
                    avatarView.style.display = curTab === "avatar" ? "flex" : "none";
                    bubbleView.style.display = curTab === "bubble" ? "flex" : "none";
                    inputView.style.display = "none";   // 底栏先按「开发中」占位，原页面暂不展示
                    const wip = TAB_DEFS.find(([k]) => k === curTab);
                    wipView.style.display = wip && wip[2] ? "flex" : "none";
                    if (wip && wip[2]) wipText.textContent = `「${wip[1]}」开发中…`;
                    if (curTab === "bubble") bubbleRefresh();
                    if (curTab === "input") inputRefresh();
                    // 选中的页签滚到可见位置
                    const cur = tabs.find(([k]) => k === curTab);
                    if (cur && cur[1].scrollIntoView) { try { cur[1].scrollIntoView({ block: "nearest", inline: "nearest" }); } catch { /* ignore */ } }
                }

                closeBtn.style.marginLeft = "0"; closeBtn.style.flex = "0 0 auto";
                tabBar.append(tabStrip, closeBtn);   // 「预览中，未应用」提示不再显示（主按钮文案已经说明状态）
                host.append(tabBar, avatarView, bubbleView, inputView, wipView);
                const bubbleRefresh = buildBubbleView(bubbleView, api);
                const inputRefresh = buildInputView(inputView, api);
                paintTabs();
                loadDraft(); refreshAll();
            });
        }

        // ── 管理页入口：只占一行 ────────────────────────────
        const disposeSlot = ctx.ui.slot("settings.section", (host) => {
            host.innerHTML = "";
            const row = el("button",
                "width:100%;display:flex;align-items:center;gap:12px;padding:10px 2px;background:transparent;"
                + "border:none;cursor:pointer;text-align:left");
            const thumb = el("div",
                "width:36px;height:36px;border-radius:10px;flex:0 0 auto;background-size:contain;"
                + "background-repeat:no-repeat;background-position:center;border:1px solid var(--c-card-border,#e0e0e0)");
            const labels = el("div", "display:flex;flex-direction:column;gap:2px;flex:1;min-width:0");
            const line1 = el("div", "font-size:13px;font-weight:600;color:var(--c-text-title,#2c3440)", "打开聊天页面美化管理器");
            const line2 = el("div", "font-size:11px;color:var(--c-text,#797e85)");
            labels.append(line1, line2);
            row.append(thumb, labels, el("div", "font-size:16px;color:var(--c-icon,#a0a3a8);flex:0 0 auto", "›"));
            row.addEventListener("click", openPanel);
            host.append(row);

            paintEntry = () => {
                const e = resolveEntry(GLOBAL, "assistant") || resolveEntry(GLOBAL, "user");
                const f = e && frameById(e.frameId);
                thumb.style.backgroundImage = f ? `url("${f.src}")` : "none";
                const perSession = new Set(
                    Object.keys(config.entries).filter((k) => !k.startsWith(GLOBAL + ":")).map((k) => k.slice(0, k.lastIndexOf(":")))
                ).size;
                line2.textContent = (config.enabled ? "生效中" : "未启用")
                    + ` · ${allFrames().length} 个素材`
                    + (perSession ? ` · ${perSession} 个聊天单独设置` : "");
            };
            paintEntry();
            return () => { paintEntry = () => { }; };
        });

        // ── 启动 ────────────────────────────────────────────
        apply();
        captureChatSnapshot();
        // 进聊天室 / 有新消息时顺手记住两侧真实头像，供设置页预览还原真实观感
        const offOpened = ctx.hooks.on("session.opened", () => {
            // 主题/自定义 CSS 可能比消息晚挂上，多抓两次，取最后一次
            [600, 2500].forEach((ms) => ctx.system.timers.setTimeout(captureChatSnapshot, ms));
        });
        const offPersisted = ctx.hooks.on("message.persisted", () => captureChatSnapshot());

        return () => {
            offOpened(); offPersisted();
            disposeSlot();
            if (disposeCSS) { disposeCSS(); disposeCSS = null; }
            document.documentElement.removeAttribute("data-avframe");
        };
    },
};
