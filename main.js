// main.js

// Constants
const GAME_CONSTANTS = {
    MAX_BLOB_RADIUS: 100,
    BASE_MOVE_SPEED: 1,
    PELLET_COUNT: 20,
    PELLET_RESPAWN_TIME: 5000,
    PELLET_GROWTH_AMOUNT: 3,
    ANIMATION_DURATION: 200,
    FRICTION: 0.98,
    COLLISION_GROWTH_FACTOR: 0.1,
    HAZARDOUS_PELLET_COUNT: 5,
    HAZARD_SHRINK_AMOUNT: 5,
    HAZARD_RESPAWN_TIME: 10000, // 10 seconds
};

// Game state
const GAME_STATE = {
    factions: {},
    factionRequests: {},
    pellets: [],
    userFactions: {},
    gameScene: null
};

// WebSocket handling
const WebSocketHandler = {
    socket: null,
    init: function() {
        this.socket = new WebSocket('ws://localhost:8080');
        this.socket.addEventListener('open', this.onOpen);
        this.socket.addEventListener('message', this.onMessage);
    },
    onOpen: function() {
        console.log('Connected to the WebSocket server');
    },
    onMessage: function(event) {
        const chatData = JSON.parse(event.data);
        console.log(`${chatData.username}: ${chatData.message}`);
        ChatHandler.processMessage(chatData);
    }
};

// Chat handling
const ChatHandler = {
    processMessage: function(chatData) {
        const message = chatData.message.trim().toLowerCase();
        if (message.startsWith('!join')) {
            const factionName = message.split(' ')[1];
            if (factionName) {
                FactionManager.joinFaction(factionName, chatData.username);
            }
        } else if (['!up', '!down', '!left', '!right'].includes(message)) {
            BlobManager.moveBlob(chatData.username, message.substring(1));
        }
        this.updateChatDisplay(chatData);
    },
    updateChatDisplay: function(chatData) {
        const chatDiv = document.getElementById('chat');
        const messageElement = document.createElement('p');
        messageElement.textContent = `${chatData.username}: ${chatData.message}`;
        chatDiv.appendChild(messageElement);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
};

// Faction management
const FactionManager = {
    joinFaction: function(factionName, username) {
        factionName = this.sanitizeFactionName(factionName);

        if (GAME_STATE.userFactions[username]) {
            let oldFaction = GAME_STATE.factions[GAME_STATE.userFactions[username]];
            if (oldFaction) {
                oldFaction.members = oldFaction.members.filter(member => member !== username);
            }
        }

        if (!GAME_STATE.factionRequests[factionName]) {
            GAME_STATE.factionRequests[factionName] = new Set();
        }

        GAME_STATE.factionRequests[factionName].add(username);
        console.log(`${username} requested to join the ${factionName} faction.`);

        if (GAME_STATE.factionRequests[factionName].size >= 3 && !GAME_STATE.factions[factionName]) {
            this.createFaction(factionName);
        } else if (GAME_STATE.factions[factionName]) {
            this.addMemberToFaction(factionName, username);
        }

        GAME_STATE.userFactions[username] = factionName;
        this.updateFactionStats();
    },
    createFaction: function(factionName) {
        if (!GAME_STATE.gameScene) {
            console.error("Game scene is not ready yet.");
            return;
        }

        let color = Phaser.Display.Color.RandomRGB();
        let x = Phaser.Math.Between(100, GameSetup.config.width - 100);
        let y = Phaser.Math.Between(100, GameSetup.config.height - 100);

        let newBlob = GAME_STATE.gameScene.add.circle(x, y, 50, color.color);
        newBlob.setInteractive();
        newBlob.radius = 50;

        let nameText = GAME_STATE.gameScene.add.text(x, y - 10, factionName, {
            font: '16px Arial',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        let officersText = GAME_STATE.gameScene.add.text(x, y + 10, '', {
            font: '12px Arial',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        GAME_STATE.factions[factionName] = {
            color: color.color,
            blob: newBlob,
            members: Array.from(GAME_STATE.factionRequests[factionName]),
            nameText: nameText,
            officersText: officersText,
            velocityX: 0,
            velocityY: 0,
            officers: Array.from(GAME_STATE.factionRequests[factionName]).slice(0, 3)
        };

        this.updateOfficersText(GAME_STATE.factions[factionName]);
        this.updateFactionStats();
        console.log(`Faction ${factionName} has been created!`);
    },
    addMemberToFaction: function(factionName, username) {
        let faction = GAME_STATE.factions[factionName];
        if (!faction.members.includes(username)) {
            faction.members.push(username);
            console.log(`${username} joined the ${factionName} faction!`);
            this.showJoinMessage(faction, username);
        } else {
            console.log(`${username} is already a member of the ${factionName} faction.`);
        }
    },
    showJoinMessage: function(faction, username) {
        const joinMessage = GAME_STATE.gameScene.add.text(
            faction.blob.x,
            faction.blob.y - faction.blob.radius - 20,
            username + " joined!",
            {
                font: '16px Arial',
                fill: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);

        GAME_STATE.gameScene.tweens.add({
            targets: joinMessage,
            y: joinMessage.y - 30,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: function() {
                joinMessage.destroy();
            }
        });
    },
    destroyFaction: function(factionName) {
        const faction = GAME_STATE.factions[factionName];
        if (faction) {
            if (faction.blob) faction.blob.destroy();
            if (faction.nameText) faction.nameText.destroy();
            if (faction.officersText) faction.officersText.destroy();
            
            faction.members.forEach(username => {
                delete GAME_STATE.userFactions[username];
            });
            
            delete GAME_STATE.factions[factionName];
            console.log(`Faction ${factionName} has been destroyed!`);
            this.updateFactionStats();
        }
    },
    updateFactionStats: function() {
        const factionStatsDiv = document.getElementById('faction-stats');
        let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Faction Name</th>
                    <th>Members</th>
                    <th>Blob Radius</th>
                    <th>Officers</th>
                </tr>
            </thead>
            <tbody>
        `;

        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            tableHTML += `
                <tr>
                    <td>${key}</td>
                    <td>${faction.members.length}</td>
                    <td>${faction.blob.radius.toFixed(2)}</td>
                    <td>${faction.officers.join(', ')}</td>
                </tr>
            `;
        }

        tableHTML += `
            </tbody>
        </table>
        `;

        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            tableHTML += `
            <h3>${key} Members:</h3>
            <ul>
                ${faction.members.map(member => `<li>${member}</li>`).join('')}
            </ul>
            `;
        }

        factionStatsDiv.innerHTML = tableHTML;
    },
    updateOfficersText: function(faction) {
        faction.officersText.setText(faction.officers.join('\n'));
    },
    sanitizeFactionName: function(name) {
        return name.replace(/[^a-z0-9]/gi, '').substr(0, 15);
    }
};

// Blob management
const BlobManager = {
    growFactionBlob: function(faction, amount) {
        let blob = faction.blob;
        let currentRadius = blob.radius;
        let growthFactor = Math.log(currentRadius + amount) - Math.log(currentRadius);
        let newRadius = Math.min(currentRadius * Math.exp(growthFactor), GAME_CONSTANTS.MAX_BLOB_RADIUS);
        
        GAME_STATE.gameScene.tweens.add({
            targets: blob,
            radius: newRadius,
            scale: newRadius / 50,
            duration: GAME_CONSTANTS.ANIMATION_DURATION,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.updateFactionText(faction);
            },
            onComplete: () => {
                FactionManager.updateFactionStats();
            }
        });
    },
    shrinkFactionBlob: function(faction, amount) {
        let blob = faction.blob;
        let currentRadius = blob.radius;
        let newRadius = Math.max(currentRadius - amount, 10); // Minimum radius of 10
        
        GAME_STATE.gameScene.tweens.add({
            targets: blob,
            radius: newRadius,
            scale: newRadius / 50,
            duration: GAME_CONSTANTS.ANIMATION_DURATION,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.updateFactionText(faction);
            },
            onComplete: () => {
                FactionManager.updateFactionStats();
            }
        });
    },
    moveBlob: function(username, direction) {
        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            if (faction.members.includes(username)) {
                let moveSpeed = this.calculateMoveSpeed(faction.blob.radius);
                switch (direction) {
                    case 'up':
                        faction.velocityY -= moveSpeed;
                        break;
                    case 'down':
                        faction.velocityY += moveSpeed;
                        break;
                    case 'left':
                        faction.velocityX -= moveSpeed;
                        break;
                    case 'right':
                        faction.velocityX += moveSpeed;
                        break;
                }
                console.log(`${username} moved the ${key} blob ${direction}!`);
                break;
            }
        }
    },
    calculateMoveSpeed: function(radius) {
        return GAME_CONSTANTS.BASE_MOVE_SPEED * (1 - (radius / GAME_CONSTANTS.MAX_BLOB_RADIUS) * 0.8);
    },
    applyFriction: function() {
        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            faction.velocityX *= GAME_CONSTANTS.FRICTION;
            faction.velocityY *= GAME_CONSTANTS.FRICTION;
            faction.blob.x += faction.velocityX;
            faction.blob.y += faction.velocityY;
            this.updateFactionText(faction);
        }
    },
    keepBlobsInBounds: function() {
        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            let blob = faction.blob;
            let radius = blob.radius;

            if (blob.x < radius) {
                blob.x = radius;
                faction.velocityX = Math.abs(faction.velocityX);
            } else if (blob.x > GameSetup.config.width - radius) {
                blob.x = GameSetup.config.width - radius;
                faction.velocityX = -Math.abs(faction.velocityX);
            }

            if (blob.y < radius) {
                blob.y = radius;
                faction.velocityY = Math.abs(faction.velocityY);
            } else if (blob.y > GameSetup.config.height - radius) {
                blob.y = GameSetup.config.height - radius;
                faction.velocityY = -Math.abs(faction.velocityY);
            }

            this.updateFactionText(faction);
        }
    },
    checkBlobCollisions: function() {
        const factionNames = Object.keys(GAME_STATE.factions);
        const factionsToDestroy = new Set();

        for (let i = 0; i < factionNames.length; i++) {
            const faction1 = GAME_STATE.factions[factionNames[i]];
            
            if (!faction1 || !faction1.blob) continue;

            for (let j = i + 1; j < factionNames.length; j++) {
                const faction2 = GAME_STATE.factions[factionNames[j]];
                
                if (!faction2 || !faction2.blob) continue;
                
                const distance = Phaser.Math.Distance.Between(
                    faction1.blob.x, faction1.blob.y,
                    faction2.blob.x, faction2.blob.y
                );
                
                if (distance < faction1.blob.radius + faction2.blob.radius) {
                    if (faction1.blob.radius > faction2.blob.radius) {
                        factionsToDestroy.add(factionNames[j]);
                        this.growFactionBlob(faction1, faction2.blob.radius * GAME_CONSTANTS.COLLISION_GROWTH_FACTOR);
                    } else if (faction2.blob.radius > faction1.blob.radius) {
                        factionsToDestroy.add(factionNames[i]);
                        this.growFactionBlob(faction2, faction1.blob.radius * GAME_CONSTANTS.COLLISION_GROWTH_FACTOR);
                    }
                }
            }
        }

        factionsToDestroy.forEach(factionName => {
            FactionManager.destroyFaction(factionName);
        });
    },
    updateFactionText: function(faction) {
        let blob = faction.blob;
        faction.nameText.setPosition(blob.x, blob.y - 10);
        faction.officersText.setPosition(blob.x, blob.y + 10);
        faction.nameText.setScale(blob.scale);
        faction.officersText.setScale(blob.scale * 0.75);
    }
};

// Pellet management
const PelletManager = {
    spawnPellets: function() {
        for (let i = 0; i < GAME_CONSTANTS.PELLET_COUNT; i++) {
            this.spawnPellet();
        }
    },
    spawnPellet: function() {
        let x = Phaser.Math.Between(10, GameSetup.config.width - 10);
        let y = Phaser.Math.Between(10, GameSetup.config.height - 10);
        let pellet = GAME_STATE.gameScene.add.circle(x, y, 5, 0xFF69B4);
        GAME_STATE.pellets.push(pellet);
    },
    checkPelletCollisions: function() {
        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            let blob = faction.blob;

            for (let i = GAME_STATE.pellets.length - 1; i >= 0; i--) {
                let pellet = GAME_STATE.pellets[i];
                let distance = Phaser.Math.Distance.Between(blob.x, blob.y, pellet.x, pellet.y);

                if (distance < blob.radius + 5) {
                    pellet.destroy();
                    GAME_STATE.pellets.splice(i, 1);
                    BlobManager.growFactionBlob(faction, GAME_CONSTANTS.PELLET_GROWTH_AMOUNT);
                    console.log(`${key} faction consumed a pellet!`);

                    setTimeout(this.spawnPellet.bind(this), GAME_CONSTANTS.PELLET_RESPAWN_TIME);
                }
            }
        }
    }
};

// Hazard management
const HazardManager = {
    hazardousPellets: [],

    spawnHazardousPellets: function(count) {
        for (let i = 0; i < count; i++) {
            this.spawnHazardousPellet();
        }
    },

    spawnHazardousPellet: function() {
        let x = Phaser.Math.Between(10, GameSetup.config.width - 10);
        let y = Phaser.Math.Between(10, GameSetup.config.height - 10);
        let pellet = GAME_STATE.gameScene.add.circle(x, y, 7, 0xFF0000);
        this.hazardousPellets.push(pellet);
    },

    checkHazardousPelletCollisions: function() {
        for (let key in GAME_STATE.factions) {
            let faction = GAME_STATE.factions[key];
            let blob = faction.blob;

            for (let i = this.hazardousPellets.length - 1; i >= 0; i--) {
                let pellet = this.hazardousPellets[i];
                let distance = Phaser.Math.Distance.Between(blob.x, blob.y, pellet.x, pellet.y);

                if (distance < blob.radius + 7) {
                    pellet.destroy();
                    this.hazardousPellets.splice(i, 1);
                    BlobManager.shrinkFactionBlob(faction, GAME_CONSTANTS.HAZARD_SHRINK_AMOUNT);
                    console.log(`${key} faction touched a hazardous pellet!`);

                    setTimeout(this.spawnHazardousPellet.bind(this), GAME_CONSTANTS.HAZARD_RESPAWN_TIME);
                }
            }
        }
    }
};

// Game configuration and setup
const GameSetup = {
    config: {
        type: Phaser.AUTO,
        width: window.innerWidth - 100,
        height: window.innerHeight - 250,
        backgroundColor: '#2C2F33',
        parent: 'game-container',
        scene: {
            preload: function() {},
            create: function() {
                GAME_STATE.gameScene = this;
                PelletManager.spawnPellets();
                HazardManager.spawnHazardousPellets(GAME_CONSTANTS.HAZARDOUS_PELLET_COUNT);
            },
            update: function() {
                BlobManager.applyFriction();
                BlobManager.checkBlobCollisions();
                PelletManager.checkPelletCollisions();
                HazardManager.checkHazardousPelletCollisions();
                BlobManager.keepBlobsInBounds();
            }
        },
        physics: {
            default: 'arcade',
            arcade: {
                debug: false
            }
        }
    },
    init: function() {
        this.game = new Phaser.Game(this.config);
        WebSocketHandler.init();
    }
};

// Initialize the game
GameSetup.init();