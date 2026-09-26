import re

with open('src/sidepanel.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """              setMessages(prev => [...prev, { 
                role: "assistant", 
                isError: true, 
                text: errMsg,
                screenshot: streamScreenshot || undefined
              }])
            })
            return
          }"""

replacement = """              const finalMilestones = result.streamActions ? result.streamActions.filter((a: any) => a.user_update && a.user_update.trim().length > 0).map((a: any) => a.user_update.trim()) : [];
              setMessages(prev => [...prev, { 
                role: "assistant", 
                isError: true, 
                text: errMsg,
                screenshot: streamScreenshot || undefined,
                milestones: finalMilestones
              }])
            })
            return
          }"""

new_text = text.replace(target, replacement)
if text != new_text:
    with open('src/sidepanel.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Replaced error state milestones")
else:
    print("Pattern not found")
