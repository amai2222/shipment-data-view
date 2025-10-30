@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════╗
echo ║     清理根目录临时文件                 ║
echo ╚════════════════════════════════════════╝
echo.
echo 即将删除根目录下的临时MD和PS1文件
echo.
echo ⚠️  保留的重要文件：
echo   - README.md
echo   - PROJECT_SUMMARY.md
echo   - SYSTEM_DOCUMENTATION.md
echo   - API_DOCUMENTATION.md
echo   - DEPLOYMENT_GUIDE.md
echo   - DATABASE_FUNCTIONS_BACKUP.md
echo   - organize-docs.ps1 (整理脚本)
echo   - organize-sql-files.ps1 (整理脚本)
echo   - 整理*.bat (整理脚本)
echo.
echo ❌ 删除的临时文件：
echo   - gitignore-建议.md
echo   - 文档整理-README.md
echo   - 其他文档整理说明类文件
echo   - deploy-*.ps1 (已过时的部署脚本)
echo.
pause

cls
echo.
echo 开始清理...
echo.

REM 删除文档整理相关的临时说明文件
echo [1/3] 删除文档整理临时文件...
del "gitignore-建议.md" 2>nul
del "文档整理-README.md" 2>nul
echo   完成

REM 删除已过时的部署脚本
echo [2/3] 删除过时的PS1脚本...
del "deploy-all-user-functions.ps1" 2>nul
del "deploy-create-user-function.ps1" 2>nul
echo   完成

REM 检查根目录剩余MD文件
echo [3/3] 检查剩余文件...
echo.
echo ========================================
echo 根目录剩余MD文件：
echo ========================================
dir *.md /b 2>nul
echo.

echo ========================================
echo 根目录剩余PS1文件：
echo ========================================
dir *.ps1 /b 2>nul
echo.

echo ========================================
echo ✅ 清理完成！
echo ========================================
echo.
echo 建议：
echo   1. 如果根目录还有其他MD文档，运行"整理全部文档.bat"
echo   2. 保留的文件都是必要的核心文档和工具脚本
echo   3. 所有功能文档都在 docs\ 目录下
echo.
pause

