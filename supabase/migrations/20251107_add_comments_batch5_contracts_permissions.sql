-- ============================================================================
-- 为合同和权限表添加字段中文注释 - 第5批（最后一批）
-- 创建日期：2025-11-07
-- 范围：合同相关、权限相关、导入相关表
-- ============================================================================

-- ============================================================================
-- 1. 合同相关表
-- ============================================================================

-- contract_file_versions（合同文件版本表）- 13个字段
COMMENT ON TABLE contract_file_versions IS '合同文件版本管理表';
COMMENT ON COLUMN contract_file_versions.id IS '主键ID';
COMMENT ON COLUMN contract_file_versions.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_file_versions.file_type IS '文件类型：original-原件, attachment-附件';
COMMENT ON COLUMN contract_file_versions.file_name IS '文件名';
COMMENT ON COLUMN contract_file_versions.file_url IS '文件URL';
COMMENT ON COLUMN contract_file_versions.file_size IS '文件大小（字节）';
COMMENT ON COLUMN contract_file_versions.file_hash IS '文件哈希值（MD5）';
COMMENT ON COLUMN contract_file_versions.version_number IS '版本号';
COMMENT ON COLUMN contract_file_versions.is_current IS '是否当前版本';
COMMENT ON COLUMN contract_file_versions.uploaded_by IS '上传人ID';
COMMENT ON COLUMN contract_file_versions.uploaded_at IS '上传时间';
COMMENT ON COLUMN contract_file_versions.description IS '版本说明';
COMMENT ON COLUMN contract_file_versions.updated_at IS '更新时间';

-- contract_access_logs（合同访问日志表）- 9个字段
COMMENT ON TABLE contract_access_logs IS '合同访问日志表（记录谁查看了哪个合同）';
COMMENT ON COLUMN contract_access_logs.id IS '主键ID';
COMMENT ON COLUMN contract_access_logs.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_access_logs.user_id IS '访问用户ID（关联auth.users表）';
COMMENT ON COLUMN contract_access_logs.action IS '操作类型：view-查看, download-下载, edit-编辑';
COMMENT ON COLUMN contract_access_logs.details IS '操作详情（JSONB格式）';
COMMENT ON COLUMN contract_access_logs.ip_address IS '访问IP地址';
COMMENT ON COLUMN contract_access_logs.user_agent IS '用户代理（浏览器信息）';
COMMENT ON COLUMN contract_access_logs.created_at IS '访问时间';
COMMENT ON COLUMN contract_access_logs.updated_at IS '更新时间';

-- contract_reminders（合同提醒表）- 9个字段
COMMENT ON TABLE contract_reminders IS '合同到期提醒表';
COMMENT ON COLUMN contract_reminders.id IS '主键ID';
COMMENT ON COLUMN contract_reminders.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_reminders.reminder_type IS '提醒类型：expiry-到期提醒, renewal-续签提醒';
COMMENT ON COLUMN contract_reminders.reminder_date IS '提醒日期';
COMMENT ON COLUMN contract_reminders.is_sent IS '是否已发送';
COMMENT ON COLUMN contract_reminders.sent_at IS '发送时间';
COMMENT ON COLUMN contract_reminders.recipient_emails IS '接收人邮箱数组';
COMMENT ON COLUMN contract_reminders.created_at IS '创建时间';
COMMENT ON COLUMN contract_reminders.updated_at IS '更新时间';

-- contract_tags（合同标签表）- 7个字段
COMMENT ON TABLE contract_tags IS '合同标签表';
COMMENT ON COLUMN contract_tags.id IS '主键ID';
COMMENT ON COLUMN contract_tags.name IS '标签名称';
COMMENT ON COLUMN contract_tags.color IS '标签颜色（hex代码）';
COMMENT ON COLUMN contract_tags.description IS '标签描述';
COMMENT ON COLUMN contract_tags.is_system IS '是否系统标签（不可删除）';
COMMENT ON COLUMN contract_tags.created_at IS '创建时间';
COMMENT ON COLUMN contract_tags.updated_at IS '更新时间';

-- contract_tag_relations（合同标签关系表）- 5个字段
COMMENT ON TABLE contract_tag_relations IS '合同标签关联表（多对多关系）';
COMMENT ON COLUMN contract_tag_relations.id IS '主键ID';
COMMENT ON COLUMN contract_tag_relations.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_tag_relations.tag_id IS '标签ID（关联contract_tags表）';
COMMENT ON COLUMN contract_tag_relations.created_at IS '创建时间';
COMMENT ON COLUMN contract_tag_relations.updated_at IS '更新时间';

-- contract_numbering_rules（合同编号规则表）- 10个字段
COMMENT ON TABLE contract_numbering_rules IS '合同编号规则表（自动生成合同编号）';
COMMENT ON COLUMN contract_numbering_rules.id IS '主键ID';
COMMENT ON COLUMN contract_numbering_rules.category IS '合同类别（枚举类型）';
COMMENT ON COLUMN contract_numbering_rules.prefix IS '编号前缀';
COMMENT ON COLUMN contract_numbering_rules.format IS '编号格式（如：{prefix}{year}{sequence}）';
COMMENT ON COLUMN contract_numbering_rules.current_sequence IS '当前序号';
COMMENT ON COLUMN contract_numbering_rules.year IS '年份（序号按年重置）';
COMMENT ON COLUMN contract_numbering_rules.month IS '月份（序号按月重置）';
COMMENT ON COLUMN contract_numbering_rules.is_active IS '是否启用';
COMMENT ON COLUMN contract_numbering_rules.created_at IS '创建时间';
COMMENT ON COLUMN contract_numbering_rules.updated_at IS '更新时间';

-- ============================================================================
-- 2. 权限相关表
-- ============================================================================

-- contract_permissions（合同权限表）- 10个字段
COMMENT ON TABLE contract_permissions IS '合同权限表（用户对合同的访问权限）';
COMMENT ON COLUMN contract_permissions.id IS '主键ID';
COMMENT ON COLUMN contract_permissions.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_permissions.user_id IS '用户ID（关联auth.users表）';
COMMENT ON COLUMN contract_permissions.department IS '部门';
COMMENT ON COLUMN contract_permissions.permission_type IS '权限类型：owner-所有者, viewer-查看者, editor-编辑者';
COMMENT ON COLUMN contract_permissions.field_permissions IS '字段权限（JSONB格式）';
COMMENT ON COLUMN contract_permissions.file_permissions IS '文件权限（JSONB格式）';
COMMENT ON COLUMN contract_permissions.created_at IS '创建时间';
COMMENT ON COLUMN contract_permissions.updated_at IS '更新时间';
COMMENT ON COLUMN contract_permissions.is_active IS '是否启用';

-- contract_owner_permissions（合同所有者权限表）- 6个字段
COMMENT ON TABLE contract_owner_permissions IS '合同所有者权限表';
COMMENT ON COLUMN contract_owner_permissions.id IS '主键ID';
COMMENT ON COLUMN contract_owner_permissions.contract_id IS '合同ID（关联contracts表）';
COMMENT ON COLUMN contract_owner_permissions.owner_id IS '所有者ID（关联auth.users表）';
COMMENT ON COLUMN contract_owner_permissions.permissions IS '权限数组';
COMMENT ON COLUMN contract_owner_permissions.created_at IS '创建时间';
COMMENT ON COLUMN contract_owner_permissions.updated_at IS '更新时间';

-- contract_category_permission_templates（合同类别权限模板表）- 9个字段
COMMENT ON TABLE contract_category_permission_templates IS '合同类别权限模板表';
COMMENT ON COLUMN contract_category_permission_templates.id IS '主键ID';
COMMENT ON COLUMN contract_category_permission_templates.category IS '合同类别（枚举类型）';
COMMENT ON COLUMN contract_category_permission_templates.template_name IS '模板名称';
COMMENT ON COLUMN contract_category_permission_templates.description IS '模板描述';
COMMENT ON COLUMN contract_category_permission_templates.default_permissions IS '默认权限数组';
COMMENT ON COLUMN contract_category_permission_templates.role_permissions IS '角色权限配置（JSONB）';
COMMENT ON COLUMN contract_category_permission_templates.is_active IS '是否启用';
COMMENT ON COLUMN contract_category_permission_templates.created_at IS '创建时间';
COMMENT ON COLUMN contract_category_permission_templates.updated_at IS '更新时间';

-- permission_audit_logs（权限审计日志表）- 13个字段
COMMENT ON TABLE permission_audit_logs IS '权限审计日志表（记录权限变更）';
COMMENT ON COLUMN permission_audit_logs.id IS '主键ID';
COMMENT ON COLUMN permission_audit_logs.user_id IS '操作人ID（关联auth.users表）';
COMMENT ON COLUMN permission_audit_logs.action IS '操作类型：grant-授权, revoke-撤销, modify-修改';
COMMENT ON COLUMN permission_audit_logs.permission_type IS '权限类型：menu-菜单, function-功能, data-数据';
COMMENT ON COLUMN permission_audit_logs.permission_key IS '权限键值';
COMMENT ON COLUMN permission_audit_logs.target_user_id IS '目标用户ID';
COMMENT ON COLUMN permission_audit_logs.target_project_id IS '目标项目ID';
COMMENT ON COLUMN permission_audit_logs.old_value IS '旧值（JSONB）';
COMMENT ON COLUMN permission_audit_logs.new_value IS '新值（JSONB）';
COMMENT ON COLUMN permission_audit_logs.reason IS '变更原因';
COMMENT ON COLUMN permission_audit_logs.created_at IS '操作时间';
COMMENT ON COLUMN permission_audit_logs.created_by IS '创建人ID';
COMMENT ON COLUMN permission_audit_logs.updated_at IS '更新时间';

-- role_permission_templates（角色权限模板表）- 12个字段
COMMENT ON TABLE role_permission_templates IS '角色权限模板表';
COMMENT ON COLUMN role_permission_templates.id IS '主键ID';
COMMENT ON COLUMN role_permission_templates.role IS '角色类型（枚举）';
COMMENT ON COLUMN role_permission_templates.menu_permissions IS '菜单权限数组';
COMMENT ON COLUMN role_permission_templates.function_permissions IS '功能权限数组';
COMMENT ON COLUMN role_permission_templates.created_at IS '创建时间';
COMMENT ON COLUMN role_permission_templates.updated_at IS '更新时间';
COMMENT ON COLUMN role_permission_templates.name IS '模板名称';
COMMENT ON COLUMN role_permission_templates.description IS '模板描述';
COMMENT ON COLUMN role_permission_templates.color IS '角色颜色';
COMMENT ON COLUMN role_permission_templates.project_permissions IS '项目权限数组';
COMMENT ON COLUMN role_permission_templates.data_permissions IS '数据权限数组';
COMMENT ON COLUMN role_permission_templates.is_system IS '是否系统模板（不可删除）';

-- user_roles（用户角色表）- 6个字段
COMMENT ON TABLE user_roles IS '用户角色表（一个用户可以有多个角色）';
COMMENT ON COLUMN user_roles.id IS '主键ID';
COMMENT ON COLUMN user_roles.user_id IS '用户ID（关联auth.users表）';
COMMENT ON COLUMN user_roles.role IS '角色类型（枚举）';
COMMENT ON COLUMN user_roles.assigned_by IS '分配人ID（谁分配的角色）';
COMMENT ON COLUMN user_roles.assigned_at IS '分配时间';
COMMENT ON COLUMN user_roles.updated_at IS '更新时间';

-- ============================================================================
-- 3. 导入相关表
-- ============================================================================

-- import_templates（导入模板表）- 6个字段
COMMENT ON TABLE import_templates IS 'Excel导入模板表';
COMMENT ON COLUMN import_templates.id IS '主键ID';
COMMENT ON COLUMN import_templates.description IS '模板描述';
COMMENT ON COLUMN import_templates.is_active IS '是否启用';
COMMENT ON COLUMN import_templates.created_by_user_id IS '创建人用户ID';
COMMENT ON COLUMN import_templates.created_at IS '创建时间';
COMMENT ON COLUMN import_templates.updated_at IS '更新时间';

-- import_field_mappings（导入字段映射表）- 7个字段
COMMENT ON TABLE import_field_mappings IS 'Excel导入字段映射表';
COMMENT ON COLUMN import_field_mappings.id IS '主键ID';
COMMENT ON COLUMN import_field_mappings.template_id IS '模板ID（关联import_templates表）';
COMMENT ON COLUMN import_field_mappings.is_required IS '是否必填';
COMMENT ON COLUMN import_field_mappings.default_value IS '默认值';
COMMENT ON COLUMN import_field_mappings.display_order IS '显示顺序';
COMMENT ON COLUMN import_field_mappings.created_at IS '创建时间';
COMMENT ON COLUMN import_field_mappings.updated_at IS '更新时间';

-- import_fixed_mappings（导入固定映射表）- 5个字段
COMMENT ON TABLE import_fixed_mappings IS 'Excel导入固定映射表';
COMMENT ON COLUMN import_fixed_mappings.id IS '主键ID';
COMMENT ON COLUMN import_fixed_mappings.template_id IS '模板ID（关联import_templates表）';
COMMENT ON COLUMN import_fixed_mappings.is_case_sensitive IS '是否区分大小写';
COMMENT ON COLUMN import_fixed_mappings.created_at IS '创建时间';
COMMENT ON COLUMN import_fixed_mappings.updated_at IS '更新时间';

-- ============================================================================
-- 4. 其他辅助表
-- ============================================================================

-- saved_searches（保存的搜索表）- 7个字段
COMMENT ON TABLE saved_searches IS '保存的搜索条件表（快捷搜索）';
COMMENT ON COLUMN saved_searches.id IS '主键ID';
COMMENT ON COLUMN saved_searches.name IS '搜索名称';
COMMENT ON COLUMN saved_searches.search_type IS '搜索类型：waybill-运单, payment-付款, invoice-开票';
COMMENT ON COLUMN saved_searches.filters IS '搜索条件（JSONB格式）';
COMMENT ON COLUMN saved_searches.user_id IS '用户ID（关联auth.users表）';
COMMENT ON COLUMN saved_searches.created_at IS '创建时间';
COMMENT ON COLUMN saved_searches.updated_at IS '更新时间';

-- internal_vehicle_driver_history（车辆司机历史表）- 9个字段
COMMENT ON TABLE internal_vehicle_driver_history IS '车辆司机绑定历史表（记录哪个司机用过哪辆车）';
COMMENT ON COLUMN internal_vehicle_driver_history.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_driver_history.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_driver_history.driver_id IS '司机ID（关联internal_drivers表）';
COMMENT ON COLUMN internal_vehicle_driver_history.start_date IS '开始使用日期';
COMMENT ON COLUMN internal_vehicle_driver_history.end_date IS '结束使用日期';
COMMENT ON COLUMN internal_vehicle_driver_history.is_current IS '是否当前使用';
COMMENT ON COLUMN internal_vehicle_driver_history.bind_reason IS '绑定原因';
COMMENT ON COLUMN internal_vehicle_driver_history.unbind_reason IS '解绑原因';
COMMENT ON COLUMN internal_vehicle_driver_history.created_at IS '创建时间';

-- internal_driver_project_routes（司机项目线路表）- 4个字段
COMMENT ON TABLE internal_driver_project_routes IS '司机项目常跑线路表';
COMMENT ON COLUMN internal_driver_project_routes.id IS '主键ID';
COMMENT ON COLUMN internal_driver_project_routes.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN internal_driver_project_routes.is_primary_route IS '是否主要线路';
COMMENT ON COLUMN internal_driver_project_routes.created_at IS '创建时间';

-- payment_items（付款项目表）- 1个字段
COMMENT ON TABLE payment_items IS '付款项目表';
COMMENT ON COLUMN payment_items.created_at IS '创建时间';

-- v_p_policy_count（表）- 2个字段
COMMENT ON TABLE v_p_policy_count IS 'RLS策略数量统计表';
COMMENT ON COLUMN v_p_policy_count.count IS '策略数量统计';
COMMENT ON COLUMN v_p_policy_count.updated_at IS '更新时间';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 第5批（最后一批）：合同和权限表注释已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成表：';
    RAISE NOTICE '  ✓ 合同相关表 (7个表)';
    RAISE NOTICE '  ✓ 权限相关表 (4个表)';
    RAISE NOTICE '  ✓ 导入相关表 (3个表)';
    RAISE NOTICE '  ✓ 其他辅助表 (5个表)';
    RAISE NOTICE '';
    RAISE NOTICE '🎊 所有业务表的字段注释添加完成！';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

