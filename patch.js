const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix header transition
code = code.replace(
  /className=\{`flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none transition-all duration-700 ease-in-out \$\{\s*presenceMode \? 'opacity-0 pointer-events-none transform -translate-y-4' : 'opacity-100'\s*\}\`\}/,
  "className={`flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none transition-all duration-1000 ease-in-out ${\n        presenceMode ? 'opacity-0 pointer-events-none transform -translate-y-4 blur-md' : 'opacity-100 blur-none'\n      }`}"
);

// 2. Fix main justify
code = code.replace(
  /className=\{`flex-1 flex flex-col items-center max-w-4xl w-full mx-auto mt-6 mb-10 z-10 relative transition-all duration-700 ease-in-out \$\{\s*presenceMode \? 'justify-center' : 'justify-end'\s*\}\`\}/,
  "className={`flex-1 flex flex-col items-center justify-end max-w-4xl w-full mx-auto mt-6 mb-10 z-10 relative transition-all duration-1000 ease-in-out`}"
);

// 3. Fix Lotus circle
code = code.replace(
  /className=\{`relative flex items-center justify-center select-none transition-all duration-700 ease-in-out \$\{\s*presenceMode\s*\?\s*'w-96 h-96 scale-\[2\.2\] md:scale-\[2\.4\] mb-0 z-20 translate-y-\[8vh\]'\s*:\s*'w-64 h-64 mb-10 z-10 translate-y-0'\s*\}\`\}/,
  "className={`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out ${\n          presenceMode \n            ? 'w-64 h-64 scale-[1.8] md:scale-[2.4] mb-10 z-20 translate-y-0' \n            : 'w-64 h-64 scale-100 mb-10 z-10 translate-y-0'\n        }`}"
);

code = code.replace(
  /className=\{`w-44 h-44 rounded-full border-8 border-\[\#fbf9f5\] transition-all duration-700 ease-out \$\{getLotusAnimClass\(\)\}`\}/,
  "className={`w-44 h-44 rounded-full border-8 border-[#fbf9f5] transition-all duration-1000 ease-in-out ${getLotusAnimClass()}`}"
);

// 4. Fix Chat container
code = code.replace(
  /className=\{`w-\[80%\] md:w-\[75%\] relative bg-transparent border-none shadow-none overflow-hidden transition-all duration-700 ease-in-out \$\{\s*presenceMode \? 'max-h-0 opacity-0 pointer-events-none mt-0 mb-0' : 'max-h-\[380px\] h-\[380px\] mt-2 mb-4'\s*\}\`\}/,
  "className={`w-[80%] md:w-[75%] relative bg-transparent border-none shadow-none overflow-hidden transition-all duration-1000 ease-in-out ${\n          presenceMode ? 'max-h-[380px] h-[380px] opacity-0 pointer-events-none mt-2 mb-4 blur-md scale-95' : 'max-h-[380px] h-[380px] opacity-100 mt-2 mb-4 blur-none scale-100'\n        }`}"
);

// 5. Fix footer
code = code.replace(
  /className=\{`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none transition-all duration-700 ease-in-out \$\{\s*presenceMode \? 'max-h-0 opacity-0 pointer-events-none mt-0 mb-0 pt-0 pb-0 gap-0 overflow-hidden' : 'max-h-40 gap-4 mt-2'\s*\}\`\}/,
  "className={`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none transition-all duration-1000 ease-in-out ${\n        presenceMode ? 'max-h-40 opacity-0 pointer-events-none mt-2 gap-4 blur-md scale-95' : 'max-h-40 opacity-100 gap-4 mt-2 blur-none scale-100'\n      }`}"
);

fs.writeFileSync(file, code);
console.log('Patched LivePage.tsx successfully!');
