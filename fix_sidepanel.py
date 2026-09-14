import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target_state = '''  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [chatModel, setChatModel] = useState(CHAT_MODELS[0].id)'''

replace_state = '''  const [showSettings, setShowSettings] = useState(false)
  const [useCustomProvider, setUseCustomProvider] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [customModel, setCustomModel] = useState("")'''

target_mount = '''    chrome.storage.local.get(["apiKey", "baseUrl"], (storage) => {
      if (storage.apiKey) setApiKey(storage.apiKey)
      if (storage.baseUrl) setBaseUrl(storage.baseUrl)
    })
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      if (res?.selectedChatModel) setChatModel(res.selectedChatModel)'''

replace_mount = '''    chrome.storage.local.get(["apiKey", "baseUrl", "useCustomProvider", "customModel"], (storage) => {
      if (storage.apiKey) setApiKey(storage.apiKey)
      if (storage.baseUrl) setBaseUrl(storage.baseUrl)
      if (storage.useCustomProvider !== undefined) setUseCustomProvider(storage.useCustomProvider)
      if (storage.customModel) setCustomModel(storage.customModel)
    })
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {'''

target_save = '''            <button 
              onClick={() => {
                chrome.storage.local.set({ apiKey, baseUrl }, () => {
                  showToast("Settings saved securely", "success")
                })
              }}'''

replace_save = '''            <button 
              onClick={() => {
                chrome.storage.local.set({ apiKey, baseUrl, useCustomProvider, customModel }, () => {
                  showToast("Settings saved securely", "success")
                })
              }}'''

content = content.replace(target_state, replace_state)
content = content.replace(target_mount, replace_mount)
content = content.replace(target_save, replace_save)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
