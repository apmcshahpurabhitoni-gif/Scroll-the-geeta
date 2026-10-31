// Ad configuration — driven by PUBLIC build-time env values (see .env.example).
//
//   VITE_ADSENSE_CLIENT       your ca-pub-… publisher id
//   VITE_ADSENSE_SLOT_DAILY   ad unit id for the slot after the daily quote
//   VITE_ADSENSE_SLOT_READER  ad unit id for the slot in the Explore feed
//
// AdSense client/slot ids are public by design (they ship in every page that
// shows an ad) — they are not secrets.
//
// Behaviour:
//   • all three values set  → real AdSense ads are loaded into both slots
//   • anything missing      → the slots render a clearly-labelled EMPTY
//     placeholder so you can see where ads will go. No fake or invented ads
//     are ever shown. Ad failures are contained so they can never break the
//     reading experience.
const client = import.meta.env.VITE_ADSENSE_CLIENT || '';

export const ads = {
  enabled: Boolean(client),
  publisherId: client,
  slots: {
    daily: import.meta.env.VITE_ADSENSE_SLOT_DAILY || '', // after the daily quote + reading controls
    reader: import.meta.env.VITE_ADSENSE_SLOT_READER || '', // every ~50 verses in Explore
  },
  placeholderNote: 'AdSense is not connected in this build.',
  privacyNote:
    'If ads are enabled, Google AdSense may use cookies to serve ads based on your prior visits. ' +
    (client ? 'Ad slots are active in this build.' : 'No ad network is connected in this build — the slots show placeholders only.'),
};

export function adsReady() {
  return Boolean(ads.enabled && ads.publisherId && ads.slots.daily && ads.slots.reader);
}
