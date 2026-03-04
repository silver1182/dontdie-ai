#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 2 续: 记忆提取器
从原始记忆提取结构化信息，生成向量记忆
"""

import sys
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

sys.path.insert(0, str(Path(__file__).parent))

from raw_memory import RawMemoryStore
from vector_memory import VectorMemory, VectorMemoryStore, EmbeddingService

class MemoryExtractor:
    """
    记忆提取器
    从原始对话中提取结构化信息，生成向量记忆
    """
    
    def __init__(self):
        self.raw_store = RawMemoryStore()
        self.vector_store = VectorMemoryStore()
        self.embedding = EmbeddingService()
    
    def extract_from_raw(self, raw_memory_id: str) -> Optional[VectorMemory]:
        """从一条原始记忆提取向量记忆"""
        # 获取原始记忆
        memories = self.raw_store.get_by_session(raw_memory_id)
        if not memories:
            return None
        
        raw = memories[0]
        
        # 简单提取逻辑（后续可用LLM优化）
        content = raw.content
        
        # 判断内容类型
        if any(kw in content for kw in ["喜欢", "爱", "讨厌", "不喜欢"]):
            content_type = "preference"
        elif any(kw in content for kw in ["是", "为", "叫做", "名字"]):
            content_type = "fact"
        elif any(kw in content for kw in ["想", "计划", "准备", "要"]):
            content_type = "intention"
        else:
            content_type = "general"
        
        # 生成 embedding
        embedding = self.embedding.embed(content)
        if not embedding:
            return None
        
        return VectorMemory(
            memory_id=str(uuid.uuid4()),
            source_memory_id=raw.memory_id,
            content=content,
            content_type=content_type,
            embedding=embedding,
            timestamp=datetime.now().isoformat(),
            user_id=raw.user_id,
            tags=[raw.channel, raw.emotion],
            confidence=0.7,
            metadata={"extracted_from": "raw_memory", "original_role": raw.role}
        )
    
    def batch_extract(self, user_id: str = None, limit: int = 100) -> int:
        """批量提取未处理的原始记忆"""
        # 获取最近的原始记忆
        raw_memories = self.raw_store.get_recent(user_id=user_id, limit=limit)
        
        count = 0
        for raw in raw_memories:
            # 检查是否已提取
            existing = self.vector_store.search_similar(
                raw.content,  # 简化检查
                user_id=user_id,
                top_k=1,
                threshold=0.99
            )
            
            if existing:
                continue
            
            # 提取并存储
            vec_mem = self.extract_from_raw(raw.memory_id)
            if vec_mem:
                if self.vector_store.store(vec_mem):
                    count += 1
        
        return count
    
    def extract_facts_batch(self, raw_memories: List[Dict]) -> List[VectorMemory]:
        """从多条原始记忆批量提取事实"""
        results = []
        
        for raw in raw_memories:
            content = raw.get('content', '')
            if len(content) < 5:
                continue
            
            embedding = self.embedding.embed(content)
            if not embedding:
                continue
            
            vec_mem = VectorMemory(
                memory_id=str(uuid.uuid4()),
                source_memory_id=raw.get('memory_id', ''),
                content=content,
                content_type="fact",
                embedding=embedding,
                timestamp=datetime.now().isoformat(),
                user_id=raw.get('user_id', 'unknown'),
                tags=[],
                confidence=0.6,
                metadata={"batch_extracted": True}
            )
            results.append(vec_mem)
        
        return results

class IntegratedMemoryManager:
    """集成记忆管理器 - 三层记忆统一接口"""
    
    def __init__(self):
        self.raw = RawMemoryStore()
        self.vector = VectorMemoryStore()
        self.extractor = MemoryExtractor()
    
    def remember(self, role: str, content: str, **kwargs) -> bool:
        """
        记住一条消息（同时存入两层）
        """
        from raw_memory import RawMemory
        
        # 1. 存入原始记忆层
        raw_mem = RawMemory(
            memory_id=str(uuid.uuid4()),
            session_id=kwargs.get('session_id', 'default'),
            timestamp=datetime.now().isoformat(),
            role=role,
            content=content,
            channel=kwargs.get('channel', 'unknown'),
            user_id=kwargs.get('user_id', 'unknown'),
            emotion=kwargs.get('emotion', 'neutral'),
            metadata=kwargs.get('metadata', {})
        )
        
        if not self.raw.store(raw_mem):
            return False
        
        # 2. 生成并存储向量记忆
        embedding = self.vector.embedding_service.embed(content)
        if embedding:
            vec_mem = VectorMemory(
                memory_id=str(uuid.uuid4()),
                source_memory_id=raw_mem.memory_id,
                content=content,
                content_type=kwargs.get('content_type', 'general'),
                embedding=embedding,
                timestamp=raw_mem.timestamp,
                user_id=raw_mem.user_id,
                tags=kwargs.get('tags', []),
                confidence=kwargs.get('confidence', 0.8),
                metadata={"layer": "vector"}
            )
            self.vector.store(vec_mem)
        
        return True
    
    def recall(self, query: str, user_id: str = None, top_k: int = 5) -> str:
        """
        回忆相关内容（三层检索）
        1. 向量语义搜索
        2. 原始记忆关键词搜索
        3. 合并结果
        """
        results = []
        
        # 1. 向量层语义搜索
        vec_results = self.vector.search_by_text(query, user_id=user_id, top_k=top_k)
        for mem, score in vec_results:
            results.append({
                "source": "vector",
                "content": mem.content,
                "type": mem.content_type,
                "score": score,
                "time": mem.timestamp
            })
        
        # 2. 原始层关键词搜索
        raw_results = self.raw.search_content(query, limit=top_k)
        for raw in raw_results:
            results.append({
                "source": "raw",
                "content": raw.content,
                "type": raw.role,
                "score": 0.5,  # 关键词匹配默认分数
                "time": raw.timestamp
            })
        
        # 3. 去重并排序
        seen = set()
        unique_results = []
        for r in results:
            key = r["content"][:50]
            if key not in seen:
                seen.add(key)
                unique_results.append(r)
        
        unique_results.sort(key=lambda x: x["score"], reverse=True)
        
        # 格式化输出
        output = ["\n## 相关记忆\n"]
        for r in unique_results[:top_k]:
            time_str = r["time"][:10] if len(r["time"]) > 10 else r["time"]
            source_icon = "🧠" if r["source"] == "vector" else "📝"
            output.append(f"{source_icon} [{r['score']:.2f}] [{time_str}] {r['content'][:80]}...")
        
        return "\n".join(output) if unique_results else ""
    
    def stats(self) -> Dict:
        """三层记忆统计"""
        return {
            "raw_layer": self.raw.get_stats(),
            "vector_layer": self.vector.get_stats()
        }

# 便捷函数
_manager = None

def get_manager():
    global _manager
    if _manager is None:
        _manager = IntegratedMemoryManager()
    return _manager

def remember(role: str, content: str, **kwargs):
    return get_manager().remember(role, content, **kwargs)

def recall(query: str, user_id: str = None, top_k: int = 5):
    return get_manager().recall(query, user_id, top_k)

def stats():
    return get_manager().stats()

if __name__ == "__main__":
    print("=== 测试集成记忆系统 ===\n")
    
    mgr = get_manager()
    
    # 存入记忆
    print("存入测试记忆...")
    mgr.remember("user", "你好，我是路明非", user_id="test")
    mgr.remember("assistant", "你好路明非！有什么我可以帮你的吗？", user_id="test")
    mgr.remember("user", "我喜欢看龙族小说", user_id="test")
    mgr.remember("user", "我对股票投资很感兴趣", user_id="test")
    
    # 统计
    print(f"\n统计: {json.dumps(mgr.stats(), ensure_ascii=False, indent=2)}")
    
    # 测试语义召回
    print(f"\n召回 '龙族': {mgr.recall('龙族', user_id='test')}")
    print(f"\n召回 '投资': {mgr.recall('投资', user_id='test')}")
