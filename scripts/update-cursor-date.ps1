# 自动更新 .cursor-date 文件中的当前日期
# 此脚本会读取系统当前日期并更新 .cursor-date 文件

# 获取当前日期（YYYY-MM-DD 格式）
$currentDate = Get-Date -Format "yyyy-MM-dd"
$currentTime = Get-Date -Format "HH:mm:ss"

# .cursor-date 文件路径（相对于脚本目录的上级目录）
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cursorDatePath = Join-Path (Split-Path -Parent $scriptDir) ".cursor-date"

# 文件内容
$fileContent = @"
# Cursor AI 当前日期配置
# 此文件用于同步 AI 助手使用的当前日期
# 此文件由 scripts/update-cursor-date.ps1 自动更新
# 最后更新：$currentDate $currentTime

CURRENT_DATE=$currentDate
"@

try {
    # 写入文件
    $fileContent | Out-File -FilePath $cursorDatePath -Encoding UTF8 -NoNewline
    Write-Host "✅ 已更新 .cursor-date 文件，当前日期：$currentDate" -ForegroundColor Green
} catch {
    Write-Host "❌ 更新 .cursor-date 文件失败：$_" -ForegroundColor Red
    exit 1
}

