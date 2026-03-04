#!/usr/bin/env python3
"""
明妃三层记忆系统 - 完整集成
三层记忆：原始层 + 向量层 + 画像层
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from raw_memory import RawMemoryStore, RawMemory
from vector_memory import VectorMemoryStore, VectorMemory, EmbeddingService
from profile_layer import ProfileBuilder, ProfileStore, UserProfile
from integrated_memory import IntegratedMemoryManager as BaseManager

import uuid
import json
from datetime import datetime
from typing import List, Dict, Optional

class MemorySystem:
    """
    明妃三层记忆系统 - 完整版
    
    架构:
    - Layer 1 (原始层): 完整对话历史，SQLite存储
    - Layer 2 (向量层): 语义embedding，Ollama生成
    - Layer 3 (画像层): 用户画像，自动构建
    """
    
    def __init__(self):
        self.raw_store = RawMemoryStore()
        self.vector_store = VectorMemoryStore()
        self.profile_store = ProfileStore()
        self.profile_builder = ProfileBuilder()
        self.embedding = EmbeddingService()
    
    def remember(self, role: str, content: str, **kwargs) -> bool:
        """
        记住一条消息（同时存入三层）
        
        Args:
            role: user/assistant/system
            content: 消息内容
            user_id: 用户标识
            channel: 渠道(feishu/telegram等)
            session_id: 会话ID
            emotion: 情绪标签
        """
        user_id = kwargs.get('user_id', 'unknown')
        
        # 1. 原始记忆层
        from raw_memory import RawMemory
        raw_mem = RawMemory(
            memory_id=str(uuid.uuid4()),
            session_id=kwargs.get('session_id', 'default'),
            timestamp=datetime.now().isoformat(),
            role=role,
            content=content,
            channel=kwargs.get('channel', 'unknown'),
            user_id=user_id,
            emotion=kwargs.get('emotion', 'neutral'),
            metadata=kwargs.get('metadata', {})
        )
        
        if not self.raw_store.store(raw_mem):
            return False
        
        # 2. 向量记忆层
        embedding = self.embedding.embed(content)
        if embedding:
            vec_mem = VectorMemory(
                memory_id=str(uuid.uuid4()),
                source_memory_id=raw_mem.memory_id,
                content=content,
                content_type=self._classify_content(content),
                embedding=embedding,
                timestamp=raw_mem.timestamp,
                user_id=user_id,
                tags=kwargs.get('tags', []),
                confidence=kwargs.get('confidence', 0.8),
                metadata={"layer": "vector", "role": role}
            )
            self.vector_store.store(vec_mem)
        
        # 3. 更新画像层（异步/定期）
        # 简化：每10条记忆触发一次画像更新
        current_count = self._get_user_memory_count(user_id)
        if current_count % 10 == 0:
            self._update_profile(user_id)
        
        return True
    
    def recall(self, query: str, user_id: str = None, top_k: int = 5) -> str:
        """
        回忆相关内容（三层检索）
        
        返回格式化的记忆上下文，可直接注入Prompt
        """
        results = []
        
        # 1. 向量层语义搜索
        vec_results = self.vector_store.search_by_text(query, user_id=user_id, top_k=top_k)
        for mem, score in vec_results:
            results.append({
                "source": "🧠向量记忆",
                "content": mem.content,
                "score": score,
                "time": mem.timestamp[:10]
            })
        
        # 2. 原始层关键词搜索
        raw_results = self.raw_store.search_content(query, limit=top_k)
        for raw in raw_results:
            results.append({
                "source": "📝原始记忆",
                "content": raw.content,
                "score": 0.5,
                "time": raw.timestamp[:10]
            })
        
        # 3. 去重排序
        seen = set()
        unique = []
        for r in results:
            key = r["content"][:50]
            if key not in seen:
                seen.add(key)
                unique.append(r)
        
        unique.sort(key=lambda x: x["score"], reverse=True)
        
        # 格式化
        if not unique:
            return ""
        
        lines = ["\n## 相关记忆\n"]
        for r in unique[:top_k]:
            lines.append(f"{r['source']} [{r['score']:.2f}] [{r['time']}] {r['content'][:80]}...")
        
        return "\n".join(lines)
    
    def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """获取用户画像"""
        return self.profile_store.get_profile(user_id)
    
    def get_profile_summary(self, user_id: str) -> str:
        """获取画像摘要"""
        profile = self.get_profile(user_id)
        if not profile:
            return "暂无画像"
        
        lines = [
            f"## 用户画像 (v{profile.version})",
            f"**兴趣**: {', '.join(list(profile.interests.keys())[:5])}" if profile.interests else "",
            f"**特征**: {', '.join(profile.persona_traits)}" if profile.persona_traits else "",
            f"**偏好**: {', '.join(profile.liked_topics[:3])}" if profile.liked_topics else "",
        ]
        return "\n".join([l for l in lines if l])
    
    def stats(self) -> Dict:
        """三层统计"""
        return {
            "原始记忆层": self.raw_store.get_stats(),
            "向量记忆层": self.vector_store.get_stats(),
            "画像层": {"说明": "动态构建"}
        }
    
    def _classify_content(self, content: str) -> str:
        """简单分类内容类型"""
        if any(kw in content for kw in ["喜欢", "爱", "讨厌"]):
            return "preference"
        elif any(kw in content for kw in ["是", "为", "叫做"]):
            return "fact"
        elif any(kw in content for kw in ["想", "计划", "要"]):
            return "intention"
        else:
            return "general"
    
    def _get_user_memory_count(self, user_id: str) -> int:
        """获取用户记忆数量"""
        stats = self.raw_store.get_stats()
        # 简化：返回总数（实际应该按user_id过滤）
        return stats.get("total_memories", 0)
    
    def _update_profile(self, user_id: str):
        """更新用户画像"""
        # 获取用户最近的记忆
        memories = self.raw_store.get_recent(user_id=user_id, limit=50)
        memory_dicts = [{"content": m.content} for m in memories]
        
        if memory_dicts:
            self.profile_builder.build_profile(user_id, memory_dicts)

# 全局实例
_memory_system = None

def get_memory_system() -> MemorySystem:
    """获取全局记忆系统实例"""
    global _memory_system
    if _memory_system is None:
        _memory_system = MemorySystem()
    return _memory_system

# 便捷函数
def remember(role: str, content: str, **kwargs):
    return get_memory_system().remember(role, content, **kwargs)

def recall(query: str, user_id: str = None, top_k: int = 5):
    return get_memory_system().recall(query, user_id, top_k)

def get_profile(user_id: str = None):
    return get_memory_system().get_profile_summary(user_id or "unknown")

def stats():
    return get_memory_system().stats()

if __name__ == "__main__":
    print("=== 明妃三层记忆系统 - 完整测试 ===\n")
    
    sys = get_memory_system()
    
    # 存入测试记忆
    print("存入测试记忆...")
    remember("user", "你好，我是路明非", user_id="test_user")
    remember("assistant", "你好路明非！我是明妃，很高兴认识你。", user_id="test_user")
    remember("user", "我喜欢看龙族小说，特别是路明非的故事", user_id="test_user")
    remember("user", "我对AI和编程很感兴趣", user_id="test_user")
    remember("user", "我想学习如何做股票投资", user_id="test_user")
    
    # 统计
    print(f"\n统计:\n{json.dumps(stats(), ensure_ascii=False, indent=2)}")
    
    # 召回测试
    print(f"\n召回 '龙族':\n{recall('龙族', user_id='test_user')}")
    
    # 画像（需要积累足够数据）
    print(f"\n用户画像:\n{get_profile('test_user')}")
