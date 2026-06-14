const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldCode = `        <div 
          onClick={(e) => { 
            if (!presenceMode) {
              e.stopPropagation(); 
              setPresenceMode(true); 
            }
          }}
          className={\`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out \${!presenceMode ? 'cursor-pointer' : ''} \${
          presenceMode 
            ? 'w-64 h-64 scale-[1.8] md:scale-[2.4] mb-10 z-20 translate-y-[12vh] md:translate-y-0' 
            : 'w-64 h-64 scale-100 mb-10 z-10 translate-y-0'
        }\`}>
          <div 
            className={\`w-44 h-44 rounded-full border-8 border-[#fbf9f5] transition-all duration-1000 ease-in-out \${getLotusAnimClass()}\`} 
          />
        </div>`;

const newCode = `        <div 
          onClick={(e) => { 
            if (!presenceMode) {
              e.stopPropagation(); 
              setPresenceMode(true); 
            }
          }}
          className={\`relative flex items-center justify-center select-none transition-all duration-1000 ease-in-out \${!presenceMode ? 'cursor-pointer' : ''} \${
          presenceMode 
            ? 'w-64 h-64 mb-10 z-20 translate-y-[12vh] md:translate-y-0' 
            : 'w-64 h-64 mb-10 z-10 translate-y-0'
        }\`}>
          <div className={\`absolute flex items-center justify-center transition-transform duration-1000 ease-in-out origin-center \${
            presenceMode ? 'scale-[0.75] md:scale-100' : 'scale-[0.417]'
          }\`}>
            <div 
              className={\`w-[422px] h-[422px] rounded-full border-[19px] border-[#fbf9f5] transition-all duration-1000 ease-in-out \${getLotusAnimClass()}\`} 
            />
          </div>
        </div>`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync(file, code);
  console.log('LivePage circle patched successfully!');
} else {
  console.log('Error: Could not find old code string in LivePage.tsx');
}
