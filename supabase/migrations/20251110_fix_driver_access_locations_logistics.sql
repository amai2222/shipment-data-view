-- ============================================================================
-- 修复司机和车队长访问locations和logistics_records表的RLS策略
-- 创建时间：2025-11-10
-- 问题：司机和车队长无法访问locations表和logistics_records表
-- 解决：在现有策略基础上添加司机和车队长的访问权限
-- ============================================================================

-- ============================================================================
-- 第一步：修复locations表的RLS策略
-- ============================================================================

-- 确保RLS已启用
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 如果locations_select_policy不存在，创建它（所有已认证用户都可以查看地点）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'locations' 
        AND policyname = 'locations_select_policy'
    ) THEN
        CREATE POLICY "locations_select_policy"
        ON public.locations
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END $$;

-- ============================================================================
-- 第二步：修复logistics_records表的RLS策略
-- ============================================================================

-- 确保RLS已启用
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;

-- 更新现有的查询策略，添加司机和车队长的权限
-- 如果策略不存在，先创建；如果存在，先删除再创建（因为PostgreSQL不支持直接修改策略）
DO $$
BEGIN
    -- 如果策略已存在，先删除
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'logistics_records' 
        AND policyname = 'logistics_records_select_policy'
    ) THEN
        DROP POLICY IF EXISTS "logistics_records_select_policy" ON public.logistics_records;
    END IF;
    
    -- 创建新策略，包含原有权限 + 司机和车队长的权限
    CREATE POLICY "logistics_records_select_policy"
    ON public.logistics_records
    FOR SELECT
    TO authenticated
    USING (
        -- 管理员可以看到所有数据
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR
        -- 原有权限：有项目权限的用户可以看到自己项目的运单
        project_id IN (
            SELECT project_id 
            FROM public.user_projects 
            WHERE user_id = auth.uid()
        )
        OR
        -- 新增：车队长可以看到自己管理的司机的运单
        (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'fleet_manager')
            AND EXISTS (
                SELECT 1 FROM internal_drivers
                WHERE internal_drivers.fleet_manager_id = auth.uid()
                AND internal_drivers.name = logistics_records.driver_name
            )
        )
        OR
        -- 新增：司机只能查看自己的运单（通过姓名匹配）
        (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver')
            AND EXISTS (
                SELECT 1 FROM internal_drivers
                WHERE internal_drivers.user_id = auth.uid()
                AND internal_drivers.name = logistics_records.driver_name
            )
        )
        OR
        -- 兼容：如果logistics_records有user_id字段，允许查看自己的数据
        (
            EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'logistics_records' AND column_name = 'user_id')
            AND logistics_records.user_id = auth.uid()
        )
    );
END $$;

-- 添加插入策略（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'logistics_records' 
        AND policyname = 'logistics_records_insert_policy'
    ) THEN
        CREATE POLICY "logistics_records_insert_policy"
        ON public.logistics_records
        FOR INSERT
        TO authenticated
        WITH CHECK (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager', 'driver'))
            OR
            -- 有项目权限的用户也可以创建运单
            EXISTS (SELECT 1 FROM public.user_projects WHERE user_id = auth.uid())
        );
    END IF;
END $$;

-- 添加更新策略（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'logistics_records' 
        AND policyname = 'logistics_records_update_policy'
    ) THEN
        CREATE POLICY "logistics_records_update_policy"
        ON public.logistics_records
        FOR UPDATE
        TO authenticated
        USING (
            -- 管理员可以更新所有
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            OR
            -- 有项目权限的用户可以更新自己项目的运单
            project_id IN (
                SELECT project_id 
                FROM public.user_projects 
                WHERE user_id = auth.uid()
            )
            OR
            -- 车队长可以更新自己管理的司机的运单
            (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'fleet_manager')
                AND EXISTS (
                    SELECT 1 FROM internal_drivers
                    WHERE internal_drivers.fleet_manager_id = auth.uid()
                    AND internal_drivers.name = logistics_records.driver_name
                )
            )
            OR
            -- 司机只能更新自己的运单
            (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'driver')
                AND EXISTS (
                    SELECT 1 FROM internal_drivers
                    WHERE internal_drivers.user_id = auth.uid()
                    AND internal_drivers.name = logistics_records.driver_name
                )
            )
            OR
            -- 兼容：如果logistics_records有user_id字段
            (
                EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'logistics_records' AND column_name = 'user_id')
                AND logistics_records.user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- 添加删除策略（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'logistics_records' 
        AND policyname = 'logistics_records_delete_policy'
    ) THEN
        CREATE POLICY "logistics_records_delete_policy"
        ON public.logistics_records
        FOR DELETE
        TO authenticated
        USING (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- ============================================================================
-- 添加注释
-- ============================================================================

COMMENT ON POLICY "logistics_records_select_policy" ON public.logistics_records IS '运单表查询策略：管理员看全部，有项目权限的用户看自己项目的，车队长看自己司机的，司机看自己的';
