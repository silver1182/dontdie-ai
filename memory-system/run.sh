#!/bin/bash
#
# 明妃三层记忆系统 - 启动脚本
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "$1" in
    test)
        echo "🧪 运行记忆系统测试..."
        python3 memory_plugin.py test
        ;;
    
    stats)
        echo "📊 记忆统计:"
        python3 memory_plugin.py stats
        ;;
    
    search)
        if [ -z "$2" ]; then
            echo "用法: $0 search '关键词'"
            exit 1
        fi
        echo "🔍 搜索记忆: $2"
        python3 memory_plugin.py search --query "$2"
        ;;
    
    import)
        if [ -z "$2" ]; then
            echo "用法: $0 import /path/to/memory.md"
            exit 1
        fi
        echo "📥 导入记忆文件: $2"
        python3 memory_plugin.py import --file "$2"
        ;;
    
    shell)
        echo "🐚 进入 Python 交互 shell..."
        python3 -c "
import sys
sys.path.insert(0, '$SCRIPT_DIR')
from memory_manager import get_memory_manager, remember, recall
mgr = get_memory_manager()
print('记忆系统已加载')
print('可用变量: mgr, remember(), recall()')
print('示例: remember(role=\"user\", content=\"你好\", user_id=\"test\")')
" -i
        ;;
    
    *)
        echo "🌸 明妃三层记忆系统"
        echo ""
        echo "用法: $0 [命令]"
        echo ""
        echo "命令:"
        echo "  test              运行测试"
        echo "  stats             查看统计"
        echo "  search '关键词'    搜索记忆"
        echo "  import [文件]      导入 MEMORY.md"
        echo "  shell             进入交互 shell"
        echo ""
        echo "数据库位置: ~/.openclaw/memory/raw_memory.db"
        ;;
esac
