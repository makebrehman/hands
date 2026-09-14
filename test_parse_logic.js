const text = `{
  "thought": "User wants...",
  "action": "getTabs",
  "params": {}
}
{
  "thought": "I have tabs list...",
  "action": "screenshot",
  "params": {}
}`;
function parseActionsFromText(text) {
  const actions = [];
  let cleanText = text;

  cleanText = cleanText.replace(/```(?:json)?\s*(?=\{)/g, '');
  cleanText = cleanText.replace(/\}\s*```/g, '}');

  let start = 0;
  while (start < cleanText.length) {
    let openIdx = cleanText.indexOf('{', start);
    if (openIdx === -1) break;
    
    let endIdx = openIdx + 1;
    let foundValid = false;
    
    while (endIdx !== -1 && endIdx < cleanText.length) {
      endIdx = cleanText.indexOf('}', endIdx);
      if (endIdx === -1) break;
      
      const possibleJson = cleanText.slice(openIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(possibleJson);
        if (parsed && typeof parsed === 'object') {
          if (parsed.action || parsed.name) {
            actions.push(parsed);
            cleanText = cleanText.slice(0, openIdx) + cleanText.slice(endIdx + 1);
          } else {
            start = endIdx + 1;
          }
          foundValid = true;
          break;
        }
      } catch (e) {}
      endIdx++;
    }
    
    if (!foundValid) {
      start = openIdx + 1;
    }
  }
  return { actions, cleanText };
}

console.log(parseActionsFromText(text));
