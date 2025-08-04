# 海豹骰AI聊天机器人插件

这是一个为海豹骰开发的AI聊天机器人插件，采用前后端分离架构，支持通过`.chat`命令与AI大语言模型进行交流。

## 功能特性

-  **AI对话**: 通过`.chat <消息>`与AI进行自然语言交流
-  **对话记忆**: 自动维护每个用户和群组的对话历史，支持上下文连续对话
-  **历史管理**: 支持清除对话历史和查看对话列表
-  **健康检查**: 支持服务状态检查和连接测试
-  **易于配置**: 支持阿里云DashScope API（通义千问系列模型）
-  **错误处理**: 完善的错误处理和重试机制
-  **对话统计**: 可查看用户的对话数量统计
-  **智能定时任务**: AI能理解自然语言并自动创建定时任务，支持每日任务和Cron表达式
-  **无指令聊天**: 支持@骰娘进行直接对话，无需使用命令前缀
-  **权限管理**: 定时任务功能需要60级或以上权限，确保安全性

## 项目结构

```
sealdice-chat/
├── backend/                 # Python FastAPI后端
│   ├── main.py             # 主应用文件
│   ├── config.py           # 配置文件
│   ├── pyproject.toml      # 项目配置和依赖
│   ├── uv.lock             # 依赖锁定文件
│   ├── .python-version     # Python版本声明
│   ├── run_prod_uv.sh      # 生产环境启动脚本
│   ├── pm2.config.js       # PM2进程管理配置
│   ├── env_example.txt     # 环境变量示例
│   ├── README.md           # 后端详细文档
│   ├── .venv/              # Python虚拟环境
│   └── logs/               # 日志目录
├── chat.js                 # 海豹JS插件主文件
├── .gitignore              # Git忽略文件
├── LICENSE                 # 开源许可证
└── README.md               # 本文件
```

## 快速开始

### 1. 配置后端

1. **安装uv包管理器（如果尚未安装）**
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **进入后端目录并安装依赖**
   ```bash
   cd backend
   uv sync
   ```

3. **配置环境变量**
   ```bash
   # 复制环境变量模板
   cp env_example.txt .env
   
   # 编辑.env文件，设置你的API密钥
   # 参考env_example.txt中的配置说明
   ```

4. **获取DashScope API Key**
   - 访问 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/)
   - 注册/登录阿里云账号
   - 开通DashScope服务
   - 创建API Key
   - 将API Key填入 `.env` 文件

5. **启动后端服务**
   ```bash
   # 确保在backend目录下运行以下命令
   cd backend
   
   # 开发环境 - 使用uvicorn
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 1478
   
   # 生产环境 - 使用自动化启动脚本
   chmod +x run_prod_uv.sh
   ./run_prod_uv.sh
   
   # 生产环境 - 使用PM2进行进程管理和保活（推荐）
   pm2 start pm2.config.js --env production
   ```

### 2. 配置前端插件

1. **修改API地址**
   - 打开`chat.js`文件
   - 修改`CONFIG.API_BASE_URL`为你的后端地址（默认`http://localhost:1478`）

2. **上传到海豹**
   - 将`chat.js`文件上传到海豹的插件目录
   - 在海豹WebUI中重载JavaScript环境

## 使用方法

### 基本对话
```
.chat 你好
```

### 管理命令
```
.chat help    # 查看帮助信息
.chat test    # 测试AI服务连接
.chat clear   # 清除对话历史
.chat list    # 查看对话列表
```

### 无指令聊天
```
.chat free on     # 开启无指令聊天功能
.chat free off    # 关闭无指令聊天功能
@骰娘 你好        # 直接@骰娘进行对话（需先开启功能）
```

### 定时任务功能
```
.chat task list   # 查看已创建的定时任务列表
.chat task clear  # 清除所有定时任务

# 通过自然语言创建定时任务（需要60级或以上权限）
.chat 每天早上8点提醒我起床
.chat 每小时提醒我喝水
.chat 每5分钟检查一下状态
.chat 每天晚上10点提醒我睡觉
```

## 定时任务功能详解

### 功能特点
- **智能识别**: AI能自动识别用户消息中的定时任务需求
- **自然语言**: 支持自然语言描述，如"每天早上8点"、"每小时"等
- **多种类型**: 支持每日任务（daily）和Cron表达式任务
- **权限控制**: 需要60级或以上权限才能创建定时任务
- **自动提醒**: 任务执行时自动发送提醒消息到对应群组或私聊

### 支持的时间表达
- **每日任务**: "每天8:30"、"每天中午12点"、"每天晚上10点"
- **定时任务**: "每5分钟"、"每小时"、"每30分钟"
- **自然语言**: "每天早上"、"每天下午"、"每天晚上"

### 任务管理
- **查看任务**: `.chat task list` - 显示当前会话/用户的所有定时任务
- **清除任务**: `.chat task clear` - 清除所有已注册的定时任务
- **任务统计**: 显示总任务数和当前相关任务数

### 使用示例
```
.chat 每天早上8点提醒我吃药
.chat 每小时提醒我喝水
.chat 每5分钟检查一下服务器状态
.chat 每天晚上10点提醒我睡觉
.chat 每天中午12点提醒我吃饭
```

## 配置说明

### 环境变量配置

详细配置说明请参考 `backend/env_example.txt` 文件。

主要配置项：
- `DASHSCOPE_API_KEY`: DashScope API密钥（必需）
- `DASHSCOPE_MODEL`: 使用的模型名称（默认：qwen-turbo）
- `HOST`: 服务器绑定地址（默认：0.0.0.0）
- `PORT`: 服务器端口（默认：1478）
- `MAX_CONVERSATION_HISTORY`: 最大对话历史条数（默认：20）
- `MAX_MESSAGE_LENGTH`: 最大消息长度（默认：2000）

### 支持的模型

- `qwen-turbo` - 通义千问Turbo（推荐，性价比高）
- `qwen-plus` - 通义千问Plus（平衡版本）
- `qwen-max` - 通义千问Max（最强性能）
- `qwen-max-longcontext` - 通义千问Max长文本版

## 部署

### PM2 常用命令
```bash
pm2 status                    # 查看状态
pm2 logs seal-dice-chatbot    # 查看日志
pm2 restart seal-dice-chatbot # 重启应用
pm2 stop seal-dice-chatbot    # 停止应用
pm2 delete seal-dice-chatbot  # 删除应用
```

## API文档

启动服务后，可以访问以下地址查看API文档：
- Swagger UI: http://localhost:1478/docs
- ReDoc: http://localhost:1478/redoc

## 故障排除

### 常见问题
1. **API Key无效**: 确保在DashScope控制台正确生成API Key，并检查余额和权限
2. **模型不存在**: 检查模型名称是否正确，确保账号有权限访问该模型
3. **网络连接问题**: 检查网络连接，确保可以访问DashScope服务

### 注意事项
- 确保账号有足够的余额和API调用配额
- 建议先在测试环境验证配置正确性
- 生产环境使用时注意API Key的安全性

## 许可证

Apache-2.0 License

## 相关文档
- [后端详细文档](backend/README.md) - 后端API服务的详细配置和使用说明