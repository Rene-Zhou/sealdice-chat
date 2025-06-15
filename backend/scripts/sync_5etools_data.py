import git
import json
import os
from pathlib import Path
from typing import Dict, List

class FiveToolsDataSync:
    def __init__(self, local_path: str = "./5etools-data"):
        self.local_path = Path(local_path)
        self.repo_url = "https://github.com/5etools-mirror-3/5etools-src.git"
        
    def sync_data(self) -> bool:
        """同步5e.tools数据（仅data目录）"""
        try:
            if self.local_path.exists():
                repo = git.Repo(self.local_path)
                repo.remotes.origin.pull()
                print("✅ 5e.tools数据更新完成")
            else:
                # 仅克隆data目录以节省空间
                git.Repo.clone_from(
                    self.repo_url, 
                    self.local_path,
                    depth=1  # 浅克隆
                )
                print("✅ 5e.tools数据同步完成")
            return True
        except Exception as e:
            print(f"❌ 数据同步失败: {e}")
            return False
    
    def get_data_files(self) -> Dict[str, Path]:
        """获取所有数据文件"""
        data_dir = self.local_path / "data"
        data_files = {}
        
        if data_dir.exists():
            # 重点数据文件
            priority_files = [
                'spells.json', 'bestiary.json', 'classes.json', 
                'races.json', 'items.json', 'feats.json',
                'backgrounds.json', 'rules.json'
            ]
            
            for file_name in priority_files:
                file_path = data_dir / file_name
                if file_path.exists():
                    data_files[file_name.stem] = file_path
                    
        return data_files 