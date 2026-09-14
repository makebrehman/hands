import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  function handleChatModelChange(model: string) {
    setChatModel(model)
    chrome.runtime.sendMessage({ type: "SET_MODEL", modelType: "chat", model })
  }'''

content = content.replace(target, '')

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
