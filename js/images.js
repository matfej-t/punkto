// Client-side image resizing/compression before anything is stored.
// Photos become small square avatars; logos keep their aspect ratio and
// transparency. Output is WebP when the browser can encode it, otherwise
// JPEG (photos) or PNG (logos). Typical result: 5–25 KB per image.

export const PRESETS = {
  photo: { max: 192, square: true, quality: 0.82 },
  logo: { max: 384, square: false, quality: 0.86, alpha: true }
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

/** Resize a File/Blob → data URL. kind: 'photo' | 'logo'. */
export async function processImage(file, kind = 'photo') {
  if (!file || !/^image\//.test(file.type)) throw new Error('not-an-image');
  const { max, square, quality, alpha } = PRESETS[kind];
  const img = await decode(file);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) throw new Error('bad-image');

  let sx = 0, sy = 0, sw = iw, sh = ih, w, hgt;
  if (square) {
    const s = Math.min(iw, ih);
    sx = (iw - s) / 2; sy = (ih - s) / 2; sw = sh = s;
    w = hgt = Math.min(max, s);
  } else {
    const scale = Math.min(1, max / Math.max(iw, ih));
    w = Math.max(1, Math.round(iw * scale));
    hgt = Math.max(1, Math.round(ih * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = hgt;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt); }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, hgt);
  img.close?.();

  if (canWebp()) return canvas.toDataURL('image/webp', quality);
  return alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
}
