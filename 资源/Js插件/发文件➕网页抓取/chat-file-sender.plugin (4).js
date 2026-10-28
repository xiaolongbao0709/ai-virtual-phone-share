// ─────────────────────────────────────────────────────────────
// 发文件 · 小手机聊天插件（apiVersion 1）
//
// 在聊天输入栏的「+」面板里加一个「文件」项，选手机里的任意文件发送：
// 图片 / 音频 / 视频 / PDF / 压缩包 / 文档都行，走宿主原生的文件气泡
// （和角色通过工具发出来的文件是同一条渲染路径），右侧自带「保存到手机」。
//
// v1.2.0 起还会把文档正文解析出来交给模型（见文件下部「文档正文提取」），
// 所以发 PDF 给角色，它是真的能读到内容，而不是回一句「我接收不了 PDF」。
//
// 实现要点：
// 1) 字节优先写进宿主自己的媒体库（AiPhoneMediaCacheDB / media-store:// 引用），
//    消息里只留引用，聊天存储不会被 base64 撑爆；写不进去时按体积兜底成 data: URL。
// 2) 发完补一个 "chat-messages-updated"（宿主给"其它 App 插入消息"用的刷新通道），
//    聊天界面立即出现；可选再发 "chat-request-reply" 让角色当场回一句。
// 3) 文档解析是纯前端的（DecompressionStream + 手写 PDF/ZIP 解析），不联网、不上传。
// 4) 只依赖 ctx 的公开 API + 浏览器标准 API；媒体库写入做了读回校验，失败即降级。
// ─────────────────────────────────────────────────────────────

const DB_NAME = "AiPhoneMediaCacheDB";     // 宿主媒体库（Dexie 建库）
const DB_STORE = "entries";                // 宿主媒体库的对象仓库
const REF_PREFIX = "media-store://";       // 宿主 mediaUrl 协议（注意不是 mediastore://）
const MAX_FILES = 5;
const MAX_FILE_MB = 100;

const PAPERCLIP_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.64 17.71a2 2 0 01-2.83-2.83l8.49-8.49"/></svg>';

const CSS = `
.cfs-row{display:flex;flex-wrap:wrap;gap:14px;padding:4px 16px 12px}
.cfs-item{-webkit-tap-highlight-color:transparent;user-select:none;outline:none}
.cfs-item:active{opacity:.7}
.cfs-modal{display:flex;flex-direction:column;gap:12px;padding:18px;text-align:left}
.cfs-modal h3{margin:0;font-size:16px}
.cfs-modal p{margin:0;font-size:13px;line-height:1.6;opacity:.75}
.cfs-modal ul{margin:0;padding-left:18px;font-size:13px;line-height:1.7;opacity:.75}
.cfs-modal button{align-self:flex-end;font:inherit;font-size:13px;padding:6px 16px;border-radius:9px;border:1px solid rgba(140,140,140,.4);background:rgba(140,140,140,.12);color:inherit;cursor:pointer}
.chat-plugin-input-toolbar:empty{display:none}
`;

// ─────────────────────────────────────────────────────────────
// 文档正文提取（模块级纯函数，便于测试；只依赖浏览器标准 API）
//
//   PDF  ：扫描 stream 对象 → DecompressionStream 解 FlateDecode → 解析 ToUnicode CMap
//          → 解码 Tj/TJ 里的字符串。扫描件（纯图片）没有文字对象，会如实报告失败。
//   DOCX ：ZIP 中央目录 → inflateRaw 解 word/document.xml → 去标签
//   PPTX ：同上，取 ppt/slides/slideN.xml 里的 <a:t>
//   XLSX ：同上，取 xl/sharedStrings.xml 里的 <t>
//   TXT  ：按 UTF-8 解（带 BOM/GBK 粗判）
// ─────────────────────────────────────────────────────────────

const LEGACY_DOC_EXT = ["doc", "ppt", "xls"];

const DOC_TYPES = [
  { kind: "pdf", exts: ["pdf"], mimes: ["application/pdf"] },
  { kind: "docx", exts: ["docx"], mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  { kind: "pptx", exts: ["pptx"], mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  { kind: "xlsx", exts: ["xlsx"], mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  {
    kind: "text",
    exts: ["txt", "md", "markdown", "csv", "tsv", "json", "log", "xml", "html", "htm", "yaml", "yml", "ini", "srt", "ass", "js", "ts", "py", "css"],
    mimes: ["text/", "application/json", "application/xml", "application/javascript"],
  },
];

const docKindOf = (name, mime) => {
  const ext = (String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
  const type = String(mime || "").toLowerCase();
  if (LEGACY_DOC_EXT.includes(ext)) return "legacy";
  for (const entry of DOC_TYPES) {
    if (entry.exts.includes(ext)) return entry.kind;
    if (entry.mimes.some((m) => (m.endsWith("/") ? type.startsWith(m) : type === m))) return entry.kind;
  }
  return "";
};

const latin1FromBytes = (bytes) => {
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return out;
};

const bytesFromLatin1 = (text) => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

const decodeUtf8 = (bytes) => {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return latin1FromBytes(bytes);
  }
};

const inflateBytes = async (bytes, format) => {
  if (typeof DecompressionStream !== "function") throw new Error("当前环境不支持解压（缺少 DecompressionStream）");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const decodeXmlEntities = (text) => text
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ""; }
  })
  .replace(/&#(\d+);/g, (_, dec) => {
    try { return String.fromCodePoint(Number(dec)); } catch { return ""; }
  })
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

const tidyDocText = (text) => String(text || "")
  .replace(/\r\n?/g, "\n")
  .replace(/[\u00a0\t\f\v ]+/g, " ")
  .split("\n")
  .map((line) => line.trim())
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

// ── PDF ─────────────────────────────────────────────────────
const pdfHexToUnicode = (hex) => {
  const clean = String(hex || "").replace(/\s+/g, "");
  let out = "";
  if (clean.length % 4 !== 0) {
    for (let i = 0; i + 1 < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
    return out;
  }
  for (let i = 0; i < clean.length; i += 4) {
    const code = parseInt(clean.slice(i, i + 4), 16);
    if (!Number.isFinite(code)) continue;
    if (code >= 0xd800 && code <= 0xdbff && i + 7 < clean.length) {
      const low = parseInt(clean.slice(i + 4, i + 8), 16);
      out += String.fromCharCode(code, low);
      i += 4;
      continue;
    }
    out += String.fromCharCode(code);
  }
  return out;
};

const parsePdfToUnicode = (text) => {
  const map = new Map();
  const charBlocks = text.match(/beginbfchar[\s\S]*?endbfchar/g) || [];
  for (const block of charBlocks) {
    const pairs = block.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) || [];
    for (const pair of pairs) {
      const parts = pair.match(/<([0-9a-fA-F]+)>/g);
      if (!parts || parts.length < 2) continue;
      const code = parseInt(parts[0].slice(1, -1), 16);
      map.set(code, pdfHexToUnicode(parts[1].slice(1, -1)));
    }
  }
  const rangeBlocks = text.match(/beginbfrange[\s\S]*?endbfrange/g) || [];
  for (const block of rangeBlocks) {
    const items = block.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g) || [];
    for (const item of items) {
      const nums = item.match(/<([0-9a-fA-F]+)>/g) || [];
      if (nums.length < 2) continue;
      const start = parseInt(nums[0].slice(1, -1), 16);
      const end = parseInt(nums[1].slice(1, -1), 16);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
      const arrayPart = item.match(/\[([\s\S]*?)\]/);
      if (arrayPart) {
        const values = arrayPart[1].match(/<([0-9a-fA-F]+)>/g) || [];
        for (let i = 0; i < values.length && start + i <= end; i += 1) {
          map.set(start + i, pdfHexToUnicode(values[i].slice(1, -1)));
        }
      } else if (nums.length >= 3) {
        const base = parseInt(nums[2].slice(1, -1), 16);
        for (let code = start; code <= end && code - start < 65535; code += 1) {
          map.set(code, String.fromCharCode(base + (code - start)));
        }
      }
    }
  }
  return map;
};

const PDF_LITERAL_ESCAPES = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };

const unescapePdfLiteral = (body) => {
  let out = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) break;
    if (PDF_LITERAL_ESCAPES[next] !== undefined) {
      out += PDF_LITERAL_ESCAPES[next];
      i += 1;
    } else if (/[0-7]/.test(next)) {
      const octal = body.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0];
      out += String.fromCharCode(parseInt(octal, 8));
      i += octal.length;
    } else if (next === "\n") {
      i += 1;
    } else if (next === "\r") {
      i += body[i + 2] === "\n" ? 2 : 1;
    } else {
      out += next;
      i += 1;
    }
  }
  return out;
};

const decodePdfBytes = (bytes, cmap) => {
  if (!cmap || cmap.size === 0) return latin1FromBytes(bytes);
  let twoByte = false;
  for (const key of cmap.keys()) {
    if (key > 0xff) { twoByte = true; break; }
  }
  let out = "";
  let matched = 0;
  let total = 0;
  if (twoByte) {
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      total += 1;
      const value = cmap.get(code);
      if (value !== undefined) { out += value; matched += 1; }
    }
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      total += 1;
      const value = cmap.get(bytes[i]);
      if (value !== undefined) { out += value; matched += 1; }
    }
  }
  if (total > 0 && matched / total < 0.5) {
    // CMap 和实际字码对不上（跨字体共用一份表），退回原始字节更不容易出乱码
    return latin1FromBytes(bytes);
  }
  return out;
};

const decodePdfString = (token, cmap) => {
  if (token.startsWith("<")) {
    const hex = token.slice(1, -1).replace(/\s+/g, "");
    if (!hex) return "";
    if (cmap && cmap.size > 0) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i + 1 < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      return decodePdfBytes(bytes, cmap);
    }
    return pdfHexToUnicode(hex);
  }
  const body = token.slice(1, -1);
  const raw = unescapePdfLiteral(body);
  if (cmap && cmap.size > 0) return decodePdfBytes(bytesFromLatin1(raw), cmap);
  return raw;
};

const CJK_CHAR = /[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]/;

const decodePdfContent = (content, cmap) => {
  const tokenRe = /\((?:[^\\()]|\\.)*\)|<[0-9A-Fa-f\s]*>|\bBT\b|\bET\b|\bTf\b|\bTd\b|\bTD\b|\bTm\b|\bT\*\b|\bTj\b|\bTJ\b|'|"|\[|\]|-?\d+(?:\.\d+)?|\/[^\s/<>\[\]()]+|[A-Za-z]+/g;

  let out = "";
  let pendingBreak = false;
  let pendingSpace = false;
  let pendingText = "";
  let arrayText = "";
  let arrayDepth = 0;
  let lastWasString = false;
  let numbers = [];
  let lastY = null;

  const pushRun = (text) => {
    if (!text) return;
    if (pendingBreak) {
      if (out && !out.endsWith("\n")) out += "\n";
      pendingBreak = false;
    } else if (out && !out.endsWith("\n")) {
      const prev = out[out.length - 1];
      const next = text[0];
      if (pendingSpace || (!CJK_CHAR.test(prev) && !CJK_CHAR.test(next))) out += " ";
    }
    pendingSpace = false;
    out += text;
  };

  let match;
  while ((match = tokenRe.exec(content)) !== null) {
    const token = match[0];

    if (token === "[") { arrayDepth = 1; arrayText = ""; lastWasString = false; continue; }
    if (token === "]") {
      if (arrayDepth) {
        arrayDepth = 0;
        pushRun(arrayText);
        arrayText = "";
      }
      lastWasString = false;
      continue;
    }
    if (token.startsWith("(") || token.startsWith("<")) {
      const decoded = decodePdfString(token, cmap);
      if (arrayDepth) {
        arrayText += decoded;
        lastWasString = true;
      } else {
        pendingText += decoded;
      }
      continue;
    }
    if (/^-?\d/.test(token)) {
      numbers.push(Number(token));
      if (arrayDepth && lastWasString && Number(token) < -180) arrayText += " ";
      lastWasString = false;
      continue;
    }
    if (token.startsWith("/")) { numbers = []; continue; }

    switch (token) {
      case "Tj":
      case "'":
      case '"': {
        if (pendingText) {
          pushRun(pendingText);
          pendingText = "";
        }
        break;
      }
      case "Td":
      case "TD": {
        const ty = numbers.length >= 2 ? numbers[numbers.length - 1] : 0;
        const tx = numbers.length >= 2 ? numbers[numbers.length - 2] : 0;
        if (Math.abs(ty) >= 6) pendingBreak = true;
        else if (Math.abs(ty) > 0.3 || Math.abs(tx) > 0) pendingSpace = true;
        numbers = [];
        break;
      }
      case "Tm": {
        const f = numbers.length >= 6 ? numbers[numbers.length - 1] : null;
        if (f !== null) {
          if (lastY !== null && Math.abs(f - lastY) >= 6) pendingBreak = true;
          else pendingSpace = true;
          lastY = f;
        }
        numbers = [];
        break;
      }
      case "T*":
      case "ET":
        pendingBreak = true;
        numbers = [];
        break;
      case "BT":
        numbers = [];
        break;
      default:
        numbers = [];
        break;
    }
  }

  return out;
};

const extractPdfText = async (bytes) => {
  const raw = latin1FromBytes(bytes);
  const cmap = new Map();
  const contents = [];
  const streamRe = /stream(\r\n|\r|\n)/g;
  let match;
  while ((match = streamRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, match.index - 900), match.index);
    let body = raw.slice(start, end);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    else if (body.endsWith("\n") || body.endsWith("\r")) body = body.slice(0, -1);
    streamRe.lastIndex = end + "endstream".length;

    let data = bytesFromLatin1(body);
    if (/\/FlateDecode/i.test(dict)) {
      try {
        data = await inflateBytes(data, "deflate");
      } catch {
        continue;
      }
    }
    const text = latin1FromBytes(data);
    if (text.includes("begincmap")) {
      const parsed = parsePdfToUnicode(text);
      for (const [key, value] of parsed) if (!cmap.has(key)) cmap.set(key, value);
    } else if (/\bBT\b/.test(text) && /(?:Tj|TJ)\b/.test(text)) {
      contents.push(text);
    }
  }

  const text = tidyDocText(contents.map((content) => decodePdfContent(content, cmap)).join("\n\n"))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  if (!text) throw new Error("没提取到文字（可能是扫描件或加密 PDF）");

  // 字体没有 ToUnicode 时会把 CID 当字节读，出来是乱码：宁可报错，也别把乱码喂给角色
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const noisy = (text.match(/[\u0080-\u00ff\ufffd]/g) || []).length;
  if (text.length > 60 && cjk === 0 && noisy / text.length > 0.2) {
    throw new Error("PDF 字体缺少 Unicode 映射，提取出来是乱码（多见于扫描件或老式排版，可改发截图）");
  }

  return { text, kind: "pdf" };
};

// ── PDF 页面图：JPEG 直接取；Flate 位图重建成 PNG ───────────
// 扫描件有两种常见存法：DCTDecode（整页就是一张 JPEG）、
// FlateDecode（原始 RGB/Gray 位图，zlib 压缩）。两种都要能交给 OCR。

const findPdfImageStreams = (bytes) => {
  const raw = latin1FromBytes(bytes);
  const streams = [];
  const streamRe = /stream(\r\n|\r|\n)/g;
  let match;
  while ((match = streamRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const dict = raw.slice(Math.max(0, match.index - 900), match.index);
    streamRe.lastIndex = end + "endstream".length;
    if (!/\/Subtype\s*\/Image/i.test(dict)) continue;
    let body = raw.slice(start, end);
    if (body.endsWith("\r\n")) body = body.slice(0, -2);
    else if (body.endsWith("\n") || body.endsWith("\r")) body = body.slice(0, -1);
    streams.push({ dict, data: bytesFromLatin1(body) });
  }
  return streams;
};

const dictNumber = (dict, key) => {
  const m = dict.match(new RegExp(`/${key}\\s+(\\d+)`));
  return m ? Number(m[1]) : 0;
};

const dictName = (dict, key) => {
  const m = dict.match(new RegExp(`/${key}\\s*/([A-Za-z0-9]+)`));
  return m ? m[1] : "";
};

const dictPredictor = (dict) => {
  const m = dict.match(/\/Predictor\s+(\d+)/);
  return m ? Number(m[1]) : 1;
};

const paethPredictor = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

/** 去掉 PNG 行首的 filter 字节（Predictor >= 10 的图需要） */
const unfilterPngRows = (data, rowLength, height, bpp) => {
  const out = new Uint8Array(rowLength * height);
  let prev = new Uint8Array(rowLength);
  for (let y = 0; y < height; y += 1) {
    const filter = data[y * (rowLength + 1)];
    const source = y * (rowLength + 1) + 1;
    const target = y * rowLength;
    const row = out.subarray(target, target + rowLength);
    for (let i = 0; i < rowLength; i += 1) {
      const byte = data[source + i];
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let value = byte;
      if (filter === 1) value = byte + left;
      else if (filter === 2) value = byte + up;
      else if (filter === 3) value = byte + ((left + up) >> 1);
      else if (filter === 4) value = byte + paethPredictor(left, up, upLeft);
      row[i] = value & 0xff;
    }
    prev = row;
  }
  return out;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, payload) => {
  const typeBytes = new Uint8Array([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)]);
  const body = new Uint8Array(4 + payload.length);
  body.set(typeBytes, 0);
  body.set(payload, 4);
  const out = new Uint8Array(4 + body.length + 4);
  new DataView(out.buffer).setUint32(0, payload.length);
  out.set(body, 4);
  new DataView(out.buffer).setUint32(4 + body.length, crc32(body));
  return out;
};

const deflateBytes = async (bytes) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const buildPng = async (width, height, channels, samples) => {
  const rowLength = width * channels;
  const filtered = new Uint8Array((rowLength + 1) * height);
  for (let y = 0; y < height; y += 1) {
    filtered[y * (rowLength + 1)] = 0; // filter: None
    filtered.set(samples.subarray(y * rowLength, (y + 1) * rowLength), y * (rowLength + 1) + 1);
  }
  const compressed = await deflateBytes(filtered);

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 1 ? 0 : 2; // grayscale / truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", new Uint8Array(0))];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
};

const expandOneBitSamples = (samples, width, height) => {
  const rowBytes = Math.ceil(width / 8);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = samples[y * rowBytes + (x >> 3)] || 0;
      out[y * width + x] = (byte & (0x80 >> (x & 7))) ? 255 : 0;
    }
  }
  return out;
};

const cmykToRgb = (samples, width, height) => {
  const pixels = width * height;
  const out = new Uint8Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const c = samples[i * 4];
    const m = samples[i * 4 + 1];
    const y = samples[i * 4 + 2];
    const k = samples[i * 4 + 3];
    out[i * 3] = 255 - Math.min(255, c + k);
    out[i * 3 + 1] = 255 - Math.min(255, m + k);
    out[i * 3 + 2] = 255 - Math.min(255, y + k);
  }
  return out;
};

/** 把一个图像流解码成可直接喂给 canvas / OCR 的 JPEG 或 PNG */
const decodePdfImage = async (stream) => {
  const { dict, data } = stream;
  if (/\/DCTDecode/i.test(dict)) return { mime: "image/jpeg", data };
  if (!/\/FlateDecode/i.test(dict)) throw new Error("页面图编码不支持（非 JPEG/Flate）");

  const width = dictNumber(dict, "Width");
  const height = dictNumber(dict, "Height");
  if (!width || !height) throw new Error("页面图尺寸缺失");

  const bpc = dictNumber(dict, "BitsPerComponent") || 8;
  let samples = await inflateBytes(data, "deflate");

  let channels = ({ DeviceRGB: 3, DeviceGray: 1, DeviceCMYK: 4 })[dictName(dict, "ColorSpace")] || 0;
  const predictor = dictPredictor(dict);

  if (predictor >= 10) {
    const rowLength = samples.length / height - 1;
    if (!channels) channels = Math.max(1, Math.round(rowLength / width));
    if (!Number.isFinite(rowLength) || rowLength <= 0) throw new Error("页面图行宽异常");
    samples = unfilterPngRows(samples, Math.round(rowLength), height, Math.max(1, Math.ceil((channels * bpc) / 8)));
  } else if (bpc === 1) {
    samples = expandOneBitSamples(samples, width, height);
    channels = 1;
  }

  if (!channels) {
    // 没写 ColorSpace：按数据量反推
    const perPixel = samples.length / (width * height);
    channels = perPixel >= 3.5 ? 4 : perPixel >= 2.5 ? 3 : 1;
    if (bpc === 1) channels = 1;
  }

  if (channels === 4) {
    samples = cmykToRgb(samples, width, height);
    channels = 3;
  }
  if (channels !== 1 && channels !== 3) throw new Error("页面图色彩格式不支持");

  const expected = width * height * channels;
  if (samples.length < expected) throw new Error("页面图像素数据不完整");

  const png = await buildPng(width, height, channels, samples.subarray(0, expected));
  return { mime: "image/png", data: png };
};

/** 测试与兼容用：一次性抠出所有能解码的页面图 */
const extractPdfImages = async (bytes) => {
  const images = [];
  for (const stream of findPdfImageStreams(bytes)) {
    const width = dictNumber(stream.dict, "Width");
    const height = dictNumber(stream.dict, "Height");
    if (width * height < 40000) continue; // 太小的多半是 logo/图标
    try {
      images.push(await decodePdfImage(stream));
    } catch { /* 单页解码失败不影响其它页 */ }
    if (images.length >= 40) break;
  }
  return images;
};

// ── 日志脱敏：密钥/令牌绝不能进日志或提示条（开源分发时尤其重要）──
const redactSecrets = (text) => String(text === undefined || text === null ? "" : text)
  .replace(/(client_secret|access_token|secret[_-]?key|api[_-]?key|apikey|token)=([^&\s"']+)/gi, "$1=***")
  .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1***");

// ── ZIP（docx / pptx / xlsx 的容器）──────────────────────────
const readZipEntries = async (bytes, wanted) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 66000);
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的压缩容器（ZIP）");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map();

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decodeUtf8(bytes.subarray(offset + 46, offset + 46 + nameLen));

    if (wanted(name)) {
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const chunk = bytes.subarray(dataStart, dataStart + compressedSize);
      try {
        entries.set(name, method === 0 ? chunk : await inflateBytes(chunk, "deflate-raw"));
      } catch {
        entries.set(name, new Uint8Array(0));
      }
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

const wordXmlToText = (xml) => tidyDocText(
  decodeXmlEntities(
    xml
      .replace(/<w:tab[^>]*\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, ""),
  ),
);

const extractDocxText = async (bytes) => {
  const entries = await readZipEntries(bytes, (name) => name === "word/document.xml");
  const xml = entries.get("word/document.xml");
  if (!xml || xml.length === 0) throw new Error("docx 里没有正文（word/document.xml）");
  const text = wordXmlToText(decodeUtf8(xml));
  if (!text) throw new Error("docx 里没有可读文字");
  return { text, kind: "docx" };
};

const extractPptxText = async (bytes) => {
  const entries = await readZipEntries(bytes, (name) => /^ppt\/(slides|notesSlides)\/[^/]+\.xml$/.test(name));
  const names = [...entries.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const parts = [];
  for (const name of names) {
    const xml = decodeUtf8(entries.get(name));
    const lines = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]).trim()).filter(Boolean);
    if (lines.length > 0) parts.push(lines.join("\n"));
  }
  const text = tidyDocText(parts.join("\n\n"));
  if (!text) throw new Error("pptx 里没有可读文字");
  return { text, kind: "pptx" };
};

const extractXlsxText = async (bytes) => {
  const entries = await readZipEntries(
    bytes,
    (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
  );

  // openpyxl 等工具可能用 inlineStr 而不写 sharedStrings，两种都要认
  const shared = [];
  const sharedXml = entries.get("xl/sharedStrings.xml");
  if (sharedXml && sharedXml.length > 0) {
    const xml = decodeUtf8(sharedXml);
    for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      shared.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1])).join(""));
    }
  }

  const sheetNames = [...entries.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  const rows = [];
  for (const sheet of sheetNames) {
    const xml = decodeUtf8(entries.get(sheet));
    for (const rowXml of xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || []) {
      const cells = [];
      for (const cell of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cell[1];
        const inner = cell[2];
        const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || "";
        let value = "";
        if (type === "s") {
          const index = Number((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]);
          value = shared[index] || "";
        } else if (type === "inlineStr") {
          value = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1])).join("");
        } else {
          value = decodeXmlEntities((inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "");
        }
        if (value && value.trim()) cells.push(value.trim());
      }
      if (cells.length > 0) rows.push(cells.join("\t"));
    }
  }

  const text = tidyDocText(rows.join("\n"));
  if (!text) throw new Error("xlsx 里没有可读文字（可能只有数字或公式）");
  return { text, kind: "xlsx" };
};

const extractTextFile = (bytes) => {
  let text = decodeUtf8(bytes);
  if (text.includes("\ufffd") && bytes.length > 2) {
    // UTF-8 解出替换符，多半是 GBK 老文件
    try {
      const gbk = new TextDecoder("gb18030", { fatal: false }).decode(bytes);
      if (!gbk.includes("\ufffd")) text = gbk;
    } catch { /* 环境不支持 gb18030 就保持 UTF-8 结果 */ }
  }
  const tidy = tidyDocText(text);
  if (!tidy) throw new Error("文件里没有文字");
  return { text: tidy, kind: "text" };
};

const extractDocument = async (bytes, name, mime) => {
  const kind = docKindOf(name, mime);
  if (!kind) throw new Error("这种文件类型暂不支持提取文字");
  if (kind === "legacy") throw new Error("老式 .doc/.ppt/.xls 解析不了，请另存为 docx 或 pdf 再发");
  if (kind === "pdf") return extractPdfText(bytes);
  if (kind === "docx") return extractDocxText(bytes);
  if (kind === "pptx") return extractPptxText(bytes);
  if (kind === "xlsx") return extractXlsxText(bytes);
  return extractTextFile(bytes);
};

/** 测试用出口（宿主只读 default，额外导出不影响插件加载） */
export const _internals = {
  docKindOf,
  extractDocument,
  extractPdfText,
  extractDocxText,
  extractPptxText,
  extractXlsxText,
  extractTextFile,
  parsePdfToUnicode,
  decodePdfContent,
  extractPdfImages,
  findPdfImageStreams,
  decodePdfImage,
};

export default {
  manifest: {
    id: "chat-file-sender",
    name: "发文件",
    apiVersion: 1,
    version: "1.4.0",
    author: "you",
    description: "在聊天里发送任意文件，原生文件气泡，一键保存到手机；PDF / DOCX / TXT 等文档自动解析正文，扫描件可选百度 OCR 识别。",
    permissions: ["chat.read", "chat.write", "storage", "ui"],
    settings: [
      { key: "autoReply", label: "发完文件后自动让角色回复", type: "boolean", default: true },
      { key: "multiple", label: "允许一次选多个文件（最多 5 个）", type: "boolean", default: true },
      {
        key: "readDocuments",
        label: "解析文档正文给角色看（PDF / DOCX / PPTX / XLSX / 文本）",
        type: "boolean",
        default: true,
      },
      {
        key: "docChars",
        label: "每次注入角色的文档字数",
        type: "number",
        default: 4000,
        description: "文档越长越占上下文。4000 字大约能覆盖一份 6~8 页的中文 PDF 的要点。",
      },
      {
        key: "ocrApiKey",
        label: "百度 OCR · API Key（扫描件识别用）",
        type: "text",
        default: "",
        description: "不填就不启用 OCR。在百度智能云「文字识别」控制台创建应用后获取；只存在本机插件设置里。",
      },
      {
        key: "ocrSecretKey",
        label: "百度 OCR · Secret Key",
        type: "text",
        default: "",
        description: "与 API Key 配套。注意：任何能拿到这部手机的人都能看到它。",
      },
      {
        key: "ocrMaxPages",
        label: "扫描件最多识别几页",
        type: "number",
        default: 5,
        description: "每页消耗一次百度 OCR 调用。超过页数的部分不识别。",
      },
      { key: "ocrAuto", label: "扫描件自动 OCR（不用手动触发）", type: "boolean", default: true },
      {
        key: "ocrProvider",
        label: "OCR 服务商",
        type: "select",
        default: "baidu",
        options: [
          { value: "baidu", label: "百度文字识别" },
          { value: "custom", label: "自定义 HTTP 接口" },
          { value: "off", label: "不用 OCR" },
        ],
        description: "选「自定义」可以接任何返回文字的 OCR 服务，不限于百度。",
      },
      {
        key: "ocrCustomUrl",
        label: "自定义接口地址（POST）",
        type: "text",
        default: "",
        description: "完整 URL。请求经宿主 /api/tool-proxy 转发（服务端已禁止访问内网地址）。",
      },
      {
        key: "ocrCustomHeaders",
        label: "自定义请求头（每行一个 Key: Value）",
        type: "text",
        default: "",
        description: "例如：Authorization: Bearer sk-xxxx",
      },
      {
        key: "ocrCustomBody",
        label: "请求体模板",
        type: "text",
        default: '{"image":"{{imageBase64}}","mime":"{{mime}}"}',
        description: "支持占位符 {{imageBase64}} 与 {{mime}}。默认发 JSON，可用请求头改 Content-Type。",
      },
      {
        key: "ocrCustomResultPath",
        label: "结果文本路径",
        type: "text",
        default: "",
        description: "例如 data.text 或 result.0.words；留空则把整个响应当纯文本。",
      },
      {
        key: "maxInlineMB",
        label: "媒体库不可用时的内联上限（MB）",
        type: "number",
        default: 4,
        description: "正常情况下文件会写进 App 自己的媒体库，不占聊天记录。只有在媒体库不可用时才会把文件内联进消息，超过这个体积就拒绝发送。",
      },
      { key: "showHelp", label: "在「+」面板里显示使用说明入口", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    // ── 小工具 ──────────────────────────────────────────────
    const notify = (text) => {
      try { ctx.ui.toast(text); } catch { /* 提示失败不影响主流程 */ }
    };
    const log = (...args) => {
      try { ctx.system.log("[chat-file-sender]", ...args.map((item) => (typeof item === "string" ? redactSecrets(item) : item))); } catch { /* ignore */ }
    };
    const setting = (key, fallback) => {
      try {
        const value = ctx.system.settings.get(key);
        return value === undefined || value === null ? fallback : value;
      } catch {
        return fallback;
      }
    };

    const categoryOf = (file) => {
      const type = String((file && file.type) || "").toLowerCase();
      if (type.startsWith("image/")) return "image";
      if (type.startsWith("audio/")) return "audio";
      if (type.startsWith("video/")) return "video";
      return "file";
    };

    const sizeText = (bytes) => {
      const n = Number(bytes) || 0;
      if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
      if (n >= 1024) return `${Math.round(n / 1024)} KB`;
      return `${n} B`;
    };

    // ── IndexedDB：宿主媒体库（只读写既有库，绝不擅自改版本）──
    const openIdb = (version) => new Promise((resolve, reject) => {
      let request;
      try {
        request = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
      } catch (err) {
        reject(err);
        return;
      }
      request.onupgradeneeded = () => {
        // 只有库不存在时才会走到这里：建出与宿主 Dexie v1 完全一致的 schema，
        // 避免之后 Dexie 打开时因版本/结构不符报错。
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
            store.createIndex("createdAt", "createdAt");
          }
        } catch (err) {
          log("建库失败", err && err.message ? err.message : err);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("打开媒体库失败"));
      request.onblocked = () => reject(new Error("媒体库被其它页面占用"));
    });

    const hostDbExists = async () => {
      try {
        if (typeof indexedDB === "undefined") return false;
        // 不支持 databases() 时宁可不写：盲开 open(name) 会在库不存在时创建一个空库，
        // 之后宿主 Dexie 打开就会炸，代价远大于"这次发不了大文件"。
        if (typeof indexedDB.databases !== "function") return false;
        const list = await indexedDB.databases();
        return Array.isArray(list) && list.some((entry) => entry && entry.name === DB_NAME);
      } catch {
        return false;
      }
    };

    const storeInHostMedia = async (file) => {
      if (!(await hostDbExists())) return null;
      let db = null;
      try {
        db = await openIdb(undefined);
        if (!db.objectStoreNames || !db.objectStoreNames.contains(DB_STORE)) return null;

        const id = `mc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const record = {
          id,
          blob: file,
          mimeType: file.type || "application/octet-stream",
          mediaCategory: categoryOf(file),
          createdAt: Date.now(),
        };

        const written = await new Promise((resolve) => {
          let tx;
          try { tx = db.transaction(DB_STORE, "readwrite"); } catch { resolve(false); return; }
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
          try { tx.objectStore(DB_STORE).put(record); } catch { resolve(false); }
        });
        if (!written) return null;

        // 读回校验：确认宿主后续 loadMediaBlob 能拿到这条（不是写了个孤儿记录）
        const verified = await new Promise((resolve) => {
          let tx;
          try { tx = db.transaction(DB_STORE, "readonly"); } catch { resolve(false); return; }
          let stored = null;
          const request = tx.objectStore(DB_STORE).get(id);
          request.onsuccess = () => { stored = request.result; };
          tx.oncomplete = () => resolve(Boolean(stored && stored.blob));
          tx.onerror = () => resolve(false);
        });

        return verified ? REF_PREFIX + id : null;
      } catch (err) {
        log("写入媒体库失败", err && err.message ? err.message : err);
        return null;
      } finally {
        try { if (db) db.close(); } catch { /* ignore */ }
      }
    };

    // ── 兜底：内联 data URL（仅在媒体库不可用时）────────────
    const fileToDataURL = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("读取文件内容失败"));
      reader.readAsDataURL(file);
    });

    const inlineLimitBytes = () => {
      const mb = Number(setting("maxInlineMB", 4));
      return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : 0;
    };

    // ── 发消息 ──────────────────────────────────────────────
    let currentSessionId = null;

    const pushFileMessage = (sessionId, file, mediaUrl) => {
      const fileName = file.name || "文件";
      const fileType = categoryOf(file);
      return ctx.data.messages.push({
        sessionId,
        role: "user",
        // content 是给模型看的文本（文件气泡不显示它，显示的是 fileName）
        content: `[文件] ${fileName}（${sizeText(file.size)}）`,
        mediaType: "media_file",
        mediaUrl,
        mediaData: {
          fileType,
          fileName,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        },
      });
    };

    // ── 文档解析：把 PDF / DOCX 等的正文留给角色 ────────────
    const MAX_DOC_BYTES = 30 * 1024 * 1024;
    const DOC_WAIT_MS = 6000;
    const docKey = (messageId) => `doc:${messageId}`;
    const docInflight = new Map();

    const readDoc = (messageId) => {
      try {
        const value = ctx.system.storage.get(docKey(messageId));
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    };

    const writeDoc = (messageId, record) => {
      try {
        ctx.system.storage.set(docKey(messageId), record);
      } catch (err) {
        log("文档缓存写入失败", err && err.message ? err.message : err);
      }
    };

    const bytesOf = async (source) => {
      if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
      if (source instanceof ArrayBuffer) return new Uint8Array(source);
      throw new Error("拿不到文件内容");
    };

    // ── 百度 OCR：扫描件没有文字层时的兜底 ──────────────────
    const BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
    const BAIDU_OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic";
    const OCR_TOKEN_KEY = "ocr:baidu-token";

    const readCache = (key) => {
      try {
        const value = ctx.system.storage.get(key);
        return value && typeof value === "object" ? value : null;
      } catch {
        return null;
      }
    };
    const writeCache = (key, value) => {
      try {
        ctx.system.storage.set(key, value);
      } catch { /* ignore */ }
    };

    const ocrCredentials = () => ({
      apiKey: String(setting("ocrApiKey", "") || "").trim(),
      secretKey: String(setting("ocrSecretKey", "") || "").trim(),
    });
    const ocrProvider = () => {
      const raw = String(setting("ocrProvider", "baidu") || "baidu");
      if (raw === "custom") return "custom";
      if (raw === "off") return "off";
      return "baidu";
    };
    const ocrEnabled = () => {
      const provider = ocrProvider();
      if (provider === "custom") return Boolean(String(setting("ocrCustomUrl", "") || "").trim());
      if (provider === "baidu") {
        const { apiKey, secretKey } = ocrCredentials();
        return Boolean(apiKey && secretKey);
      }
      return false;
    };

    /** 浏览器直连百度必被 CORS 拦，统一走宿主的服务端代理 */
    const proxyRequest = async ({ url, method = "POST", headers, body, timeoutMs = 20000 }) => {
      const res = await ctx.system.fetch("/api/tool-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, headers, body, timeoutMs }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(redactSecrets(`代理请求失败（HTTP ${res.status}）：${String(text).slice(0, 120)}`));
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(redactSecrets(`代理返回不是 JSON：${String(text).slice(0, 120)}`));
      }
    };

    const getBaiduToken = async (force = false) => {
      const { apiKey, secretKey } = ocrCredentials();
      if (!apiKey || !secretKey) throw new Error("没有配置百度 OCR 的 Key");
      const cached = readCache(OCR_TOKEN_KEY);
      const now = Date.now();
      if (!force && cached && Number(cached.expiresAt) > now + 5 * 60 * 1000) return cached.token;

      const url = `${BAIDU_TOKEN_URL}?grant_type=client_credentials`
        + `&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;
      const data = await proxyRequest({ url, method: "GET" });
      if (!data || !data.access_token) {
        const detail = data && (data.error_description || data.error) ? `：${data.error_description || data.error}` : "";
        throw new Error(`百度鉴权失败${detail}`);
      }
      const ttl = Number(data.expires_in) > 0 ? Number(data.expires_in) * 1000 : 30 * 24 * 3600 * 1000;
      writeCache(OCR_TOKEN_KEY, { token: data.access_token, expiresAt: now + ttl });
      return data.access_token;
    };

    const baiduErrorText = (data) => {
      const code = Number(data && data.error_code);
      const known = {
        17: "免费额度用完了（错误码 17）",
        18: "请求太频繁，触发 QPS 限制（错误码 18）",
        110: "access_token 无效，检查 Key 是否填对（错误码 110）",
        111: "access_token 过期（错误码 111）",
        216015: "这个应用没开通「通用文字识别」接口（错误码 216015）",
        282000: "百度服务内部错误，过会儿再试（错误码 282000）",
      };
      return known[code] || `百度 OCR 失败：${(data && data.error_msg) || "未知错误"}（错误码 ${code}）`;
    };

    const baiduOcrOnce = async (base64, token) => {
      const body = new URLSearchParams({
        image: base64,
        language_type: "CHN_ENG",
        detect_direction: "true",
        paragraph: "true",
      }).toString();
      return proxyRequest({
        url: `${BAIDU_OCR_URL}?access_token=${encodeURIComponent(token)}`,
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    };

    const baiduOcrImage = async (base64) => {
      let token = await getBaiduToken();
      let data = await baiduOcrOnce(base64, token);
      const code = Number(data && data.error_code);
      if (code === 110 || code === 111) {
        token = await getBaiduToken(true); // token 失效：强刷一次再试
        data = await baiduOcrOnce(base64, token);
      }
      if (data && data.error_code) throw new Error(baiduErrorText(data));
      return (data.words_result || [])
        .map((item) => (item && item.words) || "")
        .filter(Boolean)
        .join("\n");
    };

    // ── 自定义 HTTP OCR（开源友好：谁都能接自己的服务）──────
    const proxyRaw = async ({ url, method = "POST", headers, body, timeoutMs = 30000 }) => {
      const res = await ctx.system.fetch("/api/tool-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, headers, body, timeoutMs }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(redactSecrets(`OCR 接口返回 HTTP ${res.status}：${String(text).slice(0, 160)}`));
      return text;
    };

    const pickByPath = (value, path) => {
      let current = value;
      for (const part of String(path || "").split(".")) {
        const key = part.trim();
        if (!key) continue;
        if (current === undefined || current === null) return undefined;
        current = Array.isArray(current) && /^\d+$/.test(key) ? current[Number(key)] : current[key];
      }
      return current;
    };

    const textFromOcrValue = (value) => {
      if (value === undefined || value === null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (Array.isArray(value)) return value.map(textFromOcrValue).filter(Boolean).join("\n");
      if (typeof value === "object") {
        for (const key of ["text", "words", "content", "result", "data"]) {
          if (value[key] !== undefined) {
            const nested = textFromOcrValue(value[key]);
            if (nested) return nested;
          }
        }
        return JSON.stringify(value);
      }
      return "";
    };

    const customOcrImage = async (base64, mime) => {
      const url = String(setting("ocrCustomUrl", "") || "").trim();
      if (!url) throw new Error("没配置自定义 OCR 接口地址");

      const headers = {};
      for (const line of String(setting("ocrCustomHeaders", "") || "").split(/\r?\n/)) {
        const index = line.indexOf(":");
        if (index > 0) headers[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      }
      if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }

      const template = String(setting("ocrCustomBody", "") || "") || '{"image":"{{imageBase64}}","mime":"{{mime}}"}';
      const body = template
        .replace(/\{\{\s*imageBase64\s*\}\}/g, base64)
        .replace(/\{\{\s*mime\s*\}\}/g, mime);

      const text = await proxyRaw({ url, headers, body });
      const path = String(setting("ocrCustomResultPath", "") || "").trim();
      if (!path) return text.trim();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("接口返回不是 JSON，但设置里填了结果路径");
      }
      return textFromOcrValue(pickByPath(data, path)).trim();
    };

    const ocrImageText = async (base64, mime) => (
      ocrProvider() === "custom" ? customOcrImage(base64, mime) : baiduOcrImage(base64)
    );

    // ── 首次上传确认（隐私：必须让用户明确知道图片要传给第三方）──
    const consentKey = (provider) => `ocr:consent:v1:${provider}`;
    const ocrConsented = (provider) => Boolean(readCache(consentKey(provider)));

    const providerLabel = () => {
      if (ocrProvider() !== "custom") return "百度文字识别";
      try {
        return `自定义接口（${new URL(String(setting("ocrCustomUrl", "") || "")).hostname}）`;
      } catch {
        return "自定义接口";
      }
    };

    const askOcrConsent = ({ pages, name }) => new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      // 兜底：用户点遮罩关掉弹窗时不会回调，60 秒后按"不同意"处理
      ctx.system.timers.setTimeout(() => finish(false), 60000);
      try {
        ctx.ui.openModal((root, api) => {
          root.classList.add("cfs-modal");

          const title = document.createElement("h3");
          title.textContent = "要把文件图片传给 OCR 服务吗？";

          const desc = document.createElement("p");
          desc.textContent = `「${name}」没有文字层，需要把前 ${pages} 页的图片上传到「${providerLabel()}」识别成文字，每页消耗 1 次调用。`;

          const list = document.createElement("ul");
          for (const line of [
            "只上传压缩后的页面图，不上传原始 PDF",
            "识别出的文字会作为资料交给角色阅读",
            "同意一次后不再询问（删除插件数据可重置）",
            "不想上传也行：把关键页截图发给角色，它能直接看图",
          ]) {
            const item = document.createElement("li");
            item.textContent = line;
            list.appendChild(item);
          }

          const row = document.createElement("div");
          row.className = "cfs-row";
          const cancel = document.createElement("button");
          cancel.type = "button";
          cancel.textContent = "不上传";
          cancel.addEventListener("click", () => { finish(false); api.close(); });
          const agree = document.createElement("button");
          agree.type = "button";
          agree.textContent = "同意并识别";
          agree.addEventListener("click", () => { finish(true); api.close(); });
          row.append(cancel, agree);

          root.append(title, desc, list, row);
        });
      } catch (err) {
        log("OCR 确认弹窗失败", err && err.message ? err.message : err);
        finish(false);
      }
    });

    const bytesToBase64 = (bytes) => {
      let binary = "";
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
      }
      return btoa(binary);
    };

    /** 压到 1600px / JPEG 0.8，控制 base64 体积（百度上限 4MB） */
    const toOcrBase64 = async (bytes, mime) => {
      const raw = bytesToBase64(bytes);
      try {
        if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
          const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
          const width = bitmap.width || 1;
          const height = bitmap.height || 1;
          const scale = Math.min(1, 1600 / Math.max(width, height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext ? canvas.getContext("2d") : null;
          if (context) {
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const dataUrl = String(canvas.toDataURL("image/jpeg", 0.8) || "");
            const comma = dataUrl.indexOf(",");
            if (comma > 0) {
              const encoded = dataUrl.slice(comma + 1);
              if (encoded.length < raw.length) return encoded;
            }
          }
        }
      } catch { /* 压缩失败就用原图 */ }
      if (raw.length > 3.8 * 1024 * 1024) throw new Error("页面图太大（base64 超过 4MB），没法送 OCR");
      return raw;
    };

    const ocrPdfPages = async (bytes) => {
      const limit = Math.max(1, Math.min(20, Number(setting("ocrMaxPages", 5)) || 5));
      const streams = findPdfImageStreams(bytes).filter((stream) => {
        const width = dictNumber(stream.dict, "Width");
        const height = dictNumber(stream.dict, "Height");
        return width * height >= 40000;
      });
      if (streams.length === 0) throw new Error("这个 PDF 里没有可用的页面图（可能不是扫描件），请截图发我");

      const target = streams.slice(0, limit);
      const busy = ctx.ui.toast(`正在用百度 OCR 识别 ${target.length} 页…`, { durationMs: 0 });
      const pages = [];
      try {
        for (let index = 0; index < target.length; index += 1) {
          let image;
          try {
            image = await decodePdfImage(target[index]);
          } catch (err) {
            pages.push(`第 ${index + 1} 页\n（这一页的图解不开：${err && err.message ? err.message : err}）`);
            continue;
          }
          const base64 = await toOcrBase64(image.data, image.mime);
          const text = await ocrImageText(base64, image.mime);
          pages.push(`第 ${index + 1} 页\n${text || "（这一页没认出字）"}`);
        }
      } finally {
        busy.close();
      }

      const merged = tidyDocText(pages.join("\n\n"));
      if (!merged) throw new Error("OCR 没认出文字（图片可能太模糊）");
      return { text: merged, pages: target.length };
    };

    const prepareDocument = (message, file, options = {}) => {
      if (!message || !message.id) return Promise.resolve(null);
      if (setting("readDocuments", true) === false) return Promise.resolve(null);
      const name = message.mediaData?.fileName || String(message.content || "").replace(/^\[文件\]\s*/, "");
      const mime = message.mediaData?.mimeType || "";
      const kind = docKindOf(name, mime);
      if (!kind) return Promise.resolve(null);
      const cached = readDoc(message.id);
      if (cached) return Promise.resolve(cached);
      const running = docInflight.get(message.id);
      if (running) return running;

      const base = { name, mime, at: Date.now() };
      const task = (async () => {
        let bytes = null;
        try {
          if (file) {
            bytes = await bytesOf(file);
          } else {
            const media = await ctx.data.messages.resolveMedia(message);
            if (!media || !media.blob) throw new Error("取不到文件字节");
            bytes = await bytesOf(media.blob);
          }
          if (bytes.length > MAX_DOC_BYTES) {
            throw new Error(`文件超过 ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB，未解析`);
          }
          const result = await extractDocument(bytes, name, mime);
          const record = { ...base, ok: true, text: result.text, chars: result.text.length, kind: result.kind };
          writeDoc(message.id, record);
          if (message.sessionId) {
            const list = ctx.data.messages.list(message.sessionId) || [];
            const index = list.findIndex((item) => item && item.id === message.id);
            if (index >= 0 && index >= list.length - 3) {
              notify(`已解析「${name}」${result.text.length} 字，角色可以读到了`);
            }
          }
          return record;
        } catch (err) {
          let reason = err && err.message ? err.message : String(err);

          // 扫描件：没有文字层，改用 OCR 认字（需要用户配好服务并同意上传）
          if (kind === "pdf" && bytes && ocrEnabled() && setting("ocrAuto", true) !== false) {
            const provider = ocrProvider();
            let allowed = ocrConsented(provider);

            if (!allowed && options.interactive) {
              const pages = Math.max(1, Math.min(20, Number(setting("ocrMaxPages", 5)) || 5));
              allowed = await askOcrConsent({ pages, name });
              if (allowed) writeCache(consentKey(provider), { at: Date.now(), provider });
            }

            if (!allowed) {
              reason = `${reason}；没有做 OCR（首次使用需要确认上传：长按这条文件消息选「重新解析文件」）`;
            } else {
              try {
                const ocr = await ocrPdfPages(bytes);
                const record = {
                  ...base,
                  ok: true,
                  ocr: true,
                  kind,
                  text: ocr.text,
                  chars: ocr.text.length,
                  pages: ocr.pages,
                };
                writeDoc(message.id, record);
                notify(`OCR 识别了 ${ocr.pages} 页，角色可以读到了`);
                return record;
              } catch (ocrErr) {
                const ocrReason = ocrErr && ocrErr.message ? ocrErr.message : String(ocrErr);
                reason = `${reason}；OCR：${ocrReason}`;
                log("OCR 失败", ocrReason);
              }
            }
          }

          const record = { ...base, ok: false, error: redactSecrets(reason) };
          writeDoc(message.id, record);
          log("文档解析失败", name, reason);
          return record;
        }
      })();

      docInflight.set(message.id, task);
      task.then(() => docInflight.delete(message.id), () => docInflight.delete(message.id));
      return task;
    };

    /** 宿主给"别的 App 往聊天里插消息"准备的刷新通道，否则界面要等下次重绘才出现 */
    const refreshChat = (sessionId) => {
      try {
        window.dispatchEvent(new CustomEvent("chat-messages-updated", { detail: { sessionId } }));
      } catch (err) {
        log("刷新聊天失败", err && err.message ? err.message : err);
      }
    };

    /** 请求角色对最后一条用户消息作答；返回宿主是否接住了这个请求 */
    const askReply = (sessionId) => {
      try {
        const event = new CustomEvent("chat-request-reply", { detail: { sessionId } });
        window.dispatchEvent(event);
        return Boolean(event.detail && event.detail.handled);
      } catch {
        return false;
      }
    };

    const resolveMediaUrlFor = async (file, failures) => {
      const ref = await storeInHostMedia(file);
      if (ref) return ref;

      const limit = inlineLimitBytes();
      if (limit > 0 && file.size <= limit) {
        try {
          return await fileToDataURL(file);
        } catch (err) {
          log("内联文件失败", err && err.message ? err.message : err);
        }
      }
      failures.push(file.size > limit
        ? `「${file.name}」${sizeText(file.size)} 超过内联上限 ${Math.round(limit / 1024 / 1024)} MB，未发送`
        : `「${file.name}」发送失败`);
      return null;
    };

    const sendFiles = async (files) => {
      const sessionId = currentSessionId;
      if (!sessionId) {
        notify("还没进入聊天，先打开一个会话");
        return;
      }
      const list = Array.from(files || []).filter(Boolean).slice(0, MAX_FILES);
      if (!list.length) return;

      const busy = ctx.ui.toast(
        list.length > 1 ? `正在发送 ${list.length} 个文件…` : `正在发送「${list[0].name}」…`,
        { durationMs: 0 },
      );

      let sent = 0;
      const failures = [];
      try {
        for (const file of list) {
          if (file.size > MAX_FILE_MB * 1024 * 1024) {
            failures.push(`「${file.name}」超过 ${MAX_FILE_MB} MB，手机上发送容易失败`);
            continue;
          }
          const mediaUrl = await resolveMediaUrlFor(file, failures);
          if (!mediaUrl) continue;
          try {
            const message = pushFileMessage(sessionId, file, mediaUrl);
            sent += 1;
            if (message) void prepareDocument(message, file, { interactive: true });
          } catch (err) {
            log("写入消息失败", err && err.message ? err.message : err);
            failures.push(`「${file.name}」写入聊天失败`);
          }
        }
      } finally {
        busy.close();
      }

      if (sent > 0) {
        refreshChat(sessionId);
        notify(sent > 1 ? `已发送 ${sent} 个文件` : "文件已发送");
        if (setting("autoReply", true) !== false) {
          ctx.system.timers.setTimeout(() => {
            if (!askReply(sessionId)) notify("文件已发送。对方没反应的话，点一下输入栏右侧的生成按钮");
          }, 120);
        }
      }
      if (failures.length > 0) {
        log("发送失败", failures.join("；"));
        notify(failures[0]);
      }
    };

    // ── 文件选择器 ──────────────────────────────────────────
    const openPicker = () => {
      if (!currentSessionId) {
        notify("还没进入聊天，先打开一个会话");
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = setting("multiple", true) !== false;
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "0";
      input.style.opacity = "0";
      input.setAttribute("aria-hidden", "true");

      const cleanup = () => { try { input.remove(); } catch { /* ignore */ } };

      input.addEventListener("change", () => {
        const files = input.files ? Array.from(input.files) : [];
        cleanup();
        if (files.length) void sendFiles(files);
      }, { once: true });
      // 用户取消选择：部分 WebView 只发 cancel，不发 change
      input.addEventListener("cancel", cleanup, { once: true });

      document.body.appendChild(input);
      try {
        input.click();
      } catch (err) {
        cleanup();
        notify("打不开文件选择器");
        log("input.click 失败", err && err.message ? err.message : err);
        return;
      }
      // 兜底：某些系统里取消选择不会触发任何事件，5 分钟后清掉隐藏节点
      ctx.system.timers.setTimeout(cleanup, 5 * 60 * 1000);
    };

    const showHelp = () => {
      try {
        ctx.ui.openModal((root, api) => {
          root.classList.add("cfs-modal");
          const title = document.createElement("h3");
          title.textContent = "📎 发文件怎么用";
          const p = document.createElement("p");
          p.textContent = "点「+」→「文件」，从手机里挑任意文件发送。文件会出现在聊天里，和角色自己发的文件是同一种气泡，右侧按钮可保存到「下载」目录。";
          const ul = document.createElement("ul");
          for (const line of [
            "图片会一起发给模型看（走宿主的视觉通道）",
            "PDF / DOCX / PPTX / XLSX / 文本会自动解析正文，角色能读到内容",
            "扫描件没有文字层：配好 OCR 服务并同意上传后才会识别",
            "首次识别前会弹框确认：把哪几页图片、传给谁；拒绝就不上传",
            "配好服务后，长按旧文件消息选「重新解析文件」即可补识别",
            "默认发完自动让角色回复，可在插件设置里关掉",
            "一次最多 5 个文件",
          ]) {
            const li = document.createElement("li");
            li.textContent = line;
            ul.appendChild(li);
          }
          const close = document.createElement("button");
          close.type = "button";
          close.textContent = "知道了";
          close.addEventListener("click", () => api.close());
          root.append(title, p, ul, close);
        });
      } catch (err) {
        notify("打不开说明");
        log("openModal 失败", err && err.message ? err.message : err);
      }
    };

    // ── 注册 ────────────────────────────────────────────────
    ctx.ui.injectCSS(CSS);

    // 借 chat.header 坑位拿 sessionId（inputToolbar 的 props 不含 sessionId）。
    // 这个容器本身渲染为空，不占位。
    const offHeader = ctx.ui.slot("chat.header", (el, props) => {
      el.style.display = "none";
      // 连宿主的包装节点一起藏掉，避免空容器在标题栏下方撑出一条缝
      try {
        if (el.parentElement) el.parentElement.style.display = "none";
      } catch { /* ignore */ }
      if (props && props.sessionId) currentSessionId = props.sessionId;
    });

    // 兜底：切会话时同步一次
    const offOpened = ctx.hooks.on("session.opened", (payload) => {
      if (payload && payload.sessionId) currentSessionId = payload.sessionId;
    });

    const offToolbar = ctx.ui.slot("chat.inputToolbar", (el) => {
      el.textContent = "";
      const row = document.createElement("div");
      row.className = "cfs-row";

      const item = document.createElement("div");
      item.className = "cfs-item chat-plus-menu-item";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("title", "发送文件");

      const iconBox = document.createElement("div");
      iconBox.className = "chat-plus-icon-box";
      iconBox.innerHTML = PAPERCLIP_SVG;

      const label = document.createElement("span");
      label.className = "ts-11";
      label.textContent = "文件";

      item.append(iconBox, label);

      const activate = () => openPicker();
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });

      row.appendChild(item);

      if (setting("showHelp", true) !== false) {
        const help = document.createElement("div");
        help.className = "cfs-item chat-plus-menu-item";
        help.setAttribute("role", "button");
        help.setAttribute("tabindex", "0");
        help.setAttribute("title", "发文件说明");
        const helpIcon = document.createElement("div");
        helpIcon.className = "chat-plus-icon-box";
        helpIcon.textContent = "?";
        const helpLabel = document.createElement("span");
        helpLabel.className = "ts-11";
        helpLabel.textContent = "说明";
        help.append(helpIcon, helpLabel);
        help.addEventListener("click", showHelp);
        row.appendChild(help);
      }

      el.appendChild(row);
      return () => { el.textContent = ""; };
    });

    // 旧文件也能重新解析（比如刚配好 OCR Key 之后）
    ctx.ui.messageAction({
      id: "chat-file-sender.reparse",
      label: "📄 重新解析文件",
      filter: (msg) => Boolean(msg)
        && msg.role === "user"
        && msg.mediaType === "media_file"
        && Boolean(docKindOf(msg.mediaData?.fileName || "", msg.mediaData?.mimeType || "")),
      onSelect: async (msg, helpers) => {
        try {
          ctx.system.storage.remove(docKey(msg.id));
        } catch { /* ignore */ }
        const record = await prepareDocument(msg, null, { interactive: true });
        helpers.toast(record && record.ok
          ? `已解析 ${record.chars} 字${record.ocr ? "（OCR）" : ""}`
          : ((record && record.error) || "解析失败"));
      },
    });

    // ── 把文档正文交给模型（角色才读得到 PDF）────────────
    ctx.hooks.transform("llm.request", async (payload) => {
      if (setting("readDocuments", true) === false) return payload;
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      if (messages.length === 0 || !payload.sessionId) return payload;

      let list = [];
      try {
        list = ctx.data.messages.list(payload.sessionId) || [];
      } catch {
        return payload;
      }
      const recent = Array.isArray(list) ? list.slice(-8) : [];
      if (recent.length === 0) return payload;

      const perDoc = Math.max(600, Number(setting("docChars", 4000)) || 4000);
      const blocks = [];
      let budget = Math.min(6000, perDoc * 2);

      for (const item of recent) {
        if (!item || item.role !== "user" || item.mediaType !== "media_file") continue;
        const name = item.mediaData?.fileName || "文件";
        if (!docKindOf(name, item.mediaData?.mimeType || "")) continue;

        let record = readDoc(item.id);
        if (!record) {
          record = await Promise.race([
            prepareDocument(item),
            new Promise((resolve) => { setTimeout(() => resolve(null), DOC_WAIT_MS); }),
          ]);
        }
        if (!record) continue;

        const cap = Math.min(perDoc, budget);
        if (cap < 200) break;
        budget -= cap;
        if (record.ok) {
          blocks.push(`【用户发来的文件】${name}\n（已提取 ${record.chars} 字，以下是节选）\n${String(record.text || "").slice(0, cap)}`);
        } else {
          blocks.push(`【用户发来的文件】${name}\n解析失败：${record.error}。不要假装看过里面的内容，也不要说"我收不到文件"，可以请对方说下重点，或把关键页截图发来。`);
        }
      }

      if (blocks.length === 0) return payload;

      const note = {
        role: "system",
        content: `用户发来了文件，下面是从文件里提取的文字。可以据此回答，但不要逐字复述，也不要声称自己"打不开文件"：\n\n${blocks.join("\n\n---\n\n")}`,
      };
      messages.splice(Math.max(0, messages.length - 1), 0, note);
      return payload;
    }, { priority: 90, timeoutMs: 25000 });

    return () => {
      void offHeader;
      void offOpened;
      void offToolbar;
    };
  },
};
