const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const aiLevelEl = document.getElementById('ai-level');
const habitEl = document.getElementById('player-habit');
const censorCheckbox = document.getElementById('censor');
const statusEl = document.getElementById('game-status');
const survivalTimeEl = document.getElementById('survival-time');
const bestTimeEl = document.getElementById('best-time');

// Настройки на играта
const playerStart = { x: 50, y: 50 };
const stalkerStart = { x: 500, y: 300 };

let player = { x: playerStart.x, y: playerStart.y, size: 20, speed: 4, color: '#3498db' };
let stalker = { x: stalkerStart.x, y: stalkerStart.y, size: 25, speed: 1, color: '#e74c3c' };
let keys = {};
let gameState = 'waiting';
let gameStartedAt = 0;
let surviveTime = 0;
let bestTime = 0;
let lastTime = 0;
let pulse = 0;

// AI Данни: Броим времето прекарано в 4-те края на екрана
let memory = { 
    top_left: 0, 
    top_right: 0, 
    bottom_left: 0, 
    bottom_right: 0 
};

function isMovementKey(code) {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);
}

window.addEventListener('keydown', e => {
    if (isMovementKey(e.code)) {
        keys[e.code] = true;
        if (gameState === 'waiting') startGame();
    }

    if (e.code === 'KeyP' && gameState !== 'waiting') {
        gameState = gameState === 'paused' ? 'running' : 'paused';
        statusEl.innerText = gameState === 'paused' ? 'ПАУЗА' : 'БЯГАЙ!';
    }

    if (e.code === 'KeyR') {
        resetRound(true);
        gameState = 'running';
        gameStartedAt = performance.now();
        statusEl.innerText = 'НОВ РУНД';
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;
});

function startGame() {
    gameState = 'running';
    gameStartedAt = performance.now();
    statusEl.innerText = 'БЯГАЙ!';
}

function update() {
    if (gameState !== 'running') return;

    // 1. Движение на играча
    movePlayer();

    // 2. AI ОБУЧЕНИЕ (Reinforcement Learning Logic)
    trackHabits();

    // 3. ПОВЕДЕНИЕ НА ЛОВЕЦА
    moveStalker();

    // 4. ПРОВЕРКА ЗА ЗАГУБА
    checkCollision();
}

function movePlayer() {
    let moveX = 0;
    let moveY = 0;

    if (keys['ArrowUp'] || keys['KeyW']) moveY -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) moveY += 1;
    if (keys['ArrowLeft'] || keys['KeyA']) moveX -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
        const norm = Math.hypot(moveX, moveY);
        player.x += (moveX / norm) * player.speed;
        player.y += (moveY / norm) * player.speed;
    }

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
}

function trackHabits() {
    // В реално време AI разбира къде обичаш да ходиш
    if (player.x < 300 && player.y < 200) memory.top_left++;
    else if (player.x >= 300 && player.y < 200) memory.top_right++;
    else if (player.x < 300 && player.y >= 200) memory.bottom_left++;
    else memory.bottom_right++;

    // Намиране на най-използваната зона
    let favorite = Object.keys(memory).reduce((a, b) => memory[a] > memory[b] ? a : b);
    habitEl.innerText = favorite.replace('_', ' ').toUpperCase();
}

function getFavoriteZoneCenter() {
    const favorite = Object.keys(memory).reduce((a, b) => memory[a] > memory[b] ? a : b);
    const centers = {
        top_left: { x: 150, y: 100 },
        top_right: { x: 450, y: 100 },
        bottom_left: { x: 150, y: 300 },
        bottom_right: { x: 450, y: 300 }
    };
    return centers[favorite];
}

function moveStalker() {
    // Колкото повече "данни" има за теб, толкова по-бърз става той
    let totalExperience = Object.values(memory).reduce((a, b) => a + b, 0);
    stalker.speed = Math.min(5.5, 1 + (totalExperience / 1800));
    aiLevelEl.innerText = stalker.speed.toFixed(2);

    const favoriteZone = getFavoriteZoneCenter();
    const chaseWeight = Math.min(0.9, totalExperience / 2200);
    const targetX = player.x * (1 - chaseWeight) + favoriteZone.x * chaseWeight;
    const targetY = player.y * (1 - chaseWeight) + favoriteZone.y * chaseWeight;

    // Логика за преследване
    if (stalker.x < targetX) stalker.x += stalker.speed;
    else stalker.x -= stalker.speed;

    if (stalker.y < targetY) stalker.y += stalker.speed;
    else stalker.y -= stalker.speed;
}

function checkCollision() {
    if (gameState !== 'running') return;

    let hit = player.x < stalker.x + stalker.size &&
              player.x + player.size > stalker.x &&
              player.y < stalker.y + stalker.size &&
              player.y + player.size > stalker.y;

    if (hit) {
        gameState = 'gameover';
        statusEl.innerText = 'ХВАНАТ СИ! НАТИСНИ R';

        bestTime = Math.max(bestTime, surviveTime);
        bestTimeEl.innerText = `${bestTime.toFixed(1)}s`;

        if (censorCheckbox.checked) {
            canvas.classList.add('blood-blur');
        }

        setTimeout(() => {
            alert("Ловецът те настигна! Той вече познава стила ти на игра.");
            resetRound(false);
        }, 100);
    }
}

function resetRound(clearLearning) {
    player.x = playerStart.x;
    player.y = playerStart.y;
    stalker.x = stalkerStart.x;
    stalker.y = stalkerStart.y;

    surviveTime = 0;
    survivalTimeEl.innerText = '0.0s';

    if (clearLearning) {
        memory = {
            top_left: 0,
            top_right: 0,
            bottom_left: 0,
            bottom_right: 0
        };
        habitEl.innerText = 'Наблюдение...';
        aiLevelEl.innerText = '0.00';
    }

    canvas.classList.remove('blood-blur');
}

function updateTimer(now) {
    if (gameState === 'running') {
        surviveTime = (now - gameStartedAt) / 1000;
        survivalTimeEl.innerText = `${surviveTime.toFixed(1)}s`;
    }
}

function drawBackground() {
    pulse += 0.03;
    const vignette = 18 + Math.sin(pulse) * 6;
    ctx.fillStyle = '#060606';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = `rgba(255, 0, 0, ${0.06 + (vignette / 400)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
}

function draw(now = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    // Нарисувай играча
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Нарисувай Ловеца с малко сияние
    ctx.shadowBlur = 10;
    ctx.shadowColor = "red";
    ctx.fillStyle = stalker.color;
    ctx.fillRect(stalker.x, stalker.y, stalker.size, stalker.size);
    ctx.shadowBlur = 0;

    updateTimer(now);
    update();
    requestAnimationFrame(draw);
}

// Старт на играта
bestTimeEl.innerText = '0.0s';
survivalTimeEl.innerText = '0.0s';
draw();