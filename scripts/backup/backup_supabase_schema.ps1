# Supabase数据库完整结构备份脚本 (PowerShell版本)
# 用于备份表定义、函数、触发器、视图、RLS等

param(
    [string]$DB_HOST = "your-supabase-host",
    [string]$DB_NAME = "postgres", 
    [string]$DB_USER = "postgres",
    [string]$DB_PORT = "5432",
    [string]$DB_PASSWORD = "your-password"
)

# 设置环境变量
$env:PGPASSWORD = $DB_PASSWORD

# 创建备份目录
$BackupDir = ".\supabase_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $BackupDir -Force

Write-Host "开始备份Supabase数据库结构..." -ForegroundColor Green
Write-Host "备份目录: $BackupDir" -ForegroundColor Yellow

try {
    # 1. 备份完整数据库结构（不包含数据）
    Write-Host "1. 备份完整数据库结构..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\01_complete_schema.sql"

    # 2. 备份所有表结构
    Write-Host "2. 备份所有表结构..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -t 'public.*' -f "$BackupDir\02_tables_only.sql"

    # 3. 备份所有函数
    Write-Host "3. 备份所有函数..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\03_functions.sql" --include-functions

    # 4. 备份所有视图
    Write-Host "4. 备份所有视图..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\04_views.sql" --include-views

    # 5. 备份所有触发器
    Write-Host "5. 备份所有触发器..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\05_triggers.sql" --include-triggers

    # 6. 备份所有索引
    Write-Host "6. 备份所有索引..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\06_indexes.sql" --include-indexes

    # 7. 备份所有序列
    Write-Host "7. 备份所有序列..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\07_sequences.sql" --include-sequences

    # 8. 备份所有约束
    Write-Host "8. 备份所有约束..." -ForegroundColor Cyan
    & pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only --no-owner --no-privileges -f "$BackupDir\08_constraints.sql" --include-constraints

    # 9. 备份所有RLS策略
    Write-Host "9. 备份所有RLS策略..." -ForegroundColor Cyan
    $rlsQuery = @"
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
"@
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $rlsQuery -o "$BackupDir\09_rls_policies.sql"

    # 10. 备份所有自定义类型
    Write-Host "10. 备份所有自定义类型..." -ForegroundColor Cyan
    $typesQuery = @"
SELECT 
    '-- 自定义类型: ' || t.typname || E'\n' ||
    'CREATE TYPE ' || n.nspname || '.' || t.typname || ' AS ' || 
    CASE 
        WHEN t.typtype = 'e' THEN 'ENUM (' || 
            (SELECT string_agg('''' || enumlabel || '''', ', ' ORDER BY enumsortorder)
             FROM pg_enum e WHERE e.enumtypid = t.oid) || ')'
        WHEN t.typtype = 'c' THEN 'COMPOSITE'
        WHEN t.typtype = 'd' THEN 'DOMAIN'
        ELSE 'UNKNOWN'
    END || ';' || E'\n'
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
AND t.typtype IN ('c', 'e', 'd')
ORDER BY t.typname;
"@
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $typesQuery -o "$BackupDir\10_custom_types.sql"

    # 11. 生成表结构对比脚本
    Write-Host "11. 生成表结构对比脚本..." -ForegroundColor Cyan
    $tableQuery = @"
SELECT 
    '-- 表结构: ' || schemaname || '.' || tablename || E'\n' ||
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' || E'\n' ||
    string_agg(
        '    ' || column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
            WHEN data_type = 'character' THEN 'char(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE data_type
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ',' || E'\n'
    ) || E'\n' || ');' || E'\n'
FROM information_schema.columns c
JOIN information_schema.tables t ON c.table_name = t.table_name
WHERE t.table_schema = 'public' 
AND t.table_type = 'BASE TABLE'
GROUP BY schemaname, tablename
ORDER BY tablename;
"@
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $tableQuery -o "$BackupDir\11_table_structures.sql"

    # 12. 生成函数对比脚本
    Write-Host "12. 生成函数对比脚本..." -ForegroundColor Cyan
    $functionQuery = @"
SELECT 
    '-- 函数: ' || n.nspname || '.' || p.proname || E'\n' ||
    pg_get_functiondef(p.oid) || ';' || E'\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
"@
    & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c $functionQuery -o "$BackupDir\12_functions_definitions.sql"

    Write-Host "备份完成！" -ForegroundColor Green
    Write-Host "备份文件保存在: $BackupDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "文件说明:" -ForegroundColor Cyan
    Write-Host "01_complete_schema.sql - 完整数据库结构"
    Write-Host "02_tables_only.sql - 仅表结构"
    Write-Host "03_functions.sql - 仅函数"
    Write-Host "04_views.sql - 仅视图"
    Write-Host "05_triggers.sql - 仅触发器"
    Write-Host "06_indexes.sql - 仅索引"
    Write-Host "07_sequences.sql - 仅序列"
    Write-Host "08_constraints.sql - 仅约束"
    Write-Host "09_rls_policies.sql - RLS策略"
    Write-Host "10_custom_types.sql - 自定义类型"
    Write-Host "11_table_structures.sql - 表结构对比"
    Write-Host "12_functions_definitions.sql - 函数定义对比"

} catch {
    Write-Host "备份过程中出现错误: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # 清理环境变量
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
