# 部署 Token 相关 Edge Functions 脚本
# 使用说明：在项目根目录执行 .\scripts\deploy-token-functions.ps1

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
    Write-Host ""
    Write-Host "请先安装 Supabase CLI：" -ForegroundColor Yellow
    Write-Host "  方法1: npm install -g supabase" -ForegroundColor White
    Write-Host "  方法2: scoop install supabase" -ForegroundColor White
    Write-Host ""
    Write-Host "或使用 Supabase Dashboard 手动部署：" -ForegroundColor Yellow
    Write-Host "  1. 访问 https://app.supabase.com" -ForegroundColor White
    Write-Host "  2. 进入 Edge Functions 页面" -ForegroundColor White
    Write-Host "  3. 逐个部署函数" -ForegroundColor White
    exit 1
}

Write-Host ""

# 检查是否已登录
Write-Host "检查 Supabase 登录状态..." -ForegroundColor Yellow
try {
    supabase projects list 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  未登录，正在登录..." -ForegroundColor Yellow
        supabase login
        if ($LASTEXITCODE -ne 0) {
            throw "登录失败"
        }
    }
    Write-Host "✅ 已登录 Supabase" -ForegroundColor Green
} catch {
    Write-Host "❌ 登录失败，请手动执行: supabase login" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 检查项目链接
Write-Host "检查项目链接..." -ForegroundColor Yellow
$configPath = "supabase\config.toml"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    if ($configContent -match 'project_id\s*=\s*"([^"]+)"') {
        $projectId = $matches[1]
        Write-Host "✅ 项目 ID: $projectId" -ForegroundColor Green
        
        # 尝试链接项目
        Write-Host "链接项目..." -ForegroundColor Yellow
        supabase link --project-ref $projectId 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 项目已链接" -ForegroundColor Green
        } else {
            Write-Host "⚠️  项目链接可能已存在或需要重新链接" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  未找到项目 ID，请手动链接: supabase link --project-ref <your-project-ref>" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  未找到 config.toml，请先链接项目: supabase link --project-ref <your-project-ref>" -ForegroundColor Yellow
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
        supabase functions deploy $func 2>&1 | Tee-Object -Variable output
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $func 部署成功" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "❌ $func 部署失败" -ForegroundColor Red
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
    Write-Host ""
    Write-Host "验证步骤：" -ForegroundColor Cyan
    Write-Host "  1. 访问 Supabase Dashboard" -ForegroundColor White
    Write-Host "  2. 进入 Edge Functions 页面" -ForegroundColor White
    Write-Host "  3. 检查函数状态是否为 Active" -ForegroundColor White
    Write-Host "  4. 查看日志，确认使用共享模块" -ForegroundColor White
} else {
    Write-Host "⚠️  部分函数部署失败，请检查错误信息" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "故障排除：" -ForegroundColor Cyan
    Write-Host "  1. 检查 Supabase CLI 版本: supabase --version" -ForegroundColor White
    Write-Host "  2. 检查登录状态: supabase projects list" -ForegroundColor White
    Write-Host "  3. 检查项目链接: supabase link --project-ref <project-ref>" -ForegroundColor White
    Write-Host "  4. 查看详细错误信息" -ForegroundColor White
}

Write-Host ""

