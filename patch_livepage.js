const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const buttonCode = `          <button 
            onClick={(e) => {
              e.stopPropagation();
              const current = localStorage.getItem('pulso-theme') || 'orange';
              const next = current === 'black' ? 'orange' : 'black';
              localStorage.setItem('pulso-theme', next);
              window.dispatchEvent(new CustomEvent('pulso-theme-change', { detail: next }));
            }}
            className="text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors bg-transparent border-none outline-none cursor-pointer"
            title="Alternar Cor"
          >
            [ ⏀ ]
          </button>
          <button`;

code = code.replace(
  /<button \n            onClick=\{\(e\) => \{ e\.stopPropagation\(\); setPresenceMode\(true\); \}\}\n            className="hidden md:flex text-xs font-light tracking-widest text-\[\#fbf9f5\]\/80 hover:text-white transition-colors items-center gap-1\.5 lowercase bg-transparent border-none outline-none cursor-pointer"/,
  buttonCode + ` \n            onClick={(e) => { e.stopPropagation(); setPresenceMode(true); }}\n            className="hidden md:flex text-xs font-light tracking-widest text-[#fbf9f5]/80 hover:text-white transition-colors items-center gap-1.5 lowercase bg-transparent border-none outline-none cursor-pointer"`
);

fs.writeFileSync(file, code);
console.log('LivePage patched!');
