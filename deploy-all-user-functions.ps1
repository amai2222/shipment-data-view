# 部署所有用户管理 Edge Functions 的统一脚本
# PowerShell 脚本

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  部署用户管理 Edge Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 函数列表
$functions = @(
    @{Name="create-user"; Description="创建用户"},
    @{Name="update-user-password"; Description="修改密码"},
    @{Name="update-user"; Description="更新用户信息"},
    @{Name="delete-user"; Description="删除用户"}
)

# 检查 Supabase CLI 是否安装
Write-Host "检查 Supabase CLI..." -ForegroundColor Yellow
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseCli) {
    Write-Host ""
    Write-Host "❌ Supabase CLI 未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "请选择安装方式：" -ForegroundColor Yellow
    Write-Host "1. 使用 npm 安装：" -ForegroundColor White
    Write-Host "   npm install -g supabase" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 使用 Scoop 安装：" -ForegroundColor White
    Write-Host "   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git" -ForegroundColor Gray
    Write-Host "   scoop install supabase" -ForegroundColor Gray
    Write-Host ""
    Write-Host "或者手动在 Supabase Dashboard 部署：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://app.supabase.com" -ForegroundColor White
    Write-Host "2. 进入 Edge Functions" -ForegroundColor White
    Write-Host "3. 依次创建以下函数：" -ForegroundColor White
    foreach ($func in $functions) {
        Write-Host "   - $($func.Name) ($($func.Description))" -ForegroundColor Gray
    }
    exit 1
}

Write-Host "✓ Supabase CLI 已安装" -ForegroundColor Green
Write-Host ""

# 检查是否已登录
Write-Host "检查登录状态..." -ForegroundColor Yellow
$loginCheck = supabase projects list 2>&1

if ($loginCheck -match "not logged in" -or $loginCheck -match "登录") {
    Write-Host "需要登录 Supabase..." -ForegroundColor Yellow
    Write-Host "即将打开浏览器进行登录..." -ForegroundColor White
    supabase login
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ 登录失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ 已登录" -ForegroundColor Green
Write-Host ""

# 检查是否已链接项目
Write-Host "检查项目链接状态..." -ForegroundColor Yellow
$linkCheck = supabase status 2>&1

if ($linkCheck -match "not linked" -or $linkCheck -match "未链接") {
    Write-Host "需要链接 Supabase 项目..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请输入项目 ID (在 Supabase Dashboard 的 Settings → General 中可以找到):" -ForegroundColor White
    $projectRef = Read-Host "项目 ID"
    
    if ([string]::IsNullOrWhiteSpace($projectRef)) {
        Write-Host ""
        Write-Host "❌ 项目 ID 不能为空" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "正在链接项目..." -ForegroundColor Yellow
    supabase link --project-ref $projectRef
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ 链接项目失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ 项目已链接" -ForegroundColor Green
Write-Host ""

# 检查函数文件是否存在
Write-Host "检查 Edge Function 文件..." -ForegroundColor Yellow
$missingFiles = @()

foreach ($func in $functions) {
    $filePath = "supabase/functions/$($func.Name)/index.ts"
    if (-not (Test-Path $filePath)) {
        $missingFiles += $filePath
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ 以下函数文件不存在：" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "请确保所有文件存在后重试" -ForegroundColor White
    exit 1
}

Write-Host "✓ 所有函数文件都存在" -ForegroundColor Green
Write-Host ""

# 部署所有函数
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "开始部署 Edge Functions..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failureCount = 0
$results = @()

foreach ($func in $functions) {
    Write-Host "正在部署 $($func.Name) ($($func.Description))..." -ForegroundColor Yellow
    
    supabase functions deploy $($func.Name) --no-verify-jwt 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $($func.Name) 部署成功" -ForegroundColor Green
        $successCount++
        $results += @{Name=$func.Name; Success=$true; Description=$func.Description}
    } else {
        Write-Host "✗ $($func.Name) 部署失败" -ForegroundColor Red
        $failureCount++
        $results += @{Name=$func.Name; Success=$false; Description=$func.Description}
    }
    Write-Host ""
}

# 显示部署结果
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "部署结果汇总" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($result in $results) {
    if ($result.Success) {
        Write-Host "✓ $($result.Name) - $($result.Description)" -ForegroundColor Green
    } else {
        Write-Host "✗ $($result.Name) - $($result.Description)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "成功: $successCount 个函数" -ForegroundColor Green
Write-Host "失败: $failureCount 个函数" -ForegroundColor Red
Write-Host ""

if ($failureCount -gt 0) {
    Write-Host "部署未完全成功，请检查错误信息" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "常见问题排查：" -ForegroundColor Yellow
    Write-Host "1. 检查网络连接是否正常" -ForegroundColor White
    Write-Host "2. 检查项目 ID 是否正确" -ForegroundColor White
    Write-Host "3. 检查函数代码是否有语法错误" -ForegroundColor White
    Write-Host "4. 查看函数日志：supabase functions logs <function-name>" -ForegroundColor White
    exit 1
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ 所有 Edge Functions 部署成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 显示已部署的函数列表
Write-Host "已部署的 Edge Functions：" -ForegroundColor Cyan
supabase functions list

Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "1. 刷新前端页面（按 Ctrl+F5）" -ForegroundColor White
Write-Host "2. 进入 设置 → 用户管理" -ForegroundColor White
Write-Host "3. 测试以下功能：" -ForegroundColor White
Write-Host "   • 创建新用户" -ForegroundColor Gray
Write-Host "   • 修改用户密码" -ForegroundColor Gray
Write-Host "   • 更新用户信息" -ForegroundColor Gray
Write-Host "   • 删除/停用用户" -ForegroundColor Gray
Write-Host ""

Write-Host "查看函数日志（如需调试）：" -ForegroundColor Yellow
Write-Host "supabase functions logs <function-name>" -ForegroundColor White
Write-Host ""

Write-Host "部署完成！🎉" -ForegroundColor Green
Write-Host ""

