#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 1 续: OpenClaw 集成插件
自动捕获对话并注入记忆上下文
"""

import sys
import json
from pathlib import Path

# 添加记忆系统路径
sys.path.insert(0, str(Path(__file__).parent))

from memory_manager import get_memory_manager, remember, recall

class MemoryPlugin:
    """
    OpenClaw 记忆插件
    功能：
    1. 自动捕获对话存入原始记忆层
    2. 在Prompt中注入相关记忆上下文
    3. 定期生成记忆摘要
    """
    
    def __init__(self):
        self.mgr = get_memory_manager()
        self.session_id = None
        self.user_id = None
        self.channel = "unknown"
    
    def on_session_start(self, session_key: str, user_id: str, channel: str = "unknown"):
        """会话开始时调用"""
        self.session_id = session_key
        self.user_id = user_id
        self.channel = channel
        
        # 存入会话开始标记
        remember(
            role="system",
            content=f"会话开始: {session_key}",
            channel=channel,
            user_id=user_id,
            metadata={"event": "session_start", "session_key": session_key}
        )
    
    def on_user_message(self, content: str, metadata: dict = None) -> str:
        """
        用户消息到达时调用
        返回：应该注入到Prompt的记忆上下文
        """
        # 1. 存储用户消息
        remember(
            role="user",
            content=content,
            channel=self.channel,
            user_id=self.user_id,
            metadata=metadata or {}
        )
        
        # 2. 检索相关记忆（用于注入Prompt）
        context = self.mgr.retriever.get_context_for_prompt(
            user_id=self.user_id,
            current_topic=content[:100],  # 用消息前100字作为话题
            max_items=5
        )
        
        return context
    
    def on_assistant_response(self, content: str, metadata: dict = None):
        """助手回复后调用"""
        remember(
            role="assistant",
            content=content,
            channel=self.channel,
            user_id=self.user_id,
            metadata=metadata or {}
        )
    
    def on_session_end(self):
        """会话结束时调用"""
        remember(
            role="system",
            content=f"会话结束: {self.session_id}",
            channel=self.channel,
            user_id=self.user_id,
            metadata={"event": "session_end", "session_key": self.session_id}
        )
        
        # 打印统计
        stats = self.mgr.stats()
        print(f"[记忆系统] 会话结束，当前总记忆数: {stats.get('total_memories', 0)}")
    
    def get_status(self) -> dict:
        """获取记忆系统状态"""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "channel": self.channel,
            "stats": self.mgr.stats()
        }

# 全局插件实例
_plugin_instance = None

def get_plugin() -> MemoryPlugin:
    """获取插件实例（单例）"""
    global _plugin_instance
    if _plugin_instance is None:
        _plugin_instance = MemoryPlugin()
    return _plugin_instance

# 提供给 OpenClaw 的 Hook 函数
def memory_hook_before_prompt(session_key: str, user_id: str, message: str, channel: str = "unknown") -> str:
    """
    OpenClaw 在构建Prompt前调用的Hook
    返回应该追加到System Prompt的记忆上下文
    """
    plugin = get_plugin()
    
    # 确保会话已初始化
    if plugin.session_id != session_key:
        plugin.on_session_start(session_key, user_id, channel)
    
    # 获取记忆上下文
    context = plugin.on_user_message(message)
    
    return context

def memory_hook_after_response(session_key: str, response: str):
    """
    OpenClaw 在助手回复后调用的Hook
    """
    plugin = get_plugin()
    plugin.on_assistant_response(response)

def memory_hook_session_end(session_key: str):
    """
    OpenClaw 在会话结束时调用的Hook
    """
    plugin = get_plugin()
    if plugin.session_id == session_key:
        plugin.on_session_end()

# 命令行工具
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="明妃记忆系统工具")
    parser.add_argument("command", choices=["stats", "search", "import", "test"])
    parser.add_argument("--query", "-q", help="搜索关键词")
    parser.add_argument("--file", "-f", help="导入文件路径")
    parser.add_argument("--user", "-u", default="unknown", help="用户ID")
    
    args = parser.parse_args()
    
    mgr = get_memory_manager()
    
    if args.command == "stats":
        print(json.dumps(mgr.stats(), ensure_ascii=False, indent=2))
    
    elif args.command == "search":
        if not args.query:
            print("请提供搜索关键词: --query '关键词'")
        else:
            results = mgr.recall(args.query, user_id=args.user)
            print(results)
    
    elif args.command == "import":
        if not args.file:
            print("请提供文件路径: --file /path/to/memory.md")
        else:
            from memory_manager import MemoryCollector
            collector = MemoryCollector()
            count = collector.import_from_memory_file(args.file, args.user)
            print(f"成功导入 {count} 条记忆")
    
    elif args.command == "test":
        print("=== 运行记忆系统测试 ===")
        
        # 模拟一次对话
        plugin = get_plugin()
        plugin.on_session_start("test-session", "test-user", "cli")
        
        # 用户消息
        context = plugin.on_user_message("你好，明妃，你还记得我是谁吗？")
        print(f"\n注入的上下文:\n{context}")
        
        # 助手回复
        plugin.on_assistant_response("你好！根据我的记忆，我们之前聊过天。你是test-user。")
        
        # 结束
        plugin.on_session_end()
        
        print(f"\n最终统计: {json.dumps(mgr.stats(), ensure_ascii=False)}")
