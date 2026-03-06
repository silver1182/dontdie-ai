#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 2: 向量记忆层 (精简版)
使用 Ollama + 余弦相似度 实现语义检索
"""

import sqlite3
import json
import math
import requests
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

@dataclass
class VectorMemory:
    memory_id: str
    source_memory_id: str
    content: str
    content_type: str
    embedding: List[float]
    timestamp: str
    user_id: str
    tags: List[str]
    confidence: float
    metadata: Dict

class EmbeddingService:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "nomic-embed-text:latest"):
        self.base_url = base_url
        self.model = model
    
    def embed(self, text: str) -> Optional[List[float]]:
        try:
            response = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=30
            )
            return response.json()["embedding"]
        except Exception as e:
            print(f"Embedding 失败: {e}")
            return None

class VectorMemoryStore:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = Path.home() / ".openclaw" / "memory" / "vector_memory.db"
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self.embedding_service = EmbeddingService()
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS vector_memories (
                    memory_id TEXT PRIMARY KEY,
                    source_memory_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    user_id TEXT,
                    tags TEXT,
                    confidence REAL DEFAULT 0.8,
                    metadata TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_vuser ON vector_memories(user_id)")
            conn.commit()
    
    def store(self, memory: VectorMemory) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO vector_memories 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    memory.memory_id, memory.source_memory_id, memory.content,
                    memory.content_type, json.dumps(memory.embedding), memory.timestamp,
                    memory.user_id, json.dumps(memory.tags), memory.confidence,
                    json.dumps(memory.metadata)
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"存储失败: {e}")
            return False
    
    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1))
        norm2 = math.sqrt(sum(b * b for b in v2))
        return dot / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0
    
    def search_similar(self, query_emb: List[float], user_id: str = None, top_k: int = 5, threshold: float = 0.7):
        results = []
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM vector_memories WHERE user_id = ?" if user_id else "SELECT * FROM vector_memories",
                (user_id,) if user_id else ()
            ).fetchall()
            
            for row in rows:
                emb = json.loads(row[4])
                sim = self._cosine_similarity(query_emb, emb)
                if sim >= threshold:
                    mem = VectorMemory(
                        memory_id=row[0], source_memory_id=row[1], content=row[2],
                        content_type=row[3], embedding=[], timestamp=row[5],
                        user_id=row[6], tags=json.loads(row[7]) if row[7] else [],
                        confidence=row[8], metadata=json.loads(row[9]) if row[9] else {}
                    )
                    results.append((mem, sim))
        
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
    
    def search_by_text(self, text: str, **kwargs):
        emb = self.embedding_service.embed(text)
        return self.search_similar(emb, **kwargs) if emb else []
    
    def get_stats(self):
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM vector_memories").fetchone()[0]
            types = conn.execute("SELECT content_type, COUNT(*) FROM vector_memories GROUP BY content_type").fetchall()
            return {"total": total, "types": dict(types)}

if __name__ == "__main__":
    store = VectorMemoryStore()
    
    # 存储测试
    for i, text in enumerate(["我喜欢龙族", "路明非是S级", "我喜欢编程"]):
        emb = store.embedding_service.embed(text)
        if emb:
            store.store(VectorMemory(
                memory_id=f"v{i}", source_memory_id=f"r{i}",
                content=text, content_type="test",
                embedding=emb, timestamp=datetime.now().isoformat(),
                user_id="test", tags=[], confidence=0.9, metadata={}
            ))
    
    print(f"统计: {store.get_stats()}")
    
    # 搜索测试
    for q in ["龙族是什么", "编程爱好"]:
        print(f"\n搜索 '{q}':")
        for mem, score in store.search_by_text(q, user_id="test", top_k=2):
            print(f"  [{score:.2f}] {mem.content}")
