import sys
import re

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'async function actionSearchHistory[\s\S]*?\}', content)
if match:
    print(match.group(0))
else:
    print("Not found")
