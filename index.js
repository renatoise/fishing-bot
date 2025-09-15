const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// Configurações do jogo
const FISHING_CONFIG = {
    commonFish: ['Tilápia', 'Sardinha', 'Carpa', 'Bagre'],
    rareFish: ['Dourado', 'Salmão', 'Atum', 'Cherne'],
    junk: ['Garrafa Plástica', 'Lata', 'Saco Plástico', 'Pneu Velho'],
    probabilities: {
        common: 70,
        rare: 5,
        junk: 25
    },
    prices: {
        'Tilápia': 10,
        'Sardinha': 8,
        'Carpa': 12,
        'Bagre': 15,
        'Dourado': 100,
        'Salmão': 120,
        'Atum': 150,
        'Cherne': 200
    }
};

const SHOP_ITEMS = {
    'Vara Básica': { price: 0, owned: true },
    'Vara Intermediária': { price: 500, owned: false },
    'Vara Avançada': { price: 2000, owned: false },
    'Isca Comum': { price: 5, owned: false, consumable: true },
    'Isca Rara': { price: 20, owned: false, consumable: true }
};

class FishingGame {
    constructor() {
        this.users = new Map();
        this.loadUsersData();
    }

    loadUsersData() {
        const usersDir = path.join(__dirname, 'users');
        if (!fs.existsSync(usersDir)) {
            fs.mkdirSync(usersDir);
        }
    }

    getUserData(userId) {
        const userFile = path.join(__dirname, 'users', ${userId}.json);
        
        if (fs.existsSync(userFile)) {
            return JSON.parse(fs.readFileSync(userFile, 'utf8'));
        }

        // Novo usuário
        const newUser = {
            money: 100,
            inventory: {},
            fishingRod: 'Vara Básica',
            bait: 0,
            stats: {
                totalFishing: 0,
                commonFish: 0,
                rareFish: 0,
                junk: 0
            }
        };

        this.saveUserData(userId, newUser);
        return newUser;
    }

    saveUserData(userId, data) {
        const userFile = path.join(__dirname, 'users', ${userId}.json);
        fs.writeFileSync(userFile, JSON.stringify(data, null, 2));
    }

    calculateCatch(userData) {
        const rodBonus = userData.fishingRod === 'Vara Intermediária' ? 5 : 
                        userData.fishingRod === 'Vara Avançada' ? 10 : 0;
        
        const totalProb = FISHING_CONFIG.probabilities.common + 
                         FISHING_CONFIG.probabilities.rare + 
                         FISHING_CONFIG.probabilities.junk;

        let rand = Math.random() * totalProb;
        
        if (rand < FISHING_CONFIG.probabilities.common + rodBonus) {
            const fish = FISHING_CONFIG.commonFish[
                Math.floor(Math.random() * FISHING_CONFIG.commonFish.length)
            ];
            return { type: 'common', item: fish };
        } else if (rand < FISHING_CONFIG.probabilities.common + 
                             FISHING_CONFIG.probabilities.rare + rodBonus) {
            const fish = FISHING_CONFIG.rareFish[
                Math.floor(Math.random() * FISHING_CONFIG.rareFish.length)
            ];
            return { type: 'rare', item: fish };
        } else {
            const junk = FISHING_CONFIG.junk[
                Math.floor(Math.random() * FISHING_CONFIG.junk.length)
            ];
            return { type: 'junk', item: junk };
        }
    }

    async handleCommand(userId, command) {
        const userData = this.getUserData(userId);
        
        switch (command) {
            case '/pescar':
                return await this.handleFishing(userData, userId);
                
            case '/inventario':
                return this.showInventory(userData);
                
            case '/vender':
                return this.sellFish(userData, userId);
                
            case '/loja':
                return this.showShop(userData);
                
            case '/ranking':
                return this.showRanking();
                
            default:
                if (command.startsWith('/comprar ')) {
                    const item = command.split(' ')[1];
                    return this.buyItem(userData, userId, item);
                }
                return this.showHelp();
        }
    }

    async handleFishing(userData, userId) {
        const catchResult = this.calculateCatch(userData);
        
        // Atualizar inventário
        if (!userData.inventory[catchResult.item]) {
            userData.inventory[catchResult.item] = 0;
        }
        userData.inventory[catchResult.item]++;
        
        // Atualizar estatísticas
        userData.stats.totalFishing++;
        userData.stats[${catchResult.type}Fish]++;
        
        this.saveUserData(userId, userData);
        
        let message = 🎣 *Pescaria Realizada!*\n;
        message += Você pescou: *${catchResult.item}*\n;
        message += Tipo: ${catchResult.type === 'rare' ? '⭐ RARO ⭐' : catchResult.type}\n\n;
        message += Use /inventario para ver seus itens;

        return message;
    }

    showInventory(userData) {
        let message = 💰 *Inventário*\n;
        message += Dinheiro: R$ ${userData.money}\n;
        message += Vara: ${userData.fishingRod}\n;
        message += Iscas: ${userData.bait}\n\n;
        message += *Itens:*\n;
        
        if (Object.keys(userData.inventory).length === 0) {
            message += Nenhum item encontrado;
        } else {
            for (const [item, quantity] of Object.entries(userData.inventory)) {
                message += ${item}: ${quantity}\n;
            }
        }
        
        message += \nUse /vender para vender peixes;
        return message;
    }

    sellFish(userData, userId) {
        let total = 0;
        let soldItems = [];
        
        for (const [item, quantity] of Object.entries(userData.inventory)) {
            if (FISHING_CONFIG.prices[item]) {
                total += FISHING_CONFIG.prices[item] * quantity;
                soldItems.push(${item} (${quantity}x));
                delete userData.inventory[item];
            }
        }
        
        if (total === 0) {
            return ❌ Nenhum peixe para vender!;
        }
        
        userData.money += total;
        this.saveUserData(userId, userData);
        
        return 💰 *Venda Realizada!*\nItens vendidos: ${soldItems.join(', ')}\nTotal: R$ ${total}\nSaldo atual: R$ ${userData.money};
    }

    showShop(userData) {
        let message = 🛒 *Loja de Pesca*\n\n;
        message += Seu saldo: R$ ${userData.money}\n\n;
        message += *Itens disponíveis:*\n;
        
        for (const [item, details] of Object.entries(SHOP_ITEMS)) {
            if (!details.owned || details.consumable) {
                const owned = userData.fishingRod === item ? '✅' : 
                             details.owned ? '✅' : '❌';
                message += ${owned} ${item} - R$ ${details.price}\n;
            }
        }
        
        message += \nUse /comprar [item] para comprar;
        return message;
    }

    buyItem(userData, userId, itemName) {
        const item = SHOP_ITEMS[itemName];
        
        if (!item) {
            return ❌ Item não encontrado na loja!;
        }
        
        if (userData.money < item.price) {
            return ❌ Saldo insuficiente!;
        }
        
        if (itemName.includes('Vara')) {
            userData.fishingRod = itemName;
            userData.money -= item.price;
            this.saveUserData(userId, userData);
            return ✅ ${itemName} comprada com sucesso!;
        } else if (itemName.includes('Isca')) {
            userData.bait += 1;
            userData.money -= item.price;
            this.saveUserData(userId, userData);
            return ✅ ${itemName} comprada! Iscas: ${userData.bait};
        }
        
        return ❌ Não foi possível comprar o item;
    }

    showRanking() {
        // Implementação simplificada do ranking
        return 🏆 *Ranking em desenvolvimento*\nEm breve teremos um ranking global!;
    }

    showHelp() {
        return 🎣 *Bot de Pesca - Ajuda*\n\n +
               /pescar - Inicia uma pescaria\n +
               /inventario - Mostra seus itens\n +
               /vender - Vende todos os peixes\n +
               /loja - Mostra itens para comprar\n +
               /comprar [item] - Compra um item\n +
               /ranking - Mostra o ranking\n\n +
               Boa pescaria! 🎣;
    }
}

// Inicializar o bot
const client = new Client({
    authStrategy: new LocalAuth()
});
const game = new FishingGame();

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Escaneie o QR Code acima para conectar');
});

client.on('ready', () => {
    console.log('Bot de pescaria conectado!');
});

client.on('message', async (msg) => {
    if (msg.body.startsWith('/')) {
        const userId = msg.from;
        const response = await game.handleCommand(userId, msg.body.toLowerCase());
        
        if (response) {
            msg.reply(response);
        }
    }
});

client.initialize();
