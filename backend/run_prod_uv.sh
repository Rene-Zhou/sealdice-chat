#!/bin/bash

# SealDice Chat Backend 生产环境启动脚本 (使用uv)

echo "启动 SealDice Chat Backend 生产服务器..."

# 检查虚拟环境是否存在
if [ ! -d ".venv" ]; then
    echo "[ERROR] 虚拟环境不存在，请先运行: uv venv"
    exit 1
fi

# 检查依赖是否已安装
if ! uv run python -c "import fastapi" 2>/dev/null; then
    echo "安装项目依赖..."
    uv pip install -e .
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "[ERROR] 环境变量文件不存在，请复制 env_example.txt 为 .env 并配置"
    if [ -f "env_example.txt" ]; then
        cp env_example.txt .env
        echo "已复制 env_example.txt 为 .env"
    fi
fi

echo "启动生产服务器..."
echo "API文档地址: http://localhost:1478/docs"

# 启动生产服务器
uv run uvicorn main:app --host 0.0.0.0 --port 1478 --log-level info 