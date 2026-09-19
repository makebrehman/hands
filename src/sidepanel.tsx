import React, { useEffect, useRef, useState, Component } from "react"
import type { ErrorInfo, ReactNode } from "react"
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
  
  // Phase 4 State (Auth & Limits)
  const [authToken, setAuthToken] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [tokenLimit, setTokenLimit] = useState<{used: number, max: number} | null>(null)
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false)
  
  // Phase 3 State
  const [chatId, setChatId] = useState<string>(generateId())
  const [chats, setChats] = useState<ChatSession[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [toasts, setToasts] = useState<{id: string, text: string, type: string}[]>([])
  const [approvalReq, setApprovalReq] = useState<any>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editChatTitle, setEditChatTitle] = useState("")

  // Streaming State (Active Buffer)
  const [activeStream, setActiveStream] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const [streamScreenshot, setStreamScreenshot] = useState<string | null>(null)
  const [activeTabUrl, setActiveTabUrl] = useState("")

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
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setStreamError(true)
        setIsLoading(false)
        setIsStreaming(false)
        setStatus("Failed")
        chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
        
        chrome.storage.local.get(["useCustomProvider"], (s) => {
          const isCustom = !!s.useCustomProvider;
          const errMsg = isCustom ? (msg.error || "Failed to communicate with AI provider") : "Hands Cloud is currently experiencing heavy load or network issues. Please try again in a moment.";
          showToast(isCustom ? msg.error : "Hands Cloud server is not responding", "error");
          setMessages(prev => [...prev, {
            role: "assistant",
            isError: true,
            text: errMsg,
            screenshot: streamScreenshot || undefined
          }]);
        });
      }
    }
    chrome.runtime.onMessage.addListener(handleMsg)

    return () => {
      clearInterval(heartbeat)
      portRef.current?.disconnect()
      chrome.runtime.onMessage.removeListener(handleMsg)
    }
  }, [streamScreenshot])

  useEffect(() => {
    chrome.storage.local.get(["apiKey", "baseUrl", "useCustomProvider", "customModel", "authToken", "userEmail"], async (storage) => {
      if (storage.apiKey) setApiKey(storage.apiKey)
      if (storage.baseUrl) setBaseUrl(storage.baseUrl)
      if (storage.useCustomProvider !== undefined) setUseCustomProvider(storage.useCustomProvider)
      if (storage.customModel) setCustomModel(storage.customModel)
      if (storage.userEmail) setUserEmail(storage.userEmail)
      if (storage.authToken) {
        setAuthToken(storage.authToken)
        
        let initialTokens = { used: 0, max: 500000 };
        chrome.runtime.sendMessage({ 
          type: "FETCH_TOKENS", 
          token: storage.authToken, 
          baseUrl: storage.baseUrl || "https://bilinil.vercel.app" 
        }, (res) => {
          if (res?.success) initialTokens = res.data;
          setTokenLimit(initialTokens);
        });
      }
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
  }, [messages, status, activeStream])

  // Save chat to DB whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;
    
    getChat(chatId).then(existing => {
      let newUpdatedAt = existing ? existing.updatedAt : Date.now();
      if (!existing || existing.messages.length !== messages.length) {
        newUpdatedAt = Date.now();
      }
      saveChat({
        id: chatId,
        title: existing?.title || (messages[0].text.substring(0, 30) + "..."),
        updatedAt: newUpdatedAt,
        messages: messages
      }).then(() => loadChats())
    })
  }, [messages, chatId])

  async function loadChats() {
    const all = await getAllChats()
    // Ensure all loaded chats have no active streaming states
    const safeChats = all.map(c => ({
      ...c,
      messages: c.messages.map(m => ({ ...m, isStreaming: false }))
    }))
    setChats(safeChats)
  }

  function showToast(text: string, type: "error"|"success" = "success") {
    const id = generateId()
    const safeText = text && text.length > 160 ? text.substring(0, 160) + "..." : text
    setToasts(prev => [...prev, { id, text: safeText, type }])
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
        setActiveStream(result.streamBuffer)
      }

      if (result.streamScreenshot) {
        chrome.storage.local.set({ streamScreenshot: null })
        setStreamScreenshot(result.streamScreenshot)
      }

      if (result.streamDone) {
        clearInterval(pollingRef.current!)
        pollingRef.current = null
        setIsLoading(false)
        setIsStreaming(false)

        if (result.streamStatus === "Failed") {
          setStatus("Failed")
          setStreamError(true)
          chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
          
          chrome.storage.local.get(["useCustomProvider"], (s) => {
            const isCustom = !!s.useCustomProvider;
            const errMsg = isCustom ? (result.streamBuffer || "Failed to communicate with AI provider") : "Hands Cloud is currently experiencing heavy load or network issues. Please try again in a moment.";
            setMessages(prev => [...prev, { 
              role: "assistant", 
              isError: true, 
              text: errMsg,
              screenshot: streamScreenshot || undefined
            }])
          })
          return
        }

        setStatus("")
        chrome.storage.local.set({ streamBuffer: "", streamDone: false, streamStatus: "", streamScreenshot: null })
        
        let clean = result.streamBuffer || lastBuffer
        if (clean) {
          clean = clean.replace(/```json\s*[\s\S]*?```/g, "").replace(/ACTION:\s*\{[\s\S]*?\}(?:\n|$)/g, "").replace(/<tool>[\s\S]*?<\/tool>/g, "").replace(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"params"\s*:\s*\{[^}]*\}\s*\}/g, "").trim();
          const openBrace = clean.lastIndexOf("{");
          if (openBrace !== -1 && clean.indexOf("}", openBrace) === -1) {
            clean = clean.substring(0, openBrace).trim();
          }
        }
        
        if (clean.length > 0 || streamScreenshot) {
            setMessages(prev => [...prev, { 
                role: "assistant", 
                text: clean,
                screenshot: streamScreenshot || undefined
            }])
        }
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
    
    // Reset stream states
    setActiveStream("")
    setIsStreaming(true)
    setStreamError(false)
    setStreamScreenshot(null)

    const newMessages = [...messages, { role: "user" as const, text, images: imagesToSend }]
    setMessages(newMessages)
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setActiveTabUrl(tabs[0].url);
    });

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
    setIsStreaming(false)
    setActiveStream("")
    setStreamError(false)
    setStreamScreenshot(null)
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
      setIsStreaming(false)
      setActiveStream("")
      setStreamError(false)
      setStreamScreenshot(null)
    })
  }

  const signIn = () => {
    console.log("signIn clicked");
    showToast("Starting Google Sign-In...", "success");
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      console.log("getAuthToken callback", token, chrome.runtime.lastError);
      if (chrome.runtime.lastError || !token) {
        console.error("Login failed", chrome.runtime.lastError);
        showToast("Login failed: " + (chrome.runtime.lastError?.message || "Unknown error"), "error");
        return;
      }
      
      chrome.runtime.sendMessage({ type: "FETCH_USER_INFO", token }, (infoRes) => {
        const email = infoRes?.success ? (infoRes.data?.email || "") : "";
        
        chrome.runtime.sendMessage({ type: "FETCH_TOKENS", token, baseUrl: baseUrl || "https://bilinil.vercel.app" }, (tRes) => {
          let initialTokens = { used: 0, max: 500000 };
          if (tRes?.success) initialTokens = tRes.data;

          chrome.storage.local.set({ authToken: token, userEmail: email }, () => {
            setAuthToken(token);
            setUserEmail(email);
            setTokenLimit(initialTokens);
            showToast("Successfully signed in!", "success");
          });
        });
      });
    });
  };

  const refreshTokens = async () => {
    setIsRefreshingTokens(true);
    chrome.runtime.sendMessage({ type: "FETCH_TOKENS", token: authToken, baseUrl: baseUrl || "https://bilinil.vercel.app" }, (res) => {
      if (res?.success) {
        setTokenLimit({ used: res.data.used, max: res.data.max });
        showToast("Token count refreshed", "success");
      } else {
        showToast("Failed to refresh tokens: " + (res?.error || "Unknown error"), "error");
      }
      setIsRefreshingTokens(false);
    });
  };

  const signOut = () => {
    chrome.identity.removeCachedAuthToken({ token: authToken }, () => {
      chrome.storage.local.remove(["authToken", "userEmail"], () => {
        setAuthToken("");
        setUserEmail("");
        setTokenLimit(null);
        showToast("Signed out successfully", "success");
      });
    });
  };

  function loadPastChat(c: ChatSession) {
    chrome.runtime.sendMessage({ type: "LOAD_CHAT", messages: c.messages, chatId: c.id }, () => {
      setMessages(c.messages)
      setChatId(c.id)
      setIsSidebarOpen(false)
      setIsStreaming(false)
      setActiveStream("")
      setStreamError(false)
      setStreamScreenshot(null)
    })
  }

  function handleApproval(approved: boolean) {
    chrome.runtime.sendMessage({ type: "APPROVAL_RESPONSE", approved })
    setApprovalReq(null)
  }

  function retryLast() {
    setIsLoading(true)
    setStatus("Retrying...")
    setActiveStream("")
    setIsStreaming(true)
    setStreamError(false)
    setStreamScreenshot(null)
    setMessages(prev => {
      const copy = [...prev]
      if (copy.length > 0 && copy[copy.length - 1].role === "assistant") {
        copy.pop()
      }
      return copy
    })
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) setActiveTabUrl(tabs[0].url);
    });

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
            <div key={c.id} className={`hands-chat-item ${c.id === chatId ? 'hands-chat-item-active' : ''}`} onClick={() => { if (editingChatId !== c.id) loadPastChat(c); }}>
              {editingChatId === c.id ? (
                <div style={{ display: 'flex', width: '100%', gap: '4px', alignItems: 'center' }}>
                  <input 
                    autoFocus
                    value={editChatTitle}
                    onChange={(e) => setEditChatTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveChat({ ...c, title: editChatTitle }).then(() => { setEditingChatId(null); loadChats(); });
                      } else if (e.key === 'Escape') {
                        setEditingChatId(null);
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '2px 4px', background: 'var(--bg-3)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px' }} 
                  />
                  <button className="hands-icon-btn" style={{ padding: '4px' }} onClick={(e) => { e.stopPropagation(); saveChat({ ...c, title: editChatTitle }).then(() => { setEditingChatId(null); loadChats(); }); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
                  <button className="hands-icon-btn" style={{ padding: '4px' }} onClick={(e) => { e.stopPropagation(); setEditingChatId(null); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ) : (
                <>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button className="hands-chat-item-del" title="Rename" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditChatTitle(c.title || ""); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                    <button className="hands-chat-item-del" title="Delete" onClick={(e) => { e.stopPropagation(); if(window.confirm("Are you sure you want to delete this chat?")) { deleteChat(c.id).then(()=>loadChats()) } }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </>
              )}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-2)', borderRadius: '6px', fontSize: '13px', color: 'var(--text)' }}>
                <div>Currently using the secure <strong>Hands Cloud</strong> provider.</div>
                {authToken ? (
                  <>
                    {userEmail && (
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '2px', marginBottom: '4px' }}>
                        Signed in as: <strong>{userEmail}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Tokens Used Today:</span>
                        <button 
                          onClick={refreshTokens} 
                          disabled={isRefreshingTokens}
                          style={{ 
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px', 
                            color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Refresh token count"
                        >
                          <svg 
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            style={{ animation: isRefreshingTokens ? 'spin 1s linear infinite' : 'none' }}
                          >
                            <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                          </svg>
                        </button>
                      </div>
                      <strong style={{ color: tokenLimit && tokenLimit.used > tokenLimit.max ? '#ef4444' : 'var(--text)' }}>
                        {tokenLimit ? `${(tokenLimit.used / 1000).toFixed(0)}k / ${(tokenLimit.max / 1000).toFixed(0)}k` : 'Loading...'}
                      </strong>
                    </div>
                    {tokenLimit && (
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-4)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, (tokenLimit.used / tokenLimit.max) * 100)}%`, 
                          height: '100%', 
                          background: tokenLimit.used > tokenLimit.max ? '#ef4444' : 'var(--accent)', 
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    )}
                    {tokenLimit && tokenLimit.used > tokenLimit.max && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>Daily limit reached. Please use your own API key.</div>
                    )}
                    <button 
                      onClick={signOut}
                      style={{ marginTop: '8px', padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', cursor: 'pointer' }}>
                      Sign Out
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={signIn}
                    className="hands-btn-primary"
                    style={{ marginTop: '8px', padding: '8px' }}>
                    Sign in with Google
                  </button>
                )}
              </div>
            )}
            
            <button 
              onClick={() => {
                chrome.storage.local.set({ apiKey, baseUrl, useCustomProvider, customModel }, () => {
                  showToast("Settings saved securely", "success")
                })
              }}
              className="hands-btn-primary"
              style={{ width: '100%', marginTop: '4px' }}>
              Save Settings
            </button>
          </div>
        )}

      {(!authToken && !useCustomProvider) ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '20px', padding: '20px', flex: 1 }}>
          <HandsLogo animated={false} style={{ width: '64px', height: '64px' }} />
          <h2 style={{ fontSize: '20px', margin: 0, fontWeight: 600 }}>Welcome to Hands</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', margin: 0, fontSize: '14px' }}>
            Choose how you want to connect to the Hands Cloud to get started.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '20px' }}>
            <button 
              className="hands-btn-primary" 
              onClick={signIn}
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
              Continue with Google
            </button>
            <button 
              className="hands-btn-secondary" 
              onClick={() => {
                setUseCustomProvider(true);
                setShowSettings(true);
              }}
              style={{ width: '100%', padding: '12px', fontSize: '14px', backgroundColor: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
              Continue with BYOK
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="hands-messages">
            {messages.length === 0 && !isLoading && (
              <div className="hands-empty">
                <div className="hands-empty-icon" style={{ marginBottom: '16px' }}>
                  <HandsLogo animated={true} className="hands-empty-logo" />
                </div>
                <div style={{ color: 'var(--text-dim)' }}>How can I help you today?</div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`hands-msg hands-msg-${msg.role}`}>
                <div className="hands-msg-bubble">
                  {msg.role === "assistant" && (
                    <div style={{ marginBottom: (msg.text || msg.isError) ? "8px" : "0", display: "flex", alignItems: "center", gap: "8px" }}>
                      <HandsLogo animated={false} />
                      {msg.isError && (
                        <span className="hands-failed-badge">
                          <span className="hands-failed-dot" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  )}
                  {msg.images && msg.images.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {msg.images.map((img, idx) => (
                        <img key={idx} src={img} style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} alt="User Context" />
                      ))}
                    </div>
                  )}
                  {msg.isError ? (
                    <div className="hands-error-banner">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <span>{msg.text || "An unexpected error occurred with the AI provider."}</span>
                    </div>
                  ) : (
                    msg.text ? <MessageContent text={msg.text} /> : null
                  )}

                  {msg.isError && (
                    <button className="hands-retry-btn" onClick={retryLast}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg> Retry
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="hands-msg hands-msg-assistant">
                <div className="hands-msg-bubble">
                  <div style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <HandsLogo animated={true} />
                    {activeTabUrl && (
                      <img src={`chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(activeTabUrl)}&size=32`} style={{ width: '16px', height: '16px', borderRadius: '2px', opacity: 0.9 }} title="Active Tab Context" alt="" />
                    )}
                    <span className="hands-thinking-indicator">
                      <span className="hands-status-dot" />
                      <span>{status || "Thinking..."}</span>
                    </span>
                  </div>
                  {activeStream ? <MessageContent text={activeStream} /> : null}
                </div>
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
                      className="hands-img-remove-btn"
                      title="Remove image">
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
                disabled={isLoading}
                rows={1}
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
        </>
      )}
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode, fallback?: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode, fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("MessageContent render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ color: 'red', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '4px' }}>
          Error rendering message content: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
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
        <ErrorBoundary fallback={<div>{cleanText}</div>}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "")
                return !inline && match ? (
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
        </ErrorBoundary>
      )}
    </div>
  )
}
