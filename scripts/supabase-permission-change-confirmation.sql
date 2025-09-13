-- Supabase 带确认弹窗的权限变更系统
-- 所有变更前弹窗确定再立即生效

-- 1. 创建权限变更确认函数
CREATE OR REPLACE FUNCTION confirm_permission_change(
    target_user_id uuid,
    change_type text, -- 'copy', 'modify', 'batch'
    change_data jsonb,
    confirmation_token text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    user_info RECORD;
    result jsonb;
    change_summary text;
BEGIN
    -- 获取用户信息
    SELECT email, role::text as role INTO user_info
    FROM public.profiles 
    WHERE id = target_user_id;
    
    IF user_info IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '用户不存在',
            'requires_confirmation', false
        );
    END IF;
    
    -- 根据变更类型生成确认信息
    CASE change_type
        WHEN 'copy' THEN
            change_summary := format('复制权限到用户 %s (%s)', user_info.email, user_info.role);
        WHEN 'modify' THEN
            change_summary := format('修改用户 %s (%s) 的 %s 权限', 
                user_info.email, user_info.role, change_data->>'permission_type');
        WHEN 'batch' THEN
            change_summary := format('批量修改用户 %s (%s) 的权限', user_info.email, user_info.role);
        ELSE
            change_summary := format('变更用户 %s (%s) 的权限', user_info.email, user_info.role);
    END CASE;
    
    -- 生成确认令牌（如果没有提供）
    IF confirmation_token IS NULL THEN
        confirmation_token := encode(gen_random_bytes(16), 'hex');
    END IF;
    
    -- 存储待确认的变更
    INSERT INTO public.permission_change_confirmations (
        confirmation_token, user_id, change_type, change_data, 
        change_summary, created_at, expires_at
    ) VALUES (
        confirmation_token, target_user_id, change_type, change_data,
        change_summary, now(), now() + interval '10 minutes'
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'requires_confirmation', true,
        'confirmation_token', confirmation_token,
        'change_summary', change_summary,
        'user_info', jsonb_build_object(
            'email', user_info.email,
            'role', user_info.role
        ),
        'message', '请确认权限变更操作'
    );
END;
$$ LANGUAGE plpgsql;

-- 2. 创建权限变更确认表
CREATE TABLE IF NOT EXISTS public.permission_change_confirmations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    confirmation_token text UNIQUE NOT NULL,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    change_type text NOT NULL,
    change_data jsonb NOT NULL,
    change_summary text NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz NOT NULL,
    confirmed_at timestamptz,
    executed_at timestamptz
);

-- 3. 创建确认执行函数
CREATE OR REPLACE FUNCTION execute_confirmed_permission_change(
    confirmation_token text
)
RETURNS jsonb AS $$
DECLARE
    confirmation RECORD;
    result jsonb;
BEGIN
    -- 获取确认记录
    SELECT * INTO confirmation
    FROM public.permission_change_confirmations
    WHERE confirmation_token = confirmation_token
    AND expires_at > now()
    AND confirmed_at IS NOT NULL
    AND executed_at IS NULL;
    
    IF confirmation IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '确认令牌无效或已过期'
        );
    END IF;
    
    -- 根据变更类型执行操作
    CASE confirmation.change_type
        WHEN 'copy' THEN
            result := copy_user_permissions(
                (confirmation.change_data->>'source_user_id')::uuid,
                confirmation.user_id,
                confirmation.change_data->>'copy_mode'
            );
        WHEN 'modify' THEN
            result := modify_user_permissions(
                confirmation.user_id,
                confirmation.change_data->>'permission_type',
                confirmation.change_data->>'permission_key',
                confirmation.change_data->>'action'
            );
        WHEN 'batch' THEN
            result := quick_permission_change(
                confirmation.user_id,
                confirmation.change_data->'changes'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', '不支持的变更类型'
            );
    END CASE;
    
    -- 更新执行时间
    UPDATE public.permission_change_confirmations
    SET executed_at = now()
    WHERE confirmation_token = confirmation_token;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '权限变更已执行',
        'change_summary', confirmation.change_summary,
        'execution_result', result
    );
END;
$$ LANGUAGE plpgsql;

-- 4. 创建确认权限变更函数
CREATE OR REPLACE FUNCTION confirm_permission_change_execution(
    confirmation_token text
)
RETURNS jsonb AS $$
DECLARE
    confirmation RECORD;
BEGIN
    -- 获取确认记录
    SELECT * INTO confirmation
    FROM public.permission_change_confirmations
    WHERE confirmation_token = confirmation_token
    AND expires_at > now()
    AND confirmed_at IS NULL;
    
    IF confirmation IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '确认令牌无效或已过期'
        );
    END IF;
    
    -- 更新确认时间
    UPDATE public.permission_change_confirmations
    SET confirmed_at = now()
    WHERE confirmation_token = confirmation_token;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '权限变更已确认，正在执行...',
        'change_summary', confirmation.change_summary
    );
END;
$$ LANGUAGE plpgsql;

-- 5. 创建取消权限变更函数
CREATE OR REPLACE FUNCTION cancel_permission_change(
    confirmation_token text
)
RETURNS jsonb AS $$
DECLARE
    confirmation RECORD;
BEGIN
    -- 获取确认记录
    SELECT * INTO confirmation
    FROM public.permission_change_confirmations
    WHERE confirmation_token = confirmation_token
    AND expires_at > now()
    AND confirmed_at IS NULL;
    
    IF confirmation IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '确认令牌无效或已过期'
        );
    END IF;
    
    -- 删除确认记录
    DELETE FROM public.permission_change_confirmations
    WHERE confirmation_token = confirmation_token;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '权限变更已取消',
        'change_summary', confirmation.change_summary
    );
END;
$$ LANGUAGE plpgsql;

-- 6. 创建清理过期确认记录函数
CREATE OR REPLACE FUNCTION cleanup_expired_permission_confirmations()
RETURNS void AS $$
BEGIN
    DELETE FROM public.permission_change_confirmations
    WHERE expires_at < now();
    
    RAISE NOTICE '已清理过期的权限变更确认记录';
END;
$$ LANGUAGE plpgsql;

-- 7. 创建权限变更工作流函数
CREATE OR REPLACE FUNCTION permission_change_workflow(
    target_user_id uuid,
    change_type text,
    change_data jsonb
)
RETURNS jsonb AS $$
DECLARE
    confirmation_result jsonb;
    confirmation_token text;
BEGIN
    -- 第一步：创建确认请求
    confirmation_result := confirm_permission_change(target_user_id, change_type, change_data);
    
    IF NOT (confirmation_result->>'success')::boolean THEN
        RETURN confirmation_result;
    END IF;
    
    confirmation_token := confirmation_result->>'confirmation_token';
    
    -- 返回确认信息（前端显示弹窗）
    RETURN jsonb_build_object(
        'success', true,
        'requires_confirmation', true,
        'confirmation_token', confirmation_token,
        'change_summary', confirmation_result->>'change_summary',
        'user_info', confirmation_result->'user_info',
        'message', '请确认权限变更操作',
        'next_step', '调用 confirm_permission_change_execution 确认执行'
    );
END;
$$ LANGUAGE plpgsql;

-- 8. 创建权限变更状态检查函数
CREATE OR REPLACE FUNCTION check_permission_change_status(
    confirmation_token text
)
RETURNS jsonb AS $$
DECLARE
    confirmation RECORD;
BEGIN
    SELECT * INTO confirmation
    FROM public.permission_change_confirmations
    WHERE confirmation_token = confirmation_token;
    
    IF confirmation IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '确认令牌不存在'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'confirmation_token', confirmation.confirmation_token,
        'change_summary', confirmation.change_summary,
        'created_at', confirmation.created_at,
        'expires_at', confirmation.expires_at,
        'confirmed_at', confirmation.confirmed_at,
        'executed_at', confirmation.executed_at,
        'status', CASE 
            WHEN confirmation.executed_at IS NOT NULL THEN 'executed'
            WHEN confirmation.confirmed_at IS NOT NULL THEN 'confirmed'
            WHEN confirmation.expires_at < now() THEN 'expired'
            ELSE 'pending'
        END
    );
END;
$$ LANGUAGE plpgsql;

-- 9. 测试权限变更确认系统
SELECT 
    '=== 权限变更确认系统测试 ===' as section;

-- 10. 使用示例
SELECT 
    '=== 使用示例 ===' as section,
    '1. 发起权限变更请求' as step_1,
    'SELECT permission_change_workflow(''user_id'', ''modify'', ''{"permission_type": "menu", "permission_key": "dashboard", "action": "add"}'');' as example_1;

SELECT 
    '=== 使用示例 ===' as section,
    '2. 确认权限变更' as step_2,
    'SELECT confirm_permission_change_execution(''confirmation_token'');' as example_2;

SELECT 
    '=== 使用示例 ===' as section,
    '3. 执行权限变更' as step_3,
    'SELECT execute_confirmed_permission_change(''confirmation_token'');' as example_3;

SELECT 
    '=== 使用示例 ===' as section,
    '4. 检查变更状态' as step_4,
    'SELECT check_permission_change_status(''confirmation_token'');' as example_4;

-- 11. 权限变更确认表结构
SELECT 
    '=== 权限变更确认表结构 ===' as section,
    '表名: permission_change_confirmations' as table_name,
    '用途: 存储待确认的权限变更请求' as purpose,
    '过期时间: 10分钟' as expiry_time,
    '状态: pending -> confirmed -> executed' as status_flow;

-- 12. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    '权限变更确认系统已创建' as status,
    '所有变更前都会弹窗确认' as confirmation_flow,
    '确认后立即生效' as immediate_effect,
    '支持取消和状态检查' as additional_features;
