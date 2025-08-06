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
import os

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

# 角色数据文件路径
CHARACTERS_FILE = "characters.json"

def load_characters() -> Dict:
    """加载角色数据"""
    try:
        if os.path.exists(CHARACTERS_FILE):
            with open(CHARACTERS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # 兼容旧版本格式，如果存在current_character则转换为新格式
                if "current_character" in data and "session_characters" not in data:
                    logger.info("检测到旧版本角色数据格式，正在转换为会话级格式")
                    old_current = data.pop("current_character", "default")
                    data["session_characters"] = {"default": old_current}
                    save_characters(data)
                return data
        else:
            # 如果文件不存在，创建默认角色数据
            default_data = {
                "session_characters": {},  # 会话级角色映射
                "characters": {
                    "default": {
                        "name": "默认助手",
                        "description": config.SYSTEM_PROMPT
                    }
                }
            }
            save_characters(default_data)
            return default_data
    except Exception as e:
        logger.error(f"加载角色数据失败: {e}")
        # 返回默认数据
        return {
            "session_characters": {},
            "characters": {
                "default": {
                    "name": "默认助手",
                    "description": config.SYSTEM_PROMPT
                }
            }
        }

def save_characters(data: Dict) -> bool:
    """保存角色数据"""
    try:
        with open(CHARACTERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"保存角色数据失败: {e}")
        return False

def get_current_character_description(conversation_id: str = "default") -> str:
    """获取指定会话的当前角色描述（系统提示词）"""
    try:
        data = load_characters()
        session_characters = data.get("session_characters", {})
        characters = data.get("characters", {})
        
        # 获取该会话的当前角色，如果没有设置则使用default
        current_char = session_characters.get(conversation_id, "default")
        
        if current_char in characters:
            return characters[current_char]["description"]
        else:
            # 如果当前角色不存在，使用默认角色
            return characters.get("default", {}).get("description", config.SYSTEM_PROMPT)
    except Exception as e:
        logger.error(f"获取当前角色描述失败: {e}")
        return config.SYSTEM_PROMPT

def get_session_current_character(conversation_id: str = "default") -> str:
    """获取指定会话的当前角色名"""
    try:
        data = load_characters()
        session_characters = data.get("session_characters", {})
        return session_characters.get(conversation_id, "default")
    except Exception as e:
        logger.error(f"获取会话角色失败: {e}")
        return "default"

def set_session_character(conversation_id: str, character_name: str) -> bool:
    """设置指定会话的角色"""
    try:
        data = load_characters()
        if "session_characters" not in data:
            data["session_characters"] = {}
        
        data["session_characters"][conversation_id] = character_name
        return save_characters(data)
    except Exception as e:
        logger.error(f"设置会话角色失败: {e}")
        return False

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

# 新增：角色系统相关的数据模型
class Character(BaseModel):
    name: str
    description: str

class CharacterListRequest(BaseModel):
    conversation_id: str = "default"

class CharacterListResponse(BaseModel):
    success: bool
    characters: Dict[str, Character] = {}
    current_character: str = "default"
    conversation_id: str = "default"
    error: Optional[str] = None

class SetCharacterRequest(BaseModel):
    character_name: str
    conversation_id: str = "default"

class SetCharacterResponse(BaseModel):
    success: bool
    message: str
    character: Optional[Character] = None
    conversation_id: str = "default"
    error: Optional[str] = None

class AddCharacterRequest(BaseModel):
    character_name: str
    character_description: str

class AddCharacterResponse(BaseModel):
    success: bool
    message: str
    character: Optional[Character] = None
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
    return {"message": "海豹骰子聊天机器人API v2.0.0 - 支持定时任务", "status": "运行中"}

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
        
        # 获取对话历史
        history = get_conversation_history(request.conversation_id)
        
        # 如果是新对话，添加系统提示
        if not history:
            # 使用该会话当前角色的描述组合任务检测提示
            current_character_prompt = get_current_character_description(request.conversation_id)
            combined_prompt = current_character_prompt + "\n\n" + TASK_DETECTION_SYSTEM_PROMPT
            add_message_to_history(request.conversation_id, "system", combined_prompt)
            history = get_conversation_history(request.conversation_id)
        
        # 添加用户消息，包含权限等级信息
        user_message_with_context = f"{request.message}\n[用户权限等级: {request.user_permission}]"
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
        
        # 添加清理后的AI回复到历史
        add_message_to_history(request.conversation_id, "assistant", ai_reply_clean)
        
        logger.info(f"AI回复用户 {request.user_id}: {ai_reply_clean[:50]}...")
        if task_info:
            logger.info(f"检测到定时任务: {task_info}")
        
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

@app.post("/characters", response_model=CharacterListResponse)
async def get_characters(request: CharacterListRequest):
    """获取角色列表"""
    try:
        data = load_characters()
        characters = {}
        for char_id, char_data in data.get("characters", {}).items():
            characters[char_id] = Character(
                name=char_data["name"],
                description=char_data["description"]
            )
        
        # 获取该会话的当前角色
        current_character = get_session_current_character(request.conversation_id)
        
        return CharacterListResponse(
            success=True,
            characters=characters,
            current_character=current_character,
            conversation_id=request.conversation_id
        )
    except Exception as e:
        logger.error(f"获取角色列表失败: {e}")
        return CharacterListResponse(success=False, error=str(e), conversation_id=request.conversation_id)

@app.post("/characters/set", response_model=SetCharacterResponse)
async def set_character(request: SetCharacterRequest):
    """切换角色（会话级）"""
    try:
        data = load_characters()
        characters = data.get("characters", {})
        
        if request.character_name not in characters:
            return SetCharacterResponse(
                success=False,
                message=f"角色 '{request.character_name}' 不存在",
                error="角色不存在",
                conversation_id=request.conversation_id
            )
        
        # 设置该会话的角色
        if set_session_character(request.conversation_id, request.character_name):
            character_info = characters[request.character_name]
            logger.info(f"会话 {request.conversation_id} 成功切换到角色: {request.character_name}")
            
            # 只清除当前会话的对话历史
            if request.conversation_id in conversation_store:
                conversation_store[request.conversation_id] = []
                logger.info(f"已清除会话 {request.conversation_id} 的对话历史")
            
            return SetCharacterResponse(
                success=True,
                message=f"成功切换到角色：{character_info['name']}",
                character=Character(
                    name=character_info["name"],
                    description=character_info["description"]
                ),
                conversation_id=request.conversation_id
            )
        else:
            return SetCharacterResponse(
                success=False,
                message="保存角色设置失败",
                error="保存失败",
                conversation_id=request.conversation_id
            )
            
    except Exception as e:
        logger.error(f"切换角色失败: {e}")
        return SetCharacterResponse(success=False, message="切换角色失败", error=str(e), conversation_id=request.conversation_id)

@app.post("/characters/add", response_model=AddCharacterResponse)
async def add_character(request: AddCharacterRequest):
    """添加新角色"""
    try:
        # 验证输入
        if not request.character_name.strip():
            return AddCharacterResponse(
                success=False,
                message="角色名称不能为空",
                error="无效输入"
            )
        
        if not request.character_description.strip():
            return AddCharacterResponse(
                success=False,
                message="角色描述不能为空",
                error="无效输入"
            )
            
        # 检查角色名称是否包含特殊字符
        if not request.character_name.replace("-", "").replace("_", "").isalnum():
            return AddCharacterResponse(
                success=False,
                message="角色名称只能包含字母、数字、下划线和连字符",
                error="无效角色名"
            )
        
        data = load_characters()
        characters = data.get("characters", {})
        
        # 检查角色是否已存在
        if request.character_name in characters:
            return AddCharacterResponse(
                success=False,
                message=f"角色 '{request.character_name}' 已存在",
                error="角色已存在"
            )
        
        # 添加新角色
        characters[request.character_name] = {
            "name": request.character_name,
            "description": request.character_description
        }
        data["characters"] = characters
        
        if save_characters(data):
            logger.info(f"成功添加新角色: {request.character_name}")
            return AddCharacterResponse(
                success=True,
                message=f"成功添加角色：{request.character_name}",
                character=Character(
                    name=request.character_name,
                    description=request.character_description
                )
            )
        else:
            return AddCharacterResponse(
                success=False,
                message="保存角色失败",
                error="保存失败"
            )
            
    except Exception as e:
        logger.error(f"添加角色失败: {e}")
        return AddCharacterResponse(success=False, message="添加角色失败", error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.HOST, port=config.PORT) 