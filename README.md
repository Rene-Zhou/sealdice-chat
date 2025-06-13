# 海豹骰AI聊天机器人插件

这是一个为海豹骰开发的AI聊天机器人插件，采用前后端分离架构，支持通过`.chat`命令与AI大语言模型进行交流。

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
├── chat.js                # 海豹JS插件主文件
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
   # 参考env_example.txt中的配置说明
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

## 配置

详细配置说明请参考 `backend/env_example.txt` 文件。

## AI服务

本插件使用阿里云DashScope API。

获取API密钥：[阿里云DashScope控制台](https://dashscope.console.aliyun.com/)

## 部署

开发环境：`python main.py`
生产环境：使用PM2或其他进程管理工具

## 许可证

Apache-2.0 License

## 相关文档
- [DashScope配置指南](backend/README_DASHSCOPE.md) - DashScope API配置详解
- [PM2部署指南](backend/PM2_GUIDE.md) - 生产环境部署说明