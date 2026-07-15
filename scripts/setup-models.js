const fs = require('fs');
const path = require('path');
const https = require('https');

const RESOURCES_DIR = path.join(__dirname, '..', 'src-tauri', 'resources');
const FILES = [
  {
    name: 'kokoro-v0_19.onnx',
    url: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v0_19.onnx'
  },
  {
    name: 'voices.bin',
    url: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/voices.bin'
  },
  {
    name: 'voices.json',
    url: 'https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/voices.json'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect (Hugging Face redirects resolve to LFS CDN)
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (Status Code: ${response.statusCode})`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastPercent = -1;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          if (percent % 10 === 0 && percent !== lastPercent) {
            console.log(`Downloading: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB / ${(totalSize / 1024 / 1024).toFixed(1)} MB)`);
            lastPercent = percent;
          }
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(RESOURCES_DIR)) {
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });
  }

  for (const file of FILES) {
    const dest = path.join(RESOURCES_DIR, file.name);
    if (fs.existsSync(dest)) {
      console.log(`[OK] ${file.name} already exists.`);
    } else {
      console.log(`[DOWNLOADING] ${file.name} from Hugging Face...`);
      try {
        await downloadFile(file.url, dest);
        console.log(`[SUCCESS] Downloaded ${file.name}`);
      } catch (err) {
        console.error(`[ERROR] Failed to download ${file.name}:`, err.message);
        process.exit(1);
      }
    }
  }
  console.log("All model files are set up in src-tauri/resources!");
}

main();
