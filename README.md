# 海豹骰子AI聊天机器人插件

这是一个为海豹骰子开发的AI聊天机器人插件，采用前后端分离架构，支持通过`.chat`命令与AI大语言模型进行交流。

## 功能特性

- 🤖 **AI对话**: 通过`.chat <消息>`与AI进行自然语言交流
- 💾 **对话记忆**: 自动维护每个用户和群组的对话历史，支持上下文连续对话
- 🔄 **历史管理**: 支持清除对话历史和查看对话列表
- 🏥 **健康检查**: 支持服务状态检查和连接测试
- 🔧 **易于配置**: 支持阿里云DashScope API（通义千问系列模型）
- 🛡️ **错误处理**: 完善的错误处理和重试机制
- 📊 **对话统计**: 可查看用户的对话数量统计

## 项目结构

```
Dice/
├── backend/                 # Python FastAPI后端
│   ├── main.py             # 主应用文件
│   ├── config.py           # 配置文件
│   ├── requirements.txt    # Python依赖
│   ├── run_prod.py         # 生产环境启动脚本
│   ├── pm2.config.js       # PM2进程管理配置
│   ├── env_example.txt     # 环境变量示例
│   ├── README_DASHSCOPE.md # DashScope配置说明
│   └── PM2_GUIDE.md        # PM2部署指南
├── examples/               # 示例文件
├── chat.js                # 海豹JS插件主文件
├── 技术文档.md            # 技术文档
└── README.md              # 本文件
```

## 快速开始

### 1. 配置后端

1. **安装Python依赖**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp env_example.txt .env
   
   # 编辑.env文件，设置你的API密钥
   # 必须配置: DASHSCOPE_API_KEY
   ```

3. **启动后端服务**
   ```bash
   # 开发环境 - 直接启动
   python main.py
   
   # 生产环境 - 使用PM2
   pm2 start pm2.config.js
   
   # 或使用uvicorn
   uvicorn main:app --host 0.0.0.0 --port 1478 --reload
   ```

### 2. 配置前端插件

1. **修改API地址**
   - 打开`chat.js`文件
   - 修改`CONFIG.API_BASE_URL`为你的后端地址（默认`http://localhost:1478`）

2. **上传到海豹**
   - 将`chat.js`文件上传到海豹的JavaScript插件目录
   - 在海豹WebUI中重载JavaScript环境

## 使用方法

### 基本对话
```
.chat 你好，请介绍一下TRPG
.chat 帮我生成一个法师角色的背景故事
.chat 解释一下DND5E的先攻机制
```

### 管理命令
```
.chat help    # 查看帮助信息
.chat test    # 测试AI服务连接
```

## API接口文档

### 核心聊天接口

#### POST /chat
处理用户聊天请求
```json
{
    "user_id": "用户ID",
    "message": "用户消息",
    "conversation_id": "对话ID（可选，默认为default）"
}
```

响应：
```json
{
    "reply": "AI回复内容",
    "success": true,
    "error": null
}
```

#### POST /clear_history
清除用户对话历史
```json
{
    "user_id": "用户ID",
    "conversation_id": "对话ID（可选）"
}
```

#### GET /conversations/{user_id}
获取用户的所有对话列表
```json
{
    "conversations": {
        "default": 5,
        "group_123456": 12
    }
}
```

#### GET /health
服务健康检查
```json
{
    "status": "healthy",
    "api_configured": true
}
```

#### GET /
API根路径
```json
{
    "message": "海豹骰子聊天机器人API",
    "status": "运行中"
}
```

## 配置说明

### 后端配置（.env文件）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `DASHSCOPE_API_KEY` | 阿里云DashScope API密钥（必填） | - |
| `DASHSCOPE_MODEL` | 使用的通义千问模型 | `qwen-turbo` |
| `HOST` | 服务绑定地址 | `0.0.0.0` |
| `PORT` | 服务端口 | `1478` |
| `MAX_CONVERSATION_HISTORY` | 最大对话历史条数 | `20` |
| `MAX_MESSAGE_LENGTH` | 最大消息长度 | `2000` |
| `SYSTEM_PROMPT` | 系统提示词 | 默认TRPG助手设定 |

#### 支持的模型
- `qwen-turbo` - 通义千问Turbo（推荐，快速响应）
- `qwen-plus` - 通义千问Plus（平衡性能与质量）
- `qwen-max` - 通义千问Max（最高质量，复杂推理）
- `qwen-max-longcontext` - 通义千问Max长文本（支持长文本处理）

### 前端配置（chat.js）

```javascript
const CONFIG = {
  API_BASE_URL: 'http://localhost:1478',  // 后端API地址
  TIMEOUT: 30000,                         // 请求超时时间
  MAX_RETRIES: 3,                         // 最大重试次数
};
```

## 支持的AI服务

本插件使用阿里云DashScope API，支持通义千问系列模型：

- **通义千问Turbo** - 快速响应，适合日常对话
- **通义千问Plus** - 平衡性能与质量
- **通义千问Max** - 最高质量，复杂推理
- **通义千问Max长文本** - 支持长文本处理

如需使用DashScope API，请前往[阿里云DashScope控制台](https://dashscope.console.aliyun.com/)获取API密钥。

## 部署指南

### 开发环境
```bash
cd backend
python main.py
```

### 生产环境
推荐使用PM2进行进程管理：
```bash
cd backend
pm2 start pm2.config.js
pm2 status
pm2 logs seal-dice-chatbot
```

详细的PM2部署指南请参考 `backend/PM2_GUIDE.md`

## 故障排除

### 常见问题

1. **无法连接到AI服务**
   - 检查后端服务是否正常运行
   - 确认网络连接和防火墙设置
   - 使用`.chat test`检查服务状态

2. **API密钥错误**
   - 确认`.env`文件中的`DASHSCOPE_API_KEY`配置正确
   - 检查API密钥是否有效且有足够余额或额度

3. **插件加载失败**
   - 检查JavaScript语法是否正确
   - 确认海豹版本支持（需要v1.4.0+）
   - 查看海豹日志中的错误信息

4. **对话历史异常**
   - 检查对话历史是否过长，超过`MAX_CONVERSATION_HISTORY`限制
   - 确认用户ID和对话ID的格式正确

### 调试方法

1. **查看后端日志**
   ```bash
   # 直接启动时的日志
   python main.py
   
   # PM2管理的日志
   pm2 logs seal-dice-chatbot
   ```

2. **查看前端日志**
   - 海豹控制台中可以看到JavaScript的console.log输出
   - 检查海豹的日志文件

3. **API测试**
   - 访问 `http://localhost:1478/docs` 查看Swagger文档
   - 使用 `curl` 或 `Postman` 测试API接口

## 开发相关

### API接口文档

后端服务启动后，可以访问以下地址查看API文档：
- Swagger UI: `http://localhost:1478/docs`
- ReDoc: `http://localhost:1478/redoc`

### 扩展开发

如需扩展功能，可以：
1. 在后端添加新的API端点
2. 在前端添加对应的命令处理
3. 参考`技术文档.md`了解详细架构
4. 查看`backend/README_DASHSCOPE.md`了解DashScope集成细节

### 版本历史

- v1.0.9 - 支持连续对话和测试命令
- v1.0.8 - 改进错误处理和日志记录
- v1.0.5 - 基础AI对话功能

## 许可证

Apache-2.0 License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 相关文档

- [技术文档](技术文档.md) - 详细的技术架构说明
- [DashScope配置指南](backend/README_DASHSCOPE.md) - DashScope API配置详解
- [PM2部署指南](backend/PM2_GUIDE.md) - 生产环境部署说明