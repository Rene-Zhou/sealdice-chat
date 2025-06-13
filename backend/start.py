#!/usr/bin/env python3
"""
海豹骰子聊天机器人后端启动脚本
"""

import sys
import os
import subprocess
from pathlib import Path

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 8):
        print("❌ 需要Python 3.8或更高版本")
        sys.exit(1)
    print(f"✅ Python版本: {sys.version}")

def install_dependencies():
    """安装依赖"""
    print("📦 安装依赖包...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ 依赖安装完成")
    except subprocess.CalledProcessError as e:
        print(f"❌ 依赖安装失败: {e}")
        sys.exit(1)

def check_env_file():
    """检查环境变量文件"""
    env_file = Path(".env")
    env_example = Path("env_example.txt")
    
    if not env_file.exists():
        if env_example.exists():
            print("⚠️  未找到.env文件，请复制env_example.txt为.env并配置相关参数")
            print("   特别是OPENAI_API_KEY等关键配置")
        else:
            print("⚠️  未找到环境配置文件")
        return False
    
    # 检查是否有API密钥
    try:
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'your_openai_api_key_here' in content:
                print("⚠️  请在.env文件中配置正确的API密钥")
                return False
    except Exception as e:
        print(f"⚠️  读取.env文件失败: {e}")
        return False
    
    print("✅ 环境配置文件检查通过")
    return True

def start_server():
    """启动服务器"""
    print("🚀 启动FastAPI服务器...")
    try:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=1478, reload=True)
    except ImportError:
        print("❌ uvicorn未安装，请先安装依赖")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        sys.exit(1)

def main():
    """主函数"""
    print("🎲 海豹骰子聊天机器人后端")
    print("=" * 40)
    
    check_python_version()
    
    # 询问是否安装依赖
    install_deps = input("是否需要安装/更新依赖包? (y/N): ").lower().strip()
    if install_deps in ['y', 'yes']:
        install_dependencies()
    
    # 检查环境配置
    env_ok = check_env_file()
    if not env_ok:
        choice = input("是否继续启动服务? (y/N): ").lower().strip()
        if choice not in ['y', 'yes']:
            print("退出启动")
            sys.exit(0)
    
    # 启动服务
    start_server()

if __name__ == "__main__":
    main() 