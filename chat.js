// ==UserScript==
// @name         AI聊天机器人
// @author       Rene
// @version      1.3.0
// @description  群组共享对话历史的AI聊天机器人，支持用户识别和无指令聊天
// @license      Apache-2
// @timestamp    1749902144
// ==/UserScript==

/*
AI聊天机器人插件 - 群组共享版本 v1.3.0
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接
- .chat clear - 清除对话历史
- .chat list - 查看对话列表
- .chat free [on/off] - 开关无指令聊天功能

特性：
- 群组内所有成员共享对话历史
- AI能识别不同用户的发言
- 私聊时每个用户独立历史
- 支持连续对话上下文
- 支持@骰娘进行无指令聊天
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '1.3.0');
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
  function getUserName(ctx) {
    try {
      if (!ctx || !ctx.player) return 'unknown';
      return ctx.player.name || 'unknown';
    } catch (error) {
      console.log('获取用户名失败:', error);
      return 'unknown';
    }
  }

  // 工具函数：获取骰娘QQ号配置
  function getBotQQ() {
    try {
      return seal.ext.getStringConfig(ext, "bot_qq") || '';
    } catch (error) {
      console.log('获取骰娘QQ号失败:', error);
      return '';
    }
  }

  // 工具函数：获取无指令聊天开关状态
  function getFreeChat() {
    try {
      return seal.ext.getBoolConfig(ext, "free_chat");
    } catch (error) {
      console.log('获取无指令聊天配置失败:', error);
      return false;
    }
  }

  // 工具函数：设置无指令聊天开关状态
  function setFreeChat(enabled) {
    try {
      seal.ext.setBoolConfig(ext, "free_chat", enabled);
      return true;
    } catch (error) {
      console.log('设置无指令聊天配置失败:', error);
      return false;
    }
  }

  // 发送AI聊天请求的核心函数
  async function sendChatRequest(ctx, msg, userMessage) {
    try {
      const userId = getUserId(ctx);
      const userName = getUserName(ctx);
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
  }

  // 实现无指令聊天功能
  ext.onNotCommandReceived = function (ctx, msg) {
    // 检查是否启用无指令聊天
    if (!getFreeChat()) {
      return;
    }

    // 获取骰娘QQ号
    const botQQ = getBotQQ();
    if (!botQQ) {
      // 如果没有配置骰娘QQ号，则不处理
      return;
    }

    // 检测是否@了骰娘
    const message = msg.message || '';
    console.log('收到非指令消息:', message);
    
    // 匹配 [CQ:at,qq=数字] 格式的@消息
    const atRegex = /\[CQ:at,qq=(\d+?)\]/;
    const match = atRegex.exec(message);
    
    if (match && match[1] === botQQ) {
      console.log('检测到@骰娘，开始处理无指令聊天');
      
      // 提取@后面的消息内容，去掉@标签
      let userMessage = message.replace(atRegex, '').trim();
      
      // 如果消息为空，给出提示
      if (!userMessage) {
        seal.replyToSender(ctx, msg, '你@我有什么事吗？可以直接说话哦～\n\n或者使用 .chat help 查看我的功能');
        return;
      }

      // 检查消息长度
      if (userMessage.length > 2000) {
        seal.replyToSender(ctx, msg, '消息太长了，请控制在2000字符以内\n当前长度：' + userMessage.length);
        return;
      }

      // 发送聊天请求
      sendChatRequest(ctx, msg, userMessage);
    }
  };

  // 创建聊天指令
  const cmdChat = seal.ext.newCmdItemInfo();
  cmdChat.name = 'chat';
  cmdChat.help = `AI聊天机器人 v1.3.0 - 基于阿里云通义千问
  
基本功能：
.chat <消息> - 与AI对话，支持连续对话上下文
.chat help - 查看帮助信息
.chat test - 测试AI服务连接

历史管理：
.chat clear - 清除当前会话的对话历史
.chat list - 查看所有对话列表和统计

无指令聊天：
.chat free - 查看无指令聊天状态
.chat free on - 开启无指令聊天（@骰娘直接对话）
.chat free off - 关闭无指令聊天

使用示例：
.chat 你好，请介绍一下TRPG
.chat 帮我生成一个法师角色
.chat 解释一下DND5E的先攻规则
.chat clear - 清除历史重新开始
.chat list - 查看所有对话
.chat free on - 开启@聊天功能
@骰娘 你好 - 无指令聊天（需先开启）

功能特性：
• 智能对话：AI能记住对话历史，提供连续对话
• 群组共享：同一群组所有成员共享对话历史
• 用户识别：AI能识别不同用户的发言
• 历史管理：支持清除对话历史和查看对话列表
• 无指令聊天：支持@骰娘进行直接对话
• TRPG专业：针对桌游场景优化的AI助手

工作原理：
• 群组内所有成员共享同一个对话历史记录
• 每个用户的消息都会标记用户身份
• 私聊时每个用户有独立的对话历史
• AI能够区分和回应不同用户的消息
• 无指令聊天需要配置骰娘QQ号并开启功能

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

        case 'free':
        case '自由聊天':
        case '无指令聊天': {
          const arg2 = cmdArgs.getArgN(2) || '';
          
          switch (arg2) {
            case 'on':
            case '开启':
            case '启用':
            case 'true': {
              const botQQ = getBotQQ();
              if (!botQQ) {
                seal.replyToSender(ctx, msg, '❌ 无法开启无指令聊天\n\n请先在插件配置中设置骰娘QQ号（bot_qq配置项）\n\n设置方法：\n1. 进入海豹Web管理界面\n2. 点击"扩展功能"\n3. 找到"AI聊天机器人"插件\n4. 配置"骰娘QQ号"选项');
                return seal.ext.newCmdExecuteResult(true);
              }
              
              if (setFreeChat(true)) {
                seal.replyToSender(ctx, msg, `✅ 无指令聊天已开启\n\n现在可以通过@骰娘直接对话了！\n示例：@${botQQ} 你好\n\n💡 使用 .chat free off 可以关闭此功能`);
              } else {
                seal.replyToSender(ctx, msg, '❌ 开启无指令聊天失败，请检查插件配置');
              }
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case 'off':
            case '关闭':
            case '禁用':
            case 'false': {
              if (setFreeChat(false)) {
                seal.replyToSender(ctx, msg, '✅ 无指令聊天已关闭\n\n现在需要使用 .chat <消息> 格式与AI对话\n\n💡 使用 .chat free on 可以重新开启此功能');
              } else {
                seal.replyToSender(ctx, msg, '❌ 关闭无指令聊天失败，请检查插件配置');
              }
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case '':
            case 'status':
            case '状态': {
              const freeChatEnabled = getFreeChat();
              const botQQ = getBotQQ();
              
              let statusMsg = '🔧 无指令聊天功能状态：\n\n';
              statusMsg += `功能状态：${freeChatEnabled ? '✅ 已开启' : '❌ 已关闭'}\n`;
              statusMsg += `骰娘QQ号：${botQQ || '❌ 未配置'}\n\n`;
              
              if (freeChatEnabled && botQQ) {
                statusMsg += `✅ 功能正常，可以通过@${botQQ}进行对话\n`;
                statusMsg += `示例：@${botQQ} 你好`;
              } else if (freeChatEnabled && !botQQ) {
                statusMsg += '⚠️ 功能已开启但骰娘QQ号未配置\n请在插件配置中设置骰娘QQ号';
              } else {
                statusMsg += '使用 .chat free on 开启无指令聊天功能';
              }
              
              statusMsg += '\n\n💡 配置方法：进入Web管理界面 → 扩展功能 → AI聊天机器人 → 配置骰娘QQ号';
              
              seal.replyToSender(ctx, msg, statusMsg);
              return seal.ext.newCmdExecuteResult(true);
            }
            
            default: {
              seal.replyToSender(ctx, msg, '❓ 无效的参数\n\n用法：\n.chat free - 查看状态\n.chat free on - 开启无指令聊天\n.chat free off - 关闭无指令聊天');
              return seal.ext.newCmdExecuteResult(true);
            }
          }
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
          sendChatRequest(ctx, msg, userMessage);
          
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
    
    // 注册配置项
    seal.ext.registerStringConfig(ext, "bot_qq", "", "骰娘QQ号", "用于无指令聊天功能，填入骰娘的QQ号（纯数字，不带前缀）");
    seal.ext.registerBoolConfig(ext, "free_chat", false, "无指令聊天", "开启后可以通过@骰娘进行无指令聊天");
    
    console.log('AI聊天机器人插件加载完成 v1.3.0');
    console.log(`API地址: ${CONFIG.API_BASE_URL}`);
    console.log('功能特性:');
    console.log('- 群组内所有成员共享对话历史');
    console.log('- AI能识别不同用户的发言');
    console.log('- 私聊时每个用户独立历史');
    console.log('- 支持连续对话和上下文记忆');
    console.log('- 支持@骰娘进行无指令聊天');
    console.log('- 基于阿里云通义千问AI模型');
    console.log('使用方法:');
    console.log('- .chat <消息> - 与AI对话');
    console.log('- .chat test - 测试连接');
    console.log('- .chat clear - 清除当前会话历史');
    console.log('- .chat list - 查看所有对话列表');
    console.log('- .chat free [on/off] - 管理无指令聊天功能');
    console.log('- @骰娘 <消息> - 无指令聊天（需配置并开启）');
    console.log('- .chat help - 查看帮助');
  } else {
    throw new Error('无法注册命令');
  }
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
