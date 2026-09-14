function parseActionsFromText(text) {
  const actions = [];
  let cleanText = text;

  let actionMatch;
  while ((actionMatch = cleanText.match(/ACTION:\s*(\{[\s\S]*?\})\s*(?:\n|$)/)) !== null) {
    try {
      const parsed = JSON.parse(actionMatch[1]);
      if (parsed.action) actions.push(parsed);
    } catch {}
    cleanText = cleanText.replace(actionMatch[0], "");
  }

  let tagMatch;
  while ((tagMatch = cleanText.match(/<tool>([\s\S]*?)<\/tool>/)) !== null) {
    try {
      const parsed = JSON.parse(tagMatch[1]);
      if (parsed.action) actions.push(parsed);
    } catch {}
    cleanText = cleanText.replace(tagMatch[0], "");
  }

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
          if (parsed.action) {
            actions.push(parsed);
            cleanText = cleanText.slice(0, openIdx) + cleanText.slice(endIdx + 1);
          } else {
            start = endIdx + 1;
          }
          foundValid = true;
          break; 
        }
      } catch (e) {
      }
      endIdx++;
    }
    
    if (!foundValid) {
      start = openIdx + 1;
    }
  }

  cleanText = cleanText.trim();
  return { actions, cleanText };
}

const inputs = [
  // normal multiple actions
  `{"thought": "t1", "action": "a1"}\n{"thought": "t2", "action": "a2"}`,
  // action in string
  `{\n  "thought": "I need to do an action: {\\"action\\": \\"fake\\"}",\n  "action": "screenshot"\n}`,
  // nested object
  `{"action": "a", "params": {"b": "c"}}`,
  // text before and after
  `Text before\n{"action": "a"}\nText after\n{"action": "b"}\nEnd`,
  // missing closing brace
  `{"action": "a"`
];

inputs.forEach((input, i) => {
  console.log("--- Test " + (i+1) + " ---");
  console.log(parseActionsFromText(input));
});
