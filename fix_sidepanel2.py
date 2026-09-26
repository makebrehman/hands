import re

with open('src/sidepanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'setMessages\(prev => \[\.\.\.prev, \{\s*role: "assistant",\s*isError: true,\s*text: errMsg,\s*screenshot: streamScreenshot \|\| undefined\s*\}\]\)', text, re.DOTALL)
if match:
    original = match.group(0)
    replacement = """const finalMilestones = result.streamActions ? result.streamActions.filter((a: any) => a.user_update && a.user_update.trim().length > 0).map((a: any) => a.user_update.trim()) : [];
              setMessages(prev => [...prev, { 
                role: "assistant", 
                isError: true, 
                text: errMsg,
                screenshot: streamScreenshot || undefined,
                milestones: finalMilestones
              }])"""
    new_text = text.replace(original, replacement)
    with open('src/sidepanel.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Replaced!")
else:
    print("Not found")
