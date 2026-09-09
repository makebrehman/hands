import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import "./sidepanel.css"
import { HandsLogo } from "./HandsLogo"
import { saveChat, getAllChats, deleteChat, getChat } from "./utils/db"
import type { ChatSession } from "./utils/db"

const CHAT_MODELS = [
  { id: "qwen/qwen3.8-max-0902", label: "Qwen 3.8 Max 0902" },
  { id: "meta-models/Muse-Glimmer-30B", label: "Muse Glimmer 30B" },
  { id: "MiniMaxAI/MiniMax-M3", label: "MiniMax M3" },
  { id: "Qwen/Qwen3.5-9B", label: "Qwen 3.5 9B" },
  { id: "moonshotai/Kimi-K3", label: "Kimi K3 (Experimental)" },
  { id: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo", label: "Llama 3.2 90B Vision (Uncensored Default)" },
  { id: "zai-org/GLM-5.3-Flash", label: "GLM 5.3 Flash (Censored/Legacy)" }
]

interface ChatMessage {
  role: "user" | "assistant"
  text: string
  screenshot?: string
  images?: string[]
  isStreaming?: boolean
  isError?: boolean
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export default function SidePanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [msgCount, setMsgCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [useCustomProvider, setUseCustomProvider] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [customModel, setCustomModel] = useState("")
  
  // Phase 3 State
  const [chatId, setChatId] = useState<string>(generateId())
  const [chats, setChats] = useState<ChatSession[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [toasts, setToasts] = useState<{id: string, text: string, type: string}[]>([])
  const [approvalReq, setApprovalReq] = useState<any>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    loadChats()
    
    portRef.current = chrome.runtime.connect({ name: "hands-keepalive" })
    const heartbeat = setInterval(() => {
      portRef.current?.postMessage({ type: "ping" })
    }, 20000)

    // Listen for background events (approvals, errors)
    const handleMsg = (msg: any) => {
      if (msg.type === "REQUIRE_APPROVAL") {
        setApprovalReq(msg.payload)
      } else if (msg.type === "AGENT_ERROR") {
        showToast(msg.error, "error")
        setMessages(prev => {
          const copy = [...prev]
          if (copy.length > 0) {
            copy[copy.length - 1] = { ...copy[copy.length - 1], isError: true }
          }
          return copy
        })
        setIsLoading(false)
        setStatus("")
      }
    }
    chrome.runtime.onMessage.addListener(handleMsg)

    return () => {
      clearInterval(heartbeat)
      portRef.current?.disconnect()
      chrome.runtime.onMessage.removeListener(handleMsg)
    }
  }, [])

  useEffect(() => {
    chrome.storage.local.get(["apiKey", "baseUrl", "useCustomProvider", "customModel"], (storage) => {
      if (storage.apiKey) setApiKey(storage.apiKey)
      if (storage.baseUrl) setBaseUrl(storage.baseUrl)
      if (storage.useCustomProvider !== undefined) setUseCustomProvider(storage.useCustomProvider)
      if (storage.customModel) setCustomModel(storage.customModel)
    })
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
      if (res?.messages && res.messages.length > 0) {
        setMessages(res.messages)
        setChatId(res.chatId || generateId())
      }
      setMsgCount(res?.messageCount || 1)
    })
    chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, status])

  // Save chat to DB whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      getChat(chatId).then(existing => {
        let newUpdatedAt = existing ? existing.updatedAt : Date.now();
        // Bump timestamp if it's new, if messages were added, or if currently streaming
        if (!existing || existing.messages.length !== messages.length || messages[messages.length - 1].isStreaming) {
          newUpdatedAt = Date.now();
        }
        saveChat({
          id: chatId,
          title: messages[0].text.substring(0, 30) + "...",
          updatedAt: newUpdatedAt,
          messages: messages
        }).then(() => loadChats())
      })
    }
  }, [messages, chatId])

  async function loadChats() {
    const all = await getAllChats()
    setChats(all)
  }

  function showToast(text: string, type: "error"|"success" = "success") {
    const id = generateId()
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  function startPolling() {
    let lastBuffer = ""

    pollingRef.current = setInterval(async () => {
      const result = await chrome.storage.local.get(["streamBuffer", "streamDone", "streamStatus", "streamScreenshot"])

      if (result.streamStatus) setStatus(result.streamStatus)

      if (result.streamBuffer !== undefined && result.streamBuffer !== lastBuffer) {
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

      if (result.streamScreenshot) {
        chrome.storage.local.set({ streamScreenshot: null })
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last) copy[copy.length - 1] = { ...last, screenshot: result.streamScreenshot }
          return copy
        })
      }

      if (result.streamDone) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setIsLoading(false)
        setStatus("")
        chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
        
        setMessages((prev) => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last && last.role === "assistant") {
            let clean = last.text.replace(/```json\s*[\s\S]*?```/g, "").replace(/ACTION:\s*\{[\s\S]*?\}(?:\n|$)/g, "").replace(/<tool>[\s\S]*?<\/tool>/g, "").replace(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*\}/g, "").trim();
            const openBrace = clean.lastIndexOf("{");
            if (openBrace !== -1 && clean.indexOf("}", openBrace) === -1) {
              clean = clean.substring(0, openBrace).trim();
            }
            if (clean.length === 0 && !last.screenshot) {
              copy.pop();
            } else {
              copy[copy.length - 1] = { ...last, isStreaming: false }
            }
          }
          return copy
        })
      }
    }, 100)
  }

  function sendMessage() {
    if (!input.trim() && selectedImages.length === 0) return

    const text = input
    const imagesToSend = [...selectedImages]
    setInput("")
    setSelectedImages([])
    setIsLoading(true)
    setStatus("Thinking...")

    const newMessages = [...messages, { role: "user" as const, text, images: imagesToSend }, { role: "assistant" as const, text: "", isStreaming: true }]
    setMessages(newMessages)

    chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null }, () => {
      chrome.runtime.sendMessage({ type: "CHAT", text, images: imagesToSend, chatId })
      startPolling()
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const MAX_DIM = 800;

          if (width > height && width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    
    const maxFiles = Math.min(files.length, 5 - selectedImages.length);
    if (maxFiles <= 0) return;

    setIsLoading(true);
    const newImages = await Promise.all(
      Array.from(files).slice(0, maxFiles).map(f => processImage(f))
    );
    setSelectedImages(prev => [...prev, ...newImages]);
    setIsLoading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    
    if (imageFiles.length > 0) {
      const maxFiles = Math.min(imageFiles.length, 5 - selectedImages.length);
      if (maxFiles <= 0) return;
      
      setIsLoading(true);
      const newImages = await Promise.all(
        imageFiles.slice(0, maxFiles).map(f => processImage(f))
      );
      setSelectedImages(prev => [...prev, ...newImages]);
      setIsLoading(false);
    }
  }

  function removeImage(index: number) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
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

  function clearHistory() {
    chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => {
      setMessages([])
      setMsgCount(1)
      setChatId(generateId())
    })
  }

  function loadPastChat(c: ChatSession) {
    chrome.runtime.sendMessage({ type: "LOAD_CHAT", messages: c.messages, chatId: c.id }, () => {
      setMessages(c.messages)
      setChatId(c.id)
      setIsSidebarOpen(false)
    })
  }

  function handleApproval(approved: boolean) {
    chrome.runtime.sendMessage({ type: "APPROVAL_RESPONSE", approved })
    setApprovalReq(null)
  }

  function retryLast() {
    setIsLoading(true)
    setStatus("Retrying...")
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0) {
        copy[copy.length - 1] = { ...copy[copy.length - 1], isError: false, isStreaming: true }
      }
      return copy
    })
    chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null }, () => {
      chrome.runtime.sendMessage({ type: "RETRY_CHAT" })
      startPolling()
    });
  }



  return (
    <div className="hands-root">
      {/* Modals & Overlays */}
      {approvalReq && (
        <div className="hands-modal-overlay">
          <div className="hands-modal">
            <div className="hands-modal-title">Approval Required</div>
            <div className="hands-modal-desc">
              The agent wants to perform a sensitive action:<br/><br/>
              <strong>Action:</strong> {approvalReq.action}<br/>
              <strong>Reason:</strong> {approvalReq.reason}
            </div>
            <div className="hands-modal-actions">
              <button className="hands-btn-secondary" onClick={() => handleApproval(false)}>Deny</button>
              <button className="hands-btn-primary" onClick={() => handleApproval(true)}>Approve</button>
            </div>
          </div>
        </div>
      )}

      <div className="hands-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`hands-toast ${t.type === 'error' ? 'hands-toast-error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className={`hands-sidebar ${isSidebarOpen ? 'hands-sidebar-open' : ''}`}>
        <div className="hands-sidebar-header">
          <span>Recent Chats</span>
          <button className="hands-icon-btn" onClick={() => setIsSidebarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="hands-sidebar-list">
          {chats.map(c => (
            <div key={c.id} className={`hands-chat-item ${c.id === chatId ? 'hands-chat-item-active' : ''}`} onClick={() => loadPastChat(c)}>
              <span>{c.title}</span>
              <button className="hands-chat-item-del" onClick={(e) => { e.stopPropagation(); deleteChat(c.id).then(()=>loadChats())}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="hands-header">
        <div className="hands-logo" style={{ cursor: 'pointer' }} onClick={() => setIsSidebarOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          <HandsLogo animated={false} className="hands-header-logo" style={{ marginLeft: '12px' }} />
          <span className="hands-logo-name" style={{ marginLeft: '8px' }}>Hands</span>
        </div>
        <div className="hands-header-actions">
          <button
            className="hands-icon-btn hands-clear-btn"
            title="New Chat"
            onClick={clearHistory}>
            New Chat
          </button>
          <button
            className="hands-icon-btn"
            title="Settings"
            onClick={() => setShowSettings((v) => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>
      </div>

        {showSettings && (
          <div className="hands-settings" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontWeight: 'bold' }}>Use Custom Provider</label>
              <label className="hands-switch">
                <input type="checkbox" checked={useCustomProvider} onChange={(e) => setUseCustomProvider(e.target.checked)} />
                <span className="hands-slider"></span>
              </label>
            </div>

            {useCustomProvider ? (
              <>
                <div className="hands-setting-group">
                  <label>Custom API Key (BYOK)</label>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="Enter your API Key" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>

                <div className="hands-setting-group">
                  <label>Custom Base URL</label>
                  <input 
                    type="text" 
                    value={baseUrl} 
                    onChange={(e) => setBaseUrl(e.target.value)} 
                    placeholder="e.g. https://api.groq.com/openai/v1/chat/completions" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>
                
                <div className="hands-setting-group">
                  <label>Custom Model ID</label>
                  <input 
                    type="text" 
                    value={customModel} 
                    onChange={(e) => setCustomModel(e.target.value)} 
                    placeholder="e.g. llama3-70b-8192" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>
              </>
            ) : (
              <div style={{ padding: '8px', background: 'var(--bg-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--text)' }}>
                Currently using the secure <strong>Hands Cloud</strong> provider.
              </div>
            )}
            
            <button 
              onClick={() => {
                chrome.storage.local.set({ apiKey, baseUrl, useCustomProvider, customModel }, () => {
                  showToast("Settings saved securely", "success")
                })
              }}
              style={{ padding: '8px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Save Settings
            </button>
          </div>
        )}

      <div className="hands-messages">
        {messages.length === 0 && (
          <div className="hands-empty">
            <div className="hands-empty-icon" style={{ marginBottom: '16px' }}>
              <HandsLogo animated={true} className="hands-empty-logo" />
            </div>
            <p>Tell me what to do.</p>
            <p className="hands-empty-hint">I can click, type, navigate, search history, open tabs, take screenshots, and more.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`hands-msg hands-msg-${msg.role}`}>
            <div className="hands-msg-bubble">
              {msg.role === "assistant" && (
                <div style={{ marginBottom: "8px", display: "flex", alignItems: "center" }}>
                  <HandsLogo animated={!!msg.isStreaming} />
                </div>
              )}
              {msg.images && msg.images.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {msg.images.map((img, idx) => (
                    <img key={idx} src={img} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} alt="User Context" />
                  ))}
                </div>
              )}
              <MessageContent text={msg.text} />

              {msg.isError && (
                <button className="hands-retry-btn" onClick={retryLast}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg> Retry
                </button>
              )}
            </div>
          </div>
        ))}

        {status && (
          <div className="hands-status">
            <span className="hands-status-dot" />
            {status}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="hands-input-area" style={{ flexDirection: 'column', gap: '8px' }}>
        {selectedImages.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selectedImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                <button 
                  onClick={() => removeImage(idx)}
                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--bg-4)', color: 'var(--text)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <button 
            className="hands-icon-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Upload Image"
            disabled={selectedImages.length >= 5 || isLoading}
            style={{ alignSelf: 'flex-end', padding: '12px 8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/png, image/jpeg, image/webp, image/gif" 
            multiple 
            style={{ display: 'none' }} 
          />
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg>
            </button>
          ) : (
            <button
              className="hands-send-btn"
              onClick={sendMessage}
              disabled={(!input.trim() && selectedImages.length === 0)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageContent({ text }: { text: string }) {
  let cleanText = text
    .replace(/```json\s*[\s\S]*?```/g, "")
    .replace(/ACTION:\s*\{[\s\S]*?\}(?:\n|$)/g, "")
    .replace(/<tool>[\s\S]*?<\/tool>/g, "")
    .replace(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*\}/g, "")
    .trim()

  const openBrace = cleanText.lastIndexOf('{');
  if (openBrace !== -1 && cleanText.indexOf('}', openBrace) === -1) {
    cleanText = cleanText.substring(0, openBrace).trim();
  }

  const hasText = cleanText.length > 0;

  return (
    <div className="hands-msg-text">
      {hasText && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "")
              return match ? (
                <SyntaxHighlighter
                  {...props}
                  style={vscDarkPlus as any}
                  language={match[1]}
                  PreTag="div"
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              ) : (
                <code {...props} className={className}>
                  {children}
                </code>
              )
            }
          }}
        >
          {cleanText}
        </ReactMarkdown>
      )}
    </div>
  )
}







