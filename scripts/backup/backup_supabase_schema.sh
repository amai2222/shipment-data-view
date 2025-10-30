#!/bin/bash

# Supabase数据库完整结构备份脚本
# 用于备份表定义、函数、触发器、视图、RLS等

echo "开始备份Supabase数据库结构..."

# 设置变量
DB_HOST="your-supabase-host"
DB_NAME="postgres"
DB_USER="postgres"
DB_PORT="5432"
BACKUP_DIR="./supabase_backup_$(date +%Y%m%d_%H%M%S)"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo "备份目录: $BACKUP_DIR"

# 1. 备份完整数据库结构（不包含数据）
echo "1. 备份完整数据库结构..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/01_complete_schema.sql"

# 2. 备份所有表结构
echo "2. 备份所有表结构..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -t 'public.*' \
    -f "$BACKUP_DIR/02_tables_only.sql"

# 3. 备份所有函数
echo "3. 备份所有函数..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/03_functions.sql" \
    --include-functions

# 4. 备份所有视图
echo "4. 备份所有视图..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/04_views.sql" \
    --include-views

# 5. 备份所有触发器
echo "5. 备份所有触发器..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/05_triggers.sql" \
    --include-triggers

# 6. 备份所有索引
echo "6. 备份所有索引..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/06_indexes.sql" \
    --include-indexes

# 7. 备份所有序列
echo "7. 备份所有序列..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/07_sequences.sql" \
    --include-sequences

# 8. 备份所有约束
echo "8. 备份所有约束..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --schema-only \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/08_constraints.sql" \
    --include-constraints

# 9. 备份所有RLS策略
echo "9. 备份所有RLS策略..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
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
" > "$BACKUP_DIR/09_rls_policies.sql"

# 10. 备份所有自定义类型
echo "10. 备份所有自定义类型..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
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
" > "$BACKUP_DIR/10_custom_types.sql"

# 11. 生成表结构对比脚本
echo "11. 生成表结构对比脚本..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
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
" > "$BACKUP_DIR/11_table_structures.sql"

# 12. 生成函数对比脚本
echo "12. 生成函数对比脚本..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    '-- 函数: ' || n.nspname || '.' || p.proname || E'\n' ||
    pg_get_functiondef(p.oid) || ';' || E'\n'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
" > "$BACKUP_DIR/12_functions_definitions.sql"

echo "备份完成！"
echo "备份文件保存在: $BACKUP_DIR"
echo ""
echo "文件说明:"
echo "01_complete_schema.sql - 完整数据库结构"
echo "02_tables_only.sql - 仅表结构"
echo "03_functions.sql - 仅函数"
echo "04_views.sql - 仅视图"
echo "05_triggers.sql - 仅触发器"
echo "06_indexes.sql - 仅索引"
echo "07_sequences.sql - 仅序列"
echo "08_constraints.sql - 仅约束"
echo "09_rls_policies.sql - RLS策略"
echo "10_custom_types.sql - 自定义类型"
echo "11_table_structures.sql - 表结构对比"
echo "12_functions_definitions.sql - 函数定义对比"
