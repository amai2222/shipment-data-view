-- 创建磅单数据表
CREATE TABLE public.scale_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  project_name text NOT NULL,
  loading_date date NOT NULL,
  trip_number integer NOT NULL,
  valid_quantity numeric,
  billing_type_id bigint NOT NULL DEFAULT 1,
  image_urls text[] DEFAULT '{}',
  license_plate text,
  driver_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  user_id uuid NOT NULL DEFAULT auth.uid()
);

-- 启用RLS
ALTER TABLE public.scale_records ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Admins can manage all scale_records"
ON public.scale_records
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Finance can view all scale records"
ON public.scale_records
FOR SELECT
TO authenticated
USING (is_finance_or_admin());

CREATE POLICY "Users can manage their own scale_records"
ON public.scale_records
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE TRIGGER update_scale_records_updated_at
BEFORE UPDATE ON public.scale_records
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 创建索引提高查询性能
CREATE INDEX idx_scale_records_project_id ON public.scale_records(project_id);
CREATE INDEX idx_scale_records_loading_date ON public.scale_records(loading_date);
CREATE INDEX idx_scale_records_license_plate ON public.scale_records(license_plate);
CREATE INDEX idx_scale_records_created_by ON public.scale_records(created_by_user_id);