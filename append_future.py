import sys

file_path = r'c:\Users\M F C\Downloads\phils\phills-agent\futures.md'
text_to_append = '''

## 5. Long-Term Chat Memory Management (Context Window Limits)
Currently, we send 100% of all historical text messages back to the server on every request. While we have a sliding window for images (dropping screenshots older than 4 messages to prevent "413 Payload Too Large" crashes), an extremely long text conversation could eventually hit the token limit of the LLM or cost too much.
**Future Fix:** We need to implement a mechanism to limit the text context. This could be a hard cap (e.g., keeping only the last 20 text messages), a token counter that starts trimming the oldest messages when approaching a limit, or an automatic summarization step where the server condenses old chat history into a brief summary.
'''

with open(file_path, 'a', encoding='utf-8') as f:
    f.write(text_to_append)
