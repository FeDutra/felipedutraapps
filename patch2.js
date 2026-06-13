const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Root div
code = code.replace(
  /<div \s*onClick=\{\(\) => presenceMode && setPresenceMode\(false\)\}\s*className=\{`theme-her h-\[100dvh\] w-full flex flex-col justify-between py-6 px-4 md:px-8 relative overflow-hidden transition-all duration-500 font-sans text-\[\#fbf9f5\] \$\{\s*presenceMode \? 'cursor-pointer' : ''\s*\}\`\}\s*>/,
  `<div 
      className={\`theme-her w-full flex flex-col justify-between px-4 md:px-8 relative overflow-hidden transition-all duration-500 font-sans text-[#fbf9f5] \${
        presenceMode ? 'cursor-pointer' : ''
      }\`}
      style={{
        height: '100dvh',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
      }}
    >`
);

// 2. Sair do Foco button safe area
code = code.replace(
  /className="absolute top-8 left-1\/2 -translate-x-1\/2 z-50 animate-fade-in pointer-events-auto"/,
  'className="absolute left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-auto" style={{ top: "max(32px, env(safe-area-inset-top))" }}'
);

// 3. Main wrapper
code = code.replace(
  /<main className=\{`flex-1 flex flex-col items-center justify-end max-w-4xl w-full mx-auto mt-6 mb-10 z-10 relative transition-all duration-1000 ease-in-out`\}>/,
  `<main className="flex-1 flex flex-col w-full max-w-4xl mx-auto z-10 relative overflow-hidden pt-2 pb-2">`
);

// 4. Lotus Circle
code = code.replace(
  /<div className=\{`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out \$\{\s*presenceMode \s*\? 'w-64 h-64 scale-\[1\.8\] md:scale-\[2\.4\] mb-10 z-20 translate-y-0' \s*: 'w-64 h-64 scale-100 mb-10 z-10 translate-y-0'\s*\}\`\}>\s*<div \s*className=\{`w-44 h-44 rounded-full border-8 border-\[\#fbf9f5\] transition-all duration-1000 ease-in-out \$\{getLotusAnimClass\(\)\}`\} \s*\/>\s*<\/div>/,
  `<div className={\`flex-shrink-0 relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out w-full \${
          presenceMode 
            ? 'flex-1 scale-[min(1.8,70vw)] md:scale-[2.4] z-20' 
            : 'h-[25vh] min-h-[140px] max-h-[220px] mb-2 z-10'
        }\`}>
          <div 
            className={\`w-32 h-32 md:w-44 md:h-44 rounded-full border-[6px] md:border-8 border-[#fbf9f5] transition-all duration-1000 ease-in-out \${getLotusAnimClass()}\`} 
          />
        </div>`
);

// 5. Chat Box
code = code.replace(
  /<div className=\{`w-\[80%\] md:w-\[75%\] relative bg-transparent border-none shadow-none overflow-hidden transition-all duration-1000 ease-in-out \$\{\s*presenceMode \? 'max-h-\[380px\] h-\[380px\] opacity-0 pointer-events-none mt-2 mb-4 blur-md scale-95' : 'max-h-\[380px\] h-\[380px\] opacity-100 mt-2 mb-4 blur-none scale-100'\s*\}\`\}>/,
  `<div className={\`w-full md:w-[75%] mx-auto relative bg-transparent border-none shadow-none transition-all duration-1000 ease-in-out \${
          presenceMode 
            ? 'flex-none h-0 opacity-0 pointer-events-none blur-md scale-95' 
            : 'flex-1 min-h-0 opacity-100 blur-none scale-100'
        }\`}>`
);

// 6. Header
code = code.replace(
  /<header className=\{`flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none transition-all duration-1000 ease-in-out \$\{\s*presenceMode \? 'opacity-0 pointer-events-none transform -translate-y-4 blur-md' : 'opacity-100 blur-none'\s*\}\`\}>/,
  `<header className={\`flex-shrink-0 flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none transition-all duration-1000 ease-in-out \${
        presenceMode ? 'opacity-0 pointer-events-none transform -translate-y-4 blur-md' : 'opacity-100 blur-none'
      }\`}>`
);

// 7. Footer
code = code.replace(
  /<footer className=\{`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none transition-all duration-1000 ease-in-out \$\{\s*presenceMode \? 'max-h-40 opacity-0 pointer-events-none mt-2 gap-4 blur-md scale-95' : 'max-h-40 opacity-100 gap-4 mt-2 blur-none scale-100'\s*\}\`\}>/,
  `<footer className={\`flex-shrink-0 w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none transition-all duration-1000 ease-in-out \${
        presenceMode ? 'h-0 opacity-0 pointer-events-none gap-4 blur-md scale-95' : 'opacity-100 gap-4 mt-2 blur-none scale-100'
      }\`}>`
);

// 8. Remove Anexos Button and Toast
code = code.replace(
  /\{\/\* Anexos \*\/\}.*?\{\/\* Toast de Anexos Embutido \*\/\}.*?<\/div>\s*\)\}/s,
  ''
);

fs.writeFileSync(file, code);
console.log('Patched LivePage.tsx for mobile successfully!');
