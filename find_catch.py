import re
with open('src/background.ts', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'catch \(e\s*:\s*any\).*?streamActions:\s*\[\]\s*\}\)', text, re.DOTALL)
if match:
    with open('catch_block.txt', 'w', encoding='utf-8') as f2:
        f2.write(match.group(0))
    print("Saved")
else:
    print("Not found")
