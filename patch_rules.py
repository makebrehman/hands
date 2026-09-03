import sys

with open('src/background.ts', 'r', encoding='utf-8') as f:
    content = f.read()

rule_to_add = """- KEYBOARD SHORTCUTS: Many advanced web apps (like Google Sheets or Figma) intercept DOM clicks, making them fail. You MUST prioritize using keyboard shortcuts over manual clicks or DOM manipulation to perform actions (e.g. creating sheets, formatting text, cutting/pasting) whenever possible. If you don't know the exact shortcut for an action on the current app, you must search for it or figure it out, then use the "pressKey" tool to trigger it.
"""

if 'KEYBOARD SHORTCUTS' not in content:
    content = content.replace('RULES:\n', 'RULES:\n' + rule_to_add)
    with open('src/background.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Rule added.')
else:
    print('Rule already exists.')
