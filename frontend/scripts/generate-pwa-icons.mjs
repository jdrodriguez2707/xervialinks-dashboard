/**
 * Generates solid-color PNG icons for the PWA manifest (build-time).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

function writeSolidPng(size, filename) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = 124;
      png.data[idx + 1] = 58;
      png.data[idx + 2] = 237;
      png.data[idx + 3] = 255;
    }
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const outPath = path.join(publicDir, filename);
  return new Promise((resolve, reject) => {
    png
      .pack()
      .pipe(fs.createWriteStream(outPath))
      .on("finish", () => {
        console.log(`[pwa-icons] wrote ${outPath}`);
        resolve();
      })
      .on("error", reject);
  });
}

await writeSolidPng(192, "pwa-192x192.png");
await writeSolidPng(512, "pwa-512x512.png");
