# 备份本地Supabase Edge函数脚本
# 生成时间: 2025-01-16

Write-Host "开始备份本地Supabase Edge函数..." -ForegroundColor Green

# 设置备份目录
$backupDir = "backup_edge_functions_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$functionsDir = "supabase\functions"

# 创建备份目录
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "创建备份目录: $backupDir" -ForegroundColor Yellow
}

# 检查functions目录是否存在
if (!(Test-Path $functionsDir)) {
    Write-Host "错误: 未找到 $functionsDir 目录" -ForegroundColor Red
    exit 1
}

# 获取所有Edge函数目录
$functionDirs = Get-ChildItem $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }

Write-Host "`n发现 $($functionDirs.Count) 个Edge函数:" -ForegroundColor Cyan
foreach ($dir in $functionDirs) {
    Write-Host "  - $($dir.Name)" -ForegroundColor White
}

# 备份每个Edge函数
$backupCount = 0
foreach ($functionDir in $functionDirs) {
    $functionName = $functionDir.Name
    $backupFunctionDir = Join-Path $backupDir $functionName
    
    try {
        # 创建函数备份目录
        New-Item -ItemType Directory -Path $backupFunctionDir -Force | Out-Null
        
        # 复制所有文件
        Copy-Item -Path "$($functionDir.FullName)\*" -Destination $backupFunctionDir -Recurse -Force
        
        # 检查是否有index.ts文件
        $indexFile = Join-Path $functionDir "index.ts"
        if (Test-Path $indexFile) {
            $lines = (Get-Content $indexFile | Measure-Object -Line).Lines
            Write-Host "  ✅ $functionName ($lines 行代码)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $functionName (无index.ts文件)" -ForegroundColor Yellow
        }
        
        $backupCount++
    }
    catch {
        Write-Host "  ❌ $functionName (备份失败: $($_.Exception.Message))" -ForegroundColor Red
    }
}

# 备份_shared目录（如果存在）
$sharedDir = Join-Path $functionsDir "_shared"
if (Test-Path $sharedDir) {
    $backupSharedDir = Join-Path $backupDir "_shared"
    try {
        Copy-Item -Path $sharedDir -Destination $backupSharedDir -Recurse -Force
        Write-Host "  ✅ _shared (共享代码)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ _shared (备份失败: $($_.Exception.Message))" -ForegroundColor Red
    }
}

# 生成备份报告
$reportFile = Join-Path $backupDir "backup_report.md"
$reportContent = @"
# Supabase Edge函数备份报告

## 备份信息
- **备份时间**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- **备份目录**: $backupDir
- **源目录**: $functionsDir
- **备份函数数量**: $backupCount

## 备份的函数列表
"@

foreach ($functionDir in $functionDirs) {
    $functionName = $functionDir.Name
    $indexFile = Join-Path $functionDir "index.ts"
    $lines = if (Test-Path $indexFile) { (Get-Content $indexFile | Measure-Object -Line).Lines } else { 0 }
    
    $reportContent += "`n- **$functionName**: $lines 行代码"
}

$reportContent += @"

## 恢复说明
要恢复这些Edge函数，请执行以下步骤：

1. 将备份目录中的函数复制到 `supabase/functions/` 目录
2. 运行 `supabase functions deploy <function-name>` 部署每个函数
3. 或者使用 `supabase functions deploy` 部署所有函数

## 备份完成
备份已完成，所有Edge函数已保存到: $backupDir
"@

Set-Content -Path $reportFile -Value $reportContent -Encoding UTF8

Write-Host "`n备份完成!" -ForegroundColor Green
Write-Host "备份目录: $backupDir" -ForegroundColor Cyan
Write-Host "备份函数数量: $backupCount" -ForegroundColor Cyan
Write-Host "备份报告: $reportFile" -ForegroundColor Cyan

# 显示备份目录内容
Write-Host "`n备份目录内容:" -ForegroundColor Yellow
Get-ChildItem $backupDir -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Replace((Get-Item $backupDir).FullName, "").TrimStart("\")
    $size = if ($_.PSIsContainer) { "" } else { " ($([math]::Round($_.Length / 1KB, 2)) KB)" }
    Write-Host "  $relativePath$size" -ForegroundColor White
}
