import sys

file_path = r'src\background.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''async function callLLMAI(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void
) {
  // MEMORY OPTIMIZATION'''
replace = '''async function callLLMAI(
  messages: Message[],
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void
) {
  const storage = await chrome.storage.local.get(["apiKey", "baseUrl"]);
  const targetApiKey = storage.apiKey && storage.apiKey.trim().length > 0 ? storage.apiKey.trim() : LLM_API_KEY;
  const targetBaseUrl = storage.baseUrl && storage.baseUrl.trim().length > 0 ? storage.baseUrl.trim() : LLM_API_URL;

  // MEMORY OPTIMIZATION'''

target2 = '''const response = await fetch(LLM_API_URL, {
    method: "POST",
    headers: {
      Authorization: Bearer ,'''
replace2 = '''const response = await fetch(targetBaseUrl, {
    method: "POST",
    headers: {
      Authorization: Bearer ,'''

content = content.replace(target, replace)
content = content.replace(target2, replace2)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
