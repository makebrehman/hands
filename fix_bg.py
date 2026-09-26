import os

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "(full) => {\n          localBuffer = full\n          const { actions, cleanText } = parseAndHideActions(full)",
    "(full) => {\n          // retain localBuffer\n          const { actions, cleanText } = parseAndHideActions(localBuffer)"
)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced successfully")
