# 百度地图 API Key 配置指南

## 📋 概述

车辆轨迹查询功能使用百度地图显示车辆行驶轨迹。需要在 Supabase 中配置百度地图 API Key。

## 🔑 获取百度地图 API Key

### 1. 注册百度地图开放平台账号

1. 访问 [百度地图开放平台](https://lbsyun.baidu.com/)
2. 注册/登录账号
3. 完成实名认证（必须）

### 2. 创建应用

1. 登录后，进入 [控制台](https://lbsyun.baidu.com/apiconsole/key)
2. 点击"创建应用"
3. 填写应用信息：
   - **应用名称**：物流管理系统（或您的项目名称）
   - **应用类型**：浏览器端
   - **白名单**：添加您的域名
     - 开发环境：`localhost`、`127.0.0.1`
     - 生产环境：您的实际域名（如 `yourdomain.com`）
4. 点击"提交"创建应用

### 3. 获取 API Key（AK）

1. 创建应用后，在应用列表中可以看到 **AK（访问应用）**
2. 复制这个 AK 值，稍后需要在 Supabase 中配置

## ⚙️ 在 Supabase 中配置

### 方法一：通过 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 [Supabase Dashboard](https://app.supabase.com/)
   - 选择您的项目

2. **进入 Edge Functions 设置**
   - 在左侧菜单中，点击 **Edge Functions**
   - 点击右上角的 **Settings**（设置）按钮

3. **添加环境变量**
   - 在 **Environment Variables**（环境变量）部分
   - 点击 **Add new secret**（添加新密钥）
   - 填写以下信息：
     - **Name（名称）**：`BAIDU_MAP_KEY`
     - **Value（值）**：粘贴您从百度地图开放平台获取的 AK
   - 点击 **Save**（保存）

4. **部署 Edge Function**
   - 在项目根目录运行以下命令：
     ```bash
     supabase functions deploy baidu-map-key
     ```

### 方法二：通过 Supabase CLI

1. **使用 CLI 设置密钥**
   ```bash
   supabase secrets set BAIDU_MAP_KEY=你的百度地图AK
   ```

2. **部署 Edge Function**
   ```bash
   supabase functions deploy baidu-map-key
   ```

## ✅ 验证配置

### 1. 检查 Edge Function 是否部署成功

在 Supabase Dashboard 中：
- 进入 **Edge Functions** 页面
- 确认 `baidu-map-key` 函数已部署

### 2. 测试 API Key 获取

在浏览器控制台中运行：

```javascript
// 使用 Supabase 客户端
const { data, error } = await supabase.functions.invoke('baidu-map-key', {
  method: 'GET'
});

console.log('API Key:', data?.apiKey);
console.log('Error:', error);
```

如果配置正确，应该能看到返回的 API Key（不会显示完整值，但会有响应）。

### 3. 测试地图显示

1. 打开车辆轨迹查询页面
2. 输入车牌号和时间范围
3. 点击查询
4. 如果配置正确，应该能看到地图正常加载

## 🔧 故障排查

### 问题 1：地图无法加载，提示"未配置百度地图API Key"

**解决方案**：
1. 检查 Supabase Dashboard 中是否已添加 `BAIDU_MAP_KEY` 环境变量
2. 确认 Edge Function `baidu-map-key` 已部署
3. 检查浏览器控制台的错误信息

### 问题 2：地图加载失败，提示"API Key 无效"

**解决方案**：
1. 检查百度地图开放平台中的应用状态
2. 确认 API Key 是否正确复制（没有多余空格）
3. 检查域名白名单是否包含当前访问的域名
4. 确认应用类型是"浏览器端"

### 问题 3：Edge Function 返回 500 错误

**解决方案**：
1. 在 Supabase Dashboard 中查看 Edge Function 日志
2. 确认环境变量名称是 `BAIDU_MAP_KEY`（大小写敏感）
3. 重新部署 Edge Function：
   ```bash
   supabase functions deploy baidu-map-key
   ```

## 📝 注意事项

1. **API Key 安全**：
   - 不要在前端代码中硬编码 API Key
   - 始终通过 Edge Function 获取 API Key
   - 定期轮换 API Key

2. **域名白名单**：
   - 确保所有使用地图的域名都在白名单中
   - 包括开发环境和生产环境

3. **配额限制**：
   - 免费版百度地图 API 有调用次数限制
   - 如需更高配额，需要升级到付费版

4. **环境变量更新**：
   - 如果更新了 API Key，需要重新部署 Edge Function
   - 或者等待几分钟让环境变量生效

## 🔄 更新 API Key

如果需要更新 API Key：

1. 在 Supabase Dashboard 中更新 `BAIDU_MAP_KEY` 环境变量
2. 重新部署 Edge Function：
   ```bash
   supabase functions deploy baidu-map-key
   ```
3. 清除浏览器缓存并刷新页面

## 📚 相关文档

- [百度地图开放平台文档](https://lbsyun.baidu.com/index.php?title=jspopularGL)
- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [车辆轨迹查询功能说明](./车辆轨迹查询功能说明.md)

---

**最后更新**：2025-12-04

