// Topics: auto-generated keyword tags over translations, clearly labelled as
// unreviewed. Every topic shows the full verse list — nothing is hidden.
import { h, clear } from '../lib/dom.js';
import { core, translationArr, refOf } from '../lib/data.js';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';

let activeTopic = null;

export async function renderTopics(container, ctx) {
  clear(container);
  const wrap = h('div', { class: 'wrap' });
  wrap.append(
    h(
      'div',
      { class: 'page-head' },
      h('h1', { class: 'page-title', id: 'topics-title' }, 'Topics'),
      h('p', { class: 'page-sub' }, core.topics.label)
    )
  );

  const counts = {};
  for (const tags of core.topics.byVerse) for (const t of tags) counts[t] = (counts[t] || 0) + 1;

  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Topics' });
  const list = h('ul', { class: 'list' });

  const select = async (topic) => {
    activeTopic = activeTopic === topic ? null : topic;
    chips.querySelectorAll('.chip').forEach((c) => {
      const on = c.dataset.topic === activeTopic;
      c.classList.toggle('active', on);
      c.setAttribute('aria-selected', String(on));
    });
    clear(list);
    if (!activeTopic) {
      list.append(
        h('li', {}, h('p', { class: 'empty-state' }, 'Choose a topic above to see the verses associated with it.'))
      );
      return;
    }
    const texts = await translationArr('en');
    const indices = [];
    core.topics.byVerse.forEach((tags, i) => tags.includes(activeTopic) && indices.push(i));
    for (const i of indices) {
      const v = core.verses[i];
      list.append(
        h(
          'li',
          {},
          h(
            'button',
            {
              class: 'list-item',
              onclick: () => ctx.exploreAt(i),
            },
            h(
              'span',
              { class: 'li-main' },
              h('span', { class: 'li-ref' }, `Bhagavad Gita ${refOf(i)}`),
              h('span', { class: 'li-snippet' }, (texts[i] || '').slice(0, 180))
            ),
            h('span', { class: 'li-meta', html: CHEVRON_ICON })
          )
        )
      );
    }
  };

  for (const topic of core.topics.topics) {
    const chip = h(
      'button',
      {
        class: 'chip',
        'data-topic': topic,
        role: 'tab',
        'aria-selected': 'false',
        onclick: () => select(topic),
      },
      h('span', {}, topic),
      h('span', { class: 'count' }, String(counts[topic] || 0))
    );
    chips.append(chip);
  }

  wrap.append(chips);
  if (!activeTopic) {
    list.append(
      h('li', {}, h('p', { class: 'empty-state' }, 'Choose a topic above to see the verses associated with it.'))
    );
  }
  wrap.append(list);
  container.append(wrap);
  if (activeTopic) select(activeTopic); // restore selection across visits
}
