function parseActionsFromText(text) {
  const actions = [];
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
        if (parsed && (parsed.action || parsed.name)) {
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
}

console.log(parseActionsFromText("Here is the script:\n```python\ndef test(): pass\n```"));
console.log(parseActionsFromText("```json\n{\"action\": \"test\"}\n```\nDone."));
console.log(parseActionsFromText("```json\n{\"action\": \"test\", \"params\": {\"foo\": \"bar\"}}\n```\nDone."));
console.log(parseActionsFromText("{\"action\": \"test\"}"));
console.log(parseActionsFromText("```json\n{\"action\": \"te"));
