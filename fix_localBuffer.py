import re

with open('src/background.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# In the CHAT and RETRY_CHAT handlers, we have:
#        (full) => {
#          localBuffer = full
#          const { actions, cleanText } = parseAndHideActions(full)

# We want to change this to NOT overwrite localBuffer, and parse localBuffer instead.
pattern = re.compile(r'\(full\)\s*=>\s*\{\s*localBuffer = full\s*const \{ actions, cleanText \} = parseAndHideActions\(full\)', re.DOTALL)

replacement = """(full) => {
          // Do not overwrite localBuffer, use the accumulated chunks
          const { actions, cleanText } = parseAndHideActions(localBuffer)"""

new_text = pattern.sub(replacement, text)

if text != new_text:
    with open('src/background.ts', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Replaced localBuffer = full")
else:
    print("Pattern not found")
