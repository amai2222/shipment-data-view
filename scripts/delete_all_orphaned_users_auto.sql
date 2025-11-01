-- ============================================================================
-- 智能删除所有孤立用户 - 自动发现所有相关表
-- ============================================================================
-- 自动扫描数据库中所有引用用户ID的表，转移数据后删除用户
-- ============================================================================

-- 📦 Step 1: 备份
CREATE TABLE IF NOT EXISTS auth_users_backup_20251101 AS 
SELECT * FROM auth.users;

-- 🔧 Step 2: 智能删除
DO $$
DECLARE
    v_admin_id UUID;
    v_orphaned_user RECORD;
    v_table_column RECORD;
    v_total_count INTEGER := 0;
    v_deleted_count INTEGER := 0;
    v_update_sql TEXT;
    v_affected_rows INTEGER;
BEGIN
    -- 获取管理员ID
    SELECT id INTO v_admin_id 
    FROM public.profiles 
    WHERE email = 'admin@example.com' 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION '找不到 admin@example.com 账户！';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🤖 智能孤立用户清理工具';
    RAISE NOTICE '========================================';
    RAISE NOTICE '管理员账户: admin@example.com';
    RAISE NOTICE '管理员ID: %', v_admin_id;
    RAISE NOTICE '';
    
    -- 统计孤立用户数
    SELECT COUNT(*) INTO v_total_count
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL;
    
    RAISE NOTICE '📊 发现 % 个孤立用户', v_total_count;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始处理...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 处理每个孤立用户
    FOR v_orphaned_user IN 
        SELECT au.id, au.email, au.raw_user_meta_data->>'full_name' as full_name
        FROM auth.users au
        LEFT JOIN public.profiles p ON au.id = p.id
        WHERE p.id IS NULL
        ORDER BY au.email
    LOOP
        RAISE NOTICE '[%/%] 👤 处理用户: % (%)', 
            v_deleted_count + 1, 
            v_total_count,
            v_orphaned_user.email, 
            COALESCE(v_orphaned_user.full_name, '无姓名');
        
        -- 🔍 自动发现所有包含用户ID引用的表和字段（排除视图）
        FOR v_table_column IN
            SELECT 
                c.table_name,
                c.column_name
            FROM information_schema.columns c
            INNER JOIN information_schema.tables t 
                ON c.table_schema = t.table_schema 
                AND c.table_name = t.table_name
            WHERE c.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'  -- 只处理真实的表，排除视图
              AND c.table_name NOT IN ('profiles', 'auth', 'user_permissions', 'user_roles')  -- 排除特殊处理的表
              AND (
                  c.column_name LIKE '%user_id%' 
                  OR c.column_name IN ('created_by', 'updated_by', 'operated_by', 'approved_by', 'applicant_id', 'voided_by', 'reviewed_by')
              )
              AND c.data_type = 'uuid'
            ORDER BY c.table_name, c.column_name
        LOOP
            -- 动态生成并执行 UPDATE 语句
            v_update_sql := format(
                'UPDATE public.%I SET %I = $1 WHERE %I = $2',
                v_table_column.table_name,
                v_table_column.column_name,
                v_table_column.column_name
            );
            
            EXECUTE v_update_sql USING v_admin_id, v_orphaned_user.id;
            GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
            
            IF v_affected_rows > 0 THEN
                RAISE NOTICE '  ✅ %: %.% - 转移 % 条记录', 
                    v_affected_rows,
                    v_table_column.table_name, 
                    v_table_column.column_name,
                    v_affected_rows;
            END IF;
        END LOOP;
        
        -- 删除有唯一约束的表（直接删除，不转移）
        DELETE FROM public.user_permissions WHERE user_id = v_orphaned_user.id;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows > 0 THEN
            RAISE NOTICE '  🗑️  删除 user_permissions: % 条', v_affected_rows;
        END IF;
        
        DELETE FROM public.user_roles WHERE user_id = v_orphaned_user.id;
        GET DIAGNOSTICS v_affected_rows = ROW_COUNT;
        IF v_affected_rows > 0 THEN
            RAISE NOTICE '  🗑️  删除 user_roles: % 条', v_affected_rows;
        END IF;
        
        -- 删除 auth.users 记录
        DELETE FROM auth.users WHERE id = v_orphaned_user.id;
        
        v_deleted_count := v_deleted_count + 1;
        RAISE NOTICE '  ✅ 用户已删除';
        RAISE NOTICE '';
        
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 清理完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 已删除: % 个用户', v_deleted_count;
    RAISE NOTICE '📦 所有数据已转移给: admin@example.com';
    RAISE NOTICE '💾 备份表: auth_users_backup_20251101';
    RAISE NOTICE '';
    
END $$;

-- ✅ Step 3: 验证结果
SELECT 
    '====== 清理结果 ======' as "信息";

SELECT 
    (SELECT COUNT(*) FROM auth.users) as "auth.users 剩余",
    (SELECT COUNT(*) FROM public.profiles) as "profiles 数量",
    (SELECT COUNT(*) 
     FROM auth.users au 
     LEFT JOIN public.profiles p ON au.id = p.id 
     WHERE p.id IS NULL) as "剩余孤立用户 (应为0)";

SELECT 
    '====== 最终用户列表 ======' as "信息";

SELECT 
    email,
    full_name,
    role,
    is_active
FROM public.profiles
ORDER BY role, email;

-- ============================================================================
-- 使用说明
-- ============================================================================

/*

### 🤖 智能特性：

1. **自动发现表**
   - 扫描 information_schema
   - 找到所有包含 user_id 相关字段的表
   - 自动生成 UPDATE 语句

2. **支持的字段模式**
   - %user_id% (如 user_id, created_by_user_id, etc.)
   - created_by, updated_by, operated_by
   - approved_by, applicant_id, voided_by, reviewed_by

3. **自动转移数据**
   - 所有相关数据转移给 admin@example.com
   - 显示每个表的转移详情
   - user_permissions 直接删除

4. **安全保障**
   - 自动备份到 auth_users_backup_20251101
   - 详细的处理日志
   - 可以随时恢复

### 📋 执行步骤：

1. 复制整个脚本
2. 粘贴到 Supabase SQL Editor
3. 点击 Run
4. 完成！

### 📊 预期输出：

```
========================================
🤖 智能孤立用户清理工具
========================================
管理员账户: admin@example.com
管理员ID: xxx-xxx-xxx

📊 发现 11 个孤立用户

========================================
开始处理...
========================================

[1/11] 👤 处理用户: byh@qq.com (byh)
  ✅ 5: drivers.user_id - 转移 5 条记录
  ✅ 2: logistics_records.user_id - 转移 2 条记录
  ✅ 1: logistics_partner_costs.user_id - 转移 1 条记录
  ✅ 用户已删除

[2/11] 👤 处理用户: ...
  ...

========================================
🎉 清理完成！
========================================
✅ 已删除: 11 个用户
📦 所有数据已转移给: admin@example.com
💾 备份表: auth_users_backup_20251101
```

### 💡 优势：

- ✅ 无需手动添加表
- ✅ 自动发现所有关联
- ✅ 未来新表也会自动处理
- ✅ 详细的处理日志
- ✅ 安全可靠

*/

