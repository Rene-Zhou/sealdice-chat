from typing import List, Dict, Optional
from rag.vector_store import FiveToolsVectorStore
from config import config

class FiveToolsRAG:
    def __init__(self, vector_store: FiveToolsVectorStore):
        self.vector_store = vector_store
        
    async def query(self, 
                   question: str, 
                   category_hint: str = None,
                   max_context_length: int = None) -> Dict:
        """智能RAG查询"""
        
        if max_context_length is None:
            max_context_length = config.RAG_MAX_CONTEXT_LENGTH
        
        # 1. 语义搜索相关文档
        search_results = self.vector_store.search(
            query=question,
            category_filter=category_hint,
            n_results=config.RAG_MAX_RESULTS
        )
        
        # 2. 质量过滤
        filtered_results = [r for r in search_results if r['score'] >= config.RAG_SIMILARITY_THRESHOLD]
        
        # 3. 构建上下文
        context = self._build_context(filtered_results, max_context_length)
        
        # 4. 返回增强查询信息
        return {
            'enhanced_query': question,
            'context': context,
            'sources': [r['metadata'] for r in filtered_results[:3]],
            'confidence': self._calculate_confidence(filtered_results),
            'found_results': len(filtered_results)
        }
    
    def _build_context(self, results: List[Dict], max_length: int) -> str:
        """构建上下文信息"""
        if not results:
            return ""
        
        context_parts = []
        current_length = 0
        
        for result in results:
            content = result['content']
            metadata = result['metadata']
            
            # 添加来源标识
            source_info = f"【{metadata['title']} - {metadata['category']}】"
            formatted_content = f"{source_info}\n{content}"
            
            if current_length + len(formatted_content) <= max_length:
                context_parts.append(formatted_content)
                current_length += len(formatted_content)
            else:
                break
        
        return "\n\n---\n\n".join(context_parts)
    
    def _calculate_confidence(self, results: List[Dict]) -> float:
        """计算查询置信度"""
        if not results:
            return 0.0
        
        # 基于最高分数和结果质量
        best_score = results[0]['score']
        high_quality_count = len([r for r in results if r['score'] >= 0.8])
        
        confidence = best_score * (1 + min(high_quality_count / 5, 0.3))
        return min(confidence, 1.0)
    
    def should_use_rag(self, message: str) -> bool:
        """判断是否需要RAG增强"""
        dnd_keywords = [
            '法术', 'spell', '怪物', 'monster', '职业', 'class',
            '种族', 'race', '物品', 'item', '装备', 'equipment',
            '专长', 'feat', '背景', 'background', '规则', 'rule',
            'dnd', 'd&d', '龙与地下城', '先攻', '豁免', '检定'
        ]
        
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in dnd_keywords)
    
    def extract_category_hint(self, message: str) -> Optional[str]:
        """提取类别提示"""
        category_keywords = {
            'spell': ['法术', 'spell', '咒语', '魔法'],
            'monster': ['怪物', 'monster', '敌人', '生物'],
            'class': ['职业', 'class', '战士', '法师', '牧师'],
            'race': ['种族', 'race', '精灵', '矮人', '人类'],
            'item': ['物品', 'item', '装备', 'equipment', '武器', '护甲'],
            'feat': ['专长', 'feat', '天赋'],
        }
        
        message_lower = message.lower()
        for category, keywords in category_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                return category
        
        return None 