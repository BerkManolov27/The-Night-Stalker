const skinGrid = document.getElementById("skinGrid");
const skinEmpty = document.getElementById("skinEmpty");
const defaultSkinBtn = document.getElementById("defaultSkinBtn");

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".af"];
const ENEMY_NAME_FRAGMENT = "enemy";

function isSkinImageFile(fileName) {
    const lowerName = fileName.toLowerCase();
    const isImage = IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    const isEnemyFile = lowerName.includes(ENEMY_NAME_FRAGMENT);
    return isImage && !isEnemyFile;
}

function getSelectedSkinPath() {
    return localStorage.getItem("playerSkinPath") || "";
}

function selectSkin(skinPath) {
    localStorage.setItem("playerSkinPath", skinPath);
    markSelectedCard();
}

function useDefaultSkin() {
    localStorage.removeItem("playerSkinPath");
    markSelectedCard();
}

function markSelectedCard() {
    const selectedPath = getSelectedSkinPath();
    const cards = skinGrid.querySelectorAll(".skin-page-item");

    cards.forEach(card => {
        card.classList.toggle("selected", card.dataset.skinPath === selectedPath);
    });
}

function createSkinCard(fileName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "skin-page-item";
    button.dataset.skinPath = `skins/${fileName}`;

    const image = document.createElement("img");
    image.src = `skins/${fileName}`;
    image.alt = fileName;
    image.addEventListener("error", () => {
        image.style.display = "none";
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = fileName.replace(/\.[^/.]+$/, "");

    button.appendChild(image);
    button.appendChild(name);

    button.addEventListener("click", () => {
        selectSkin(button.dataset.skinPath);
    });

    return button;
}

function parseDirectoryListing(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const links = [...doc.querySelectorAll("a")];

    const fileNames = links
        .map(link => link.getAttribute("href") || "")
        .map(href => href.split("/").pop() || "")
        .map(name => decodeURIComponent(name))
        .filter(Boolean)
        .filter(name => !name.includes(".."))
        .filter(isSkinImageFile);

    return [...new Set(fileNames)].sort((a, b) => a.localeCompare(b));
}

async function loadSkinsFromFolder() {
    try {
        const response = await fetch("skins/");
        if (!response.ok) throw new Error("Failed to read skins directory");

        const htmlText = await response.text();
        return parseDirectoryListing(htmlText);
    } catch (error) {
        return [];
    }
}

function renderSkins(fileNames) {
    skinGrid.innerHTML = "";

    if (!fileNames.length) {
        skinEmpty.style.display = "block";
        return;
    }

    skinEmpty.style.display = "none";
    fileNames.forEach(fileName => {
        skinGrid.appendChild(createSkinCard(fileName));
    });

    markSelectedCard();
}

async function initSkinPage() {
    defaultSkinBtn.addEventListener("click", useDefaultSkin);

    const skins = await loadSkinsFromFolder();
    renderSkins(skins);
}

initSkinPage();