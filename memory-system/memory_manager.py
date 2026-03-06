#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 1 续: 记忆收集器与检索器
自动收集 OpenClaw 会话并支持基础检索
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from raw_memory import RawMemory, RawMemoryStore

class MemoryCollector:
    """记忆收集器 - 自动捕获对话"""
    
    def __init__(self, store: RawMemoryStore = None):
        self.store = store or RawMemoryStore()
        self.current_session_id = None
    
    def start_session(self, session_key: str) -> str:
        """开始新会话"""
        self.current_session_id = session_key or str(uuid.uuid4())
        return self.current_session_id
    
    def collect(self, 
                role: str, 
                content: str,
                channel: str = "unknown",
                user_id: str = "unknown",
                emotion: str = "neutral",
                metadata: Dict = None) -> bool:
        """收集一条对话"""
        
        memory = RawMemory(
            memory_id=str(uuid.uuid4()),
            session_id=self.current_session_id or str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            role=role,
            content=content,
            channel=channel,
            user_id=user_id,
            emotion=emotion,
            metadata=metadata or {}
        )
        
        return self.store.store(memory)
    
    def collect_from_message(self, message_data: Dict) -> bool:
        """从消息字典收集"""
        return self.collect(
            role=message_data.get('role', 'unknown'),
            content=message_data.get('content', ''),
            channel=message_data.get('channel', 'unknown'),
            user_id=message_data.get('user_id', 'unknown'),
            emotion=message_data.get('emotion', 'neutral'),
            metadata=message_data.get('metadata', {})
        )
    
    def import_from_memory_file(self, file_path: str, user_id: str = "unknown") -> int:
        """从现有 MEMORY.md 导入历史记忆"""
        count = 0
        path = Path(file_path)
        
        if not path.exists():
            return 0
        
        content = path.read_text(encoding='utf-8')
        lines = content.split('\n')
        
        session_id = f"import-{path.stem}-{datetime.now().strftime('%Y%m%d')}"
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # 简单解析：把整个段落作为一条记忆
            if len(line) > 10:
                self.collect(
                    role="system",  # 历史记录标记为system
                    content=line[:500],  # 限制长度
                    channel="import",
                    user_id=user_id,
                    metadata={"source": "memory.md", "original_file": str(file_path)}
                )
                count += 1
        
        return count

class MemoryRetriever:
    """记忆检索器 - 支持多种检索方式"""
    
    def __init__(self, store: RawMemoryStore = None):
        self.store = store or RawMemoryStore()
    
    def get_context_for_prompt(self, 
                               user_id: str = None, 
                               current_topic: str = None,
                               max_items: int = 10) -> str:
        """
        获取用于注入Prompt的上下文记忆
        返回格式化的记忆字符串
        """
        memories = []
        
        # 1. 获取最近对话
        recent = self.store.get_recent(user_id=user_id, limit=5)
        memories.extend(recent)
        
        # 2. 如果提供了当前话题，搜索相关记忆
        if current_topic:
            related = self.store.search_content(current_topic, limit=5)
            # 去重
            seen_ids = {m.memory_id for m in memories}
            for m in related:
                if m.memory_id not in seen_ids:
                    memories.append(m)
        
        # 格式化输出
        if not memories:
            return ""
        
        context_parts = ["\n## 相关记忆\n"]
        
        for mem in memories[:max_items]:
            time_str = mem.timestamp[:10]  # 只显示日期
            context_parts.append(f"- [{time_str}] {mem.role}: {mem.content[:100]}...")
        
        return "\n".join(context_parts)
    
    def search(self, query: str, user_id: str = None, limit: int = 10) -> List[Dict]:
        """综合搜索（关键词+时间）"""
        results = []
        
        # 关键词搜索
        keyword_results = self.store.search_content(query, limit=limit)
        results.extend(keyword_results)
        
        # 如果指定了用户，也获取该用户最近记忆
        if user_id:
            recent = self.store.get_recent(user_id=user_id, limit=5)
            seen_ids = {r.memory_id for r in results}
            for r in recent:
                if r.memory_id not in seen_ids:
                    results.append(r)
        
        # 转换为字典并返回
        return [{
            "id": m.memory_id,
            "time": m.timestamp,
            "role": m.role,
            "content": m.content[:200],  # 截断
            "channel": m.channel
        } for m in results[:limit]]
    
    def get_conversation_summary(self, session_id: str) -> str:
        """获取会话摘要"""
        memories = self.store.get_by_session(session_id)
        
        if not memories:
            return "无记忆"
        
        # 简单统计
        user_msgs = [m for m in memories if m.role == "user"]
        assistant_msgs = [m for m in memories if m.role == "assistant"]
        
        return f"会话 {session_id[:8]}: {len(user_msgs)} 用户消息, {len(assistant_msgs)} 助手回复"

class MemoryManager:
    """记忆管理器 - 统一接口"""
    
    def __init__(self):
        self.store = RawMemoryStore()
        self.collector = MemoryCollector(self.store)
        self.retriever = MemoryRetriever(self.store)
    
    def stats(self) -> Dict:
        """获取记忆统计"""
        return self.store.get_stats()
    
    def remember(self, **kwargs) -> bool:
        """记住一条信息"""
        return self.collector.collect(**kwargs)
    
    def recall(self, query: str = None, **kwargs) -> str:
        """回忆相关内容"""
        if query:
            results = self.retriever.search(query, **kwargs)
            return json.dumps(results, ensure_ascii=False, indent=2)
        else:
            return self.retriever.get_context_for_prompt(**kwargs)
    
    def clear_old(self, days: int = 90) -> int:
        """清理旧记忆"""
        return self.store.delete_old(days)

# 全局记忆管理器实例
_memory_manager = None

def get_memory_manager() -> MemoryManager:
    """获取全局记忆管理器（单例）"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager

# 便捷函数
def remember(role: str, content: str, **kwargs) -> bool:
    """记住一条消息"""
    return get_memory_manager().remember(role=role, content=content, **kwargs)

def recall(query: str = None, **kwargs) -> str:
    """回忆相关内容"""
    return get_memory_manager().recall(query=query, **kwargs)

def memory_stats() -> Dict:
    """获取记忆统计"""
    return get_memory_manager().stats()

# 测试
if __name__ == "__main__":
    print("=== 测试记忆系统 ===\n")
    
    mgr = get_memory_manager()
    
    # 存入一些测试记忆
    print("存入测试记忆...")
    mgr.remember(role="user", content="你好，明妃", channel="feishu", user_id="test")
    mgr.remember(role="assistant", content="你好！有什么我可以帮你的吗？", channel="feishu", user_id="test")
    mgr.remember(role="user", content="我想了解一下龙族", channel="feishu", user_id="test")
    
    # 查看统计
    print(f"\n统计: {mgr.stats()}")
    
    # 搜索
    print(f"\n搜索'龙族': {mgr.recall('龙族')}")
    
    # 获取上下文
    print(f"\nPrompt上下文: {mgr.recall(user_id='test')}")
