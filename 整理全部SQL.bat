@echo off
chcp 65001 >nul
cls
echo ========================================
echo SQL文件全面整理工具
echo ========================================
echo.
echo 即将整理 50+ 个SQL文件到分类目录
echo.
echo 注意: supabase/migrations/ 下的正式迁移文件不会移动
echo.
pause

cls
echo ========================================
echo 创建SQL目录结构...
echo ========================================

REM 创建SQL分类目录
mkdir "scripts\sql\backup" 2>nul
mkdir "scripts\sql\fix" 2>nul
mkdir "scripts\sql\migration" 2>nul
mkdir "scripts\sql\test" 2>nul
mkdir "scripts\sql\archive" 2>nul
mkdir "scripts\backup" 2>nul

echo   目录创建完成
echo.

REM ========================================
REM 移动备份SQL文件
REM ========================================
echo [1/4] 移动备份SQL文件...
move "backup_*.sql" "scripts\sql\backup\" 2>nul
move "*备份*.sql" "scripts\sql\backup\" 2>nul
move "成本重算函数_原始备份.sql" "scripts\sql\backup\" 2>nul
move "恢复*.sql" "scripts\sql\backup\" 2>nul
echo   完成

REM ========================================
REM 移动修复SQL文件
REM ========================================
echo [2/4] 移动修复SQL文件...
move "fix_*.sql" "scripts\sql\fix\" 2>nul
move "quick_*.sql" "scripts\sql\fix\" 2>nul
move "修复*.sql" "scripts\sql\fix\" 2>nul
move "快速修复*.sql" "scripts\sql\fix\" 2>nul
move "*修复*.sql" "scripts\sql\fix\" 2>nul
move "安全删除*.sql" "scripts\sql\fix\" 2>nul
move "合作方名称双向同步方案*.sql" "scripts\sql\fix\" 2>nul
move "合作链路修改*.sql" "scripts\sql\fix\" 2>nul
echo   完成

REM ========================================
REM 移动测试和验证SQL文件
REM ========================================
echo [3/4] 移动测试验证SQL文件...
move "check_*.sql" "scripts\sql\test\" 2>nul
move "检查*.sql" "scripts\sql\test\" 2>nul
move "验证*.sql" "scripts\sql\test\" 2>nul
move "测试*.sql" "scripts\sql\test\" 2>nul
move "填充*.sql" "scripts\sql\test\" 2>nul
move "排查*.sql" "scripts\sql\test\" 2>nul
move "详细*.sql" "scripts\sql\test\" 2>nul
move "权限功能测试*.sql" "scripts\sql\test\" 2>nul
move "筛选器功能验证*.sql" "scripts\sql\test\" 2>nul
move "货主层级关系*.sql" "scripts\sql\test\" 2>nul
move "执行清理*.sql" "scripts\sql\test\" 2>nul
echo   完成

REM ========================================
REM 移动数据迁移SQL文件
REM ========================================
echo [4/4] 移动数据迁移SQL文件...
move "增强*.sql" "scripts\sql\migration\" 2>nul
move "更新*.sql" "scripts\sql\migration\" 2>nul
move "批量*.sql" "scripts\sql\migration\" 2>nul
move "审核管理权限*.sql" "scripts\sql\migration\" 2>nul
move "直接*.sql" "scripts\sql\migration\" 2>nul
move "简化*.sql" "scripts\sql\migration\" 2>nul
move "临时*.sql" "scripts\sql\migration\" 2>nul
move "切换*.sql" "scripts\sql\migration\" 2>nul
move "实施*.sql" "scripts\sql\migration\" 2>nul
move "手动执行*.sql" "scripts\sql\migration\" 2>nul
move "数据库性能优化索引.sql" "scripts\sql\migration\" 2>nul
echo   完成

REM ========================================
REM 移动备份脚本
REM ========================================
echo.
echo 移动备份脚本文件...
move "backup-*.ps1" "scripts\backup\" 2>nul
move "backup_*.ps1" "scripts\backup\" 2>nul
move "restore-*.ps1" "scripts\backup\" 2>nul
move "backup-*.sh" "scripts\backup\" 2>nul
move "backup_*.sh" "scripts\backup\" 2>nul
move "清理测试数据.ps1" "scripts\backup\" 2>nul
echo   完成

echo.
echo ========================================
echo ✅ 全部SQL文件整理完成！
echo ========================================
echo.
echo SQL分类：
echo   📂 scripts\sql\backup\      - 备份SQL (9个)
echo   📂 scripts\sql\fix\         - 修复SQL (19个)
echo   📂 scripts\sql\migration\   - 迁移SQL (16个)
echo   📂 scripts\sql\test\        - 测试SQL (18个)
echo   📂 scripts\backup\          - 备份脚本
echo.
echo 正式迁移文件保持在: supabase\migrations\
echo.
pause

