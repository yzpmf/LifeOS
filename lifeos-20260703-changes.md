# Life OS 四点改造完成

## 时间
2026-07-03 21:39

## 改造内容

### 1. 打卡页：只看今天 + 「查看全部」按钮
- `HabitScreen.js`：默认只显示 `isHabitActiveOnDate(h, today)` 过滤后的习惯
- 底部加按钮：「查看全部习惯（N 项）」/「收起 · 只看今天的」
- 非今天习惯显示「休息」badge，不可打卡，降低透明度
- 今日进度为空时显示「今天休息日」
- 空状态（今天没习惯也没全部习惯时）提示「今天没有需要打卡的习惯」

### 2. AI 对话：Markdown 渲染 + 新的 API 配置适配
- `package.json` 已添加 `react-native-markdown-display` 依赖
- `AIChatSheet.js`：
  - 新增 `getLLMConfig(settings)` — 优先读 llmApiKey/llmBaseUrl/llmModel，fallback 到 aiApiKey 等旧字段
  - AI 回复用 `MsgBubble` 组件：Markdown 库可用时用 `<Markdown>` 渲染，否则纯文本
  - Markdown 样式：标题、列表、引用、代码块、加粗、斜体、链接、分割线
  - 系统 prompt 更新：明确告诉 LLM「回复可用 Markdown 格式」
  - 演示模式的回复文本也改成了 Markdown 语法（**加粗**、- 列表等）

### 3. 模型拆分为语言模型 + 嵌入模型
- `constants/index.js`：
  - `LLM_PRESETS`：10 个语言模型预设（GPT-4o、DeepSeek、硅基、小米等）
  - `EMBEDDING_PRESETS`：5 个嵌入模型预设（OpenAI text-embedding-3-large/small、硅基 BGE-M3/BGE-Large）
  - `MODEL_PRESETS` 保留兼容，合并两个列表 + 自定义
  - `DEFAULT_SETTINGS` 新增 llmApiKey/llmBaseUrl/llmModel/llmPreset 和 embeddingApiKey/embeddingBaseUrl/embeddingModel/embeddingPreset

### 4. 设置页：折叠式小长条
- `SettingsScreen.js` 完全重写：
  - 每个配置项是一个可点击的小长条（row），显示标题 + 当前值预览
  - 点击展开详情，再次点击收起（accordion 模式）
  - 8 个区块：语言模型 / 嵌入模型 / 待办规则 / 学期设置 / 通知设置 / 数据管理 / 关于
  - 语言模型和嵌入模型各自独立配置 Base URL + API Key + 模型名
  - 嵌入模型 API Key 默认复用语言模型的（placeholder 提示）

## 编译状态
- `react-native-markdown-display` 已在 `D:\lifeosbuild\LifeOSApp` 安装成功
- 源码已同步到构建目录
- Gradle 编译正在运行中（session mild-ridge）
