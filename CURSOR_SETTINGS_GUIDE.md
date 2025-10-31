# Cursor 中文 Commit Message 设置指南

## ✅ 已完成的配置

### 1. 工作区设置
已在 `.vscode/settings.json` 中添加：
```json
{
    "cursor.chat.commitMessagePrompt": "请用中文生成commit message...",
    "cursor.general.language": "zh-CN"
}
```

### 2. Cursor规则文件
已创建 `.cursorrules` 文件，定义了中文commit message的规范。

## 🔧 额外设置（如需要）

### 方法1：Cursor用户设置（推荐）

1. 打开 Cursor
2. 按 `Ctrl + ,`（Windows/Linux）或 `Cmd + ,`（Mac）打开设置
3. 搜索 "commit"
4. 找到 `Cursor > Chat: Commit Message Prompt`
5. 添加以下内容：
```
请用中文生成commit message，描述代码的主要变更内容。使用以下格式：

类型(范围): 简短描述

类型可以是：
- 新增：添加新功能
- 修复：修复bug
- 重构：代码重构
- 优化：性能优化
- 文档：文档更新
- 样式：代码格式调整
- 测试：测试相关

示例：
重构(数据看板): 将Dashboard组件化以提高可维护性
```

### 方法2：通过命令面板

1. 按 `Ctrl + Shift + P`（Windows/Linux）或 `Cmd + Shift + P`（Mac）
2. 输入 "Preferences: Open User Settings (JSON)"
3. 添加：
```json
{
    "cursor.chat.commitMessagePrompt": "请用中文生成commit message，描述代码的主要变更内容。格式：类型(范围): 简短描述",
    "cursor.general.language": "zh-CN"
}
```

## 📝 使用说明

1. **生成Commit Message**
   - 在源代码管理面板中，点击AI图标
   - AI会根据您的更改自动生成中文commit message

2. **手动触发**
   - 右键点击更改的文件
   - 选择 "Generate Commit Message"
   - AI会分析更改并生成中文描述

3. **自定义提示**
   - 如果生成的内容不满意，可以在提示词中补充："用中文，并且..."

## 🎯 Commit Message 格式示例

```
重构(数据看板): 组件化Dashboard、ProjectDashboard和ShipperDashboard

- 创建自定义hooks提取业务逻辑
- 拆分UI组件提高可复用性
- 保留所有原有功能和图表
- 添加完整的TypeScript类型定义
```

## ⚙️ 如果设置不生效

1. **重启Cursor**
   - 完全退出Cursor
   - 重新打开项目

2. **检查AI模型**
   - 确保使用的是支持中文的模型
   - 在设置中检查 `Cursor > General > Model`

3. **清除缓存**
   - 设置 → 搜索 "cache"
   - 点击 "Clear Cache"
   - 重启Cursor

## 💡 提示

- `.cursorrules` 文件会被AI自动读取
- 工作区设置优先于全局设置
- 可以在commit message输入框中手动编辑AI生成的内容

