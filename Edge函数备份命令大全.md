# Supabase Edge函数备份命令大全

## 📋 备份方式总览

### 1. SQL命令备份（数据库中的Edge函数）
### 2. 本地文件系统备份
### 3. Supabase CLI备份
### 4. 手动备份

---

## 🗄️ 方式一：SQL命令备份

### 1.1 完整备份SQL命令
```sql
-- 备份所有Edge函数定义
SELECT 
    '-- Edge函数: ' || function_name || E'\n' ||
    '-- 创建时间: ' || created_at || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;
```

### 1.2 备份Edge函数源代码
```sql
-- 备份所有Edge函数的源代码
SELECT 
    '-- ============================================' || E'\n' ||
    '-- Edge函数: ' || function_name || E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n' ||
    '-- 函数配置:' || E'\n' ||
    '-- 名称: ' || function_name || E'\n' ||
    '-- 状态: ' || status || E'\n' ||
    '-- 版本: ' || version || E'\n' ||
    '-- 入口点: ' || entrypoint || E'\n' ||
    '-- 验证JWT: ' || COALESCE(verify_jwt::text, 'false') || E'\n' ||
    E'\n' ||
    '-- 源代码:' || E'\n' ||
    COALESCE(source_code, '-- 无源代码') || E'\n' ||
    E'\n' ||
    '-- ============================================' || E'\n' ||
    E'\n'
FROM supabase_functions.functions
ORDER BY function_name;
```

### 1.3 生成Edge函数统计
```sql
-- 生成Edge函数统计信息
SELECT 
    '-- Edge函数统计信息' || E'\n' ||
    '-- 总函数数量: ' || COUNT(*) || E'\n' ||
    '-- 活跃函数: ' || COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) || E'\n' ||
    '-- 非活跃函数: ' || COUNT(CASE WHEN status != 'ACTIVE' THEN 1 END) || E'\n' ||
    E'\n' ||
    '-- 函数列表:' || E'\n' ||
    string_agg(
        '--   ' || function_name || ' (v' || version || ', ' || status || ')',
        E'\n'
    ) || E'\n'
FROM supabase_functions.functions;
```

---

## 📁 方式二：本地文件系统备份

### 2.1 PowerShell脚本备份
```powershell
# 运行本地Edge函数备份脚本
powershell -ExecutionPolicy Bypass -File backup_edge_functions_local.ps1
```

### 2.2 手动复制备份
```bash
# 创建备份目录
mkdir backup_edge_functions_$(date +%Y%m%d_%H%M%S)

# 复制所有Edge函数
cp -r supabase/functions/* backup_edge_functions_*/

# 排除_shared目录（可选）
cp -r supabase/functions/* backup_edge_functions_*/ --exclude=_shared
```

### 2.3 压缩备份
```bash
# 创建压缩备份
tar -czf edge_functions_backup_$(date +%Y%m%d_%H%M%S).tar.gz supabase/functions/

# 或者使用zip
zip -r edge_functions_backup_$(date +%Y%m%d_%H%M%S).zip supabase/functions/
```

---

## 🛠️ 方式三：Supabase CLI备份

### 3.1 使用Supabase CLI备份
```bash
# 备份所有Edge函数
supabase functions list

# 备份特定函数
supabase functions download <function-name>

# 备份所有函数到本地
supabase functions download --all
```

### 3.2 导出函数配置
```bash
# 导出函数配置
supabase functions export --output backup/

# 导出特定函数
supabase functions export <function-name> --output backup/
```

---

## 📝 方式四：手动备份

### 4.1 逐个函数备份
```bash
# 列出所有函数
ls supabase/functions/

# 逐个备份函数
for func in supabase/functions/*/; do
    if [ -d "$func" ] && [ "$(basename "$func")" != "_shared" ]; then
        echo "备份函数: $(basename "$func")"
        cp -r "$func" "backup/$(basename "$func")"
    fi
done
```

### 4.2 备份特定函数
```bash
# 备份特定函数
cp -r supabase/functions/admin-reset-password backup/
cp -r supabase/functions/amap-geocoding backup/
cp -r supabase/functions/bulk-link-logistics backup/
# ... 其他函数
```

---

## 🔄 恢复Edge函数

### 恢复方式一：从SQL备份恢复
```sql
-- 使用备份的SQL恢复函数
-- 将备份的SQL文件内容复制到Supabase SQL编辑器中执行
```

### 恢复方式二：从本地文件恢复
```bash
# 恢复所有函数
cp -r backup_edge_functions_*/ supabase/functions/

# 部署函数
supabase functions deploy
```

### 恢复方式三：使用Supabase CLI恢复
```bash
# 从备份部署函数
supabase functions deploy <function-name>

# 部署所有函数
supabase functions deploy
```

---

## 📊 备份验证

### 验证备份完整性
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

---

## 🚀 自动化备份脚本

### 创建定时备份
```bash
#!/bin/bash
# 创建定时备份脚本

BACKUP_DIR="backup_edge_functions_$(date +%Y%m%d_%H%M%S)"
FUNCTIONS_DIR="supabase/functions"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份所有函数
cp -r "$FUNCTIONS_DIR"/* "$BACKUP_DIR/"

# 生成备份报告
echo "Edge函数备份完成: $BACKUP_DIR" > "$BACKUP_DIR/backup_report.txt"
echo "备份时间: $(date)" >> "$BACKUP_DIR/backup_report.txt"
echo "备份函数数量: $(ls -1 "$BACKUP_DIR" | wc -l)" >> "$BACKUP_DIR/backup_report.txt"

# 压缩备份
tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "备份完成: ${BACKUP_DIR}.tar.gz"
```

---

## 📋 备份最佳实践

### 1. 定期备份
- **每日备份**: 开发环境
- **每周备份**: 生产环境
- **发布前备份**: 重要更新前

### 2. 备份验证
- 检查备份文件完整性
- 验证函数代码行数
- 测试备份恢复流程

### 3. 备份存储
- 本地存储 + 云存储
- 版本控制（Git）
- 加密存储（敏感数据）

### 4. 备份文档
- 记录备份时间
- 记录函数变更
- 记录恢复步骤

---

## 🎯 推荐备份策略

### 开发环境
```bash
# 每日自动备份
0 2 * * * /path/to/backup_edge_functions.sh
```

### 生产环境
```bash
# 每周备份 + 发布前备份
0 2 * * 0 /path/to/backup_edge_functions.sh
```

### 紧急备份
```bash
# 手动备份命令
powershell -ExecutionPolicy Bypass -File backup_edge_functions_local.ps1
```

---

## ✅ 备份检查清单

- [ ] 所有Edge函数已备份
- [ ] 备份文件完整性验证
- [ ] 备份时间记录
- [ ] 恢复流程测试
- [ ] 备份文档更新
- [ ] 存储位置确认
- [ ] 访问权限设置

---

**备份完成！所有Edge函数已安全备份。**
