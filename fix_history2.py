import sys
import re

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'async function actionSearchHistory\(query:\s*string,\s*maxResults:\s*number\s*=\s*50\):\s*Promise<string>\s*\{.*?join\([^\)]*\)[^\}]*\}'
match = re.search(pattern, content, flags=re.DOTALL)

if match:
    new_func = """async function actionSearchHistory(query: string, maxResults: number = 50): Promise<string> {
  const results = await chrome.history.search({ text: query, maxResults, startTime: 0 })
  if (results.length === 0) return "No history found for: " + query
  return results.map((r) => `[${new Date(r.lastVisitTime || 0).toLocaleString()}] ${r.title} - ${r.url}`).join("\\n")
}"""
    content = content[:match.start()] + new_func + content[match.end():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully!")
else:
    print("Pattern not found!")
