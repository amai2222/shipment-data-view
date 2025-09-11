-- 创建保存搜索表
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('contract', 'logistics', 'payment')),
  filters JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX idx_saved_searches_search_type ON public.saved_searches(search_type);
CREATE INDEX idx_saved_searches_created_at ON public.saved_searches(created_at);

-- 启用RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Users can view their own saved searches" 
ON public.saved_searches FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved searches" 
ON public.saved_searches FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches" 
ON public.saved_searches FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches" 
ON public.saved_searches FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all saved searches" 
ON public.saved_searches FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- 创建更新时间触发器
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
