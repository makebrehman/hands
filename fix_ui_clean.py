import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = '''              {msg.role === "assistant" && (
                <div style={{ marginBottom: "8px", display: "flex", alignItems: "center" }}>
                  <HandsLogo animated={!!msg.isStreaming} />
                  {msg.isStreaming && <span className="hands-cursor" style={{marginLeft: "8px"}} />}
                </div>
              )}'''

replace1 = '''              {msg.role === "assistant" && (
                <div style={{ marginBottom: "8px", display: "flex", alignItems: "center" }}>
                  <HandsLogo animated={!!msg.isStreaming} />
                </div>
              )}'''

target2 = '''      {!hasText && <span className="hands-thinking" style={{ opacity: 0.5 }}>...</span>}
    </div>
  )
}'''

replace2 = '''    </div>
  )
}'''

content = content.replace(target1, replace1)
content = content.replace(target2, replace2)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
