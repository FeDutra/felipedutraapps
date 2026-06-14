const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove isLatestRequestPending from textarea disabled
code = code.replace(
  /disabled=\{isLatestRequestPending \|\| voiceState === 'transcribing'\}/,
  "disabled={voiceState === 'transcribing'}"
);

// 2. Remove isLatestRequestPending from shortcut buttons
code = code.replace(
  /disabled=\{isLatestRequestPending\}/g,
  "disabled={false}"
);

// 3. Remove isLatestRequestPending from send button
code = code.replace(
  /disabled=\{\!inputMessage\.trim\(\) \|\| isLatestRequestPending\}/g,
  "disabled={!inputMessage.trim()}"
);

// 4. Remove isLatestRequestPending from Enter keydown
code = code.replace(
  /if \(\!isLatestRequestPending\) handleSendMessage\(\);/g,
  "handleSendMessage();"
);

// 5. Update the textarea placeholder so it doesn't say "aguarde a resposta..."
code = code.replace(
  /isLatestRequestPending \? 'aguarde a resposta\.\.\.' :/g,
  ""
);

fs.writeFileSync(file, code);
console.log('Unlocked input successfully!');
