-- 添加字段值转换规则支持
-- 使用 validation_rules JSONB 字段存储转换规则

-- 确保 validation_rules 字段存在（如果不存在则添加）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'import_field_mappings' 
        AND column_name = 'validation_rules'
    ) THEN
        ALTER TABLE public.import_field_mappings 
        ADD COLUMN validation_rules jsonb DEFAULT '{}';
    END IF;
END $$;

-- 添加注释说明
COMMENT ON COLUMN public.import_field_mappings.validation_rules IS 
'字段值转换规则（JSON格式）
示例：
{
  "value_mappings": {
    "正常": "成丰6",
    "异常": "不合规",
    "default": "不合规"
  }
}
当Excel值为"正常"时，转换为"成丰6"；其他值转换为"不合规"';

