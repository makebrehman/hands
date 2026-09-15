import sys

with open("src/sidepanel.tsx", "r", encoding="utf-8") as f:
    content = f.read()

correct_top = """import React, { useEffect, useRef, useState, Component } from "react"
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

function SidePanelInner() {
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
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editChatTitle, setEditChatTitle] = useState("")

  // Streaming State (Active Buffer)
  const [activeStream, setActiveStream] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState(false)
  const [streamScreenshot, setStreamScreenshot] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const portRef = useRef<chrome.runtime.Port | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {"""

idx = content.find("  useEffect(() => {\n    loadChats()")
if idx != -1:
    content = correct_top + "\n    loadChats()" + content[idx + len("  useEffect(() => {\n    loadChats()"):]
    with open("src/sidepanel.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed top!")
else:
    print("Could not find useEffect marker")

