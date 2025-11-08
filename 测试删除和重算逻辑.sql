-- 测试删除和重算逻辑

-- 1. 重算前的状态
SELECT 
    '====== 重算前 ======' as 步骤;

SELECT 
    level,
    payable_amount,
    is_manually_modified,
    base_amount
FROM logistics_partner_costs
WHERE logistics_record_id = (SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')
ORDER BY level;

-- 2. 手工执行删除逻辑（测试）
DO $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM logistics_partner_costs
    WHERE logistics_record_id = (SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')
    AND COALESCE(is_manually_modified, false) = false;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE NOTICE '删除了 % 条记录', v_deleted_count;
END $$;

-- 3. 删除后剩余的记录
SELECT 
    '====== 删除后（应该只剩is_manually_modified=true的）======' as 步骤;

SELECT 
    level,
    payable_amount,
    is_manually_modified
FROM logistics_partner_costs
WHERE logistics_record_id = (SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')
ORDER BY level;

-- 4. 现在手工调用重算函数
SELECT 
    '====== 调用重算函数 ======' as 步骤;

SELECT batch_recalculate_partner_costs(
    ARRAY[(SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')]::UUID[]
);

-- 5. 重算后的结果
SELECT 
    '====== 重算后 ======' as 步骤;

SELECT 
    level,
    ROUND(payable_amount, 2) as 应付金额,
    is_manually_modified,
    ROUND(base_amount, 2) as 基础金额,
    updated_at
FROM logistics_partner_costs
WHERE logistics_record_id = (SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')
ORDER BY level;

-- 6. 验证计算是否正确（假设司机应收=3436.50）
SELECT 
    '====== 验证计算（假设税率：level1=6%, level2=2%） ======' as 步骤;

SELECT 
    '司机应收: 3436.50' as 基础,
    'level1应该= 3436.50/(1-0.06) = ' || ROUND(3436.50 / (1 - 0.06), 2) as level1验证,
    'level2应该= 3436.50/(1-0.02) = ' || ROUND(3436.50 / (1 - 0.02), 2) as level2验证;

