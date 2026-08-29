# 通用AI接口实施计划

## 1. 目标
将当前硬编码的DeepSeek API调用改为通用AI接口，支持多厂商、多模型切换。

## 2. 支持的AI服务
- DeepSeek（当前）
- 智谱（Z.AI/GLM）
- 腾讯
- 豆包（字节跳动）
- Kimi（月之暗面）
- Google（Gemini）
- OpenAI
- OpenRouter

## 3. 架构设计

### 3.1 适配器模式
```
用户请求 → AIAdapter（统一接口）
           ├── DeepSeekAdapter
           ├── ZhipuAdapter
           ├── TencentAdapter
           ├── DoubaoAdapter
           ├── KimiAdapter
           ├── GoogleAdapter
           ├── OpenAIAdapter
           └── OpenRouterAdapter
```

### 3.2 核心接口定义

```typescript
// src/lib/ai/types.ts
export interface AIConfig {
  provider: AIProvider
  model: string
  apiKey: string
  baseUrl?: string
}

export type AIProvider = 
  | 'deepseek' 
  | 'zhipu' 
  | 'tencent' 
  | 'doubao' 
  | 'kimi' 
  | 'google' 
  | 'openai' 
  | 'openrouter'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
}

export interface AIAdapter {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}
```

### 3.3 具体Adapter实现

每个Adapter需要实现：
1. 构造函数：接收AIConfig
2. chat方法：调用对应AI服务的API
3. 错误处理：统一的AiError异常

### 3.4 工厂模式

```typescript
// src/lib/ai/factory.ts
export function createAIAdapter(config: AIConfig): AIAdapter {
  switch (config.provider) {
    case 'deepseek':
      return new DeepSeekAdapter(config)
    case 'zhipu':
      return new ZhipuAdapter(config)
    // ... 其他厂商
    default:
      throw new Error(`不支持的AI服务: ${config.provider}`)
  }
}
```

## 4. 实施步骤

### Phase 1：基础架构（Builder-初级）
1. 创建 `src/lib/ai/types.ts` - 类型定义
2. 创建 `src/lib/ai/adapter.ts` - 适配器接口
3. 创建 `src/lib/ai/factory.ts` - 工厂模式
4. 创建 `src/lib/ai/deepseek.ts` - DeepSeek适配器（迁移现有代码）

### Phase 2：设置界面（Builder-初级）
1. 修改 `src/lib/types.ts` - 添加AI配置字段
2. 修改 `src/lib/storage.ts` - 添加AI配置存储
3. 修改 `src/components/SettingsModal.tsx` - 添加AI服务选择界面

### Phase 3：集成现有功能（Builder-初级）
1. 修改 `src/lib/ai.ts` - 使用新的适配器接口
2. 修改 `src/app/api/ai/*` - 使用新的适配器接口

### Phase 4：添加其他厂商支持（Builder-初级）
1. 创建 `src/lib/ai/zhipu.ts` - 智谱适配器
2. 创建 `src/lib/ai/tencent.ts` - 腾讯适配器
3. 创建 `src/lib/ai/doubao.ts` - 豆包适配器
4. 创建 `src/lib/ai/kimi.ts` - Kimi适配器
5. 创建 `src/lib/ai/google.ts` - Google适配器
6. 创建 `src/lib/ai/openai.ts` - OpenAI适配器
7. 创建 `src/lib/ai/openrouter.ts` - OpenRouter适配器

## 5. 配置管理

### 5.1 Settings类型扩展
```typescript
export interface Settings {
  // ... 现有字段
  aiProvider: AIProvider
  aiModel: string
  aiApiKey: string
  aiBaseUrl?: string
}
```

### 5.2 设置界面
在SettingsModal中添加AI服务配置区域：
- AI服务选择（下拉框）
- 模型选择（下拉框，根据服务动态加载）
- API Key输入（密码框）
- Base URL输入（可选）

## 6. 测试计划

### 6.1 单元测试
- 测试每个Adapter的chat方法
- 测试工厂模式创建正确的Adapter
- 测试配置存储和读取

### 6.2 集成测试
- 测试AI生成功能（标题、标签）
- 测试思维总结功能
- 测试格式整理功能

### 6.3 真机测试
- 测试设置界面配置
- 测试不同AI服务的切换
- 测试模型选择

## 7. 风险评估

1. **API兼容性**：不同厂商的API格式可能不同，需要逐个适配
2. **密钥安全**：API Key需要安全存储，不能暴露到前端
3. **错误处理**：不同厂商的错误码和错误格式不同
4. **性能考虑**：多厂商支持可能增加代码复杂度

## 8. 时间估算

- Phase 1：2-3小时（基础架构）
- Phase 2：1-2小时（设置界面）
- Phase 3：1-2小时（集成现有功能）
- Phase 4：3-4小时（添加其他厂商支持）
- 测试：2-3小时

总计：约10-14小时
