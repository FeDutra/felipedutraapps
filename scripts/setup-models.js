const fs = require('fs');
const path = require('path');
const https = require('https');

const RESOURCES_DIR = path.join(__dirname, '..', 'src-tauri', 'resources');
const FILES = [
  {
    name: 'kokoro-v0_19.onnx',
    url: 'https://huggingface.co/hexgrad/kLegacy/resolve/main/v0.19/kokoro-v0_19.onnx'
  },
  {
    name: 'voices.bin',
    url: 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin'
  }
];

function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) {
      reject(new Error(`Too many redirects while downloading '${url}'`));
      return;
    }

    https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        if (!location) {
          reject(new Error(`Redirect without location while downloading '${url}'`));
          return;
        }
        const nextUrl = new URL(location, url).toString();
        downloadFile(nextUrl, dest, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to get '${url}' (Status Code: ${response.statusCode})`));
        return;
      }

      const file = fs.createWriteStream(dest);
      
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
      file.on('error', (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
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

  const voicesJson = path.join(RESOURCES_DIR, 'voices.json');
  if (!fs.existsSync(voicesJson)) {
    console.error('[ERROR] Tracked resource voices.json is missing. Restore it from the repository.');
    process.exit(1);
  }
  console.log("All model files are set up in src-tauri/resources!");
}

main();
