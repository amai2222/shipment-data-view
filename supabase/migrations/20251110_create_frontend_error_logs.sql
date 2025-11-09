-- ============================================================================
-- 前端错误日志表
-- 用于记录前端JavaScript错误、网络错误等
-- ============================================================================

-- 创建前端错误日志表
CREATE TABLE IF NOT EXISTS public.frontend_error_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL, -- 'javascript', 'network', 'react', 'chunk_load', 'unhandled_rejection'
    error_name TEXT,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_info JSONB, -- 存储额外的错误信息（如errorInfo、componentStack等）
    url TEXT, -- 发生错误的页面URL
    user_agent TEXT, -- 浏览器信息
    viewport_width INTEGER, -- 视口宽度
    viewport_height INTEGER, -- 视口高度
    retry_count INTEGER DEFAULT 0, -- 重试次数（如果是自动重试的错误）
    is_resolved BOOLEAN DEFAULT false, -- 是否已解决
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_note TEXT, -- 解决备注
    metadata JSONB DEFAULT '{}'::jsonb, -- 其他元数据（如网络请求详情、组件信息等）
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_user_id ON public.frontend_error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_error_type ON public.frontend_error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_created_at ON public.frontend_error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_is_resolved ON public.frontend_error_logs(is_resolved);
CREATE INDEX IF NOT EXISTS idx_frontend_error_logs_url ON public.frontend_error_logs(url);

-- 添加表注释
COMMENT ON TABLE public.frontend_error_logs IS '前端错误日志表，记录浏览器控制台错误';
COMMENT ON COLUMN public.frontend_error_logs.error_type IS '错误类型：javascript-普通JS错误, network-网络错误, react-React组件错误, chunk_load-懒加载错误, unhandled_rejection-未处理的Promise拒绝';
COMMENT ON COLUMN public.frontend_error_logs.error_info IS '额外的错误信息，如React的errorInfo、componentStack等';
COMMENT ON COLUMN public.frontend_error_logs.metadata IS '其他元数据，如网络请求详情、组件路径、浏览器版本等';

-- 启用RLS
ALTER TABLE public.frontend_error_logs ENABLE ROW LEVEL SECURITY;

-- RLS策略：所有已认证用户都可以插入自己的错误日志
DROP POLICY IF EXISTS "Users can insert their own error logs" ON public.frontend_error_logs;
CREATE POLICY "Users can insert their own error logs"
ON public.frontend_error_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- RLS策略：管理员可以查看所有错误日志
DROP POLICY IF EXISTS "Admins can view all error logs" ON public.frontend_error_logs;
CREATE POLICY "Admins can view all error logs"
ON public.frontend_error_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS策略：用户可以查看自己的错误日志
DROP POLICY IF EXISTS "Users can view their own error logs" ON public.frontend_error_logs;
CREATE POLICY "Users can view their own error logs"
ON public.frontend_error_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS策略：管理员可以更新错误日志（标记为已解决）
DROP POLICY IF EXISTS "Admins can update error logs" ON public.frontend_error_logs;
CREATE POLICY "Admins can update error logs"
ON public.frontend_error_logs
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================================
-- RPC函数：记录前端错误
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_frontend_error(
    p_error_type TEXT,
    p_error_name TEXT,
    p_error_message TEXT,
    p_error_stack TEXT DEFAULT NULL,
    p_error_info JSONB DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_viewport_width INTEGER DEFAULT NULL,
    p_viewport_height INTEGER DEFAULT NULL,
    p_retry_count INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_user_id UUID;
    v_log_id UUID;
    v_result JSONB;
BEGIN
    -- 获取当前用户ID
    v_user_id := auth.uid();
    
    -- 插入错误日志
    INSERT INTO public.frontend_error_logs (
        user_id,
        error_type,
        error_name,
        error_message,
        error_stack,
        error_info,
        url,
        user_agent,
        viewport_width,
        viewport_height,
        retry_count,
        metadata
    ) VALUES (
        v_user_id,
        p_error_type,
        p_error_name,
        p_error_message,
        p_error_stack,
        p_error_info,
        COALESCE(p_url, current_setting('request.headers', true)::json->>'referer'),
        p_user_agent,
        p_viewport_width,
        p_viewport_height,
        p_retry_count,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_log_id;
    
    -- 返回成功结果
    v_result := jsonb_build_object(
        'success', true,
        'log_id', v_log_id,
        'message', '错误日志已记录'
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    -- 记录失败时返回错误信息（但不抛出异常，避免影响用户体验）
    RETURN jsonb_build_object(
        'success', false,
        'message', '记录错误日志失败: ' || SQLERRM
    );
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION public.log_frontend_error IS '记录前端错误到数据库';

-- 授予执行权限
GRANT EXECUTE ON FUNCTION public.log_frontend_error TO authenticated;

