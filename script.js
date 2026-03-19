const mainMenu = document.getElementById("mainMenu");
const playBtn = document.getElementById("playBtn");
const gameContainer = document.getElementById("gameContainer");
const statusText = document.getElementById("statusText");
const coinCountEl = document.getElementById("coinCount");
const levelNumberEl = document.getElementById("levelNumber");
const heartsContainer = document.getElementById("heartsContainer");
const howToPlayBtn = document.getElementById("howToPlayBtn");
const howToPlayPanel = document.getElementById("howToPlayPanel");
const musicToggleBtn = document.getElementById("musicToggleBtn");
const skinOptions = document.querySelectorAll(".skin-option");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const videoElement = document.getElementById("video");

let gameRunning = false;
let waitingForStartMove = false; 

/* ================= PLAYER & STALKER ================= */
let player = { x: 400, y: 250, size: 28, color: "#00ffff" };
let playerTarget = { x: 400, y: 250 }; 

let stalker = { x: 50, y: 50, size: 40, speed: 1.2 };

let coins = [];
let collectedCoins = 0;
let coinsNeeded = 5;

let level = 1;
const maxLevels = 5;

let hearts = 3;
let isInvincible = false; 
let selectedSkin = "default";

const skinImages = {
    skin1: new Image()
};
skinImages.skin1.src = "skins/skin1.png";

const enemyImage = new Image();
enemyImage.src = "skins/Enemy.webp";

const backgroundMusic = new Audio("music/usefulpix-synthwave-retrowave-background-music-for-videos-345553.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.35;

function updateMusicButton() {
    const isPlaying = !backgroundMusic.paused;
    musicToggleBtn.innerText = isPlaying ? "MUSIC: ON" : "MUSIC: OFF";
    musicToggleBtn.classList.toggle("playing", isPlaying);
}

async function toggleMusic() {
    if (backgroundMusic.paused) {
        try {
            await backgroundMusic.play();
        } catch (error) {
            // Browsers may block autoplay until a user gesture.
        }
    } else {
        backgroundMusic.pause();
    }
    updateMusicButton();
}

function setSelectedSkin(skinName) {
    selectedSkin = skinName;
    skinOptions.forEach(option => {
        option.classList.toggle("selected", option.dataset.skin === skinName);
    });
}

function toggleHowToPlay() {
    const shouldShow = howToPlayPanel.style.display === "none";
    howToPlayPanel.style.display = shouldShow ? "block" : "none";
    howToPlayBtn.setAttribute("aria-expanded", shouldShow ? "true" : "false");
}

/* ================= MAIN MENU & START LOGIC ================= */
function initializeGame() {
    if (!gameRunning && mainMenu.style.display !== "none") {
        mainMenu.style.display = "none";
        gameContainer.style.display = "block";
        
        startLevel();
        gameRunning = false; 
        waitingForStartMove = true; 
        statusText.innerText = "READY"; // Cleaned status
    }
}

playBtn.addEventListener("click", initializeGame);
howToPlayBtn.addEventListener("click", toggleHowToPlay);
skinOptions.forEach(option => {
    option.addEventListener("click", () => {
        setSelectedSkin(option.dataset.skin);
    });
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
    if (results.multiHandLandmarks.length > 0) {
        const indexFinger = results.multiHandLandmarks[0][8];
        playerTarget.x = (1 - indexFinger.x) * canvas.width;
        playerTarget.y = indexFinger.y * canvas.height;

        if (waitingForStartMove) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dist = Math.hypot(playerTarget.x - centerX, playerTarget.y - centerY);
            
            if (dist < 40) { 
                waitingForStartMove = false;
                gameRunning = true;
                statusText.innerText = "RUNNING";
            }
        }
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
    if (e.code === "KeyS") {
        initializeGame();
    }
    
    if (e.code === "KeyF") {
        if (waitingForStartMove) {
            waitingForStartMove = false;
            gameRunning = true;
        } else {
            gameRunning = !gameRunning;
        }
        statusText.innerText = gameRunning ? "RUNNING" : "PAUSED";
    }
    
    if (e.code === "KeyR") {
        restartGame();
    }

    if (e.code === "KeyM") {
        toggleMusic();
    }
});

musicToggleBtn.addEventListener("click", toggleMusic);

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
    stalker.size = 38 + level * 4;
    stalker.speed = 1 + level * 0.5;

    isInvincible = false;
    levelNumberEl.innerText = level;
    coinCountEl.innerText = collectedCoins;

    spawnCoins();
}

function restartGame() {
    level = 1;
    hearts = 3;
    updateHearts();
    startLevel();
    gameRunning = false;
    waitingForStartMove = true; 
    statusText.innerText = "READY"; // Instruction removed from status
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
        } else {
            isInvincible = true;
            let originalColor = player.color;
            player.color = "#ffffff";

            setTimeout(() => {
                isInvincible = false;
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
            statusText.innerText = "YOU WIN!";
            gameRunning = false;
        } else {
            startLevel();
            gameRunning = false;
            waitingForStartMove = true;
            statusText.innerText = "LEVEL UP"; // Clean status
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

    const lerpFactor = 0.15; 
    player.x += (playerTarget.x - player.x) * lerpFactor;
    player.y += (playerTarget.y - player.y) * lerpFactor;

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    // CIRCLE DRAWING (Kept on Canvas)
    if (waitingForStartMove) {
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = "white";
        ctx.font = "bold 18px Orbitron";
        ctx.textAlign = "center";
        ctx.fillText("PLACE FINGER HERE TO START", canvas.width / 2, canvas.height / 2 + 80);
    }

    // DRAW PLAYER
    const blinkFrame = isInvincible && Math.floor(Date.now() / 100) % 2 === 0;
    const activeSkinImage = skinImages[selectedSkin];

    if (selectedSkin !== "default" && activeSkinImage?.complete) {
        if (!blinkFrame) {
            ctx.drawImage(activeSkinImage, player.x, player.y, player.size, player.size);
        }
    } else {
        ctx.fillStyle = blinkFrame ? "rgba(255, 255, 255, 0.2)" : player.color;
        ctx.fillRect(player.x, player.y, player.size, player.size);
    }

    // DRAW STALKER
    if (enemyImage.complete) {
        ctx.drawImage(enemyImage, stalker.x, stalker.y, stalker.size, stalker.size);
    } else {
        ctx.fillStyle = "#ff3366";
        ctx.fillRect(stalker.x, stalker.y, stalker.size, stalker.size);
    }

    // DRAW COINS
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

draw();
updateHearts();
updateMusicButton();