-- ============================================================================
-- 创建第三方平台 Token 缓存表
-- 创建日期：2025-01-16
-- 功能：存储第三方平台的认证 Token，实现跨 Edge Function 调用的 Token 缓存
-- ============================================================================

-- 创建 Token 缓存表
CREATE TABLE IF NOT EXISTS public.tracking_token_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========== Token 信息 ==========
    token_type TEXT NOT NULL,                    -- Token 类型：'add' 或 'query'
    token_value TEXT NOT NULL,                    -- Token 值
    expires_at TIMESTAMPTZ NOT NULL,              -- Token 过期时间
    
    -- ========== 元数据 ==========
    created_at TIMESTAMPTZ DEFAULT NOW(),        -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),        -- 更新时间
    
    -- ========== 约束 ==========
    CONSTRAINT tracking_token_cache_type_unique UNIQUE (token_type)
);

-- 创建索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_tracking_token_cache_type 
ON public.tracking_token_cache(token_type);

CREATE INDEX IF NOT EXISTS idx_tracking_token_cache_expires_at 
ON public.tracking_token_cache(expires_at);

-- 添加注释
COMMENT ON TABLE public.tracking_token_cache IS '第三方平台 Token 缓存表：存储添加车辆和查询车辆的认证 Token';
COMMENT ON COLUMN public.tracking_token_cache.token_type IS 'Token 类型：add-添加车辆, query-查询车辆';
COMMENT ON COLUMN public.tracking_token_cache.token_value IS 'Token 值（Auth-Session）';
COMMENT ON COLUMN public.tracking_token_cache.expires_at IS 'Token 过期时间（通常为获取后25分钟）';

-- 创建自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_tracking_token_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tracking_token_cache_updated_at
    BEFORE UPDATE ON public.tracking_token_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_tracking_token_cache_updated_at();

-- 创建 RLS 策略（允许所有用户读取，但只有服务角色可以写入）
ALTER TABLE public.tracking_token_cache ENABLE ROW LEVEL SECURITY;

-- 允许所有用户读取（Edge Functions 使用服务角色，不受此限制）
CREATE POLICY "允许读取 Token 缓存"
    ON public.tracking_token_cache
    FOR SELECT
    USING (true);

-- 允许服务角色写入（Edge Functions 使用服务角色密钥）
-- 注意：服务角色密钥会绕过 RLS，所以这个策略主要用于明确权限

