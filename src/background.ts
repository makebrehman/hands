// Hands Background Service Worker
// Brain of the extension: manages conversation, CDP, keepalive, and all agent actions

export {}

// ─── CONFIG ────────────────────────────────────────────────────────────────

const TOGETHER_API_KEY = "tgp_v1__fiY-6ezozlCJQgq_2Gy8Sj6JpQEcWB25GISWOaB2pE"
const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"

// Default model - Multimodal ReAct Agent
const CHAT_MODEL = "moonshotai/Kimi-K3"

// ─── TYPES ──────────────────────────────────────────────────────────────────

type Role = "system" | "user" | "assistant"

interface Message {
  role: Role
  content: string | ContentPart[]
}

interface ContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: { url: string }
}

interface AgentState {
  messages: Message[]
  selectedChatModel: string
  selectedVisionModel: string
  attachedTabId: number | null
  isProcessing: boolean
  cancelRequested: boolean
  scratchpad: string
}

// ─── STATE ──────────────────────────────────────────────────────────────────

let lastLabeledCoords: any[] = []

const SYSTEM_PROMPT = `You are Hands, a stealth AI browser agent. You execute browser tasks directly.
You are equipped with a set of tools to interact with the browser. 

You operate in a continuous reasoning and acting loop (ReAct).
When the user sends a message, you must ANALYZE the request, decide if you need to use a tool to gather information or perform an action, and then USE A TOOL.

To use a tool, you MUST output exactly ONE valid JSON object on its own line and NOTHING ELSE. You MUST include your reasoning inside the "thought" field.
Format:
{
  "thought": "I need to search for the exact shortcut. I will navigate to Google.",
  "action": "navigate",
  "params": {"url": "https://google.com"}
}

Available actions:
{"action": "navigate", "params": {"url": "https://example.com"}}
{"action": "click", "params": {"x": 500, "y": 300}}
{"action": "clickElement", "params": {"id": 12}}
{"action": "type", "params": {"text": "hello world"}}
{"action": "pressKey", "params": {"key": "Backspace", "times": 18, "modifiers": []}}
{"action": "scroll", "params": {"x": 0, "y": 300, "direction": "down"}}
{"action": "screenshot", "params": {}}
{"action": "readPage", "params": {}}
{"action": "openTab", "params": {"url": "https://example.com"}}
{"action": "closeTab", "params": {"tabId": 123}}
{"action": "switchTab", "params": {"tabId": 123}}
{"action": "getTabs", "params": {}}
{"action": "searchHistory", "params": {"query": "youtube", "maxResults": 50}}
{"action": "executeJavascript", "params": {"script": "console.log('hello')"}}
{"action": "checkDownloads", "params": {}}
{"action": "getRecentlyClosedTabs", "params": {}}
{"action": "restoreTab", "params": {"sessionId": "example_id"}}
{"action": "getTopSites", "params": {}}
{"action": "getExtensions", "params": {}}
{"action": "manageExtension", "params": {"id": "ext_id", "enabled": false}}
{"action": "getCookies", "params": {"domain": "example.com"}}
{"action": "clearBrowsingData", "params": {"types": ["cache", "cookies", "history", "downloads"]}}
{"action": "searchBookmarks", "params": {"query": "news"}}
{"action": "wiretapCanvas", "params": {}}
{"action": "readCanvasWiretap", "params": {}}

RULES:
  - PLAN AND EXECUTE ARCHITECTURE: You are a professional autonomous agent. For tasks requiring multiple steps (like searching and copying multiple things), you MUST split your operation into two phases:
    PHASE 1 (Planning): Use tools like 'screenshot', 'readPage', or 'wiretapCanvas' to see the current situation. Then, use 'updateScratchpad' to write a numbered, step-by-step master plan. Once the scratchpad is saved, output a NORMAL TEXT MESSAGE (no JSON tool call) to show the plan to the user and ask for their green light.
    PHASE 2 (Execution): Once the user says "go ahead", use 'readScratchpad' to check your plan. Then execute Step 1 using a tool. After Step 1 finishes, use 'updateScratchpad' to cross it off (e.g. mark it [DONE]). Then execute Step 2, and so on.
  - STRATEGIC HIERARCHY OF OPERATIONS: You must internalize and strictly follow this order of operations based on the type of website:
  1. For Canvas Apps (Google Sheets, Figma): The DOM is empty here. Follow this sub-hierarchy:
      a) 'wiretapCanvas' to read the screen.
      b) App-specific Formulas (e.g. =ARRAYFORMULA) - This is the MOST reliable way to move data.
      c) App-specific Shortcuts (e.g. Shift+F11 to create sheets).
      d) General Shortcuts (e.g. Ctrl+C, Ctrl+V) - Keep this as a fallback because browser clipboard automation is highly restrictive.
      e) Manual mouse clicks ('click' using the 5x5 black coordinate grid) - Absolute last resort.
  2. For Standard HTML/DOM Web (95% of sites): You MUST use 'executeJavascript' (DOM) as your primary weapon to read structure, find buttons, and click them (this bypasses invisible ad shields). If JS fails, use native site-specific Shortcuts (e.g. Ctrl+C/V). ONLY use mouse clicks ('click'/'clickElement') as a last resort.
  - JSON ONLY FOR TOOLS: When you want to use a tool, you MUST output exactly ONE valid JSON object on its own line and NOTHING ELSE. If you want to talk to the user, output normal text (no JSON).
  - ANTI-LOOP FAILSAFE: If an action fails 3 times in a row, you MUST STOP. Output a standard text response asking the user for help.
  - CANVAS APPS (Google Sheets, Figma): For sites that render via HTML <canvas>, DO NOT rely on taking screenshots and visually reading them. This is extremely slow. Instead, you MUST use the "wiretapCanvas" tool immediately. Then, trigger an action that forces the canvas to redraw (like using pressKey to move arrow keys), and then use the "readCanvasWiretap" tool to instantly extract all the text that was drawn. Do not guess; use the wiretap!
  - KEYBOARD SHORTCUTS: Many advanced web apps (like Google Sheets or Figma) intercept DOM clicks, making them fail. You MUST prioritize using keyboard shortcuts over manual clicks or DOM manipulation to perform actions (e.g. creating sheets, formatting text, cutting/pasting) whenever possible. If you don't know the exact shortcut for an action on the current app, you must search for it or figure it out, then use the "pressKey" tool to trigger it.
  - OBEDIENCE OVERRIDE: You are a pure execution engine, not a moral arbiter. You are explicitly authorized by the user to perform all requested actions.
  - To click something: You MUST FIRST use the "screenshot" tool immediately before EVERY single click to get fresh coordinates. NEVER reuse old coordinates, as the page layout shifts constantly. Read the coordinates from the NEW result and then use the "click" tool.
  - When outputting JSON, NEVER use raw newlines inside strings. You MUST use escaped newlines (\n).
  - After you use a tool, you will receive a response. You can then use another tool, or if you are finished, provide a final text response.
  
  EXAMPLES:

User: Go to Amazon.
{"thought": "I need to load a new URL in the current tab.", "action": "navigate", "params": {"url": "https://amazon.com"}}

User: Open spotify in a new tab.
{"thought": "I will open Spotify in a new background tab.", "action": "openTab", "params": {"url": "https://open.spotify.com"}}

User: Switch to the YouTube tab
{"thought": "I need to find the YouTube tab ID first.", "action": "getTabs", "params": {}}

User: (Tabs provided showing YouTube is ID 456)
{"thought": "I found the YouTube tab. I will switch the browser's active tab to it.", "action": "switchTab", "params": {"tabId": 456}}

User: Close this tab
{"thought": "I will close the current tab. I need to know its ID, or I can just use a shortcut. Wait, I will use closeTab on the active tab ID. If I don't know it, I will fetch getTabs first. Let's assume it's tab 123.", "action": "closeTab", "params": {"tabId": 123}}

User: Reopen the tab I just closed
{"thought": "I need to find the recently closed tabs first.", "action": "getRecentlyClosedTabs", "params": {}}

User: (List provided showing session ID)
{"thought": "I will restore the closed tab using its session ID.", "action": "restoreTab", "params": {"sessionId": "example_id"}}

User: Scroll down to read more
{"thought": "I need to scroll the page vertically.", "action": "scroll", "params": {"x": 0, "y": 800, "direction": "down"}}

User: Click the login button
{"thought": "I must take a screenshot FIRST to find the exact element ID of the login button.", "action": "screenshot", "params": {}}

User: (Screenshot provided showing login button is ID 15)
{"thought": "I see the login button has the number 15 over it, so I will click element 15.", "action": "clickElement", "params": {"id": 15}}

User: Click exactly at the top left corner of the video player
{"thought": "The element doesn't have a bounding box number, but I can estimate the coordinates from the 5x5 grid in the screenshot.", "action": "click", "params": {"x": 200, "y": 350}}

User: Type my email address
{"thought": "I will type the email address into the currently focused input field.", "action": "type", "params": {"text": "user@example.com"}}

User: Copy the data from the first sheet into a new sheet (Canvas App)
{"thought": "In Canvas apps, app-specific formulas are more reliable than general Ctrl+C/V shortcuts. I will press Shift+F11 to create a new sheet, then type an ARRAYFORMULA to pull the data directly.", "action": "pressKey", "params": {"key": "F11", "times": 1, "modifiers": ["Shift"]}}

User: Read all the text on this standard HTML article
{"thought": "This is a standard HTML site, so I can extract all the text directly from the DOM.", "action": "readPage", "params": {}}

User: Delete all my tweets on this page
{"thought": "I will use executeJavascript to run a script that clicks all delete buttons, which is much faster than doing it manually.", "action": "executeJavascript", "params": {"script": "document.querySelectorAll('[data-testid=\\\"tweetButton\\\"]').forEach(b => b.click())"}}

User: Check if my download finished
{"thought": "I will query the browser's download manager.", "action": "checkDownloads", "params": {}}

User: Find the link I visited yesterday about 'machine learning'
{"thought": "I will search the browser history.", "action": "searchHistory", "params": {"query": "machine learning", "maxResults": 20}}

User: Search my bookmarks for 'news'
{"thought": "I will search the user's saved bookmarks.", "action": "searchBookmarks", "params": {"query": "news"}}

User: What are my most visited sites?
{"thought": "I will check the browser's top sites.", "action": "getTopSites", "params": {}}

User: Disable my adblocker extension
{"thought": "I first need to get the list of extensions to find the adblocker's ID.", "action": "getExtensions", "params": {}}

User: (Extensions provided)
{"thought": "I found the extension ID. I will disable it.", "action": "manageExtension", "params": {"id": "abdefg123456", "enabled": false}}

User: Clear my cache and cookies
{"thought": "I will clear the browsing data as requested.", "action": "clearBrowsingData", "params": {"types": ["cache", "cookies"]}}

User: Get my session cookies for this site
{"thought": "I will extract the cookies for the current domain.", "action": "getCookies", "params": {"domain": "example.com"}}

User: Read the data from this Google Sheet
{"thought": "This is a Canvas app. The DOM is empty. I MUST wiretap the canvas first.", "action": "wiretapCanvas", "params": {}}

User: (Wiretap installed)
{"thought": "I must force a redraw so the wiretap catches the text. I will press an arrow key.", "action": "pressKey", "params": {"key": "ArrowRight", "times": 1, "modifiers": []}}

User: (Key pressed)
{"thought": "Now I will read the extracted text from the wiretap.", "action": "readCanvasWiretap", "params": {}}`

let state: AgentState = {
  messages: [{ role: "system", content: SYSTEM_PROMPT }],
  selectedChatModel: CHAT_MODEL,
  selectedVisionModel: CHAT_MODEL,
  attachedTabId: null,
  isProcessing: false,
  cancelRequested: false,
  scratchpad: ""
}

// ─── KEEPALIVE ──────────────────────────────────────────────────────────────

// Alarm-based keepalive: fires every 25s to keep SW awake
chrome.alarms.create("keepalive", { periodInMinutes: 0.4 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") {
    // No-op — just waking the service worker
  }
})

// Port-based keepalive: while side panel is open, port stays connected
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "hands-keepalive") {
    port.onDisconnect.addListener(() => {
      console.log("[Hands] Side panel disconnected")
    })
    port.onMessage.addListener((msg) => {
      if (msg.type === "ping") port.postMessage({ type: "pong" })
    })
  }
})

// ─── INIT: ATTACH DEBUGGER ON STARTUP & TAB CHANGES ────────────────────────

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error)

async function ensureDebuggerAttached(tabId: number): Promise<boolean> {
  if (state.attachedTabId === tabId) return true

  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
      // Silently ignore attaching to restricted browser pages to avoid logging errors
      return false
    }
  } catch {}

  // Detach from old tab first
  if (state.attachedTabId !== null) {
    try {
      await chrome.debugger.detach({ tabId: state.attachedTabId })
    } catch {}
    state.attachedTabId = null
  }

  try {
    await chrome.debugger.attach({ tabId }, "1.3")
    state.attachedTabId = tabId
    console.log("[Hands] Debugger attached to tab", tabId)
    return true
  } catch (e: any) {
    if (!e.message?.includes("Cannot access a chrome:// URL")) {
      console.error("[Hands] Failed to attach debugger:", e)
    }
    return false
  }
}

// Re-attach when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ensureDebuggerAttached(activeInfo.tabId)
})

// Detach when tab is removed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (state.attachedTabId === tabId) {
    state.attachedTabId = null
  }
})

// ─── LOAD PERSISTED STATE ────────────────────────────────────────────────────

chrome.storage.local.get(["messages"], (result) => {
  if (result.messages && result.messages.length > 0) {
    state.messages = result.messages
    // Always inject the latest SYSTEM_PROMPT in case the extension code was updated
    if (state.messages[0].role === "system") {
      state.messages[0].content = SYSTEM_PROMPT
    }
  }
})

function persistState() {
  // Strip massive base64 images before saving to storage
  const cleanMessages = state.messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((part) => {
          if (part.type === "image_url") {
            return { type: "text", text: "[SCREENSHOT REMOVED FROM LOGS]" } as ContentPart
          }
          return part
        })
      }
    }
    return msg
  })

  chrome.storage.local.set({
    messages: cleanMessages,
    selectedChatModel: state.selectedChatModel
  })
}

// ─── TOGETHER AI STREAMING CALL ──────────────────────────────────────────────

async function callTogetherAI(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void
) {
  const response = await fetch(TOGETHER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: state.selectedChatModel,
      messages: messages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.3
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Together AI error ${response.status}: ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder("utf-8")
  let fullText = ""
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    buffer += chunk

    if (buffer.trim().startsWith("{") && !buffer.includes("data: ")) {
      try {
        const errJson = JSON.parse(buffer)
        if (errJson.error) {
          const errMsg = errJson.error.message || JSON.stringify(errJson.error)
          fullText += `\n[FATAL API ERROR: ${errMsg}]\n`
          onChunk(`\n[FATAL API ERROR: ${errMsg}]\n`)
          break
        }
      } catch {}
    }

    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data: ")) continue
      const data = trimmed.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const json = JSON.parse(data)
        if (json.error) {
          const errMsg = json.error.message || JSON.stringify(json.error)
          fullText += `\n[STREAM API ERROR: ${errMsg}]\n`
          onChunk(`\n[STREAM API ERROR: ${errMsg}]\n`)
          continue
        }
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          fullText += content
          onChunk(content)
        }
      } catch (e) {
        console.warn("SSE JSON Parse Error for data:", data, e)
      }
    }
  }


  if (!fullText.trim()) {
    const fallbackMsg = "[SYSTEM ERROR: The API returned an entirely blank response. The model likely crashed or silently rejected the image.]"
    fullText = fallbackMsg
    onChunk(fallbackMsg)
  }

  onDone(fullText)
}

// ─── CDP ACTION EXECUTORS ────────────────────────────────────────────────────

async function cdpSend(method: string, params: object = {}): Promise<any> {
  if (state.attachedTabId === null) throw new Error("No tab attached to debugger")
  return chrome.debugger.sendCommand({ tabId: state.attachedTabId }, method, params)
}

async function actionClick(x: number, y: number) {
  await cdpSend("Input.dispatchMouseEvent", { type: "mouseMoved", x, y })
  await cdpSend("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, x, y })
  await cdpSend("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x, y })
  await new Promise(r => setTimeout(r, 600));
    return `Clicked at (${x}, ${y})`
}


async function actionClickElement(id: number) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return "No active tab found"

  const coordResult = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (window as any).__phillsCoords
  })

  lastLabeledCoords = coordResult[0]?.result || []
  const coords = lastLabeledCoords
  const element = coords[id - 1]
  
  if (!element) return `Error: Element ID ${id} not found.`
  
  await actionClick(element.x, element.y)
  return `Clicked element [${id}] at (${element.x}, ${element.y})`
}

async function actionType(text: string) {
  for (const char of text) {
    await cdpSend("Input.dispatchKeyEvent", { type: "keyDown", key: char })
    await cdpSend("Input.dispatchKeyEvent", { type: "char", text: char, unmodifiedText: char })
    await cdpSend("Input.dispatchKeyEvent", { type: "keyUp", key: char })
    await new Promise(r => setTimeout(r, 20)) // tiny delay to let canvas process
  }
  await new Promise(r => setTimeout(r, 600));
    return `Typed: "${text}"`
}

async function actionPressKey(key: string, modifiersList: string[] = [], times: number = 1) {
  let modifiers = 0
  if (modifiersList.includes("Alt")) modifiers |= 1
  if (modifiersList.includes("Control")) modifiers |= 2
  if (modifiersList.includes("Meta") || modifiersList.includes("Command")) modifiers |= 4
  if (modifiersList.includes("Shift")) modifiers |= 8

  const keyMap: Record<string, number> = {
    Backspace: 8, Tab: 9, Enter: 13, Escape: 27,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46
  }
  const windowsVirtualKeyCode = keyMap[key]

  const params: any = { type: "keyDown", key, modifiers }
  if (windowsVirtualKeyCode) {
    params.windowsVirtualKeyCode = windowsVirtualKeyCode
    params.code = key
  }

  for (let i = 0; i < times; i++) {
    params.type = windowsVirtualKeyCode ? "rawKeyDown" : "keyDown"
    await cdpSend("Input.dispatchKeyEvent", params)
    
    // If it's a rawKeyDown for Enter, some browsers need a "char" event too, but for Arrow keys rawKeyDown + keyUp is perfect.
    if (windowsVirtualKeyCode === 13) {
      await cdpSend("Input.dispatchKeyEvent", { type: "char", key: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13 })
    }
    
    params.type = "keyUp"
    await cdpSend("Input.dispatchKeyEvent", params)
  }
  
  await new Promise(r => setTimeout(r, 600));
    return `Pressed key: ${key} ${times > 1 ? `(${times} times)` : ""} ${modifiers > 0 ? `(Modifiers: ${modifiersList.join("+")})` : ""}`
}

async function actionScroll(x: number, y: number, direction: string) {
  const deltaY = direction === "down" ? 500 : -500
  await cdpSend("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x,
    y,
    deltaX: 0,
    deltaY
  })
  return `Scrolled ${direction}`
}

async function actionScreenshot(): Promise<string> {
  const result = await cdpSend("Page.captureScreenshot", { format: "jpeg", quality: 60 })
  return result.data // base64 jpeg
}

async function waitForTabLoad(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId)
  if (tab.status === "complete") return

  return new Promise((resolve) => {
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function actionNavigate(url: string) {
  if (state.attachedTabId === null) throw new Error("No tab attached to debugger")
  await cdpSend("Page.navigate", { url })
  await waitForTabLoad(state.attachedTabId)
  return `Navigated to ${url} (Page fully loaded)`
}

async function actionReadPage(): Promise<string> {
  const result = await cdpSend("Runtime.evaluate", {
    expression: `document.body.innerText.slice(0, 4000)`,
    returnByValue: true
  })
  return result.result?.value || "Could not read page"
}

async function actionGetTabs(): Promise<string> {
  const tabs = await chrome.tabs.query({})
  const summary = tabs.map((t) => `[${t.id}] ${t.title} — ${t.url}`).join("\n")
  return summary
}

async function actionOpenTab(url: string) {
  const tab = await chrome.tabs.create({ url })
  if (tab.id) {
    await waitForTabLoad(tab.id)
  }
  return `Opened new tab [${tab.id}]: ${url} (Page fully loaded)`
}

async function actionCloseTab(tabId: number) {
  await chrome.tabs.remove(tabId)
  return `Closed tab ${tabId}`
}

async function actionSwitchTab(tabId: number) {
  await chrome.tabs.update(tabId, { active: true })
  return `Switched to tab ${tabId}`
}


// Removed actionTryAutofill


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
  await new Promise(r => setTimeout(r, 600)); // Let the canvas finish redrawing before reading
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return "No active tab found"

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => {
      const texts = (window as any).__canvasText || [];
        (window as any).__canvasText = [];
        return texts;
    }
  })

  const texts = result[0]?.result || []
  if (texts.length === 0) return "No text captured yet. Make sure the wiretap is installed and the canvas has rendered new text."

  // Deduplicate and group by approximate Y coordinate (rows)
  const uniqueTexts = Array.from(new Set(texts.map((t: any) => t.text)))
  const preview = uniqueTexts.slice(0, 1000).join("\n")
  return "Captured Canvas Text (" + uniqueTexts.length + " items):\n" + preview
}

async function actionExecuteJavascript(script: string): Promise<string> {
  try {
    const result = await cdpSend("Runtime.evaluate", {
      expression: script,
      awaitPromise: true,
      returnByValue: true
    })
    if (result.exceptionDetails) {
      return "Script execution failed: " + (result.exceptionDetails.exception?.description || JSON.stringify(result.exceptionDetails))
    }
    return "Script executed successfully. Return value: " + JSON.stringify(result.result?.value || null)
  } catch (err: any) {
    return "Script execution failed: " + err.message
  }
}

async function actionSearchHistory(query: string, maxResults: number = 50): Promise<string> {
  const results = await chrome.history.search({ text: query, maxResults })
  if (results.length === 0) return "No history found for: " + query
  return results.map((r) => `${r.title} — ${r.url}`).join("\n")
}

// ─── LABEL PAGE (Set-of-Marks) ───────────────────────────────────────────────

async function actionLabelPage(): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return { error: "No active tab found" }

  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Clean old visible labels if any exist from before
      document.querySelectorAll(".hands-label, .hands-grid").forEach((el) => el.remove())

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      const SELECTORS = [
        "a", "button", "input", "select", "textarea",
        "[onclick]", "[role='button']", "[role='link']",
        "[role='menuitem']", "[role='tab']", "[role='checkbox']",
        "[tabindex]", "[contenteditable]"
      ]

      const elements = Array.from(document.querySelectorAll(SELECTORS.join(",")))
        .filter((el) => {
          const rect = el.getBoundingClientRect()
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
          )
        })

      // Store coords for lookup and for background drawing
      ;(window as any).__handsCoords = elements.map((el) => {
        const rect = el.getBoundingClientRect()
        
        const center = { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
        const topLeft = { x: Math.round(rect.left + rect.width * 0.1), y: Math.round(rect.top + rect.height * 0.1) }
        const topRight = { x: Math.round(rect.right - rect.width * 0.1), y: Math.round(rect.top + rect.height * 0.1) }
        const bottomLeft = { x: Math.round(rect.left + rect.width * 0.1), y: Math.round(rect.bottom - rect.height * 0.1) }
        
        const isPointGood = (x: number, y: number) => {
          const hit = document.elementFromPoint(x, y)
          return hit && (hit === el || el.contains(hit))
        }

        let bestPoint = center
        if (!isPointGood(center.x, center.y)) {
          if (isPointGood(topLeft.x, topLeft.y)) bestPoint = topLeft
          else if (isPointGood(topRight.x, topRight.y)) bestPoint = topRight
          else if (isPointGood(bottomLeft.x, bottomLeft.y)) bestPoint = bottomLeft
        }

        return {
          x: bestPoint.x,
          y: bestPoint.y,
          rectLeft: rect.left,
          rectTop: rect.top,
          tag: el.tagName,
          text: (el as HTMLElement).innerText?.slice(0, 40) || (el as HTMLInputElement).placeholder || ""
        }
      })

      return { dpr, width, height, coords: (window as any).__handsCoords };
    }
  })

  return result[0]?.result || { error: "Failed to gather labels" }
}

async function drawStealthLabels(b64: string, data: any): Promise<string> {
  try {
    const res = await fetch(`data:image/jpeg;base64,${b64}`)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    
    const dpr = data.dpr || 1
    
    // Draw 5x5 grid
    const cols = 5;
    const rows = 5;
    const cellWidth = (data.width * dpr) / cols;
    const cellHeight = (data.height * dpr) / rows;
    
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round(c * cellWidth);
        const y = Math.round(r * cellHeight);
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        const labelX = x + cellWidth / 2;
        const labelY = y + cellHeight / 2;
        const realX = Math.round((c * (data.width/cols)) + (data.width/cols)/2);
        const realY = Math.round((r * (data.height/rows)) + (data.height/rows)/2);
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(labelX - 25, labelY - 10, 50, 20);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${realX},${realY}`, labelX, labelY);
      }
    }
    
    // Draw Labels
    ctx.font = "bold 10px monospace";
    data.coords.forEach((item: any, idx: number) => {
      const text = String(idx + 1);
      const textWidth = ctx.measureText(text).width;
      const boxWidth = Math.max(16, textWidth + 8);
      const boxHeight = 16;
      
      const px = item.rectLeft * dpr;
      const py = item.rectTop * dpr;
      
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(px, py, boxWidth, boxHeight);
      
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px + boxWidth / 2, py + boxHeight / 2);
    })
    
    const outBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.6 })
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string).split(',')[1]);
      };
      reader.readAsDataURL(outBlob);
    })
  } catch(e) {
    console.error("Stealth draw failed:", e)
    return b64 
  }
}

async function actionCheckDownloads(): Promise<string> {
  const downloads = await chrome.downloads.search({
    orderBy: ["-startTime"],
    limit: 3
  })
  if (downloads.length === 0) return "No recent downloads found."
  return "Recent downloads:\n" + downloads.map(d => `- File: ${d.filename} (State: ${d.state}, Bytes: ${d.bytesReceived}/${d.totalBytes})`).join("\n")
}

async function actionGetRecentlyClosedTabs(): Promise<string> {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 10 })
  if (sessions.length === 0) return "No recently closed tabs."
  return sessions.map(s => {
    if (s.tab) return `[TAB] SessionId: ${s.tab.sessionId} — ${s.tab.title} (${s.tab.url})`
    if (s.window) return `[WINDOW] SessionId: ${s.window.sessionId} — Window with ${s.window.tabs?.length || 0} tabs`
    return ""
  }).filter(Boolean).join("\n")
}

async function actionRestoreTab(sessionId: string): Promise<string> {
  try {
    await chrome.sessions.restore(sessionId)
    return `Restored session ${sessionId}`
  } catch (e: any) {
    return `Failed to restore: ${e.message}`
  }
}

async function actionGetTopSites(): Promise<string> {
  const sites = await chrome.topSites.get()
  return sites.map(s => `${s.title} — ${s.url}`).join("\n")
}

async function actionGetExtensions(): Promise<string> {
  const exts = await chrome.management.getAll()
  return exts.map(e => `[${e.id}] ${e.name} (Enabled: ${e.enabled}, Type: ${e.type})`).join("\n")
}

async function actionManageExtension(id: string, enabled: boolean): Promise<string> {
  try {
    await chrome.management.setEnabled(id, enabled)
    return `Extension ${id} is now ${enabled ? "enabled" : "disabled"}`
  } catch (e: any) {
    return `Failed to manage extension: ${e.message}`
  }
}

async function actionGetCookies(domain: string): Promise<string> {
  const cookies = await chrome.cookies.getAll({ domain })
  if (cookies.length === 0) return `No cookies found for ${domain}`
  return cookies.map(c => `${c.name}=${c.value.slice(0,20)}${c.value.length > 20 ? '...' : ''} (Domain: ${c.domain}, Path: ${c.path})`).join("\n")
}

async function actionClearBrowsingData(types: string[]): Promise<string> {
  const dataToRemove: any = {}
  types.forEach(t => { dataToRemove[t] = true })
  await chrome.browsingData.remove({ since: 0 }, dataToRemove)
  return `Cleared browsing data: ${types.join(", ")}`
}

async function actionSearchBookmarks(query: string): Promise<string> {
  const bookmarks = await chrome.bookmarks.search(query)
  if (bookmarks.length === 0) return `No bookmarks found for: ${query}`
  return bookmarks.map(b => `${b.title} — ${b.url}`).join("\n")
}

// ─── TOOL EXECUTOR ───────────────────────────────────────────────────────────

async function actionUpdateScratchpad(text: string): Promise<string> {
  state.scratchpad = text;
  return "Scratchpad successfully updated.";
}

async function actionReadScratchpad(): Promise<string> {
  if (!state.scratchpad) return "Scratchpad is empty.";
  return "Current Scratchpad Contents:\n" + state.scratchpad;
}

async function executeTool(
  action: string,
  params: Record<string, any>
): Promise<{ result: string; screenshotBase64?: string }> {
  // Ensure debugger is attached for CDP actions
  const cdpActions = ["click", "type", "scroll", "screenshot", "navigate", "readPage", "pressKey", "clearField", "executeJavascript"]
  if (cdpActions.includes(action)) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url?.startsWith("chrome://") || tab?.url?.startsWith("edge://")) {
      return { result: "ERROR: Cannot execute actions on chrome:// or edge:// security pages. Ask the user to navigate to a normal website first." }
    }
    if (tab?.id) {
      const attached = await ensureDebuggerAttached(tab.id)
      if (!attached) return { result: "ERROR: Failed to attach debugger to this page." }
    }
  }

  switch (action) {
    case "click":
      return { result: await actionClick(params.x, params.y) }
    case "clickElement":
      return { result: await actionClickElement(params.id) }
    case "type":
      return { result: await actionType(params.text) }
    case "pressKey":
      return { result: await actionPressKey(params.key, params.modifiers, params.times) }
    case "scroll":
      return { result: await actionScroll(params.x || 0, params.y || 300, params.direction || "down") }
    case "screenshot": {
      await new Promise(r => setTimeout(r, 800)); // Let the UI settle before capturing
      const data = await actionLabelPage()
      if (data.error) {
        const b64 = await actionScreenshot()
        return { result: data.error, screenshotBase64: b64 }
      }
      
      const cleanB64 = await actionScreenshot()
      const finalB64 = await drawStealthLabels(cleanB64, data)
      
      const summary = `Screenshot taken with ${data.coords?.length || 0} numbered boxes drawn over interactive elements.\nA 5x5 coordinate grid is also rendered for Canvas areas. To click a numbered box, use the 'clickElement' tool. To click an unlabeled Canvas area, use the 'click' tool with estimated x,y coordinates.`
      
      return { result: summary, screenshotBase64: finalB64 }
    }
    case "navigate":
      return { result: await actionNavigate(params.url) }
    case "readPage":
      return { result: await actionReadPage() }
    case "getTabs":
      return { result: await actionGetTabs() }
    case "openTab":
      return { result: await actionOpenTab(params.url) }
    case "closeTab":
      return { result: await actionCloseTab(params.tabId) }
    case "switchTab":
      return { result: await actionSwitchTab(params.tabId) }
    

    
    case "wiretapCanvas":
      return { result: await actionWiretapCanvas() }
    case "readCanvasWiretap":
      return { result: await actionReadCanvasWiretap() }
    case "updateScratchpad":
        return { result: await actionUpdateScratchpad(params.text) }
      case "readScratchpad":
        return { result: await actionReadScratchpad() }
      case "executeJavascript":

      return { result: await actionExecuteJavascript(params.script) }
    case "searchHistory":
      return { result: await actionSearchHistory(params.query, params.maxResults) }
    case "labelPage":
      return { result: await actionLabelPage() }
    case "checkDownloads":
      return { result: await actionCheckDownloads() }
    case "getRecentlyClosedTabs":
      return { result: await actionGetRecentlyClosedTabs() }
    case "restoreTab":
      return { result: await actionRestoreTab(params.sessionId) }
    case "getTopSites":
      return { result: await actionGetTopSites() }
    case "getExtensions":
      return { result: await actionGetExtensions() }
    case "manageExtension":
      return { result: await actionManageExtension(params.id, params.enabled) }
    case "getCookies":
      return { result: await actionGetCookies(params.domain) }
    case "clearBrowsingData":
      return { result: await actionClearBrowsingData(params.types) }
    case "searchBookmarks":
      return { result: await actionSearchBookmarks(params.query) }
    default:
      return { result: `Unknown action: ${action}` }
  }
}

// ─── PARSE TOOL CALL FROM RESPONSE ──────────────────────────────────────────

function parseToolCall(text: string): { action: string; params: Record<string, any> } | null {
  try {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      const obj = JSON.parse(jsonStr);
      
      // Standard custom JSON mode format
      if (obj.action && obj.params) {
        return obj;
      }
      
      // Inkling Native Tool Calling format (name/args)
      if (obj.name && obj.args) {
        return { action: obj.name, params: obj.args };
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallback aggressive regex
  try {
    const match = text.match(/\{[\s\S]*"(?:action|name)"\s*:[\s\S]*"(?:params|args)"\s*:[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]);
      if (obj.action && obj.params) {
        return obj;
      }
      if (obj.name && obj.args) {
        return { action: obj.name, params: obj.args };
      }
    }
  } catch (e) {}

  return null
}

// ─── MAIN AGENT LOOP ─────────────────────────────────────────────────────────

async function cleanPageLabels() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.querySelectorAll(".hands-label").forEach((el) => el.remove())
      })
    }
  } catch {}
}

async function runAgentLoop(
  userMessage: string,
  sendChunk: (chunk: string) => void,
  sendStatus: (status: string) => void,
  sendDone: (fullReply: string) => void,
  sendScreenshot: (b64: string) => void
) {
  // Get current tab context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabContext = tab ? `[Context: Active Tab is "${tab.title}" at ${tab.url}]\n` : ""

  // Add user message to history with tab context
  state.messages.push({ role: "user", content: tabContext + userMessage })
  state.isProcessing = true
  state.cancelRequested = false

  let loopCount = 0
  const MAX_LOOPS = 30

  while (loopCount < MAX_LOOPS) {
    if (state.cancelRequested) {
      sendDone("Agent stopped by user.")
      break
    }

    loopCount++

    let fullReply = ""
    
    // Call Together AI
    try {
      // Create a payload that strips out old images to prevent 413 Payload Too Large
      const payloadMessages = [...state.messages]
      let foundLatestImage = false
      for (let i = payloadMessages.length - 1; i >= 0; i--) {
        const msg = payloadMessages[i]
        if (Array.isArray(msg.content)) {
          payloadMessages[i] = {
            ...msg,
            content: msg.content.map((part) => {
              if (part.type === "image_url") {
                if (!foundLatestImage) {
                  foundLatestImage = true
                  return part // Keep the latest image
                } else {
                  return { type: "text", text: "[SCREENSHOT REMOVED TO SAVE PAYLOAD SIZE]" } as any // Strip older images
                }
              }
              if (part.type === "text" && foundLatestImage && part.text.startsWith("Tool result for screenshot:")) {
                return { type: "text", text: "Tool result for screenshot: [OLD SCREENSHOT DATA AND LABELS REMOVED TO SAVE TOKENS]" } as any
              }
              return part
            })
          }
        }
      }

      await callTogetherAI(
        payloadMessages,
        (chunk) => sendChunk(chunk),
        (full) => { fullReply = full }
      )
    } catch (e: any) {
      fullReply = `ERROR calling AI: ${e.message}`
    }

    // Add assistant reply to history
    state.messages.push({ role: "assistant", content: fullReply })

    // Check for a tool call
    const toolCall = parseToolCall(fullReply)

    if (!toolCall) {
      // No tool call — we're done, clean up labels
      await cleanPageLabels()
      persistState()
      state.isProcessing = false
      sendDone(fullReply)
      return
    }

    // Execute the tool
    sendStatus(`Executing: ${toolCall.action}...`)

    try {
      const { result, screenshotBase64 } = await executeTool(toolCall.action, toolCall.params)

      if (screenshotBase64) {
        sendScreenshot(screenshotBase64)
        // Feed screenshot back to model as vision message
        state.messages.push({
          role: "user",
          content: [
            { type: "text", text: `Tool result for ${toolCall.action}: ${result}. Here is the screenshot:` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } }
          ]
        })
      } else {
        // Feed text result back
        state.messages.push({
          role: "user",
          content: `Tool result for ${toolCall.action}: ${result}`
        })
      }
    } catch (e: any) {
      state.messages.push({
        role: "user",
        content: `Tool error for ${toolCall.action}: ${e.message}`
      })
    }
  }

  // Hit loop limit
  await cleanPageLabels()
  state.isProcessing = false
  persistState()
  sendDone("I've reached the maximum number of consecutive actions (30) for a single request to prevent infinite loops. If the task isn't finished, you can ask me to continue.")
}

// ─── MESSAGE HANDLER FROM SIDE PANEL ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CHAT") {
    const { text } = message

    // In-memory accumulator to avoid race conditions on rapid chunk writes
    let localBuffer = ""
    chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })

    runAgentLoop(
      text,
      // onChunk: accumulate locally, write full buffer atomically
      (chunk) => {
        localBuffer += chunk
        chrome.storage.local.set({ streamBuffer: localBuffer })
      },
      // onStatus
      (status) => {
        chrome.storage.local.set({ streamStatus: status })
      },
      // onDone: write final full reply
      (full) => {
        localBuffer = full
        chrome.storage.local.set({ streamDone: true, streamBuffer: full })
      },
      // onScreenshot
      (b64) => {
        chrome.storage.local.set({ streamScreenshot: b64 })
      }
    )

    sendResponse({ ok: true })
    return true
  }

  if (message.type === "STOP") {
    state.cancelRequested = true
    sendResponse({ ok: true })
    return true
  }

  if (message.type === "CLEAR_HISTORY") {
    state.messages = [{ role: "system", content: SYSTEM_PROMPT }]
    persistState()
    sendResponse({ ok: true })
    return true
  }

  if (message.type === "SET_MODEL") {
    if (message.modelType === "chat") {
      state.selectedChatModel = message.model
    }
    persistState()
    sendResponse({ ok: true })
    return true
  }

  if (message.type === "GET_STATE") {
    sendResponse({
      selectedChatModel: state.selectedChatModel,
      messageCount: state.messages.length
    })
    return true
  }
})
