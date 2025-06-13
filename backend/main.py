from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import openai
from config import config
import logging
import time

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="海豹骰子聊天机器人API", version="1.0.0")

# 添加CORS支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置OpenAI客户端
client = openai.OpenAI(
    api_key=config.OPENAI_API_KEY,
    base_url=config.OPENAI_BASE_URL
)

# 存储对话历史 {user_id: {conversation_id: [messages]}}
conversation_store: Dict[str, Dict[str, List[Dict]]] = {}

class ChatRequest(BaseModel):
    user_id: str
    message: str
    conversation_id: str = "default"

class ChatResponse(BaseModel):
    reply: str
    success: bool
    error: Optional[str] = None

class ClearHistoryRequest(BaseModel):
    user_id: str
    conversation_id: str = "default"

class ClearHistoryResponse(BaseModel):
    success: bool
    message: str

def get_conversation_history(user_id: str, conversation_id: str) -> List[Dict]:
    """获取用户对话历史"""
    if user_id not in conversation_store:
        conversation_store[user_id] = {}
    if conversation_id not in conversation_store[user_id]:
        conversation_store[user_id][conversation_id] = []
    return conversation_store[user_id][conversation_id]

def add_message_to_history(user_id: str, conversation_id: str, role: str, content: str):
    """添加消息到对话历史"""
    history = get_conversation_history(user_id, conversation_id)
    history.append({"role": role, "content": content})
    
    # 限制历史记录长度
    if len(history) > config.MAX_CONVERSATION_HISTORY:
        # 保留系统消息和最近的对话
        system_messages = [msg for msg in history if msg["role"] == "system"]
        recent_messages = history[-config.MAX_CONVERSATION_HISTORY:]
        history = system_messages + recent_messages
        conversation_store[user_id][conversation_id] = history

def clear_conversation_history(user_id: str, conversation_id: str):
    """清除用户对话历史"""
    if user_id in conversation_store and conversation_id in conversation_store[user_id]:
        conversation_store[user_id][conversation_id] = []

@app.get("/")
async def root():
    return {"message": "海豹骰子聊天机器人API", "status": "运行中"}

@app.get("/health")
async def health_check():
    """健康检查接口"""
    try:
        # 简单的API连通性检查
        if config.OPENAI_API_KEY:
            return {"status": "healthy", "api_configured": True}
        else:
            return {"status": "healthy", "api_configured": False, "warning": "API密钥未配置"}
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return {"status": "unhealthy", "error": str(e)}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """处理聊天请求"""
    try:
        # 验证输入
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="消息不能为空")
        
        if len(request.message) > config.MAX_MESSAGE_LENGTH:
            raise HTTPException(status_code=400, detail="消息过长")
        
        # 检查API密钥
        if not config.OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="API密钥未配置")
        
        logger.info(f"收到用户 {request.user_id} 的消息: {request.message[:50]}...")
        
        # 获取对话历史
        history = get_conversation_history(request.user_id, request.conversation_id)
        
        # 如果是新对话，添加系统提示
        if not history:
            add_message_to_history(request.user_id, request.conversation_id, "system", config.SYSTEM_PROMPT)
            history = get_conversation_history(request.user_id, request.conversation_id)
        
        # 添加用户消息
        add_message_to_history(request.user_id, request.conversation_id, "user", request.message)
        history = get_conversation_history(request.user_id, request.conversation_id)
        
        # 调用OpenAI API
        response = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=history,
            max_tokens=1000,
            temperature=0.7
        )
        
        ai_reply = response.choices[0].message.content
        
        # 添加AI回复到历史
        add_message_to_history(request.user_id, request.conversation_id, "assistant", ai_reply)
        
        logger.info(f"AI回复用户 {request.user_id}: {ai_reply[:50]}...")
        
        return ChatResponse(reply=ai_reply, success=True)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"聊天处理错误: {e}")
        return ChatResponse(reply="", success=False, error=str(e))

@app.post("/clear_history", response_model=ClearHistoryResponse)
async def clear_history(request: ClearHistoryRequest):
    """清除对话历史"""
    try:
        logger.info(f"清除用户 {request.user_id} 的对话历史")
        clear_conversation_history(request.user_id, request.conversation_id)
        return ClearHistoryResponse(success=True, message="对话历史已清除")
    except Exception as e:
        logger.error(f"清除历史错误: {e}")
        return ClearHistoryResponse(success=False, message=f"清除失败: {str(e)}")

@app.get("/conversations/{user_id}")
async def get_conversations(user_id: str):
    """获取用户的所有对话"""
    if user_id in conversation_store:
        conversations = {}
        for conv_id, messages in conversation_store[user_id].items():
            conversations[conv_id] = len(messages)
        return {"conversations": conversations}
    return {"conversations": {}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT) 