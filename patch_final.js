const fs = require('fs');
const file = 'src/apps/pulso/pages/LivePage.tsx';
let code = fs.readFileSync(file, 'utf8');

// Center Lotus on mobile during presenceMode using translate-y
code = code.replace(
  /'w-64 h-64 scale-\[1\.8\] md:scale-\[2\.4\] mb-10 z-20 translate-y-0'/g,
  "'w-64 h-64 scale-[1.8] md:scale-[2.4] mb-10 z-20 translate-y-[12vh] md:translate-y-0'"
);

// Allow chat to shrink on small desktop screens to prevent cutoff
code = code.replace(
  /md:h-\[380px\]/g,
  'md:h-[min(380px,40vh)]'
);

// Ensure main can shrink if needed
code = code.replace(
  /<main className=\{`flex-1 flex flex-col items-center justify-end max-w-4xl w-full mx-auto mt-6 mb-10 z-10 relative transition-all duration-1000 ease-in-out`\}>/g,
  '<main className={`flex-1 min-h-0 flex flex-col items-center justify-end max-w-4xl w-full mx-auto mt-6 mb-10 z-10 relative transition-all duration-1000 ease-in-out`}>'
);

fs.writeFileSync(file, code);
console.log('Final targeted patch applied!');
