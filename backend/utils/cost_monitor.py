import json
from datetime import datetime
from typing import Dict

class RAGCostMonitor:
    def __init__(self):
        self.cost_log_file = "rag_costs.json"
        
    def log_embedding_usage(self, tokens_used: int, operation_type: str):
        """记录嵌入API使用情况"""
        try:
            # text-embedding-v4定价: 0.0005元/千Token
            cost = (tokens_used / 1000) * 0.0005
            
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'operation': operation_type,
                'tokens_used': tokens_used,
                'cost_yuan': cost,
                'model': 'text-embedding-v4'
            }
            
            # 读取现有日志
            try:
                with open(self.cost_log_file, 'r') as f:
                    logs = json.load(f)
            except:
                logs = []
            
            logs.append(log_entry)
            
            # 写入日志
            with open(self.cost_log_file, 'w') as f:
                json.dump(logs, f, indent=2)
                
            print(f"💰 嵌入API使用: {tokens_used} tokens, 成本: ¥{cost:.4f}")
            
        except Exception as e:
            print(f"❌ 成本记录失败: {e}")
    
    def get_daily_summary(self) -> Dict:
        """获取每日成本摘要"""
        try:
            with open(self.cost_log_file, 'r') as f:
                logs = json.load(f)
            
            today = datetime.now().date().isoformat()
            today_logs = [log for log in logs if log['timestamp'].startswith(today)]
            
            total_tokens = sum(log['tokens_used'] for log in today_logs)
            total_cost = sum(log['cost_yuan'] for log in today_logs)
            
            return {
                'date': today,
                'total_tokens': total_tokens,
                'total_cost_yuan': total_cost,
                'operations_count': len(today_logs),
                'free_quota_remaining': max(0, 1000000 - total_tokens)  # 100万免费额度
            }
            
        except:
            return {'error': '无法获取成本数据'} 