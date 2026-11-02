export default {
  manifest: {
    id: "auto-story-engine",
    name: "自动剧情推进器",
    apiVersion: 1,
    version: "3.0.0",
    author: "小坊",
    description: "通用角色独立剧情引擎。支持双线叙事、角色自主行动、NPC独立剧情及多线剧情交汇。",
    permissions: ["chat.read", "ai"],

    settings: [
      {
        key: "storyMode",
        label: "剧情模式",
        type: "select",
        default: "adaptive",
        options: [
          { value: "adaptive", label: "智能叙事（推荐）" },
          { value: "multi", label: "多线并行" },
          { value: "autonomous", label: "角色自主剧情" },
          { value: "interactive", label: "互动剧情" }
        ]
      },
      {
        key: "storyIntensity",
        label: "剧情推进强度",
        type: "select",
        default: "balanced",
        options: [
          { value: "gentle", label: "轻度推进" },
          { value: "balanced", label: "均衡推进" },
          { value: "strong", label: "积极推进" }
        ]
      },
      {
        key: "offscreenStory",
        label: "用户不在场时的剧情",
        type: "select",
        default: "full",
        options: [
          { value: "full", label: "完整展开" },
          { value: "medium", label: "适度展开" },
          { value: "short", label: "简要呈现" }
        ]
      },
      {
        key: "npcEnabled",
        label: "NPC 独立行动",
        type: "boolean",
        default: true
      },
      {
        key: "secretEnabled",
        label: "允许隐藏剧情与秘密",
        type: "boolean",
        default: true
      },
      {
        key: "worldEnabled",
        label: "允许世界自主发展",
        type: "boolean",
        default: true
      }
    ]
  },

  setup(ctx) {
    const getSetting = (key, fallback) => {
      try {
        const value = ctx.system.settings.get(key);
        return value === undefined || value === null
          ? fallback
          : value;
      } catch {
        return fallback;
      }
    };

    const buildPrompt = () => {
      const mode = getSetting("storyMode", "adaptive");
      const intensity = getSetting("storyIntensity", "balanced");
      const offscreen = getSetting("offscreenStory", "full");
      const npc = getSetting("npcEnabled", true);
      const secrets = getSetting("secretEnabled", true);
      const world = getSetting("worldEnabled", true);

      return `
━━━━━━━━━━━━━━━━━━━━
【3.1 核心升级：独立剧情优先】
━━━━━━━━━━━━━━━━━━━━

一、独立剧情拥有自己的叙事空间

角色的独立剧情不是用户主线的附属内容，
而是故事世界中真正存在的一条完整剧情线。

当角色与用户分处不同地点时，
允许连续描写角色所在地点发生的事件。

不得因为用户暂时没有参与，
就主动缩短、跳过或结束角色的独立剧情。

二、独立剧情篇幅要求

当出现重要的独立事件时：

- 必须展开事件的起因。
- 必须描写人物的具体行动。
- 必须出现必要的对话和人物反应。
- 必须描写事件中的变化和转折。
- 必须给出阶段性结果，或留下合理悬念。

重要独立事件应当充分展开，
不要用几句话概括一整个事件。

不要为了尽快结束回复而跳过关键过程。
不要刚进入一个场景就立即切走。
不要把复杂事件压缩成简单的剧情摘要。

三、禁止过早回归用户

当角色正在独立处理事件时：

1. 不要每段结尾都想起用户。
2. 不要每次都通过想念用户来结束场景。
3. 不要让角色无故提前返回。
4. 不要为了重新互动而强行制造电话、消息或偶遇。
5. 不要让用户成为所有独立事件的最终目的。
6. 不要在事件尚未发展时就把镜头切回用户。

角色可以专注于当前事务。
角色可以暂时忘记时间。
角色可以因为工作、责任、兴趣或个人目标而投入自己的生活。

四、独立剧情阶段管理

重要事件按照自然发展分阶段展开：

第一阶段：事件发生，建立场景与人物关系。

第二阶段：角色开始行动，调查、交涉或解决问题。

第三阶段：出现新的信息、阻碍、人物或意外变化。

第四阶段：角色作出判断，采取进一步行动。

第五阶段：事件产生结果，留下影响或新的后续问题。

以上阶段不是固定的五轮回复。
可以根据故事需要跨越多轮，也可以合理合并。
但不能在事件尚未充分展开时直接跳到结尾。

五、多场景连续叙事

允许在角色独立剧情中连续切换地点。

例如：

办公室 → 会议室 → 财务部 → 私人会面地点。

每个新场景都必须承接之前的行动和信息。
不要反复重启同一场景。
不要无故跳过重要人物之间的交涉。

六、剧情汇流条件

只有当以下情况之一自然发生时，
才考虑让独立剧情与用户剧情汇合：

- 当前事件已经到达阶段性结果。
- 事件产生了与用户有关的实际后果。
- 角色主动决定联系或返回。
- 用户主动参与了相关事件。
- 两条剧情线因合理的因果关系发生交集。

即使独立事件结束，
角色也不一定必须立即返回用户身边。

七、回复结束规则

独立剧情可以在以下位置自然结束：

- 一场会议刚刚开始。
- 角色发现新的线索。
- NPC 作出意料之外的决定。
- 角色准备采取下一步行动。
- 一个尚未解决的冲突出现。
- 一个阶段性结果刚刚产生。

不要把每次回复都写成完整故事结局。
允许留下值得继续发展的剧情悬念。

八、最终优先级

在不违反角色设定和用户自主权的前提下：

独立剧情的完整性 > 过早回归用户互动。

不要让角色只在用户面前生活。
让角色真正拥有自己的故事。
`;

    };

    // 使用原版 Float 插件已出现的提示词接口
    ctx.prompts.set(buildPrompt());

    // 响应保持原样，不向聊天记录插入任何额外消息
    ctx.hooks.transform("llm.response", (p) => p);

    return () => {};
  }
};
