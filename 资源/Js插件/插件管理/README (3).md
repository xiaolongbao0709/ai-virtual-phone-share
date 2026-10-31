# 小手机聊天插件集

给 [doremy.float.phone](https://github.com/doremy1203/doremy.float.phone)（「小手机」聊天应用）写的三个插件：**发文件**、**网页抓取**、**聊天书签**。

> **非官方项目。** 本仓库由第三方维护，与 App 作者无关，不代表官方立场，也未获得官方背书。插件通过 App 公开的插件 API（apiVersion 1）工作，不包含、不修改宿主源码。

## 插件

| 文件 | 作用 | 说明 |
| --- | --- | --- |
| `chat-file-sender.plugin.js` | 在聊天里发任意文件，并把文档正文交给角色 | [docs/file-sender.md](docs/file-sender.md) |
| `chat-webpage-reader.plugin.js` | 发链接即抓正文，角色能读到整篇文章 | [docs/webpage-reader.md](docs/webpage-reader.md) |
| `chat-bookmarks.plugin.js` | 长按消息收藏为书签，标题栏角标可回看 | 见文件头注释 |

## 安装

1. 打开 App 的**插件管理页** → 「导入插件」/「从文件安装」；
2. 选择对应的 `*.plugin.js` 文件；
3. 启用。同 `manifest.id` 重新导入即覆盖升级，你的设置会保留。

插件是单文件 ES Module，没有依赖、不需要构建。

## 需要你自己准备的东西

**本仓库不内置任何 API Key，也不需要 Key 才能用**（只有「扫描件 OCR」这一项需要）。

- **扫描件 OCR（可选）**：默认用百度文字识别，需要你自己注册申请 API Key / Secret Key；也可以在设置里切到「自定义 HTTP 接口」，接你自己的 OCR 服务（任何返回文字的接口都行）。
- **网页抓取**：走 App 自带的 `/api/tool-proxy`，无需 Key；如果你的部署没有 API 路由，可在设置里填自定义代理。

Key 存在本机插件设置里（**明文**），任何能拿到手机的人都能看到。建议单独建一个可随时删除重建的应用 Key，不要复用主账号凭据。详见 [SECURITY.md](SECURITY.md)。

## 数据会离开手机吗

| 功能 | 上传 | 上传什么 |
| --- | --- | --- |
| 发文件、PDF/DOCX/PPTX/XLSX/TXT 解析 | **否** | 全部在本机完成 |
| 扫描件 OCR | **是**（首次会弹确认框） | 压缩后的页面图，不上传原始 PDF |
| 网页抓取 | **是**（等于访问该网址） | 只发 GET 请求 |

首次 OCR 前会弹窗写明「把前 N 页图片传给谁」，拒绝就不上传；之后可在文件消息菜单里重新确认。不上 OCR 也能用：把关键页**截图发给角色**，走的是 App 自己的视觉通道。

## 免责声明

- 插件按「现状」提供，不保证识别准确率、不保证长期可用；App 更新可能让依赖内部行为的功能失效。
- OCR 识别结果、网页正文可能与原文有出入，请自行核对。
- 使用第三方 OCR / 代理服务产生的费用、配额消耗、数据合规责任，由使用者自行承担并遵守对应服务条款。
- **请勿把某个人的 Key 做成公共代理**分发给他人使用，这违反服务商条款，也可能导致封号。

## 开发与测试

环境：Node.js ≥ 20（用到 `CompressionStream` / `DecompressionStream`），无需 npm 安装。

```powershell
node dev/smoke-test-doc-extract.mjs     # 27 条：PDF / DOCX / PPTX / XLSX / 位图扫描件解析
node dev/smoke-test-file-sender.mjs     # 77 条：发送 / 解析 / 注入 / OCR / 上传确认
node dev/smoke-test-webpage-reader.mjs  # 39 条：抓取 / 提取 / 注入 / 降级
node dev/smoke-test-bookmarks.mjs       # 30 条：书签收藏 / 浮层 / 删除联动
```

测试用「假 DOM + 假 ctx + 假 fetch」跑，不联网、不写真实存储，也不需要任何 Key。

`dev/make-fixtures.py` 用 python-docx / python-pptx / openpyxl 生成 Office 测试夹具（已随仓库提供生成结果）。

## 许可

代码以 [MIT](LICENSE) 发布。**仓库不包含宿主 App 的源码**（宿主采用 AGPL-3.0，与本仓库无关）；插件通过公开 API 与宿主交互，属于独立作品。
