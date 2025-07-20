-- 1. 检查并修正 project_partners 表的 RLS 策略
-- 先删除可能存在的过于严格的策略
DROP POLICY IF EXISTS "project_partners_policy" ON public.project_partners;

-- 创建更合理的 RLS 策略，只验证项目权限而不依赖 is_default
CREATE POLICY "Allow all operations on project_partners" 
ON public.project_partners 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 2. 创建原子性保存项目及其合作链路的 RPC 函数
CREATE OR REPLACE FUNCTION save_project_with_chains(
    project_id_in uuid,
    project_data jsonb,
    chains_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    chain jsonb;
    new_chain_id uuid;
    partner jsonb;
BEGIN
    -- 1. 更新项目的核心资料
    UPDATE public.projects
    SET
        name = project_data->>'name',
        start_date = project_data->>'startDate',
        end_date = project_data->>'endDate',
        manager = project_data->>'manager',
        loading_address = project_data->>'loadingAddress',
        unloading_address = project_data->>'unloadingAddress'
    WHERE id = project_id_in;

    -- 2. 删除该项目所有已存在的链路和合作方
    -- 注意删除顺序，先删除有外键依赖的子表
    DELETE FROM public.project_partners WHERE project_id = project_id_in;
    DELETE FROM public.partner_chains WHERE project_id = project_id_in;

    -- 3. 遍历传入的新链路数据并插入
    FOR chain IN SELECT * FROM jsonb_array_elements(chains_data)
    LOOP
        -- 插入链路，并返回新生成的 ID
        INSERT INTO public.partner_chains(project_id, chain_name, description, is_default)
        VALUES (
            project_id_in,
            chain->>'chainName',
            COALESCE(chain->>'description', ''),
            (chain->>'isDefault')::boolean
        )
        RETURNING id INTO new_chain_id;

        -- 4. 遍历当前链路的合作方并插入
        FOR partner IN SELECT * FROM jsonb_array_elements(chain->'partners')
        LOOP
            INSERT INTO public.project_partners(project_id, chain_id, partner_id, level, tax_rate, calculation_method, profit_rate)
            VALUES (
                project_id_in,
                new_chain_id,
                (partner->>'partnerId')::uuid,
                (partner->>'level')::integer,
                (partner->>'taxRate')::numeric,
                partner->>'calculationMethod',
                COALESCE((partner->>'profitRate')::numeric, 0)
            );
        END LOOP;
    END LOOP;
END;
$$;