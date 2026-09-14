import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "async function actionSearchHistory" in line:
        with open('history_func.txt', 'w', encoding='utf-8') as out:
            out.write("".join(lines[i:i+15]))
        break
