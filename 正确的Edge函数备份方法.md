# 正确的Supabase Edge函数备份方法

## ❌ 错误原因分析

您遇到的错误 `relation "supabase_functions.functions" does not exist` 是因为：

1. **Edge函数不是数据库表** - Edge函数是独立的服务，不存储在数据库表中
2. **错误的查询方式** - 试图从不存在的表中查询Edge函数信息
3. **概念混淆** - Edge函数和数据库函数是不同的概念

## ✅ 正确的备份方法

### 方法一：使用Supabase CLI（推荐）

```bash
# 1. 列出所有Edge函数
supabase functions list

# 2. 下载特定函数
supabase functions download <function-name>

# 3. 下载所有函数
supabase functions download --all

# 4. 查看函数详情
supabase functions describe <function-name>
```

### 方法二：从本地文件系统备份

```bash
# 1. 创建备份目录
mkdir backup_edge_functions_$(date +%Y%m%d_%H%M%S)

# 2. 复制所有Edge函数
cp -r supabase/functions/* backup_edge_functions_*/

# 3. 排除共享目录（可选）
cp -r supabase/functions/* backup_edge_functions_*/ --exclude=_shared

# 4. 压缩备份
tar -czf edge_functions_backup.tar.gz backup_edge_functions_*/
```

### 方法三：使用PowerShell脚本（Windows）

```powershell
# 运行本地备份脚本
powershell -ExecutionPolicy Bypass -File backup_edge_functions_local.ps1
```

### 方法四：通过Supabase Dashboard

1. 登录Supabase Dashboard
2. 进入项目设置
3. 选择 "Edge Functions"
4. 查看和下载函数代码

## 🔍 当前项目中的Edge函数

根据您的项目结构，发现以下Edge函数：

```
supabase/functions/
├── _shared/                    # 共享代码
├── admin-reset-password/       # 管理员重置密码
├── amap-geocoding/            # 高德地图地理编码
├── bulk-link-logistics/       # 批量关联物流
├── export-excel/              # Excel导出
├── get-approvers/             # 获取审批人
├── get-filtered-payment-requests/ # 获取筛选付款申请
├── log-contract-access/       # 记录合同访问
├── pdf-proxy/                 # PDF代理
├── pdf-proxy-simple/          # 简化PDF代理
├── qiniu-upload/              # 七牛云上传
├── username-login/            # 用户名登录
├── work-wechat-approval/      # 企业微信审批
└── work-wechat-auth/          # 企业微信认证
```

## 📋 正确的SQL查询

如果您想备份与Edge函数相关的数据库配置，使用以下查询：

```sql
-- 1. 备份自定义函数（可能包含Edge函数相关逻辑）
SELECT 
    '-- 函数: ' || n.nspname || '.' || p.proname || E'\n' ||
    pg_get_functiondef(p.oid) || ';' || E'\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 2. 备份触发器（可能包含Webhook触发器）
SELECT 
    '-- 触发器: ' || t.tgname || ' ON ' || c.relname || E'\n' ||
    pg_get_triggerdef(t.oid) || ';' || E'\n'
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 3. 备份RLS策略
SELECT 
    '-- RLS策略: ' || policyname || ' ON ' || tablename || E'\n' ||
    'CREATE POLICY ' || policyname || ' ON ' || schemaname || '.' || tablename || E'\n' ||
    'FOR ' || cmd || E'\n' ||
    'TO ' || array_to_string(roles, ', ') || E'\n' ||
    CASE WHEN qual IS NOT NULL THEN 'USING (' || qual || ')' ELSE '' END || E'\n' ||
    CASE WHEN with_check IS NOT NULL THEN 'WITH CHECK (' || with_check || ')' ELSE '' END || ';' || E'\n'
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

## 🚀 立即可用的备份命令

### 1. 快速备份所有Edge函数
```bash
# 创建备份目录
mkdir backup_edge_functions_$(date +%Y%m%d_%H%M%S)

# 备份所有函数
cp -r supabase/functions/* backup_edge_functions_*/

# 生成备份报告
echo "Edge函数备份完成: $(date)" > backup_edge_functions_*/backup_report.txt
echo "备份函数数量: $(ls -1 backup_edge_functions_* | wc -l)" >> backup_edge_functions_*/backup_report.txt
```

### 2. 使用PowerShell备份（Windows）
```powershell
# 运行备份脚本
powershell -ExecutionPolicy Bypass -File backup_edge_functions_local.ps1
```

### 3. 使用Supabase CLI备份
```bash
# 安装Supabase CLI（如果未安装）
npm install -g supabase

# 登录Supabase
supabase login

# 链接项目
supabase link --project-ref <your-project-ref>

# 下载所有函数
supabase functions download --all
```

## 🔄 恢复Edge函数

### 从本地备份恢复
```bash
# 恢复所有函数
cp -r backup_edge_functions_*/ supabase/functions/

# 部署函数
supabase functions deploy
```

### 从Supabase CLI恢复
```bash
# 部署特定函数
supabase functions deploy <function-name>

# 部署所有函数
supabase functions deploy
```

## 📊 备份验证

### 检查备份完整性
```bash
# 检查备份文件数量
ls backup_edge_functions_*/ | wc -l

# 检查每个函数的index.ts文件
find backup_edge_functions_*/ -name "index.ts" | wc -l

# 检查文件大小
du -sh backup_edge_functions_*/
```

### 验证函数代码
```bash
# 检查每个函数的代码行数
for func in backup_edge_functions_*/*/; do
    if [ -f "$func/index.ts" ]; then
        lines=$(wc -l < "$func/index.ts")
        echo "$(basename "$func"): $lines 行"
    fi
done
```

## 🎯 推荐备份策略

### 开发环境
- **频率**: 每日备份
- **方法**: 本地文件系统备份
- **存储**: Git版本控制

### 生产环境
- **频率**: 每周备份 + 发布前备份
- **方法**: Supabase CLI + 本地备份
- **存储**: 本地 + 云存储

### 紧急情况
- **方法**: 手动复制 + Supabase Dashboard
- **验证**: 立即测试恢复流程

## ✅ 备份检查清单

- [ ] 所有Edge函数已备份
- [ ] 备份文件完整性验证
- [ ] 函数代码行数检查
- [ ] 备份时间记录
- [ ] 恢复流程测试
- [ ] 备份文档更新
- [ ] 存储位置确认

---

**重要提醒**: Edge函数不是数据库表，请使用正确的备份方法！
