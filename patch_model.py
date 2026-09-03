import sys

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change the model
content = content.replace('const CHAT_MODEL = "zai-org/GLM-5.3-Flash"', 'const CHAT_MODEL = "moonshotai/Kimi-K3"')

# 2. Inject `let lastLabeledCoords: any[] = []` before `const SYSTEM_PROMPT`
if 'let lastLabeledCoords: any[] = []' not in content:
    content = content.replace('const SYSTEM_PROMPT =', 'let lastLabeledCoords: any[] = []\n\nconst SYSTEM_PROMPT =')

# 3. Modify actionLabelPage
old_label_code = '''  const coordResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (window as any).__phillsCoords
  })

  const coords = coordResult[0]?.result || []'''

new_label_code = '''  const coordResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (window as any).__phillsCoords
  })

  lastLabeledCoords = coordResult[0]?.result || []
  const coords = lastLabeledCoords'''

if old_label_code in content:
    content = content.replace(old_label_code, new_label_code)

# 4. Modify actionClickElement
old_click_element_code = '''async function actionClickElement(id: number) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return "No active tab found"

  const coordResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (window as any).__phillsCoords
  })

  const coords = coordResult[0]?.result || []
  const element = coords[id - 1]
  
  if (!element) return `Error: Element ID ${id} not found.`
  
  await actionClick(element.x, element.y)
  return `Clicked element [${id}] at (${element.x}, ${element.y})`
}'''

new_click_element_code = '''async function actionClickElement(id: number) {
  const element = lastLabeledCoords[id - 1]
  
  if (!element) return `Error: Element ID ${id} not found. (Max ID available: ${lastLabeledCoords.length})`
  
  await actionClick(element.x, element.y)
  return `Clicked element [${id}] at (${element.x}, ${element.y})`
}'''

if old_click_element_code in content:
    content = content.replace(old_click_element_code, new_click_element_code)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Model changed to Kimi-K3 and clickElement memory patched successfully!")
