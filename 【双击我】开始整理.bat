@echo off
chcp 65001 >nul
cls
echo.
echo ╔════════════════════════════════════════╗
echo ║     项目文档整理工具                   ║
echo ╚════════════════════════════════════════╝
echo.
echo 当前状态：根目录有 200+ 个MD文档散乱放置
echo.
echo 整理方案：
echo   [1] 整理全部MD文档 (推荐)
echo   [2] 整理全部SQL文件
echo   [3] 全部整理 (MD + SQL)
echo   [0] 退出
echo.
set /p choice=请选择 (1/2/3/0): 

if "%choice%"=="1" goto move_docs
if "%choice%"=="2" goto move_sql
if "%choice%"=="3" goto move_all
if "%choice%"=="0" goto end
goto end

:move_docs
cls
echo.
echo 开始整理MD文档...
echo.
call 整理全部文档.bat
goto end

:move_sql
cls
echo.
echo 开始整理SQL文件...
echo.
call 整理全部SQL.bat
goto end

:move_all
cls
echo.
echo 开始整理全部文件...
echo.
call 整理全部文档.bat
echo.
echo ========================================
echo.
call 整理全部SQL.bat
goto end

:end
echo.
echo 整理完成！
echo.
pause

