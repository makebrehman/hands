import sys

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add wiretapCanvas and readCanvasWiretap after actionExecuteJavascript
wiretap_code = """
async function actionWiretapCanvas(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return "No active tab found"

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      if ((window as any).__canvasWiretapped) return
      ;(window as any).__canvasWiretapped = true
      ;(window as any).__canvasText = []

      const originalFillText = CanvasRenderingContext2D.prototype.fillText
      CanvasRenderingContext2D.prototype.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
        ;(window as any).__canvasText.push({ text, x, y })
        return originalFillText.apply(this, arguments as any)
      }

      const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText
      CanvasRenderingContext2D.prototype.strokeText = function(text: string, x: number, y: number, maxWidth?: number) {
        ;(window as any).__canvasText.push({ text, x, y })
        return originalStrokeText.apply(this, arguments as any)
      }
    }
  })

  return "Canvas wiretap installed. Any text drawn to the canvas from now on will be captured. Scroll or interact with the page to force the canvas to re-render, then use the readCanvasWiretap tool."
}

async function actionReadCanvasWiretap(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return "No active tab found"

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      return (window as any).__canvasText || []
    }
  })

  const texts = result[0]?.result || []
  if (texts.length === 0) return "No text captured yet. Make sure the wiretap is installed and the canvas has rendered new text."

  // Deduplicate and group by approximate Y coordinate (rows)
  const uniqueTexts = Array.from(new Set(texts.map((t: any) => t.text)))
  const preview = uniqueTexts.slice(0, 1000).join("\\n")
  return "Captured Canvas Text (" + uniqueTexts.length + " items):\\n" + preview
}
"""

content = content.replace('async function actionExecuteJavascript', wiretap_code + '\nasync function actionExecuteJavascript')

# Add to executeTool switch
execute_case = """
    case "wiretapCanvas":
      return { result: await actionWiretapCanvas() }
    case "readCanvasWiretap":
      return { result: await actionReadCanvasWiretap() }
    case "executeJavascript":
"""
content = content.replace('case "executeJavascript":', execute_case)

# Add to SYSTEM_PROMPT available actions
actions_list_target = 'ACTION: {"action": "searchBookmarks", "params": {"query": "news"}}'
actions_list_replacement = actions_list_target + '\\nACTION: {"action": "wiretapCanvas", "params": {}}\\nACTION: {"action": "readCanvasWiretap", "params": {}}'

content = content.replace(actions_list_target, actions_list_replacement)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Patched successfully')
