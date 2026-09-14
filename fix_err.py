import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      if (res?.selectedChatModel) setChatModel(res.selectedChatModel)
      if (res?.messages && res.messages.length > 0) {'''

replace = '''    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      if (res?.messages && res.messages.length > 0) {'''

content = content.replace(target, replace)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
