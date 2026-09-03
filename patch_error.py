import sys
import re

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old block to replace
old_block = """  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split("\\n")

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          fullText += content
          onChunk(content)
        }
      } catch {}
    }
  }

  return fullText"""

new_block = """  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    
    // Check for raw JSON error response instead of SSE stream
    if (chunk.trim().startsWith("{")) {
      try {
        const errJson = JSON.parse(chunk)
        if (errJson.error) {
          const errMsg = errJson.error.message || JSON.stringify(errJson.error)
          fullText += `\\n[FATAL API ERROR: ${errMsg}]\\n`
          onChunk(`\\n[FATAL API ERROR: ${errMsg}]\\n`)
          break
        }
      } catch {}
    }

    const lines = chunk.split("\\n")

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const json = JSON.parse(data)
        if (json.error) {
          const errMsg = json.error.message || JSON.stringify(json.error)
          fullText += `\\n[STREAM API ERROR: ${errMsg}]\\n`
          onChunk(`\\n[STREAM API ERROR: ${errMsg}]\\n`)
          continue
        }
        const content = json.choices?.[0]?.delta?.content
        if (content) {
          fullText += content
          onChunk(content)
        }
      } catch {}
    }
  }

  if (!fullText.trim()) {
    const fallbackMsg = "[SYSTEM ERROR: The API returned an entirely blank response. The model likely crashed or silently rejected the image.]"
    fullText = fallbackMsg
    onChunk(fallbackMsg)
  }

  return fullText"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('src/background.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Error handler successfully patched.")
else:
    print("Error: Could not find the exact code block to replace.")
