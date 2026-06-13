const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Change 100dvh to 100svh to prevent iOS address bar layout jumps
code = code.replace(
  /h-\[100dvh\]/g,
  'h-[100svh]'
);

// 2. Reduce chat height on mobile only
code = code.replace(
  /max-h-\[380px\] h-\[380px\]/g,
  'max-h-[250px] md:max-h-[380px] h-[250px] md:h-[380px]'
);

// 3. Remove Anexos Button and Toast
code = code.replace(
  /\{\/\* Anexos \*\/\}.*?\{\/\* Toast de Anexos Embutido \*\/\}.*?<\/div>\s*\)\}/s,
  ''
);

// 4. Ensure Sair do Foco button is safe from notch by adjusting top margin
code = code.replace(
  /className="absolute top-8 left-1\/2 -translate-x-1\/2 z-50 animate-fade-in pointer-events-auto"/,
  'className="absolute top-12 md:top-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-auto"'
);

fs.writeFileSync(file, code);
console.log('Patched LivePage.tsx successfully!');
