# Hands AI Agent - Development History & Strategies

This document serves as the historical context and "memory" for the development of the Hands browser agent. It tracks all strategies we have tried, why certain approaches failed, and what the final working solutions were. If you start a new chat, provide this document to the AI so it doesn't repeat past mistakes.

## 1. Ad Blocker & API Crashes (The Blank Response Bug)
- **The Problem:** The Together AI API kept returning `[SYSTEM ERROR: The API returned an entirely blank response]`.
- **Root Cause:** The agent was visiting pirate streaming sites (like MovieBox) that triggered NSFW popups and ads. When the agent took a screenshot, the NSFW content triggered the LLM provider's strict safety filters, instantly crashing the API connection.
- **Failed Strategies:** Tried prompting the AI to ignore ads (doesn't work, screenshot still captures them).
- **Working Solution:** We turned the extension into a native ad-blocker using Chrome's `declarativeNetRequest` API. We bundled a `rules.json` file blocking major ad networks (`popads`, `doubleclick`, `nesber.com`, etc.). This stops the ads at the network level before they render, keeping the screenshots clean and the API stable.

## 2. The Double-Typing Bug
- **The Problem:** When typing into advanced apps (Google Sheets, Vue forms), characters were doubled (e.g., "Reacher" became "eeaacchheerr").
- **Root Cause:** The `actionType` tool in `background.ts` was dispatching `keyDown`, `char`, and `keyUp` sequentially via CDP. Advanced DOM frameworks listen to both keydown and input events, causing them to register the keystroke twice.
- **Working Solution:** We removed the redundant `char` event dispatch for standard typing.

## 3. Canvas Data Extraction (Google Sheets)
- **The Problem:** The AI was trying to read Google Sheets by taking screenshots and guessing the text, which is slow and hallucination-prone since the DOM is empty (it's an HTML5 `<canvas>`).
- **Working Solution:** We built the `wiretapCanvas` and `readCanvasWiretap` tools. The AI intercepts the canvas 2D context drawing commands. It forces a redraw (e.g., pressing ArrowDown), then reads the exact text perfectly from the wiretap buffer.

## 4. Google Sheets Copy/Paste Failure (The Clipboard Drop)
- **The Problem:** The AI copied data with Ctrl+C, but when it tried to paste in a new sheet, it pasted nothing.
- **Root Cause (The Synthetic Click):** The AI pressed Ctrl+C, then used the `click` tool (mouse) to switch to the "Sheet7" tab. Chrome treats synthetic CDP clicks outside the main cell grid as "untrusted." Google Sheets detects this untrusted blur and panics, dropping the internal clipboard state (the "marching ants" disappear).
- **Failed Strategies:** Reading the system clipboard via JS `navigator.clipboard.readText()` failed because synthetic events lack `isTrusted: true`, which Chrome requires for clipboard access.
- **Working Solution 1 (Keyboard Shortcuts):** We updated the SYSTEM PROMPT to explicitly forbid manual mouse clicks for navigation in canvas apps. The AI must use keyboard shortcuts (`Ctrl+PageDown` to switch sheets, `Shift+Arrows` to select), which perfectly preserves the internal copy state.
- **Working Solution 2 (Formulas):** We discovered the AI can just type `=ARRAYFORMULA('Sheet1'!A1:A16)` to instantly pull data across sheets, completely bypassing the clipboard.

## 5. Keyboard Modifiers Bug (Ctrl+C Not Firing)
- **The Problem:** The AI was sending `{"key": "c", "modifiers": ["ctrl"]}`, but it was just typing the letter 'c' instead of copying.
- **Root Cause:** The `actionPressKey` function had a strict case-sensitive check (`if (modifiersList.includes("Control"))`). Because the AI sent `"ctrl"`, the modifier was ignored.
- **Working Solution:** We patched `actionPressKey` to be completely case-insensitive and handle abbreviations (e.g., `ctrl`, `cmd`, `win`).

## 6. The "Amnesia Loop" (Infinite Screenshot Trap)
- **The Problem:** The AI got stuck in a 30-step infinite loop doing: `Screenshot -> try to clickElement(49) -> Error -> click raw coordinates -> Screenshot -> repeat`.
- **Root Cause (The Typo):** The `clickElement` tool was permanently broken due to a typo. The screenshot tool was saving the numbered box coordinates to `window.__handsCoords`, but `clickElement` was trying to read them from `window.__phillsCoords`. Because it returned empty, it threw an "Element ID not found" error, causing the AI to panic and loop.
- **Working Solution:** We fixed the typo in `actionClickElement`, changing `__phillsCoords` to `__handsCoords`. The `clickElement` tool now works perfectly.
- **Future Recommendation:** Add an "Anti-Loop Protocol" to the SYSTEM PROMPT telling the AI: "If you fail the same action twice, STOP and try a completely different strategy."
