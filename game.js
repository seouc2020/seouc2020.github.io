(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const COLS = 30;
  const ROWS = 20;
  const CELL = canvas.width / COLS;
  const DIFFICULTY = { low: 180, medium: 125, high: 85 };
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  const els = {
    difficulty: document.querySelector('#difficulty'),
    score: document.querySelector('#score'),
    highScore: document.querySelector('#high-score'),
    health: document.querySelector('#health'),
    status: document.querySelector('#game-status'),
    start: document.querySelector('#start-game'),
    pause: document.querySelector('#pause-game'),
    restart: document.querySelector('#restart-game'),
    invincible: document.querySelector('#invincible'),
    invincibleStatus: document.querySelector('#invincible-status'),
    touch: [...document.querySelectorAll('[data-direction]')]
  };

  let snake;
  let direction;
  let nextDirection;
  let food;
  let enemies;
  let score;
  let health;
  let running = false;
  let paused = false;
  let gameOver = false;
  let moveTimer = null;
  let invincible = false;
  let invincibleUntil = 0;
  let invincibleCooldownUntil = 0;
  let invincibleTimer = null;
  let damageCooldownUntil = 0;
  let explosions = [];

  const getBest = () => {
    try { return Number(localStorage.getItem('snake-best-score') || 0); } catch { return 0; }
  };
  const setBest = (value) => {
    try { localStorage.setItem('snake-best-score', String(value)); } catch { /* storage is optional */ }
  };
  const randomCell = () => ({ x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) });
  const sameCell = (a, b) => a.x === b.x && a.y === b.y;
  const isOccupied = (cell) => snake.some((part) => sameCell(part, cell)) || enemies.some((enemy) => sameCell(enemy, cell));
  const newFreeCell = () => {
    let cell = randomCell();
    let tries = 0;
    while (isOccupied(cell) && tries < 100) { cell = randomCell(); tries += 1; }
    return cell;
  };

  function resetGame() {
    clearInterval(moveTimer);
    moveTimer = null;
    snake = [{ x: 15, y: 10 }, { x: 14, y: 10 }, { x: 13, y: 10 }];
    direction = 'right';
    nextDirection = 'right';
    score = 0;
    health = 3;
    enemies = [{ x: 5, y: 4, direction: 'down' }, { x: 24, y: 6, direction: 'left' }, { x: 24, y: 16, direction: 'up' }];
    food = newFreeCell();
    explosions = [];
    running = false;
    paused = false;
    gameOver = false;
    invincible = false;
    invincibleUntil = 0;
    invincibleCooldownUntil = 0;
    damageCooldownUntil = 0;
    clearTimeout(invincibleTimer);
    updateUi();
    draw();
  }

  function updateUi() {
    const best = Math.max(getBest(), score);
    els.score.textContent = String(score);
    els.highScore.textContent = String(best);
    els.health.querySelectorAll('i').forEach((cell, index) => cell.classList.toggle('empty', index >= health));
    els.start.disabled = running;
    els.pause.disabled = !running || gameOver;
    els.pause.textContent = paused ? '계속하기' : '일시정지';
    const cooldown = Math.max(0, invincibleCooldownUntil - Date.now());
    els.invincible.disabled = cooldown > 0 || invincible || !running || gameOver;
    if (invincible) els.invincibleStatus.textContent = `무적 활성: ${Math.ceil(Math.max(0, invincibleUntil - Date.now()) / 1000)}초`;
    else if (cooldown > 0) els.invincibleStatus.textContent = `무적 재사용 대기: ${Math.ceil(cooldown / 1000)}초`;
    else els.invincibleStatus.textContent = '무적 버튼: 사용 가능';
    els.status.classList.toggle('is-hidden', running && !gameOver);
    if (gameOver) els.status.textContent = 'GAME OVER · 재시작 버튼을 눌러 다시 시작하세요.';
    else if (paused) els.status.textContent = '일시정지됨';
    else if (!running) els.status.textContent = '시작 버튼을 눌러 게임을 시작하세요.';
  }

  function setDirection(name) {
    if (!DIRECTIONS[name] || name === OPPOSITE[direction]) return;
    nextDirection = name;
  }

  function startGame() {
    if (gameOver) resetGame();
    if (running) return;
    running = true;
    paused = false;
    clearInterval(moveTimer);
    moveTimer = setInterval(tick, DIFFICULTY[els.difficulty.value]);
    updateUi();
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    updateUi();
  }

  function activateInvincibility() {
    if (!running || invincible || Date.now() < invincibleCooldownUntil) return;
    invincible = true;
    invincibleUntil = Date.now() + 15000;
    invincibleCooldownUntil = Date.now() + 60000;
    clearTimeout(invincibleTimer);
    invincibleTimer = setTimeout(() => { invincible = false; updateUi(); draw(); }, 15000);
    updateUi();
  }

  function moveEnemies() {
    enemies = enemies.map((enemy) => {
      let next = enemy.direction;
      if (Math.random() < .25) next = Object.keys(DIRECTIONS)[Math.floor(Math.random() * 4)];
      const vector = DIRECTIONS[next];
      const candidate = { x: enemy.x + vector.x, y: enemy.y + vector.y };
      if (candidate.x < 0 || candidate.x >= COLS || candidate.y < 0 || candidate.y >= ROWS) return { ...enemy, direction: OPPOSITE[next] };
      return { x: candidate.x, y: candidate.y, direction: next };
    });
  }

  function damageAt(cell) {
    if (invincible || Date.now() < damageCooldownUntil) return;
    health -= 1;
    damageCooldownUntil = Date.now() + 800;
    explosions.push({ x: cell.x, y: cell.y, ttl: 12 });
    if (health <= 0) finishGame();
  }

  function finishGame() {
    running = false;
    gameOver = true;
    clearInterval(moveTimer);
    moveTimer = null;
    if (score > getBest()) setBest(score);
    updateUi();
    draw();
  }

  function tick() {
    if (!running || paused || gameOver) return;
    direction = nextDirection;
    const vector = DIRECTIONS[direction];
    const head = { x: snake[0].x + vector.x, y: snake[0].y + vector.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some((part) => sameCell(part, head))) { finishGame(); return; }
    snake.unshift(head);
    if (sameCell(head, food)) { score += 10; food = newFreeCell(); } else snake.pop();
    moveEnemies();
    enemies.forEach((enemy) => { if (sameCell(head, enemy)) damageAt(head); });
    explosions = explosions.map((effect) => ({ ...effect, ttl: effect.ttl - 1 })).filter((effect) => effect.ttl > 0);
    updateUi();
    draw();
  }

  function drawCell(cell, color, inset = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(cell.x * CELL + inset, cell.y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
  }

  function draw() {
    ctx.fillStyle = '#020704';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0d2a1d';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke(); }
    drawCell(food, '#f2d34f', 3);
    enemies.forEach((enemy) => drawCell(enemy, '#be67ff', 2));
    snake.forEach((part, index) => drawCell(part, index === 0 ? '#ff4b50' : '#51f29a', index === 0 ? 1 : 2));
    explosions.forEach((effect) => {
      ctx.beginPath();
      ctx.arc(effect.x * CELL + CELL / 2, effect.y * CELL + CELL / 2, (14 - effect.ttl) * 2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 120, 45, ${effect.ttl / 12})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  document.addEventListener('keydown', (event) => {
    const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (keys[event.key]) { event.preventDefault(); setDirection(keys[event.key]); }
    if (event.key === ' ') { event.preventDefault(); togglePause(); }
  });
  els.touch.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  els.start.addEventListener('click', startGame);
  els.pause.addEventListener('click', togglePause);
  els.restart.addEventListener('click', () => { resetGame(); startGame(); });
  els.invincible.addEventListener('click', activateInvincibility);
  els.difficulty.addEventListener('change', () => { if (running) { clearInterval(moveTimer); moveTimer = setInterval(tick, DIFFICULTY[els.difficulty.value]); } });
  setInterval(() => { if (invincible || invincibleCooldownUntil > Date.now()) { updateUi(); draw(); } }, 250);
  resetGame();
})();
