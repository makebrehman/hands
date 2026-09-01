// Phills Content Script
// Injected into every page — handles element labeling cleanup and DOM utilities

export {}

// Clean up any leftover labels when navigating
window.addEventListener("beforeunload", () => {
  document.querySelectorAll(".phills-label").forEach((el) => el.remove())
  ;(window as any).__phillsCoords = null
})

// Listen for messages from background (future expansion)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CLEAN_LABELS") {
    document.querySelectorAll(".phills-label").forEach((el) => el.remove())
    sendResponse({ ok: true })
    return true
  }

  if (message.type === "GET_PAGE_TEXT") {
    const text = document.body?.innerText?.slice(0, 8000) || ""
    sendResponse({ text })
    return true
  }

  if (message.type === "GET_COORDS") {
    const coords = (window as any).__phillsCoords || []
    sendResponse({ coords })
    return true
  }
})
