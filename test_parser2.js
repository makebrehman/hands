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
          cleanText = cleanText.slice(0, openIdx) + cleanText.slice(endIdx + 1);
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
      cleanText = cleanText.slice(0, lastOpen);
    }
  }

  cleanText = cleanText.replace(/```(?:json)?\s*```/g, '');
  cleanText = cleanText.replace(/```(?:json)?\s*$/g, '');
  
  return { actions, cleanText: cleanText.trim() };
}

const text = `{
  "thought": "User wants tabs check, screenshot, and description. I'll start with getTabs per navigation hierarchy.",
  "action": "getTabs",
  "params": {}
}
{
  "thought": "I have tabs list. Now need screenshot of current tab.",
  "action": "screenshot",
  "params": {}
}`;

console.log(parseActionsFromText(text));

console.log(parseActionsFromText("Here is the script:\n```python\ndef test(): pass\n```"));
