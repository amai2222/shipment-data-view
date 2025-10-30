@echo off
chcp 65001 >nul
echo ========================================
echo 开始整理项目文档...
echo ========================================
echo.

REM 创建目录
if not exist "docs\approval-features" mkdir "docs\approval-features"
if not exist "docs\invoice-management" mkdir "docs\invoice-management"
if not exist "docs\payment-management" mkdir "docs\payment-management"
if not exist "docs\mobile" mkdir "docs\mobile"
if not exist "docs\components" mkdir "docs\components"
if not exist "docs\bug-fixes" mkdir "docs\bug-fixes"

echo 移动审批功能文档...
if exist "审批功能全面优化和企业微信兼容性修复总结.md" move "审批功能全面优化和企业微信兼容性修复总结.md" "docs\approval-features\" >nul
if exist "审批功能全面优化总结.md" move "审批功能全面优化总结.md" "docs\approval-features\" >nul
if exist "批量取消审批功能优化完成.md" move "批量取消审批功能优化完成.md" "docs\approval-features\" >nul
if exist "移动端审批功能优化完成.md" move "移动端审批功能优化完成.md" "docs\approval-features\" >nul
if exist "企业微信环境兼容性修复完成.md" move "企业微信环境兼容性修复完成.md" "docs\approval-features\" >nul

echo.
echo ========================================
echo 文档整理完成！
echo ========================================
echo 已将最新的审批功能文档移至 docs\approval-features\
echo.
echo 建议：
echo 1. 打开 docs\文档整理索引.md 查看完整分类
echo 2. 如需整理更多文档，参考 organize-docs.ps1
echo.
pause

