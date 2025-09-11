-- 简单检查合同相关表是否存在
SELECT 'contract_permissions' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_permissions') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_file_versions' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_file_versions') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_access_logs' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_access_logs') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_numbering_rules' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_numbering_rules') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_tags' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_tags') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_tag_relations' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_tag_relations') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'contract_reminders' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contract_reminders') 
            THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT 'saved_searches' as table_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_searches') 
            THEN 'EXISTS' ELSE 'MISSING' END as status;
