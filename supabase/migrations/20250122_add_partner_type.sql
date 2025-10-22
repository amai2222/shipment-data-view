-- ==========================================
-- 合作方类型字段添加
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 为 partners 表添加类型字段，用于区分货主和合作商
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 创建合作方类型枚举
-- ============================================================

-- 创建合作方类型枚举（如果不存在）
-- 注意：先创建基础的两个类型，其他类型通过后续迁移添加
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'partner_type_enum') THEN
        CREATE TYPE partner_type_enum AS ENUM ('货主', '合作商');
        RAISE NOTICE '已创建枚举类型 partner_type_enum，包含: 货主, 合作商';
        RAISE NOTICE '其他枚举值（资方、本公司）将通过后续迁移添加';
    ELSE
        RAISE NOTICE '枚举类型 partner_type_enum 已存在，跳过创建';
    END IF;
END $$;

-- ============================================================
-- 第二步: 添加类型字段到 partners 表
-- ============================================================

-- 添加合作方类型字段
ALTER TABLE public.partners 
    ADD COLUMN IF NOT EXISTS partner_type partner_type_enum DEFAULT '货主';

-- 添加注释
COMMENT ON COLUMN public.partners.partner_type IS '合作方类型：货主或合作商，默认为货主';

-- ============================================================
-- 第三步: 更新现有数据（如需要）
-- ============================================================

-- 将所有现有记录设置为默认类型（货主）
UPDATE public.partners 
SET partner_type = '合作商' 
WHERE partner_type IS NULL;

-- ============================================================
-- 第四步: 创建索引以提升查询性能
-- ============================================================

-- 为类型字段创建索引
CREATE INDEX IF NOT EXISTS idx_partners_partner_type 
ON public.partners(partner_type);

-- 创建复合索引（类型 + 创建时间）方便按类型查询和排序
CREATE INDEX IF NOT EXISTS idx_partners_type_created 
ON public.partners(partner_type, created_at DESC);

COMMIT;

-- ============================================================
-- 验证查询
-- ============================================================

-- 查看枚举类型定义
-- SELECT enum_range(NULL::partner_type_enum);

-- 查看字段添加结果
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'partners' AND column_name = 'partner_type';

-- 统计各类型合作方数量
-- SELECT partner_type, COUNT(*) as count
-- FROM public.partners
-- GROUP BY partner_type;

