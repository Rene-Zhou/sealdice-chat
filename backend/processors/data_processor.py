import json
from typing import Dict, List, Any
from dataclasses import dataclass
from pathlib import Path

@dataclass
class ProcessedDocument:
    id: str
    title: str
    content: str
    category: str
    metadata: Dict[str, Any]

class FiveToolsProcessor:
    def __init__(self):
        self.processors = {
            'spells': self._process_spells,
            'bestiary': self._process_monsters,
            'classes': self._process_classes,
            'races': self._process_races,
            'items': self._process_items,
            'feats': self._process_feats,
            'backgrounds': self._process_backgrounds,
        }
    
    def process_all_data(self, data_files: Dict[str, Path]) -> List[ProcessedDocument]:
        """处理所有数据文件"""
        documents = []
        
        for file_name, file_path in data_files.items():
            if file_name in self.processors:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        processed = self.processors[file_name](data)
                        documents.extend(processed)
                        print(f"✅ 处理完成: {file_name}, 生成{len(processed)}个文档")
                except Exception as e:
                    print(f"❌ 处理失败: {file_name}, 错误: {e}")
        
        return documents
    
    def _process_spells(self, data: Dict) -> List[ProcessedDocument]:
        """处理法术数据"""
        documents = []
        
        for spell in data.get('spell', []):
            # 构建丰富的可搜索内容
            content_parts = [
                f"法术名称: {spell.get('name', '')}",
                f"等级: {spell.get('level', 0)}环法术",
                f"学派: {spell.get('school', '')}",
            ]
            
            # 施法信息
            if 'time' in spell:
                casting_time = self._format_time(spell['time'])
                content_parts.append(f"施法时间: {casting_time}")
            
            if 'range' in spell:
                spell_range = self._format_range(spell['range'])
                content_parts.append(f"距离: {spell_range}")
                
            if 'components' in spell:
                components = self._format_components(spell['components'])
                content_parts.append(f"成分: {components}")
            
            if 'duration' in spell:
                duration = self._format_duration(spell['duration'])
                content_parts.append(f"持续时间: {duration}")
            
            # 法术描述
            if 'entries' in spell:
                description = self._format_entries(spell['entries'])
                content_parts.append(f"描述: {description}")
            
            doc = ProcessedDocument(
                id=f"spell_{spell.get('name', '').lower().replace(' ', '_')}",
                title=f"{spell.get('name', '')} ({spell.get('level', 0)}环{spell.get('school', '')}法术)",
                content="\n".join(content_parts),
                category='spell',
                metadata={
                    'level': spell.get('level', 0),
                    'school': spell.get('school', ''),
                    'source': spell.get('source', ''),
                    'classes': spell.get('classes', {}).get('fromClassList', [])
                }
            )
            documents.append(doc)
        
        return documents
    
    def _process_monsters(self, data: Dict) -> List[ProcessedDocument]:
        """处理怪物数据"""
        documents = []
        
        for monster in data.get('monster', []):
            content_parts = [
                f"怪物名称: {monster.get('name', '')}",
                f"体型: {monster.get('size', '')}",
                f"类型: {monster.get('type', '')}",
                f"阵营: {monster.get('alignment', '')}",
                f"挑战等级: {monster.get('cr', '')}",
            ]
            
            # 属性值
            if 'str' in monster:
                abilities = f"力量{monster.get('str', 10)} 敏捷{monster.get('dex', 10)} 体质{monster.get('con', 10)} 智力{monster.get('int', 10)} 感知{monster.get('wis', 10)} 魅力{monster.get('cha', 10)}"
                content_parts.append(f"属性: {abilities}")
            
            # 技能和特性
            if 'skill' in monster:
                skills = ', '.join([f"{k}+{v}" for k, v in monster['skill'].items()])
                content_parts.append(f"技能: {skills}")
            
            if 'trait' in monster:
                traits = []
                for trait in monster['trait']:
                    traits.append(f"{trait.get('name', '')}: {self._format_entries(trait.get('entries', []))}")
                content_parts.append(f"特性: {'; '.join(traits)}")
            
            doc = ProcessedDocument(
                id=f"monster_{monster.get('name', '').lower().replace(' ', '_')}",
                title=f"{monster.get('name', '')} (CR {monster.get('cr', '')})",
                content="\n".join(content_parts),
                category='monster',
                metadata={
                    'cr': monster.get('cr', ''),
                    'type': monster.get('type', ''),
                    'size': monster.get('size', ''),
                    'source': monster.get('source', '')
                }
            )
            documents.append(doc)
        
        return documents
    
    # 其他处理方法的简化实现...
    def _process_classes(self, data: Dict) -> List[ProcessedDocument]:
        """处理职业数据（简化实现）"""
        documents = []
        for cls in data.get('class', []):
            content = f"职业名称: {cls.get('name', '')}\n生命骰: {cls.get('hd', {}).get('faces', '')}d{cls.get('hd', {}).get('number', '')}"
            documents.append(ProcessedDocument(
                id=f"class_{cls.get('name', '').lower()}",
                title=cls.get('name', ''),
                content=content,
                category='class',
                metadata={'source': cls.get('source', '')}
            ))
        return documents
    
    def _process_races(self, data: Dict) -> List[ProcessedDocument]:
        """处理种族数据"""
        documents = []
        for race in data.get('race', []):
            content = f"种族名称: {race.get('name', '')}\n属性增长: {race.get('ability', '')}"
            documents.append(ProcessedDocument(
                id=f"race_{race.get('name', '').lower()}",
                title=race.get('name', ''),
                content=content,
                category='race',
                metadata={'source': race.get('source', '')}
            ))
        return documents
    
    def _process_items(self, data: Dict) -> List[ProcessedDocument]:
        """处理物品数据"""
        documents = []
        for item in data.get('item', []):
            content = f"物品名称: {item.get('name', '')}\n类型: {item.get('type', '')}"
            documents.append(ProcessedDocument(
                id=f"item_{item.get('name', '').lower()}",
                title=item.get('name', ''),
                content=content,
                category='item',
                metadata={'source': item.get('source', '')}
            ))
        return documents
    
    def _process_feats(self, data: Dict) -> List[ProcessedDocument]:
        """处理专长数据"""
        documents = []
        for feat in data.get('feat', []):
            content = f"专长名称: {feat.get('name', '')}"
            documents.append(ProcessedDocument(
                id=f"feat_{feat.get('name', '').lower()}",
                title=feat.get('name', ''),
                content=content,
                category='feat',
                metadata={'source': feat.get('source', '')}
            ))
        return documents
    
    def _process_backgrounds(self, data: Dict) -> List[ProcessedDocument]:
        """处理背景数据"""
        documents = []
        for bg in data.get('background', []):
            content = f"背景名称: {bg.get('name', '')}"
            documents.append(ProcessedDocument(
                id=f"background_{bg.get('name', '').lower()}",
                title=bg.get('name', ''),
                content=content,
                category='background',
                metadata={'source': bg.get('source', '')}
            ))
        return documents
    
    def _format_entries(self, entries: List) -> str:
        """格式化条目内容"""
        if not entries:
            return ""
        
        text_parts = []
        for entry in entries:
            if isinstance(entry, str):
                text_parts.append(entry)
            elif isinstance(entry, dict):
                if 'entries' in entry:
                    text_parts.extend(self._format_entries(entry['entries']))
                else:
                    text_parts.append(str(entry))
        
        return " ".join(text_parts)
    
    def _format_time(self, time_data: List) -> str:
        """格式化施法时间"""
        if not time_data:
            return ""
        time_item = time_data[0]
        return f"{time_item.get('number', 1)} {time_item.get('unit', '')}"
    
    def _format_range(self, range_data: Dict) -> str:
        """格式化距离"""
        if range_data.get('type') == 'point':
            return f"{range_data.get('distance', {}).get('amount', '')} {range_data.get('distance', {}).get('type', '')}"
        return str(range_data.get('type', ''))
    
    def _format_components(self, comp_data: Dict) -> str:
        """格式化成分"""
        components = []
        if comp_data.get('v'): components.append('言语')
        if comp_data.get('s'): components.append('姿势')
        if comp_data.get('m'): components.append('材料')
        return ', '.join(components)
    
    def _format_duration(self, dur_data: List) -> str:
        """格式化持续时间"""
        if not dur_data:
            return ""
        dur_item = dur_data[0]
        if dur_item.get('type') == 'instant':
            return '瞬间'
        elif dur_item.get('type') == 'timed':
            return f"{dur_item.get('duration', {}).get('amount', '')} {dur_item.get('duration', {}).get('type', '')}"
        return str(dur_item.get('type', '')) 