# Future Development Goals

## 1. Multi-Tool Call Execution
Currently, the agent is strictly restricted to executing **exactly one JSON tool call at a time**. In the future, we need to deal with this limitation to allow faster execution (e.g., fetching history and bookmarks in parallel).

### Reasons for the Current Restriction:
1. **The ReAct Loop Relies on Reality, Not Guessing:** If the agent tries to perform multiple actions at once (e.g., click search -> type word -> hit enter), it assumes the first action worked perfectly. If an ad popup appears during step 1, the subsequent steps fail catastrophically. Forcing it to wait for a response after every action ensures it can "see" the page state before proceeding.
2. **Preventing Parser Crashes (Execution Hallucinations):** When the AI gets confused or frustrated (like on the Moviebox site), it tends to "speedrun" and hallucinate massive blocks of 10+ tool calls at once. This completely breaks the `parseToolCall` JSON parser in `background.ts`. Restricting it to one JSON object per turn (and aggressively stripping out hallucinated extras) ensures the parser never crashes and the agent stays grounded in reality.

## 2. Improving the Coordinate Guesser
Vision Language Models (VLMs) suffer from severe "spatial blurriness" regarding exact pixel geometry. When using `testCoordinates`, the model often hallucinates high accuracy. For example, it might declare a dot is a "perfect bullseye" even when it is 30+ pixels away from the true target.

### Potential Solutions:
1. **Micro-Cropping (Zoom-in Verification):** Instead of just returning the full-screen screenshot, the backend could crop a small bounding box (e.g., 100x100 pixels) around the generated dots and send that zoomed-in snippet back to the model. This gives the VLM a much higher-resolution view of the local pixel area, making it impossible to hallucinate a hit when it actually missed.
2. **Traditional Computer Vision Fallback:** Use a traditional CV algorithm (like OpenCV template matching) where the VLM draws a rough bounding box around an icon, and the script uses edge detection or template matching to snap the coordinates to the true center of the UI element, bypassing the VLM's spatial blindness entirely.

## 3. Navigation Hierarchy During Loops
Currently, the agent treats the `NAVIGATION HIERARCHY` (checking if tabs are already open before searching) as a "Phase 1" setup step. When it enters a long execution loop (e.g., searching for 16 different companies one by one), it abandons tab hygiene and aggressively spams `openTab` for every single search, opening dozens of redundant tabs. 
**Future Fix:** We need to update the prompt so the agent understands that tab reuse applies *continuously* during loops (e.g., using `navigate` to reuse the same Google search tab for all 16 companies).

## 4. Custom User Endpoints & Secure Built-in API
Currently, the LLM API key is hardcoded in the frontend extension code (`background.ts`), which is completely insecure for a public release on the Chrome Web Store.

### Future Architecture:
1. **User-Provided Keys (Bring Your Own Key):** Build a Settings UI (Options page or Side Panel) where new users can input their own API Key and Endpoint URL. These will be stored securely in `chrome.storage.local`. The extension will route requests directly from the user's browser to their chosen endpoint.
2. **Secure Built-in Cloud Endpoint:** For users who don't have their own keys, we will provide a "Hands Cloud" toggle. This will route requests to a secure proxy server (e.g., Cloudflare Worker or Node.js backend). The proxy server will hold our master API key in its hidden environment variables, attach it to the incoming requests, and forward them to the LLM provider. This protects our API key from being stolen via Chrome DevTools while still serving the user.
