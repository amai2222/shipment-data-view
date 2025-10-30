# 开票申请功能恢复脚本
# 此脚本用于在回滚后恢复开票申请相关的所有文件

param(
    [string]$BackupDir = "invoice-features-backup"
)

Write-Host "开始恢复开票申请功能相关文件..." -ForegroundColor Green

# 检查备份目录是否存在
if (!(Test-Path $BackupDir)) {
    Write-Host "错误: 备份目录不存在: $BackupDir" -ForegroundColor Red
    Write-Host "请先运行 backup-invoice-features.ps1 创建备份" -ForegroundColor Yellow
    exit 1
}

# 恢复前端页面文件
Write-Host "恢复前端页面文件..." -ForegroundColor Yellow
$frontendFiles = @(
    "src/pages/InvoiceRequest.tsx",
    "src/pages/InvoiceRequestManagement.tsx", 
    "src/pages/mobile/MobileInvoiceRequestManagement.tsx",
    "src/pages/InvoiceRequest/components/InvoiceRequestFilterBar.tsx"
)

foreach ($file in $frontendFiles) {
    $backupFile = Join-Path $BackupDir $file
    if (Test-Path $backupFile) {
        $destDir = Split-Path $file -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $backupFile -Destination $file -Force
        Write-Host "已恢复: $file" -ForegroundColor Green
    } else {
        Write-Host "备份文件不存在: $backupFile" -ForegroundColor Red
    }
}

# 恢复数据库迁移文件
Write-Host "恢复数据库迁移文件..." -ForegroundColor Yellow
$migrationFiles = @(
    "supabase/migrations/20250816_fix_invoice_request_function_overload.sql",
    "supabase/migrations/20250116_add_invoice_payment_status_to_logistics_records.sql",
    "supabase/migrations/20250116_fix_invoice_status_constraint.sql",
    "supabase/migrations/20250116_create_logistics_deletion_triggers.sql",
    "supabase/migrations/20250116_safe_add_invoice_payment_status.sql",
    "supabase/migrations/20250116_fix_logistics_records_view.sql"
)

foreach ($file in $migrationFiles) {
    $backupFile = Join-Path $BackupDir $file
    if (Test-Path $backupFile) {
        $destDir = Split-Path $file -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $backupFile -Destination $file -Force
        Write-Host "已恢复: $file" -ForegroundColor Green
    } else {
        Write-Host "备份文件不存在: $backupFile" -ForegroundColor Red
    }
}

# 恢复权限配置文件
Write-Host "恢复权限配置文件..." -ForegroundColor Yellow
$permissionFiles = @(
    "src/config/permissions.ts",
    "src/config/permissionsNew.ts",
    "src/pages/Settings/PermissionManagement.tsx"
)

foreach ($file in $permissionFiles) {
    $backupFile = Join-Path $BackupDir $file
    if (Test-Path $backupFile) {
        $destDir = Split-Path $file -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $backupFile -Destination $file -Force
        Write-Host "已恢复: $file" -ForegroundColor Green
    } else {
        Write-Host "备份文件不存在: $backupFile" -ForegroundColor Red
    }
}

# 恢复路由和菜单配置
Write-Host "恢复路由和菜单配置..." -ForegroundColor Yellow
$routeFiles = @(
    "src/App.tsx",
    "src/components/AppSidebar.tsx"
)

foreach ($file in $routeFiles) {
    $backupFile = Join-Path $BackupDir $file
    if (Test-Path $backupFile) {
        $destDir = Split-Path $file -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $backupFile -Destination $file -Force
        Write-Host "已恢复: $file" -ForegroundColor Green
    } else {
        Write-Host "备份文件不存在: $backupFile" -ForegroundColor Red
    }
}

# 恢复类型定义文件
Write-Host "恢复类型定义文件..." -ForegroundColor Yellow
$typeFiles = @(
    "src/types/index.ts"
)

foreach ($file in $typeFiles) {
    $backupFile = Join-Path $BackupDir $file
    if (Test-Path $backupFile) {
        $destDir = Split-Path $file -Parent
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $backupFile -Destination $file -Force
        Write-Host "已恢复: $file" -ForegroundColor Green
    } else {
        Write-Host "备份文件不存在: $backupFile" -ForegroundColor Red
    }
}

Write-Host "恢复完成！" -ForegroundColor Green
Write-Host "请执行以下步骤完成恢复:" -ForegroundColor Cyan
Write-Host "1. 运行数据库迁移: supabase db push" -ForegroundColor White
Write-Host "2. 重新构建项目: npm run build" -ForegroundColor White
Write-Host "3. 测试开票申请功能是否正常工作" -ForegroundColor White
