-- 验证重算是否真的执行

-- 手工执行重算函数测试
SELECT batch_recalculate_partner_costs(
    ARRAY[
        (SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007')
    ]::UUID[]
);

-- 查看执行后的结果
SELECT 
    level,
    payable_amount,
    is_manually_modified,
    updated_at
FROM logistics_partner_costs
WHERE logistics_record_id = (
    SELECT id FROM logistics_records WHERE auto_number = 'YDN20251020-007'
)
ORDER BY level;

