// Saved: bookmarks with quick access and removal.
import { h, clear } from '../lib/dom.js';
import { core, translationArr, refOf } from '../lib/data.js';
import { store } from '../lib/store.js';

const BOOKMARK_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M7 4.6h10a.9.9 0 0 1 .9.9V20l-5.9-3.7L6.1 20V5.5a.9.9 0 0 1 .9-.9Z"/></svg>';

const REMOVE_ICON =
  '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';

export async function renderSaved(container, ctx) {
  clear(container);
  const wrap = h('div', { class: 'wrap' });
  const bookmarks = [...store.state.bookmarks].sort((a, b) => a - b);

  wrap.append(
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title', id: 'saved-title' }, 'Saved'),
      h(
        'p',
        { class: 'page-sub' },
        bookmarks.length === 0
          ? 'Verses you bookmark appear here.'
          : `${bookmarks.length} verse${bookmarks.length === 1 ? '' : 's'} kept on this device.`
      )
    )
  );

  if (bookmarks.length === 0) {
    wrap.append(
      h(
        'div',
        { class: 'empty-state' },
        h('span', { html: BOOKMARK_ICON }),
        h('p', {}, 'Nothing saved yet. Bookmark a verse while reading and it will be waiting here.'),
        h(
          'button',
          { class: 'btn btn-secondary', onclick: () => (location.hash = '#/today') },
          'Open today’s verse'
        )
      )
    );
    container.append(wrap);
    return;
  }

  const texts = await translationArr();
  const list = h('ul', { class: 'list' });

  for (const i of bookmarks) {
    const v = core.verses[i];
    if (!v) continue;
    list.append(
      h(
        'li',
        {},
        h(
          'div',
          { class: 'list-item' },
          h(
            'button',
            { class: 'li-main', onclick: () => ctx.exploreAt(i) },
            h('span', { class: 'li-ref' }, `Bhagavad Gita ${refOf(i)}`),
            h('span', { class: 'li-snippet' }, (texts[i] || v.sk).slice(0, 180))
          ),
          h(
            'button',
            {
              class: 'icon-action',
              'aria-label': `Remove bookmark ${refOf(i)}`,
              onclick: (e) => {
                store.set(
                  'bookmarks',
                  store.state.bookmarks.filter((x) => x !== i)
                );
                e.currentTarget.closest('li').remove();
              },
              html: REMOVE_ICON,
            }
          )
        )
      )
    );
  }

  wrap.append(list);
  container.append(wrap);
}
