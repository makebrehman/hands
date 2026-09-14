import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = 'const LLM_API_KEY = "sk-or-v1-REDACTED_FOR_GITHUB_PUSH"'
replace = 'const LLM_API_KEY = "" // PUT YOUR API KEY HERE OR USE THE UI'

content = content.replace(target, replace)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
