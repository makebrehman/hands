import sys

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update actionLabelPage return statement
old_label_code = '''  const summary = coords
    .map((c: any, i: number) => `[${i + 1}] ${c.tag} "${c.text}" @ (${c.x}, ${c.y})`)
    .join("\\n")

  return `Labeled ${coords.length} DOM elements.\\nA 5x5 coordinate grid is also rendered on the screenshot. If you need to click on a Canvas element (like Google Sheets) or an unlabeled area, estimate the x,y coordinates by looking at the nearest grid numbers (e.g. 500,300).\\n\\nLabeled elements:\\n${summary}`'''

new_label_code = '''  return `Screenshot taken with ${coords.length} numbered boxes drawn over interactive elements.\\nA 5x5 coordinate grid is also rendered for Canvas areas. To click a numbered box, use the 'clickElement' tool. To click an unlabeled Canvas area, use the 'click' tool with estimated x,y coordinates.`'''

if old_label_code in content:
    content = content.replace(old_label_code, new_label_code)
else:
    print("Warning: old_label_code not found in background.ts. It might have been modified.")

# 2. Add actionClickElement function
click_element_code = '''
async function actionClickElement(id: number) {
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
}
'''
if 'async function actionClickElement' not in content:
    content = content.replace('async function actionType', click_element_code + '\nasync function actionType')

# 3. Add to executeTool switch
if 'case "clickElement":' not in content:
    content = content.replace('case "click":\n      return { result: await actionClick(params.x, params.y) }', 'case "click":\n      return { result: await actionClick(params.x, params.y) }\n    case "clickElement":\n      return { result: await actionClickElement(params.id) }')

# 4. Update SYSTEM_PROMPT actions list
if '"action": "clickElement"' not in content:
    content = content.replace('ACTION: {"action": "click", "params": {"x": 500, "y": 300}}', 'ACTION: {"action": "click", "params": {"x": 500, "y": 300}}\nACTION: {"action": "clickElement", "params": {"id": 12}}')

# 5. Update SYSTEM_PROMPT Examples
old_example = '''User: Click the login button
Assistant: I will take a screenshot to find the exact coordinates of the login button.
ACTION: {"action": "screenshot", "params": {}}

User: (Screenshot provided)
Assistant: I have the coordinates of the login button, now I will click it.
ACTION: {"action": "click", "params": {"x": 800, "y": 150}}'''

new_example = '''User: Click the login button
Assistant: I will take a screenshot to find the exact ID of the login button.
ACTION: {"action": "screenshot", "params": {}}

User: (Screenshot provided)
Assistant: I see the login button has the number 15 over it, so I will click element 15.
ACTION: {"action": "clickElement", "params": {"id": 15}}'''

if old_example in content:
    content = content.replace(old_example, new_example)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Set-of-Marks ID clicking successfully implemented in background.ts")
