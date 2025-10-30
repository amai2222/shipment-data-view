@echo off
chcp 65001 >nul
cls
echo ========================================
echo 开始整理项目文档...
echo ========================================
echo.

REM 创建目录
echo 创建目录结构...
mkdir "docs\approval-features" 2>nul
mkdir "docs\invoice-management" 2>nul
mkdir "docs\payment-management" 2>nul
mkdir "docs\mobile" 2>nul
mkdir "docs\components" 2>nul
mkdir "docs\bug-fixes" 2>nul
mkdir "docs\daily-summary" 2>nul
echo   完成
echo.

REM 移动最新的审批功能文档
echo 移动审批功能文档...
move "审批功能全面优化和企业微信兼容性修复总结.md" "docs\approval-features\" 2>nul
move "审批功能全面优化总结.md" "docs\approval-features\" 2>nul
move "批量取消审批功能优化完成.md" "docs\approval-features\" 2>nul
move "移动端审批功能优化完成.md" "docs\approval-features\" 2>nul
move "企业微信环境兼容性修复完成.md" "docs\approval-features\" 2>nul
echo   完成
echo.

REM 移动开票相关文档
echo 移动开票管理文档...
move "开票*" "docs\invoice-management\" 2>nul
move "财务开票*" "docs\invoice-management\" 2>nul
echo   完成
echo.

REM 移动付款相关文档
echo 移动付款管理文档...
move "付款*" "docs\payment-management\" 2>nul
move "财务付款*" "docs\payment-management\" 2>nul
move "申请单*" "docs\payment-management\" 2>nul
echo   完成
echo.

REM 移动移动端文档
echo 移动移动端文档...
move "移动端*" "docs\mobile\" 2>nul
move "平板端*" "docs\mobile\" 2>nul
echo   完成
echo.

REM 移动组件文档
echo 移动组件文档...
move "组件*" "docs\components\" 2>nul
move "页面组件*" "docs\components\" 2>nul
move "PaymentRequest组件*" "docs\components\" 2>nul
echo   完成
echo.

REM 移动Bug修复文档
echo 移动Bug修复文档...
move "Linter*" "docs\bug-fixes\" 2>nul
move "TypeScript*" "docs\bug-fixes\" 2>nul
move "RPC函数*" "docs\bug-fixes\" 2>nul
move "SQL*" "docs\bug-fixes\" 2>nul
move "修复*" "docs\bug-fixes\" 2>nul
move "紧急修复*" "docs\bug-fixes\" 2>nul
move "浏览器*" "docs\bug-fixes\" 2>nul
echo   完成
echo.

REM 移动工作总结
echo 移动工作总结文档...
move "今日完成*" "docs\daily-summary\" 2>nul
move "本次完成*" "docs\daily-summary\" 2>nul
move "本次修改*" "docs\daily-summary\" 2>nul
move "代码审核*" "docs\daily-summary\" 2>nul
echo   完成
echo.

echo ========================================
echo 文档整理完成！
echo ========================================
echo.
echo 查看整理后的文档：
echo   - 审批功能: docs\approval-features\
echo   - 开票管理: docs\invoice-management\
echo   - 付款管理: docs\payment-management\
echo   - 移动端: docs\mobile\
echo.
echo 按任意键打开docs目录...
pause >nul
explorer docs

