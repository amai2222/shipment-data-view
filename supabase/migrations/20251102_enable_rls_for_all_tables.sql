-- ============================================================================
-- 启用所有表的 RLS (Row Level Security)
-- ============================================================================
-- 问题: Supabase Linter 检测到多个表有 RLS 策略但 RLS 未启用
-- 解决: 为所有相关表启用 RLS
-- ============================================================================
-- 创建时间: 2025-11-02
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: 启用核心业务表的 RLS
-- ============================================================================

-- 运单表
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;

-- 运单成本表
ALTER TABLE public.logistics_partner_costs ENABLE ROW LEVEL SECURITY;

-- 合作方表
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 合作链路表
ALTER TABLE public.partner_chains ENABLE ROW LEVEL SECURITY;

-- 项目表
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 项目合作方表
ALTER TABLE public.project_partners ENABLE ROW LEVEL SECURITY;

-- 付款申请表
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- 开票申请表
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

-- 用户资料表
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 司机表
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 地点表
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 合同表
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 2: 启用备份表的 RLS（可选，建议删除这些备份表）
-- ============================================================================

-- 备份表通常不需要 RLS，但为了满足 linter 要求，我们启用它
-- 建议：将来可以考虑删除这些备份表或移到其他 schema

DO $$
BEGIN
    -- 检查并启用备份表（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'auth_users_backup_20251101') THEN
        ALTER TABLE public.auth_users_backup_20251101 ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'user_permissions_backup_20251101') THEN
        ALTER TABLE public.user_permissions_backup_20251101 ENABLE ROW LEVEL SECURITY;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'role_permission_templates_backup_20251101') THEN
        ALTER TABLE public.role_permission_templates_backup_20251101 ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================================================
-- Step 3: 验证 RLS 状态
-- ============================================================================

DO $$
DECLARE
    v_table_name TEXT;
    v_rls_enabled BOOLEAN;
    v_policy_count INTEGER;
    v_tables TEXT[] := ARRAY[
        'logistics_records',
        'logistics_partner_costs',
        'partners',
        'partner_chains',
        'projects',
        'project_partners',
        'payment_requests',
        'invoice_requests',
        'profiles',
        'drivers',
        'locations',
        'contracts'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS 状态验证';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    FOREACH v_table_name IN ARRAY v_tables
    LOOP
        -- 检查 RLS 是否启用
        SELECT relrowsecurity INTO v_rls_enabled
        FROM pg_class
        WHERE relname = v_table_name 
          AND relnamespace = 'public'::regnamespace;
        
        -- 检查策略数量
        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename = v_table_name;
        
        RAISE NOTICE '表: %', v_table_name;
        RAISE NOTICE '  RLS 已启用: %', CASE WHEN v_rls_enabled THEN '✅' ELSE '❌' END;
        RAISE NOTICE '  策略数量: %', v_policy_count;
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================================
-- 完成信息
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ RLS 启用完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已为以下表启用 RLS:';
    RAISE NOTICE '  ✅ logistics_records (运单表)';
    RAISE NOTICE '  ✅ logistics_partner_costs (运单成本表)';
    RAISE NOTICE '  ✅ partners (合作方表)';
    RAISE NOTICE '  ✅ partner_chains (合作链路表)';
    RAISE NOTICE '  ✅ projects (项目表)';
    RAISE NOTICE '  ✅ project_partners (项目合作方表)';
    RAISE NOTICE '  ✅ payment_requests (付款申请表)';
    RAISE NOTICE '  ✅ invoice_requests (开票申请表)';
    RAISE NOTICE '  ✅ profiles (用户资料表)';
    RAISE NOTICE '  ✅ drivers (司机表)';
    RAISE NOTICE '  ✅ locations (地点表)';
    RAISE NOTICE '  ✅ contracts (合同表)';
    RAISE NOTICE '';
    RAISE NOTICE '注意:';
    RAISE NOTICE '  • 所有表现在都已启用 RLS';
    RAISE NOTICE '  • 现有的 RLS 策略将开始生效';
    RAISE NOTICE '  • 请测试应用功能确保正常';
    RAISE NOTICE '';
    RAISE NOTICE '备份表建议:';
    RAISE NOTICE '  • auth_users_backup_20251101';
    RAISE NOTICE '  • user_permissions_backup_20251101';
    RAISE NOTICE '  • role_permission_templates_backup_20251101';
    RAISE NOTICE '  → 这些表已启用 RLS，但建议将来删除或移到其他 schema';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

