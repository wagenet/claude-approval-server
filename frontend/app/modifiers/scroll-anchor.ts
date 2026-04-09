import { modifier } from 'ember-modifier';

/** Absolute page position via offsetParent chain — unaffected by CSS transforms. */
function layoutTop(el: HTMLElement): number {
  let top = 0;
  let cur: HTMLElement | null = el;
  while (cur) {
    top += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return top;
}

/**
 * Preserves scroll position when cards are added or removed from the queue.
 *
 * Works in tandem with the cardTransition in approval-queue.gts, which uses
 * only fadeIn (no move/fadeOut). Without those animations there is no CSS
 * transform fighting the correction and no deferred DOM removal causing a
 * second ResizeObserver entry. Each queue change is a single layout event,
 * corrected here with one synchronous scrollBy before the frame paints.
 *
 * layoutTop (offsetParent traversal) is used instead of getBoundingClientRect
 * so the measurement is in stable page coordinates regardless of any
 * transforms that may be present on other elements.
 */
export default modifier(function scrollAnchor(element: HTMLElement) {
  let anchorNode: HTMLElement | null = null;
  let anchorLayoutTop = 0;
  let anchorOffsetHeight = 0;

  function pickAnchor() {
    for (const child of element.children) {
      const rect = child.getBoundingClientRect();
      // First child not entirely scrolled past the viewport top.
      if (rect.bottom > 0) {
        anchorNode = child as HTMLElement;
        anchorLayoutTop = layoutTop(anchorNode);
        anchorOffsetHeight = anchorNode.offsetHeight;
        return;
      }
    }
    anchorNode = null;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (anchorNode?.isConnected) {
      const delta = layoutTop(anchorNode) - anchorLayoutTop;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy(0, delta);
      }
    } else if (anchorNode) {
      // Anchor was removed. Its layout space is gone, so everything below moved
      // up by the anchor's height. Scroll up by the same amount to keep the
      // content that was below the anchor at the same viewport position.
      if (anchorOffsetHeight > 0.5) {
        window.scrollBy(0, -anchorOffsetHeight);
      }
    }
    pickAnchor();
  });

  pickAnchor();
  resizeObserver.observe(element);

  return () => resizeObserver.disconnect();
});
