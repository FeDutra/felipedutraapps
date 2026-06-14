const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const toastUI = `
      {/* Toast de Anexo */}
      <div className={\`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#b8544a] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 pulso-transition \${
        showAttachmentToast ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4 pointer-events-none'
      }\`}>
        <Activity size={16} className="animate-pulse" />
        <span className="text-xs font-semibold tracking-widest uppercase">função em desenvolvimento</span>
      </div>
    </main>
`;

code = code.replace("    </main>", toastUI);

fs.writeFileSync(file, code);
console.log('LivePage toast added!');
