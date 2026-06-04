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

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const videoElement = document.getElementById("video");

let gameRunning = false;
let waitingForStartMove = false; 

/* ================= PLAYER & STALKER ================= */
let player = { x: 400, y: 250, size: 34, color: "#00ffff" };
let playerTarget = { x: 400, y: 250 }; 
// Raw target from MediaPipe (updated on each frame)
let playerTargetRaw = { x: 400, y: 250 };
// Smoothed / filtered target used to drive the player
let playerTargetFiltered = { x: 400, y: 250 };
let lastFrameTime = performance.now();

// Smoothing parameters (tweakable)
let TARGET_SMOOTHING_ALPHA = 0.22; // 0 = no movement, 1 = follow raw exactly
let PREDICTION_FACTOR = 0.02; // small prediction to reduce latency
const MIN_LERP = 0.08; // base lerp for small corrections
let MAX_LERP = 0.45; // snap faster for large distances
let JITTER_THRESHOLD = 0.6; // pixels under which we snap to avoid micro-jitter

let stalker = { x: 50, y: 50, size: 56, speed: 1.2 };

let coins = [];
let collectedCoins = 0;
let coinsNeeded = 5;

let level = 1;
const maxLevels = 5;

let hearts = 3;
let isInvincible = false; 
let selectedSkinPath = localStorage.getItem("playerSkinPath") || "";
let isWallStunned = false;
let wallStunTimeoutId = null;

let sfxContext = null;

const playerSkinImage = new Image();
let shouldUsePlayerSkin = false;
let skinLoadPromise = Promise.resolve();

function getSkinCandidates(path) {
    if (!path) return [];

    const lowerPath = path.toLowerCase();
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return [path];

    const base = path.slice(0, lastDot);
    if (lowerPath.endsWith(".af")) {
        return [`${base}.png`, `${base}.webp`, `${base}.jpg`, `${base}.jpeg`, path];
    }

    return [path];
}

function loadSelectedSkin() {
    selectedSkinPath = localStorage.getItem("playerSkinPath") || "";
    shouldUsePlayerSkin = false;

    if (!selectedSkinPath) {
        skinLoadPromise = Promise.resolve();
        return skinLoadPromise;
    }

    const candidates = getSkinCandidates(selectedSkinPath);

    skinLoadPromise = new Promise((resolve) => {
        const tryLoad = (index) => {
            if (index >= candidates.length) {
                shouldUsePlayerSkin = false;
                selectedSkinPath = "";
                localStorage.removeItem("playerSkinPath");
                resolve();
                return;
            }

            const candidatePath = candidates[index];
            playerSkinImage.onload = () => {
                shouldUsePlayerSkin = true;
                selectedSkinPath = candidatePath;
                localStorage.setItem("playerSkinPath", candidatePath);
                resolve();
            };
            playerSkinImage.onerror = () => {
                shouldUsePlayerSkin = false;
                tryLoad(index + 1);
            };
            playerSkinImage.src = candidatePath;
        };

        tryLoad(0);
    });

    return skinLoadPromise;
}

function canDrawPlayerSkin() {
    return (
        shouldUsePlayerSkin &&
        playerSkinImage.complete &&
        playerSkinImage.naturalWidth > 0 &&
        playerSkinImage.naturalHeight > 0
    );
}

function drawSelectedSkinFallback(x, y, size, blinkFrame) {
    const fallbackName = (selectedSkinPath.split("/").pop() || "SKIN").split(".")[0] || "SKIN";
    const initials = fallbackName.slice(0, 2).toUpperCase();

    ctx.fillStyle = blinkFrame ? "rgba(255, 255, 255, 0.25)" : "#26d8d8";
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = "#0a1320";
    ctx.font = "bold 11px Orbitron";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, x + size / 2, y + size / 2);
}

loadSelectedSkin();

const enemyImage = new Image();
enemyImage.src = "skins/Enemy.webp";

const backgroundMusic = new Audio("music/usefulpix-synthwave-retrowave-background-music-for-videos-345553.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.35;

const coinCollectSound = new Audio("music/chieuk-coin-257878.mp3");
coinCollectSound.preload = "auto";
coinCollectSound.volume = 0.45;

function ensureSfxContext() {
    if (!sfxContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        sfxContext = new AudioContextClass();
    }

    if (sfxContext.state === "suspended") {
        sfxContext.resume().catch(() => {
        });
    }

    return sfxContext;
}

function playTone({ frequency, duration, type = "sine", volume = 0.05, startTime }) {
    const context = ensureSfxContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function playCoinSfx() {
    const coinInstance = coinCollectSound.cloneNode();
    coinInstance.volume = coinCollectSound.volume;

    coinInstance.play().catch(() => {
        const context = ensureSfxContext();
        if (!context) return;

        const now = context.currentTime;
        playTone({ frequency: 880, duration: 0.09, type: "triangle", volume: 0.06, startTime: now });
        playTone({ frequency: 1320, duration: 0.11, type: "triangle", volume: 0.05, startTime: now + 0.07 });
    });
}

function playHeartLossSfx() {
    const context = ensureSfxContext();
    if (!context) return;

    const now = context.currentTime;
    playTone({ frequency: 330, duration: 0.14, type: "sawtooth", volume: 0.07, startTime: now });
    playTone({ frequency: 220, duration: 0.18, type: "sawtooth", volume: 0.06, startTime: now + 0.1 });
}

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
        }
    } else {
        backgroundMusic.pause();
    }
    updateMusicButton();
}

function toggleHowToPlay() {
    const shouldShow = howToPlayPanel.style.display === "none";
    howToPlayPanel.style.display = shouldShow ? "block" : "none";
    howToPlayBtn.setAttribute("aria-expanded", shouldShow ? "true" : "false");
}

/* ================= MAIN MENU & START LOGIC ================= */
function initializeGame() {
    ensureSfxContext();

    if (!gameRunning && mainMenu.style.display !== "none") {
        mainMenu.style.display = "none";
        gameContainer.style.display = "block";

        loadSelectedSkin().then(() => {
            startLevel();
            gameRunning = false;
            waitingForStartMove = true;
            statusText.innerText = "READY";
        });
    }
}

playBtn.addEventListener("click", initializeGame);
howToPlayBtn.addEventListener("click", toggleHowToPlay);

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
        // store raw (normalized -> canvas) target; smoothing happens in draw loop
        playerTargetRaw.x = (1 - indexFinger.x) * canvas.width;
        playerTargetRaw.y = indexFinger.y * canvas.height;

        if (waitingForStartMove) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            // use raw target for start detection (more responsive)
            const dist = Math.hypot(playerTargetRaw.x - centerX, playerTargetRaw.y - centerY);
            
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
    stalker.size = 56 + level * 5;
    stalker.speed = 1 + level * 0.5;

    isInvincible = false;
    isWallStunned = false;
    if (wallStunTimeoutId) {
        clearTimeout(wallStunTimeoutId);
        wallStunTimeoutId = null;
    }
    levelNumberEl.innerText = level;
    coinCountEl.innerText = collectedCoins;

    spawnCoins();
}

function restartGame() {
    level = 1;
    hearts = 3;
    updateHearts();
    loadSelectedSkin();
    startLevel();
    gameRunning = false;
    waitingForStartMove = true; 
    statusText.innerText = "READY";
}

function applyWallStun() {
    if (!gameRunning || waitingForStartMove || isWallStunned) return;
    isWallStunned = true;
    statusText.innerText = "STUNNED";

    // brief visual feedback: desaturate player while stunned
    const prevColor = player.color;
    player.color = "#999999";

    if (wallStunTimeoutId) clearTimeout(wallStunTimeoutId);
    // stun duration: 0.5 seconds
    wallStunTimeoutId = setTimeout(() => {
        isWallStunned = false;
        wallStunTimeoutId = null;
        player.color = prevColor;

        if (gameRunning && !waitingForStartMove) {
            statusText.innerText = "RUNNING";
        }
    }, 500);

    // small stun sound to cue the player
    const sctx = ensureSfxContext();
    if (sctx) {
        const now = sctx.currentTime;
        playTone({ frequency: 220, duration: 0.12, type: "sine", volume: 0.06, startTime: now });
    }
}

function spawnCoins() {
    coins = [];
    for (let i = 0; i < coinsNeeded; i++) {
        coins.push({
            x: 15 + Math.random() * (canvas.width - 30),
            y: 15 + Math.random() * (canvas.height - 30),
            size: 20
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
        playHeartLossSfx();
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
            playCoinSfx();
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
            statusText.innerText = "LEVEL UP";
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

    if (!isWallStunned) {
        const now = performance.now();
        const dt = Math.min(40, now - lastFrameTime) / 1000; // seconds, capped
        lastFrameTime = now;

        // 1) Smooth the raw target with a simple low-pass filter (exponential)
        const alpha = TARGET_SMOOTHING_ALPHA; // static alpha works well for webcam
        playerTargetFiltered.x += (playerTargetRaw.x - playerTargetFiltered.x) * alpha;
        playerTargetFiltered.y += (playerTargetRaw.y - playerTargetFiltered.y) * alpha;

        // 2) Estimate a tiny velocity and predict forward a bit to reduce perceived latency
        const velX = (playerTargetFiltered.x - player.x) / Math.max(dt, 0.001);
        const velY = (playerTargetFiltered.y - player.y) / Math.max(dt, 0.001);
        const predictedX = playerTargetFiltered.x + velX * PREDICTION_FACTOR;
        const predictedY = playerTargetFiltered.y + velY * PREDICTION_FACTOR;

        // 3) Adaptive lerp factor: small corrections are smoothed, large moves snap faster
        const dist = Math.hypot(predictedX - player.x, predictedY - player.y);
        let lerpFactor = MIN_LERP + (dist / Math.max(canvas.width, canvas.height));
        lerpFactor = Math.min(MAX_LERP, Math.max(MIN_LERP, lerpFactor));

        // 4) Apply lerp towards the predicted smoothed target
        const nextX = player.x + (predictedX - player.x) * lerpFactor;
        const nextY = player.y + (predictedY - player.y) * lerpFactor;

        // 5) If movement is microscopic, snap to avoid jitter
        const microDist = Math.hypot(predictedX - player.x, predictedY - player.y);
        const finalX = microDist < JITTER_THRESHOLD ? predictedX : nextX;
        const finalY = microDist < JITTER_THRESHOLD ? predictedY : nextY;
        const maxX = canvas.width - player.size;
        const maxY = canvas.height - player.size;
        const touchedWall = nextX <= 0 || nextX >= maxX || nextY <= 0 || nextY >= maxY;

        if (touchedWall) {
            applyWallStun();
        }

        player.x = Math.max(0, Math.min(maxX, finalX));
        player.y = Math.max(0, Math.min(maxY, finalY));
    }

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

    const blinkFrame = isInvincible && Math.floor(Date.now() / 100) % 2 === 0;
    if (canDrawPlayerSkin()) {
        if (!blinkFrame) {
            ctx.drawImage(playerSkinImage, player.x, player.y, player.size, player.size);
        }
    } else if (selectedSkinPath) {
        drawSelectedSkinFallback(player.x, player.y, player.size, blinkFrame);
    } else {
        ctx.fillStyle = blinkFrame ? "rgba(255, 255, 255, 0.2)" : player.color;
        ctx.fillRect(player.x, player.y, player.size, player.size);
    }

    if (enemyImage.complete) {
        ctx.drawImage(enemyImage, stalker.x, stalker.y, stalker.size, stalker.size);
    } else {
        ctx.fillStyle = "#ff3366";
        ctx.fillRect(stalker.x, stalker.y, stalker.size, stalker.size);
    }

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

// Back to main menu button
const backToMenuBtn = document.getElementById('backToMenuBtn');
if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
        // stop game loop actions and show main menu
        gameRunning = false;
        waitingForStartMove = true;
        statusText.innerText = 'READY';

        gameContainer.style.display = 'none';
        mainMenu.style.display = 'flex';
    });
}