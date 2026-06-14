const fs = require('fs');
const file = 'src/app/pulso/layout.tsx';
let code = fs.readFileSync(file, 'utf8');

// Add state for pulsoTheme
code = code.replace(
  /const \[user, setUser\] = React\.useState<User \| null>\(null\);/,
  "const [user, setUser] = React.useState<User | null>(null);\n  const [pulsoTheme, setPulsoTheme] = React.useState('orange');"
);

// Add useEffect logic for pulsoTheme
code = code.replace(
  /React\.useEffect\(\(\) => \{/,
  `React.useEffect(() => {
    const saved = localStorage.getItem('pulso-theme');
    if (saved) setPulsoTheme(saved);
    const handleThemeChange = (e: any) => setPulsoTheme(e.detail);
    window.addEventListener('pulso-theme-change', handleThemeChange);
`
);

// Add removeEventListener
code = code.replace(
  /return \(\) => unsubscribe\(\);/,
  "return () => {\n      unsubscribe();\n      window.removeEventListener('pulso-theme-change', handleThemeChange);\n    };"
);

// Update classNames
code = code.replace(
  /bg-\[\#b8544a\]/g,
  "${pulsoTheme === 'black' ? 'bg-[#0f0f0f]' : 'bg-[#b8544a]'}"
);

// Fix the template literals if they were inside string literals
// `<div className="min-h-screen bg-[#b8544a] text-[#fbf9f5] ...` ->
// `<div className={\`min-h-screen \${pulsoTheme === 'black' ? 'bg-[#0f0f0f]' : 'bg-[#b8544a]'} text-[#fbf9f5] ...\`}`
code = code.replace(
  /<div className="min-h-screen \$\{pulsoTheme === 'black' \? 'bg-\[\#0f0f0f\]' : 'bg-\[\#b8544a\]'\} text-\[\#fbf9f5\] w-full selection:bg-white\/20 flex flex-col xl:flex-row overflow-x-hidden relative">/,
  "<div className={`min-h-screen ${pulsoTheme === 'black' ? 'bg-[#0f0f0f]' : 'bg-[#b8544a]'} text-[#fbf9f5] w-full selection:bg-white/20 flex flex-col xl:flex-row overflow-x-hidden relative`}>"
);

// `<nav className="xl:hidden relative p-3 md:p-4 flex flex-col items-stretch justify-between gap-3 border-b border-white/10 ${pulsoTheme === 'black' ? 'bg-[#0f0f0f]' : 'bg-[#b8544a]'}/90 backdrop-blur-xl sticky top-0 z-50 w-full max-w-full overflow-x-hidden">`
code = code.replace(
  /<nav className="xl:hidden relative p-3 md:p-4 flex flex-col items-stretch justify-between gap-3 border-b border-white\/10 \$\{pulsoTheme === 'black' \? 'bg-\[\#0f0f0f\]' : 'bg-\[\#b8544a\]'\}\/90 backdrop-blur-xl sticky top-0 z-50 w-full max-w-full overflow-x-hidden">/,
  "<nav className={`xl:hidden relative p-3 md:p-4 flex flex-col items-stretch justify-between gap-3 border-b border-white/10 ${pulsoTheme === 'black' ? 'bg-[#0f0f0f]/90' : 'bg-[#b8544a]/90'} backdrop-blur-xl sticky top-0 z-50 w-full max-w-full overflow-x-hidden`}>"
);

// `<aside className="hidden xl:flex flex-col justify-between w-64 min-w-\[16rem\] h-screen static xl:sticky top-0 border-r border-white\/10 \$\{pulsoTheme === 'black' \? 'bg-\[\#0f0f0f\]' : 'bg-\[\#b8544a\]'\}\/95 backdrop-blur-2xl z-50 p-4 shrink-0">`
code = code.replace(
  /<aside className="hidden xl:flex flex-col justify-between w-64 min-w-\[16rem\] h-screen static xl:sticky top-0 border-r border-white\/10 \$\{pulsoTheme === 'black' \? 'bg-\[\#0f0f0f\]' : 'bg-\[\#b8544a\]'\}\/95 backdrop-blur-2xl z-50 p-4 shrink-0">/,
  "<aside className={`hidden xl:flex flex-col justify-between w-64 min-w-[16rem] h-screen static xl:sticky top-0 border-r border-white/10 ${pulsoTheme === 'black' ? 'bg-[#0f0f0f]/95' : 'bg-[#b8544a]/95'} backdrop-blur-2xl z-50 p-4 shrink-0`}>"
);

fs.writeFileSync(file, code);
console.log('Layout patched!');
