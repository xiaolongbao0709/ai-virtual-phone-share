/* Float Ins skin v0.9.11: paired CSS automatically activates online chat. */
/* BEGIN EMBEDDED INS CSS */
const bundledInsCss = "/* Ins chat skin v0.14.6 — paste into one Float conversation's Custom CSS. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"]{}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online.chat-room-wrapper{color-scheme:light!important;--im26-page:#fff;--im26-ink:#17191f;--im26-incoming:#f1f3f8;--im26-secondary:#737c89;--im26-tertiary:#aab0bc;--im26-glass:rgba(250,251,255,.72);--im26-glass-edge:rgba(255,255,255,.9);--c-page-body-bg:#fff;--c-text-title:#17191f;--c-text:#737c89;--c-icon:#737c89;background-color:#fff!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online{--ins-purple:#7939f7;--ins-purple-soft:#efe9ff;--ins-gray:#f1f3f8;--ins-ink:#17191f;--ins-muted:#737c89;--ins-radius:22px;--ins-paypal-mark:url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMzAyIiBhcmlhLWhpZGRlbj0idHJ1ZSI+CiAgPHBhdGggZmlsbD0iIzI3MzQ2YSIgZD0iTTIxNy4xNjggMjMuNTA3QzIwMy4yMzQgNy42MjUgMTc4LjA0Ni44MTYgMTQ1LjgyMy44MTZoLTkzLjUyQTEzLjM5IDEzLjM5IDAgMCAwIDM5LjA3NiAxMi4xMUwuMTM2IDI1OS4wNzdjLS43NzQgNC44NyAyLjk5NyA5LjI4IDcuOTMzIDkuMjhoNTcuNzM2bDE0LjUtOTEuOTcxbC0uNDUgMi44OGMxLjAzMy02LjUwMSA2LjU5My0xMS4yOTYgMTMuMTc3LTExLjI5NmgyNy40MzZjNTMuODk4IDAgOTYuMTAxLTIxLjg5MiAxMDguNDI5LTg1LjIyMWMuMzY2LTEuODczLjY4My0zLjY5Ni45NTctNS40NzdxLTIuMzM0LTEuMjM2IDAgMGMzLjY3MS0yMy40MDctLjAyNS0zOS4zNC0xMi42ODYtNTMuNzY1Ii8+CiAgPHBhdGggZmlsbD0iIzI3MzQ2YSIgZD0iTTEwMi4zOTcgNjguODRhMTEuNyAxMS43IDAgMCAxIDUuMDUzLTEuMTRoNzMuMzE4YzguNjgyIDAgMTYuNzguNTY1IDI0LjE4IDEuNzU2YTEwMiAxMDIgMCAwIDEgNi4xNzcgMS4xODJhOTAgOTAgMCAwIDEgOC41OSAyLjM0N2MzLjYzOCAxLjIxNSA3LjAyNiAyLjYzIDEwLjE0IDQuMjg3YzMuNjctMjMuNDE2LS4wMjYtMzkuMzQtMTIuNjg3LTUzLjc2NUMyMDMuMjI2IDcuNjI1IDE3OC4wNDYuODE2IDE0NS44MjMuODE2SDUyLjI5NUM0NS43MS44MTYgNDAuMTA4IDUuNjEgMzkuMDc2IDEyLjExTC4xMzYgMjU5LjA2OGMtLjc3NCA0Ljg3OCAyLjk5NyA5LjI4MiA3LjkyNSA5LjI4Mmg1Ny43NDRMOTUuODg4IDc3LjU4YTExLjcyIDExLjcyIDAgMCAxIDYuNTA5LTguNzQiLz4KICA8cGF0aCBmaWxsPSIjMjc5MGMzIiBkPSJNMjI4Ljg5NyA4Mi43NDljLTEyLjMyOCA2My4zMi01NC41MyA4NS4yMjEtMTA4LjQyOSA4NS4yMjFIOTMuMDI0Yy02LjU4NCAwLTEyLjE0NSA0Ljc5NS0xMy4xNjggMTEuMjk2TDYxLjgxNyAyOTMuNjIxYy0uNjc0IDQuMjYyIDIuNjIyIDguMTI0IDYuOTM0IDguMTI0aDQ4LjY3YTExLjcxIDExLjcxIDAgMCAwIDExLjU2My05Ljg4bC40NzQtMi40OGw5LjE3My01OC4xMzZsLjU5MS0zLjIxM2ExMS43MSAxMS43MSAwIDAgMSAxMS41NjItOS44OGg3LjI4NGM0Ny4xNDcgMCA4NC4wNjQtMTkuMTU0IDk0Ljg1Mi03NC41NWM0LjUwMy0yMy4xNSAyLjE3My00Mi40NzgtOS43MzktNTYuMDU0Yy0zLjYxMy00LjExMi04LjEtNy41MDgtMTMuMzI3LTEwLjI4Yy0uMjgzIDEuNzktLjU5IDMuNjA0LS45NTcgNS40NzciLz4KICA8cGF0aCBmaWxsPSIjMWYyNjRmIiBkPSJNMjE2Ljk1MiA3Mi4xMjhhOTAgOTAgMCAwIDAtNS44MTgtMS40OWExMTAgMTEwIDAgMCAwLTYuMTc3LTEuMTc0Yy03LjQwOC0xLjE5OS0xNS41LTEuNzY1LTI0LjE5LTEuNzY1aC03My4zMDlhMTEuNiAxMS42IDAgMCAwLTUuMDUzIDEuMTQ5YTExLjY4IDExLjY4IDAgMCAwLTYuNTEgOC43NGwtMTUuNTgyIDk4Ljc5OGwtLjQ1IDIuODhjMS4wMjUtNi41MDEgNi41ODUtMTEuMjk2IDEzLjE3LTExLjI5NmgyNy40NDRjNTMuODk4IDAgOTYuMS0yMS44OTIgMTA4LjQyOC04NS4yMjFjLjM2Ny0xLjg3My42NzUtMy42ODguOTU4LTUuNDc3cS00LjY4Mi0yLjQ3LTEwLjE0LTQuMjc5YTgzIDgzIDAgMCAwLTIuNzctLjg2NSIvPgo8L3N2Zz4K\");--ins-red-coin:url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgYXJpYS1oaWRkZW49InRydWUiPgogIDxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjE2IiBmaWxsPSIjRjFCMzJCIi8+CiAgPHBhdGggZmlsbD0iI0ZGRiIgZD0iTTE1Ljc1IDRDOS4yNiA0IDQgOS4yNiA0IDE1Ljc1UzkuMjYgMjcuNSAxNS43NSAyNy41UzI3LjUgMjIuMjQgMjcuNSAxNS43NUExMS43NSAxMS43NSAwIDAgMCAxNS43NSA0bTAgMjAuNTdhOC44MiA4LjgyIDAgMSAxIDAtMTcuNjRhOC44MiA4LjgyIDAgMCAxIDAgMTcuNjRtLTIuOTMtOC44MWwyLjk0IDQuNGwyLjkyLTQuNGwtMi45Mi00LjQxeiIvPgo8L3N2Zz4K\")}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body{padding:14px 12px 95px!important;gap:14px!important;-webkit-mask-image:none!important;mask-image:none!important}\n\n/* Individual header controls float over the conversation. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header{position:relative;isolation:isolate;background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header-content{position:relative;z-index:1;min-height:62px;display:flex;align-items:center;gap:8px;padding:0 12px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header .page-back-btn,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-action{width:40px;height:40px;flex:0 0 40px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid rgba(255,255,255,.72);border-radius:50%;color:var(--ins-ink);background:rgba(255,255,255,.56);box-shadow:0 2px 10px rgba(20,28,46,.08),inset 0 1px rgba(255,255,255,.46);backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header .page-back-btn svg{width:21px;height:21px;stroke-width:2.2}\r\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-action[aria-label=\"语音通话\"] svg{width:22px;height:22px;stroke:currentColor;stroke-width:.35}\r\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-action[aria-label=\"视频通话\"] svg{width:25px;height:25px;stroke:currentColor;stroke-width:.25}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-title{display:flex;align-items:center;justify-content:flex-start;gap:7px;min-width:0;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:left!important;color:var(--ins-ink);font-size:17px;font-weight:700}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-avatar{width:32px;height:32px;flex:0 0 32px;border-radius:50%;object-fit:cover}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header-right,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-controls{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header-right>button[aria-label=\"更多\"] svg{width:27px;height:27px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-typing-indicator{display:none!important}\n\n/* Timestamp separators use plain muted text. */\r\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body .flex.justify-center.w-full>.chat-sys-msg{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:#9399a3!important;box-shadow:none!important;font-size:11px!important;font-weight:400}\r\n\r\n/* Text capsules. Media cards retain their own structure. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bubble-role-user:not(.chat-bubble-media),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bubble-role-assistant:not(.chat-bubble-media){padding:9px 14px;border-radius:var(--ins-radius);box-shadow:none;font-size:calc(15px*var(--app-text-scale,1));line-height:1.42}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bubble-role-user:not(.chat-bubble-media){color:#fff;background:var(--ins-user-bubble-color,var(--ins-purple))}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bubble-role-assistant:not(.chat-bubble-media){color:var(--ins-ink);background:var(--ins-gray)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"user\"]>.chat-msg-avatar{visibility:hidden;width:0!important;min-width:0!important;flex-basis:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"assistant\"][data-ins-text-pos=\"middle\"]>.chat-msg-avatar,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"assistant\"][data-ins-text-pos=\"last\"]>.chat-msg-avatar{visibility:hidden}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-consecutive] .chat-group-sender-name{display:none!important}\n\n/* Only adjacent plain text is grouped; timestamps and media break the run. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-text-pos=\"middle\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-text-pos=\"last\"]{margin-top:-10px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-text-pos=\"middle\"]:has(.chat-msg-wrapper[data-role=\"user\"]),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-text-pos=\"last\"]:has(.chat-msg-wrapper[data-role=\"user\"]){margin-top:-10.7px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"first\"] .chat-bubble-role-user:not(.chat-bubble-media){border-bottom-right-radius:5px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"middle\"] .chat-bubble-role-user:not(.chat-bubble-media){border-top-right-radius:6px;border-bottom-right-radius:6px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"last\"] .chat-bubble-role-user:not(.chat-bubble-media){border-top-right-radius:5px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"first\"] .chat-bubble-role-assistant:not(.chat-bubble-media){border-bottom-left-radius:5px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"middle\"] .chat-bubble-role-assistant:not(.chat-bubble-media){border-top-left-radius:6px;border-bottom-left-radius:6px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ins-text-pos=\"last\"] .chat-bubble-role-assistant:not(.chat-bubble-media){border-top-left-radius:5px}\n\n/* The native generating state becomes a left-side three-dot typing bubble. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-row{display:flex;align-items:flex-end;gap:8px;min-height:39px;margin-top:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-avatar{display:flex;align-items:center;justify-content:center;width:27px;height:27px;flex:0 0 27px;border-radius:50%;overflow:hidden}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-avatar img{display:block;width:100%;height:100%;object-fit:cover;border-radius:50%}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-bubble{display:flex;align-items:center;justify-content:center;gap:4px;width:55px;height:36px;border-radius:20px;background:var(--ins-gray)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-bubble i{display:block;width:6px;height:6px;border-radius:50%;background:#87909e;animation:ins-typing-bounce 1.15s ease-in-out infinite}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-bubble i:nth-child(2){animation-delay:.15s}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-bubble i:nth-child(3){animation-delay:.3s}\n@keyframes ins-typing-bounce{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-5px);opacity:1}}\n@media(prefers-reduced-motion:reduce){.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-typing-bubble i{animation:none;opacity:.8}}\n\n/* Native translations stay in each capsule; one control follows a text run. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bilingual-content{gap:3px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bilingual-divider{display:none!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bilingual-section-translation{padding-top:2px!important;border:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-user\"] .chat-bilingual-section-translation{color:rgba(255,255,255,.76);font-style:normal}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-user\"]:has(.chat-bilingual-toggle),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"]:has(.chat-bilingual-toggle){overflow:visible;margin-bottom:21px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-bilingual-toggle{position:absolute;top:100%;right:0;width:max-content;min-height:28px;margin:2px 0 0;padding:2px 0;color:#246bfd!important;font-size:10.8px;font-weight:400;text-decoration:none;opacity:1}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"] .chat-bilingual-toggle{right:auto;left:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-text-bubble{position:relative;max-width:80%;margin-bottom:27px;border-radius:18px;background:#f7f8fc;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"user\"] .voice-msg-text-bubble{background:#efe7ff;color:#5430a7}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-text-bubble .chat-bilingual-toggle{top:100%;right:auto;left:0;margin-top:3px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-text-bubble .chat-bilingual-section-translation{color:#8992a0;font-style:normal}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"user\"] .voice-msg-text-bubble .chat-bilingual-section-translation{color:#8e70c5}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-translation-run] .chat-bilingual-toggle{display:none!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-translation-run] [data-ui=\"bubble-user\"]:has(.chat-bilingual-toggle),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-body>[data-ins-translation-run] [data-ui=\"bubble-bot\"]:has(.chat-bilingual-toggle){margin-bottom:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-run-translation{align-self:flex-start;width:max-content;min-height:28px;margin:3px 0 0;padding:2px 0;border:0;background:transparent;color:#246bfd;font-size:10.8px;font-weight:400;cursor:pointer}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-wrapper[data-role=\"user\"] .ins-run-translation{align-self:flex-end}\n\n/* A quote is label + source-colored copy + separate reply capsule. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-user\"]:has(.chat-quote-message),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"]:has(.chat-quote-message){padding:0!important;background:transparent!important;overflow:visible}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-message{display:flex;flex-direction:column;align-items:flex-end;gap:7px;min-width:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"] .chat-quote-message{align-items:flex-start}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-label{padding:0 4px;color:var(--ins-muted);font-size:10.8px;line-height:1.3}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-message .chat-quote-preview{position:relative;display:block;width:fit-content;max-width:min(calc(100% - 10px),300px);box-sizing:border-box;margin:0 10px 0 0;padding:9px 13px;border:0!important;border-radius:var(--ins-radius);overflow:visible;white-space:normal;overflow-wrap:anywhere;text-overflow:clip;background:#f5f6f9;color:#818895}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"] .chat-quote-preview{margin:0 0 0 10px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-message[data-ins-quote-source-role=\"user\"] .chat-quote-preview{background:var(--ins-purple-soft);color:#936cce}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-preview::after{content:\"\";position:absolute;top:0;right:-10px;width:3px;height:100%;border-radius:3px;background:#dfe2e9}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"] .chat-quote-preview::after{right:auto;left:-10px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-quote-message>:not(.chat-quote-label):not(.chat-quote-preview){display:block;width:fit-content;max-width:100%;padding:9px 14px;border-radius:var(--ins-radius);color:#fff;background:var(--ins-user-bubble-color,var(--ins-purple))}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"] .chat-quote-message>:not(.chat-quote-label):not(.chat-quote-preview){color:var(--ins-ink);background:var(--ins-gray)}\n\n/* Voice notes use the same mirrored palette as text, with a bare play glyph. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-user\"]:has(.voice-msg-bubble),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"]:has(.voice-msg-bubble){padding:9px 13px;border-radius:var(--ins-radius)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-user\"]:has(.voice-msg-bubble){color:#fff;background:var(--ins-user-bubble-color,var(--ins-purple))}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online [data-ui=\"bubble-bot\"]:has(.voice-msg-bubble){color:var(--ins-ink);background:var(--ins-gray)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-bubble{width:220px;max-width:100%;min-width:0!important;min-height:36px;gap:9px;padding:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-icon-shell{width:27px;height:32px;flex:0 0 27px;border-radius:0;background:transparent;box-shadow:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-icon{color:inherit}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-icon svg{width:27px;height:27px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-bars{height:34px;min-width:0;flex:1 1 auto;gap:2px;color:inherit}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-bars::before,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-bars::after{content:\"\";display:block;height:6px;flex:0 0 16px;background:radial-gradient(circle,currentColor 1.55px,transparent 2px) left center/8px 6px repeat-x;opacity:.95}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-waveform{width:98px;height:34px;flex:1 1 98px;min-width:0;color:inherit;stroke-width:2.4;stroke-linecap:round}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .voice-msg-dur{margin-left:0;color:inherit;font-size:12px;opacity:.82;letter-spacing:0}\n\n/* Payment previews pair a useful full-width layout with their detail sheets. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-content-wrap:has(.chat-transfer-card),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-msg-content-wrap:has(.chat-red-packet-card){width:min(300px,82%);max-width:min(310px,82%)!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-card,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-card{width:300px;max-width:100%;border-radius:17px;box-shadow:0 3px 11px rgba(20,28,46,.12);animation:none;overflow:hidden}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-card{border:1px solid rgba(30,39,60,.08)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body{min-height:80px;padding:13px 15px!important;gap:12px!important;background:#fff!important;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body>.shrink-0{display:block;width:42px;height:42px;flex:0 0 42px;border-radius:50%;background:#faf9f7 var(--ins-paypal-mark) center/25px 30px no-repeat;font-size:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body .flex-1{min-width:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body .text-white{color:var(--ins-ink)!important;font-size:23px;font-weight:620;font-variant-numeric:tabular-nums;line-height:1.14;white-space:nowrap}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body .ui-text-white-85{color:#68717f!important;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-body::after{content:\"转账\";align-self:center;margin-left:auto;color:#0871c7;font-size:15px;font-weight:700;white-space:nowrap}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-card>.ui-text-white-70,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-transfer-card>.ui-media-footer{display:none!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body{position:relative;align-items:flex-start;min-height:129px!important;padding:16px 18px!important;gap:11px!important;background:#bd1130!important;color:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body>.shrink-0{display:block;width:38px;height:38px;flex:0 0 38px;border-radius:50%;background:var(--ins-red-coin) center/38px 38px no-repeat;font-size:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body .text-white{color:#fff!important;font-size:16px;font-weight:650;line-height:38px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body .ui-text-white-85{color:#fff!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body::before{content:\"红包\";position:absolute;left:18px;bottom:19px;color:#fff;font-size:18px;font-weight:700}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-body::after{content:\"领取\";position:absolute;right:18px;bottom:18px;min-width:72px;padding:5px 16px;border-radius:999px;background:#fff;color:#4b1320;text-align:center;font-size:13px;font-weight:700}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-card:not(.red-packet-pulse) .chat-red-packet-body::after{content:\"查看\"}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-red-packet-card>.ui-media-footer{display:none!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal.media-modal-transfer,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal.media-modal-red-packet{width:min(340px,86%);max-width:none;border-radius:21px;box-shadow:0 16px 42px rgba(17,22,38,.22);overflow:hidden}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-header{padding:26px 22px 21px;background:#fff!important;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-emoji{display:block;width:52px;height:52px;margin:0 0 12px;border-radius:50%;background:#faf9f7 var(--ins-paypal-mark) center/30px 37px no-repeat;font-size:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-amount{color:var(--ins-ink);font-size:31px;font-variant-numeric:tabular-nums}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-label{color:#616a78;font-size:14px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-sub{color:#8b929e;font-size:12px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-header{padding:26px 22px 21px;background:#bf1630!important;color:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-emoji{display:block;width:50px;height:50px;margin:0 0 12px;border-radius:50%;background:var(--ins-red-coin) center/50px 50px no-repeat;font-size:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-amount{font-size:31px;font-variant-numeric:tabular-nums}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-label{color:#fff;font-size:14px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-sub{color:rgba(255,255,255,.8);font-size:12px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-body,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-body{background:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .media-modal-actions,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .media-modal-actions{padding:17px 20px 19px;background:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-transfer .ui-btn-transfer{background:var(--ins-purple);color:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .media-modal-red-packet .ui-btn-redpacket{background:#bf1630;color:#fff}\n\n/* Context actions float as translucent controls over the chat. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ctx-menu.chat-floating-ctx-menu{--ctx-menu-bg:rgba(249,250,254,.94);width:150px;align-items:stretch;border:1px solid rgba(255,255,255,.7);border-radius:16px;background:var(--ctx-menu-bg);box-shadow:0 8px 24px rgba(20,28,46,.16);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-floating-ctx-menu>div.flex{display:flex;flex-direction:column;align-items:stretch;width:100%}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-floating-ctx-menu .ctx-menu-btn{display:flex;align-items:center;justify-content:flex-start;width:100%;min-height:34px;padding:7px 15px;color:var(--ins-ink);font-size:13px;text-align:left;border-right:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-floating-ctx-menu .ctx-menu-btn-danger{color:#df4564}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-floating-ctx-menu .ctx-menu-btn:not(:last-of-type){border-bottom:1px solid rgba(24,28,44,.08)}\n\n/* One floating composer. Native actions remain mounted and callable. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar{display:flex!important;flex-direction:row!important;align-items:center;gap:5px;left:9px;right:9px;bottom:max(15px,env(safe-area-inset-bottom,0px));min-height:52px;padding:5px 6px;border:0;border-radius:999px;background:rgba(250,251,255,.58);box-shadow:0 2px 12px rgba(16,20,30,.07),inset 0 1px rgba(255,255,255,.6);backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar>.chat-quote-bar{position:absolute;left:6px;right:6px;bottom:calc(100% + 8px);display:flex;align-items:center;gap:8px;min-width:0;max-width:calc(100% - 12px);box-sizing:border-box;padding:5px 7px 5px 12px;border:1px solid rgba(255,255,255,.64);border-radius:16px;background:rgba(250,251,255,.78);box-shadow:0 4px 16px rgba(16,20,30,.09);backdrop-filter:blur(16px) saturate(1.15);-webkit-backdrop-filter:blur(16px) saturate(1.15)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar>.chat-quote-bar>div{min-width:0;flex:1 1 auto}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar>.chat-quote-bar>button{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 36px;padding:0;border-radius:50%;font-size:16px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar .chat-input-actions{display:contents!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar .chat-input-textarea{order:1;flex:1 1 auto;width:auto;min-width:30px;max-height:100px;min-height:36px;padding:8px 6px;border:0!important;border-radius:18px;background:transparent!important;box-shadow:none;color:var(--ins-ink);font-size:15px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-textarea::placeholder{color:var(--ins-muted)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>.ui-bare-btn{width:35px;height:39px;flex:0 0 35px;display:inline-flex;align-items:center;justify-content:center;padding:0;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>.ui-bare-btn svg{width:27px;height:27px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"voice\"] svg,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"photo\"] svg,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"sticker\"] svg,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"plus\"] svg{width:27px;height:27px;stroke-width:1.9}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"camera\"]{order:0;width:39px;height:39px;flex-basis:39px;border-radius:50%;color:#fff;background:#5454f9}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"camera\"] svg{display:block;width:28px;height:28px;margin:auto}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"camera\"] svg{transform:translateY(-1px)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"voice\"]{order:2}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"photo\"]{order:3}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"sticker\"]{order:4}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"plus\"]{order:5}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"send\"]{order:0}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"trigger\"]{order:2}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"stop\"]{order:2;display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-native]{display:none!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"offline\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"emoji\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"trigger\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>[data-ins-role=\"send\"]{display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"camera\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"voice\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"photo\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"sticker\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"plus\"]{display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"send\"]{display:inline-flex;width:40px;height:40px;flex-basis:40px;border-radius:50%;color:#5b37f5;background:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"send\"] svg{width:23px;height:23px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"trigger\"]{display:inline-flex;width:48px;height:34px;flex-basis:48px;border-radius:999px;color:#fff;background:var(--ins-purple)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-typed=\"true\"]>[data-ins-role=\"trigger\"] svg{width:21px;height:21px;fill:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"send\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"trigger\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"camera\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"voice\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"photo\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"sticker\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"plus\"]{display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-generating=\"true\"]>[data-ins-role=\"stop\"]{display:inline-flex;width:39px;height:39px;flex-basis:39px;border-radius:50%;color:#fff;background:var(--ins-purple)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"camera\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"voice\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"photo\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"sticker\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"plus\"]{display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"send\"]{display:inline-flex;width:40px;height:40px;flex-basis:40px;border-radius:50%;color:#5b37f5;background:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar:has(.chat-input-textarea:focus) .chat-input-actions:not([data-ins-generating=\"true\"])>[data-ins-role=\"trigger\"]{display:inline-flex;width:48px;height:34px;flex-basis:48px;border-radius:999px;color:#fff;background:var(--ins-purple)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar>[data-ins-popup=\"true\"]{position:absolute;left:0;right:0;bottom:calc(100% + 10px);width:100%;height:220px;flex:none;border-radius:18px;background:#fff;box-shadow:0 10px 35px rgba(20,22,30,.15);overflow:hidden;z-index:10}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions[data-ins-plus-open=\"true\"]>[data-ins-role=\"plus\"] svg{transform:rotate(45deg)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar>.chat-plugin-input-toolbar{position:absolute;left:6px;bottom:calc(100% + 10px);z-index:11;box-sizing:border-box;width:max-content;max-width:calc(100% - 180px);max-height:min(62vh,440px);overflow:auto;flex:none}\n\n/* Remaining native actions in a compact, readable menu. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu{position:absolute;right:0;bottom:calc(100% + 10px);width:max-content;min-width:0;max-width:calc(100vw - 28px);max-height:min(62vh,440px);overflow-y:auto;display:flex;flex-direction:column;gap:1px;margin:0;padding:8px;border:1px solid #e8eaf0;border-radius:20px;background:rgba(250,250,252,.96);box-shadow:0 16px 36px rgba(20,22,30,.13);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);content-visibility:visible;transform-origin:bottom right}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-extra-menu-item{min-height:41px;display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:11px;padding:7px 9px;border-radius:11px;color:var(--ins-ink);background:transparent;cursor:pointer}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item[data-ins-promoted=\"true\"]{display:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-icon-box,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-extra-menu-item>svg{width:24px;height:24px;flex:0 0 24px;border:0;background:transparent;box-shadow:none}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item svg{width:22px;height:22px;stroke:currentColor}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item span,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-extra-menu-item span{color:var(--ins-ink);font-size:13px;white-space:nowrap}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item:hover,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-extra-menu-item:hover{background:#eef0f5}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-plus-menu-item:active,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-extra-menu-item:active{transform:scale(.98)}\n@media(max-width:360px){.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header-content{gap:4px;padding:0 8px}.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header-right,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-controls{gap:3px}.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .page-header .page-back-btn,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .ins-header-action{width:36px;height:36px;flex-basis:36px}.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-bar{gap:2px}.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .chat-input-actions>.ui-bare-btn{width:32px;flex-basis:32px}}\n\n/* The phone's system appearance changes the conversation without a manual setting. */\n\n\n/* User-initiated money compose: reuse the card marks without changing payment logic. */\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose]{background:rgba(17,22,35,.34);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose]>div{width:min(326px,calc(100vw - 38px));max-width:none;border:1px solid rgba(31,39,58,.08);border-radius:22px;background:#fff;box-shadow:0 18px 45px rgba(24,27,43,.2);overflow:hidden}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:first-child,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:first-child{min-height:80px;flex-direction:row;justify-content:flex-start;align-items:center;gap:12px;padding:17px 19px!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:first-child{background:#fff!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:first-child{background:#bf1630!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:first-child>div:first-child,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:first-child>div:first-child{width:42px;height:42px;flex:0 0 42px;border-radius:50%;font-size:0!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:first-child>div:first-child{background:#faf9f7 var(--ins-paypal-mark) center/25px 30px no-repeat}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:first-child>div:first-child{background:var(--ins-red-coin) center/42px 42px no-repeat}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:first-child>div:nth-child(2){color:var(--ins-ink);font-size:18px;font-weight:670}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:first-child>div:nth-child(2){color:#fff;font-size:18px;font-weight:670}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:nth-child(2),.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:nth-child(2){padding:18px 19px 20px!important;gap:14px;background:#fff;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"] .ts-12,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"] .ts-12{color:var(--ins-muted);font-size:12px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"] input,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"] input{min-width:0;color:var(--ins-ink);font-variant-numeric:tabular-nums}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"] input.ui-input,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"] input.ui-input{min-height:43px;padding:10px 12px;border:1px solid rgba(65,71,92,.09);border-radius:12px;background:#f5f6f9}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"] input[inputmode=\"decimal\"],.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"] input[inputmode=\"decimal\"]{min-height:48px;padding:5px 2px;border:0!important;border-bottom:1px solid #dfe2eb!important;border-radius:0;background:transparent!important;text-align:left;font-size:28px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"] .ts-24{color:#bf1630!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"] .ts-24{color:#27346a!important}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:nth-child(2)>div:last-child button,.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:nth-child(2)>div:last-child button{min-height:42px;border-radius:12px;font-size:14px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"red-packet\"]>div>div:nth-child(2)>div:last-child button:last-child{background:#bf1630!important;color:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer\"]>div>div:nth-child(2)>div:last-child button:last-child{background:var(--ins-purple)!important;color:#fff}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose] button:disabled{background:#e2e4eb!important;color:#858c99!important;cursor:default}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer-target\"]>.modal-dialog{padding:18px;border-radius:22px;background:#fff;color:var(--ins-ink)}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer-target\"]>.modal-dialog>.text-center{padding:1px 0 9px;color:var(--ins-ink);font-size:16px;font-weight:650}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer-target\"]>.modal-dialog>div:nth-child(2)>button{min-height:52px;border-radius:12px}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer-target\"]>.modal-dialog>div:nth-child(2)>button:hover{background:#f3f1fb}\n.chat-room-wrapper[data-ins-skin-active=\"true\"][data-ins-skin-active=\"true\"].yyk-ins-online .modal-overlay[data-ins-compose=\"transfer-target\"]>.modal-dialog>button:last-child{min-height:42px;border-radius:12px;background:#f3f4f8;color:var(--ins-ink)}\n";
/* END EMBEDDED INS CSS */
export default {
  manifest: {
    id: "ins-chat-skin",
    name: "Ins 聊天美化",
    apiVersion: 1,
    version: "0.9.11",
    author: "Yyk",
    description: "仅在导入配套 CSS 的聊天室且在线聊天时自动生效。",
    permissions: ["ui"],
  },
  setup(ctx) {
    const doc = document;
    const made = new Set();
    const style = doc.createElement("style");
    style.dataset.insChatSkin = "";
    style.textContent = bundledInsCss;
    doc.head.append(style);
    made.add(style);
    const inputListeners = new Map();
    const originalIcons = new Map();
    const originalLabels = new Map();
    const originalTitles = new Map();
    const originalVoiceMarkup = new Map();
    const protectedStyles = new Map();
    const protectStyle = (node, property, value) => {
      if (!node) return;
      let saved = protectedStyles.get(node);
      if (!saved) { saved = new Map(); protectedStyles.set(node, saved); }
      if (!saved.has(property)) saved.set(property, {
        value: node.style.getPropertyValue(property),
        priority: node.style.getPropertyPriority(property),
      });
      saved.get(property).protectedValue = value;
      if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== "important")
        node.style.setProperty(property, value, "important");
    };
    const releaseProtected = (host) => {
      for (const [node, saved] of protectedStyles) {
        if (host && !host.contains(node) && node.isConnected) continue;
        for (const [property, original] of saved) {
          if (node.style.getPropertyValue(property) !== original.protectedValue ||
              node.style.getPropertyPriority(property) !== "important") continue;
          if (original.value) node.style.setProperty(property, original.value, original.priority);
          else node.style.removeProperty(property);
        }
        protectedStyles.delete(node);
      }
    };
    let typingRow;
    let colorRoot;
    let colorObserver;
    let colorFrame = 0;
    const observedUserBubbles = new Set();
    const visibleUserBubbles = new Set();
    const colorStops = [
      [169, 45, 228], // upper viewport: pink violet
      [121, 57, 247], // middle: the original Ins purple
      [84, 84, 249],  // lower viewport: indigo
    ];
    const bubbleColor = (position) => {
      const scaled = Math.max(0, Math.min(1, position)) * (colorStops.length - 1);
      const start = Math.min(colorStops.length - 2, Math.floor(scaled));
      const fraction = scaled - start;
      const rgb = colorStops[start].map((channel, index) =>
        Math.round(channel + (colorStops[start + 1][index] - channel) * fraction));
      return `rgb(${rgb.join(", ")})`;
    };
    const paintVisibleUserBubbles = () => {
      colorFrame = 0;
      if (!colorRoot?.isConnected) return;
      const viewport = colorRoot.getBoundingClientRect();
      if (!viewport.height) return;
      for (const bubble of visibleUserBubbles) {
        if (!bubble.isConnected) { visibleUserBubbles.delete(bubble); continue; }
        const rect = bubble.getBoundingClientRect();
        const position = (rect.top + rect.height / 2 - viewport.top) / viewport.height;
        bubble.style.setProperty("--ins-user-bubble-color", bubbleColor(position));
      }
    };
    const queueBubblePaint = () => {
      if (!colorFrame) colorFrame = requestAnimationFrame(paintVisibleUserBubbles);
    };
    const syncBubbleColors = (host) => {
      const nextRoot = host.querySelector(".page-body");
      if (!nextRoot) return;
      if (nextRoot !== colorRoot) {
        colorObserver?.disconnect();
        for (const bubble of observedUserBubbles) bubble.style.removeProperty("--ins-user-bubble-color");
        observedUserBubbles.clear();
        visibleUserBubbles.clear();
        colorRoot = nextRoot;
        colorObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visibleUserBubbles.add(entry.target);
            else visibleUserBubbles.delete(entry.target);
          }
          queueBubblePaint();
        }, { root: colorRoot });
      }
      for (const bubble of colorRoot.querySelectorAll(".chat-bubble-role-user:not(.chat-bubble-media)")) {
        if (observedUserBubbles.has(bubble)) continue;
        observedUserBubbles.add(bubble);
        colorObserver.observe(bubble);
      }
      for (const bubble of observedUserBubbles) {
        if (bubble.isConnected && colorRoot.contains(bubble)) continue;
        colorObserver.unobserve(bubble);
        observedUserBubbles.delete(bubble);
        visibleUserBubbles.delete(bubble);
        bubble.style.removeProperty("--ins-user-bubble-color");
      }
      queueBubblePaint();
    };
    const onScroll = (event) => {
      if (event.target === colorRoot) queueBubblePaint();
    };
    doc.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", queueBubblePaint);
    const svg = (body) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
    const filled = (viewBox, path) => '<svg viewBox="' + viewBox + '" fill="currentColor" aria-hidden="true"><path d="' + path + '"/></svg>';
    const icons = {
      camera: '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M8 8h3l2-2.2c.5-.6 1.2-.9 2-.9h2c.8 0 1.5.3 2 .9L21 8h3c2.7 0 4.3 1.6 4.3 4.3v11.4c0 2.7-1.6 4.3-4.3 4.3H8c-2.7 0-4.3-1.6-4.3-4.3V12.3C3.7 9.6 5.3 8 8 8Z"/><circle cx="16" cy="18" r="5.4" fill="none" stroke="#5454f9" stroke-width="2.4"/></svg>',
      voice: svg('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>'),
      photo: svg('<rect x="2.7" y="2.7" width="18.6" height="18.6" rx="3"/><circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none"/><path d="m3.4 17.4 5.2-5.2 4.1 3.9 3.5-3.5 4.2 4.2"/>'),
      sticker: svg('<path d="M7.2 2.7h9.6a4.5 4.5 0 0 1 4.5 4.5v8.1l-6 6H7.2a4.5 4.5 0 0 1-4.5-4.5V7.2a4.5 4.5 0 0 1 4.5-4.5Z"/><path d="M15.3 21.1v-3.5a2.3 2.3 0 0 1 2.3-2.3h3.5"/><circle cx="8.1" cy="9.4" r="1" fill="currentColor" stroke="none"/><circle cx="15.7" cy="9.4" r="1" fill="currentColor" stroke="none"/><path d="M8 14.1c1.1 1.2 2.3 1.8 4 1.8"/>'),
      call: filled('0 0 16 16', 'M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.6 17.6 0 0 0 4.168 6.608a17.6 17.6 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.68.68 0 0 0-.58-.122l-2.19.547a1.75 1.75 0 0 1-1.657-.459L5.482 8.062a1.75 1.75 0 0 1-.46-1.657l.548-2.19a.68.68 0 0 0-.122-.58zM1.884.511a1.745 1.745 0 0 1 2.612.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42a18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z'),
      video: filled('0 0 24 24', 'M21.41 7c-.37-.23-.825-.25-1.215-.055l-2.19 1.095V6.75A2.755 2.755 0 0 0 15.255 4H4.75A2.755 2.755 0 0 0 2 6.75v10.5A2.755 2.755 0 0 0 4.75 20h10.5A2.755 2.755 0 0 0 18 17.25v-1.29l2.19 1.095A1.23 1.23 0 0 0 21.405 17c.37-.23.59-.625.59-1.06V8.065c0-.435-.22-.835-.59-1.06zM16.5 17.25c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25V6.75c0-.69.56-1.25 1.25-1.25h10.5c.69 0 1.25.56 1.25 1.25zm4-1.715l-2.5-1.25V9.72l2.5-1.25z'),
      send: filled('0 0 24 24', 'M19.5 2.001a3.5 3.5 0 0 1 3.03 5.249l-7.5 12.99a3.5 3.5 0 0 1-6.411-.842l-1.5-5.595l8.77-5.064a1 1 0 0 0-1-1.732L6.12 12.07L2.026 7.975A3.5 3.5 0 0 1 4.5 2z'),
      search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="m21 21-4.486-4.494M19 10.5a8.5 8.5 0 1 1-17 0a8.5 8.5 0 0 1 17 0Z"/></svg>',
      settings: '<svg viewBox="0 0 140 137" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M114 11 L105 6 L95 4 L94 3 L81 3 L80 4 L74 5 L69 8 L67 8 L61 12 L53 20 L50 26 L47 29 L41 30 L39 32 L37 32 L35 34 L30 36 L17 48 L11 57 L8 63 L8 66 L6 70 L6 74 L5 75 L5 94 L6 95 L6 99 L11 110 L22 122 L28 126 L30 126 L35 129 L38 129 L43 131 L56 131 L57 130 L64 129 L74 124 L81 117 L82 117 L89 106 L96 104 L102 101 L111 95 L120 86 L125 77 L127 75 L131 65 L132 55 L133 54 L133 45 L132 44 L131 35 L126 24 L120 16 L119 16Z M44 40 L45 40 L47 43 L48 52 L55 64 L62 70 L67 72 L74 77 L79 85 L80 91 L81 92 L80 100 L77 107 L68 116 L62 119 L59 119 L55 121 L43 121 L40 119 L37 119 L31 116 L27 112 L26 112 L18 102 L18 100 L16 97 L16 94 L15 93 L15 76 L16 75 L16 71 L21 60 L25 54 L32 47Z M31 100 L32 104 L35 107 L43 110 L53 110 L54 109 L57 109 L62 106 L65 102 L64 98 L61 96 L58 96 L52 100 L44 100 L38 96 L34 96Z M58 80 L56 83 L56 86 L58 89 L61 90 L66 86 L66 84 L65 83 L65 81 L63 80Z M32 80 L30 83 L31 88 L35 90 L36 89 L38 89 L40 86 L40 83 L37 80Z M83 13 L93 13 L97 15 L100 15 L106 18 L110 22 L111 22 L119 32 L119 34 L121 37 L121 40 L122 41 L122 45 L123 46 L123 53 L122 54 L122 58 L121 59 L121 64 L116 74 L102 89 L96 92 L94 94 L92 94 L91 93 L90 86 L86 76 L79 68 L67 61 L61 55 L60 52 L58 50 L58 47 L57 46 L57 35 L62 25 L70 18 L76 15 L79 15Z M92 25 L88 25 L85 28 L85 36 L83 38 L76 38 L72 41 L72 45 L75 48 L83 48 L85 50 L85 58 L86 60 L89 62 L92 61 L95 58 L95 49 L96 48 L105 48 L107 47 L108 45 L108 41 L104 38 L96 38 L95 37 L95 28Z"/></svg>',
      smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'),
      pin: svg('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'),
      spark: svg('<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z"/>'),
    };
    const sessionId = (el) => [...el.classList].find((name) => name.startsWith("session-"))?.slice(8);
    const hasImportedCss = (session) => /--yyk-ins-skin\s*:\s*yyk-ins-v2\b/.test(session?.customCSS || "");
    // The saved room CSS is the opt-in source of truth. WebKit can delay its computed custom property.
    const hasMatchingCss = (host) => {
      const id = sessionId(host);
      return !!id && hasImportedCss(ctx.data.sessions.get(id));
    };
    const isOnlineChat = (host) => !host.querySelector(".chat-offline-body");
    const room = () => [...doc.querySelectorAll(".chat-room-wrapper")]
      .find((candidate) => candidate.getClientRects().length > 0) || null;
    const own = (el) => { made.add(el); return el; };
    const replaceIcon = (button, name) => {
      if (!button || button.querySelector('[data-ins-glyph="' + name + '"]')) return;
      if (!originalIcons.has(button)) originalIcons.set(button, button.innerHTML);
      button.innerHTML = icons[name].replace("<svg ", '<svg data-ins-glyph="' + name + '" ');
    };
    let linkedRoomsExpanded = false;
    const mountLinkedRooms = (el) => {
      const details = doc.createElement("details");
      details.open = linkedRoomsExpanded;
      details.style.cssText = "border-top:1px solid color-mix(in srgb,var(--c-card-border) 20%,transparent);padding:12px 16px;color:var(--c-text-title)";
      const summary = doc.createElement("summary");
      summary.style.cssText = "cursor:pointer;font-size:14px;font-weight:600;list-style-position:inside";
      const caption = doc.createElement("p");
      caption.textContent = "导入配套 CSS 后自动联动；移除 CSS 即停用。线下模式不生效。";
      caption.style.cssText = "margin:10px 0;color:var(--c-text-secondary,var(--c-icon));font-size:12px;line-height:1.5";
      const list = doc.createElement("div");
      list.style.cssText = "display:grid;gap:4px;max-height:260px;overflow-y:auto";
      const sessions = ctx.data.sessions.list().filter(hasImportedCss).sort((a, b) =>
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      const contacts = new Map(ctx.data.contacts.list().map((contact) => [contact.characterId, contact]));
      const characters = new Map(ctx.data.characters.list().map((character) => [character.id, character]));
      summary.textContent = `已联动聊天室 · ${sessions.length}`;
      if (!sessions.length) {
        const empty = doc.createElement("span");
        empty.textContent = "暂无导入配套 CSS 的聊天室";
        empty.style.cssText = "padding:8px;color:var(--c-icon);font-size:12px";
        list.append(empty);
      }
      for (const session of sessions) {
        const row = doc.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:10px;min-height:48px;padding:7px 9px;border-radius:10px;background:color-mix(in srgb,var(--c-text-title) 4%,transparent)";
        const dot = doc.createElement("span");
        dot.setAttribute("aria-hidden", "true");
        dot.style.cssText = "width:8px;height:8px;flex:none;border-radius:50%;background:#7939f7";
        const text = doc.createElement("span");
        text.style.cssText = "display:grid;min-width:0;gap:2px";
        const title = doc.createElement("span");
        const contact = contacts.get(session.contactId);
        const character = characters.get(session.contactId);
        title.textContent = session.isGroup
          ? (session.groupName || session.alias || `群聊 · ${session.id.slice(-6)}`)
          : (session.alias || character?.name || contact?.nickname || `未知联系人 · ${session.contactId.slice(-6)}`);
        title.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600";
        const status = doc.createElement("span");
        status.textContent = "已导入配套 CSS";
        status.style.cssText = "color:var(--c-text-secondary,var(--c-icon));font-size:11px";
        text.append(title, status);
        row.append(dot, text);
        list.append(row);
      }
      details.addEventListener("toggle", () => { linkedRoomsExpanded = details.open; });
      details.append(summary, caption, list);
      el.append(details);
    };

    function openNativeMenuAction(label) {
      const host = room();
      const plus = host?.querySelector('.chat-input-actions > [data-ins-role="plus"]');
      if (!plus) return;
      if (!host.querySelector(".chat-plus-menu")) plus.click();
      requestAnimationFrame(() => {
        const current = room();
        const item = [...(current?.querySelectorAll(".chat-plus-menu-item") || [])]
          .find((node) => node.querySelector("span")?.textContent?.trim() === label);
        if (item) item.click();
      });
    }

    function syncHeader(host) {
      const right = host.querySelector(".page-header-right");
      const title = host.querySelector(".page-title");
      if (!right || !title) return;
      let controls = right.querySelector("[data-ins-header-controls]");
      if (!controls) {
        controls = own(doc.createElement("span"));
        controls.className = "ins-header-controls";
        controls.dataset.insHeaderControls = "";
        for (const [label, glyph] of [["语音通话", icons.call], ["视频通话", icons.video]]) {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "ins-header-action";
          button.setAttribute("aria-label", label);
          button.title = label;
          button.innerHTML = glyph;
          button.addEventListener("click", () => openNativeMenuAction(label));
          controls.append(button);
        }
        right.append(controls);
      }
      const more = right.querySelector(':scope > button[aria-label="更多"]');
      if (more && !more.dataset.insSettings) {
        originalTitles.set(more, more.getAttribute("title"));
        more.dataset.insSettings = "true";
        more.title = "聊天设置";
      }
      replaceIcon(more, "settings");
      if (!title.querySelector("[data-ins-header-avatar]")) {
        const img = host.querySelector('.chat-msg-wrapper[data-role="assistant"] .chat-msg-avatar img');
        if (img) {
          const clone = own(img.cloneNode(true));
          clone.className = "ins-header-avatar";
          clone.dataset.insHeaderAvatar = "";
          title.prepend(clone);
        }
      }
    }

    function syncComposer(host) {
      const actions = host.querySelector(".chat-input-actions");
      const input = host.querySelector(".chat-input-bar textarea");
      if (!actions || !input) return;
      const native = [...actions.querySelectorAll(":scope > button:not([data-ins-owned])")];
      const [offline, emoji, sticker, plus] = native;
      const send = native.find((el) => ["发送", "停止本轮生成"].includes(el.getAttribute("aria-label")));
      const trigger = native.find((el) => ["发送输入框内容并触发回复", "触发 AI 主动回复"].includes(el.title));
      if (!send || !plus) return;
      for (const [el, role] of [[offline, "offline"], [emoji, "emoji"], [plus, "plus"]]) if (el) el.dataset.insRole = role;
      if (sticker) sticker.dataset.insNative = "sticker";
      send.dataset.insNative = "send";
      if (trigger) trigger.dataset.insNative = "trigger";
      if (!actions.dataset.insReady) {
        const make = (role, label, glyph, handler) => {
          const el = own(doc.createElement("button"));
          el.type = "button";
          el.className = "ui-bare-btn";
          el.dataset.insOwned = "true";
          el.dataset.insRole = role;
          el.setAttribute("aria-label", label);
          el.title = label;
          el.innerHTML = glyph;
          el.addEventListener("click", handler);
          actions.append(el);
        };
        const clickNative = (selector) => {
          const button = room()?.querySelector(".chat-input-actions > " + selector);
          if (button && !button.disabled) button.click();
        };
        make("camera", "照片墙", icons.camera, () => openNativeMenuAction("照片墙"));
        make("voice", "语音条", icons.voice, () => openNativeMenuAction("语音条"));
        make("photo", "文字图片", icons.photo, () => openNativeMenuAction("文字图片"));
        make("sticker", "贴图", icons.sticker, () => clickNative('[data-ins-native="sticker"]'));
        make("send", "发送", icons.search, () => clickNative('[data-ins-native="send"][aria-label="发送"]'));
        make("trigger", "发送并触发 AI 回复", icons.send, () => clickNative('[data-ins-native="trigger"]'));
        make("stop", "停止本轮生成", svg('<rect x="7" y="7" width="10" height="10" rx="2"/>'), () => clickNative('[data-ins-native="send"][aria-label="停止本轮生成"]'));
        const update = () => { actions.dataset.insTyped = String(!!input.value.trim()); queueSync(); };
        if (!input.hasAttribute("placeholder")) { input.placeholder = "发消息..."; input.dataset.insPlaceholder = "true"; }
        input.addEventListener("input", update);
        input.addEventListener("focus", queueSync);
        input.addEventListener("blur", queueSync);
        inputListeners.set(input, () => {
          input.removeEventListener("input", update);
          input.removeEventListener("focus", queueSync);
          input.removeEventListener("blur", queueSync);
        });
        actions.dataset.insReady = "true";
        update();
      }
      actions.dataset.insPlusOpen = String(!!host.querySelector(".chat-plus-menu"));
      actions.dataset.insTyped = String(!!input.value.trim());
      actions.dataset.insGenerating = String(send.getAttribute("aria-label") === "停止本轮生成");
      for (const panel of host.querySelectorAll('.chat-input-bar > .h-\\[220px\\]')) panel.dataset.insPopup = "true";
    }

    function protectRoomControls(host) {
      if (host.hasAttribute("data-settings-open")) { releaseProtected(host); return; }
      const pin = (node, display) => {
        protectStyle(node, "display", display);
        protectStyle(node, "visibility", "visible");
        protectStyle(node, "opacity", "1");
        protectStyle(node, "pointer-events", "auto");
      };
      pin(host.querySelector(".page-header-right"), "inline-flex");
      pin(host.querySelector(".page-header .page-back-btn"), "inline-flex");
      pin(host.querySelector(".ins-header-controls"), "inline-flex");
      for (const button of host.querySelectorAll(".ins-header-action")) pin(button, "inline-flex");
      const dock = host.querySelector(".chat-input-bar");
      const actions = dock?.querySelector(".chat-input-actions");
      const input = dock?.querySelector("textarea");
      if (!dock || !actions || !input || !actions.dataset.insReady) return;
      pin(dock, "flex");
      pin(actions, "contents");
      pin(input, "block");
      const generating = actions.dataset.insGenerating === "true";
      const composing = !!input.value.trim() || doc.activeElement === input;
      for (const button of actions.querySelectorAll(":scope > button")) {
        const role = button.dataset.insRole;
        const display = button.dataset.insNative || role === "offline" || role === "emoji"
          ? "none"
          : role === "stop"
            ? (generating ? "inline-flex" : "none")
            : role === "send" || role === "trigger"
              ? (!generating && composing ? "inline-flex" : "none")
              : ["camera", "voice", "photo", "sticker", "plus"].includes(role)
                ? (!generating && !composing ? "inline-flex" : "none")
                : null;
        if (display !== null) pin(button, display);
      }
    }

    function protectTextBubbles(host) {
      if (host.hasAttribute("data-settings-open")) return;
      for (const bubble of host.querySelectorAll(".chat-bubble-role-user:not(.chat-bubble-media), .chat-bubble-role-assistant:not(.chat-bubble-media)")) {
        if (!bubble.querySelector(".chat-markdown") || bubble.querySelector(".chat-quote-message")) continue;
        const ownBubble = bubble.classList.contains("chat-bubble-role-user");
        protectStyle(bubble, "background", ownBubble
          ? "var(--ins-user-bubble-color, var(--ins-purple))"
          : "var(--ins-gray)");
        protectStyle(bubble, "color", ownBubble ? "#fff" : "var(--ins-ink)");
      }
    }

    function syncMenu(host) {
      const menu = host.querySelector(".chat-plus-menu");
      if (!menu) return;
      for (const item of menu.querySelectorAll(".chat-plus-menu-item")) {
        const label = item.querySelector("span")?.textContent?.trim();
        item.dataset.insPromoted = String(["照片墙", "文字图片", "语音条", "语音通话", "视频通话"].includes(label));
      }
      if (menu.querySelector("[data-ins-extra]")) return;
      const actions = host.querySelector(".chat-input-actions");
      for (const [label, role, glyph] of [
        ["表情", "emoji", icons.smile],
        ["线下模式", "offline", icons.pin],
        ["触发 AI 回复", "trigger", icons.spark],
      ]) {
        const button = own(doc.createElement("button"));
        button.type = "button";
        button.className = "ins-extra-menu-item";
        button.dataset.insExtra = role;
        button.innerHTML = glyph + "<span>" + label + "</span>";
        button.addEventListener("click", () => {
          const native = actions?.querySelector(role === "trigger" ? '[data-ins-native="trigger"]' : '[data-ins-role="' + role + '"]');
          actions?.querySelector('[data-ins-role="plus"]')?.click();
          native?.click();
        });
        menu.append(button);
      }
    }

    function syncQuotes(host) {
      const id = sessionId(host);
      const messages = id ? ctx.data.messages.list(id) : [];
      const byId = new Map(messages.map((message) => [message.id, message]));
      for (const quote of host.querySelectorAll(".chat-quote-message")) {
        const bubble = quote.closest("[data-msg-id]");
        const message = byId.get(bubble?.dataset.msgId);
        const sourceRole = message?.mediaData?.quoteRole;
        const preview = quote.querySelector(".chat-quote-preview")?.textContent?.trim();
        const visibleSource = [...host.querySelectorAll(".chat-msg-wrapper[data-role]")].find((row) =>
          row !== quote.closest(".chat-msg-wrapper") &&
          !!preview && !!row.querySelector(".chat-markdown")?.textContent?.includes(preview)
        );
        const source = messages.findLast((item) => !!preview && item.content?.includes(preview));
        const role = visibleSource?.dataset.role || sourceRole || source?.role;
        quote.dataset.insQuoteSourceRole = role === "user" ? "user" : "assistant";
        const ownerRole = bubble?.dataset.ui === "bubble-user" ? "user" : "assistant";
        let label = quote.querySelector("[data-ins-quote-label]");
        if (!label) {
          label = own(doc.createElement("div"));
          label.className = "chat-quote-label";
          label.dataset.insQuoteLabel = "";
          quote.prepend(label);
        }
        label.textContent = ownerRole === "user" ? "我回复了" : "对方回复了";
      }
    }

    function syncTranslationLabels(host) {
      for (const button of host.querySelectorAll(".chat-bilingual-toggle")) {
        const label = button.getAttribute("aria-expanded") === "true" ? "收起翻译" : "展开翻译";
        if (!originalLabels.has(button)) originalLabels.set(button, button.textContent);
        if (button.textContent !== label) button.textContent = label;
      }
    }

    function syncMediaLabels(host) {
      for (const [selector, label] of [
        [".chat-transfer-card .ui-media-footer > span:first-child", "转账"],
        [".chat-red-packet-card .ui-media-footer > span:first-child", "红包"],
      ]) {
        for (const node of host.querySelectorAll(selector)) {
          if (!originalLabels.has(node)) originalLabels.set(node, node.textContent);
          if (node.textContent !== label) node.textContent = label;
        }
      }
      for (const node of host.querySelectorAll(".voice-msg-dur")) {
        const match = node.textContent?.match(/^(\d+)"$/);
        if (!match) continue;
        if (!originalLabels.has(node)) originalLabels.set(node, node.textContent);
        const seconds = Number(match[1]);
        node.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      }
    }

    function syncVoiceGlyphs(host) {
      const play = filled('0 0 24 24', 'M19.266 13.516a1.917 1.917 0 0 0 0-3.032A35.8 35.8 0 0 0 9.35 5.068l-.653-.232c-1.248-.443-2.567.401-2.736 1.69a42.5 42.5 0 0 0 0 10.948c.17 1.289 1.488 2.133 2.736 1.69l.653-.232a35.8 35.8 0 0 0 9.916-5.416');
      const wave = '<svg class="voice-msg-waveform" viewBox="0 0 100 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" aria-hidden="true"><path d="M2 11v2M8 9v6M14 7v10M20 4v16M26 6v12M32 2v20M38 5v14M44 8v8M50 3v18M56 6v12M62 1v22M68 5v14M74 8v8M80 4v16M86 7v10M92 9v6M98 11v2"/></svg>';
      for (const bubble of host.querySelectorAll('.voice-msg-bubble')) {
        const icon = bubble.querySelector('.voice-msg-icon');
        if (icon && !icon.querySelector('.animate-spin, rect') && !icon.querySelector('[data-ins-voice-play]')) {
          if (!originalVoiceMarkup.has(icon)) originalVoiceMarkup.set(icon, icon.innerHTML);
          icon.innerHTML = play.replace('<svg ', '<svg data-ins-voice-play="true" ');
        }
        const bars = bubble.querySelector('.voice-msg-bars');
        if (bars && !bars.querySelector('.voice-msg-waveform')) {
          if (!originalVoiceMarkup.has(bars)) originalVoiceMarkup.set(bars, bars.innerHTML);
          bars.innerHTML = wave;
        }
      }
    }

    function syncPaymentModal(host) {
      for (const modal of host.querySelectorAll('.media-modal')) {
        const emoji = modal.querySelector('.media-modal-emoji')?.textContent?.trim();
        modal.classList.toggle('media-modal-transfer', emoji === '💰');
        modal.classList.toggle('media-modal-red-packet', emoji === '🧧');
      }
    }

    function syncMoneyCompose(host) {
      for (const overlay of host.querySelectorAll(".modal-overlay")) {
        const title = overlay.querySelector(":scope > div > div:first-child > div:nth-child(2)")?.textContent?.trim();
        const targetTitle = overlay.querySelector(":scope > .modal-dialog > .text-center")?.textContent?.trim();
        const mode = title === "发红包" ? "red-packet"
          : title === "转账" ? "transfer"
          : targetTitle === "选择收款人" ? "transfer-target" : "";
        if (mode) overlay.dataset.insCompose = mode;
        else delete overlay.dataset.insCompose;
      }
    }

    function syncTyping(host) {
      const body = host.querySelector(".page-body");
      if (!body) return;
      const active = !!host.querySelector(".chat-typing-indicator");
      if (!active) { typingRow?.remove(); return; }
      if (!typingRow) {
        typingRow = own(doc.createElement("div"));
        typingRow.className = "ins-typing-row";
        typingRow.setAttribute("role", "status");
        typingRow.setAttribute("aria-label", "对方正在输入");
        const avatar = doc.createElement("span");
        avatar.className = "ins-typing-avatar";
        const bubble = doc.createElement("span");
        bubble.className = "ins-typing-bubble";
        bubble.setAttribute("aria-hidden", "true");
        bubble.innerHTML = "<i></i><i></i><i></i>";
        typingRow.append(avatar, bubble);
      }
      const image = host.querySelector('.chat-msg-wrapper[data-role="assistant"] .chat-msg-avatar img') || host.querySelector(".ins-header-avatar");
      const avatar = typingRow.querySelector(".ins-typing-avatar");
      if (image && avatar && !avatar.querySelector("img")) avatar.append(image.cloneNode(true));
      if (typingRow.parentElement !== body || typingRow !== body.lastElementChild) body.append(typingRow);
    }

    function syncTextRuns(host) {
      const body = host.querySelector(".page-body");
      if (!body) return;
      const groups = [...body.children];
      const activeMasters = new Set();
      for (const group of groups) {
        group.removeAttribute("data-ins-text-pos");
        group.removeAttribute("data-ins-translation-run");
        group.querySelector(".chat-msg-wrapper")?.removeAttribute("data-ins-text-pos");
      }
      let run = [];
      let role = "";
      const flush = () => {
        if (run.length > 1) {
          run.forEach((group, index) => {
            const pos = index === 0 ? "first" : index === run.length - 1 ? "last" : "middle";
            group.dataset.insTextPos = pos;
            group.querySelector(".chat-msg-wrapper").dataset.insTextPos = pos;
          });
          const translated = run.filter((group) => group.querySelector(".chat-bilingual-toggle"));
          if (translated.length) {
            const last = run.at(-1);
            const wrap = last.querySelector(".chat-msg-content-wrap");
            const runId = last.querySelector(".chat-msg-wrapper")?.id;
            if (wrap && runId) {
              for (const group of run) group.dataset.insTranslationRun = runId;
              let master = wrap.querySelector(":scope > [data-ins-run-translation]");
              if (!master) {
                master = own(doc.createElement("button"));
                master.type = "button";
                master.className = "ins-run-translation";
                master.dataset.insRunTranslation = "";
                master.addEventListener("click", (event) => {
                  event.stopPropagation();
                  const desired = master.getAttribute("aria-expanded") !== "true";
                  const current = room();
                  const runGroups = [...(current?.querySelectorAll(".page-body > [data-ins-translation-run]") || [])]
                    .filter((group) => group.dataset.insTranslationRun === master.dataset.insRunId);
                  const messageIds = runGroups.map((group) => group.querySelector("[data-msg-id]")?.dataset.msgId).filter(Boolean);
                  for (const id of messageIds) {
                    const button = [...(current?.querySelectorAll(".chat-bilingual-toggle") || [])]
                      .find((node) => node.closest("[data-msg-id]")?.dataset.msgId === id);
                    if (button && (button.getAttribute("aria-expanded") === "true") !== desired) button.click();
                  }
                  requestAnimationFrame(sync);
                });
                wrap.append(master);
              }
              master.dataset.insRunId = runId;
              const expanded = translated.every((group) => group.querySelector(".chat-bilingual-toggle")?.getAttribute("aria-expanded") === "true");
              master.setAttribute("aria-expanded", String(expanded));
              const label = expanded ? "收起翻译" : "展开翻译";
              if (master.textContent !== label) master.textContent = label;
              activeMasters.add(master);
            }
          }
        }
        run = [];
        role = "";
      };
      for (const group of groups) {
        const row = group.querySelector(":scope > .chat-msg-wrapper");
        const rowRole = row?.dataset.role;
        const bubble = row?.querySelector(".chat-bubble-role-" + rowRole);
        const hasTimestamp = row && group.firstElementChild !== row;
        const text = (rowRole === "user" || rowRole === "assistant") &&
          bubble && !bubble.classList.contains("chat-bubble-media") &&
          !bubble.querySelector(".chat-quote-message") &&
          !!bubble.querySelector(".chat-markdown");
        // Float marks only same-sender messages without a timestamp as consecutive.
        // A role match alone would merge different members of a group chat.
        if (!text || hasTimestamp || (run.length && !row.hasAttribute("data-consecutive")) || (role && role !== rowRole)) flush();
        if (text) { run.push(group); role = rowRole; }
      }
      flush();
      for (const master of body.querySelectorAll("[data-ins-run-translation]")) {
        if (!activeMasters.has(master)) master.remove();
      }
    }

    let queued = false;
    const observedLayers = new Set();
    const onVisibilityChanged = new MutationObserver(() => queueSync());
    const watchRoomLayers = () => {
      for (const layer of doc.querySelectorAll(".chat-room-layer")) {
        if (observedLayers.has(layer)) continue;
        observedLayers.add(layer);
        onVisibilityChanged.observe(layer, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
      }
      for (const layer of observedLayers) {
        if (layer.isConnected) continue;
        onVisibilityChanged.disconnect();
        observedLayers.clear();
        for (const current of doc.querySelectorAll(".chat-room-layer")) {
          observedLayers.add(current);
          onVisibilityChanged.observe(current, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
        }
        break;
      }
    };
    const restoreRoom = (host) => {
      host.removeAttribute("data-ins-skin-active");
      host.classList.remove("yyk-ins-online");
      releaseProtected(host);
      for (const [input, dispose] of inputListeners) {
        if (!host.contains(input) && input.isConnected) continue;
        dispose();
        inputListeners.delete(input);
      }
      for (const el of made) {
        if (!host.contains(el) && el.isConnected) continue;
        if (el === style) continue;
        el.remove();
        made.delete(el);
      }
      if (typingRow && !typingRow.isConnected) typingRow = undefined;
      for (const [button, markup] of originalIcons) {
        if (!host.contains(button) && button.isConnected) continue;
        if (button.isConnected) button.innerHTML = markup;
        originalIcons.delete(button);
      }
      for (const [node, label] of originalLabels) {
        if (!host.contains(node) && node.isConnected) continue;
        if (node.isConnected) node.textContent = label;
        originalLabels.delete(node);
      }
      for (const [node, title] of originalTitles) {
        if (!host.contains(node) && node.isConnected) continue;
        if (node.isConnected) {
          if (title === null) node.removeAttribute("title");
          else node.setAttribute("title", title);
        }
        originalTitles.delete(node);
      }
      for (const [node, markup] of originalVoiceMarkup) {
        if (!host.contains(node) && node.isConnected) continue;
        if (node.isConnected) node.innerHTML = markup;
        originalVoiceMarkup.delete(node);
      }
      if (colorRoot && host.contains(colorRoot)) {
        colorObserver?.disconnect();
        colorRoot = undefined;
        observedUserBubbles.clear();
        visibleUserBubbles.clear();
      }
      for (const bubble of host.querySelectorAll(".chat-bubble-role-user"))
        bubble.style.removeProperty("--ins-user-bubble-color");
      for (const el of host.querySelectorAll(".chat-input-actions[data-ins-ready]")) {
        delete el.dataset.insReady;
        delete el.dataset.insTyped;
        delete el.dataset.insPlusOpen;
        delete el.dataset.insGenerating;
      }
      for (const el of host.querySelectorAll("[data-ins-role], [data-ins-native]")) {
        delete el.dataset.insRole;
        delete el.dataset.insNative;
      }
      for (const el of host.querySelectorAll("textarea[data-ins-placeholder]")) {
        el.removeAttribute("placeholder");
        delete el.dataset.insPlaceholder;
      }
      for (const el of host.querySelectorAll("[data-ins-settings], [data-ins-popup], [data-ins-promoted], [data-ins-quote-source-role], [data-ins-text-pos], [data-ins-translation-run]")) {
        delete el.dataset.insSettings;
        delete el.dataset.insPopup;
        delete el.dataset.insPromoted;
        delete el.dataset.insQuoteSourceRole;
        delete el.dataset.insTextPos;
        delete el.dataset.insTranslationRun;
      }
      for (const modal of host.querySelectorAll(".media-modal-transfer, .media-modal-red-packet"))
        modal.classList.remove("media-modal-transfer", "media-modal-red-packet");
      for (const overlay of host.querySelectorAll(".modal-overlay[data-ins-compose]"))
        delete overlay.dataset.insCompose;
    };
    const sync = () => {
      watchRoomLayers();
      for (const candidate of doc.querySelectorAll(".chat-room-wrapper[data-ins-skin-active], .chat-room-wrapper.yyk-ins-online")) {
        if (!hasMatchingCss(candidate) || !isOnlineChat(candidate)) restoreRoom(candidate);
      }
      const host = room();
      if (!host || !hasMatchingCss(host) || !isOnlineChat(host)) return;
      host.classList.add("yyk-ins-online");
      if (!host.hasAttribute("data-ins-skin-active")) host.setAttribute("data-ins-skin-active", "true");
      syncHeader(host);
      syncComposer(host);
      protectRoomControls(host);
      syncMenu(host);
      syncQuotes(host);
      syncTranslationLabels(host);
      syncMediaLabels(host);
      syncVoiceGlyphs(host);
      syncPaymentModal(host);
      syncMoneyCompose(host);
      syncTextRuns(host);
      syncTyping(host);
      syncBubbleColors(host);
      protectTextBubbles(host);
    };
    const queueSync = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sync(); });
    };
    ctx.ui.slot("settings.section", mountLinkedRooms);
    const observer = new MutationObserver(queueSync);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-settings-open"] });
    window.addEventListener("chat-session-css-updated", queueSync);
    sync();
    return () => {
      observer.disconnect();
      window.removeEventListener("chat-session-css-updated", queueSync);
      for (const host of doc.querySelectorAll(".chat-room-wrapper[data-ins-skin-active]")) restoreRoom(host);
      onVisibilityChanged.disconnect();
      colorObserver?.disconnect();
      if (colorFrame) cancelAnimationFrame(colorFrame);
      doc.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", queueBubblePaint);
      for (const bubble of observedUserBubbles) bubble.style.removeProperty("--ins-user-bubble-color");
      for (const dispose of inputListeners.values()) dispose();
      releaseProtected();
      for (const el of made) el.remove();
      for (const [button, markup] of originalIcons) if (button.isConnected) button.innerHTML = markup;
      for (const [node, label] of originalLabels) if (node.isConnected) node.textContent = label;
      for (const [node, title] of originalTitles) if (node.isConnected) {
        if (title === null) node.removeAttribute("title");
        else node.setAttribute("title", title);
      }
      for (const [node, markup] of originalVoiceMarkup) if (node.isConnected) node.innerHTML = markup;
      for (const el of doc.querySelectorAll(".chat-input-actions[data-ins-ready]")) {
        delete el.dataset.insReady;
        delete el.dataset.insTyped;
        delete el.dataset.insPlusOpen;
        delete el.dataset.insGenerating;
        for (const button of el.querySelectorAll("[data-ins-role], [data-ins-native]")) { delete button.dataset.insRole; delete button.dataset.insNative; }
      }
      for (const el of doc.querySelectorAll("textarea[data-ins-placeholder]")) {
        el.removeAttribute("placeholder");
        delete el.dataset.insPlaceholder;
      }
      for (const el of doc.querySelectorAll(".page-header-right [data-ins-settings]")) delete el.dataset.insSettings;
      for (const el of doc.querySelectorAll('[data-ins-popup="true"]')) delete el.dataset.insPopup;
      for (const el of doc.querySelectorAll(".chat-quote-message[data-ins-quote-source-role]")) delete el.dataset.insQuoteSourceRole;
      for (const el of doc.querySelectorAll(".page-body > [data-ins-text-pos]")) {
        delete el.dataset.insTextPos;
        delete el.dataset.insTranslationRun;
      }
      for (const el of doc.querySelectorAll(".chat-msg-wrapper[data-ins-text-pos]")) delete el.dataset.insTextPos;
    };
  },
};
