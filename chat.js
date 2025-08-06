// ==UserScript==
// @name         AI聊天机器人 - 定时任务版
// @author       Rene
// @version      2.1.0
// @description  群组共享对话历史的AI聊天机器人，支持用户识别、无指令聊天、角色切换和智能定时任务
// @license      Apache-2
// @timestamp    1749902144
// ==/UserScript==

/*
AI聊天机器人插件 - 群组共享版本 v2.0.0
功能：
- .chat <消息> - 与AI对话
- .chat help - 查看帮助信息
- .chat test - 测试连接
- .chat clear - 清除对话历史
- .chat list - 查看对话列表
- .chat free [on/off] - 开关无指令聊天功能
- .chat task list - 查看定时任务列表
- .chat chara list - 查看角色列表
- .chat chara set [character-name] - 切换角色
- .chat chara add [new-character-name] [new-character-description] - 添加新角色

特性：
- 群组内所有成员共享对话历史
- AI能识别不同用户的发言
- 私聊时每个用户独立历史
- 支持连续对话上下文
- 支持@骰娘进行无指令聊天
- 智能识别定时任务需求并自动创建（需要60级或以上权限）

NEW v2.0.0:
- 自然语言定时任务：AI能理解并创建定时任务
- 权限管理：60级或以上权限才能创建定时任务
- 任务管理：支持查看和管理定时任务

NEW v2.1.0:
- 角色系统：支持查看和管理角色列表，切换角色，添加新角色
*/

try {
  // 创建扩展
  let ext = seal.ext.find('ai-chat');
  if (!ext) {
    ext = seal.ext.new('ai-chat', 'Rene', '2.0.0');
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

  // 工具函数：获取用户权限等级
  function getUserPermission(ctx) {
    try {
      if (!ctx || !ctx.privilegeLevel) return 0;
      return ctx.privilegeLevel || 0;
    } catch (error) {
      console.log('获取用户权限失败:', error);
      return 0;
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

  // 存储已注册的定时任务信息
  let registeredTasks = [];

  // 工具函数：注册定时任务
  function registerScheduledTask(ctx, msg, taskInfo) {
    try {
      if (!taskInfo || !taskInfo.task_type || !taskInfo.task_value) {
        console.log('任务信息不完整:', taskInfo);
        return false;
      }

      // 生成唯一的任务ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 保存原始上下文信息用于任务执行
      const taskContext = {
        groupId: ctx.group ? ctx.group.groupId : null,
        playerId: getUserId(ctx),
        playerName: getUserName(ctx),
        isGroup: !!(ctx.group && ctx.group.groupId),
        originalCtx: ctx,
        originalMsg: msg
      };

      // 创建任务执行函数
      const taskFunction = (taskCtx) => {
        try {
          console.log(`执行定时任务: ${taskInfo.task_description}`);
          
          // 构建任务通知消息（简化格式，避免特殊字符问题）
          let notificationMsg = `[定时任务提醒]\n\n`;
          notificationMsg += `任务: ${taskInfo.task_description}\n`;
          notificationMsg += `内容: ${taskInfo.task_action}\n`;
          notificationMsg += `时间: ${new Date().toLocaleString()}\n`;
          
          // 使用保存的原始上下文发送消息
          // 这是最简单也是最可靠的方式
          if (taskContext.isGroup && taskContext.groupId) {
            // 群组任务 - 使用 replyGroup
            seal.replyGroup(taskContext.originalCtx, taskContext.originalMsg, notificationMsg);
          } else {
            // 私聊任务 - 使用 replyPerson  
            seal.replyPerson(taskContext.originalCtx, taskContext.originalMsg, notificationMsg);
          }
          
        } catch (error) {
          console.log('执行定时任务失败:', error);
          // 备用方案：如果上面的方式失败，尝试使用 console.log 至少记录
          console.log(`定时任务通知: ${taskInfo.task_description} - ${taskInfo.task_action}`);
        }
      };

      // 注册任务到海豹核心
      seal.ext.registerTask(
        ext,
        taskInfo.task_type,
        taskInfo.task_value,
        taskFunction,
        taskId,
        taskInfo.task_description
      );

      // 记录已注册的任务
      registeredTasks.push({
        id: taskId,
        type: taskInfo.task_type,
        value: taskInfo.task_value,
        description: taskInfo.task_description,
        action: taskInfo.task_action,
        creator: getUserName(ctx),
        creator_id: getUserId(ctx),
        conversation_id: getConversationId(ctx),
        created_at: new Date().toLocaleString()
      });

      console.log(`定时任务注册成功: ${taskId} - ${taskInfo.task_description}`);
      return true;

    } catch (error) {
      console.log('注册定时任务失败:', error);
      return false;
    }
  }

  // 发送AI聊天请求的核心函数
  async function sendChatRequest(ctx, msg, userMessage) {
    try {
      const userId = getUserId(ctx);
      const userName = getUserName(ctx);
      const conversationId = getConversationId(ctx);
      const userPermission = getUserPermission(ctx);
      
      const chatData = {
        user_id: userId,
        user_name: userName,
        message: userMessage,
        conversation_id: conversationId,
        user_permission: userPermission
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
          
          // 检查是否有定时任务信息
          if (data.task_info && userPermission >= 60) {
            console.log('检测到定时任务:', data.task_info);
            
            // 尝试注册定时任务
            if (registerScheduledTask(ctx, msg, data.task_info)) {
              // 任务注册成功，添加成功提示
              const taskSuccessMsg = `\n\n✅ 定时任务创建成功！\n`;
              const taskDetails = `📋 任务类型：${data.task_info.task_type === 'daily' ? '每日任务' : '定时任务'}\n`;
              const taskTime = `⏰ 执行时间：${data.task_info.task_value}\n`;
              const taskDesc = `📝 任务描述：${data.task_info.task_description}`;
              
              seal.replyToSender(ctx, msg, data.reply + taskSuccessMsg + taskDetails + taskTime + taskDesc);
            } else {
              // 任务注册失败
              seal.replyToSender(ctx, msg, data.reply + '\n\n❌ 定时任务创建失败，请稍后重试。');
            }
          } else {
            // 没有任务信息，直接发送AI回复
            seal.replyToSender(ctx, msg, data.reply);
          }
          
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

      // 发送聊天请求（无指令聊天也支持定时任务）
      sendChatRequest(ctx, msg, userMessage);
    }
  };

  // 创建聊天指令
  const cmdChat = seal.ext.newCmdItemInfo();
  cmdChat.name = 'chat';
  cmdChat.help = `AI聊天机器人 v2.1.0
  
基本功能：
.chat <消息> - 与AI对话，支持连续对话上下文
.chat help - 查看帮助信息
.chat test - 测试AI服务连接

角色系统：
.chat chara list - 查看所有AI角色列表
.chat chara set <角色名> - 切换AI扮演的角色
.chat chara add <角色名> <描述> - 添加新的角色人设

历史管理：
.chat clear - 清除当前会话的对话历史
.chat list - 查看所有对话列表和统计

无指令聊天：
.chat free - 查看无指令聊天状态
.chat free on - 开启无指令聊天（@骰娘直接对话）
.chat free off - 关闭无指令聊天

定时任务（需要权限）：
.chat task list - 查看已创建的定时任务
.chat task clear - 清除所有定时任务
`;

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

        case 'task':
        case '任务':
        case '定时任务': {
          const arg2 = cmdArgs.getArgN(2) || '';
          const userPermission = getUserPermission(ctx);
          
          switch (arg2) {
            case 'list':
            case '列表':
            case '查看': {
              if (registeredTasks.length === 0) {
                seal.replyToSender(ctx, msg, '📋 暂无已注册的定时任务\n\n💡 你可以通过自然语言与AI对话来创建定时任务，例如：\n• .chat 每天早上8点提醒我起床\n• .chat 每小时提醒我喝水\n\n⚠️ 注意：创建定时任务需要60级或以上权限');
                return seal.ext.newCmdExecuteResult(true);
              }
              
              let taskListMsg = '📋 已注册的定时任务列表：\n\n';
              const conversationId = getConversationId(ctx);
              const relevantTasks = registeredTasks.filter(task => 
                task.conversation_id === conversationId || 
                task.creator_id === getUserId(ctx)
              );
              
              if (relevantTasks.length === 0) {
                taskListMsg += '当前会话/用户暂无定时任务\n\n';
              } else {
                relevantTasks.forEach((task, index) => {
                  taskListMsg += `${index + 1}. ${task.description}\n`;
                  taskListMsg += `   ⏰ 时间：${task.value}\n`;
                  taskListMsg += `   📝 类型：${task.type === 'daily' ? '每日任务' : '定时任务'}\n`;
                  taskListMsg += `   👤 创建者：${task.creator}\n`;
                  taskListMsg += `   📅 创建时间：${task.created_at}\n\n`;
                });
              }
              
              taskListMsg += `💡 总共有 ${registeredTasks.length} 个任务在运行\n`;
              taskListMsg += `📍 当前相关任务：${relevantTasks.length} 个\n\n`;
              taskListMsg += '🔧 管理命令：\n';
              taskListMsg += '• .chat task clear - 清除所有任务（需要60级权限）';
              
              seal.replyToSender(ctx, msg, taskListMsg);
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case 'clear':
            case '清除':
            case '删除': {
              if (userPermission < 60) {
                seal.replyToSender(ctx, msg, '❌ 权限不足\n\n清除定时任务需要60级或以上权限。\n当前权限等级：' + userPermission);
                return seal.ext.newCmdExecuteResult(true);
              }
              
              if (registeredTasks.length === 0) {
                seal.replyToSender(ctx, msg, '📋 暂无定时任务需要清除');
                return seal.ext.newCmdExecuteResult(true);
              }
              
              // 注意：这里只是清除记录，实际的任务清除需要海豹核心支持
              const taskCount = registeredTasks.length;
              registeredTasks = [];
              
              let clearMsg = `✅ 已清除 ${taskCount} 个定时任务记录\n\n`;
              clearMsg += '⚠️ 注意：已经运行的定时任务可能需要重启海豹核心才能完全停止。\n\n';
              clearMsg += '💡 如需重新创建任务，可以通过自然语言与AI对话。';
              
              seal.replyToSender(ctx, msg, clearMsg);
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case '':
            case 'help':
            case '帮助': {
              let taskHelpMsg = '🕐 定时任务功能帮助\n\n';
              taskHelpMsg += '📋 可用命令：\n';
              taskHelpMsg += '• .chat task list - 查看定时任务列表\n';
              taskHelpMsg += '• .chat task clear - 清除所有定时任务\n\n';
              taskHelpMsg += '🤖 创建任务：\n';
              taskHelpMsg += '通过自然语言与AI对话即可创建定时任务，AI会自动识别并创建。\n\n';
              taskHelpMsg += '💡 示例：\n';
              taskHelpMsg += '• .chat 每天早上8点提醒我起床\n';
              taskHelpMsg += '• .chat 每小时提醒我喝水\n';
              taskHelpMsg += '• .chat 每5分钟检查一下状态\n';
              taskHelpMsg += '• .chat 每天晚上10点提醒我睡觉\n\n';
              taskHelpMsg += '⚠️ 权限要求：\n';
              taskHelpMsg += '• 创建定时任务需要60级或以上权限\n';
              taskHelpMsg += `• 您当前权限等级：${userPermission}\n\n`;
              taskHelpMsg += '🔧 技术说明：\n';
              taskHelpMsg += '• 支持每日任务（如：每天8:00）\n';
              taskHelpMsg += '• 支持Cron表达式任务（如：每5分钟）\n';
              taskHelpMsg += '• 任务将在指定时间自动发送提醒';
              
              seal.replyToSender(ctx, msg, taskHelpMsg);
              return seal.ext.newCmdExecuteResult(true);
            }
            
            default: {
              seal.replyToSender(ctx, msg, '❓ 无效的任务命令\n\n用法：\n.chat task - 查看帮助\n.chat task list - 查看任务列表\n.chat task clear - 清除所有任务');
              return seal.ext.newCmdExecuteResult(true);
            }
          }
        }

        case 'chara':
        case '角色':
        case '人设': {
          const arg2 = cmdArgs.getArgN(2) || '';
          
          switch (arg2) {
            case 'list':
            case 'ls':
            case '列表':
            case '查看': {
              seal.replyToSender(ctx, msg, '正在获取角色列表...');
              // 获取角色列表
              (async () => {
                try {
                  const conversationId = getConversationId(ctx);
                  const listData = {
                    conversation_id: conversationId
                  };
                  
                  const response = await fetch(`${CONFIG.API_BASE_URL}/characters`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(listData)
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data && data.success && data.characters) {
                      const characters = data.characters;
                      const currentCharacter = data.current_character || 'default';
                      
                      if (Object.keys(characters).length === 0) {
                        seal.replyToSender(ctx, msg, '暂无可用角色\n\n使用 .chat chara add <角色名> <角色描述> 添加新角色');
                      } else {
                        let listMsg = '当前会话AI角色列表：\n\n';
                        for (const [charId, character] of Object.entries(characters)) {
                          const isCurrentChar = charId === currentCharacter;
                          const marker = isCurrentChar ? '[当前] ' : '';
                          
                          listMsg += `${marker}[${charId}]\n`;
                          listMsg += `${character.description}\n\n`;
                        }
                        listMsg += '命令说明：\n';
                        listMsg += '.chat chara set <角色名> - 切换当前会话的角色\n';
                        listMsg += '.chat chara add <角色名> <描述> - 添加新角色\n\n';
                        listMsg += '注意：角色切换仅影响当前会话，不会影响其他群组';
                        seal.replyToSender(ctx, msg, listMsg);
                      }
                    } else {
                      seal.replyToSender(ctx, msg, '获取角色列表失败：响应格式错误');
                    }
                  } else {
                    seal.replyToSender(ctx, msg, `获取角色列表失败：HTTP ${response.status}\n请检查后端服务状态`);
                  }
                } catch (error) {
                  console.log('获取角色列表错误:', error);
                  seal.replyToSender(ctx, msg, `获取角色列表失败\n错误：${error.message}\n请检查网络连接和后端服务`);
                }
              })();
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case 'set':
            case '切换':
            case '设置': {
              const characterName = cmdArgs.getArgN(3) || '';
              if (!characterName) {
                seal.replyToSender(ctx, msg, '请指定要切换的角色名\n\n用法：.chat chara set <角色名>\n例如：.chat chara set default\n\n使用 .chat chara list 查看可用角色');
                return seal.ext.newCmdExecuteResult(true);
              }
              
              seal.replyToSender(ctx, msg, `正在切换到角色：${characterName}...`);
              // 切换角色
              (async () => {
                try {
                  const conversationId = getConversationId(ctx);
                  const setData = {
                    character_name: characterName,
                    conversation_id: conversationId
                  };
                  
                  const response = await fetch(`${CONFIG.API_BASE_URL}/characters/set`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(setData)
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data && data.success) {
                      let successMsg = `${data.message}\n\n`;
                      if (data.character) {
                        successMsg += `角色简介：${data.character.description}\n\n`;
                      }
                      successMsg += '当前会话的角色已切换，对话历史已自动清除，现在可以开始新的对话了！\n';
                      successMsg += '使用 .chat <消息> 与新角色对话';
                      seal.replyToSender(ctx, msg, successMsg);
                    } else {
                      const errorMsg = (data && data.message) || '切换失败';
                      seal.replyToSender(ctx, msg, `切换角色失败：${errorMsg}`);
                    }
                  } else {
                    seal.replyToSender(ctx, msg, `切换角色失败：HTTP ${response.status}\n请检查后端服务状态`);
                  }
                } catch (error) {
                  console.log('切换角色错误:', error);
                  seal.replyToSender(ctx, msg, `切换角色失败\n错误：${error.message}\n请检查网络连接和后端服务`);
                }
              })();
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case 'add':
            case '添加':
            case '新增': {
              const characterName = cmdArgs.getArgN(3) || '';
              const characterDescription = cmdArgs.getArgN(4) || '';
              
              // 组合剩余参数作为描述（支持多个词语的描述）
              let fullDescription = characterDescription;
              for (let i = 5; i <= 15; i++) {
                const part = cmdArgs.getArgN(i);
                if (part) {
                  fullDescription += ' ' + part;
                } else {
                  break;
                }
              }
              
              if (!characterName || !fullDescription) {
                seal.replyToSender(ctx, msg, '请提供角色名和角色描述\n\n用法：.chat chara add <角色名> <角色描述>\n\n示例：\n.chat chara add wizard 你是一位博学的法师，精通各种魔法知识\n.chat chara add detective 你是一名敏锐的侦探，善于观察和推理\n\n角色描述会作为AI的系统提示词，决定AI的行为和回答风格');
                return seal.ext.newCmdExecuteResult(true);
              }
              
              if (characterName.length > 20) {
                seal.replyToSender(ctx, msg, '角色名过长，请控制在20个字符以内\n当前长度：' + characterName.length);
                return seal.ext.newCmdExecuteResult(true);
              }
              
              if (fullDescription.length > 1000) {
                seal.replyToSender(ctx, msg, '角色描述过长，请控制在1000个字符以内\n当前长度：' + fullDescription.length);
                return seal.ext.newCmdExecuteResult(true);
              }
              
              seal.replyToSender(ctx, msg, `正在添加新角色：${characterName}...`);
              // 添加新角色
              (async () => {
                try {
                  const addData = {
                    character_name: characterName,
                    character_description: fullDescription
                  };
                  
                  const response = await fetch(`${CONFIG.API_BASE_URL}/characters/add`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(addData)
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data && data.success) {
                      let successMsg = `${data.message}\n\n`;
                      successMsg += `角色描述：${fullDescription}\n\n`;
                      successMsg += '使用 .chat chara set ' + characterName + ' 切换到此角色\n';
                      successMsg += '使用 .chat chara list 查看所有角色';
                      seal.replyToSender(ctx, msg, successMsg);
                    } else {
                      const errorMsg = (data && data.message) || '添加失败';
                      seal.replyToSender(ctx, msg, `添加角色失败：${errorMsg}`);
                    }
                  } else {
                    seal.replyToSender(ctx, msg, `添加角色失败：HTTP ${response.status}\n请检查后端服务状态`);
                  }
                } catch (error) {
                  console.log('添加角色错误:', error);
                  seal.replyToSender(ctx, msg, `添加角色失败\n错误：${error.message}\n请检查网络连接和后端服务`);
                }
              })();
              return seal.ext.newCmdExecuteResult(true);
            }
            
            case '':
            case 'help':
            case '帮助': {
              let charaHelpMsg = 'AI角色系统帮助\n\n';
              charaHelpMsg += '可用命令：\n';
              charaHelpMsg += '.chat chara list - 查看所有角色列表\n';
              charaHelpMsg += '.chat chara set <角色名> - 切换AI角色\n';
              charaHelpMsg += '.chat chara add <角色名> <描述> - 添加新角色\n\n';
              charaHelpMsg += '使用示例：\n';
              charaHelpMsg += '.chat chara list - 查看角色列表\n';
              charaHelpMsg += '.chat chara set wizard - 切换到法师角色\n';
              charaHelpMsg += '.chat chara add detective 你是一名敏锐的侦探\n\n';
              charaHelpMsg += '功能说明：\n';
              charaHelpMsg += '- 角色描述会作为AI的系统提示词\n';
              charaHelpMsg += '- 切换角色后当前会话的对话历史会自动清除\n';
              charaHelpMsg += '- 每个角色有不同的行为和回答风格\n';
              charaHelpMsg += '- 角色数据持久保存，重启后仍然可用';
              
              seal.replyToSender(ctx, msg, charaHelpMsg);
              return seal.ext.newCmdExecuteResult(true);
            }
            
            default: {
              seal.replyToSender(ctx, msg, '无效的角色命令\n\n用法：\n.chat chara list - 查看角色列表\n.chat chara set <角色名> - 切换角色\n.chat chara add <角色名> <描述> - 添加角色\n.chat chara help - 查看帮助');
              return seal.ext.newCmdExecuteResult(true);
            }
          }
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
    
    console.log('AI聊天机器人插件加载完成 v2.0.0 - 支持智能定时任务');
    console.log(`API地址: ${CONFIG.API_BASE_URL}`);
    console.log('功能特性:');
    console.log('- 群组内所有成员共享对话历史');
    console.log('- AI能识别不同用户的发言');
    console.log('- 私聊时每个用户独立历史');
    console.log('- 支持连续对话和上下文记忆');
    console.log('- 支持@骰娘进行无指令聊天');
    console.log('- 智能识别定时任务需求并自动创建');
    console.log('- 基于阿里云通义千问AI模型');
    console.log('使用方法:');
    console.log('- .chat <消息> - 与AI对话');
    console.log('- .chat test - 测试连接');
    console.log('- .chat clear - 清除当前会话历史');
    console.log('- .chat list - 查看所有对话列表');
    console.log('- .chat free [on/off] - 管理无指令聊天功能');
    console.log('- .chat task list - 查看定时任务列表');
    console.log('- .chat task clear - 清除所有定时任务');
    console.log('- @骰娘 <消息> - 无指令聊天（需配置并开启）');
    console.log('- .chat help - 查看帮助');
    console.log('定时任务示例:');
    console.log('- .chat 每天早上8点提醒我起床 - 自然语言定时任务');
    console.log('- .chat 每小时提醒我喝水 - 定时提醒');
    console.log('- .chat 每5分钟检查状态 - 定期任务');
    console.log('⚠️ 注意：创建定时任务需要60级或以上权限');
  } else {
    throw new Error('无法注册命令');
  }
  
} catch (initError) {
  console.log('插件初始化失败:', initError);
}
