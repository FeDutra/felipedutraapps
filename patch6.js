const fs = require('fs');
const file = 'src/app/pulso/live/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// We need to add the viewport export.
if (!code.includes('export const viewport')) {
  // Add import if Viewport is not imported
  if (!code.includes('import { Viewport }')) {
    code = code.replace(/import React from 'react';/, "import React from 'react';\nimport { Viewport } from 'next';");
  }

  code = code.replace(
    /export default function Page\(\)/,
    "export const viewport: Viewport = {\n  themeColor: '#b8544a',\n};\n\nexport default function Page()"
  );

  fs.writeFileSync(file, code);
  console.log('Added viewport themeColor to page.tsx!');
} else {
  console.log('Viewport already exists?');
}
