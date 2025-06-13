import os
from typing import Optional

class Config:
    # OpenAI API配置
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    
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