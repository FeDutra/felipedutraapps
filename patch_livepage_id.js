const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// Refactor Exit Button
code = code.replace(
  /<div className=\{\`fixed top-8 right-8 z-30 transition-all duration-1000 ease-in-out \$\{\n        presenceMode \n          \? 'opacity-100 blur-none transform translate-y-0 pointer-events-auto' \n          : 'opacity-0 blur-md transform -translate-y-4 pointer-events-none'\n      \}\`\}>/g,
  "<div className={`fixed top-8 right-8 z-30 pulso-transition ${presenceMode ? 'pulso-visible' : 'pulso-hidden-up'}`}>"
);

// Refactor Header
code = code.replace(
  /<header className=\{\`flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none transition-all duration-1000 ease-in-out \$\{\n        presenceMode \? 'opacity-0 pointer-events-none transform -translate-y-4 blur-md' : 'opacity-100 blur-none'\n      \}\`\}>/g,
  "<header className={`flex justify-between items-center w-full max-w-4xl mx-auto z-10 select-none pulso-transition ${presenceMode ? 'pulso-hidden-up' : 'pulso-visible'}`}>"
);

// Refactor Footer
code = code.replace(
  /<footer className=\{\`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none transition-all duration-1000 ease-in-out \$\{\n        presenceMode \? 'opacity-0 pointer-events-none transform translate-y-4 blur-md' : 'opacity-100 blur-none'\n      \}\`\}>/g,
  "<footer className={`w-full max-w-xl mx-auto flex flex-col items-center z-10 select-none pulso-transition ${presenceMode ? 'pulso-hidden-down' : 'pulso-visible'}`}>"
);

// Refactor Text Area (Linha Editorial)
code = code.replace(
  /<div className=\{\`w-\[80%\] md:w-\[75%\] relative bg-transparent border-none shadow-none overflow-hidden transition-all duration-1000 ease-in-out \$\{\n          presenceMode \? 'max-h-\[250px\] md:max-h-\[380px\] h-\[250px\] md:h-\[min\\(380px,40vh\\)\] opacity-0 pointer-events-none mt-2 mb-4 blur-md scale-95' : 'max-h-\[250px\] md:max-h-\[380px\] h-\[250px\] md:h-\[min\\(380px,40vh\\)\] opacity-100 mt-2 mb-4 blur-none scale-100'\n        \}\`\}>/g,
  "<div className={`w-[80%] md:w-[75%] relative bg-transparent border-none shadow-none overflow-hidden pulso-transition max-h-[250px] md:max-h-[380px] h-[250px] md:h-[min(380px,40vh)] mt-2 mb-4 ${presenceMode ? 'pulso-hidden-center' : 'pulso-visible'}`}>"
);

fs.writeFileSync(file, code);
console.log('LivePage identity patched!');
