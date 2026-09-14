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

  let searching = true;
  let offset = 0;
  while (searching) {
    const actionIdx = cleanText.indexOf('"action"', offset);
    if (actionIdx === -1) {
      break;
    }

    let startIdx = cleanText.lastIndexOf('{', actionIdx);
    let foundValidJson = false;
    let backAttempts = 0;

    while (startIdx !== -1 && !foundValidJson && backAttempts < 100) {
      backAttempts++;
      let endIdx = cleanText.indexOf('}', actionIdx);
      let attempts = 0;

      while (endIdx !== -1 && attempts < 1000 && !foundValidJson) {
        attempts++;
        const possibleJson = cleanText.slice(startIdx, endIdx + 1);
        try {
          const obj = JSON.parse(possibleJson);
          if (obj && typeof obj === 'object' && obj.action) {
            actions.push(obj);
            cleanText = cleanText.slice(0, startIdx) + cleanText.slice(endIdx + 1);
            foundValidJson = true;
          }
        } catch {}
        if (!foundValidJson) {
          endIdx = cleanText.indexOf('}', endIdx + 1);
        }
      }
      if (!foundValidJson) {
        startIdx = cleanText.lastIndexOf('{', startIdx - 1);
      }
    }

    if (!foundValidJson) {
      offset = actionIdx + '"action"'.length;
    } else {
      offset = 0;
    }
  }

  cleanText = cleanText.replace(/ACTION:\s*\{[\s\S]*?\}(?:\n|$)/g, "").trim();

  return { actions, cleanText };
}

const input1 = `
{"thought": "...", "action": "screenshot", "params": {}}
{"thought": "...", "action": "getTabs", "params": {}}
{"thought": "...", "action": "switchTab"}
`;

console.log(parseActionsFromText(input1));
