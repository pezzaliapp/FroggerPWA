// Frogger — mobile-first PWA (Tributo didattico) © 2025 pezzaliAPP (MIT)
(() => {
  'use strict';

  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');

  // Logical grid
  const COLS = 14;     // columns (mobile-friendly)
  const ROWS = 16;     // rows
  let TILE;            // computed on resize
  let W, H;            // canvas logical size

  // Game state
  let running = false;
  let paused = false;
  let level = 1;
  let points = 0;
  let lives = 3;
  let homesFilled = 0;
  let frog = null;
  let lanes = [];
  let lastTime = 0;

  // HUD
  const $ = sel => document.querySelector(sel);
  const btnPlay = $('#btnPlay');
  const btnPause = $('#btnPause');
  const livesEl = $('#lives');
  const levelEl = $('#level');
  const pointsEl = $('#points');

  function updateHud(){
    livesEl.textContent = `❤️ x${lives}`;
    levelEl.textContent = `Livello ${level}`;
    pointsEl.textContent = `Punti ${String(points).padStart(4,'0')}`;
  }

  // Sounds (simple, start after first tap to comply with iOS)
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx, canPlay = false;
  function initAudio(){
    if (!actx){ actx = new AudioCtx(); }
    canPlay = true;
  }
  function beep(freq=880, dur=0.07){
    if(!canPlay || !actx) return;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(actx.destination);
    osc.start();
    setTimeout(()=>osc.stop(), dur*1000);
  }

  // Resize logic: keep aspect by rows*cols
  function resize(){
    // Logical tile based on current CSS size
    const cssWidth = cvs.clientWidth;
    TILE = Math.floor(cssWidth / COLS);
    W = TILE * COLS;
    H = TILE * ROWS;
    cvs.width = W;
    cvs.height = H;
  }
  window.addEventListener('resize', resize, {passive:true});
  resize();

  // Lanes setup
  // Rows: [0..ROWS-1], top is 0. Homes at row 1, river rows 2..6, safe row 7, road rows 8..13, start row 14, bottom margin 15.
  const HOME_ROW = 1;
  const START_ROW = ROWS - 2;

  const homes = []; // positions filled
  function resetHomes(){
    homes.length = 0;
  }

  function makeLanes(){
    lanes = [];
    // River: rows 2..6
    // log/turtle entities have positive dx (to right) or negative (to left)
    const riverRows = [2,3,4,5,6];
    riverRows.forEach((r,i)=>{
      const speed = (i%2 ? -1 : 1) * (0.6 + 0.1*level + i*0.05);
      const size = (i%2 ? 3 : 2); // log length in tiles
      lanes.push(spawnLane(r, 'river', speed, size, 5));
    });
    // Road: rows 8..13
    const roadRows = [8,9,10,11,12,13];
    roadRows.forEach((r,i)=>{
      const speed = (i%2 ? 1 : -1) * (0.9 + 0.12*level + i*0.07);
      lanes.push(spawnLane(r, 'road', speed, 1, 6));
    });
  }

  function spawnLane(row, kind, speed, size, density){
    const entities = [];
    // Fill across width in spaced positions
    for (let i=0; i<density; i++){
      // staggered start
      const x = Math.floor((i * (COLS/density)) % COLS);
      entities.push({
        x, row, kind, size, speed
      });
    }
    return {row, kind, entities, speed, size};
  }

  function resetFrog(){
    frog = { col: Math.floor(COLS/2), row: START_ROW, onLog: null, alive:true };
  }

  function resetLevel(){
    resetHomes();
    makeLanes();
    resetFrog();
    homesFilled = 0;
  }

  function startGame(){
    initAudio();
    if (lives <= 0){
      // full reset
      level = 1; points = 0; lives = 3;
    }
    resetLevel();
    running = true;
    paused = false;
    btnPlay.textContent = '▶︎ Restart';
    updateHud();
    beep(660,0.08);
  }

  function togglePause(){
    paused = !paused;
    btnPause.textContent = paused ? 'Riprendi' : 'Pausa';
  }

  btnPlay?.addEventListener('click', startGame);
  btnPause?.addEventListener('click', togglePause);

  // Movement (grid based)
  function move(dir){
    if(!running || paused) return;
    beep(880,0.05);
    if (dir === 'up' && frog.row > 0) frog.row--;
    if (dir === 'down' && frog.row < START_ROW) frog.row++;
    if (dir === 'left' && frog.col > 0) frog.col--;
    if (dir === 'right' && frog.col < COLS-1) frog.col++;
    // Reached home row?
    if (frog.row === HOME_ROW){
      // Snap to nearest home slot (5 homes)
      const slots = 5;
      const slotW = COLS / slots;
      const idx = Math.floor(frog.col / slotW);
      if (!homes.includes(idx)){
        homes.push(idx);
        points += 50;
        frog.row = START_ROW; frog.col = Math.floor(COLS/2);
        homesFilled++;
        if (homesFilled >= 5){
          // Next level
          level++;
          points += 200;
          resetLevel();
        }
        updateHud();
      } else {
        // occupied -> death
        frogDies();
      }
    }
  }

  // Touch controls (D-Pad)
  document.querySelectorAll('.dir').forEach(btn=>{
    btn.addEventListener('click', e => move(e.currentTarget.dataset.dir));
  });

  // Swipe controls
  let touchStart = null;
  const zone = document.getElementById('touchZone');
  zone.addEventListener('touchstart', e => {
    if (!running) startGame();
    initAudio();
    touchStart = {x:e.touches[0].clientX, y:e.touches[0].clientY};
  }, {passive:true});
  zone.addEventListener('touchend', e => {
    if(!touchStart) return;
    const dx = (e.changedTouches[0].clientX - touchStart.x);
    const dy = (e.changedTouches[0].clientY - touchStart.y);
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax,ay) > 24){
      if (ax > ay) move(dx>0?'right':'left');
      else move(dy>0?'down':'up');
    }
    touchStart = null;
  }, {passive:true});

  // Keyboard (for laptop testing)
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k==='arrowup' || k==='w') move('up');
    if (k==='arrowdown' || k==='s') move('down');
    if (k==='arrowleft' || k==='a') move('left');
    if (k==='arrowright' || k==='d') move('right');
    if (k===' ' || k==='enter') { if(!running) startGame(); else togglePause(); }
  });

  function frogDies(){
    if(!frog.alive) return;
    frog.alive = false;
    beep(180,0.2);
    lives--;
    updateHud();
    if (lives <= 0){
      running = false;
      setTimeout(()=>{
        alert(`Game Over — Punti: ${points}`);
        btnPlay.textContent = '▶︎ Play';
      }, 50);
    } else {
      setTimeout(resetFrog, 300);
    }
  }

  // Update entities positions and collisions
  function update(dt){
    // Move entities
    lanes.forEach(lane => {
      lane.entities.forEach(ent => {
        ent.x += ent.speed * dt;
        // wrap
        if (ent.x < -4) ent.x = COLS + 4;
        if (ent.x > COLS + 4) ent.x = -4;
      });
    });

    // Collisions
    frog.onLog = null;
    const fr = frog.row;

    // Road rows: car hit
    if (fr >= 8 && fr <= 13){
      const lane = lanes.find(l=>l.row===fr);
      if (lane){
        const hit = lane.entities.some(ent => {
          for (let i=0;i<ent.size;i++){
            const cx = Math.floor(ent.x+i);
            if (cx===frog.col) return true;
          }
          return false;
        });
        if (hit) frogDies();
      }
    }

    // River rows: must be on log/turtle
    if (fr >= 2 && fr <= 6){
      const lane = lanes.find(l=>l.row===fr);
      let on = false, carrySpeed = 0;
      if (lane){
        lane.entities.forEach(ent => {
          for (let i=0;i<ent.size;i++){
            const cx = Math.floor(ent.x+i);
            if (cx===frog.col){ on = true; carrySpeed = lane.speed; }
          }
        });
      }
      if (!on){ frogDies(); }
      else {
        // carry frog
        frog._carry = (frog._carry||0) + carrySpeed * dt;
        // move when carry accumulates 1 tile
        if (Math.abs(frog._carry) >= 1){
          const step = Math.sign(frog._carry);
          frog.col += step;
          frog._carry -= step;
          if (frog.col<0 || frog.col>=COLS) frogDies();
        }
      }
    }
  }

  // Drawing helpers
  function rect(x,y,w,h, color){
    ctx.fillStyle = color;
    ctx.fillRect(x,y,w,h);
  }
  function cell(col,row, color){
    rect(col*TILE, row*TILE, TILE, TILE, color);
  }
  function roundRect(x,y,w,h,r,color){
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawBackground(){
    // homes area
    rect(0, 0, W, TILE*2, '#12224a');
    // river
    rect(0, TILE*2, W, TILE*5, '#0b245c');
    // safe strip
    rect(0, TILE*7, W, TILE, '#10224e');
    // road
    rect(0, TILE*8, W, TILE*6, '#1b1b1b');
    // start strip
    rect(0, TILE*14, W, TILE, '#10224e');
    // lane separators (subtle)
    ctx.globalAlpha = 0.1;
    for (let r=0; r<ROWS; r++){
      rect(0, r*TILE, W, 2, '#ffffff');
    }
    ctx.globalAlpha = 1;

    // Home slots (5)
    const slots = 5, slotW = W/slots;
    for (let i=0;i<slots;i++){
      const cx = i*slotW + slotW/2;
      roundRect(cx - TILE*1, TILE*0.2, TILE*2, TILE*1.6, 6, homes.includes(i)? '#2dd36f' : '#0b1536');
    }
  }

  function drawEntities(){
    // Draw logs & turtles
    lanes.filter(l=>l.kind==='river').forEach(lane => {
      lane.entities.forEach(ent => {
        for (let i=0;i<ent.size;i++){
          const col = Math.floor(ent.x+i);
          roundRect(col*TILE+2, lane.row*TILE+6, TILE-4, TILE-12, 8, '#8b5a2b');
        }
      });
    });
    // Draw cars
    lanes.filter(l=>l.kind==='road').forEach(lane => {
      lane.entities.forEach(ent => {
        for (let i=0;i<ent.size;i++){
          const col = Math.floor(ent.x+i);
          roundRect(col*TILE+3, lane.row*TILE+5, TILE-6, TILE-10, 8, '#ffd166');
          rect(col*TILE+10, lane.row*TILE+8, TILE-20, TILE-16, '#333');
        }
      });
    });
  }

  function drawFrog(){
    if (!frog) return;
    const x = frog.col*TILE;
    const y = frog.row*TILE;
    roundRect(x+4,y+4,TILE-8,TILE-8,8, frog.alive? '#2dd36f' : '#ff4d6d');
    // eyes
    ctx.fillStyle = '#0a1228';
    ctx.fillRect(x+TILE*0.45, y+TILE*0.28, 3,3);
    ctx.fillRect(x+TILE*0.60, y+TILE*0.28, 3,3);
  }

  function frame(ts){
    const dt = Math.min(0.04, (ts - lastTime)/1000 || 0);
    lastTime = ts;

    resize(); // keep crisp on orientation changes
    ctx.clearRect(0,0,cvs.width,cvs.height);

    drawBackground();
    if (running && !paused){
      update(dt);
    }
    drawEntities();
    drawFrog();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Initial state
  updateHud();
  resetLevel();
  running = false;
  paused = false;
})();