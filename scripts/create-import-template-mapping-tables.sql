-- 创建导入模板映射系统表

-- 1. 导入模板配置表
CREATE TABLE IF NOT EXISTS public.import_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    platform_name TEXT NOT NULL, -- 平台名称，如"平台A"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id UUID REFERENCES auth.users(id),
    UNIQUE(name)
);

-- 2. 字段映射配置表
CREATE TABLE IF NOT EXISTS public.import_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.import_templates(id) ON DELETE CASCADE,
    source_field TEXT NOT NULL, -- Excel中的字段名
    target_field TEXT NOT NULL, -- 我们系统中的字段名
    field_type TEXT NOT NULL DEFAULT 'text', -- 字段类型: text, number, date, boolean
    is_required BOOLEAN DEFAULT false,
    default_value TEXT, -- 默认值
    transformation_rule TEXT, -- 转换规则，如日期格式等
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, source_field)
);

-- 3. 固定值映射表（用于处理固定映射关系）
CREATE TABLE IF NOT EXISTS public.import_fixed_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.import_templates(id) ON DELETE CASCADE,
    target_field TEXT NOT NULL, -- 我们系统中的字段名
    fixed_value TEXT NOT NULL, -- 固定值
    description TEXT, -- 说明
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, target_field)
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_import_templates_platform ON public.import_templates(platform_name);
CREATE INDEX IF NOT EXISTS idx_import_templates_active ON public.import_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_import_field_mappings_template ON public.import_field_mappings(template_id);
CREATE INDEX IF NOT EXISTS idx_import_fixed_mappings_template ON public.import_fixed_mappings(template_id);

-- 添加注释
COMMENT ON TABLE public.import_templates IS '导入模板配置表';
COMMENT ON TABLE public.import_field_mappings IS '字段映射配置表';
COMMENT ON TABLE public.import_fixed_mappings IS '固定值映射表';

-- 启用RLS
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fixed_mappings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Users can view import templates" ON public.import_templates
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage import templates" ON public.import_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'operator')
        )
    );

CREATE POLICY "Users can view field mappings" ON public.import_field_mappings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage field mappings" ON public.import_field_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'operator')
        )
    );

CREATE POLICY "Users can view fixed mappings" ON public.import_fixed_mappings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage fixed mappings" ON public.import_fixed_mappings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'operator')
        )
    );

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_templates_updated_at 
    BEFORE UPDATE ON public.import_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入示例模板数据
INSERT INTO public.import_templates (name, description, platform_name, created_by_user_id) VALUES
('平台A标准模板', '平台A的标准导入模板，运输单号映射到我们平台的运单号', '平台A', auth.uid()),
('平台B标准模板', '平台B的标准导入模板', '平台B', auth.uid())
ON CONFLICT (name) DO NOTHING;

-- 获取刚插入的模板ID并插入字段映射
DO $$
DECLARE
    template_a_id UUID;
    template_b_id UUID;
BEGIN
    SELECT id INTO template_a_id FROM public.import_templates WHERE name = '平台A标准模板';
    SELECT id INTO template_b_id FROM public.import_templates WHERE name = '平台B标准模板';
    
    -- 平台A的字段映射
    IF template_a_id IS NOT NULL THEN
        INSERT INTO public.import_field_mappings (template_id, source_field, target_field, field_type, is_required, sort_order) VALUES
        (template_a_id, '运输单号', 'auto_number', 'text', true, 1),
        (template_a_id, '项目名称', 'project_name', 'text', true, 2),
        (template_a_id, '司机姓名', 'driver_name', 'text', true, 3),
        (template_a_id, '车牌号', 'license_plate', 'text', true, 4),
        (template_a_id, '装货地点', 'loading_location', 'text', true, 5),
        (template_a_id, '卸货地点', 'unloading_location', 'text', true, 6),
        (template_a_id, '装货日期', 'loading_date', 'date', true, 7),
        (template_a_id, '装货数量', 'loading_weight', 'number', true, 8),
        (template_a_id, '运费', 'current_cost', 'number', false, 9),
        (template_a_id, '备注', 'remarks', 'text', false, 10)
        ON CONFLICT (template_id, source_field) DO NOTHING;
        
        -- 平台A的固定值映射
        INSERT INTO public.import_fixed_mappings (template_id, target_field, fixed_value, description) VALUES
        (template_a_id, 'transport_type', '实际运输', '固定运输类型'),
        (template_a_id, 'chain_name', '默认链路', '固定合作链路')
        ON CONFLICT (template_id, target_field) DO NOTHING;
    END IF;
    
    -- 平台B的字段映射（示例）
    IF template_b_id IS NOT NULL THEN
        INSERT INTO public.import_field_mappings (template_id, source_field, target_field, field_type, is_required, sort_order) VALUES
        (template_b_id, '运单编号', 'auto_number', 'text', true, 1),
        (template_b_id, '项目', 'project_name', 'text', true, 2),
        (template_b_id, '司机', 'driver_name', 'text', true, 3),
        (template_b_id, '车辆', 'license_plate', 'text', true, 4),
        (template_b_id, '起点', 'loading_location', 'text', true, 5),
        (template_b_id, '终点', 'unloading_location', 'text', true, 6),
        (template_b_id, '日期', 'loading_date', 'date', true, 7),
        (template_b_id, '重量', 'loading_weight', 'number', true, 8)
        ON CONFLICT (template_id, source_field) DO NOTHING;
    END IF;
END $$;
