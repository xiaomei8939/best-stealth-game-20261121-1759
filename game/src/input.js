// SHADOW VAULT — keyboard and mouse input.
// One object owns the whole control state: held movement keys, edge-triggered
// actions (takedown, coin, pause) and the mouse position for aiming a thrown
// coin. The world reads it every step; the UI reads the edge events.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed by whoever reads it
  let mouse = { x: 0, y: 0, clicked: false, clickedAt: { x: 0, y: 0 } };

  const MOVE_KEYS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  }

  function onMouseDown(event) {
    onMouseMove(event);
    mouse.clicked = true;
    mouse.clickedAt = { x: mouse.x, y: mouse.y };
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement vector from the held keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    isSneaking() {
      return keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight');
    },
    isSprinting() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    /** True while this physical key is held down. */
    isDown(code) {
      return keys.has(code);
    },
    /** True once per physical key press; reading consumes it. */
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    anyPressed(codes) {
      for (const code of codes) {
        if (this.wasPressed(code)) return true;
      }
      return false;
    },
    /** True once per mouse click; reading consumes it. */
    consumeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickedAt.x, y: mouse.clickedAt.y };
    },
    mousePos() {
      return { x: mouse.x, y: mouse.y };
    },
    /** Drop the edge queue (used when switching screens). */
    clearEdges() {
      pressed.clear();
      mouse.clicked = false;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
    },
  };
}
