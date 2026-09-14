function parseActionsFromText(text) {
  const actions = [];
  let cleanText = text;

  let searching = true;
  let offset = 0;
  while (searching) {
    const actionIdx = cleanText.indexOf('"action"', offset);
    if (actionIdx === -1) {
      break;
    }
    console.log("actionIdx", actionIdx, cleanText.slice(actionIdx, actionIdx+20));

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
          console.log("parsed successfully", obj);
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

  return { actions, cleanText };
}

const input = `Here is some JSON:
{"action": "fake"}
Now my real action:
{"action": "screenshot"}`;

console.log(parseActionsFromText(input));
