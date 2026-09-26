import os

with open(r'C:\Users\M F C\Downloads\bilinil_repo\apps\backend-api\prompts\prompt.md', 'r', encoding='utf-8') as f:
    new_prompt = f.read().replace('', '\\')

with open(r'C:\Users\M F C\Downloads\phils\hands\src\background.ts', 'r', encoding='utf-8') as f:
    bg_code = f.read()

start_marker = 'const SYSTEM_PROMPT = '
start_idx = bg_code.find(start_marker)
if start_idx != -1:
    # Find the closing backtick. But wait, there could be backticks inside the old prompt!
    # A safer way is to find the 'let pendingApproval:' which comes immediately after.
    end_marker = 'let pendingApproval:'
    end_idx = bg_code.find(end_marker, start_idx)
    if end_idx != -1:
        # Actually, let's just find the last backtick before let pendingApproval
        closing_backtick_idx = bg_code.rfind('', start_idx, end_idx)
        if closing_backtick_idx != -1:
            new_code = bg_code[:start_idx + len(start_marker)] + new_prompt + bg_code[closing_backtick_idx:]
            with open(r'C:\Users\M F C\Downloads\phils\hands\src\background.ts', 'w', encoding='utf-8') as f:
                f.write(new_code)
            print("Prompt updated successfully via string slicing.")
        else:
            print("Could not find closing backtick")
    else:
        print("Could not find end marker")
else:
    print("Could not find start marker")
