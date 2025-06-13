#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
.env配置测试工具
用于验证环境变量配置是否正确
"""

import os
import sys
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import dashscope
from dashscope import Generation
from config import config

class Colors:
    """终端颜色输出"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header():
    """打印工具标题"""
    print(f"{Colors.BOLD}{Colors.BLUE}=" * 50)
    print("🔧 .env 配置测试工具")
    print("=" * 50 + Colors.END)
    print()

def check_file_exists() -> bool:
    """检查.env文件是否存在"""
    print(f"{Colors.BOLD}1. 检查 .env 文件{Colors.END}")
    if os.path.exists('.env'):
        print(f"   {Colors.GREEN}✓ .env 文件存在{Colors.END}")
        return True
    else:
        print(f"   {Colors.RED}✗ .env 文件不存在{Colors.END}")
        print(f"   {Colors.YELLOW}请根据 env_example.txt 创建 .env 文件{Colors.END}")
        return False

def check_required_vars() -> Dict[str, Any]:
    """检查必需的环境变量"""
    print(f"\n{Colors.BOLD}2. 检查环境变量{Colors.END}")
    
    # 必需的环境变量
    required_vars = {
        'DASHSCOPE_API_KEY': {
            'required': True,
            'description': 'DashScope API密钥'
        }
    }
    
    # 可选的环境变量
    optional_vars = {
        'DASHSCOPE_MODEL': {
            'required': False,
            'description': 'DashScope模型名称',
            'default': 'qwen-turbo'
        },
        'HOST': {
            'required': False,
            'description': '服务器主机地址',
            'default': '0.0.0.0'
        },
        'PORT': {
            'required': False,
            'description': '服务器端口',
            'default': '1478'
        },
        'MAX_CONVERSATION_HISTORY': {
            'required': False,
            'description': '最大对话历史条数',
            'default': '20'
        },
        'MAX_MESSAGE_LENGTH': {
            'required': False,
            'description': '最大消息长度',
            'default': '2000'
        }
    }
    
    results = {}
    
    # 检查必需变量
    for var_name, var_info in required_vars.items():
        value = os.getenv(var_name)
        if value:
            print(f"   {Colors.GREEN}✓ {var_name}: {'*' * min(8, len(value))}...{Colors.END}")
            results[var_name] = {'status': 'ok', 'value': value}
        else:
            print(f"   {Colors.RED}✗ {var_name}: 未设置{Colors.END}")
            print(f"     {Colors.YELLOW}描述: {var_info['description']}{Colors.END}")
            results[var_name] = {'status': 'missing', 'value': None}
    
    # 检查可选变量
    for var_name, var_info in optional_vars.items():
        value = os.getenv(var_name)
        if value:
            print(f"   {Colors.GREEN}✓ {var_name}: {value}{Colors.END}")
            results[var_name] = {'status': 'ok', 'value': value}
        else:
            default_value = var_info['default']
            print(f"   {Colors.YELLOW}~ {var_name}: 使用默认值 ({default_value}){Colors.END}")
            results[var_name] = {'status': 'default', 'value': default_value}
    
    return results

def check_config_loading() -> bool:
    """检查配置加载是否正常"""
    print(f"\n{Colors.BOLD}3. 检查配置加载{Colors.END}")
    
    try:
        # 测试配置对象
        print(f"   {Colors.GREEN}✓ Config类加载成功{Colors.END}")
        print(f"   - API Key: {'设置' if config.DASHSCOPE_API_KEY else '未设置'}")
        print(f"   - Model: {config.DASHSCOPE_MODEL}")
        print(f"   - Host: {config.HOST}")
        print(f"   - Port: {config.PORT}")
        return True
    except Exception as e:
        print(f"   {Colors.RED}✗ 配置加载失败: {e}{Colors.END}")
        return False

def test_dashscope_connection() -> bool:
    """测试DashScope API连接"""
    print(f"\n{Colors.BOLD}4. 测试 DashScope API 连接{Colors.END}")
    
    if not config.DASHSCOPE_API_KEY:
        print(f"   {Colors.YELLOW}⚠ 跳过API测试（API Key未设置）{Colors.END}")
        return False
    
    try:
        # 设置API Key
        dashscope.api_key = config.DASHSCOPE_API_KEY
        
        print(f"   🔄 正在测试API连接...")
        
        # 发送测试请求
        response = Generation.call(
            model=config.DASHSCOPE_MODEL,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=10,
            result_format='message'
        )
        
        if response.status_code == 200:
            print(f"   {Colors.GREEN}✓ API连接成功{Colors.END}")
            print(f"   - 模型: {config.DASHSCOPE_MODEL}")
            print(f"   - 响应: {response.output.choices[0].message.content.strip()}")
            return True
        else:
            print(f"   {Colors.RED}✗ API调用失败: {response.message}{Colors.END}")
            return False
        
    except Exception as e:
        print(f"   {Colors.RED}✗ API连接失败: {e}{Colors.END}")
        return False

def print_summary(results: Dict[str, Any], config_ok: bool, api_ok: bool):
    """打印测试结果摘要"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}=" * 50)
    print("📊 测试结果摘要")
    print("=" * 50 + Colors.END)
    
    # 统计结果
    missing_count = sum(1 for r in results.values() if r['status'] == 'missing')
    total_required = 1  # 只有DASHSCOPE_API_KEY是必需的
    
    if missing_count == 0:
        print(f"{Colors.GREEN}✓ 所有必需的环境变量已设置{Colors.END}")
    else:
        print(f"{Colors.RED}✗ {missing_count}/{total_required} 个必需变量未设置{Colors.END}")
    
    if config_ok:
        print(f"{Colors.GREEN}✓ 配置加载正常{Colors.END}")
    else:
        print(f"{Colors.RED}✗ 配置加载失败{Colors.END}")
    
    if api_ok:
        print(f"{Colors.GREEN}✓ DashScope API连接正常{Colors.END}")
    elif config.DASHSCOPE_API_KEY:
        print(f"{Colors.RED}✗ DashScope API连接失败{Colors.END}")
    else:
        print(f"{Colors.YELLOW}~ DashScope API未测试（API Key未设置）{Colors.END}")
    
    # 总体状态
    print()
    if missing_count == 0 and config_ok and (api_ok or not config.DASHSCOPE_API_KEY):
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 配置测试通过！项目可以正常运行。{Colors.END}")
        return True
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ 配置存在问题，请检查上述错误。{Colors.END}")
        return False

def main():
    """主函数"""
    print_header()
    
    # 加载.env文件
    load_dotenv()
    
    # 执行测试
    file_exists = check_file_exists()
    if not file_exists:
        print(f"\n{Colors.RED}{Colors.BOLD}测试中止：.env文件不存在{Colors.END}")
        sys.exit(1)
    
    results = check_required_vars()
    config_ok = check_config_loading()
    api_ok = test_dashscope_connection()
    
    # 打印摘要
    success = print_summary(results, config_ok, api_ok)
    
    # 退出代码
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 