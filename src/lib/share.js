// Sharing: native share when available, copy-to-clipboard fallback, and a
// canvas-rendered quote card (Sanskrit + translation + reference + branding).
const SITE_URL = 'https://site-319aa22e54d448878c96aed3c801558c.freebuff.page/';

export function shareText({ ref, sk, tx, attr }) {
  const text = `${sk.trim()}\n\n${tx.trim()}\n— Bhagavad Gita ${ref} (${attr})\n${SITE_URL}`;
  if (navigator.share) {
    return navigator.share({ title: `Bhagavad Gita ${ref}`, text }).catch(() => {});
  }
  return copyText(text);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true);
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
  return Promise.resolve(true);
}

/** Renders a 1080×1350 quote card and returns a File (or null on failure). */
export async function quoteCard({ ref, sk, tx, attr }) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const styles = getComputedStyle(document.documentElement);
  const paper = styles.getPropertyValue('--paper').trim() || '#fffdf8';
  const ink = styles.getPropertyValue('--ink').trim() || '#33291f';
  const dim = styles.getPropertyValue('--ink-dim').trim() || '#6f6252';
  const accent = styles.getPropertyValue('--accent').trim() || '#b9781f';

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  const wrap = (text, font, size, maxWidth, lineHeight, maxLines) => {
    ctx.font = font;
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    ctx.font = font;
    lines.forEach((l, i) => ctx.fillText(l, (W - ctx.measureText(l).width) / 2, 100 + i * lineHeight));
    return 100 + lines.length * lineHeight;
  };

  let y = wrap(sk, '500 52px "Noto Serif Devanagari", serif', 52, W - 180, 82, 6);

  y += 60;
  ctx.fillStyle = dim;
  y = wrap(tx, 'italic 34px "Spectral", serif', 34, W - 200, 54, 8);

  y += 70;
  ctx.fillStyle = accent;
  ctx.font = '600 30px "Spectral", serif';
  const refText = `Bhagavad Gita ${ref}`;
  ctx.fillText(refText, (W - ctx.measureText(refText).width) / 2, y);

  y += 44;
  ctx.fillStyle = dim;
  ctx.font = '24px "Spectral", serif';
  const attrText = attr;
  ctx.fillText(attrText, (W - ctx.measureText(attrText).width) / 2, y);

  ctx.fillStyle = accent;
  ctx.font = '600 34px "Noto Serif Devanagari", serif';
  const brand = 'षि Scroll the Gita';
  ctx.fillText(brand, (W - ctx.measureText(brand).width) / 2, H - 90);

  try {
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return null;
    return new File([blob], `gita-${ref}.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}

export async function shareCard(payload) {
  const file = await quoteCard(payload);
  if (!file) return 'failed';
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Bhagavad Gita ${payload.ref}` });
      return 'shared';
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
