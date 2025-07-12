-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  manager VARCHAR(255) NOT NULL,
  loading_address TEXT NOT NULL,
  unloading_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建司机表
CREATE TABLE IF NOT EXISTS drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建地点表
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建物流记录表
CREATE TABLE IF NOT EXISTS logistics_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_number VARCHAR(20) NOT NULL UNIQUE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_name VARCHAR(255) NOT NULL,
  loading_time TIMESTAMP WITH TIME ZONE NOT NULL,
  loading_location TEXT NOT NULL,
  unloading_location TEXT NOT NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(255) NOT NULL,
  license_plate VARCHAR(20) NOT NULL,
  driver_phone VARCHAR(20) NOT NULL,
  loading_weight DECIMAL(10,2) NOT NULL,
  unloading_date TIMESTAMP WITH TIME ZONE,
  unloading_weight DECIMAL(10,2),
  transport_type VARCHAR(20) NOT NULL CHECK (transport_type IN ('实际运输', '退货')),
  current_cost DECIMAL(10,2),
  extra_cost DECIMAL(10,2),
  payable_cost DECIMAL(10,2),
  remarks TEXT,
  created_by_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_id ON logistics_records(project_id);
CREATE INDEX IF NOT EXISTS idx_logistics_records_driver_id ON logistics_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_logistics_records_loading_time ON logistics_records(loading_time);
CREATE INDEX IF NOT EXISTS idx_logistics_records_auto_number ON logistics_records(auto_number);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_drivers_name ON drivers(name);
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);

-- 启用行级安全 (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_records ENABLE ROW LEVEL SECURITY;

-- 创建基本的访问策略（允许所有已认证用户访问）
CREATE POLICY "Enable read access for all users" ON projects FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON projects FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON projects FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON drivers FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON drivers FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON drivers FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON locations FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON locations FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON locations FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON logistics_records FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON logistics_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON logistics_records FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON logistics_records FOR DELETE USING (true);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为每个表创建更新时间戳的触发器
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_logistics_records_updated_at BEFORE UPDATE ON logistics_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();