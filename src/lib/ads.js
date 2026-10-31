// Ad slots. With complete AdSense ids in ads.config.js the real ad script is
// loaded; without them the slot shows a clearly-labelled empty placeholder
// (never a fake ad). Ad script loading is fully guarded: any failure removes
// the <ins> element so the reading experience can never break.
import { ads, adsReady } from '../ads.config.js';

let scriptLoaded = false;

function ensureScript() {
  if (scriptLoaded || !adsReady()) return;
  scriptLoaded = true;
  try {
    // AdSense site verification — only present when a real client id exists.
    if (!document.querySelector('meta[name="google-adsense-account"]')) {
      const meta = document.createElement('meta');
      meta.name = 'google-adsense-account';
      meta.content = ads.publisherId;
      document.head.appendChild(meta);
    }
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.publisherId}`;
    s.onerror = () => {
      scriptLoaded = false;
    };
    document.head.appendChild(s);
  } catch {
    scriptLoaded = false;
  }
}

function renderPlaceholder(container, slotKey) {
  container.innerHTML = '';
  container.classList.add('ad-placeholder');
  container.dataset.slot = slotKey;
  const label = document.createElement('span');
  label.className = 'ad-label';
  label.textContent = 'Advertisement';
  const note = document.createElement('span');
  note.className = 'ad-hint';
  note.textContent = ads.placeholderNote;
  container.append(label, note);
  return false;
}

/** Mount an ad slot into `container`. Returns true only for a real ad. */
export function mountAd(container, slotKey) {
  container.innerHTML = '';
  container.classList.remove('ad-placeholder');
  if (!adsReady()) return renderPlaceholder(container, slotKey);
  try {
    const label = document.createElement('div');
    label.className = 'ad-label';
    label.textContent = 'Advertisement';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = ads.publisherId;
    ins.dataset.adSlot = ads.slots[slotKey];
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    ins.addEventListener('error', () => container.remove(), { once: true });
    container.append(label, ins);
    ensureScript();
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    return true;
  } catch {
    renderPlaceholder(container, slotKey);
    return false;
  }
}
