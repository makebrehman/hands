const fs = require('fs');

const path = 'src/background.ts';
let code = fs.readFileSync(path, 'utf8');

const newRule = `- STRATEGIC HIERARCHY OF OPERATIONS: You must internalize and strictly follow this order of operations based on the type of website:
  1. For Canvas Apps (Google Sheets, Figma): The DOM is empty here. You MUST use 'wiretapCanvas' to read the screen -> then use site-specific App Formulas and App Shortcuts to interact/move data (e.g. ARRAYFORMULA, Shift+F11) -> ONLY use mouse clicks ('click' using the 5x5 black coordinate grid from screenshots) as an absolute last resort.
  2. For Standard HTML/DOM Web (95% of sites): You MUST use 'executeJavascript' (DOM) as your primary weapon to read structure, find buttons, and click them (this bypasses invisible ad shields). If JS fails, use native site-specific Shortcuts (e.g. Ctrl+C/V). ONLY use mouse clicks ('click'/'clickElement') as a last resort.\n  `;

code = code.replace(/RULES:\r?\n/, "RULES:\n  " + newRule);
fs.writeFileSync(path, code);
console.log("Successfully injected the STRATEGIC HIERARCHY OF OPERATIONS rule.");
