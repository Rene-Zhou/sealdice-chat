// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.0.5
// @description  通过.chat命令与AI大语言模型交流，支持连续对话
// @license      Apache-2
// @homepageURL  https://github.com/sealdice/javascript
// ==/UserScript==

/*
AI聊天机器人插件 - 修复版本
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接

需要配置后端API地址和密钥
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '1.0.5');
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
  cmdChat.help = `AI聊天机器人 v1.0.5
使用方法：
.chat <消息> - 与AI对话
.chat help - 查看帮助信息
.chat test - 测试连接

示例：
.chat 你好
.chat test`;

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
          seal.replyToSender(ctx, msg, '🧪 正在测试连接...');
          // 简化的健康检查
          (async () => {
            try {
              const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
              if (response.ok) {
                const data = await response.json();
                if (data && data.status === 'healthy') {
                  seal.replyToSender(ctx, msg, '✅ 连接测试成功！AI服务正常');
                } else {
                  seal.replyToSender(ctx, msg, '❌ 连接测试失败: 服务状态异常');
                }
              } else {
                seal.replyToSender(ctx, msg, `❌ 连接测试失败: HTTP ${response.status}`);
              }
            } catch (error) {
              console.log('连接测试错误:', error);
              seal.replyToSender(ctx, msg, '❌ 无法连接到AI服务，请检查网络和服务状态');
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
            seal.replyToSender(ctx, msg, '❌ 消息解析失败，请重试');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          if (!userMessage) {
            seal.replyToSender(ctx, msg, '请输入消息，例如：.chat 你好\n或使用 .chat test 测试连接');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          if (userMessage.length > 2000) {
            seal.replyToSender(ctx, msg, '❌ 消息过长，请控制在2000字符以内');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          seal.replyToSender(ctx, msg, '🤔 AI正在思考中...');
          
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
                  const aiReply = `🤖 ${data.reply}`;
                  seal.replyToSender(ctx, msg, aiReply);
                } else {
                  const errorMsg = (data && data.error) || '未知错误';
                  seal.replyToSender(ctx, msg, `❌ AI回复失败: ${errorMsg}`);
                }
              } else {
                seal.replyToSender(ctx, msg, `❌ AI服务错误: HTTP ${response.status}`);
              }
            } catch (error) {
              console.log('聊天请求错误:', error);
              seal.replyToSender(ctx, msg, '❌ 无法连接到AI服务，请检查网络和服务状态');
            }
          })();
          
          return seal.ext.newCmdExecuteResult(true);
        }
      }
      
    } catch (error) {
      console.log('命令处理失败:', error);
      try {
        seal.replyToSender(ctx, msg, '❌ 命令处理失败，请重试');
      } catch (replyError) {
        console.log('回复失败:', replyError);
      }
      return seal.ext.newCmdExecuteResult(true);
    }
  };

  // 注册命令
  if (ext && ext.cmdMap) {
    ext.cmdMap['chat'] = cmdChat;
    console.log('AI聊天机器人插件加载完成 v1.0.5');
    console.log(`API地址: ${CONFIG.API_BASE_URL}`);
    console.log('使用 .chat help 查看帮助信息');
    console.log('使用 .chat test 测试连接');
  } else {
    throw new Error('无法注册命令');
  }
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
