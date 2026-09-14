const fs = require('fs');
const content = fs.readFileSync('test_parse.js', 'utf8');
const lines = content.split('\n');
const funcLines = lines.slice(0, 36).join('\n');
eval(funcLines);

console.log(parseAndHideActions('Hello\\n{"thought": "I need '));
console.log(parseAndHideActions('Hello\\n{"thought": "I need to search",\\n"action": "navigate",\\n"params": {"url": "https://google.com"}\\n}\\nWorld'));
