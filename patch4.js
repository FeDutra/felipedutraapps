const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Hide the [ presença ] button on mobile, keep on desktop (md:flex)
code = code.replace(
  /<button \s*onClick=\{\(e\) => \{ e\.stopPropagation\(\); setPresenceMode\(true\); \}\}\s*className="text-xs font-light tracking-widest text-\[\#fbf9f5\]\/80 hover:text-white transition-colors flex items-center gap-1\.5 lowercase bg-transparent border-none outline-none cursor-pointer"/,
  '<button \n            onClick={(e) => { e.stopPropagation(); setPresenceMode(true); }}\n            className="hidden md:flex text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer"'
);

// 2. Add onClick to the Lotus Circle container
// The container currently looks like:
// <div className={`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out ${
//          presenceMode 
//            ? 'w-64 h-64 scale-[1.8] md:scale-[2.4] mb-10 z-20 translate-y-[12vh] md:translate-y-0' 
//            : 'w-64 h-64 scale-100 mb-10 z-10 translate-y-0'
//        }`}>
code = code.replace(
  /<div className=\{`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out \$\{/,
  `<div 
          onClick={(e) => { 
            if (!presenceMode) {
              e.stopPropagation(); 
              setPresenceMode(true); 
            }
          }}
          className={\`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out \${!presenceMode ? 'cursor-pointer' : ''} \${`
);

fs.writeFileSync(file, code);
console.log('Patch 4 applied!');
