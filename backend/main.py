from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple
import dashscope
from config import config
import logging
import time
import re
import json

# RAG系统导入
from rag.vector_store import FiveToolsVectorStore
from rag.query_engine import FiveToolsRAG
from processors.data_processor import FiveToolsProcessor
from scripts.sync_5etools_data import FiveToolsDataSync
from utils.cost_monitor import RAGCostMonitor

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="海豹骰子聊天机器人API", version="2.0.0")

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

# 全局RAG系统实例
rag_system = None
cost_monitor = RAGCostMonitor()

class ChatRequest(BaseModel):
    user_id: str
    user_name: str = ""
    message: str
    conversation_id: str = "default"
    user_permission: int = 0  # 新增：用户权限等级

class ChatResponse(BaseModel):
    reply: str
    success: bool
    error: Optional[str] = None
    task_info: Optional[Dict] = None  # 新增：定时任务信息

class ClearHistoryRequest(BaseModel):
    conversation_id: str = "default"

class ClearHistoryResponse(BaseModel):
    success: bool
    message: str

class RAGStatusResponse(BaseModel):
    status: str
    vector_count: int
    last_update: str
    model_version: str

class RAGUpdateResponse(BaseModel):
    success: bool
    documents_processed: Optional[int] = None
    vectors_created: Optional[int] = None
    error: Optional[str] = None

# 新增：定时任务相关的提示词
TASK_DETECTION_SYSTEM_PROMPT = """
你是一个智能助手，除了正常聊天外，还需要识别用户消息中是否包含定时任务需求。

请在回复用户消息后，额外输出一个特殊的任务检测标记：
[TASK_DETECTION_START]
{
  "has_task": true/false,
  "task_type": "cron" 或 "daily" 或 null,
  "task_value": "cron表达式" 或 "时间格式HH:MM" 或 null,
  "task_description": "任务描述" 或 null,
  "task_action": "任务要执行的动作" 或 null
}
[TASK_DETECTION_END]

识别规则：
1. 定时任务需要60级或以上权限才能创建
2. 识别关键词：定时、每天、每小时、每分钟、提醒、通知、任务等
3. 时间表达：
   - "每天8:30" -> task_type="daily", task_value="08:30"
   - "每5分钟" -> task_type="cron", task_value="*/5 * * * *"
   - "每小时" -> task_type="cron", task_value="0 * * * *"
   - "每天中午12点" -> task_type="daily", task_value="12:00"

示例：
用户说："每天早上8点提醒我吃药"
你应该回复："好的，我会为你设置每天早上8点的吃药提醒。[TASK_DETECTION_START]{"has_task": true, "task_type": "daily", "task_value": "08:00", "task_description": "每天早上8点吃药提醒", "task_action": "提醒吃药"}[TASK_DETECTION_END]"

如果用户只是普通聊天，则：
[TASK_DETECTION_START]{"has_task": false, "task_type": null, "task_value": null, "task_description": null, "task_action": null}[TASK_DETECTION_END]
"""

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化RAG系统"""
    global rag_system
    
    try:
        print("🚀 初始化5e.tools RAG系统...")
        
        vector_store = FiveToolsVectorStore(config.VECTOR_DB_PATH)
        rag_system = FiveToolsRAG(vector_store)
        
        # 检查是否需要构建索引
        try:
            collections = vector_store.client.list_collections()
            if not any(c.name == vector_store.collection_name for c in collections):
                print("📚 首次运行，开始构建向量索引...")
                await build_vector_index()
        except:
            print("📚 构建向量索引...")
            await build_vector_index()
        
        print("✅ RAG系统初始化完成！")
        
    except Exception as e:
        print(f"❌ RAG系统初始化失败: {e}")

async def build_vector_index():
    """构建向量索引"""
    try:
        # 1. 同步数据
        data_sync = FiveToolsDataSync(config.FIVETOOLS_DATA_PATH)
        if not data_sync.sync_data():
            raise Exception("数据同步失败")
        
        # 2. 处理数据
        processor = FiveToolsProcessor()
        data_files = data_sync.get_data_files()
        documents = processor.process_all_data(data_files)
        
        # 3. 构建索引
        vector_store = FiveToolsVectorStore(config.VECTOR_DB_PATH)
        if not vector_store.build_index(documents):
            raise Exception("向量索引构建失败")
        
        print("🎉 向量索引构建完成！")
        
    except Exception as e:
        print(f"❌ 向量索引构建失败: {e}")
        raise

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

def parse_task_info(ai_response: str) -> Tuple[str, Optional[Dict]]:
    """解析AI回复中的任务信息"""
    try:
        # 查找任务检测标记
        start_marker = "[TASK_DETECTION_START]"
        end_marker = "[TASK_DETECTION_END]"
        
        start_pos = ai_response.find(start_marker)
        end_pos = ai_response.find(end_marker)
        
        if start_pos == -1 or end_pos == -1:
            return ai_response, None
        
        # 提取任务信息JSON
        task_json_str = ai_response[start_pos + len(start_marker):end_pos].strip()
        task_info = json.loads(task_json_str)
        
        # 移除AI回复中的任务检测标记
        clean_response = ai_response[:start_pos].strip()
        if clean_response.endswith("[TASK_DETECTION_START]"):
            clean_response = clean_response[:-len("[TASK_DETECTION_START]")].strip()
        
        return clean_response, task_info if task_info.get("has_task") else None
        
    except Exception as e:
        logger.error(f"解析任务信息失败: {e}")
        return ai_response, None

@app.get("/")
async def root():
    return {
        "message": "海豹骰子聊天机器人API v2.1.0 - 支持定时任务与RAG知识库", 
        "status": "运行中",
        "features": ["聊天对话", "定时任务", "DND5E规则查询", "RAG知识库"],
        "rag_status": "已启用" if rag_system else "未初始化"
    }

@app.get("/health")
async def health_check():
    """健康检查接口"""
    try:
        # 简单的API连通性检查
        if config.DASHSCOPE_API_KEY:
            return {"status": "healthy", "api_configured": True, "version": "2.0.0"}
        else:
            return {"status": "healthy", "api_configured": False, "warning": "API密钥未配置", "version": "2.0.0"}
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        return {"status": "unhealthy", "error": str(e), "version": "2.0.0"}

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
        
        logger.info(f"收到用户 {request.user_id}(权限:{request.user_permission}) 的消息: {request.message[:50]}...")
        
        # 判断是否需要RAG增强
        needs_rag = False
        rag_info = None
        enhanced_message = request.message
        
        if rag_system:
            needs_rag = rag_system.should_use_rag(request.message)
            
            if needs_rag:
                # 执行RAG查询
                category_hint = rag_system.extract_category_hint(request.message)
                rag_result = await rag_system.query(
                    question=request.message,
                    category_hint=category_hint
                )
                
                # 判断是否使用RAG结果
                if rag_result['confidence'] > 0.5 and rag_result['found_results'] > 0:
                    enhanced_message = f"""{request.message}

[DND5E规则参考资料]:
{rag_result['context']}

请基于以上官方规则资料回答问题，如果资料不完整请说明。"""
                    rag_info = {
                        'used': True,
                        'confidence': rag_result['confidence'],
                        'sources': rag_result['sources']
                    }
                else:
                    rag_info = {'used': False, 'reason': '未找到相关规则资料'}
        
        # 获取对话历史
        history = get_conversation_history(request.conversation_id)
        
        # 如果是新对话，添加系统提示
        if not history:
            # 组合原有系统提示和任务检测提示
            combined_prompt = config.SYSTEM_PROMPT + "\n\n" + TASK_DETECTION_SYSTEM_PROMPT
            add_message_to_history(request.conversation_id, "system", combined_prompt)
            history = get_conversation_history(request.conversation_id)
        
        # 添加增强消息，包含权限等级信息
        user_message_with_context = f"{enhanced_message}\n[用户权限等级: {request.user_permission}]"
        add_message_to_history(request.conversation_id, "user", user_message_with_context, request.user_id, request.user_name)
        history = get_conversation_history(request.conversation_id)
        
        # 调用DashScope API
        from dashscope import Generation
        
        response = Generation.call(
            model=config.DASHSCOPE_MODEL,
            messages=history,
            max_tokens=1500,  # 增加token限制以容纳任务检测信息
            temperature=0.7,
            result_format='message'
        )
        
        if response.status_code == 200:
            ai_reply_raw = response.output.choices[0].message.content
        else:
            raise Exception(f"DashScope API调用失败: {response.message}")
        
        # 解析AI回复中的任务信息
        ai_reply_clean, task_info = parse_task_info(ai_reply_raw)
        
        # 验证任务权限
        if task_info and request.user_permission < 60:
            task_info = None
            ai_reply_clean += "\n\n⚠️ 检测到定时任务需求，但您的权限等级不足（需要60级或以上权限）。请联系管理员提升权限后再试。"
        
        # 如果使用了RAG，添加来源信息
        if rag_info and rag_info.get('used'):
            sources = rag_info['sources'][:2]  # 显示前2个来源
            source_text = ', '.join([s['title'] for s in sources])
            ai_reply_clean += f"\n\n📚 参考来源: {source_text}"
        
        # 添加清理后的AI回复到历史
        add_message_to_history(request.conversation_id, "assistant", ai_reply_clean)
        
        logger.info(f"AI回复用户 {request.user_id}: {ai_reply_clean[:50]}...")
        if task_info:
            logger.info(f"检测到定时任务: {task_info}")
        if rag_info and rag_info.get('used'):
            logger.info(f"使用RAG增强，置信度: {rag_info['confidence']}")
        
        return ChatResponse(reply=ai_reply_clean, success=True, task_info=task_info)
        
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

@app.get("/rag/status", response_model=RAGStatusResponse)
async def rag_status():
    """获取RAG系统状态"""
    try:
        if not rag_system:
            raise HTTPException(status_code=503, detail="RAG系统未初始化")
        
        vector_store = rag_system.vector_store
        
        # 获取向量数量
        try:
            collection = vector_store.client.get_collection(vector_store.collection_name)
            vector_count = collection.count()
        except:
            vector_count = 0
        
        # 获取成本信息
        cost_summary = cost_monitor.get_daily_summary()
        
        return RAGStatusResponse(
            status="运行中" if vector_count > 0 else "未构建",
            vector_count=vector_count,
            last_update=cost_summary.get('date', 'unknown'),
            model_version=config.EMBEDDING_MODEL
        )
        
    except Exception as e:
        logger.error(f"获取RAG状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/update", response_model=RAGUpdateResponse)
async def rag_update():
    """更新RAG知识库"""
    try:
        if not rag_system:
            raise HTTPException(status_code=503, detail="RAG系统未初始化")
        
        logger.info("开始更新RAG知识库...")
        
        # 同步数据
        data_sync = FiveToolsDataSync(config.FIVETOOLS_DATA_PATH)
        if not data_sync.sync_data():
            return RAGUpdateResponse(success=False, error="数据同步失败")
        
        # 处理数据
        processor = FiveToolsProcessor()
        data_files = data_sync.get_data_files()
        documents = processor.process_all_data(data_files)
        
        # 构建索引
        vector_store = FiveToolsVectorStore(config.VECTOR_DB_PATH)
        if not vector_store.build_index(documents):
            return RAGUpdateResponse(success=False, error="向量索引构建失败")
        
        # 更新全局实例
        global rag_system
        rag_system = FiveToolsRAG(vector_store)
        
        # 获取向量数量
        collection = vector_store.client.get_collection(vector_store.collection_name)
        vector_count = collection.count()
        
        logger.info(f"RAG知识库更新完成，处理{len(documents)}个文档，生成{vector_count}个向量")
        
        return RAGUpdateResponse(
            success=True,
            documents_processed=len(documents),
            vectors_created=vector_count
        )
        
    except Exception as e:
        logger.error(f"更新RAG知识库失败: {e}")
        return RAGUpdateResponse(success=False, error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT) 