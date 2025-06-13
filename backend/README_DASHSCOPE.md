# 海豹骰子聊天机器人API (DashScope版本)

这是一个基于FastAPI和阿里云DashScope的聊天机器人项目，专为TRPG（桌上角色扮演游戏）场景设计。

## 变更说明

项目已从OpenAI API改为使用阿里云DashScope API，具体变更包括：

- **API SDK**: 从 `openai` 改为 `dashscope`
- **API Key**: 从 `OPENAI_API_KEY` 改为 `DASHSCOPE_API_KEY`
- **模型配置**: 从 `gpt-3.5-turbo` 改为 `qwen-turbo`
- **移除配置**: 不再需要 `OPENAI_BASE_URL` 配置

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制环境变量示例文件：
```bash
cp env_example.txt .env
```

编辑 `.env` 文件，配置你的DashScope API Key：
```bash
# DashScope API配置
DASHSCOPE_API_KEY=your_dashscope_api_key_here
DASHSCOPE_MODEL=qwen-turbo

# 服务配置
HOST=0.0.0.0
PORT=1478

# 其他配置...
```

### 3. 获取DashScope API Key

1. 访问 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录阿里云账号
3. 开通DashScope服务
4. 创建API Key
5. 将API Key填入 `.env` 文件

### 4. 测试配置

运行配置测试工具：
```bash
python test_env.py
```

或运行简单测试：
```bash
python test_env_simple.py
```

### 5. 启动服务

使用启动脚本：
```bash
python start.py
```

或直接启动：
```bash
python main.py
```

服务启动后，访问 http://localhost:1478 查看API文档。

## 支持的模型

DashScope支持以下通义千问模型：

- `qwen-turbo` - 通义千问Turbo（推荐，性价比高）
- `qwen-plus` - 通义千问Plus（平衡版本）
- `qwen-max` - 通义千问Max（最强性能）
- `qwen-max-longcontext` - 通义千问Max长文本版

## API接口

### 聊天接口
```
POST /chat
{
    "user_id": "用户ID",
    "message": "用户消息",
    "conversation_id": "对话ID（可选）"
}
```

### 清除历史
```
POST /clear_history
{
    "user_id": "用户ID",
    "conversation_id": "对话ID（可选）"
}
```

### 健康检查
```
GET /health
```

### 获取用户对话列表
```
GET /conversations/{user_id}
```

## 环境变量说明

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| DASHSCOPE_API_KEY | 是 | - | DashScope API密钥 |
| DASHSCOPE_MODEL | 否 | qwen-turbo | 使用的模型名称 |
| HOST | 否 | 0.0.0.0 | 服务器绑定地址 |
| PORT | 否 | 1478 | 服务器端口 |
| MAX_CONVERSATION_HISTORY | 否 | 20 | 最大对话历史条数 |
| MAX_MESSAGE_LENGTH | 否 | 2000 | 最大消息长度 |
| SYSTEM_PROMPT | 否 | 默认提示 | 系统提示词 |

## 故障排除

### 1. API Key无效
确保在DashScope控制台正确生成API Key，并检查余额和权限。

### 2. 模型不存在
检查模型名称是否正确，确保账号有权限访问该模型。

### 3. 网络连接问题
检查网络连接，确保可以访问DashScope服务。

## 从OpenAI迁移

如果你之前使用的是OpenAI版本，迁移步骤：

1. 更新依赖：`pip install -r requirements.txt`
2. 更新环境变量：将 `OPENAI_API_KEY` 改为 `DASHSCOPE_API_KEY`
3. 删除 `OPENAI_BASE_URL` 配置（不再需要）
4. 更新模型名称：将 `gpt-3.5-turbo` 改为 `qwen-turbo`
5. 重新启动服务

## 注意事项

- DashScope API的调用格式与OpenAI略有不同，但项目已做好适配
- 确保账号有足够的余额和API调用配额
- 建议先在测试环境验证配置正确性
- 生产环境使用时注意API Key的安全性 