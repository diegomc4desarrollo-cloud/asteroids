'use strict';

// ── Capa táctil (iPhone / iPad) ───────────────────────────────────────────────
// Se carga después de game.js y no conoce nada del juego: su único contrato es
// escribir en `keys` / `justPressed` usando los mismos KeyboardEvent.code que el
// teclado, de modo que Ship.update(), pressed('Space') y pressed('KeyB') siguen
// funcionando sin cambios. En escritorio no engancha ningún listener.

(() => {
  const forced = new URLSearchParams(location.search).get('touch');
  const isTouch = forced === '1' ? true
                : forced === '0' ? false
                : window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  if (!isTouch) return;

  // La clase decide el tamaño CSS del canvas, así que debe aplicarse antes de
  // recalcular W/H.
  document.documentElement.classList.add('touch');

  // ── Bloqueo de zoom nativo (iOS Safari) ─────────────────────────────────────
  // 'gesturestart'/'gesturechange' cubre el pellizco con dos dedos, pero el
  // zoom por doble-toque rápido lo arma el reconocedor de gestos de UIKit a
  // partir del evento táctil "en bruto": llamar preventDefault() solo en el
  // pointerdown/pointerup sintético (como ya hace cada .tbtn) no basta en
  // todas las versiones de iOS, así que también se bloquea aquí el
  // touchstart/touchend real. Deben ir con { passive: false }: sin eso,
  // preventDefault() en eventos táctiles no tiene efecto en iOS.
  document.addEventListener('gesturestart',  (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchend',   (e) => e.preventDefault(), { passive: false });

  const releaseAll = () => { for (const code in keys) keys[code] = false; };

  // ── Botones ─────────────────────────────────────────────────────────────────
  for (const btn of document.querySelectorAll('.tbtn')) {
    const code   = btn.dataset.key;
    const repeat = Number(btn.dataset.repeat) || 0;
    let timer = null;

    const press = (e) => {
      e.preventDefault();
      if (!keys[code]) justPressed[code] = true;
      keys[code] = true;
      // La captura del puntero permite pulsar varios botones a la vez y evita
      // que la nave se quede acelerando si el dedo se desliza fuera del botón.
      btn.setPointerCapture(e.pointerId);
      // El disparo se repite mientras se mantiene pulsado; el shootCooldown de
      // Ship.tryShoot() sigue siendo quien limita la cadencia real.
      if (repeat && timer === null)
        timer = setInterval(() => { justPressed[code] = true; }, repeat);
    };

    const release = (e) => {
      e.preventDefault();
      keys[code] = false;
      if (timer !== null) { clearInterval(timer); timer = null; }
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ── Joystick analógico (gira y propulsa) ────────────────────────────────────
  const joyBase  = document.querySelector('#joystick .joystick-base');
  const joyStick = document.querySelector('#joystick .joystick-stick');
  let joyCenterX = 0, joyCenterY = 0, joyRadius = 1;

  const DEADZONE_FRAC  = 0.15; // radio mínimo antes de registrar dirección
  const AXIS_THRESHOLD = 0.35; // componente normalizada mínima por eje

  const updateJoystickKeys = (dx, dy, rawDist) => {
    if (rawDist < joyRadius * DEADZONE_FRAC) {
      keys['ArrowLeft'] = keys['ArrowRight'] = keys['ArrowUp'] = false;
      return;
    }
    const nx = dx / rawDist, ny = dy / rawDist;
    // Cada eje se evalúa por separado: un arrastre diagonal activa giro y
    // propulsión a la vez, como un stick analógico real.
    keys['ArrowLeft']  = nx < -AXIS_THRESHOLD;
    keys['ArrowRight'] = nx >  AXIS_THRESHOLD;
    keys['ArrowUp']    = ny < -AXIS_THRESHOLD;
  };

  const handleJoyMove = (e) => {
    const dx = e.clientX - joyCenterX;
    const dy = e.clientY - joyCenterY;
    const rawDist = Math.hypot(dx, dy);
    const clamped = Math.min(rawDist, joyRadius);
    const angle = Math.atan2(dy, dx);
    joyStick.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
    updateJoystickKeys(dx, dy, rawDist);
  };

  const endJoyDrag = (e) => {
    e.preventDefault();
    joyStick.classList.remove('dragging');
    joyStick.style.transform = 'translate(0, 0)';
    keys['ArrowLeft'] = keys['ArrowRight'] = keys['ArrowUp'] = false;
  };

  joyBase.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyBase.setPointerCapture(e.pointerId);
    const rect = joyBase.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    joyRadius  = rect.width / 2;
    joyStick.classList.add('dragging');
    handleJoyMove(e);
  });
  joyBase.addEventListener('pointermove', handleJoyMove);
  joyBase.addEventListener('pointerup', endJoyDrag);
  joyBase.addEventListener('pointercancel', endJoyDrag);
  joyBase.addEventListener('lostpointercapture', endJoyDrag);
  joyBase.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── Botón de Bomba Nova: solo visible si hay bombas en inventario ───────────
  const padLeft = document.getElementById('pad-left');
  setInterval(() => {
    padLeft.classList.toggle('has-bombs', novaBombs > 0);
  }, 150);

  // ── Tocar la pantalla reinicia tras GAME OVER ──────────────────────────────
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'gameover') justPressed['Space'] = true;
  });

  // ── Pausa en vertical, para no morir mientras se gira el dispositivo ───────
  // En vertical el campo está oculto y no tiene tamaño medible, así que la
  // partida definitiva no arranca hasta la primera vez que se está en horizontal.
  const portrait = window.matchMedia('(orientation: portrait)');
  let started = false;

  const applyOrientation = () => {
    if (portrait.matches) {
      paused = true;
      releaseAll();
      return;
    }
    resizeCanvas();
    // El juego ya se había inicializado a 800×600 al cargar game.js: se
    // reinicia para que los asteroides nazcan repartidos por el campo real.
    if (!started) { initGame(); started = true; }
    paused = false;
  };
  portrait.addEventListener('change', applyOrientation);
  applyOrientation();

  // Soltar los mandos si la app pasa a segundo plano
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
})();
