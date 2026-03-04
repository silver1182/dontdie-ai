#!/usr/bin/env python3
"""
明妃三层记忆系统 - Phase 3: 画像层 (Profile Layer)
自动构建用户画像、偏好学习、知识图谱
"""

import sqlite3
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from collections import defaultdict

@dataclass
class UserProfile:
    """用户画像"""
    user_id: str
    version: int = 1
    last_updated: str = None
    
    # 基础信息
    display_name: str = ""
    persona_traits: List[str] = None  # 性格特征
    
    # 偏好
    interests: Dict[str, float] = None  # 主题 -> 权重
    liked_topics: List[str] = None
    disliked_topics: List[str] = None
    preferred_tools: List[str] = None
    
    # 行为模式
    communication_style: str = ""  # direct/casual/formal
    active_hours: List[int] = None  # 活跃时段 [9, 10, 11...]
    
    # 知识图谱快照
    key_entities: List[Dict] = None  # 关键实体
    relationships: List[Dict] = None  # 实体关系
    
    def __post_init__(self):
        if self.last_updated is None:
            self.last_updated = datetime.now().isoformat()
        if self.persona_traits is None:
            self.persona_traits = []
        if self.interests is None:
            self.interests = {}
        if self.liked_topics is None:
            self.liked_topics = []
        if self.disliked_topics is None:
            self.disliked_topics = []
        if self.preferred_tools is None:
            self.preferred_tools = []
        if self.active_hours is None:
            self.active_hours = []
        if self.key_entities is None:
            self.key_entities = []
        if self.relationships is None:
            self.relationships = []
    
    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class KnowledgeNode:
    """知识图谱节点"""
    node_id: str
    entity_type: str  # person/thing/concept/place/organization
    name: str
    aliases: List[str]
    properties: Dict
    first_seen: str
    last_mentioned: str
    mention_count: int = 0

@dataclass
class KnowledgeEdge:
    """知识图谱边"""
    edge_id: str
    source_id: str
    target_id: str
    relation: str  # like/dislike/own/know/work_at...
    confidence: float
    evidence: List[str]  # 来源记忆ID
    first_seen: str
    last_updated: str

class ProfileStore:
    """画像存储"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = Path.home() / ".openclaw" / "memory" / "profile.db"
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            # 用户画像表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_profiles (
                    user_id TEXT PRIMARY KEY,
                    version INTEGER DEFAULT 1,
                    last_updated TEXT,
                    profile_data TEXT NOT NULL
                )
            """)
            
            # 知识图谱节点表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_nodes (
                    node_id TEXT PRIMARY KEY,
                    user_id TEXT,
                    entity_type TEXT,
                    name TEXT,
                    aliases TEXT,
                    properties TEXT,
                    first_seen TEXT,
                    last_mentioned TEXT,
                    mention_count INTEGER DEFAULT 0,
                    UNIQUE(user_id, name, entity_type)
                )
            """)
            
            # 知识图谱边表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_edges (
                    edge_id TEXT PRIMARY KEY,
                    user_id TEXT,
                    source_id TEXT,
                    target_id TEXT,
                    relation TEXT,
                    confidence REAL,
                    evidence TEXT,
                    first_seen TEXT,
                    last_updated TEXT,
                    UNIQUE(user_id, source_id, target_id, relation)
                )
            """)
            
            conn.commit()
    
    def save_profile(self, profile: UserProfile):
        """保存用户画像"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO user_profiles 
                (user_id, version, last_updated, profile_data)
                VALUES (?, ?, ?, ?)
            """, (
                profile.user_id,
                profile.version,
                profile.last_updated,
                json.dumps(profile.to_dict())
            ))
            conn.commit()
    
    def get_profile(self, user_id: str) -> Optional[UserProfile]:
        """获取用户画像"""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT profile_data FROM user_profiles WHERE user_id = ?",
                (user_id,)
            ).fetchone()
            
            if row:
                data = json.loads(row[0])
                return UserProfile(**data)
            return None
    
    def add_knowledge_node(self, node: KnowledgeNode, user_id: str):
        """添加知识节点"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO knowledge_nodes
                (node_id, user_id, entity_type, name, aliases, properties,
                 first_seen, last_mentioned, mention_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node.node_id, user_id, node.entity_type, node.name,
                json.dumps(node.aliases), json.dumps(node.properties),
                node.first_seen, node.last_mentioned, node.mention_count
            ))
            conn.commit()
    
    def get_knowledge_graph(self, user_id: str) -> Dict:
        """获取用户的知识图谱"""
        with sqlite3.connect(self.db_path) as conn:
            nodes = conn.execute(
                "SELECT * FROM knowledge_nodes WHERE user_id = ?",
                (user_id,)
            ).fetchall()
            
            edges = conn.execute(
                "SELECT * FROM knowledge_edges WHERE user_id = ?",
                (user_id,)
            ).fetchall()
            
            return {
                "nodes": [{"id": n[0], "type": n[2], "name": n[3]} for n in nodes],
                "edges": [{"from": e[2], "to": e[3], "relation": e[4]} for e in edges]
            }

class ProfileBuilder:
    """画像构建器 - 从记忆自动提取画像"""
    
    def __init__(self):
        self.store = ProfileStore()
    
    def extract_entities(self, text: str) -> List[Dict]:
        """从文本提取实体（简化版，后续可用LLM）"""
        entities = []
        
        # 简单规则提取
        patterns = [
            (r'我喜欢?(?:看|读|玩)?\s*([^，。]+)', 'interest', '喜欢'),
            (r'我讨厌\s*([^，。]+)', 'dislike', '讨厌'),
            (r'我是\s*([^，。]+)', 'identity', '身份'),
            (r'我在\s*([^，。]+)\s*工作', 'organization', '工作'),
        ]
        
        for pattern, entity_type, relation in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                entities.append({
                    "name": match.strip(),
                    "type": entity_type,
                    "relation": relation
                })
        
        return entities
    
    def analyze_interests(self, memories: List[Dict]) -> Dict[str, float]:
        """分析兴趣分布"""
        interest_scores = defaultdict(float)
        
        for mem in memories:
            content = mem.get('content', '')
            
            # 关键词加权
            interest_keywords = {
                '龙族': 1.0, '小说': 0.8, '阅读': 0.7,
                '编程': 1.0, 'AI': 0.9, '代码': 0.8,
                '股票': 1.0, '投资': 0.9, '理财': 0.8,
                '游戏': 0.9, '打游戏': 1.0,
            }
            
            for keyword, weight in interest_keywords.items():
                if keyword in content:
                    interest_scores[keyword] += weight
        
        # 归一化
        if interest_scores:
            max_score = max(interest_scores.values())
            return {k: v/max_score for k, v in interest_scores.items()}
        return {}
    
    def build_profile(self, user_id: str, memories: List[Dict]) -> UserProfile:
        """从记忆构建用户画像"""
        
        # 获取旧版本
        old_profile = self.store.get_profile(user_id)
        version = (old_profile.version + 1) if old_profile else 1
        
        # 分析兴趣
        interests = self.analyze_interests(memories)
        
        # 提取实体构建知识图谱
        all_entities = []
        for mem in memories:
            entities = self.extract_entities(mem.get('content', ''))
            all_entities.extend(entities)
        
        # 构建画像
        profile = UserProfile(
            user_id=user_id,
            version=version,
            last_updated=datetime.now().isoformat(),
            interests=interests,
            liked_topics=[e['name'] for e in all_entities if e['relation'] == '喜欢'],
            persona_traits=self._infer_traits(memories),
            communication_style=self._infer_style(memories),
            key_entities=all_entities[:10]  # 取前10
        )
        
        # 保存
        self.store.save_profile(profile)
        
        return profile
    
    def _infer_traits(self, memories: List[Dict]) -> List[str]:
        """推断性格特征"""
        traits = []
        
        # 简单规则
        content = ' '.join([m.get('content', '') for m in memories])
        
        if '逻辑' in content or '分析' in content:
            traits.append('逻辑性强')
        if '喜欢' in content and '龙族' in content:
            traits.append('热爱小说')
        if '编程' in content or '代码' in content:
            traits.append('技术爱好者')
        
        return traits
    
    def _infer_style(self, memories: List[Dict]) -> str:
        """推断沟通风格"""
        # 简化：根据消息长度和表情符号判断
        return "direct"  # 默认直接
    
    def get_profile_summary(self, user_id: str) -> str:
        """获取画像摘要"""
        profile = self.store.get_profile(user_id)
        if not profile:
            return "暂无用户画像"
        
        lines = [
            f"## 用户画像 (v{profile.version})",
            f"- 兴趣: {', '.join(profile.interests.keys())}" if profile.interests else "- 兴趣: 未知",
            f"- 喜欢: {', '.join(profile.liked_topics[:5])}" if profile.liked_topics else "",
            f"- 特征: {', '.join(profile.persona_traits)}" if profile.persona_traits else "",
        ]
        
        return '\n'.join([l for l in lines if l])

# 便捷函数
_builder = None

def get_builder() -> ProfileBuilder:
    global _builder
    if _builder is None:
        _builder = ProfileBuilder()
    return _builder

def build_profile_from_memories(user_id: str, memories: List[Dict]) -> UserProfile:
    """从记忆构建画像"""
    return get_builder().build_profile(user_id, memories)

def get_profile_summary(user_id: str) -> str:
    """获取画像摘要"""
    return get_builder().get_profile_summary(user_id)

if __name__ == "__main__":
    print("=== 测试画像层 ===\n")
    
    # 测试数据
    test_memories = [
        {"content": "我喜欢看龙族小说，路明非是我最喜欢的角色"},
        {"content": "我对编程和AI很感兴趣，正在学习Python"},
        {"content": "我喜欢投资股票，但也会注意风险控制"},
        {"content": "周末喜欢打游戏放松，主要是单机游戏"},
    ]
    
    # 构建画像
    profile = build_profile_from_memories("test", test_memories)
    
    print(f"用户画像已生成 (v{profile.version})")
    print(f"\n兴趣分布: {profile.interests}")
    print(f"\n喜欢的事物: {profile.liked_topics}")
    print(f"\n性格特征: {profile.persona_traits}")
    
    # 获取摘要
    print(f"\n{get_profile_summary('test')}")
