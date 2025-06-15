# 5e.tools RAG系统部署指南

## 概述

本项目集成了基于阿里云text-embedding-v4和LangChain的5e.tools RAG系统，为AI聊天机器人提供专业的DND5E规则查询能力。

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp env_example.txt .env
# 编辑.env文件，填入你的DASHSCOPE_API_KEY
```

### 2. 首次运行

```bash
# 启动服务
python main.py
```

首次运行时，系统会自动：
1. 同步5e.tools数据（~100MB）
2. 处理数据并构建向量索引
3. 初始化RAG查询引擎

这个过程可能需要5-10分钟，请耐心等待。

### 3. 验证部署

访问 `http://localhost:1478` 查看API状态：

```json
{
  "message": "海豹骰子聊天机器人API v2.1.0 - 支持定时任务与RAG知识库",
  "status": "运行中",
  "features": ["聊天对话", "定时任务", "DND5E规则查询", "RAG知识库"],
  "rag_status": "已启用"
}
```

## RAG功能说明

### 自动检测

系统会自动检测包含以下关键词的消息，并启用RAG增强：
- 法术相关：`法术`、`spell`、`咒语`、`魔法`
- 怪物相关：`怪物`、`monster`、`敌人`、`生物`
- 职业相关：`职业`、`class`、`战士`、`法师`、`牧师`
- 种族相关：`种族`、`race`、`精灵`、`矮人`、`人类`
- 装备相关：`物品`、`装备`、`武器`、`护甲`
- 规则相关：`规则`、`先攻`、`豁免`、`检定`、`dnd`、`d&d`

### 示例对话

**用户**: "火球术这个法术怎么样？"

**AI**: "火球术是一个3环塑能系法术...

📚 参考来源: 火球术 (3环塑能系法术), 法术列表"

## API端点

### RAG状态查询

```http
GET /rag/status
```

响应：
```json
{
  "status": "运行中",
  "vector_count": 15432,
  "last_update": "2024-01-15",
  "model_version": "text-embedding-v4"
}
```

### 更新知识库

```http
POST /rag/update
```

响应：
```json
{
  "success": true,
  "documents_processed": 1248,
  "vectors_created": 15432
}
```

## 目录结构

```
backend/
├── rag/                    # RAG系统核心
│   ├── vector_store.py    # 向量存储
│   └── query_engine.py    # 查询引擎
├── processors/            # 数据处理
│   └── data_processor.py  # 5e.tools数据处理器
├── scripts/              # 工具脚本
│   └── sync_5etools_data.py # 数据同步
├── utils/                # 工具模块
│   └── cost_monitor.py   # 成本监控
├── 5etools-data/         # 5e.tools数据（自动创建）
├── chroma_db/            # 向量数据库（自动创建）
└── rag_costs.json        # 成本日志（自动创建）
```

## 成本说明

- **模型**: text-embedding-v4
- **定价**: ¥0.0005/千Token
- **免费额度**: 100万Token/月
- **预估月度成本**: <¥20（正常使用）

系统会自动记录API使用情况到 `rag_costs.json` 文件。

## 故障排除

### 常见问题

1. **RAG系统未初始化**
   - 检查网络连接是否正常
   - 确认DASHSCOPE_API_KEY配置正确
   - 查看启动日志中的错误信息

2. **数据同步失败**
   - 检查网络连接
   - 确保有足够的磁盘空间（~200MB）
   - 删除 `5etools-data` 目录后重试

3. **向量索引构建失败**
   - 检查内存使用情况（建议4GB以上）
   - 确认API配额充足
   - 删除 `chroma_db` 目录后重试

### 日志查看

```bash
# 查看启动日志
python main.py

# 查看成本日志
cat rag_costs.json
```

## 配置优化

### 内存优化

如果内存不足，可以调整以下配置：

```env
# 减少批处理大小和上下文长度
RAG_MAX_CONTEXT_LENGTH=2000
RAG_MAX_RESULTS=5
```

### 精度优化

如果需要更高的查询精度：

```env
# 降低相似度阈值
RAG_SIMILARITY_THRESHOLD=0.4
# 增加结果数量
RAG_MAX_RESULTS=15
```

## 更新维护

### 数据更新

5e.tools数据会不定期更新，建议每月更新一次：

```bash
# 通过API更新
curl -X POST http://localhost:1478/rag/update
```

### 系统维护

- 定期清理日志文件
- 监控磁盘空间使用
- 检查API使用配额

## 技术支持

如有问题，请检查：
1. 配置文件是否正确
2. 依赖是否完整安装
3. API密钥是否有效
4. 网络连接是否正常
