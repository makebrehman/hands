import re

# 1. Update background.ts
with open('src/background.ts', 'r', encoding='utf-8') as f:
    bg_code = f.read()

# Replace parseToolCall
new_parse_tool_call = r"""function parseToolCall(text: string): { action: string; params: Record<string, any> } | null {
  let start = 0;
  while (true) {
    const openIdx = text.indexOf('{', start);
    if (openIdx === -1) break;

    let balance = 0;
    let endIdx = -1;
    let inString = false;
    let escape = false;

    for (let i = openIdx; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') balance++;
        else if (char === '}') balance--;
        
        if (balance === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const possibleJson = text.substring(openIdx, endIdx + 1);
      try {
        const obj = JSON.parse(possibleJson);
        if (obj && typeof obj === 'object') {
          if (obj.action && obj.params) return obj;
          if (obj.name && obj.args) return { action: obj.name, params: obj.args };
        }
      } catch (e) {}
    }
    start = openIdx + 1;
  }
  return null;
}"""

bg_code = re.sub(r'function parseToolCall\(text: string\): \{ action: string; params: Record<string, any> \} \| null \{.*?return null;\n\}', new_parse_tool_call, bg_code, flags=re.DOTALL)

# Replace parseAndHideActions
new_parse_and_hide = r"""function parseAndHideActions(text: string): { actions: any[], cleanText: string } {
  const actions: any[] = [];
  let cleanText = text;

  let start = 0;
  while (true) {
    const openIdx = cleanText.indexOf('{', start);
    if (openIdx === -1) break;

    let balance = 0;
    let endIdx = -1;
    let inString = false;
    let escape = false;

    for (let i = openIdx; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') balance++;
        else if (char === '}') balance--;
        
        if (balance === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const possibleJson = cleanText.substring(openIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(possibleJson);
        if (parsed && typeof parsed === 'object' && (parsed.action || parsed.name)) {
          actions.push(parsed);
          
          let before = cleanText.slice(0, openIdx);
          let after = cleanText.slice(endIdx + 1);
          
          before = before.replace(/```(?:json)?\s*$/, '');
          after = after.replace(/^\s*```/, '');
          
          cleanText = before + after;
          continue;
        }
      } catch (e) {}
    }
    
    start = openIdx + 1;
  }

  const lastOpen = cleanText.lastIndexOf('{');
  if (lastOpen !== -1) {
    const trailing = cleanText.slice(lastOpen);
    if (!trailing.includes('}')) {
      let before = cleanText.slice(0, lastOpen);
      before = before.replace(/```(?:json)?\s*$/, '');
      cleanText = before;
    }
  }

  return { actions, cleanText: cleanText.trim() };
}"""

bg_code = re.sub(r'function parseAndHideActions\(text: string\): \{ actions: any\[\], cleanText: string \} \{.*?return \{ actions, cleanText \};\n\}', new_parse_and_hide, bg_code, flags=re.DOTALL)

with open('src/background.ts', 'w', encoding='utf-8') as f:
    f.write(bg_code)


# 2. Update sidepanel.tsx
with open('src/sidepanel.tsx', 'r', encoding='utf-8') as f:
    sp_code = f.read()

new_parse_sidepanel = r"""function parseActionsFromText(text: string): { actions: any[]; cleanText: string } {
  const actions: any[] = [];
  let cleanText = text;

  let start = 0;
  while (true) {
    const openIdx = cleanText.indexOf('{', start);
    if (openIdx === -1) break;

    let balance = 0;
    let endIdx = -1;
    let inString = false;
    let escape = false;

    for (let i = openIdx; i < cleanText.length; i++) {
      const char = cleanText[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') balance++;
        else if (char === '}') balance--;
        
        if (balance === 0) {
          endIdx = i;
          break;
        }
      }
    }

    if (endIdx !== -1) {
      const possibleJson = cleanText.substring(openIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(possibleJson);
        if (parsed && typeof parsed === 'object' && (parsed.action || parsed.name)) {
          actions.push(parsed);
          
          let before = cleanText.slice(0, openIdx);
          let after = cleanText.slice(endIdx + 1);
          
          before = before.replace(/```(?:json)?\s*$/, '');
          after = after.replace(/^\s*```/, '');
          
          cleanText = before + after;
          continue;
        }
      } catch (e) {}
    }
    
    start = openIdx + 1;
  }

  const lastOpen = cleanText.lastIndexOf('{');
  if (lastOpen !== -1) {
    const trailing = cleanText.slice(lastOpen);
    if (!trailing.includes('}')) {
      let before = cleanText.slice(0, lastOpen);
      before = before.replace(/```(?:json)?\s*$/, '');
      cleanText = before;
    }
  }

  return { actions, cleanText: cleanText.trim() };
}"""

sp_code = re.sub(r'function parseActionsFromText\(text: string\): \{ actions: any\[\]; cleanText: string \} \{.*?return \{ actions, cleanText \};\n\}', new_parse_sidepanel, sp_code, flags=re.DOTALL)

with open('src/sidepanel.tsx', 'w', encoding='utf-8') as f:
    f.write(sp_code)

print("Updates successful.")
