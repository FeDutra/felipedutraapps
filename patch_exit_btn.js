const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldCode = `      {/* Botão sutil de saída do Modo Foco */}
      {presenceMode && (
        <div className="fixed top-8 right-8 z-30 animate-fade-in pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); setPresenceMode(false); }}
            className="text-[10px] font-light tracking-widest text-[#fbf9f5]/40 hover:text-[#fbf9f5]/80 transition-colors lowercase bg-transparent border-none outline-none cursor-pointer"
          >
            [ sair do foco ]
          </button>
        </div>
      )}`;

const newCode = `      {/* Botão sutil de saída do Modo Foco */}
      <div className={\`fixed top-8 right-8 z-30 transition-all duration-1000 ease-in-out \${
        presenceMode 
          ? 'opacity-100 blur-none transform translate-y-0 pointer-events-auto' 
          : 'opacity-0 blur-md transform -translate-y-4 pointer-events-none'
      }\`}>
        <button
          onClick={(e) => { e.stopPropagation(); setPresenceMode(false); }}
          className="text-[10px] font-light tracking-widest text-[#fbf9f5]/40 hover:text-[#fbf9f5]/80 transition-colors lowercase bg-transparent border-none outline-none cursor-pointer"
        >
          [ sair do foco ]
        </button>
      </div>`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(file, code);
  console.log('Exit button patched!');
} else {
  console.log('Error: old code not found.');
}
