const fs = require('fs');
const file = 'src/app/globals.css';
let code = fs.readFileSync(file, 'utf8');

// Replace the keyframes with 2.4x drop-shadow values
code = code.replace(
  /drop-shadow\(0 0 8px/g, 'drop-shadow(0 0 19px'
).replace(
  /drop-shadow\(0 0 14px/g, 'drop-shadow(0 0 34px'
).replace(
  /drop-shadow\(0 0 10px/g, 'drop-shadow(0 0 24px'
).replace(
  /drop-shadow\(0 0 15px/g, 'drop-shadow(0 0 36px'
).replace(
  /drop-shadow\(0 0 25px/g, 'drop-shadow(0 0 60px'
).replace(
  /drop-shadow\(0 0 12px/g, 'drop-shadow(0 0 29px'
).replace(
  /drop-shadow\(0 0 20px/g, 'drop-shadow(0 0 48px'
).replace(
  /drop-shadow\(0 0 26px/g, 'drop-shadow(0 0 62px'
);

fs.writeFileSync(file, code);
console.log('globals.css patched for crisp lotus!');
