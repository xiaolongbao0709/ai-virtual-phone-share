const PLUGIN_ID = "float-bubble-format-converter";

const FORMATS = {
  CUSTOM: "float-custom-bubbles",
  MANAGER: "float-bubble/1",
};

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function cleanName(value, fallback = "气泡") {
  return String(value || fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || fallback;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function dataUrlToBytes(dataUrl) {
  const source = String(dataUrl || "");
  const comma = source.indexOf(",");
  if (comma < 0 || !source.startsWith("data:")) throw new Error("素材不是有效的 dataURL");
  const meta = source.slice(0, comma);
  const payload = source.slice(comma + 1);
  const mime = (meta.match(/^data:([^;,]+)/i) || [])[1] || "application/octet-stream";
  if (/;base64/i.test(meta)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mime };
}

function bytesToDataUrl(bytes, mime) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mime || "application/octet-stream"};base64,${btoa(binary)}`;
}

async function sourceToBytes(source) {
  if (String(source || "").startsWith("data:")) return dataUrlToBytes(source);
  if (!/^https?:\/\//i.test(String(source || ""))) throw new Error("气泡包包含无法识别的图片地址");
  let response;
  try { response = await fetch(source); } catch (_) { throw new Error("远程图片下载失败（可能被跨域限制）"); }
  if (!response.ok) throw new Error(`远程图片下载失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || "image/png" };
}

function extensionForMime(mime, fallback = "png") {
  const value = String(mime || "").toLowerCase();
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("woff2")) return "woff2";
  if (value.includes("woff")) return "woff";
  if (value.includes("opentype") || value.includes("otf")) return "otf";
  if (value.includes("truetype") || value.includes("ttf")) return "ttf";
  return fallback;
}

function mimeFromPath(path) {
  const value = String(path || "").toLowerCase();
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".gif")) return "image/gif";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".woff2")) return "font/woff2";
  if (value.endsWith(".woff")) return "font/woff";
  if (value.endsWith(".otf")) return "font/otf";
  if (value.endsWith(".ttf")) return "font/ttf";
  return "image/png";
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function makeZip(files) {
  const encoder = new TextEncoder();
  const body = [];
  const central = [];
  const stamp = dosTime();
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const local = new Uint8Array(30);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, stamp.time, true); lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    const head = new Uint8Array(46);
    const hv = new DataView(head.buffer);
    hv.setUint32(0, 0x02014b50, true); hv.setUint16(4, 20, true); hv.setUint16(6, 20, true);
    hv.setUint16(8, 0x0800, true); hv.setUint16(10, 0, true); hv.setUint16(12, stamp.time, true);
    hv.setUint16(14, stamp.date, true); hv.setUint32(16, crc, true); hv.setUint32(20, data.length, true);
    hv.setUint32(24, data.length, true); hv.setUint16(28, name.length, true); hv.setUint32(42, offset, true);
    body.push(local, name, data); central.push(head, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...body, ...central, end], { type: "application/zip" });
}

async function unzipEntries(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { endOffset = i; break; }
  }
  if (endOffset < 0) throw new Error("不是有效的 ZIP 文件");
  const count = view.getUint16(endOffset + 10, true);
  let cursor = view.getUint32(endOffset + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("ZIP 目录损坏");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("ZIP 文件项损坏");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8 && typeof DecompressionStream === "function") {
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error("当前浏览器不支持这个 ZIP 的压缩方式");
    entries.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function imageSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = dataUrl;
  });
}

function sideMainLayer(side) {
  const layers = Array.isArray(side && side.layers) ? side.layers : [];
  const stretch = layers.find((layer) => (layer.mode || "anchor") === "stretch" && Number.isInteger(Number(layer.img)));
  if (stretch) return { layer: stretch, ignored: Math.max(0, layers.length - 1), fallback: false };
  const baseIndex = side && side.base != null ? Number(side.base) : NaN;
  if (Number.isInteger(baseIndex)) {
    return { layer: { img: baseIndex, mode: "stretch", slice: side.slice }, ignored: layers.length, fallback: false };
  }
  const first = layers.find((layer) => Number.isInteger(Number(layer.img)));
  return first ? { layer: first, ignored: Math.max(0, layers.length - 1), fallback: true } : null;
}

async function managerToCustom(pkg) {
  if (!pkg || pkg.format !== FORMATS.MANAGER || !Array.isArray(pkg.images)) {
    throw new Error("不是聊天页面美化管理器导出的气泡 JSON");
  }
  const groupId = uid("converted-group");
  const groupName = cleanName(pkg.name || "转换气泡");
  const config = {
    packageType: FORMATS.CUSTOM,
    packageVersion: 1,
    groups: { [groupId]: { id: groupId, name: groupName } },
    skins: {}, userSkinId: "", characterBindings: {},
  };
  const files = [];
  const warnings = [];
  const cache = new Map();
  for (const role of ["assistant", "user"]) {
    const side = pkg[role] || {};
    const picked = sideMainLayer(side);
    if (!picked) { warnings.push(`${role === "assistant" ? "对方" : "我方"}没有可转换的图片层`); continue; }
    const imageIndex = Number(picked.layer.img);
    const source = pkg.images[imageIndex];
    if (!source) { warnings.push(`${role === "assistant" ? "对方" : "我方"}引用的图片不存在`); continue; }
    let asset = cache.get(imageIndex);
    if (!asset) {
      const raw = await sourceToBytes(source);
      const dataUrl = bytesToDataUrl(raw.bytes, raw.mime);
      const dimensions = await imageSize(dataUrl);
      asset = { ...raw, ...dimensions };
      cache.set(imageIndex, asset);
    }
    const scale = clampNumber(side.scale != null ? side.scale : pkg.scale, 0.54, 0.05, 2);
    const defaultSlice = [
      Math.round(asset.width * 0.3), Math.round(asset.height * 0.3),
      Math.round(asset.width * 0.3), Math.round(asset.height * 0.3),
    ];
    const sl = Array.isArray(picked.layer.slice) ? picked.layer.slice
      : Array.isArray(side.slice) ? side.slice
      : Array.isArray(pkg.slice) ? pkg.slice : defaultSlice;
    const slice = {
      top: clampNumber(sl[1], 20, 0, asset.height || 9999),
      right: clampNumber(sl[2], 20, 0, asset.width || 9999),
      bottom: clampNumber(sl[3], 20, 0, asset.height || 9999),
      left: clampNumber(sl[0], 20, 0, asset.width || 9999),
    };
    const content = Array.isArray(side.content) ? side.content : Array.isArray(pkg.content) ? pkg.content : null;
    const padding = content && asset.width && asset.height ? {
      top: Math.max(0, Math.round(content[1] * scale)),
      right: Math.max(0, Math.round((asset.width - content[2]) * scale)),
      bottom: Math.max(0, Math.round((asset.height - content[3]) * scale)),
      left: Math.max(0, Math.round(content[0] * scale)),
    } : { top: 10, right: 14, bottom: 10, left: 14 };
    const skinId = uid(`converted-${role}`);
    const imagePath = `images/${skinId}.${extensionForMime(asset.mime, "png")}`;
    const skin = {
      id: skinId,
      name: `${groupName}-${role === "assistant" ? "对方" : "我方"}`,
      groupId, image: imagePath, imageMime: asset.mime,
      width: asset.width, height: asset.height, slice, padding,
      edgeScale: scale,
      offsetX: clampNumber(side.ox, 0, -40, 40),
      offsetY: clampNumber(side.oy, 0, -40, 40),
      imageOpacity: clampNumber(side.alpha, 1, 0, 1),
      textColor: String(side.color || pkg.color || "#4b5563"),
      fontData: "", fontName: "", fontMime: "",
      fontSizeAdjust: clampNumber((side.size == null ? 13.5 : side.size) - 13.5, 0, -5, 5),
    };
    if (side.font != null && Array.isArray(pkg.fonts) && pkg.fonts[side.font] && pkg.fonts[side.font].src) {
      const font = pkg.fonts[side.font];
      const fontRaw = await sourceToBytes(font.src);
      const fontPath = `fonts/${skinId}.${extensionForMime(fontRaw.mime, "ttf")}`;
      skin.fontData = fontPath; skin.fontName = cleanName(font.name || `font-${side.font}.ttf`); skin.fontMime = fontRaw.mime;
      files.push({ name: fontPath, data: fontRaw.bytes });
    }
    config.skins[skinId] = skin;
    if (role === "user") config.userSkinId = skinId;
    files.push({ name: imagePath, data: asset.bytes });
    if (picked.ignored) warnings.push(`${role === "assistant" ? "对方" : "我方"}另有 ${picked.ignored} 个图层未转换`);
    if (picked.fallback) warnings.push(`${role === "assistant" ? "对方" : "我方"}没有拉伸主体，已用第一张图片并采用默认切线`);
    const targetWillMirror = role === "user";
    if (!!side.mirror !== targetWillMirror) {
      warnings.push(`${role === "assistant" ? "对方" : "我方"}的镜像状态与目标插件的固定规则不同，导入后需留意方向`);
    }
  }
  if (!Object.keys(config.skins).length) throw new Error("气泡包内没有能转换的气泡主体");
  files.unshift({ name: "config.json", data: new TextEncoder().encode(JSON.stringify(config, null, 2)) });
  return { blob: makeZip(files), filename: `${groupName}-转自美化管理器.zip`, warnings, count: Object.keys(config.skins).length };
}

function customSkinToManager(skin, imageDataUrl, fontDataUrl) {
  const scale = clampNumber(skin.edgeScale, 0.6, 0.05, 2);
  const width = clampNumber(skin.width, 0, 0, 99999);
  const height = clampNumber(skin.height, 0, 0, 99999);
  const s = skin.slice || {};
  const p = skin.padding || {};
  const slice = [
    clampNumber(s.left, 20, 0, 99999), clampNumber(s.top, 20, 0, 99999),
    clampNumber(s.right, 20, 0, 99999), clampNumber(s.bottom, 20, 0, 99999),
  ];
  const content = width && height ? [
    clampNumber(p.left, 14, 0, 99999) / scale,
    clampNumber(p.top, 10, 0, 99999) / scale,
    width - clampNumber(p.right, 14, 0, 99999) / scale,
    height - clampNumber(p.bottom, 10, 0, 99999) / scale,
  ].map((n) => Math.round(n * 100) / 100) : null;
  const side = (role) => ({
    base: null,
    scale,
    content,
    ...(skin.offsetX ? { ox: clampNumber(skin.offsetX, 0, -40, 40) } : {}),
    ...(skin.offsetY ? { oy: clampNumber(skin.offsetY, 0, -40, 40) } : {}),
    ...(skin.imageOpacity != null && Number(skin.imageOpacity) < 0.995 ? { alpha: clampNumber(skin.imageOpacity, 1, 0, 1) } : {}),
    ...(role === "user" ? { mirror: true } : {}),
    size: 13.5 + clampNumber(skin.fontSizeAdjust, 0, -5, 5),
    color: String(skin.textColor || "#4b5563"),
    ...(fontDataUrl ? { font: 0 } : {}),
    layers: [{ img: 0, mode: "stretch", anchor: "lc", dx: 0, dy: 0, w: width || 128, h: height || 112, slice }],
    zorder: [0, "text"],
  });
  return {
    format: FORMATS.MANAGER,
    name: String(skin.name || "转换气泡"),
    color: String(skin.textColor || "#4b5563"), scale,
    assistant: side("assistant"), user: side("user"),
    images: [imageDataUrl],
    fonts: fontDataUrl ? [{ name: skin.fontName || "气泡字体", src: fontDataUrl }] : [],
  };
}

async function customToManager(file) {
  const entries = await unzipEntries(file);
  const configBytes = entries.get("config.json");
  if (!configBytes) throw new Error("ZIP 内缺少 config.json");
  const config = JSON.parse(new TextDecoder().decode(configBytes));
  if (!config || config.packageType !== FORMATS.CUSTOM || !config.skins) {
    throw new Error("不是自定义气泡导出的资源包");
  }
  const outputs = [];
  const warnings = [];
  for (const skin of Object.values(config.skins)) {
    if (!skin || !skin.image) { warnings.push(`「${skin && skin.name || "未命名"}」没有图片，已跳过`); continue; }
    const imageBytes = entries.get(String(skin.image));
    if (!imageBytes) { warnings.push(`「${skin.name || "未命名"}」缺少图片文件，已跳过`); continue; }
    const imageDataUrl = bytesToDataUrl(imageBytes, skin.imageMime || mimeFromPath(skin.image));
    let fontDataUrl = "";
    if (skin.fontData) {
      const fontBytes = entries.get(String(skin.fontData));
      if (fontBytes) fontDataUrl = bytesToDataUrl(fontBytes, skin.fontMime || mimeFromPath(skin.fontData));
      else warnings.push(`「${skin.name || "未命名"}」缺少字体文件，已不带字体转换`);
    }
    const pkg = customSkinToManager(skin, imageDataUrl, fontDataUrl);
    const filename = `${cleanName(skin.name || "转换气泡")}.json`;
    outputs.push({ filename, data: new TextEncoder().encode(JSON.stringify(pkg, null, 2)) });
  }
  if (!outputs.length) throw new Error("资源包内没有可转换的气泡");
  const items = outputs.map((output) => ({
    filename: output.filename,
    blob: new Blob([output.data], { type: "application/json" }),
  }));
  if (items.length > 1) warnings.push("美化管理器不识别气泡合集 ZIP，请在下方选择并下载标准 JSON；导入时可多选这些 JSON");
  return { blob: items[0].blob, filename: items[0].filename, items, warnings, count: items.length };
}

async function detectAndConvert(file) {
  const lower = String(file.name || "").toLowerCase();
  if (lower.endsWith(".json") || file.type === "application/json") {
    const pkg = JSON.parse(await file.text());
    return { direction: "聊天页面美化管理器 → 自定义气泡", ...(await managerToCustom(pkg)) };
  }
  if (lower.endsWith(".zip") || /zip/i.test(file.type || "")) {
    return { direction: "自定义气泡 → 聊天页面美化管理器", ...(await customToManager(file)) };
  }
  throw new Error("请选择 .json 或 .zip 导出文件");
}

function create(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export default {
  manifest: {
    id: PLUGIN_ID,
    name: "气泡格式转换器",
    apiVersion: 1,
    version: "1.0.2",
    author: "NEEN & GPT",
    description: "在「自定义气泡」ZIP 与「聊天页面美化管理器」气泡 JSON 之间转换导出格式。",
    permissions: ["ui"],
  },

  setup(ctx) {
    const style = document.createElement("style");
    style.textContent = `
.bfc-entry{display:flex;flex-direction:column;gap:7px}.bfc-open{height:36px;border:1px solid rgba(185,151,202,.5);border-radius:10px;background:rgba(247,239,251,.9);color:#765c84;font-size:13px;cursor:pointer}
.bfc-modal{width:min(430px,calc(100vw - 30px));max-height:min(680px,86vh);overflow:auto;padding:18px;border:1px solid rgba(201,174,216,.58);border-radius:18px;background:rgba(251,247,253,.96);box-shadow:0 18px 55px rgba(77,49,91,.22);color:#51475a;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;box-sizing:border-box}
.bfc-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.bfc-title{font-size:17px;font-weight:750;color:#554160}.bfc-close{width:30px;height:30px;border:0;border-radius:50%;background:#eee4f2;color:#765c84;font-size:19px;cursor:pointer}.bfc-note{margin:10px 0 14px;color:#81758a;font-size:12px;line-height:1.6}.bfc-drop{display:flex;min-height:125px;padding:16px;align-items:center;justify-content:center;text-align:center;border:1.5px dashed #b99bc8;border-radius:14px;background:rgba(239,227,246,.58);color:#765c84;line-height:1.7;cursor:pointer;box-sizing:border-box}.bfc-drop.drag{background:#e8d7f1;border-color:#9270a4}.bfc-input{display:none}.bfc-status{margin-top:12px;padding:11px 12px;border-radius:12px;background:#f3edf6;font-size:12px;line-height:1.6}.bfc-status.ok{background:#edf7f1;color:#35644a}.bfc-status.err{background:#fff0f2;color:#974454}.bfc-warn{margin:9px 0 0;padding-left:18px;color:#8b6375}.bfc-pick{display:none;margin-top:10px}.bfc-pick.show{display:block}.bfc-pick-label{display:block;margin-bottom:5px;color:#75677e;font-size:12px}.bfc-select{width:100%;height:36px;padding:0 10px;border:1px solid #cdb9d7;border-radius:10px;background:#fff;color:#5b4b64;font-size:12px;box-sizing:border-box}.bfc-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}.bfc-actions.multi{grid-template-columns:1fr 1fr}.bfc-download{width:100%;height:38px;margin:0;border:0;border-radius:11px;background:linear-gradient(135deg,#b28ac5,#9270a4);color:#fff;font-size:13px;font-weight:650;cursor:pointer}.bfc-download.secondary{display:none;background:#eee4f2;color:#725c7e;border:1px solid #d7c3e0}.bfc-download.secondary.show{display:block}.bfc-download:disabled{opacity:.45;cursor:default}.bfc-foot{margin-top:12px;color:#93889a;font-size:11px;line-height:1.55}
`;
    document.head.appendChild(style);

    function openConverter() {
      ctx.ui.openModal((host, { close }) => {
        host.style.cssText = "width:auto;max-width:calc(100vw - 30px);padding:0;background:transparent;box-shadow:none;overflow:visible;";
        const box = create("div", "bfc-modal");
        const head = create("div", "bfc-head");
        const title = create("div", "bfc-title", "气泡格式转换器");
        const closeBtn = create("button", "bfc-close", "×"); closeBtn.type = "button"; closeBtn.onclick = close;
        head.append(title, closeBtn);
        const note = create("div", "bfc-note", "自动识别：美化管理器 .json → 自定义气泡 .zip；自定义气泡 .zip → 美化管理器 .json。只转换文件，不读取或修改两个插件的本地配置。");
        const input = create("input", "bfc-input"); input.type = "file"; input.accept = ".json,.zip,application/json,application/zip";
        const drop = create("div", "bfc-drop", "点这里选择导出文件\n也可以把文件拖进来"); drop.style.whiteSpace = "pre-line";
        const status = create("div", "bfc-status", "等待选择文件");
        const pickWrap = create("label", "bfc-pick");
        const pickLabel = create("span", "bfc-pick-label", "选择要下载的气泡 JSON");
        const pick = create("select", "bfc-select");
        pickWrap.append(pickLabel, pick);
        const actions = create("div", "bfc-actions");
        const save = create("button", "bfc-download", "下载转换结果"); save.type = "button"; save.disabled = true;
        const saveAll = create("button", "bfc-download secondary", "逐个下载全部 JSON"); saveAll.type = "button";
        actions.append(save, saveAll);
        const foot = create("div", "bfc-foot", "格式限制：自定义气泡仅有一张九宫格图；美化管理器的额外贴纸、多拉伸层与独立镜像无法原样写入。转换器会保留主体层并逐项提示，不会静默丢弃。");
        let result = null;

        const render = (message, kind, warnings) => {
          status.className = `bfc-status${kind ? ` ${kind}` : ""}`;
          status.replaceChildren(create("div", "", message));
          if (warnings && warnings.length) {
            const list = create("ul", "bfc-warn");
            warnings.forEach((warning) => list.appendChild(create("li", "", warning)));
            status.appendChild(list);
          }
        };
        const handle = async (file) => {
          if (!file) return;
          result = null; save.disabled = true;
          pick.replaceChildren(); pickWrap.classList.remove("show");
          actions.classList.remove("multi"); saveAll.classList.remove("show");
          save.textContent = "下载转换结果";
          render(`正在转换「${file.name}」…`, "", []);
          try {
            result = await detectAndConvert(file);
            render(`${result.direction}\n已转换 ${result.count} 个气泡。`, "ok", result.warnings);
            status.firstChild.style.whiteSpace = "pre-line";
            if (result.items && result.items.length > 1) {
              result.items.forEach((item, index) => {
                const option = create("option", "", item.filename.replace(/\.json$/i, ""));
                option.value = String(index); pick.appendChild(option);
              });
              pickWrap.classList.add("show"); actions.classList.add("multi"); saveAll.classList.add("show");
              save.textContent = "下载所选 JSON";
            }
            save.disabled = false;
          } catch (error) {
            render(`转换失败：${error && error.message ? error.message : "文件格式无效"}`, "err", []);
            ctx.system.log("气泡格式转换失败", file.name, error);
          }
        };
        drop.onclick = () => input.click();
        input.onchange = () => { const file = input.files && input.files[0]; input.value = ""; handle(file); };
        for (const type of ["dragenter", "dragover"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add("drag"); });
        for (const type of ["dragleave", "drop"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove("drag"); });
        drop.addEventListener("drop", (event) => handle(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]));
        save.onclick = () => {
          if (!result) return;
          const item = result.items && result.items.length ? result.items[Number(pick.value) || 0] : result;
          download(item.blob, item.filename); ctx.ui.toast("转换结果已下载");
        };
        saveAll.onclick = () => {
          if (!result || !result.items) return;
          result.items.forEach((item, index) => {
            ctx.system.timers.setTimeout(() => download(item.blob, item.filename), index * 180);
          });
          ctx.ui.toast(`正在逐个下载 ${result.items.length} 个 JSON；若浏览器拦截，请改用左侧逐个下载`);
        };
        box.append(head, note, drop, input, status, pickWrap, actions, foot);
        host.appendChild(box);
        return () => box.remove();
      });
    }

    ctx.ui.slot("settings.section", (element) => {
      const wrap = create("div", "bfc-entry");
      const button = create("button", "bfc-open", "打开气泡格式转换器"); button.type = "button"; button.onclick = openConverter;
      wrap.appendChild(button); element.appendChild(wrap);
      return () => wrap.remove();
    });

    return () => style.remove();
  },
};
