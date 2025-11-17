import subprocess
import re
from datetime import datetime, timedelta
import os
import time

# --- 配置区 ---

# 1. 你的 Git 作者名 (用于筛选你自己的提交)
#    (打开终端，输入 git config user.name 即可查看)
GIT_AUTHOR_NAME = "dmuxue2"  # 替换成你的名字

# 2. 批量处理的最终停止日期
FINAL_STOP_DATE = "2025-07-01"

# 3. 批量处理的开始日期 (默认从今天开始)
BATCH_START_DATE = "2025-11-17"

# 4. 输出目录 (脚本会在当前目录下创建这个文件夹来存放md文件)
OUTPUT_DIR = "Weekly_Worklog_Drafts"

# --- 关键配置：自定义文件分类 ---
# (请根据你的项目 'shipment-data-view' 的结构修改这里的规则)
def categorize_file(filepath):
    """根据文件路径返回它的类别"""
    if filepath.startswith('supabase/functions/'):
        return 'Edge Functions'
    if filepath.startswith('supabase/migrations/'):
        return '数据库迁移'
    if filepath.startswith('src/components/'):
        return '组件'
    if filepath.startswith('src/pages/'):
        return '页面'
    if filepath.startswith('src/hooks/'):
        return 'Hooks'
    if filepath.startswith('src/services/'):
        return 'Services'
    if filepath.startswith('src/types/'):
        return '类型定义'
    if filepath.startswith('docs/'):
        return '文档'
    if filepath.endswith('.sql'):
        return 'SQL脚本'
    if filepath.endswith('.ps1') or filepath.endswith('.sh'):
        return '部署脚本'
    if filepath.startswith('src/'):
        return '前端核心'
    return '其他'
# ---------------------------------


def get_git_log_with_files(author_name, start_date, end_date):
    """
    使用 git log 获取指定日期范围内的提交记录和文件状态。
    """
    # %H = 完整 hash, %s = 提交信息
    # --name-status = 显示文件状态 (A=Added, M=Modified, D=Deleted)
    command = [
        'git', 'log', 
        f'--author={author_name}', 
        f'--since="{start_date} 00:00:00"',
        f'--until="{end_date} 23:59:59"',
        '--name-status',
        '--pretty=format:---COMMIT---%n%s' # 使用特殊分隔符
    ]
    
    try:
        # 使用 shell=True 来正确处理带引号的日期
        result = subprocess.run(' '.join(command), capture_output=True, text=True, check=True, shell=True, encoding='utf-8')
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"  > 执行 git log 出错: {e.stderr}")
        return None
    except FileNotFoundError:
        print("错误：'git' 命令未找到。请确保 Git 已经安装并配置在系统的 PATH 中。")
        return None

def parse_git_log(log_output):
    """
    解析 git log 的输出，分类提交和文件。
    """
    commits_by_category = {
        'Feat': [], 'Fix': [], 'Refactor': [], 'Docs': [], 
        'Chore': [], 'Style': [], 'Test': [], 'Others': []
    }
    files_added = set()
    files_modified = set()
    files_deleted = set()
    
    if not log_output or log_output.strip() == "":
        return commits_by_category, files_added, files_modified, files_deleted

    commit_pattern = re.compile(r'^\s*(\w+)(?:\([\w\s-]+\))?:\s*(.+)')
    current_commit_msg = "Unknown"
    lines = log_output.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if line.startswith('---COMMIT---'):
            continue
        
        if line.startswith(('A\t', 'M\t', 'D\t')):
            try:
                status, filepath = line.split('\t', 1)
                filepath = filepath.replace('"', '') # 清理可能的引号
                
                if status == 'A':
                    files_added.add(filepath)
                elif status == 'M':
                    files_modified.add(filepath)
                elif status == 'D':
                    files_deleted.add(filepath)
            except ValueError:
                print(f"  > 警告：无法解析的文件行: {line}")
        else:
            current_commit_msg = line
            match = commit_pattern.match(current_commit_msg)
            if match:
                category_key = match.group(1).capitalize()
                message = match.group(2).strip()
                if category_key in commits_by_category:
                    commits_by_category[category_key].append(message)
                else:
                    commits_by_category['Others'].append(current_commit_msg)
            else:
                commits_by_category['Others'].append(current_commit_msg)

    return commits_by_category, files_added, files_modified, files_deleted

def categorize_files(file_set):
    """
    将文件集合按自定义规则分类。
    """
    categorized = {}
    for filepath in sorted(list(file_set)):
        category = categorize_file(filepath)
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(filepath)
    return categorized

def generate_worklog_draft(log_date_str, commits, added_files, modified_files, deleted_files):
    """
    生成最终的 Markdown 工作日志初稿。
    """
    log_content = f"# 📅 工作日志 - {log_date_str}\n\n"
    log_content += "## ✅ 已完成的任务 (Commits)\n\n"
    log_content += "*(请将以下 Commit 记录归纳总结为 '任务1: ...', '任务2: ...')*\n\n"
    
    has_commits = False
    for category, messages in commits.items():
        if messages:
            # 我们只显示不重复的提交信息
            unique_messages = sorted(list(set(messages)))
            if unique_messages:
                has_commits = True
                log_content += f"### {category}:\n"
                for msg in unique_messages:
                    log_content += f"- {msg}\n"
                log_content += "\n"
            
    if not has_commits:
        log_content += "此时间段内暂无提交记录。\n\n"

    # --- 文件清单 ---
    if added_files:
        log_content += "## 📦 创建的文件清单\n\n"
        categorized_added = categorize_files(added_files)
        for category, files in categorized_added.items():
            log_content += f"### {category} ({len(files)}个)\n"
            for f in files:
                log_content += f"- `{f}`\n"
            log_content += "\n"
            
    if modified_files:
        log_content += "## 🔧 修改的文件清单\n\n"
        categorized_modified = categorize_files(modified_files)
        for category, files in categorized_modified.items():
            log_content += f"### {category} ({len(files)}个)\n"
            for f in files:
                log_content += f"- `{f}`\n"
            log_content += "\n"

    if deleted_files:
        log_content += "## 🗑️ 删除的文件清单\n\n"
        categorized_deleted = categorize_files(deleted_files)
        for category, files in categorized_deleted.items():
            log_content += f"### {category} ({len(files)}个)\n"
            for f in files:
                log_content += f"- `{f}`\n"
            log_content += "\n"

    # --- 待补充模板 ---
    log_content += "## 🚀 待执行的部署\n\n"
    log_content += "*(待补充...)*\n\n"
    log_content += "## 📊 工作统计\n\n"
    log_content += "*(待补充...)*\n\n"
    log_content += "## 🎯 质量保证\n\n"
    log_content += "*(待补充...)*\n\n"
    log_content += "## 🎉 主要成就\n\n"
    log_content += "*(待补充...)*\n\n"
    log_content += "## 🎊 总结\n\n"
    log_content += "*(待补充...)*\n"

    return log_content

# --- 主程序：批量循环 ---
if __name__ == "__main__":
    
    if not GIT_AUTHOR_NAME or GIT_AUTHOR_NAME == "你的Git用户名":
        print("="*50)
        print("错误：请先修改脚本顶部的 `GIT_AUTHOR_NAME` 变量！")
        print("你可以通过在终端输入 `git config user.name` 来查看你的Git用户名。")
        print("="*50)
        exit()

    # 创建输出目录
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"创建输出目录: {OUTPUT_DIR}")

    try:
        end_date_obj = datetime.strptime(BATCH_START_DATE, '%Y-%m-%d')
        final_stop_date_obj = datetime.strptime(FINAL_STOP_DATE, '%Y-%m-%d')
    except ValueError as e:
        print(f"日期格式错误: {e}. 请使用 'YYYY-MM-DD'.")
        exit()

    current_end_date = end_date_obj
    week_counter = 1

    print("--- 开始批量抓取每周工作日志 ---")

    while current_end_date >= final_stop_date_obj:
        
        # 1. 计算本周的开始和结束日期
        current_start_date = current_end_date - timedelta(days=6)
        
        # 确保开始日期不会早于最终停止日期
        if current_start_date < final_stop_date_obj:
            current_start_date = final_stop_date_obj
            
        start_str = current_start_date.strftime('%Y-%m-%d')
        end_str = current_end_date.strftime('%Y-%m-%d')
        
        print(f"\n[第 {week_counter} 周] 正在处理: {start_str} 至 {end_str}")

        # 2. 获取 Git Log
        raw_log = get_git_log_with_files(
            author_name=GIT_AUTHOR_NAME, 
            start_date=start_str,
            end_date=end_str
        )
        
        if raw_log is not None:
            # 3. 解析 Log
            commits, added, modified, deleted = parse_git_log(raw_log)
            
            # 4. 生成日志
            log_date_str = f"{start_str} 至 {end_str}"
            worklog_draft = generate_worklog_draft(log_date_str, commits, added, modified, deleted)
            
            # 5. 保存文件
            filename = f"worklog_summary_{start_str}_to_{end_str}.md"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(worklog_draft)
                print(f"  > ✅ 成功保存到: {filepath}")
            except IOError as e:
                print(f"  > ❌ 保存文件失败: {e}")
                
        else:
            print(f"  > ⚠️ 抓取 Git Log 失败，跳过这一周。")

        # 6. 准备下一轮循环 (移到上一周的开始日期的前一天)
        current_end_date = current_start_date - timedelta(days=1)
        week_counter += 1
        
        # 稍微暂停一下，避免请求过快 (如果需要)
        # time.sleep(0.1) 

    print("\n--- 批量处理完成！ ---")