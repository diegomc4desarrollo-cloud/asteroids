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
