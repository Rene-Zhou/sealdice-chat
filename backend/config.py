import os
from typing import Optional
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

class Config:
    # DashScope API配置
    DASHSCOPE_API_KEY: Optional[str] = os.getenv("DASHSCOPE_API_KEY")
    DASHSCOPE_MODEL: str = os.getenv("DASHSCOPE_MODEL", "qwen-turbo")
    
    # 服务配置
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "1478"))
    
    # 对话配置
    MAX_CONVERSATION_HISTORY: int = int(os.getenv("MAX_CONVERSATION_HISTORY", "20"))
    MAX_MESSAGE_LENGTH: int = int(os.getenv("MAX_MESSAGE_LENGTH", "2000"))
    
    # 系统提示词
    SYSTEM_PROMPT: str = os.getenv("SYSTEM_PROMPT", 
        "你是一个友善的AI助手，正在参与TRPG（桌上角色扮演游戏）。"
        "请用简洁友好的语言回复用户的问题和对话。")

config = Config() 