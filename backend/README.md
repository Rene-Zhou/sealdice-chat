# SealDice Chat Backend

SealDice Chat 后端API服务，基于FastAPI构建，集成阿里云DashScope AI服务。

## 功能特性

- FastAPI Web框架
- 阿里云DashScope AI服务集成
- Pydantic数据验证
- 环境变量配置管理
- PM2生产环境部署支持

## 环境要求

- Python 3.13+
- uv包管理器

## 快速开始 & 生产部署

参考 [README.md](../README.md)

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

## 支持的模型

- `qwen-turbo` - 通义千问Turbo（推荐，性价比高）
- `qwen-plus` - 通义千问Plus（平衡版本）
- `qwen-max` - 通义千问Max（最强性能）
- `qwen-max-longcontext` - 通义千问Max长文本版

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

## 开发工具

```bash
# 运行测试
uv run pytest

# 代码格式化
uv run black .
uv run isort .

# 代码检查
uv run flake8 .
```

## API文档

启动服务后，可以访问以下地址查看API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
backend/
├── main.py              # 主应用入口
├── config.py            # 配置管理
├── pyproject.toml       # 项目配置和依赖
├── uv.lock              # 依赖锁定文件
├── .python-version      # Python版本声明
├── env_example.txt      # 环境变量示例
├── pm2.config.js        # PM2配置文件（生产环境）
├── run_prod_uv.sh       # 生产环境启动脚本
└── logs/                # 日志目录
```

## 依赖管理

本项目使用uv进行依赖管理，主要依赖包括：

- **fastapi**: Web框架
- **uvicorn**: ASGI服务器
- **dashscope**: 阿里云AI服务SDK
- **pydantic**: 数据验证
- **python-multipart**: 文件上传支持
- **python-dotenv**: 环境变量管理

## 故障排除

### API Key无效
确保在DashScope控制台正确生成API Key，并检查余额和权限。

### 模型不存在
检查模型名称是否正确，确保账号有权限访问该模型。

### 网络连接问题
检查网络连接，确保可以访问DashScope服务。

## 注意事项

- 确保账号有足够的余额和API调用配额
- 建议先在测试环境验证配置正确性
- 生产环境使用时注意API Key的安全性
