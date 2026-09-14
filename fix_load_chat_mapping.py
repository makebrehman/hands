import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  if (message.type === "LOAD_CHAT") {
    state.cancelRequested = true
    chrome.storage.local.set({ streamBuffer: "", streamDone: true, streamStatus: "" })
    
    let loadedMsgs = message.messages || []
    if (loadedMsgs.length === 0 || loadedMsgs[0].role !== "system") {
      state.messages = [{ role: "system", content: SYSTEM_PROMPT }, ...loadedMsgs]
    } else {
      loadedMsgs[0].content = SYSTEM_PROMPT
      state.messages = loadedMsgs
    }
    
    persistState()
    sendResponse({ ok: true })
    return true
  }'''

replace = '''  if (message.type === "LOAD_CHAT") {
    state.cancelRequested = true
    chrome.storage.local.set({ streamBuffer: "", streamDone: true, streamStatus: "" })
    
    // Convert UI ChatMessage (which uses "text") into Backend Message (which uses "content")
    let loadedMsgs = (message.messages || []).map((m: any) => {
      if (m.role === "system") return m;
      let contentArr: any[] = [{ type: "text", text: m.text }];
      if (m.images) {
        for (const img of m.images) {
          contentArr.push({ type: "image_url", image_url: { url: img } });
        }
      }
      return { role: m.role, content: contentArr, timestamp: new Date().toISOString() };
    });

    if (loadedMsgs.length === 0 || loadedMsgs[0].role !== "system") {
      state.messages = [{ role: "system", content: SYSTEM_PROMPT }, ...loadedMsgs];
    } else {
      loadedMsgs[0].content = SYSTEM_PROMPT;
      state.messages = loadedMsgs;
    }
    
    persistState()
    sendResponse({ ok: true })
    return true
  }'''

content = content.replace(target, replace)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
