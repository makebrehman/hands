import re

with open('src/background.ts', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'catch \(e: any\).*?return\s*\}', text, re.DOTALL)
if match:
    original = match.group(0)
    replacement = """catch (e: any) {
        fullReply = e.message || "Failed to communicate with AI provider"
        sendChunk("\\n\\nError: " + fullReply)
        sendDone("Error: " + fullReply)
        return
      }"""
    text = text.replace(original, replacement)
    with open('src/background.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced!")
else:
    print("Not found")
