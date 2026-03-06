#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 1: 原始记忆层
存储完整的对话历史，保留原始上下文
"""

import sqlite3
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict

@dataclass
class RawMemory:
    """原始记忆条目"""
    memory_id: str
    session_id: str
    timestamp: str
    role: str  # user | assistant | system
    content: str
    channel: str
    user_id: str
    emotion: str = "neutral"
    metadata: Dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    def compute_hash(self) -> str:
        """计算内容哈希用于去重"""
        data = f"{self.session_id}:{self.timestamp}:{self.content}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

class RawMemoryStore:
    """原始记忆存储层"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = Path.home() / ".openclaw" / "memory" / "raw_memory.db"
        
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        self._init_db()
    
    def _init_db(self):
        """初始化数据库表结构"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS raw_memories (
                    memory_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    channel TEXT,
                    user_id TEXT,
                    emotion TEXT DEFAULT 'neutral',
                    metadata TEXT,
                    content_hash TEXT UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 创建索引加速查询
            conn.execute("CREATE INDEX IF NOT EXISTS idx_session ON raw_memories(session_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON raw_memories(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user ON raw_memories(user_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_channel ON raw_memories(channel)")
            
            conn.commit()
    
    def store(self, memory: RawMemory) -> bool:
        """存储一条原始记忆"""
        content_hash = memory.compute_hash()
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR IGNORE INTO raw_memories 
                    (memory_id, session_id, timestamp, role, content, 
                     channel, user_id, emotion, metadata, content_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    memory.memory_id,
                    memory.session_id,
                    memory.timestamp,
                    memory.role,
                    memory.content,
                    memory.channel,
                    memory.user_id,
                    memory.emotion,
                    json.dumps(memory.metadata),
                    content_hash
                ))
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            # 重复内容，忽略
            return False
    
    def store_batch(self, memories: List[RawMemory]) -> int:
        """批量存储记忆"""
        count = 0
        for memory in memories:
            if self.store(memory):
                count += 1
        return count
    
    def get_by_session(self, session_id: str, limit: int = 100) -> List[RawMemory]:
        """获取某个会话的所有记忆"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT * FROM raw_memories 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
                LIMIT ?
            """, (session_id, limit)).fetchall()
            
            return [self._row_to_memory(row) for row in rows]
    
    def get_by_time_range(self, start: str, end: str, user_id: str = None) -> List[RawMemory]:
        """按时间范围查询"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            if user_id:
                rows = conn.execute("""
                    SELECT * FROM raw_memories 
                    WHERE timestamp BETWEEN ? AND ? AND user_id = ?
                    ORDER BY timestamp ASC
                """, (start, end, user_id)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM raw_memories 
                    WHERE timestamp BETWEEN ? AND ?
                    ORDER BY timestamp ASC
                """, (start, end)).fetchall()
            
            return [self._row_to_memory(row) for row in rows]
    
    def get_recent(self, user_id: str = None, limit: int = 50) -> List[RawMemory]:
        """获取最近的记忆"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            if user_id:
                rows = conn.execute("""
                    SELECT * FROM raw_memories 
                    WHERE user_id = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (user_id, limit)).fetchall()
            else:
                rows = conn.execute("""
                    SELECT * FROM raw_memories 
                    ORDER BY timestamp DESC
                    LIMIT ?
                """, (limit,)).fetchall()
            
            return [self._row_to_memory(row) for row in rows]
    
    def search_content(self, keyword: str, limit: int = 20) -> List[RawMemory]:
        """全文搜索内容（简单LIKE，后续用FTS5优化）"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("""
                SELECT * FROM raw_memories 
                WHERE content LIKE ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (f"%{keyword}%", limit)).fetchall()
            
            return [self._row_to_memory(row) for row in rows]
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM raw_memories").fetchone()[0]
            
            # 按角色统计
            role_stats = conn.execute("""
                SELECT role, COUNT(*) as count 
                FROM raw_memories 
                GROUP BY role
            """).fetchall()
            
            # 按日期统计（最近7天）
            date_stats = conn.execute("""
                SELECT date(timestamp) as date, COUNT(*) as count
                FROM raw_memories
                WHERE timestamp > datetime('now', '-7 days')
                GROUP BY date(timestamp)
                ORDER BY date DESC
            """).fetchall()
            
            return {
                "total_memories": total,
                "role_distribution": {row[0]: row[1] for row in role_stats},
                "recent_daily": {row[0]: row[1] for row in date_stats}
            }
    
    def _row_to_memory(self, row: sqlite3.Row) -> RawMemory:
        """将数据库行转换为 RawMemory 对象"""
        return RawMemory(
            memory_id=row['memory_id'],
            session_id=row['session_id'],
            timestamp=row['timestamp'],
            role=row['role'],
            content=row['content'],
            channel=row['channel'],
            user_id=row['user_id'],
            emotion=row['emotion'],
            metadata=json.loads(row['metadata']) if row['metadata'] else {}
        )
    
    def delete_old(self, days: int = 90) -> int:
        """删除旧数据（保留最近N天）"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("""
                DELETE FROM raw_memories 
                WHERE timestamp < datetime('now', ?)
            """, (f"-{days} days",))
            conn.commit()
            return cursor.rowcount

# 测试代码
if __name__ == "__main__":
    store = RawMemoryStore()
    
    # 测试存储
    test_memory = RawMemory(
        memory_id="test-001",
        session_id="session-001",
        timestamp=datetime.now().isoformat(),
        role="user",
        content="你好，明妃",
        channel="feishu",
        user_id="silver1182",
        emotion="neutral",
        metadata={"source": "test"}
    )
    
    store.store(test_memory)
    
    # 测试查询
    stats = store.get_stats()
    print(f"统计: {stats}")
    
    recent = store.get_recent(limit=5)
    print(f"\n最近 {len(recent)} 条记忆:")
    for m in recent:
        print(f"  [{m.role}] {m.content[:30]}...")
