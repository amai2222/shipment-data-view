@echo off
chcp 65001 >nul
cls
echo ========================================
echo 项目文档全面整理工具
echo ========================================
echo.
echo 即将整理 200+ 个MD文档到分类目录
echo.
pause

cls
echo ========================================
echo 创建目录结构...
echo ========================================

REM 创建所有分类目录
mkdir "docs\approval-features" 2>nul
mkdir "docs\invoice-management" 2>nul
mkdir "docs\payment-management" 2>nul
mkdir "docs\mobile" 2>nul
mkdir "docs\components" 2>nul
mkdir "docs\permissions" 2>nul
mkdir "docs\project-management" 2>nul
mkdir "docs\performance" 2>nul
mkdir "docs\bug-fixes" 2>nul
mkdir "docs\daily-summary" 2>nul
mkdir "docs\database" 2>nul
mkdir "docs\driver-management" 2>nul
mkdir "docs\partner-management" 2>nul
mkdir "docs\waybill-management" 2>nul
mkdir "docs\shipper-dashboard" 2>nul
mkdir "docs\misc" 2>nul
mkdir "scripts\sql\backup" 2>nul
mkdir "scripts\sql\fix" 2>nul
mkdir "scripts\sql\migration" 2>nul
mkdir "scripts\sql\test" 2>nul

echo   目录创建完成
echo.

REM ========================================
REM 移动审批功能文档
REM ========================================
echo [1/15] 移动审批功能文档...
move "*审批*" "docs\approval-features\" 2>nul
move "*审核*" "docs\approval-features\" 2>nul
move "付款审核*" "docs\approval-features\" 2>nul
move "开票审核*" "docs\approval-features\" 2>nul
echo   完成

REM ========================================
REM 移动开票管理文档
REM ========================================
echo [2/15] 移动开票管理文档...
move "开票*" "docs\invoice-management\" 2>nul
move "财务开票*" "docs\invoice-management\" 2>nul
move "*开票*" "docs\invoice-management\" 2>nul
echo   完成

REM ========================================
REM 移动付款管理文档
REM ========================================
echo [3/15] 移动付款管理文档...
move "付款*" "docs\payment-management\" 2>nul
move "财务付款*" "docs\payment-management\" 2>nul
move "*付款*" "docs\payment-management\" 2>nul
move "申请单*" "docs\payment-management\" 2>nul
move "按钮*" "docs\payment-management\" 2>nul
move "*按钮*" "docs\payment-management\" 2>nul
move "一键作废*" "docs\payment-management\" 2>nul
echo   完成

REM ========================================
REM 移动移动端文档
REM ========================================
echo [4/15] 移动移动端文档...
move "移动端*" "docs\mobile\" 2>nul
move "平板端*" "docs\mobile\" 2>nul
move "*移动端*" "docs\mobile\" 2>nul
echo   完成

REM ========================================
REM 移动组件文档
REM ========================================
echo [5/15] 移动组件文档...
move "组件*" "docs\components\" 2>nul
move "页面组件*" "docs\components\" 2>nul
move "*组件*" "docs\components\" 2>nul
move "确认对话框*" "docs\components\" 2>nul
move "批量输入*" "docs\components\" 2>nul
echo   完成

REM ========================================
REM 移动权限管理文档
REM ========================================
echo [6/15] 移动权限管理文档...
move "*权限*" "docs\permissions\" 2>nul
move "用户*" "docs\permissions\" 2>nul
move "*用户*" "docs\permissions\" 2>nul
move "操作员*" "docs\permissions\" 2>nul
echo   完成

REM ========================================
REM 移动项目管理文档
REM ========================================
echo [7/15] 移动项目管理文档...
move "项目*" "docs\project-management\" 2>nul
move "*项目*" "docs\project-management\" 2>nul
echo   完成

REM ========================================
REM 移动性能优化文档
REM ========================================
echo [8/15] 移动性能优化文档...
move "性能*" "docs\performance\" 2>nul
move "*性能*" "docs\performance\" 2>nul
move "数据库优化*" "docs\performance\" 2>nul
move "*优化*" "docs\performance\" 2>nul
echo   完成

REM ========================================
REM 移动Bug修复文档
REM ========================================
echo [9/15] 移动Bug修复文档...
move "Linter*" "docs\bug-fixes\" 2>nul
move "TypeScript*" "docs\bug-fixes\" 2>nul
move "RPC*" "docs\bug-fixes\" 2>nul
move "SQL*" "docs\bug-fixes\" 2>nul
move "修复*" "docs\bug-fixes\" 2>nul
move "*修复*" "docs\bug-fixes\" 2>nul
move "紧急*" "docs\bug-fixes\" 2>nul
move "浏览器*" "docs\bug-fixes\" 2>nul
move "array_trim*" "docs\bug-fixes\" 2>nul
move "函数名*" "docs\bug-fixes\" 2>nul
move "列名*" "docs\bug-fixes\" 2>nul
move "视图*" "docs\bug-fixes\" 2>nul
move "RLS*" "docs\bug-fixes\" 2>nul
move "依赖*" "docs\bug-fixes\" 2>nul
move "图标*" "docs\bug-fixes\" 2>nul
move "Search*" "docs\bug-fixes\" 2>nul
move "日期选择器*" "docs\bug-fixes\" 2>nul
echo   完成

REM ========================================
REM 移动工作总结文档
REM ========================================
echo [10/15] 移动工作总结文档...
move "今日*" "docs\daily-summary\" 2>nul
move "本次*" "docs\daily-summary\" 2>nul
move "代码审核*" "docs\daily-summary\" 2>nul
move "自动化审核*" "docs\daily-summary\" 2>nul
move "*总结*" "docs\daily-summary\" 2>nul
move "最终*" "docs\daily-summary\" 2>nul
move "部署*" "docs\daily-summary\" 2>nul
move "*部署*" "docs\daily-summary\" 2>nul
move "升级完成*" "docs\daily-summary\" 2>nul
echo   完成

REM ========================================
REM 移动数据库文档
REM ========================================
echo [11/15] 移动数据库文档...
move "*成本重算*" "docs\database\" 2>nul
move "*手动修改*" "docs\database\" 2>nul
move "chain_id*" "docs\database\" 2>nul
move "*自动重算*" "docs\database\" 2>nul
move "数据库*" "docs\database\" 2>nul
move "Supabase*" "docs\database\" 2>nul
move "安全*" "docs\database\" 2>nul
move "隐藏*" "docs\database\" 2>nul
move "Token*" "docs\database\" 2>nul
echo   完成

REM ========================================
REM 移动司机管理文档
REM ========================================
echo [12/15] 移动司机管理文档...
move "司机*" "docs\driver-management\" 2>nul
move "*司机*" "docs\driver-management\" 2>nul
move "Excel导入司机*" "docs\driver-management\" 2>nul
echo   完成

REM ========================================
REM 移动合作方管理文档
REM ========================================
echo [13/15] 移动合作方管理文档...
move "合作*" "docs\partner-management\" 2>nul
move "*合作*" "docs\partner-management\" 2>nul
move "货主*" "docs\partner-management\" 2>nul
move "*货主*" "docs\partner-management\" 2>nul
echo   完成

REM ========================================
REM 移动运单管理文档
REM ========================================
echo [14/15] 移动运单管理文档...
move "运单*" "docs\waybill-management\" 2>nul
move "*运单*" "docs\waybill-management\" 2>nul
move "运输*" "docs\waybill-management\" 2>nul
move "批量PDF*" "docs\waybill-management\" 2>nul
move "装货*" "docs\waybill-management\" 2>nul
echo   完成

REM ========================================
REM 移动其他文档
REM ========================================
echo [15/15] 移动其他文档...
move "AppSidebar*" "docs\misc\" 2>nul
move "Cursor*" "docs\misc\" 2>nul
move "Edge*" "docs\misc\" 2>nul
move "地点*" "docs\misc\" 2>nul
move "位置*" "docs\misc\" 2>nul
move "菜单*" "docs\misc\" 2>nul
move "界面*" "docs\misc\" 2>nul
move "设置*" "docs\misc\" 2>nul
move "通知*" "docs\misc\" 2>nul
move "批量搜索*" "docs\misc\" 2>nul
move "批量选择*" "docs\misc\" 2>nul
move "筛选器*" "docs\misc\" 2>nul
move "分页*" "docs\misc\" 2>nul
move "统一*" "docs\misc\" 2>nul
move "原有*" "docs\misc\" 2>nul
move "现有*" "docs\misc\" 2>nul
move "现代*" "docs\misc\" 2>nul
move "增强*" "docs\misc\" 2>nul
move "回滚*" "docs\misc\" 2>nul
move "清理*" "docs\misc\" 2>nul
move "测试*" "docs\misc\" 2>nul
move "*说明.md" "docs\misc\" 2>nul
move "*指南.md" "docs\misc\" 2>nul
echo   完成

echo.
echo ========================================
echo ✅ 全部文档整理完成！
echo ========================================
echo.
echo 文档分类：
echo   📂 docs\approval-features\     - 审批功能
echo   📂 docs\invoice-management\    - 开票管理
echo   📂 docs\payment-management\    - 付款管理
echo   📂 docs\mobile\                - 移动端
echo   📂 docs\components\            - 组件
echo   📂 docs\permissions\           - 权限
echo   📂 docs\project-management\    - 项目
echo   📂 docs\performance\           - 性能
echo   📂 docs\bug-fixes\             - Bug修复
echo   📂 docs\daily-summary\         - 工作总结
echo   📂 docs\database\              - 数据库
echo   📂 docs\driver-management\     - 司机
echo   📂 docs\partner-management\    - 合作方
echo   📂 docs\waybill-management\    - 运单
echo   📂 docs\misc\                  - 其他
echo.
echo 查看文档索引: docs\文档整理索引.md
echo.
pause

