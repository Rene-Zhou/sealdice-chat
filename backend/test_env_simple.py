#!/usr/bin/env python3
"""
简单的.env配置测试工具
"""

import os
from dotenv import load_dotenv

def test_env_config():
    """测试.env配置"""
    print("🔧 测试 .env 配置")
    print("=" * 30)
    
    # 加载.env文件
    load_dotenv()
    
    # 检查.env文件是否存在
    if not os.path.exists('.env'):
        print("❌ .env 文件不存在")
        print("请根据 env_example.txt 创建 .env 文件")
        return False
    
    print("✅ .env 文件存在")
    
    # 检查必需的环境变量
    required_vars = ['DASHSCOPE_API_KEY']
    optional_vars = ['DASHSCOPE_MODEL', 'HOST', 'PORT']
    
    print("\n📋 环境变量检查:")
    
    all_good = True
    
    # 检查必需变量
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: 已设置")
        else:
            print(f"❌ {var}: 未设置")
            all_good = False
    
    # 检查可选变量  
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value}")
        else:
            print(f"⚠️  {var}: 使用默认值")
    
    # 测试配置加载
    print("\n🔄 测试配置加载:")
    try:
        from config import config
        print(f"✅ 配置加载成功")
        print(f"   - API Key: {'已设置' if config.DASHSCOPE_API_KEY else '未设置'}")
        print(f"   - Model: {config.DASHSCOPE_MODEL}")
    except Exception as e:
        print(f"❌ 配置加载失败: {e}")
        all_good = False
    
    # 结果
    print("\n" + "=" * 30)
    if all_good:
        print("🎉 配置测试通过！")
        return True
    else:
        print("❌ 配置存在问题")
        return False

if __name__ == "__main__":
    test_env_config() 