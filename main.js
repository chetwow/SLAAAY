// main.js

const socket = new WebSocket('ws://localhost:8080');
const MAX_BLOB_RADIUS = 100;
const MOVE_SPEED = 0.5;
const PELLET_COUNT = 20;
const PELLET_RESPAWN_TIME = 5000; // 5 seconds
const PELLET_GROWTH_AMOUNT = 3;
const ANIMATION_DURATION = 200; // milliseconds
const FRICTION = 0.98; // Friction factor to gradually slow down blobs
const COLLISION_GROWTH_FACTOR = 0.1; // 10% growth on collision

socket.addEventListener('open', () => {
    console.log('Connected to the WebSocket server');
});

socket.addEventListener('message', (event) => {
    const chatData = JSON.parse(event.data);
    console.log(`${chatData.username}: ${chatData.message}`);

    const message = chatData.message.trim().toLowerCase();
    if (message.startsWith('!join')) {
        const factionName = message.split(' ')[1];
        if (factionName) {
            joinFaction(factionName, chatData.username);
        }
    } else if (['!up', '!down', '!left', '!right'].includes(message)) {
        moveBlob(chatData.username, message.substring(1));
    }

    const chatDiv = document.getElementById('chat');
    const messageElement = document.createElement('p');
    messageElement.textContent = `${chatData.username}: ${chatData.message}`;
    chatDiv.appendChild(messageElement);
    chatDiv.scrollTop = chatDiv.scrollHeight;
});

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth - 100,
    height: window.innerHeight - 250,
    backgroundColor: '#2C2F33',
    parent: 'game-container',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    }
};

let game = new Phaser.Game(config);
let gameScene;

let factions = {};
let factionRequests = {};
let pellets = [];

function preload() {
    // No preload needed for now
}

function create() {
    gameScene = this;
    spawnPellets();
}

function update() {
    applyFriction();
    checkBlobCollisions();
    checkPelletCollisions();
    keepBlobsInBounds();
}

function spawnPellets() {
    for (let i = 0; i < PELLET_COUNT; i++) {
        spawnPellet();
    }
}

function spawnPellet() {
    let x = Phaser.Math.Between(10, config.width - 10);
    let y = Phaser.Math.Between(10, config.height - 10);
    let pellet = gameScene.add.circle(x, y, 5, 0xFF69B4);
    pellets.push(pellet);
}

function joinFaction(factionName, username) {
    factionName = sanitizeFactionName(factionName);

    if (!factionRequests[factionName]) {
        factionRequests[factionName] = new Set();
    }

    factionRequests[factionName].add(username);
    console.log(`${username} requested to join the ${factionName} faction.`);

    if (factionRequests[factionName].size >= 3 && !factions[factionName]) {
        createFaction(factionName);
    } else if (factions[factionName]) {
        addMemberToFaction(factionName, username);
    }
}

function sanitizeFactionName(name) {
    return name.replace(/[^a-z0-9]/gi, '').substr(0, 15);
}

function createFaction(factionName) {
    if (!gameScene) {
        console.error("Game scene is not ready yet.");
        return;
    }

    let color = Phaser.Display.Color.RandomRGB();
    let x = Phaser.Math.Between(100, config.width - 100);
    let y = Phaser.Math.Between(100, config.height - 100);

    let newBlob = gameScene.add.circle(x, y, 50, color.color);
    newBlob.setInteractive();
    newBlob.radius = 50;

    let nameText = gameScene.add.text(x, y, factionName, {
        font: '16px Arial',
        fill: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);

    factions[factionName] = {
        color: color.color,
        blob: newBlob,
        members: Array.from(factionRequests[factionName]),
        nameText: nameText,
        velocityX: 0,
        velocityY: 0
    };

    updateFactionStats();
    console.log(`Faction ${factionName} has been created!`);
}

function addMemberToFaction(factionName, username) {
    let faction = factions[factionName];
    if (!faction.members.includes(username)) {
        faction.members.push(username);
        console.log(`${username} joined the ${factionName} faction!`);
    } else {
        console.log(`${username} is already a member of the ${factionName} faction.`);
    }
}

function growFactionBlob(faction, amount) {
    let blob = faction.blob;
    let currentRadius = blob.radius;
    let growthFactor = Math.log(currentRadius + amount) - Math.log(currentRadius);
    let newRadius = Math.min(currentRadius * Math.exp(growthFactor), MAX_BLOB_RADIUS);
    
    gameScene.tweens.add({
        targets: blob,
        radius: newRadius,
        scale: newRadius / 50,
        duration: ANIMATION_DURATION,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
            updateFactionText(faction);
        },
        onComplete: () => {
            updateFactionStats();
        }
    });
}

function updateFactionText(faction) {
    let blob = faction.blob;
    faction.nameText.setPosition(blob.x, blob.y);
    faction.nameText.setScale(blob.scale);
}

function updateFactionStats() {
    const factionStatsDiv = document.getElementById('faction-stats');
    let tableHTML = `
    <table>
        <thead>
            <tr>
                <th>Faction Name</th>
                <th>Members</th>
                <th>Blob Radius</th>
            </tr>
        </thead>
        <tbody>
    `;

    for (let key in factions) {
        let faction = factions[key];
        tableHTML += `
            <tr>
                <td>${key}</td>
                <td>${faction.members.length}</td>
                <td>${faction.blob.radius.toFixed(2)}</td>
            </tr>
        `;
    }

    tableHTML += `
        </tbody>
    </table>
    `;

    factionStatsDiv.innerHTML = tableHTML;
}

function moveBlob(username, direction) {
    for (let key in factions) {
        let faction = factions[key];
        if (faction.members.includes(username)) {
            switch (direction) {
                case 'up':
                    faction.velocityY -= MOVE_SPEED;
                    break;
                case 'down':
                    faction.velocityY += MOVE_SPEED;
                    break;
                case 'left':
                    faction.velocityX -= MOVE_SPEED;
                    break;
                case 'right':
                    faction.velocityX += MOVE_SPEED;
                    break;
            }
            console.log(`${username} moved the ${key} blob ${direction}!`);
            break;
        }
    }
}

function applyFriction() {
    for (let key in factions) {
        let faction = factions[key];
        faction.velocityX *= FRICTION;
        faction.velocityY *= FRICTION;
        faction.blob.x += faction.velocityX;
        faction.blob.y += faction.velocityY;
        updateFactionText(faction);
    }
}

function keepBlobsInBounds() {
    for (let key in factions) {
        let faction = factions[key];
        let blob = faction.blob;
        let radius = blob.radius;

        if (blob.x < radius) {
            blob.x = radius;
            faction.velocityX = Math.abs(faction.velocityX);
        } else if (blob.x > config.width - radius) {
            blob.x = config.width - radius;
            faction.velocityX = -Math.abs(faction.velocityX);
        }

        if (blob.y < radius) {
            blob.y = radius;
            faction.velocityY = Math.abs(faction.velocityY);
        } else if (blob.y > config.height - radius) {
            blob.y = config.height - radius;
            faction.velocityY = -Math.abs(faction.velocityY);
        }

        updateFactionText(faction);
    }
}

function checkBlobCollisions() {
    const factionNames = Object.keys(factions);
    const factionsToDestroy = new Set();

    for (let i = 0; i < factionNames.length; i++) {
        const faction1 = factions[factionNames[i]];
        
        if (!faction1 || !faction1.blob) continue;

        for (let j = i + 1; j < factionNames.length; j++) {
            const faction2 = factions[factionNames[j]];
            
            if (!faction2 || !faction2.blob) continue;
            
            const distance = Phaser.Math.Distance.Between(
                faction1.blob.x, faction1.blob.y,
                faction2.blob.x, faction2.blob.y
            );
            
            if (distance < faction1.blob.radius + faction2.blob.radius) {
                if (faction1.blob.radius > faction2.blob.radius) {
                    factionsToDestroy.add(factionNames[j]);
                    growFactionBlob(faction1, faction1.blob.radius * COLLISION_GROWTH_FACTOR);
                } else if (faction2.blob.radius > faction1.blob.radius) {
                    factionsToDestroy.add(factionNames[i]);
                    growFactionBlob(faction2, faction2.blob.radius * COLLISION_GROWTH_FACTOR);
                }
            }
        }
    }

    factionsToDestroy.forEach(factionName => {
        destroyFaction(factionName);
    });
}

function checkPelletCollisions() {
    for (let key in factions) {
        let faction = factions[key];
        let blob = faction.blob;

        for (let i = pellets.length - 1; i >= 0; i--) {
            let pellet = pellets[i];
            let distance = Phaser.Math.Distance.Between(blob.x, blob.y, pellet.x, pellet.y);

            if (distance < blob.radius) {
                pellet.destroy();
                pellets.splice(i, 1);
                growFactionBlob(faction, PELLET_GROWTH_AMOUNT);
                console.log(`${key} faction consumed a pellet!`);

                setTimeout(spawnPellet, PELLET_RESPAWN_TIME);
            }
        }
    }
}

function destroyFaction(factionName) {
    const faction = factions[factionName];
    if (faction) {
        if (faction.blob) faction.blob.destroy();
        if (faction.nameText) faction.nameText.destroy();
        delete factions[factionName];
        console.log(`Faction ${factionName} has been destroyed!`);
        updateFactionStats();
    }
}