// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.0.4
// @description  通过.chat命令与AI大语言模型交流，支持连续对话
// @license      Apache-2
// @homepageURL  https://github.com/sealdice/javascript
// ==/UserScript==

/*
AI聊天机器人插件 - 最终版本
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息

需要配置后端API地址和密钥
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '1.0.4');
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
      return 'private';
    }
  }

  // HTTP请求函数 - 使用异步Promise方式
  function sendRequest(ctx, msg, url, method, data, isHealthCheck = false) {
    try {
      const options = {
        method: method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (data && method === 'POST') {
        options.body = JSON.stringify(data);
      }

      // 使用fetch的Promise链式调用
      fetch(url, options).then(response => {
        if (!response.ok) {
          if (isHealthCheck) {
            seal.replyToSender(ctx, msg, `❌ 连接测试失败: HTTP ${response.status}`);
          } else {
            seal.replyToSender(ctx, msg, `❌ AI服务错误: HTTP ${response.status}`);
          }
          return;
        }
        
        response.json().then(data => {
          if (isHealthCheck) {
            // 健康检查响应
            if (data && data.status === 'healthy') {
              seal.replyToSender(ctx, msg, '✅ 连接测试成功！AI服务正常');
            } else {
              seal.replyToSender(ctx, msg, '❌ 连接测试失败: 服务状态异常');
            }
          } else {
            // 聊天响应
            if (data && data.success && data.reply) {
              const aiReply = `🤖 ${data.reply}`;
              seal.replyToSender(ctx, msg, aiReply);
            } else {
              const errorMsg = (data && data.error) || '未知错误';
              seal.replyToSender(ctx, msg, `❌ AI回复失败: ${errorMsg}`);
            }
          }
        }).catch(jsonError => {
          if (isHealthCheck) {
            seal.replyToSender(ctx, msg, '❌ 连接测试失败: 响应格式错误');
          } else {
            seal.replyToSender(ctx, msg, '❌ AI回复失败: 响应格式错误');
          }
        });
        
      }).catch(fetchError => {
        if (isHealthCheck) {
          seal.replyToSender(ctx, msg, '❌ 连接测试失败: 网络错误');
        } else {
          seal.replyToSender(ctx, msg, '❌ 无法连接到AI服务，请检查网络和服务状态');
        }
      });
      
    } catch (error) {
      if (isHealthCheck) {
        seal.replyToSender(ctx, msg, '❌ 连接测试异常');
      } else {
        seal.replyToSender(ctx, msg, '❌ 请求异常，请重试');
      }
    }
  }

  // 创建聊天指令
  const cmdChat = seal.ext.newCmdItemInfo();
  if (!cmdChat) {
    throw new Error('无法创建命令对象');
  }
  
  cmdChat.name = 'chat';
  cmdChat.help = `AI聊天机器人 v1.0.4
使用方法：
.chat <消息> - 与AI对话
.chat help - 查看帮助信息
.chat test - 测试连接

示例：
.chat 你好
.chat test`;

  cmdChat.solve = function(ctx, msg, cmdArgs) {
    try {
      if (!ctx || !msg || !cmdArgs) {
        return seal.ext.newCmdExecuteResult(true);
      }

      const userId = getUserId(ctx);
      const conversationId = getConversationId(ctx);
      
      let arg1 = '';
      try {
        arg1 = cmdArgs.getArgN(1) || '';
      } catch (error) {
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
          sendRequest(ctx, msg, `${CONFIG.API_BASE_URL}/health`, 'GET', null, true);
          return seal.ext.newCmdExecuteResult(true);
        }
        
        default: {
          let userMessage = '';
          try {
            // 根据实际测试结果，使用 cleanArgs 或 rawArgs
            userMessage = cmdArgs.cleanArgs || cmdArgs.rawArgs || '';
            userMessage = userMessage.trim();
          } catch (error) {
            seal.replyToSender(ctx, msg, '❌ 消息解析失败');
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
          
          const chatData = {
            user_id: userId,
            message: userMessage,
            conversation_id: conversationId
          };
          
          sendRequest(ctx, msg, `${CONFIG.API_BASE_URL}/chat`, 'POST', chatData, false);
          
          return seal.ext.newCmdExecuteResult(true);
        }
      }
      
    } catch (error) {
      try {
        seal.replyToSender(ctx, msg, '❌ 命令处理失败，请重试');
      } catch (replyError) {
        // 静默处理回复错误
      }
      return seal.ext.newCmdExecuteResult(true);
    }
  };

  // 注册命令
  if (ext && ext.cmdMap) {
    ext.cmdMap['chat'] = cmdChat;
  } else {
    throw new Error('无法注册命令');
  }

  // 插件加载完成提示
  console.log('AI聊天机器人插件加载完成 v1.0.4');
  console.log(`API地址: ${CONFIG.API_BASE_URL}`);
  console.log('使用 .chat help 查看帮助信息');
  console.log('使用 .chat test 测试连接');
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
