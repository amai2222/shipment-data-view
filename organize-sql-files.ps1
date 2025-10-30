# SQL文件整理脚本
# 用途：将根目录下的SQL文件移动到对应目录

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始整理SQL文件..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建SQL脚本目录
$sqlDirs = @(
    "scripts\sql\backup",
    "scripts\sql\fix",
    "scripts\sql\migration",
    "scripts\sql\test",
    "scripts\sql\archive"
)

Write-Host "创建SQL目录结构..." -ForegroundColor Yellow
foreach ($dir in $sqlDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ 创建: $dir" -ForegroundColor Green
    }
}
Write-Host ""

# SQL文件分类
$sqlMappings = @{
    # 备份文件
    "backup" = @(
        "backup_edge_functions_correct.sql",
        "backup_edge_functions_simple.sql",
        "backup_supabase_complete.sql",
        "backup_supabase_edge_functions.sql",
        "backup_supabase_fixed.sql",
        "backup_supabase_schema.sql",
        "backup_supabase_simple.sql",
        "成本重算函数_原始备份.sql",
        "恢复原始函数.sql"
    )
    
    # 修复脚本
    "fix" = @(
        "check_and_add_updated_at_fields.sql",
        "check_logistics_records_structure.sql",
        "check_tables_updated_at_status.sql",
        "fix_missing_updated_at_fields.sql",
        "quick_add_updated_at.sql",
        "quick_fix_updated_at.sql",
        "快速修复_触发器表名错误.sql",
        "快速修复视图RLS策略.sql",
        "修复中粮集团层级数据.sql",
        "修复付款审核筛选器后端函数.sql",
        "修复函数名冲突.sql",
        "修复合作链路成本重算函数调用.sql",
        "修复触发器避免不必要重算.sql",
        "修复运单号搜索逻辑.sql",
        "修复运单编号搜索包含其他平台运单号.sql",
        "合作方名称双向同步方案_修复版.sql",
        "合作链路修改-使用正确重算逻辑.sql",
        "安全删除合作链路函数.sql",
        "安全删除并重建RPC函数.sql"
    )
    
    # 测试和验证脚本
    "test" = @(
        "检查chain_id缺失情况.sql",
        "检查当前用户权限.sql",
        "检查权限表结构.sql",
        "检查用户szf项目记录详情.sql",
        "检查用户项目权限设置.sql",
        "检查运单编辑函数是否存在.sql",
        "填充缺失的chain_id.sql",
        "验证chain_id填充结果.sql",
        "验证修复后的项目访问限制逻辑.sql",
        "验证移动端项目访问限制逻辑修复效果.sql",
        "验证自动重算功能.sql",
        "验证项目分配逻辑修复效果.sql",
        "验证项目访问限制逻辑修复效果.sql",
        "测试手动修改保护功能.sql",
        "权限功能测试脚本.sql",
        "筛选器功能验证测试.sql",
        "货主层级关系排查指南.sql",
        "排查货主看板权限问题.sql",
        "详细检查权限限制情况.sql",
        "执行清理测试数据.sql"
    )
    
    # 数据迁移和更新脚本
    "migration" = @(
        "增强付款申请筛选器_后端函数.sql",
        "更新审核管理权限.sql",
        "更新申请单列表RPC函数添加申请金额.sql",
        "批量添加审核权限.sql",
        "审核管理权限快速更新.sql",
        "审核管理权限更新_安全版.sql",
        "直接更新用户审核权限.sql",
        "简化操作员权限更新.sql",
        "临时显示审核管理菜单.sql",
        "切换到强制重算模式.sql",
        "实施手动修改保护功能.sql",
        "手动执行申请单筛选器函数.sql",
        "数据库性能优化索引.sql",
        "批量关联司机到项目.sql",
        "批量关联司机到项目_快速版.sql",
        "批量关联司机到项目_详细版.sql"
    )
}

# 移动SQL文件
$movedCount = 0
$skippedCount = 0

foreach ($category in $sqlMappings.Keys) {
    $targetDir = "scripts\sql\$category"
    $files = $sqlMappings[$category]
    
    Write-Host "处理 $category SQL文件..." -ForegroundColor Yellow
    
    foreach ($file in $files) {
        if (Test-Path $file) {
            try {
                Move-Item $file $targetDir -Force
                Write-Host "  ✓ 移动: $file" -ForegroundColor Green
                $movedCount++
            } catch {
                Write-Host "  ✗ 失败: $file - $($_.Exception.Message)" -ForegroundColor Red
                $skippedCount++
            }
        } else {
            $skippedCount++
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SQL文件整理完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  已移动: $movedCount 个SQL文件" -ForegroundColor Green
Write-Host "  已跳过: $skippedCount 个SQL文件" -ForegroundColor Yellow
Write-Host ""
Write-Host "注意：" -ForegroundColor Cyan
Write-Host "1. supabase/migrations/ 目录下的迁移文件保持不动" -ForegroundColor White
Write-Host "2. 备份脚本(.ps1, .sh)建议移至 scripts/backup/" -ForegroundColor White
Write-Host "3. 定期清理不再使用的SQL文件" -ForegroundColor White

