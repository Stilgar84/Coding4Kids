/**
 * Touch Drag and Drop Polyfill for Tablet and Mobile Touch Devices
 *
 * Translates native touch events (touchstart, touchmove, touchend, touchcancel)
 * into standard HTML5 Drag and Drop events (dragstart, dragenter, dragover, dragleave, drop, dragend).
 * Enables seamless drag-and-drop across palette items, multipliers, and sequence blocks on tablets.
 */

export class TouchDataTransfer {
  private data: Record<string, string> = {};
  public dropEffect: 'none' | 'copy' | 'link' | 'move' = 'move';
  public effectAllowed: string = 'all';

  get types(): readonly string[] {
    return Object.keys(this.data);
  }

  setData(format: string, value: string): void {
    this.data[format] = String(value);
  }

  getData(format: string): string {
    return this.data[format] || '';
  }

  clearData(format?: string): void {
    if (format) {
      delete this.data[format];
    } else {
      this.data = {};
    }
  }

  setDragImage(_image: Element, _offsetX: number, _offsetY: number): void {
    // Custom drag image hook
  }
}

interface TouchCoords {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
}

function extractTouchCoords(touch: Touch): TouchCoords {
  return {
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX,
    pageY: touch.pageY,
    screenX: touch.screenX,
    screenY: touch.screenY,
  };
}

export function dispatchDragEvent(
  type: 'dragstart' | 'drag' | 'dragenter' | 'dragleave' | 'dragover' | 'drop' | 'dragend',
  target: EventTarget,
  coords: TouchCoords,
  dataTransfer: TouchDataTransfer,
  relatedTarget?: EventTarget | null
): { defaultPrevented: boolean } {
  let event: Event;

  try {
    event = new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: coords.clientX,
      clientY: coords.clientY,
      screenX: coords.screenX,
      screenY: coords.screenY,
      buttons: 1,
    });
  } catch {
    event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: coords.clientX,
      clientY: coords.clientY,
      screenX: coords.screenX,
      screenY: coords.screenY,
      buttons: 1,
    });
  }

  // Ensure dataTransfer is accessible on the event
  Object.defineProperty(event, 'dataTransfer', {
    value: dataTransfer,
    writable: false,
    enumerable: true,
    configurable: true,
  });

  if (relatedTarget !== undefined) {
    Object.defineProperty(event, 'relatedTarget', {
      value: relatedTarget,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  // Ensure clientX / clientY are accurate
  Object.defineProperty(event, 'clientX', { value: coords.clientX, configurable: true });
  Object.defineProperty(event, 'clientY', { value: coords.clientY, configurable: true });
  Object.defineProperty(event, 'pageX', { value: coords.pageX, configurable: true });
  Object.defineProperty(event, 'pageY', { value: coords.pageY, configurable: true });

  target.dispatchEvent(event);
  return { defaultPrevented: event.defaultPrevented };
}

function findClosestDraggable(element: HTMLElement | null): HTMLElement | null {
  let current = element;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.getAttribute('draggable') === 'true' || current.draggable) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function initTouchDragDrop(): () => void {
  // Prevent duplicate initialization
  if ((window as unknown as { __touchDragDropInitialized?: boolean }).__touchDragDropInitialized) {
    return () => {};
  }
  (window as unknown as { __touchDragDropInitialized?: boolean }).__touchDragDropInitialized = true;

  const DRAG_START_THRESHOLD = 6; // pixels of movement before drag begins

  let activeTouchId: number | null = null;
  let sourceElement: HTMLElement | null = null;
  let startCoords: TouchCoords | null = null;
  let currentCoords: TouchCoords | null = null;
  let isDragging = false;
  let currentDataTransfer: TouchDataTransfer | null = null;
  let dragAvatar: HTMLElement | null = null;
  let avatarOffsetX = 0;
  let avatarOffsetY = 0;
  let lastHoverElement: Element | null = null;
  let isDropAllowed = false;

  const cleanupDrag = () => {
    if (dragAvatar && dragAvatar.parentElement) {
      dragAvatar.parentElement.removeChild(dragAvatar);
    }
    dragAvatar = null;
    sourceElement = null;
    activeTouchId = null;
    startCoords = null;
    currentCoords = null;
    isDragging = false;
    currentDataTransfer = null;
    lastHoverElement = null;
    isDropAllowed = false;
  };

  const handleTouchStart = (e: TouchEvent) => {
    // Only handle single touch
    if (e.touches.length !== 1 || isDragging) return;

    const touch = e.touches[0];
    const target = e.target as HTMLElement | null;
    const draggable = findClosestDraggable(target);

    if (!draggable) return;

    activeTouchId = touch.identifier;
    sourceElement = draggable;
    startCoords = extractTouchCoords(touch);
    currentCoords = { ...startCoords };
    isDragging = false;

    // Do NOT call e.preventDefault() here so normal taps/clicks fire without interference!
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (activeTouchId === null || !sourceElement || !startCoords) return;

    // Find the active touch
    let activeTouch: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) {
        activeTouch = e.touches[i];
        break;
      }
    }
    if (!activeTouch) return;

    currentCoords = extractTouchCoords(activeTouch);

    if (!isDragging) {
      const dx = currentCoords.clientX - startCoords.clientX;
      const dy = currentCoords.clientY - startCoords.clientY;
      const dist = Math.hypot(dx, dy);

      if (dist >= DRAG_START_THRESHOLD) {
        // If movement started inside the palette, only activate block drag if pointer/touch moves below the block bar
        const paletteRow =
          sourceElement.closest('[data-testid="palette-action-row"]') ||
          sourceElement.closest('[data-testid="palette-number-row"]') ||
          sourceElement.closest('[data-testid="palette-container"]');
        if (paletteRow) {
          const rowRect = (paletteRow as HTMLElement).getBoundingClientRect();
          const isBelowBar = currentCoords.clientY > rowRect.bottom + 4;
          if (!isBelowBar) {
            // Still inside block bar: allow horizontal scrolling, do not trigger drag yet, but prevent touchcancel
            if (e.cancelable) e.preventDefault();
            return;
          }
        }

        // Drag threshold reached (and below block bar if from palette): initiate drag operation
        isDragging = true;
        currentDataTransfer = new TouchDataTransfer();

        const { defaultPrevented } = dispatchDragEvent(
          'dragstart',
          sourceElement,
          currentCoords,
          currentDataTransfer
        );

        if (defaultPrevented) {
          // Drag cancelled by dragstart handler
          cleanupDrag();
          return;
        }

        // Create drag avatar clone centered around pointer/touch
        const rect = sourceElement.getBoundingClientRect();
        avatarOffsetX = rect.width / 2;
        avatarOffsetY = rect.height / 2;

        dragAvatar = sourceElement.cloneNode(true) as HTMLElement;
        dragAvatar.removeAttribute('id');
        dragAvatar.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        dragAvatar.setAttribute('data-drag-avatar', 'true');

        Object.assign(dragAvatar.style, {
          position: 'fixed',
          left: `${currentCoords.clientX - avatarOffsetX}px`,
          top: `${currentCoords.clientY - avatarOffsetY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: '0',
          padding: window.getComputedStyle(sourceElement).padding,
          zIndex: '999999',
          pointerEvents: 'none',
          opacity: '0.88',
          transform: 'scale(1.06)',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          transition: 'none',
          boxSizing: 'border-box',
        });

        document.body.appendChild(dragAvatar);
      }
    }

    if (isDragging && currentDataTransfer) {
      if (e.cancelable) {
        e.preventDefault(); // Prevent page scrolling during drag
      }

      // Update avatar position
      if (dragAvatar) {
        dragAvatar.style.left = `${currentCoords.clientX - avatarOffsetX}px`;
        dragAvatar.style.top = `${currentCoords.clientY - avatarOffsetY}px`;
      }

      // Find drop target under touch position (avatar has pointer-events: none)
      const hoverElement = document.elementFromPoint(currentCoords.clientX, currentCoords.clientY);

      if (hoverElement !== lastHoverElement) {
        if (lastHoverElement) {
          dispatchDragEvent(
            'dragleave',
            lastHoverElement,
            currentCoords,
            currentDataTransfer,
            hoverElement
          );
        }
        if (hoverElement) {
          dispatchDragEvent(
            'dragenter',
            hoverElement,
            currentCoords,
            currentDataTransfer,
            lastHoverElement
          );
        }
        lastHoverElement = hoverElement;
      }

      if (hoverElement) {
        const dragOverResult = dispatchDragEvent(
          'dragover',
          hoverElement,
          currentCoords,
          currentDataTransfer
        );
        isDropAllowed = dragOverResult.defaultPrevented;
      } else {
        isDropAllowed = false;
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (activeTouchId === null) return;

    // Check if the ended touch is our active touch
    let endedTouch: Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        endedTouch = e.changedTouches[i];
        break;
      }
    }
    if (!endedTouch) return;

    const finalCoords = extractTouchCoords(endedTouch);

    if (isDragging && sourceElement && currentDataTransfer) {
      if (e.cancelable) {
        e.preventDefault();
      }

      const dropTarget = document.elementFromPoint(finalCoords.clientX, finalCoords.clientY);

      if (dropTarget && isDropAllowed) {
        dispatchDragEvent('drop', dropTarget, finalCoords, currentDataTransfer);
      }

      dispatchDragEvent('dragend', sourceElement, finalCoords, currentDataTransfer);
    }

    cleanupDrag();
  };

  const handleTouchCancel = (e: TouchEvent) => {
    if (activeTouchId === null) return;

    let cancelledTouch: Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        cancelledTouch = e.changedTouches[i];
        break;
      }
    }
    if (!cancelledTouch) return;

    if (isDragging && sourceElement && currentDataTransfer && currentCoords) {
      dispatchDragEvent('dragend', sourceElement, currentCoords, currentDataTransfer);
    }

    cleanupDrag();
  };

  // Register passive: false listeners on window
  window.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  return () => {
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchCancel);
    cleanupDrag();
    (window as unknown as { __touchDragDropInitialized?: boolean }).__touchDragDropInitialized = false;
  };
}
