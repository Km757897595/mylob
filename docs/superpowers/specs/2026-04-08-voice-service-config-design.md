# 语音交互服务配置设计

日期：2026-04-08

## 背景

当前项目已经具备基础的语音合成与试听能力：

- Agent 维度支持 `openai`、`edge`、`microsoft` 三种 TTS 服务切换
- Agent 维度支持单个 voice 选择与实时试听
- 运行时通过 `src/hooks/useTTS.ts` 统一分发到不同 TTS 服务

但现状距离需求还有明显差距：

- 缺少全局默认 TTS 服务配置入口
- 缺少可视化的统一声纹库界面
- 缺少按性别、音色、语言风格筛选能力
- 缺少明确的离线语音产品能力
- 缺少 “全局默认 + Agent 覆盖” 的配置继承机制

## 目标

本次设计覆盖以下需求：

1. TTS 语音合成支持多种服务接入和切换
2. 提供可视化声纹库界面，支持选择不同性别、音色、语言风格并实时试听
3. 离线情况下支持男声和女声两个语音声源
4. 同时支持全局默认配置与 Agent 局部覆盖

## 非目标

本次不包含以下内容：

- Electron 原生离线 TTS 深度集成
- 远程动态拉取 voice 元数据
- 多级在线服务级联容灾
- STT 能力重构

## 现状评估

### 已完成部分

- `src/features/AgentSetting/AgentTTS/index.tsx`
  - 已有 Agent 维度 TTS 配置入口
  - 已有 TTS 服务切换
- `src/features/AgentSetting/AgentTTS/SelectWithTTSPreview.tsx`
  - 已有实时试听能力
- `src/hooks/useTTS.ts`
  - 已有按服务路由到不同 TTS provider 的运行时逻辑
- `src/app/(backend)/webapi/tts/openai/route.ts`
- `src/app/(backend)/webapi/tts/edge/route.ts`
- `src/app/(backend)/webapi/tts/microsoft/route.ts`
  - 已有在线 TTS 服务后端入口

### 待完善部分

- `src/routes/(main)/settings/tts/index.tsx`
  - 当前仅有 STT 和 OpenAI 模型设置
  - 缺少全局默认 TTS 服务和默认 voice 配置
- `packages/types/src/agent/tts.ts`
  - 仅支持服务下的 voice 字段
  - 不支持继承全局和离线兜底语义
- `packages/types/src/user/settings/tts.ts`
  - 仅支持 STT 与 OpenAI 模型字段
  - 不支持全局默认 TTS 服务和离线策略

## 设计原则

1. 优先复用现有 TTS 服务接入和试听链路
2. 在现有结构上增量演进，不做高风险推倒重构
3. 全局配置与 Agent 配置使用统一交互心智
4. 通过 selector 合成最终生效配置，避免创建时复制导致的配置漂移
5. Web 端优先完成离线兜底能力

## 方案对比

### 方案一：统一声纹元数据层 + 双层配置 + Web 离线兜底

说明：

- 引入统一的 voice catalog 元数据层
- 全局设置保存默认 TTS 服务、默认声纹与离线兜底策略
- Agent 设置支持继承全局或局部覆盖
- 运行时优先在线服务，离线或失败时退回本地语音

优点：

- 符合 “全局默认 + Agent 覆盖” 的产品目标
- 与 “统一浏览，切换服务后自动过滤” 的交互模式一致
- 后续新增 TTS 服务接入成本低

缺点：

- 类型、selector、设置页、运行时都有中等规模改动

### 方案二：仅在 UI 层拼接统一声纹库

说明：

- 保留现有 provider 分散 voice list
- 只在 UI 层做统一浏览和筛选

优点：

- 上线速度更快

缺点：

- 元数据分散
- 离线能力会变成特殊分支
- 后续维护成本高

### 方案三：完整 Voice Provider Registry 重构

说明：

- 将 TTS 服务、声纹库、试听、兜底全部注册化

优点：

- 架构最完整

缺点：

- 超出本次需求范围
- 风险和实施成本过高

## 推荐方案

采用方案一：统一声纹元数据层 + 双层配置 + Web 离线兜底。

理由：

- 能在现有代码基础上稳妥补齐需求
- 兼顾后续扩展性与本次交付节奏
- 不需要一次性重写已有 TTS 服务接入链路

## 信息架构与交互设计

### 全局设置页

在 `src/routes/(main)/settings/tts/index.tsx` 中，将页面从当前两块扩展为以下四块：

1. STT 设置
2. TTS 服务
3. 默认声纹库
4. 离线语音

#### TTS 服务

支持以下选项：

- `openai`
- `edge`
- `microsoft`
- `offline`

#### 默认声纹库

采用混合模式：

- 默认展示所有服务可用声音
- 顶部支持按以下维度筛选：
  - 服务
  - 性别
  - 音色
  - 语言风格
  - 语言
- 用户切换服务后，列表自动收窄为该服务可用声音
- 每个声音以卡片形式展示
- 卡片内提供试听按钮

#### 离线语音

新增离线兜底配置：

- 是否启用离线兜底
- 默认离线声源：`male` 或 `female`
- 是否在在线服务不可用时自动切换为离线播放

### Agent 设置页

在 `src/features/AgentSetting/AgentTTS/index.tsx` 中，将当前 “服务下拉 + voice Select” 升级为：

1. 继承全局默认
2. 覆盖当前 Agent 语音
3. 离线兜底策略
4. 实时试听

#### 继承全局默认

- 默认开启
- 开启时展示当前继承的全局服务、声纹与离线兜底策略
- 不展示完整编辑表单

#### 关闭继承后

- 展示与全局设置页相同的服务选择和统一声纹库组件
- 允许为当前 Agent 覆盖主语音和离线语音策略

## 数据模型设计

### 统一声纹元数据

新增统一 voice catalog 数据结构：

```ts
interface VoiceCatalogItem {
  id: string;
  service: 'openai' | 'edge' | 'microsoft' | 'offline';
  voiceId: string;
  label: string;
  locale: string;
  gender: 'male' | 'female' | 'neutral' | 'unknown';
  timbre: 'warm' | 'bright' | 'calm' | 'deep' | 'clear' | 'unknown';
  style: string[];
  tags: string[];
  previewable: boolean;
  offlineCapable: boolean;
}
```

### 全局 TTS 配置

扩展 `packages/types/src/user/settings/tts.ts`：

```ts
interface VoiceCatalogSelection {
  gender?: string;
  label: string;
  locale?: string;
  service: 'openai' | 'edge' | 'microsoft' | 'offline';
  style?: string;
  timbre?: string;
  voiceId: string;
}

interface OfflineTTSConfig {
  enabled: boolean;
  fallbackVoice: 'male' | 'female';
  preferOfflineWhenUnavailable: boolean;
}
```

并在全局设置中新增：

- `service`
- `selectedVoice`
- `offline`

同时保留现有：

- `openAI.ttsModel`
- `openAI.sttModel`
- `sttServer`
- `sttAutoStop`

### Agent TTS 配置

扩展 `packages/types/src/agent/tts.ts`：

- `inheritGlobal?: boolean`
- `selectedVoice?: VoiceCatalogSelection`
- `offline?: OfflineTTSConfig`

保留兼容字段：

- `ttsService`
- `voice`
- `showAllLocaleVoice`
- `sttLocale`

## 配置继承规则

最终生效配置按以下优先级合成：

1. Agent 显式覆盖
2. 用户全局默认
3. 系统默认值

详细规则：

1. `inheritGlobal !== false` 时，主服务、主声纹和离线兜底都默认跟随全局
2. Agent 关闭继承后，优先使用 Agent 自己的 `selectedVoice` 和 `offline`
3. Agent 仅覆盖部分字段时，其余字段继续回落到全局
4. 全局设置缺失时回退到系统默认值
5. 最终服务为 `offline` 时，运行时直接走本地离线语音

## 运行时设计

### 统一配置解析

在 selector 层新增 “最终 TTS 配置解析” 逻辑，统一输出：

- 最终服务
- 最终 voiceId
- 最终试听来源
- 是否启用离线兜底
- 离线男声或女声

建议新增解析函数：

- `resolveEffectiveTTSConfig`

### useTTS 扩展

当前 `src/hooks/useTTS.ts` 支持：

- `openai`
- `edge`
- `microsoft`

扩展后支持：

- `offline`

行为：

1. `openai / edge / microsoft`
   - 继续沿用现有在线服务调用路径
2. `offline`
   - 直接走浏览器 `speechSynthesis`
3. 在线服务失败且启用离线兜底
   - 自动退到 `speechSynthesis`

### Web 离线语音能力

首期采用浏览器本地语音能力：

- 使用 `speechSynthesis.getVoices()` 获取本地 voice 列表
- 基于 voice 名称、locale 和预设映射匹配男声或女声
- 若无法可靠识别性别，则回退到默认本地 voice

离线固定提供两个逻辑声源：

- `offline-male`
- `offline-female`

它们是产品层抽象，不要求底层浏览器 voice 名称固定一致。

## 组件拆分建议

建议新增以下可复用模块：

1. `VoiceCatalogPanel`
   - 声纹卡片列表
   - 筛选器
   - 选中态展示
2. `VoiceCatalogFilters`
   - 服务、性别、音色、风格、语言筛选
3. `VoicePreviewButton`
   - 封装在线试听行为
4. `OfflineVoiceSettings`
   - 离线兜底开关与男声女声选择
5. `resolveVoiceCatalog`
   - 将各 provider voice 数据整合为统一元数据

## 错误处理

### 试听失败

保留当前告警样式，并区分错误原因：

- 在线服务调用失败
- 浏览器不支持离线语音
- 未找到匹配的本地男声或女声

### 运行时失败

如果在线服务失败且启用离线兜底：

- 自动切换到本地离线语音
- 提示已切换为离线模式
- 不阻断播放流程

### 历史配置兼容

旧配置如仅保存 `ttsService` 和 `voice.openai` 时：

- selector 自动兼容读取
- UI 首次加载时映射为新的统一声纹选择结构
- 不要求用户手动重新配置

## 迁移策略

本次不做数据库 migration，采用 selector 兼容迁移方案。

### 原因

- 现有 TTS 配置存储于 JSON 字段
- 本次主要是配置结构扩展，不需要强制重写历史数据
- selector 兼容迁移风险更低

### 迁移方式

1. 默认值层补齐新字段
2. selector 读取时兼容旧字段
3. 新 UI 保存时优先写入新结构
4. 同时保留必要旧字段镜像，保障现有逻辑兼容

## 测试方案

### Selector 测试

验证：

- Agent 覆盖优先于全局
- 全局优先于系统默认
- 旧配置可以正确映射为新结构

### Voice Catalog 测试

验证：

- 不同服务 voice 被正确映射为统一结构
- 按服务、性别、音色、语言风格筛选结果正确

### useTTS 测试

验证：

- 在线服务正常调用现有 provider
- `offline` 服务走本地离线逻辑
- 在线失败时自动退到离线兜底

### 组件测试

验证：

- 全局设置页能保存默认服务、默认声纹和离线语音
- Agent 设置页能开启继承和关闭继承
- 实时试听能随着声纹切换而更新

## 风险与缓解

### 风险一：不同 provider 的 voice 元数据不完整

缓解：

- 首期使用静态映射补足性别、音色、风格标签
- 未知字段统一标为 `unknown`

### 风险二：浏览器本地 voice 差异大

缓解：

- 将男声女声设计为逻辑声源而非固定底层 voice
- 使用多级匹配与默认回退

### 风险三：旧逻辑依赖 `ttsService + voice.*`

缓解：

- 保留旧字段兼容
- 在 selector 和保存逻辑中提供桥接

## 实施范围

本次实施应完成：

1. 全局 TTS 服务配置入口
2. 统一声纹库 UI 与筛选能力
3. Agent 继承与覆盖机制
4. Web 离线男声女声兜底
5. 与现有试听能力整合

本次暂不实施：

1. Electron 原生离线 TTS
2. 动态远程声纹目录同步
3. 在线服务间级联容灾

## 成功标准

满足以下条件视为设计目标达成：

1. 用户可在全局设置页配置默认 TTS 服务与默认声纹
2. 用户可通过可视化声纹库按性别、音色、语言风格筛选并试听
3. Agent 可继承全局默认，也可单独覆盖
4. 在线不可用时，Web 端可切换到男声或女声离线播报
5. 现有在线 TTS 能力不回归
