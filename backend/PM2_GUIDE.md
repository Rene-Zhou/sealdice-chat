# PM2 管理 FastAPI 应用指南

## 安装 PM2

```bash
# 如果没有安装Node.js，先安装
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
npm install -g pm2
```

## 使用方法

### 方法一：使用配置文件启动（推荐）

```bash
# 启动应用
pm2 start pm2.config.js

# 或者指定环境
pm2 start pm2.config.js --env production
```

### 方法二：直接命令启动

```bash
# 启动FastAPI应用
pm2 start uvicorn --name "seal-dice-chatbot" --interpreter python3 -- main:app --host 0.0.0.0 --port 1478

# 或者使用生产环境脚本
pm2 start run_prod.py --name "seal-dice-chatbot" --interpreter python3
```

## 常用PM2命令

```bash
# 查看所有应用状态
pm2 status

# 查看应用详细信息
pm2 show seal-dice-chatbot

# 查看日志
pm2 logs seal-dice-chatbot

# 实时日志
pm2 logs seal-dice-chatbot --lines 100

# 重启应用
pm2 restart seal-dice-chatbot

# 停止应用
pm2 stop seal-dice-chatbot

# 删除应用
pm2 delete seal-dice-chatbot

# 保存当前PM2配置
pm2 save

# 开机自启动
pm2 startup
```

## 监控

```bash
# PM2监控面板
pm2 monit

# 查看CPU和内存使用情况
pm2 show seal-dice-chatbot
```

## 日志管理

```bash
# 清空日志
pm2 flush

# 安装日志轮转
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 配置说明

`pm2.config.js` 文件包含了以下关键配置：

- **name**: 应用名称
- **script**: 启动脚本（uvicorn）
- **args**: 传递给uvicorn的参数
- **interpreter**: Python解释器
- **autorestart**: 自动重启
- **max_restarts**: 最大重启次数
- **max_memory_restart**: 内存达到限制时重启
- **log_file**: 日志文件路径

## 生产环境建议

1. 使用配置文件方式启动
2. 配置日志轮转
3. 设置开机自启动
4. 定期监控应用状态
5. 合理设置内存限制 