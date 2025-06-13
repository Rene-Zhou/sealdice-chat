# 海豹骰子AI聊天机器人插件

这是一个为海豹骰子开发的AI聊天机器人插件，采用前后端分离架构，支持通过`.chat`命令与AI大语言模型进行交流。

## 功能特性

- 🤖 **AI对话**: 通过`.chat <消息>`与AI进行自然语言交流
- 💾 **对话记忆**: 自动维护每个用户和群组的对话历史
- 🔄 **历史管理**: 支持`.chat clear`清除对话历史
- 🏥 **健康检查**: 支持`.chat status`检查服务状态
- 🔧 **易于配置**: 支持多种OpenAI兼容的API服务
- 🛡️ **错误处理**: 完善的错误处理和重试机制

## 项目结构

```
Dice/
├── backend/                 # Python FastAPI后端
│   ├── main.py             # 主应用文件
│   ├── config.py           # 配置文件
│   ├── requirements.txt    # Python依赖
│   ├── start.py           # 启动脚本
│   └── env_example.txt    # 环境变量示例
├── frontend/               # 海豹JS插件
│   └── chat.js            # 插件主文件
├── chat.js                # 插件主文件（根目录）
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
   # 必须配置: OPENAI_API_KEY
   ```

3. **启动后端服务**
   ```bash
   # 使用启动脚本（推荐）
   python start.py
   
   # 或直接启动
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
.chat clear   # 清除当前对话历史
.chat status  # 检查AI服务状态
```

## 配置说明

### 后端配置（.env文件）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥（必填） | - |
| `OPENAI_BASE_URL` | API端点地址 | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-3.5-turbo` |
| `HOST` | 服务绑定地址 | `0.0.0.0` |
| `PORT` | 服务端口 | `1478` |
| `MAX_CONVERSATION_HISTORY` | 最大对话历史条数 | `20` |
| `MAX_MESSAGE_LENGTH` | 最大消息长度 | `2000` |
| `SYSTEM_PROMPT` | 系统提示词 | 默认TRPG助手设定 |

### 前端配置（chat.js）

```javascript
const CONFIG = {
  API_BASE_URL: 'http://localhost:1478',  // 后端API地址
  TIMEOUT: 30000,                         // 请求超时时间
  MAX_RETRIES: 3,                         // 最大重试次数
};
```

## 兼容的API服务

本插件兼容OpenAI API格式的所有服务，包括但不限于：

- **OpenAI官方API** - GPT-3.5, GPT-4
- **Azure OpenAI** - 微软Azure平台
- **其他兼容服务** - 如各种本地部署的模型服务

只需要修改`OPENAI_BASE_URL`和`OPENAI_MODEL`配置即可。

## 故障排除

### 常见问题

1. **无法连接到AI服务**
   - 检查后端服务是否正常运行
   - 确认网络连接和防火墙设置
   - 使用`.chat status`检查服务状态

2. **API密钥错误**
   - 确认`.env`文件中的`OPENAI_API_KEY`配置正确
   - 检查API密钥是否有效且有足够余额

3. **插件加载失败**
   - 检查JavaScript语法是否正确
   - 确认海豹版本支持（需要v1.4.0+）
   - 查看海豹日志中的错误信息

### 调试方法

1. **查看后端日志**
   ```bash
   # 后端会输出详细的请求和响应日志
   ```

2. **查看前端日志**
   - 海豹控制台中可以看到JavaScript的console.log输出
   - 检查海豹的日志文件

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

## 许可证

Apache-2.0 License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！