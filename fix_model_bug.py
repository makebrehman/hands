import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('model: state.selectedChatModel,', 'model: targetModel,')

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
