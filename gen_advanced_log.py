import subprocess
import re
from datetime import datetime, timedelta
import os
import time

# --- 配置区 ---

# 1. 您的 Git 作者名 (已根据您的反馈填好)
GIT_AUTHOR_NAME = "dmuxue2"

# 2. 批量处理的最终停止日期
FINAL_STOP_DATE = "2025-07-01"

# 3. 批量处理的开始日期 (您指定的日期)
BATCH_START_DATE = "2025-11-17"

# 4. 输出目录 (脚本会在当前目录下创建这个文件夹来存放md文件)
OUTPUT_DIR = "Daily_Worklog_Drafts_dmuxue2"

# --- 关键配置：自定义文件分类 ---
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


def get_git_log_with_files(author_name, date_str):
    """
    使用 git log 获取指定某一天的提交记录和文件状态。
    V3版：使用 %B 抓取完整提交信息，并使用更健壮的分隔符。
    """
    # %B = 完整的提交信息 (标题 + 正文)
    # --name-status = 显示文件状态 (A=Added, M=Modified, D=Deleted)
    # 使用 \x01 (Start of Heading) 和 \x02 (Start of Text) 作为机器可读的分隔符
    commit_format = "--COMMIT_START--%n%B%n--FILES_START--"
    
    command = [
        'git', 'log', 
        f'--author={author_name}', 
        f'--since="{date_str} 00:00:00"',
        f'--until="{date_str} 23:59:59"',
        '--name-status',
        f'--pretty=format:{commit_format}'
    ]
    
    try:
        # 使用 shell=True 来正确处理带引号的日期
        result = subprocess.run(' '.join(command), capture_output=True, text=True, check=True, shell=True, encoding='utf-8')
        return result.stdout
    except subprocess.CalledProcessError as e:
        # 如果没有提交，git log 可能会返回错误，但这没关系
        if e.returncode == 128 or e.stdout == "" or e.stderr:
             print(f"  > 提示: {date_str} 没有找到匹配的提交。")
             return "" # 返回空字符串表示无活动
        print(f"  > 执行 git log 出错: {e.stderr}")
        return None
    except FileNotFoundError:
        print("错误：'git' 命令未找到。请确保 Git 已经安装并配置在系统的 PATH 中。")
        return None

def parse_git_log(log_output):
    """
    V3版解析器：使用新的分隔符来解析完整的提交信息和文件。
    """
    all_commits_set = set() # 使用集合自动去重
    files_added = set()
    files_modified = set()
    files_deleted = set()
    
    if not log_output or log_output.strip() == "":
        return all_commits_set, files_added, files_modified, files_deleted

    # 1. 按 "--COMMIT_START--" 分割每个提交
    commit_chunks = log_output.split('--COMMIT_START--')
    
    for chunk in commit_chunks:
        if not chunk.strip():
            continue
            
        # 2. 按 "--FILES_START--" 分割提交信息和文件列表
        parts = chunk.split('--FILES_START--')
        
        if len(parts) != 2:
            # print(f"  > 警告：解析块失败，跳过: {chunk[:50]}...")
            continue
            
        # 3. 提取完整的提交信息
        commit_message = parts[0].strip()
        if commit_message:
            all_commits_set.add(commit_message)
            
        # 4. 提取文件列表
        file_list_str = parts[1].strip()
        file_lines = file_list_str.split('\n')
        
        for line in file_lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith(('A\t', 'M\t', 'D\t')):
                try:
                    # 使用 split(maxsplit=1) 来正确处理包含空格的文件名
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
            # else:
                # 可能是空的提交（没有文件变更），忽略即可

    return all_commits_set, files_added, files_modified, files_deleted

def categorize_files(file_set):
    """
    将文件集合按自定义规则分类。
    """
    categorized = {}
    for filepath in sorted(list(file_set)):
        # 修复因Git转义导致的路径问题
        if '\\' in filepath:
            filepath = filepath.encode('latin-1').decode('unicode_escape')
            
        category = categorize_file(filepath)
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(filepath)
    return categorized

def generate_worklog_draft(log_date_str, all_commits_set, added_files, modified_files, deleted_files):
    """
    V3版生成器：将所有“改进内容”（包括正文）放在最前面。
    """
    log_content = f"# 📅 工作日志 - {log_date_str}\n\n"
    
    # --- 核心改进内容 (Commits) ---
    log_content += "## ✅ 核心改进内容 (Commits)\n\n"
    log_content += "*(AI总结的基础素材)*\n\n"
    
    if all_commits_set:
        unique_messages = sorted(list(all_commits_set))
        for msg in unique_messages:
            if msg.strip(): 
                # 为多行提交信息添加 markdown 换行（在行尾加两个空格）
                formatted_msg = '  \n'.join(msg.splitlines())
                log_content += f"- {formatted_msg}\n\n" # 提交之间用空行分隔
    else:
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
    log_content += "--- (以下为AI总结填充区) ---\n\n"
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

# --- 主程序：批量循环 (日报版) ---
if __name__ == "__main__":
    
    # 检查用户名是否已配置
    if not GIT_AUTHOR_NAME or GIT_AUTHOR_NAME == "你的Git用户名":
        print("="*50)
        print("错误：脚本顶部的 `GIT_AUTHOR_NAME` 变量未配置！")
        print(f"已根据您的输入自动设置为 'dmuxue2'，如果不正确，请手动修改脚本。")
        GIT_AUTHOR_NAME = "dmuxue2" # 自动设置
        print("="*50)

    # 创建输出目录
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"创建输出目录: {OUTPUT_DIR}")

    try:
        current_date = datetime.strptime(BATCH_START_DATE, '%Y-%m-%d')
        final_stop_date_obj = datetime.strptime(FINAL_STOP_DATE, '%Y-%m-%d')
    except ValueError as e:
        print(f"日期格式错误: {e}. 请使用 'YYYY-MM-DD'.")
        exit()

    day_counter = 1

    print(f"--- 开始为 {GIT_AUTHOR_NAME} 批量抓取每日工作日志 ---")
    print(f"时间范围: {BATCH_START_DATE} 回溯至 {FINAL_STOP_DATE}")

    while current_date >= final_stop_date_obj:
        
        # 1. 获取当天的日期字符串
        date_str = current_date.strftime('%Y-%m-%d')
        
        print(f"\n[第 {day_counter} 天] 正在处理: {date_str}")

        # 2. 获取 Git Log
        raw_log = get_git_log_with_files(
            author_name=GIT_AUTHOR_NAME, 
            date_str=date_str
        )
        
        if raw_log is not None:
            # 3. 解析 Log
            commits, added, modified, deleted = parse_git_log(raw_log)
            
            # 4. 检查当天是否有活动
            if not commits and not added and not modified and not deleted:
                print(f"  > ⚪ 无活动，跳过。")
                # 准备下一轮循环
                current_date = current_date - timedelta(days=1)
                day_counter += 1
                continue # 跳过本轮循环的剩余部分

            # 5. (如果有活动) 生成日志
            worklog_draft = generate_worklog_draft(date_str, commits, added, modified, deleted)
            
            # 6. 保存文件
            filename = f"worklog_summary_{date_str}.md"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(worklog_draft)
                print(f"  > ✅ 成功保存到: {filepath}")
            except IOError as e:
                print(f"  > ❌ 保存文件失败: {e}")
                
        else:
            print(f"  > ⚠️ 抓取 Git Log 失败，跳过这一天。")

        # 7. 准备下一轮循环 (移到前一天)
        current_date = current_date - timedelta(days=1)
        day_counter += 1
        
        # 稍微暂停一下，避免请求过快 (如果需要)
        # time.sleep(0.05) 

    print("\n--- 批量处理完成！ ---")