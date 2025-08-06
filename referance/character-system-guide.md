# 海豹骰Sealdice-AIchat-角色系统

## 目标：

在 @chat.js 中注册从属于 `.chat` 命令的新命令 —— `.chat chara`，其下有以下命令：

    - .chat chara list(/ls)
        列出现有的AI角色扮演的角色列表，格式为"[character-name] \n [character-description] \n"
        （实现：js端请求后端发送现有的json格式的角色列表）
    - .chat chara set [character-name]
        切换AI扮演的角色
        （实现：js端向后端发送角色切换要求，确认切换完毕后，js端返回切换成功的提示）
    - .chat chara add [new-character-name] [new-character-description]
        添加新的人设
        （实现：js端向后端发送新人设的信息，后端收到后更新json文件，更改完毕后，js端发送成功提示）

现有的后端中，角色的人设是硬编码在.env文件中的，注意此处对后端的修改。

## 参考：

- API参考：@reference/seal.d.ts
- 其他参考：https://docs.sealdice.com/advanced/js_example.html https://docs.sealdice.com/advanced/js_start.html https://docs.sealdice.com/advanced/js_api_list.html 
- sealdice海豹骰 原码 https://github.com/sealdice/sealdice-core/tree/master