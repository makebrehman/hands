const fs = require('fs');
let code = fs.readFileSync('src/background.ts', 'utf8');

// 1. Change model
code = code.replace(/const CHAT_MODEL = .*/g, 'const CHAT_MODEL = "moonshotai/Kimi-K3"');

// 2. Fix the screenshot block which is duplicated
const badScreenshotRegex = /case "screenshot": \{[\s\S]*?case "navigate":/m;

const goodScreenshotBlock = `case "screenshot": {
      const data = await actionLabelPage()
      if (data.error) {
        const b64 = await actionScreenshot()
        return { result: data.error, screenshotBase64: b64 }
      }
      
      const cleanB64 = await actionScreenshot()
      const finalB64 = await drawStealthLabels(cleanB64, data)
      
      const summary = \`Screenshot taken with \${data.coords?.length || 0} numbered boxes drawn over interactive elements.\\nA 5x5 coordinate grid is also rendered for Canvas areas. To click a numbered box, use the 'clickElement' tool. To click an unlabeled Canvas area, use the 'click' tool with estimated x,y coordinates.\`
      
      return { result: summary, screenshotBase64: finalB64 }
    }
    case "navigate":`;

code = code.replace(badScreenshotRegex, goodScreenshotBlock);

fs.writeFileSync('src/background.ts', code);
console.log("Fixed model and cleaned screenshot block");
