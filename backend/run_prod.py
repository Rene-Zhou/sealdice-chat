#!/usr/bin/env python3
"""
生产环境启动脚本 - 用于pm2管理
"""

import uvicorn
from main import app
from config import config

if __name__ == "__main__":
    # 生产环境配置
    uvicorn.run(
        app,
        host=config.HOST,
        port=config.PORT,
        log_level="info",
        access_log=True,
        # 不使用reload，因为pm2会管理重启
        reload=False
    ) 