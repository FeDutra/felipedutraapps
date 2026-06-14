const fs = require('fs');
const file = 'src/app/pulso/layout.tsx';
let code = fs.readFileSync(file, 'utf8');

// Enhance the handleThemeChange logic
code = code.replace(
  /const handleThemeChange = \(e: any\) => setPulsoTheme\(e\.detail\);/,
  `const handleThemeChange = (e: any) => {
      setPulsoTheme(e.detail);
      document.body.classList.toggle('pulso-theme-black', e.detail === 'black');
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', e.detail === 'black' ? '#0f0f0f' : '#b8544a');
      }
    };
    document.body.classList.toggle('pulso-theme-black', saved === 'black');
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', saved === 'black' ? '#0f0f0f' : '#b8544a');
    }`
);

fs.writeFileSync(file, code);
console.log('Layout patched again!');
