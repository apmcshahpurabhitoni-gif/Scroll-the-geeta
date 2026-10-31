// Keyboard navigation for the verse frame. Mounted once, listens globally,
// and stays out of the way of inputs, sheets and the chapter card.

const FORM_TAGS = /^(input|textarea|select)$/i;

export function initVerseKeys({
  onNext,
  onPrev,
  onHome,
  scrollBody,
  closeTransliteration,
  isBlocked = () => false,
}) {
  const onKeyDown = (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isBlocked()) {
      if (e.key === 'Escape') closeTransliteration();
      return;
    }
    const target = e.target;
    if (target && (FORM_TAGS.test(target.tagName) || target.isContentEditable)) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
      case 'J':
        e.preventDefault();
        onNext();
        break;
      case 'ArrowUp':
      case 'k':
      case 'K':
        e.preventDefault();
        onPrev();
        break;
      case 'PageDown':
        e.preventDefault();
        if (!scrollBody(1)) onNext();
        break;
      case 'PageUp':
        e.preventDefault();
        if (!scrollBody(-1)) onPrev();
        break;
      case 'Home':
        e.preventDefault();
        onHome();
        break;
      case 'Escape':
        closeTransliteration();
        break;
      default:
        break;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
