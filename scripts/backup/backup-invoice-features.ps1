# 开票申请功能备份脚本
# 此脚本用于备份开票申请相关的所有文件

Write-Host "开始备份开票申请功能相关文件..." -ForegroundColor Green

# 创建备份目录
$backupDir = "invoice-features-backup"
if (Test-Path $backupDir) {
    Remove-Item $backupDir -Recurse -Force
}
New-Item -ItemType Directory -Path $backupDir

# 备份前端页面文件
Write-Host "备份前端页面文件..." -ForegroundColor Yellow
$frontendFiles = @(
    "src/pages/InvoiceRequest.tsx",
    "src/pages/InvoiceRequestManagement.tsx", 
    "src/pages/mobile/MobileInvoiceRequestManagement.tsx",
    "src/pages/InvoiceRequest/components/InvoiceRequestFilterBar.tsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $destDir = Join-Path $backupDir (Split-Path $file -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $file -Destination (Join-Path $backupDir $file) -Force
        Write-Host "已备份: $file" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $file" -ForegroundColor Red
    }
}

# 备份数据库迁移文件
Write-Host "备份数据库迁移文件..." -ForegroundColor Yellow
$migrationFiles = @(
    "supabase/migrations/20250816_fix_invoice_request_function_overload.sql",
    "supabase/migrations/20250116_add_invoice_payment_status_to_logistics_records.sql",
    "supabase/migrations/20250116_fix_invoice_status_constraint.sql",
    "supabase/migrations/20250116_create_logistics_deletion_triggers.sql",
    "supabase/migrations/20250116_safe_add_invoice_payment_status.sql",
    "supabase/migrations/20250116_fix_logistics_records_view.sql"
)

foreach ($file in $migrationFiles) {
    if (Test-Path $file) {
        $destDir = Join-Path $backupDir (Split-Path $file -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $file -Destination (Join-Path $backupDir $file) -Force
        Write-Host "已备份: $file" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $file" -ForegroundColor Red
    }
}

# 备份权限配置文件
Write-Host "备份权限配置文件..." -ForegroundColor Yellow
$permissionFiles = @(
    "src/config/permissions.ts",
    "src/config/permissionsNew.ts",
    "src/pages/Settings/PermissionManagement.tsx"
)

foreach ($file in $permissionFiles) {
    if (Test-Path $file) {
        $destDir = Join-Path $backupDir (Split-Path $file -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $file -Destination (Join-Path $backupDir $file) -Force
        Write-Host "已备份: $file" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $file" -ForegroundColor Red
    }
}

# 备份路由和菜单配置
Write-Host "备份路由和菜单配置..." -ForegroundColor Yellow
$routeFiles = @(
    "src/App.tsx",
    "src/components/AppSidebar.tsx"
)

foreach ($file in $routeFiles) {
    if (Test-Path $file) {
        $destDir = Join-Path $backupDir (Split-Path $file -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $file -Destination (Join-Path $backupDir $file) -Force
        Write-Host "已备份: $file" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $file" -ForegroundColor Red
    }
}

# 备份类型定义文件
Write-Host "备份类型定义文件..." -ForegroundColor Yellow
$typeFiles = @(
    "src/types/index.ts"
)

foreach ($file in $typeFiles) {
    if (Test-Path $file) {
        $destDir = Join-Path $backupDir (Split-Path $file -Parent)
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force
        }
        Copy-Item $file -Destination (Join-Path $backupDir $file) -Force
        Write-Host "已备份: $file" -ForegroundColor Green
    } else {
        Write-Host "文件不存在: $file" -ForegroundColor Red
    }
}

Write-Host "备份完成！备份文件保存在: $backupDir" -ForegroundColor Green
Write-Host "备份文件列表:" -ForegroundColor Cyan
Get-ChildItem -Path $backupDir -Recurse | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor White }
