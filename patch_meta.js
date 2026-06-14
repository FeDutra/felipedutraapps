const fs = require('fs');
const file = 'src/app/pulso/layout.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldEffect = `      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', e.detail === 'black' ? '#0f0f0f' : '#b8544a');
      }
    };
    document.body.classList.toggle('pulso-theme-black', saved === 'black');
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', saved === 'black' ? '#0f0f0f' : '#b8544a');
    }`;

const newEffect = `      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement('meta');
        metaTheme.setAttribute('name', 'theme-color');
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute('content', e.detail === 'black' ? '#0f0f0f' : '#b8544a');
    };
    document.body.classList.toggle('pulso-theme-black', saved === 'black');
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', saved === 'black' ? '#0f0f0f' : '#b8544a');`;

if (code.includes(oldEffect)) {
  code = code.replace(oldEffect, newEffect);
  fs.writeFileSync(file, code);
  console.log('Patched layout.tsx successfully!');
} else {
  console.log('Failed to find exact string to patch.');
}
