// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.0.6
// @description  通过.chat命令与AI大语言模型交流，支持连续对话
// @license      Apache-2
// @homepageURL  https://github.com/sealdice/javascript
// ==/UserScript==

/*
AI聊天机器人插件 - 稳定版本
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接

需要配置后端API地址和密钥
*/

// 创建扩展
let ext = seal.ext.find('ai-chat');
if (!ext) {
  ext = seal.ext.new('ai-chat', 'Rene', '1.0.6');
  seal.ext.register(ext);
}

// 配置 - 可根据实际部署情况修改
const CONFIG = {
  API_BASE_URL: 'http://localhost:1478',  // FastAPI服务地址
  TIMEOUT: 30000,  // 请求超时时间（毫秒）
  MAX_RETRIES: 3,   // 最大重试次数
};

// 工具函数：获取用户ID
function getUserId(ctx) {
  if (ctx.player && ctx.player.userId) {
    return ctx.player.userId;
  }
  if (ctx.player && ctx.player.name) {
    return ctx.player.name;
  }
  return 'unknown';
}

// 工具函数：获取会话ID
function getConversationId(ctx) {
  if (ctx.group && ctx.group.groupId) {
    return `group_${ctx.group.groupId}`;
  }
  return 'private';
}

// 创建聊天指令
const cmdChat = seal.ext.newCmdItemInfo();
cmdChat.name = 'chat';
cmdChat.help = `AI聊天机器人 v1.0.6
使用方法：
.chat <消息> - 与AI对话
.chat help - 查看帮助信息
.chat test - 测试连接

示例：
.chat 你好
.chat test`;

cmdChat.solve = (ctx, msg, cmdArgs) => {
  const userId = getUserId(ctx);
  const conversationId = getConversationId(ctx);
  
  // 获取第一个参数
  const arg1 = cmdArgs.getArgN(1);
  
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
      // 健康检查
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
          seal.replyToSender(ctx, msg, '❌ 无法连接到AI服务，请检查网络和服务状态');
        }
      })();
      return seal.ext.newCmdExecuteResult(true);
    }
    
    default: {
      // 构建完整的用户消息 - 获取从第一个参数开始的所有内容
      let userMessage = '';
      let parts = [];
      for (let i = 1; i <= 20; i++) {
        const part = cmdArgs.getArgN(i);
        if (part) {
          parts.push(part);
        } else {
          break;
        }
      }
      userMessage = parts.join(' ').trim();
      
      if (!userMessage) {
        seal.replyToSender(ctx, msg, '请输入消息，例如：.chat 你好\n或使用 .chat test 测试连接');
        return seal.ext.newCmdExecuteResult(true);
      }
      
      if (userMessage.length > 2000) {
        seal.replyToSender(ctx, msg, '❌ 消息过长，请控制在2000字符以内');
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
          seal.replyToSender(ctx, msg, '❌ 无法连接到AI服务，请检查网络和服务状态');
        }
      })();
      
      return seal.ext.newCmdExecuteResult(true);
    }
  }
};

// 注册命令
ext.cmdMap['chat'] = cmdChat;

console.log('AI聊天机器人插件加载完成 v1.0.6');
console.log(`API地址: ${CONFIG.API_BASE_URL}`);
console.log('使用 .chat help 查看帮助信息');
console.log('使用 .chat test 测试连接');
