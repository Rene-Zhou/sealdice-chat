from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import dashscope
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

# 配置DashScope API Key
dashscope.api_key = config.DASHSCOPE_API_KEY

# 存储对话历史 {conversation_id: [messages]}
conversation_store: Dict[str, List[Dict]] = {}

class ChatRequest(BaseModel):
    user_id: str
    user_name: str = ""
    message: str
    conversation_id: str = "default"

class ChatResponse(BaseModel):
    reply: str
    success: bool
    error: Optional[str] = None

class ClearHistoryRequest(BaseModel):
    conversation_id: str = "default"

class ClearHistoryResponse(BaseModel):
    success: bool
    message: str

def get_conversation_history(conversation_id: str) -> List[Dict]:
    """获取对话历史"""
    if conversation_id not in conversation_store:
        conversation_store[conversation_id] = []
    return conversation_store[conversation_id]

def add_message_to_history(conversation_id: str, role: str, content: str, user_id: str = "", user_name: str = ""):
    """添加消息到对话历史"""
    history = get_conversation_history(conversation_id)
    message_data = {"role": role, "content": content}
    
    # 如果是用户消息，添加用户信息
    if role == "user" and user_id:
        if user_name:
            message_data["content"] = f"[用户 {user_name}({user_id})]: {content}"
        else:
            message_data["content"] = f"[用户 {user_id}]: {content}"
    
    history.append(message_data)
    
    # 限制历史记录长度
    if len(history) > config.MAX_CONVERSATION_HISTORY:
        # 保留系统消息和最近的对话
        system_messages = [msg for msg in history if msg["role"] == "system"]
        recent_messages = history[-config.MAX_CONVERSATION_HISTORY:]
        history = system_messages + recent_messages
        conversation_store[conversation_id] = history

def clear_conversation_history(conversation_id: str):
    """清除对话历史"""
    if conversation_id in conversation_store:
        conversation_store[conversation_id] = []

@app.get("/")
async def root():
    return {"message": "海豹骰子聊天机器人API", "status": "运行中"}

@app.get("/health")
async def health_check():
    """健康检查接口"""
    try:
        # 简单的API连通性检查
        if config.DASHSCOPE_API_KEY:
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
        if not config.DASHSCOPE_API_KEY:
            raise HTTPException(status_code=500, detail="API密钥未配置")
        
        user_display = f"{request.user_name}({request.user_id})" if request.user_name else request.user_id
        logger.info(f"收到用户 {user_display} 的消息: {request.message[:50]}...")
        
        # 获取对话历史
        history = get_conversation_history(request.conversation_id)
        
        # 如果是新对话，添加系统提示
        if not history:
            add_message_to_history(request.conversation_id, "system", config.SYSTEM_PROMPT)
            history = get_conversation_history(request.conversation_id)
        
        # 添加用户消息
        add_message_to_history(request.conversation_id, "user", request.message, request.user_id, request.user_name)
        history = get_conversation_history(request.conversation_id)
        
        # 记录完整的提示词
        logger.info(f"发送给AI的完整对话历史 (对话ID: {request.conversation_id}):")
        for i, msg in enumerate(history):
            logger.info(f"  [{i+1}] {msg['role']}: {msg['content'][:100]}{'...' if len(msg['content']) > 100 else ''}")
        
        # 调用DashScope API
        from dashscope import Generation
        
        response = Generation.call(
            model=config.DASHSCOPE_MODEL,
            messages=history,
            max_tokens=1000,
            temperature=0.7,
            result_format='message'
        )
        
        if response.status_code == 200:
            ai_reply = response.output.choices[0].message.content
        else:
            raise Exception(f"DashScope API调用失败: {response.message}")
        
        # 添加AI回复到历史
        add_message_to_history(request.conversation_id, "assistant", ai_reply)
        
        logger.info(f"AI回复用户 {user_display}: {ai_reply[:50]}...")
        
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
        logger.info(f"清除对话历史")
        clear_conversation_history(request.conversation_id)
        return ClearHistoryResponse(success=True, message="对话历史已清除")
    except Exception as e:
        logger.error(f"清除历史错误: {e}")
        return ClearHistoryResponse(success=False, message=f"清除失败: {str(e)}")

@app.get("/conversations")
async def get_conversations():
    """获取所有对话列表"""
    conversations = {}
    for conv_id, messages in conversation_store.items():
        conversations[conv_id] = len(messages)
    return {"conversations": conversations}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT) 