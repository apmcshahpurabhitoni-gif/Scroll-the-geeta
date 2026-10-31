// Swipe navigation for the verse frame.
// A gesture starts in a zone (a rail, or the left/right 15% edge of the body),
// is measured on pointerup, and only fires past a distance OR velocity floor,
// so taps on buttons inside a rail still work.
//
// Vanilla equivalent of the "@use-gesture/react" requirement in the brief:
// this project has no React, so the hook is a small DOM module.

export function initSwipeNav({ zones, onNext, onPrev, threshold = 80, velocity = 0.5, axisBias = 1.5 }) {
  const teardown = [];

  for (const zone of zones) {
    if (!zone) continue;
    let start = null;
    let suppressClickUntil = 0;

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Never hijack typing.
      if (e.target.closest('input, textarea, select')) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      // No setPointerCapture here: capturing on the rail retargets the click
      // away from the buttons inside it, so taps would never activate them.
    };

    const onPointerUp = (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dy = e.clientY - start.y;
      const dx = e.clientX - start.x;
      const dt = Math.max(1, performance.now() - start.t);
      const speed = Math.abs(dy) / dt;
      start = null;
      const vertical = Math.abs(dy) > Math.abs(dx) * axisBias;
      if (!vertical) return;
      if (Math.abs(dy) < threshold && speed < velocity) return;
      suppressClickUntil = performance.now() + 450; // a swipe is not a tap
      dy < 0 ? onNext() : onPrev();
    };

    const onPointerCancel = () => {
      start = null;
    };

    // Swallow the click a browser may still synthesise after a swipe.
    const onClickCapture = (e) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    zone.addEventListener('pointerdown', onPointerDown);
    // Release is watched on the window so a gesture that leaves the rail still
    // completes, without taking pointer capture away from its buttons.
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    zone.addEventListener('click', onClickCapture, true);
    teardown.push(() => {
      zone.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      zone.removeEventListener('click', onClickCapture, true);
    });
  }

  return () => teardown.forEach((fn) => fn());
}

/**
 * Edge-strip navigation for the body. A gesture starting inside the left or
 * right 15% strip navigates; the middle of the body keeps native scrolling.
 */
export function initEdgeNav(el, { onNext, onPrev, threshold = 80, velocity = 0.5, ratio = 0.15 }) {
  if (!el) return () => {};
  let start = null;

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button, a, input, select, textarea, summary')) return;
    const rect = el.getBoundingClientRect();
    if (!edgeZoneFor(e.clientX, rect, ratio)) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };

  const onPointerUp = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dy = e.clientY - start.y;
    const dx = e.clientX - start.x;
    const dt = Math.max(1, performance.now() - start.t);
    start = null;
    if (Math.abs(dy) <= Math.abs(dx) * 1.5) return;
    if (Math.abs(dy) < threshold && Math.abs(dy) / dt < velocity) return;
    dy < 0 ? onNext() : onPrev();
  };

  const cancel = () => {
    start = null;
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', cancel);
  };
}

/**
 * Returns 'left' / 'right' when a pointer starts in the outer 15% strip of the
 * body, so the caller can treat the gesture as navigation rather than scroll.
 */
export function edgeZoneFor(clientX, rect, ratio = 0.15) {
  const x = clientX - rect.left;
  if (x <= rect.width * ratio) return 'left';
  if (x >= rect.width * (1 - ratio)) return 'right';
  return null;
}
