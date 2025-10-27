# 部署 create-user Edge Function 的快速脚本
# PowerShell 脚本

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "部署 create-user Edge Function" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Supabase CLI 是否安装
Write-Host "检查 Supabase CLI..." -ForegroundColor Yellow
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseCli) {
    Write-Host "❌ Supabase CLI 未安装" -ForegroundColor Red
    Write-Host ""
    Write-Host "请选择安装方式：" -ForegroundColor Yellow
    Write-Host "1. 使用 npm 安装：npm install -g supabase" -ForegroundColor White
    Write-Host "2. 使用 Scoop 安装：scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase" -ForegroundColor White
    Write-Host ""
    Write-Host "或者手动在 Supabase Dashboard 部署：" -ForegroundColor Yellow
    Write-Host "1. 访问 https://app.supabase.com" -ForegroundColor White
    Write-Host "2. 进入 Edge Functions" -ForegroundColor White
    Write-Host "3. 创建新函数 'create-user'" -ForegroundColor White
    Write-Host "4. 复制 supabase/functions/create-user/index.ts 的内容" -ForegroundColor White
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
        Write-Host "❌ 项目 ID 不能为空" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "正在链接项目..." -ForegroundColor Yellow
    supabase link --project-ref $projectRef
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 链接项目失败" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ 项目已链接" -ForegroundColor Green
Write-Host ""

# 检查函数文件是否存在
Write-Host "检查 Edge Function 文件..." -ForegroundColor Yellow
$functionFile = "supabase/functions/create-user/index.ts"

if (-not (Test-Path $functionFile)) {
    Write-Host "❌ 函数文件不存在: $functionFile" -ForegroundColor Red
    Write-Host "请确保文件存在后重试" -ForegroundColor White
    exit 1
}

Write-Host "✓ 函数文件存在" -ForegroundColor Green
Write-Host ""

# 部署函数
Write-Host "开始部署 create-user 函数..." -ForegroundColor Yellow
Write-Host "请稍候，这可能需要几分钟..." -ForegroundColor White
Write-Host ""

supabase functions deploy create-user --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ 部署失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "请检查：" -ForegroundColor Yellow
    Write-Host "1. 网络连接是否正常" -ForegroundColor White
    Write-Host "2. 项目 ID 是否正确" -ForegroundColor White
    Write-Host "3. 函数代码是否有语法错误" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "✓ 部署成功！" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# 获取函数列表
Write-Host "已部署的 Edge Functions：" -ForegroundColor Cyan
supabase functions list

Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "1. 刷新前端页面" -ForegroundColor White
Write-Host "2. 进入 设置 → 用户管理" -ForegroundColor White
Write-Host "3. 点击 新建用户" -ForegroundColor White
Write-Host "4. 填写用户信息并创建" -ForegroundColor White
Write-Host ""

Write-Host "如果需要查看函数日志：" -ForegroundColor Yellow
Write-Host "supabase functions logs create-user" -ForegroundColor White
Write-Host ""

Write-Host "部署完成！🎉" -ForegroundColor Green

