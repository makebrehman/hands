function parseAndHideActions(text) {
  const actions = [];
  let cleanText = text.replace(/```(?:json)?\s*(?=\{)/g, '');
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

  const regex = /(?:^|\n|\s)\{\s*"(?:thought|action|name|params)"/g;
  let match;
  let lastMatchIndex = -1;
  while ((match = regex.exec(cleanText)) !== null) {
    const braceIdx = match[0].indexOf('{');
    lastMatchIndex = match.index + braceIdx;
  }
  
  if (lastMatchIndex !== -1) {
    cleanText = cleanText.substring(0, lastMatchIndex);
  } else {
    const lastOpen = cleanText.lastIndexOf('{');
    if (lastOpen !== -1) {
      const trailing = cleanText.slice(lastOpen);
      if (trailing.length < 25 && !trailing.includes('}')) {
        cleanText = cleanText.slice(0, lastOpen);
      }
    }
  }

  cleanText = cleanText.trim();
  cleanText = cleanText.replace(/^```(?:json)?|```$/g, '').trim();

  return { actions, cleanText };
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

console.log(parseAndHideActions(text));
