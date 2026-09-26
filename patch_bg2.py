import re

with open('src/background.ts', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update AgentState
code = code.replace(
    'scratchpad: string',
    'scratchpad: string\n  activeChatId?: string\n  activeTaskId?: string'
)

# 2. Update callLLMAI body
old_body = '''      body: JSON.stringify({
        model: targetModel,
        messages: messagesToSend,
        stream: true,
        reasoning: { effort: "medium" },
        max_tokens: 4096,
        temperature: 0.3
      }),'''
new_body = '''      body: JSON.stringify({
        model: targetModel,
        messages: messagesToSend,
        stream: true,
        max_tokens: 4096,
        temperature: 0.3,
        chatId: state.activeChatId,
        taskId: state.activeTaskId
      }),'''
code = code.replace(old_body, new_body)

# 3. Update CHAT
old_chat = '''  if (message.type === "CHAT") {
    const { text, images } = message'''
new_chat = '''  if (message.type === "CHAT") {
    const { text, images, chatId, taskId } = message
    if (chatId) state.activeChatId = chatId;
    if (taskId) state.activeTaskId = taskId;'''
code = code.replace(old_chat, new_chat)

# 4. Update RETRY_CHAT
old_retry = '''  if (message.type === "RETRY_CHAT") {
    if (state.messages.length === 0) return'''
new_retry = '''  if (message.type === "RETRY_CHAT") {
    if (message.taskId) state.activeTaskId = message.taskId;
    if (state.messages.length === 0) return'''
code = code.replace(old_retry, new_retry)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched background.ts successfully")
