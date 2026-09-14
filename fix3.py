import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target2 = '''  const response = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      Authorization: Bearer ,'''
replace2 = '''  const response = await fetch(targetBaseUrl, {
    method: "POST",
    headers: {
      Authorization: Bearer ,'''

content = content.replace(target2, replace2)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
