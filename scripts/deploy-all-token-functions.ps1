# 部署所有 Token 相关 Edge Functions
# 使用说明：在项目根目录执行 .\scripts\deploy-all-token-functions.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署 Token 相关 Edge Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Supabase CLI
Write-Host "检查 Supabase CLI..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase CLI 未安装"
    }
    Write-Host "✅ Supabase CLI 已安装: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI 未安装" -ForegroundColor Red
    Write-Host "请先安装: scoop install supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 检查项目链接
Write-Host "检查项目链接..." -ForegroundColor Yellow
try {
    supabase projects list 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  项目未链接，正在链接..." -ForegroundColor Yellow
        supabase link --project-ref mnwzvtvyauyxwowjjsmf
    }
    Write-Host "✅ 项目已链接" -ForegroundColor Green
} catch {
    Write-Host "⚠️  项目链接检查失败，继续尝试部署..." -ForegroundColor Yellow
}

Write-Host ""

# 部署函数列表
$functions = @(
    "get-tracking-token",
    "add-vehicle",
    "vehicle-tracking",
    "sync-vehicle-tracking-ids",
    "sync-vehicle"
)

Write-Host "开始部署以下函数：" -ForegroundColor Cyan
foreach ($func in $functions) {
    Write-Host "  - $func" -ForegroundColor White
}
Write-Host ""

# 部署每个函数
$successCount = 0
$failCount = 0

foreach ($func in $functions) {
    Write-Host "部署 $func..." -ForegroundColor Yellow
    try {
        $output = supabase functions deploy $func --no-verify-jwt 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $func 部署成功" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ $func 部署失败" -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "❌ $func 部署异常: $_" -ForegroundColor Red
        $failCount++
    }
    Write-Host ""
}

# 部署结果总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署结果" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "成功: $successCount" -ForegroundColor Green
Write-Host "失败: $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ 所有函数部署成功！" -ForegroundColor Green
} else {
    Write-Host "⚠️  部分函数部署失败，请检查错误信息" -ForegroundColor Yellow
}

Write-Host ""

