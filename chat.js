// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.1.0
// @description  通过.chat命令与AI大语言模型交流，支持连续对话
// @license      Apache-2
// ==/UserScript==

/*
AI聊天机器人插件 - 增强版本
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接

需要配置后端API地址和密钥
支持连续对话，AI能记住对话历史
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '1.1.0');
    seal.ext.register(ext);
  }

  // 配置 - 可根据实际部署情况修改
  const CONFIG = {
    API_BASE_URL: 'http://localhost:1478',  // FastAPI服务地址
    TIMEOUT: 30000,  // 请求超时时间（毫秒）
    MAX_RETRIES: 3,   // 最大重试次数
  };

  // 工具函数：安全的获取用户ID
  function getUserId(ctx) {
    try {
      if (!ctx || !ctx.player) return 'unknown';
      return ctx.player.userId || ctx.player.name || 'unknown';
    } catch (error) {
      console.log('获取用户ID失败:', error);
      return 'unknown';
    }
  }

  // 工具函数：安全的获取会话ID
  function getConversationId(ctx) {
    try {
      if (!ctx) return 'private';
      if (ctx.group && ctx.group.groupId) {
        return `group_${ctx.group.groupId}`;
      }
      return 'private';
    } catch (error) {
      console.log('获取会话ID失败:', error);
      return 'private';
    }
  }

  // 创建聊天指令
  const cmdChat = seal.ext.newCmdItemInfo();
  cmdChat.name = 'chat';
  cmdChat.help = `AI聊天机器人 v1.1.0 - 基于阿里云通义千问
  
基本功能：
.chat <消息> - 与AI对话，支持连续对话上下文
.chat help - 查看帮助信息
.chat test - 测试AI服务连接

使用示例：
.chat 你好，请介绍一下TRPG
.chat 帮我生成一个法师角色
.chat 解释一下DND5E的先攻规则

功能特性：
• 智能对话：AI能记住对话历史，提供连续对话
• 多用户支持：每个用户独立的对话上下文
• 群组支持：群组对话有独立的上下文记录
• TRPG专业：针对桌游场景优化的AI助手

技术支持：
• 后端：Python FastAPI + 阿里云DashScope
• 模型：通义千问系列（qwen-turbo/plus/max）
• 部署：支持开发和生产环境部署`;

  cmdChat.solve = (ctx, msg, cmdArgs) => {
    try {
      // 安全检查参数
      if (!ctx || !msg || !cmdArgs) {
        console.log('参数检查失败: ctx, msg 或 cmdArgs 为空');
        return seal.ext.newCmdExecuteResult(true);
      }

      const userId = getUserId(ctx);
      const conversationId = getConversationId(ctx);
      
      // 使用官方推荐的参数获取方式
      let arg1 = '';
      try {
        arg1 = cmdArgs.getArgN(1) || '';
      } catch (error) {
        console.log('获取参数失败:', error);
        arg1 = '';
      }
      
      switch (arg1) {
        case 'help':
        case '':
        case '帮助': {
          const ret = seal.ext.newCmdExecuteResult(true);
          ret.showHelp = true;
          return ret;
        }
        
        case 'test':
        case '测试': {
          seal.replyToSender(ctx, msg, '正在测试AI服务连接...');
          // 健康检查
          (async () => {
            try {
              const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
              if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'healthy') {
                  let statusMsg = 'AI服务连接成功！\n';
                  statusMsg += `服务状态：${data.status}\n`;
                  statusMsg += `API配置：${data.api_configured ? '已配置' : '未配置'}\n`;
                  if (data.warning) {
                    statusMsg += `警告：${data.warning}`;
                  }
                  seal.replyToSender(ctx, msg, statusMsg);
                } else {
                  seal.replyToSender(ctx, msg, 'AI服务状态异常，请检查后端配置');
                }
              } else {
                seal.replyToSender(ctx, msg, `无法连接AI服务：HTTP ${response.status}\n请检查后端服务是否正常运行`);
              }
            } catch (error) {
              console.log('连接测试错误:', error);
              seal.replyToSender(ctx, msg, `连接测试失败\n错误：${error.message}\n请检查：\n1. 后端服务是否启动\n2. API地址是否正确\n3. 网络连接是否正常`);
            }
          })();
          return seal.ext.newCmdExecuteResult(true);
        }
        
        default: {
          // 构建完整的用户消息
          let userMessage = '';
          try {
            // 获取除了第一个参数外的所有参数作为消息内容
            let parts = [];
            for (let i = 1; i <= 10; i++) { // 最多获取10个参数
              let part = cmdArgs.getArgN(i);
              if (part) {
                parts.push(part);
              } else {
                break;
              }
            }
            userMessage = parts.join(' ').trim();
          } catch (error) {
            console.log('消息解析失败:', error);
            seal.replyToSender(ctx, msg, '消息解析失败，请重试\n使用 .chat help 查看帮助信息');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          if (!userMessage) {
            seal.replyToSender(ctx, msg, '请输入消息内容\n\n使用示例：\n.chat 你好\n.chat test - 测试连接\n.chat help - 查看帮助');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          if (userMessage.length > 2000) {
            seal.replyToSender(ctx, msg, '消息过长，请控制在2000字符以内\n当前长度：' + userMessage.length);
            return seal.ext.newCmdExecuteResult(true);
          }
          
          // 发送聊天请求
          (async () => {
            try {
              const chatData = {
                user_id: userId,
                message: userMessage,
                conversation_id: conversationId
              };
              
              const response = await fetch(`${CONFIG.API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(chatData)
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data && data.success && data.reply) {
                  // 直接返回AI回复
                  seal.replyToSender(ctx, msg, data.reply);
                } else {
                  const errorMsg = (data && data.error) || '未知错误';
                  seal.replyToSender(ctx, msg, `AI回复失败：${errorMsg}\n\n建议：\n1. 检查API密钥配置\n2. 确认网络连接正常\n3. 使用 .chat test 测试服务`);
                }
              } else {
                let errorDetail = '';
                try {
                  const errorData = await response.json();
                  errorDetail = errorData.detail || errorData.error || response.statusText;
                } catch (e) {
                  errorDetail = response.statusText;
                }
                seal.replyToSender(ctx, msg, `AI服务错误（HTTP ${response.status}）：${errorDetail}\n\n请检查后端服务状态`);
              }
            } catch (error) {
              console.log('聊天请求错误:', error);
              let errorMsg = '无法连接到AI服务\n\n';
              if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMsg += '网络连接错误，请检查：\n';
                errorMsg += '1. 后端服务是否启动\n';
                errorMsg += '2. API地址是否正确\n';
                errorMsg += '3. 防火墙或网络限制';
              } else if (error.name === 'AbortError') {
                errorMsg += '请求超时，请稍后重试';
              } else {
                errorMsg += `错误详情：${error.message}`;
              }
              errorMsg += '\n\n使用 .chat test 测试连接';
              seal.replyToSender(ctx, msg, errorMsg);
            }
          })();
          
          return seal.ext.newCmdExecuteResult(true);
        }
      }
      
    } catch (error) {
      console.log('命令处理失败:', error);
      try {
        seal.replyToSender(ctx, msg, `命令处理失败：${error.message}\n请重试或使用 .chat help 查看帮助`);
      } catch (replyError) {
        console.log('回复失败:', replyError);
      }
      return seal.ext.newCmdExecuteResult(true);
    }
  };

  // 注册命令
  if (ext && ext.cmdMap) {
    ext.cmdMap['chat'] = cmdChat;
    console.log('AI聊天机器人插件加载完成 v1.1.0');
    console.log(`API地址: ${CONFIG.API_BASE_URL}`);
    console.log('功能特性:');
    console.log('- 支持连续对话和上下文记忆');
    console.log('- 多用户和群组独立对话');
    console.log('- 基于阿里云通义千问AI模型');
    console.log('使用方法:');
    console.log('- .chat <消息> - 与AI对话');
    console.log('- .chat test - 测试连接');
    console.log('- .chat help - 查看帮助');
  } else {
    throw new Error('无法注册命令');
  }
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
