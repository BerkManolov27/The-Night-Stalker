const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const aiLevelEl = document.getElementById('ai-level');
const habitEl = document.getElementById('player-habit');
const censorCheckbox = document.getElementById('censor');

// Настройки на играта
let player = { x: 50, y: 50, size: 20, speed: 4, color: '#3498db' };
let stalker = { x: 500, y: 300, size: 25, speed: 1, color: '#e74c3c' };
let keys = {};

// AI Данни: Броим времето прекарано в 4-те края на екрана
let memory = { 
    top_left: 0, 
    top_right: 0, 
    bottom_left: 0, 
    bottom_right: 0 
};

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

function update() {
    // 1. Движение на играча
    if (keys['ArrowUp'] && player.y > 0) player.y -= player.speed;
    if (keys['ArrowDown'] && player.y < canvas.height - player.size) player.y += player.speed;
    if (keys['ArrowLeft'] && player.x > 0) player.x -= player.speed;
    if (keys['ArrowRight'] && player.x < canvas.width - player.size) player.x += player.speed;

    // 2. AI ОБУЧЕНИЕ (Reinforcement Learning Logic)
    trackHabits();

    // 3. ПОВЕДЕНИЕ НА ЛОВЕЦА
    moveStalker();

    // 4. ПРОВЕРКА ЗА ЗАГУБА
    checkCollision();
}

function trackHabits() {
    // Разпознаване на зоната
    let zoneX = player.x < canvas.width / 2 ? 'top' : 'bottom'; // опростено
    let zoneY = player.y < canvas.height / 2 ? 'left' : 'right';
    
    // В реално време AI разбира къде обичаш да ходиш
    if (player.x < 300 && player.y < 200) memory.top_left++;
    else if (player.x >= 300 && player.y < 200) memory.top_right++;
    else if (player.x < 300 && player.y >= 200) memory.bottom_left++;
    else memory.bottom_right++;

    // Намиране на най-използваната зона
    let favorite = Object.keys(memory).reduce((a, b) => memory[a] > memory[b] ? a : b);
    habitEl.innerText = favorite.replace('_', ' ').toUpperCase();
}

function moveStalker() {
    // Колкото повече "данни" има за теб, толкова по-бърз става той
    let totalExperience = Object.values(memory).reduce((a, b) => a + b, 0);
    stalker.speed = 1 + (totalExperience / 2000); 
    aiLevelEl.innerText = stalker.speed.toFixed(2);

    // Логика за преследване
    if (stalker.x < player.x) stalker.x += stalker.speed;
    else stalker.x -= stalker.speed;

    if (stalker.y < player.y) stalker.y += stalker.speed;
    else stalker.y -= stalker.speed;
}

function checkCollision() {
    let hit = player.x < stalker.x + stalker.size &&
              player.x + player.size > stalker.x &&
              player.y < stalker.y + stalker.size &&
              player.y + player.size > stalker.y;

    if (hit) {
        if (censorCheckbox.checked) {
            canvas.classList.add('blood-blur');
        }
        setTimeout(() => {
            alert("Ловецът те настигна! Той вече познава стила ти на игра.");
            reset();
        }, 100);
    }
}

function reset() {
    player.x = 50; player.y = 50;
    stalker.x = 500; stalker.y = 300;
    canvas.classList.remove('blood-blur');
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Нарисувай играча
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Нарисувай Ловеца с малко сияние
    ctx.shadowBlur = 10;
    ctx.shadowColor = "red";
    ctx.fillStyle = stalker.color;
    ctx.fillRect(stalker.x, stalker.y, stalker.size, stalker.size);
    ctx.shadowBlur = 0;

    update();
    requestAnimationFrame(draw);
}

// Старт на играта
draw();