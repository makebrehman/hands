import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target_storage = '''  const storage = await chrome.storage.local.get(["apiKey", "baseUrl"]);
  const targetApiKey = storage.apiKey && storage.apiKey.trim().length > 0 ? storage.apiKey.trim() : LLM_API_KEY;
  const targetBaseUrl = storage.baseUrl && storage.baseUrl.trim().length > 0 ? storage.baseUrl.trim() : LLM_API_URL;'''

replace_storage = '''  const storage = await chrome.storage.local.get(["apiKey", "baseUrl", "useCustomProvider", "customModel"]);
  const isCustom = storage.useCustomProvider === true;
  const targetApiKey = isCustom && storage.apiKey && storage.apiKey.trim().length > 0 ? storage.apiKey.trim() : LLM_API_KEY;
  const targetBaseUrl = isCustom && storage.baseUrl && storage.baseUrl.trim().length > 0 ? storage.baseUrl.trim() : LLM_API_URL;
  const targetModel = isCustom && storage.customModel && storage.customModel.trim().length > 0 ? storage.customModel.trim() : CHAT_MODEL;'''

target_payload = '''      body: JSON.stringify({
        model: state.selectedChatModel,
        messages: optimizedMessages,
        stream: true
      })'''

replace_payload = '''      body: JSON.stringify({
        model: targetModel,
        messages: optimizedMessages,
        stream: true
      })'''

content = content.replace(target_storage, replace_storage)
content = content.replace(target_payload, replace_payload)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
