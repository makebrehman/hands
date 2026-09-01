import { useEffect, useRef, useState } from "react"
import "./sidepanel.css"

// ─── MODELS ──────────────────────────────────────────────────────────────────

const CHAT_MODELS = [
  { id: "meta-models/Muse-Glimmer-30B", label: "Muse Glimmer 30B" },
  { id: "MiniMaxAI/MiniMax-M3", label: "MiniMax M3" },
  { id: "Qwen/Qwen3.5-9B", label: "Qwen 3.5 9B" },
  { id: "moonshotai/Kimi-K3", label: "Kimi K3 (Experimental)" },
  { id: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", label: "Llama 3.2 90B Vision (Uncensored Default)" },
  { id: "zai-org/GLM-5.3-Flash", label: "GLM 5.3 Flash (Censored/Legacy)" }
]

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  screenshot?: string
  isStreaming?: boolean
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function SidePanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [msgCount, setMsgCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [chatModel, setChatModel] = useState(CHAT_MODELS[0].id)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── KEEPALIVE PORT ────────────────────────────────────────────────────────

  useEffect(() => {
    portRef.current = chrome.runtime.connect({ name: "hands-keepalive" })
    const heartbeat = setInterval(() => {
      portRef.current?.postMessage({ type: "ping" })
    }, 20000)

    return () => {
      clearInterval(heartbeat)
      portRef.current?.disconnect()
    }
  }, [])

  // ─── LOAD STATE ────────────────────────────────────────────────────────────

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      if (res?.selectedChatModel) setChatModel(res.selectedChatModel)
      setMsgCount(res?.messageCount || 1)
    })
    chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
  }, [])

  // ─── AUTO SCROLL ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  // ─── POLL FOR STREAMING RESPONSE ───────────────────────────────────────────

  function startPolling() {
    let lastBuffer = ""

    pollingRef.current = setInterval(async () => {
      const result = await chrome.storage.local.get(["streamBuffer", "streamDone", "streamStatus", "streamScreenshot"])

      // Update status indicator
      if (result.streamStatus) setStatus(result.streamStatus)

      // Update streaming message
      if (result.streamBuffer && result.streamBuffer !== lastBuffer) {
        lastBuffer = result.streamBuffer
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === "assistant" && last.isStreaming) {
            copy[copy.length - 1] = { ...last, text: result.streamBuffer }
          } else {
            copy.push({ role: "assistant", text: result.streamBuffer, isStreaming: true })
          }
          return copy
        })
      }

      // Show screenshot if agent took one
      if (result.streamScreenshot) {
        chrome.storage.local.set({ streamScreenshot: null })
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last) copy[copy.length - 1] = { ...last, screenshot: result.streamScreenshot }
          return copy
        })
      }

      // Done
      if (result.streamDone) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === "assistant") copy[copy.length - 1] = { ...last, isStreaming: false }
          return copy
        })
        setIsLoading(false)
        setStatus("")
        chrome.storage.local.set({ streamDone: false })
      }
    }, 150)
  }

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput("")
    setIsLoading(true)
    setMessages((prev) => [...prev, { role: "user", text }])

    chrome.runtime.sendMessage({ type: "CHAT", text }, () => {
      startPolling()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function stopAgent() {
    chrome.runtime.sendMessage({ type: "STOP" })
    setIsLoading(false)
    setStatus("")
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // ─── CLEAR HISTORY ──────────────────────────────────────────────────────────

  function clearHistory() {
    chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => {
      setMessages([])
      setMsgCount(1)
    })
  }

  const downloadLogs = async () => {
    const data = await chrome.storage.local.get("messages")
    const cleanMessages = (data.messages || []).map((msg: any) => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((part: any) => {
            if (part.type === "image_url") {
              return { type: "text", text: "[SCREENSHOT REMOVED FROM LOGS]" }
            }
            return part
          })
        }
      }
      return msg
    })

    const blob = new Blob([JSON.stringify(cleanMessages, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "hands-logs.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ─── MODEL CHANGE ───────────────────────────────────────────────────────────

  function handleChatModelChange(model: string) {
    setChatModel(model)
    chrome.runtime.sendMessage({ type: "SET_MODEL", modelType: "chat", model })
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="hands-root">
      {/* Header */}
      <div className="hands-header">
        <div className="hands-logo">
          <span className="hands-logo-dot" />
          <span className="hands-logo-name">Hands <span style={{fontSize: '0.5em', opacity: 0.6, verticalAlign: 'middle'}}>v1.4.1</span></span>
          {msgCount > 1 && <span className="hands-msg-count">{msgCount - 1} msgs</span>}
        </div>
        <div className="hands-header-actions">
          <button
            className="hands-icon-btn hands-clear-btn"
            title="Download Logs"
            onClick={downloadLogs}>
            ⬇️
          </button>
          <button
            className="hands-icon-btn hands-clear-btn"
            title="New Chat (Clears History)"
            onClick={clearHistory}>
            ➕
          </button>
          <button
            className="hands-icon-btn"
            title="Settings"
            onClick={() => setShowSettings((v) => !v)}>
            ⚙
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="hands-settings">
          <div className="hands-setting-group">
            <label>Model</label>
            <select value={chatModel} onChange={(e) => handleChatModelChange(e.target.value)}>
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="hands-messages">
        {messages.length === 0 && (
          <div className="hands-empty">
            <div className="hands-empty-icon">◆</div>
            <p>Tell me what to do.</p>
            <p className="hands-empty-hint">I can click, type, navigate, search history, open tabs, take screenshots, and more.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`hands-msg hands-msg-${msg.role}`}>
            {msg.role === "assistant" && (
              <div className="hands-msg-label">Hands{msg.isStreaming && <span className="hands-cursor" />}</div>
            )}
            <div className="hands-msg-bubble">
              <MessageContent text={msg.text} />
              {msg.screenshot && (
                <div className="hands-screenshot">
                  <img src={`data:image/jpeg;base64,${msg.screenshot}`} alt="Screenshot" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Status bar */}
        {status && (
          <div className="hands-status">
            <span className="hands-status-dot" />
            {status}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="hands-input-area">
        <textarea
          ref={inputRef}
          className="hands-input"
          placeholder="Tell Hands what to do..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            className="hands-send-btn"
            style={{ backgroundColor: '#dc3545', color: 'white', borderColor: '#dc3545' }}
            title="Force Stop Agent"
            onClick={stopAgent}>
            ⏹
          </button>
        ) : (
          <button
            className="hands-send-btn"
            onClick={sendMessage}
            disabled={!input.trim()}>
            ↑
          </button>
        )}
      </div>
    </div>
  )
}

// ─── MESSAGE CONTENT ──────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  navigate: "🌐 Navigating",
  click: "🖱 Clicking",
  type: "⌨️ Typing",
  pressKey: "⌨️ Key press",
  scroll: "↕ Scrolling",
  screenshot: "📸 Screenshot",
  labelPage: "🏷 Labeling page",
  readPage: "📄 Reading page",
  openTab: "➕ Opening tab",
  closeTab: "✕ Closing tab",
  switchTab: "⇄ Switching tab",
  getTabs: "📑 Getting tabs",
  searchHistory: "🔍 Searching history"
}

function parseActionFromText(text: string): { action: string; params: Record<string, any> } | null {
  const actionMatch = text.match(/ACTION:\s*(\{[\s\S]*?\})\s*(?:\n|$)/)
  if (actionMatch) {
    try {
      return JSON.parse(actionMatch[1])
    } catch {}
  }

  const tagMatch = text.match(/<tool>([\s\S]*?)<\/tool>/)
  if (tagMatch) {
    try {
      return JSON.parse(tagMatch[1])
    } catch {}
  }

  const rawMatch = text.match(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*\}/)
  if (rawMatch) {
    try {
      return JSON.parse(rawMatch[0])
    } catch {}
  }

  return null
}

function MessageContent({ text }: { text: string }) {
  const tool = parseActionFromText(text)

  // Strip all tool-related content from visible text
  let cleanText = text
    .replace(/ACTION:\s*\{[\s\S]*?\}(?:\n|$)/g, "")
    .trim()

  const hasText = cleanText.length > 0
  const label = tool ? (ACTION_LABELS[tool.action] || `⚡ ${tool.action}`) : null

  return (
    <div className="hands-msg-text">
      {label && (
        <span className="hands-action-badge">{label}</span>
      )}
      {hasText && label && <br />}
      {hasText && cleanText.split("\n").map((line, i, arr) => (
        <span key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
      {!hasText && !label && <span className="hands-thinking">…</span>}
    </div>
  )
}
