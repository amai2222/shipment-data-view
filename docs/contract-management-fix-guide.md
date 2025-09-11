# 合同管理加载失败修复指南

## 问题症状
- 合同管理页面显示"加载合同列表失败"
- 页面显示"暂无合同记录"
- 浏览器控制台可能有数据库连接错误

## 快速修复步骤

### 方法1：使用 Supabase Dashboard（推荐）

1. **打开 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择您的项目：`mnwzvtvyauyxwowjjsmf`

2. **进入 SQL Editor**
   - 点击左侧菜单的 "SQL Editor"
   - 点击 "New query"

3. **运行修复脚本**
   - 复制 `scripts/fix-contract-tables.sql` 文件的全部内容
   - 粘贴到 SQL Editor 中
   - 点击 "Run" 按钮执行

4. **验证修复结果**
   - 运行 `scripts/test-database-connection.sql` 脚本
   - 检查所有项目都显示 ✓

### 方法2：使用 Supabase CLI

```bash
# 1. 安装 Supabase CLI（如果还没有安装）
npm install -g supabase

# 2. 登录 Supabase
supabase login

# 3. 链接到您的项目
supabase link --project-ref mnwzvtvyauyxwowjjsmf

# 4. 运行迁移
supabase db push

# 5. 或者直接运行 SQL 脚本
supabase db reset
```

### 方法3：手动检查表结构

1. **检查表是否存在**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'contract%';
   ```

2. **检查用户权限**
   ```sql
   SELECT current_user, session_user;
   ```

3. **测试简单查询**
   ```sql
   SELECT COUNT(*) FROM public.contracts;
   ```

## 常见问题解决

### 问题1：权限不足
**症状**：查询被拒绝，提示权限不足
**解决**：
```sql
-- 确保用户有正确的权限
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

### 问题2：RLS 策略问题
**症状**：表存在但查询返回空结果
**解决**：
```sql
-- 临时禁用 RLS 进行测试
ALTER TABLE public.contracts DISABLE ROW LEVEL SECURITY;

-- 测试查询
SELECT * FROM public.contracts LIMIT 5;

-- 重新启用 RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
```

### 问题3：函数不存在
**症状**：RLS 策略报错，提示函数不存在
**解决**：运行修复脚本中的函数创建部分

## 验证修复成功

修复完成后，您应该能够：

1. ✅ 正常打开合同管理页面
2. ✅ 看到合同列表（即使为空）
3. ✅ 点击"新增合同"按钮
4. ✅ 使用搜索和筛选功能
5. ✅ 访问编号管理、标签管理等子页面

## 如果问题仍然存在

1. **检查浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Console 标签页的错误信息
   - 查看 Network 标签页的请求状态

2. **检查 Supabase 项目状态**
   - 确认项目没有暂停或限制
   - 检查 API 密钥是否有效
   - 确认数据库连接正常

3. **联系技术支持**
   - 提供浏览器控制台的错误截图
   - 提供 Supabase Dashboard 中的表结构截图
   - 说明您使用的修复方法

## 预防措施

1. **定期备份数据库**
2. **在修改表结构前先测试**
3. **使用版本控制管理数据库迁移**
4. **监控 Supabase 项目的使用情况**
