const fs = require('fs');

const parseToolCallRegex = /function parseToolCall\(text: string\): \{ action: string; params: Record<string, any> \} \| null \{[\s\S]*?return null;[\s\S]*?\}/;
const parseAndHideRegex = /function parseAndHideActions\(text: string\): \{ actions: any\[\], cleanText: string \} \{[\s\S]*?return \{ actions, cleanText \};[\s\S]*?\}/;
const parseActionsSidepanelRegex = /function parseActionsFromText\(text: string\): \{ actions: any\[\]; cleanText: string \} \{[\s\S]*?return \{ actions, cleanText \};[\s\S]*?\}/;

const newParseToolCall = `function parseToolCall(text: string): { action: string; params: Record<string, any> } | null {
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
      if (char === '\\\\') {
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
}`;

const newParseAndHide = `function parseAndHideActions(text: string): { actions: any[], cleanText: string } {
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
      if (char === '\\\\') {
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
          
          before = before.replace(/\`\`\`(?:json)?\\s*$/, '');
          after = after.replace(/^\\s*\`\`\`/, '');
          
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
      before = before.replace(/\`\`\`(?:json)?\\s*$/, '');
      cleanText = before;
    }
  }

  return { actions, cleanText: cleanText.trim() };
}`;

const newParseSidepanel = `function parseActionsFromText(text: string): { actions: any[]; cleanText: string } {
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
      if (char === '\\\\') {
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
          
          before = before.replace(/\`\`\`(?:json)?\\s*$/, '');
          after = after.replace(/^\\s*\`\`\`/, '');
          
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
      before = before.replace(/\`\`\`(?:json)?\\s*$/, '');
      cleanText = before;
    }
  }

  return { actions, cleanText: cleanText.trim() };
}`;

let bgCode = fs.readFileSync('src/background.ts', 'utf8');
bgCode = bgCode.replace(parseToolCallRegex, newParseToolCall);
bgCode = bgCode.replace(parseAndHideRegex, newParseAndHide);
fs.writeFileSync('src/background.ts', bgCode);

let spCode = fs.readFileSync('src/sidepanel.tsx', 'utf8');
spCode = spCode.replace(parseActionsSidepanelRegex, newParseSidepanel);
fs.writeFileSync('src/sidepanel.tsx', spCode);

console.log("Updated files using Node (fixed regex).");
