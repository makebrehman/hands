function parseAndHideActions(text) {
  const actions = [];
  let cleanText = text;
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
        if (parsed && typeof parsed === 'object' && parsed.action) {
          actions.push(parsed);
          cleanText = cleanText.slice(0, openIdx) + cleanText.slice(endIdx + 1);
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
  let lastOpen = cleanText.lastIndexOf('{');
  if (lastOpen !== -1) {
    const trailing = cleanText.slice(lastOpen);
    if (!trailing.includes('}')) {
      cleanText = cleanText.slice(0, lastOpen);
    }
  }
  return { actions, cleanText };
}

console.log(parseAndHideActions('{"thought": "I need '));
console.log(parseAndHideActions('{"thought": "I need to search",\n"action": "navigate",\n"params": {"url": "https://google.com"}\n}'));
