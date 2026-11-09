import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const SRC_DIR = 'vibe_images';
const OUT_DIR = 'public/avatars';
const SIZE = 176;

const files = fs.readdirSync(SRC_DIR).filter(f => /^tut-avatar-\d+/.test(f)).sort();
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.goto('about:blank');

for (const f of files) {
  const idx = /tut-avatar-(\d+)/.exec(f)[1];
  const b64 = fs.readFileSync(path.join(SRC_DIR, f)).toString('base64');
  const out = await page.evaluate(
    async ({ dataUrl, size }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      const s = Math.max(size / img.width, size / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      return c.toDataURL('image/webp', 0.86);
    },
    { dataUrl: `data:image/png;base64,${b64}`, size: SIZE }
  );
  const buf = Buffer.from(out.split(',')[1], 'base64');
  const dest = path.join(OUT_DIR, `tut-${idx}.webp`);
  fs.writeFileSync(dest, buf);
  console.log(dest, (buf.length / 1024).toFixed(1) + 'KB');
}

await browser.close();
