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
    
    # RAG系统配置
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-v4")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "1024"))
    FIVETOOLS_DATA_PATH: str = os.getenv("FIVETOOLS_DATA_PATH", "./5etools-data")
    VECTOR_DB_PATH: str = os.getenv("VECTOR_DB_PATH", "./chroma_db")
    
    # RAG查询配置
    RAG_SIMILARITY_THRESHOLD: float = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.6"))
    RAG_MAX_CONTEXT_LENGTH: int = int(os.getenv("RAG_MAX_CONTEXT_LENGTH", "4000"))
    RAG_MAX_RESULTS: int = int(os.getenv("RAG_MAX_RESULTS", "10"))

config = Config() 