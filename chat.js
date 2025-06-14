// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.2.0
// @description  群组共享对话历史的AI聊天机器人，支持用户识别
// @license      Apache-2
// ==/UserScript==

/*
AI聊天机器人插件 - 群组共享版本
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接
- .chat clear - 清除对话历史
- .chat list - 查看对话列表

特性：
- 群组内所有成员共享对话历史
- AI能识别不同用户的发言
- 私聊时每个用户独立历史
- 支持连续对话上下文
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '1.2.0');
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

  // 工具函数：安全的获取用户名
  function getUserName(ctx, msg) {
    try {
      if (!ctx) {
        console.log('getUserName: ctx为空');
        return 'unknown';
      }
      
      // 优先从消息发送者中获取昵称
      if (msg && msg.sender && msg.sender.nickname) {
        const senderNickname = msg.sender.nickname;
        console.log(`getUserName: 从消息发送者获取昵称: "${senderNickname}"`);
        return senderNickname;
      }
      
      // 如果没有ctx.player，返回unknown
      if (!ctx.player) {
        console.log('getUserName: ctx.player为空');
        return 'unknown';
      }
      
      // 尝试获取用户名，打印调试信息
      const playerName = ctx.player.name;
      const playerId = ctx.player.userId;
      console.log(`getUserName: 玩家信息 - name: "${playerName}", userId: "${playerId}"`);
      
      // 尝试通过海豹的格式化功能获取用户名
      try {
        const formattedName = seal.format(ctx, '{$t玩家}');
        console.log(`getUserName: 格式化名称: "${formattedName}"`);
        if (formattedName && formattedName !== '{$t玩家}' && formattedName !== playerName) {
          return formattedName;
        }
      } catch (formatError) {
        console.log('getUserName: 格式化获取名称失败:', formatError);
      }
      
      return playerName || 'unknown';
    } catch (error) {
      console.log('获取用户名失败:', error);
      return 'unknown';
    }
  }

  // 创建聊天指令
  const cmdChat = seal.ext.newCmdItemInfo();
  cmdChat.name = 'chat';
  cmdChat.help = `AI聊天机器人 v1.2.0 - 基于阿里云通义千问
  
基本功能：
.chat <消息> - 与AI对话，支持连续对话上下文
.chat help - 查看帮助信息
.chat test - 测试AI服务连接

历史管理：
.chat clear - 清除当前会话的对话历史
.chat list - 查看所有对话列表和统计

使用示例：
.chat 你好，请介绍一下TRPG
.chat 帮我生成一个法师角色
.chat 解释一下DND5E的先攻规则
.chat clear - 清除历史重新开始
.chat list - 查看所有对话

功能特性：
• 智能对话：AI能记住对话历史，提供连续对话
• 群组共享：同一群组所有成员共享对话历史
• 用户识别：AI能识别不同用户的发言
• 历史管理：支持清除对话历史和查看对话列表
• TRPG专业：针对桌游场景优化的AI助手

工作原理：
• 群组内所有成员共享同一个对话历史记录
• 每个用户的消息都会标记用户身份
• 私聊时每个用户有独立的对话历史
• AI能够区分和回应不同用户的消息

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

        case 'clear':
        case '清除':
        case '清除历史': {
          seal.replyToSender(ctx, msg, '正在清除对话历史...');
          // 清除对话历史
          (async () => {
            try {
              const conversationId = getConversationId(ctx);
              const clearData = {
                conversation_id: conversationId
              };
              
              const response = await fetch(`${CONFIG.API_BASE_URL}/clear_history`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(clearData)
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data && data.success) {
                  seal.replyToSender(ctx, msg, `✅ ${data.message || '对话历史已清除'}\n\n现在可以开始新的对话了！`);
                } else {
                  const errorMsg = (data && data.message) || '清除失败';
                  seal.replyToSender(ctx, msg, `❌ 清除历史失败：${errorMsg}`);
                }
              } else {
                seal.replyToSender(ctx, msg, `❌ 清除历史失败：HTTP ${response.status}\n请检查后端服务状态`);
              }
            } catch (error) {
              console.log('清除历史错误:', error);
              seal.replyToSender(ctx, msg, `❌ 清除历史失败\n错误：${error.message}\n请检查网络连接和后端服务`);
            }
          })();
          return seal.ext.newCmdExecuteResult(true);
        }

        case 'list':
        case '列表':
        case '对话列表': {
          seal.replyToSender(ctx, msg, '正在获取对话列表...');
          // 获取对话列表
          (async () => {
            try {
              const response = await fetch(`${CONFIG.API_BASE_URL}/conversations`);
              
              if (response.ok) {
                const data = await response.json();
                if (data && data.conversations) {
                  const conversations = data.conversations;
                  if (Object.keys(conversations).length === 0) {
                    seal.replyToSender(ctx, msg, '📋 暂无对话记录\n\n使用 .chat <消息> 开始新的对话');
                  } else {
                    let listMsg = '📋 所有对话列表：\n\n';
                    for (const [convId, messageCount] of Object.entries(conversations)) {
                      let displayName = convId;
                      if (convId === 'private') {
                        displayName = '私聊';
                      } else if (convId.startsWith('group_')) {
                        displayName = `群组 ${convId.replace('group_', '')}`;
                      }
                      listMsg += `• ${displayName}: ${messageCount} 条消息\n`;
                    }
                    listMsg += '\n💡 使用 .chat clear 可以清除当前对话历史';
                    seal.replyToSender(ctx, msg, listMsg);
                  }
                } else {
                  seal.replyToSender(ctx, msg, '❌ 获取对话列表失败：响应格式错误');
                }
              } else {
                seal.replyToSender(ctx, msg, `❌ 获取对话列表失败：HTTP ${response.status}\n请检查后端服务状态`);
              }
            } catch (error) {
              console.log('获取对话列表错误:', error);
              seal.replyToSender(ctx, msg, `❌ 获取对话列表失败\n错误：${error.message}\n请检查网络连接和后端服务`);
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
              const userId = getUserId(ctx);
              const userName = getUserName(ctx, msg);
              const conversationId = getConversationId(ctx);
              
              const chatData = {
                user_id: userId,
                user_name: userName,
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
    console.log('AI聊天机器人插件加载完成 v1.2.0');
    console.log(`API地址: ${CONFIG.API_BASE_URL}`);
    console.log('功能特性:');
    console.log('- 群组内所有成员共享对话历史');
    console.log('- AI能识别不同用户的发言');
    console.log('- 私聊时每个用户独立历史');
    console.log('- 支持连续对话和上下文记忆');
    console.log('- 基于阿里云通义千问AI模型');
    console.log('使用方法:');
    console.log('- .chat <消息> - 与AI对话');
    console.log('- .chat test - 测试连接');
    console.log('- .chat clear - 清除当前会话历史');
    console.log('- .chat list - 查看所有对话列表');
    console.log('- .chat help - 查看帮助');
  } else {
    throw new Error('无法注册命令');
  }
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
