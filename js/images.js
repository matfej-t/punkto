// Client-side image resizing/compression before anything is stored.
// Logos keep their aspect ratio and transparency. Output is WebP when the
// browser can encode it, otherwise PNG. Typical result: 5–25 KB per image.

export const PRESETS = {
  logo: { max: 384, quality: 0.86 }
};

let webp;
function canWebp() {
  if (webp === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    webp = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webp;
}

async function decode(file) {
  // createImageBitmap honours EXIF orientation in modern browsers.
  if ('createImageBitmap' in window && file.type !== 'image/svg+xml') {
    try { return await createImageBitmap(file); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Resize a logo File/Blob → data URL (max 384 px, keeps transparency). */
export async function processImage(file, kind = 'logo') {
  if (!file || !/^image\//.test(file.type)) throw new Error('not-an-image');
  const { max, quality } = PRESETS[kind];
  const img = await decode(file);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('bad-image');

  const scale = Math.min(1, max / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const hgt = Math.max(1, Math.round(ih * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, hgt);
  img.close?.();

  return canWebp() ? canvas.toDataURL('image/webp', quality) : canvas.toDataURL('image/png');
}
