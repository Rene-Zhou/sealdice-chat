// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.0.0
// @description  通过.chat命令与AI大语言模型交流，支持连续对话
// @timestamp    1718281200
// @license      Apache-2
// @homepageURL  https://github.com/sealdice/javascript
// @sealVersion  1.4.0
// ==/UserScript==

/*
AI聊天机器人插件
功能：
- .chat <消息> - 与AI对话
- .chat clear - 清除对话历史
- .chat help - 查看帮助信息

需要配置后端API地址和密钥
*/

// 创建扩展
let ext = seal.ext.find('ai-chat');
if (!ext) {
  ext = seal.ext.new('ai-chat', 'Rene', '1.0.0');
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
  return ctx.player.userId || ctx.player.name || 'unknown';
}

// 工具函数：获取群组ID作为会话ID
function getConversationId(ctx) {
  if (ctx.group && ctx.group.groupId) {
    return `group_${ctx.group.groupId}`;
  }
  return 'private';
}

// 工具函数：HTTP请求
async function makeRequest(url, method = 'GET', data = null, retries = CONFIG.MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      console.log(`发送请求到: ${url}, 数据:`, data);
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('收到响应:', result);
      return result;
      
    } catch (error) {
      console.log(`请求失败 (尝试 ${i + 1}/${retries}):`, error.message);
      if (i === retries - 1) {
        throw error;
      }
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// 工具函数：检查后端健康状态
async function checkBackendHealth() {
  try {
    const response = await makeRequest(`${CONFIG.API_BASE_URL}/health`, 'GET', null, 1);
    return response.status === 'healthy';
  } catch (error) {
    console.log('后端健康检查失败:', error.message);
    return false;
  }
}

// 工具函数：发送聊天请求
async function sendChatRequest(userId, message, conversationId) {
  const url = `${CONFIG.API_BASE_URL}/chat`;
  const data = {
    user_id: userId,
    message: message,
    conversation_id: conversationId
  };
  
  const response = await makeRequest(url, 'POST', data);
  return response;
}

// 工具函数：清除对话历史
async function clearChatHistory(userId, conversationId) {
  const url = `${CONFIG.API_BASE_URL}/clear_history`;
  const data = {
    user_id: userId,
    conversation_id: conversationId
  };
  
  const response = await makeRequest(url, 'POST', data);
  return response;
}

// 工具函数：格式化错误消息
function formatErrorMessage(error) {
  if (error.message.includes('fetch')) {
    return '无法连接到AI服务，请检查后端服务是否正常运行';
  } else if (error.message.includes('HTTP 500')) {
    return 'AI服务内部错误，请联系管理员';
  } else if (error.message.includes('HTTP 400')) {
    return '请求格式错误，请检查输入内容';
  } else {
    return `发生错误: ${error.message}`;
  }
}

// 创建聊天指令
const cmdChat = seal.ext.newCmdItemInfo();
cmdChat.name = 'chat';
cmdChat.help = `AI聊天机器人
使用方法：
.chat <消息> - 与AI对话
.chat clear - 清除对话历史  
.chat help - 查看帮助信息

示例：
.chat 你好，请介绍一下TRPG
.chat 帮我生成一个角色背景
.chat clear`;

cmdChat.solve = async (ctx, msg, cmdArgs) => {
  try {
    const userId = getUserId(ctx);
    const conversationId = getConversationId(ctx);
    const arg1 = cmdArgs.getArgN(1);
    
    console.log(`用户 ${userId} 在 ${conversationId} 使用chat命令: ${arg1}`);
    
    switch (arg1) {
      case 'help':
      case '':
      case '帮助': {
        const ret = seal.ext.newCmdExecuteResult(true);
        ret.showHelp = true;
        return ret;
      }
      
      case 'clear':
      case '清除':
      case '重置': {
        // 清除对话历史
        try {
          // 先检查后端状态
          const isHealthy = await checkBackendHealth();
          if (!isHealthy) {
            seal.replyToSender(ctx, msg, '❌ AI服务暂时不可用，请稍后再试');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          await clearChatHistory(userId, conversationId);
          seal.replyToSender(ctx, msg, '✅ 对话历史已清除，你可以开始新的对话了');
        } catch (error) {
          const errorMsg = formatErrorMessage(error);
          seal.replyToSender(ctx, msg, `❌ 清除对话历史失败: ${errorMsg}`);
        }
        return seal.ext.newCmdExecuteResult(true);
      }
      
      case 'status':
      case '状态': {
        // 检查服务状态
        try {
          const isHealthy = await checkBackendHealth();
          if (isHealthy) {
            seal.replyToSender(ctx, msg, '✅ AI服务运行正常');
          } else {
            seal.replyToSender(ctx, msg, '❌ AI服务暂时不可用');
          }
        } catch (error) {
          seal.replyToSender(ctx, msg, '❌ 无法检查服务状态');
        }
        return seal.ext.newCmdExecuteResult(true);
      }
      
      default: {
        // 获取完整的用户消息（从第一个参数开始的所有内容）
        const userMessage = cmdArgs.args.slice(1).join(' ').trim();
        
        if (!userMessage) {
          seal.replyToSender(ctx, msg, '请输入要发送给AI的消息，例如：.chat 你好');
          return seal.ext.newCmdExecuteResult(true);
        }
        
        // 消息长度检查
        if (userMessage.length > 2000) {
          seal.replyToSender(ctx, msg, '❌ 消息过长，请控制在2000字符以内');
          return seal.ext.newCmdExecuteResult(true);
        }
        
        try {
          // 显示处理中的消息
          seal.replyToSender(ctx, msg, '🤔 AI正在思考中，请稍候...');
          
          // 先检查后端状态
          const isHealthy = await checkBackendHealth();
          if (!isHealthy) {
            seal.replyToSender(ctx, msg, '❌ AI服务暂时不可用，请稍后再试');
            return seal.ext.newCmdExecuteResult(true);
          }
          
          // 发送聊天请求
          const response = await sendChatRequest(userId, userMessage, conversationId);
          
          if (response.success && response.reply) {
            // 格式化AI回复
            const aiReply = `🤖 AI回复：\n${response.reply}`;
            seal.replyToSender(ctx, msg, aiReply);
          } else {
            const errorMsg = response.error || '未知错误';
            seal.replyToSender(ctx, msg, `❌ AI回复失败: ${errorMsg}`);
          }
          
        } catch (error) {
          console.log('聊天请求错误:', error);
          const errorMsg = formatErrorMessage(error);
          seal.replyToSender(ctx, msg, `❌ ${errorMsg}`);
        }
        
        return seal.ext.newCmdExecuteResult(true);
      }
    }
    
  } catch (error) {
    console.log('chat命令处理错误:', error);
    seal.replyToSender(ctx, msg, '❌ 命令处理失败，请重试');
    return seal.ext.newCmdExecuteResult(true);
  }
};

// 注册命令
ext.cmdMap['chat'] = cmdChat;

// 插件加载完成提示
console.log('AI聊天机器人插件已加载');
console.log(`API地址: ${CONFIG.API_BASE_URL}`);
console.log('使用 .chat help 查看帮助信息');
