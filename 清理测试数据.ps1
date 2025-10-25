# 清理测试数据脚本
# 文件：清理测试数据.ps1
# 描述：清理系统中的所有测试数据
# 创建时间：2025-10-25

Write-Host "=============================" -ForegroundColor Cyan
Write-Host "测试数据清理工具" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# 检查SQL文件是否存在
$sqlFile = "执行清理测试数据.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ 错误：找不到SQL文件 $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "📋 准备清理以下测试数据：" -ForegroundColor Yellow
Write-Host "  - 测试合作方记录" -ForegroundColor Yellow
Write-Host "  - 测试运单记录" -ForegroundColor Yellow
Write-Host "  - 测试银行详情" -ForegroundColor Yellow
Write-Host ""

# 确认操作
Write-Host "⚠️  警告：此操作将永久删除测试数据！" -ForegroundColor Red
Write-Host ""
$confirm = Read-Host "是否继续？(输入 'YES' 确认)"

if ($confirm -ne 'YES') {
    Write-Host "❌ 操作已取消" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "执行清理操作" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host ""

# 读取环境变量
$env:SUPABASE_PROJECT_ID = $env:SUPABASE_PROJECT_ID
$env:SUPABASE_DB_PASSWORD = $env:SUPABASE_DB_PASSWORD

if (-not $env:SUPABASE_PROJECT_ID -or -not $env:SUPABASE_DB_PASSWORD) {
    Write-Host "❌ 错误：未找到Supabase环境变量" -ForegroundColor Red
    Write-Host ""
    Write-Host "请执行以下步骤之一：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方法1：在Supabase控制台中手动执行" -ForegroundColor Green
    Write-Host "  1. 登录 Supabase Dashboard" -ForegroundColor White
    Write-Host "  2. 进入 SQL Editor" -ForegroundColor White
    Write-Host "  3. 复制并执行文件：$sqlFile" -ForegroundColor White
    Write-Host ""
    Write-Host "方法2：设置环境变量后重新运行" -ForegroundColor Green
    Write-Host "  `$env:SUPABASE_PROJECT_ID='你的项目ID'" -ForegroundColor White
    Write-Host "  `$env:SUPABASE_DB_PASSWORD='你的数据库密码'" -ForegroundColor White
    Write-Host ""
    exit 1
}

# 构建数据库连接字符串
$dbHost = "db.$env:SUPABASE_PROJECT_ID.supabase.co"
$dbName = "postgres"
$dbUser = "postgres"
$dbPassword = $env:SUPABASE_DB_PASSWORD

Write-Host "📡 正在连接到数据库..." -ForegroundColor Cyan
Write-Host "   主机: $dbHost" -ForegroundColor Gray

# 使用psql执行SQL文件
try {
    $env:PGPASSWORD = $dbPassword
    
    # 检查psql是否可用
    $psqlVersion = psql --version 2>$null
    if (-not $psqlVersion) {
        throw "未找到psql命令"
    }
    
    Write-Host ""
    Write-Host "🚀 开始执行清理脚本..." -ForegroundColor Green
    Write-Host ""
    
    # 执行SQL文件
    psql -h $dbHost -U $dbUser -d $dbName -f $sqlFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=============================" -ForegroundColor Green
        Write-Host "✓ 测试数据清理完成！" -ForegroundColor Green
        Write-Host "=============================" -ForegroundColor Green
        Write-Host ""
        Write-Host "建议操作：" -ForegroundColor Yellow
        Write-Host "  1. 刷新付款申请单页面" -ForegroundColor White
        Write-Host "  2. 验证测试数据已清除" -ForegroundColor White
        Write-Host "  3. 检查申请单金额是否正确" -ForegroundColor White
    } else {
        throw "SQL执行失败，退出代码：$LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "=============================" -ForegroundColor Red
    Write-Host "❌ 清理失败" -ForegroundColor Red
    Write-Host "=============================" -ForegroundColor Red
    Write-Host ""
    Write-Host "错误信息：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "请改用手动执行方式：" -ForegroundColor Yellow
    Write-Host "  1. 登录 Supabase Dashboard" -ForegroundColor White
    Write-Host "  2. 进入 SQL Editor" -ForegroundColor White
    Write-Host "  3. 复制并执行文件：$sqlFile" -ForegroundColor White
    Write-Host ""
    exit 1
} finally {
    # 清除密码环境变量
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

