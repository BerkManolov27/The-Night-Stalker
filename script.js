const mainMenu = document.getElementById("mainMenu");
const playBtn = document.getElementById("playBtn");
const gameContainer = document.getElementById("gameContainer");
const statusText = document.getElementById("statusText");
const playerColorPicker = document.getElementById("playerColorPicker");
const coinCountEl = document.getElementById("coinCount");
const levelNumberEl = document.getElementById("levelNumber");
const heartsContainer = document.getElementById("heartsContainer");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const videoElement = document.getElementById("video");

let gameRunning = false;

/* ================= PLAYER & STALKER ================= */
let player = { x: 400, y: 250, size: 15, color: "#00ffff" };
let playerTarget = { x: 400, y: 250 }; // Matches the 800x500 canvas center

let stalker = { x: 50, y: 50, size: 25, speed: 1.2 };

let coins = [];
let collectedCoins = 0;
let coinsNeeded = 5;

let level = 1;
const maxLevels = 5;

let hearts = 3;
let isInvincible = false; // Invincibility logic

/* ================= MAIN MENU ================= */
playBtn.addEventListener("click", () => {
    player.color = playerColorPicker.value;
    mainMenu.style.display = "none";
    gameContainer.style.display = "block";
    startLevel();
    gameRunning = true;
});

/* ================= MEDIA PIPE HANDS ================= */
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults(results => {
    if (!gameRunning) return;

    if (results.multiHandLandmarks.length > 0) {
        const indexFinger = results.multiHandLandmarks[0][8];
        // Mirror fix relative to canvas size
        playerTarget.x = (1 - indexFinger.x) * canvas.width;
        playerTarget.y = indexFinger.y * canvas.height;
    }
});

const camera = new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 480,
    height: 360
});
camera.start();

/* ================= KEY CONTROLS ================= */
window.addEventListener("keydown", e => {
    if (e.code === "KeyF") {
        gameRunning = !gameRunning;
        statusText.innerText = gameRunning ? "RUNNING" : "PAUSED";
        statusText.className = "value " + (gameRunning ? "running" : "paused");
    }
    if (e.code === "KeyR") restartGame();
});

/* ================= LEVEL / GAME LOGIC ================= */
function startLevel() {
    collectedCoins = 0;
    coinsNeeded = 4 + level;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    playerTarget.x = player.x;
    playerTarget.y = player.y;

    stalker.x = 50; 
    stalker.y = 50; 
    stalker.size = 25 + level * 5; 
    stalker.speed = 1 + level * 0.5;

    isInvincible = false;
    player.color = playerColorPicker.value; // Reset color in case it was flashing white

    levelNumberEl.innerText = level;
    coinCountEl.innerText = collectedCoins;

    statusText.innerText = "RUNNING";
    statusText.className = "value running";

    spawnCoins();
}

function restartGame() {
    level = 1;
    hearts = 3;
    updateHearts();
    startLevel();
    gameRunning = true;
}

function spawnCoins() {
    coins = [];
    for (let i = 0; i < coinsNeeded; i++) {
        coins.push({
            x: 15 + Math.random() * (canvas.width - 30),
            y: 15 + Math.random() * (canvas.height - 30),
            size: 15
        });
    }
}

/* ================= STALKER ================= */
function moveStalker() {
    if (!gameRunning) return;

    let dx = player.x - stalker.x;
    let dy = player.y - stalker.y;
    let distance = Math.hypot(dx, dy);

    if (distance > 0) {
        stalker.x += (dx / distance) * stalker.speed;
        stalker.y += (dy / distance) * stalker.speed;
    }
}

/* ================= COLLISIONS ================= */
function checkCollision() {
    if (!gameRunning || isInvincible) return;

    let hit = player.x < stalker.x + stalker.size &&
              player.x + player.size > stalker.x &&
              player.y < stalker.y + stalker.size &&
              player.y + player.size > stalker.y;

    if (hit) {
        hearts--;
        updateHearts();

        if (hearts <= 0) {
            gameRunning = false;
            statusText.innerText = "GAME OVER";
            statusText.className = "value paused";
        } else {
            // Trigger invincibility frames
            isInvincible = true;
            let originalColor = player.color;
            player.color = "#ffffff";

            setTimeout(() => {
                isInvincible = false;
                // Only restore color if we haven't restarted the game
                if (player.color === "#ffffff") player.color = originalColor;
            }, 1500);
        }
    }
}

/* ================= COINS ================= */
function checkCoins() {
    if (!gameRunning) return;

    coins = coins.filter(c => {
        let hit = player.x < c.x + c.size &&
                  player.x + player.size > c.x &&
                  player.y < c.y + c.size &&
                  player.y + player.size > c.y;

        if (hit) {
            collectedCoins++;
            coinCountEl.innerText = collectedCoins;
            return false;
        }
        return true;
    });

    if (collectedCoins >= coinsNeeded) {
        level++;
        if (level > maxLevels) {
            statusText.innerText = "YOU WIN! (Press R)";
            statusText.className = "value running";
            gameRunning = false;
        } else {
            startLevel();
        }
    }
}

function updateHearts() {
    heartsContainer.innerHTML = "";
    for (let i = 0; i < hearts; i++) {
        heartsContainer.innerHTML += `<span class="heart">❤️</span>`;
    }
}

/* ================= DRAW LOOP ================= */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth player movement via pure Lerp
    const lerpFactor = 0.15; 

    player.x += (playerTarget.x - player.x) * lerpFactor;
    player.y += (playerTarget.y - player.y) * lerpFactor;

    // Boundaries check
    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    // Draw player
    ctx.fillStyle = player.color;
    // Rapid blink effect if invincible
    if (isInvincible && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.fillStyle = "transparent"; 
    }
    ctx.fillRect(player.x, player.y, player.size, player.size);

    // Draw stalker
    ctx.fillStyle = "#ff3366"; 
    ctx.fillRect(stalker.x, stalker.y, stalker.size, stalker.size);

    // Draw coins
    coins.forEach(c => {
        ctx.fillStyle = "#ffcc00"; 
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size / 2, 0, Math.PI*2);
        ctx.fill();
    });

    moveStalker();
    checkCollision();
    checkCoins();

    requestAnimationFrame(draw);
}

// Start drawing immediately
draw();
updateHearts(); // Ensure hearts are rendered initially