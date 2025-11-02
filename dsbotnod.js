require('dotenv').config();
console.log("Токен:", process.env.DISCORD_TOKEN);

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

// ID канала, куда бот будет писать приветствие
const WELCOME_CHANNEL_ID = '1428069500795879484';

// Создаём клиента с нужными интентами
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

// Кэш приглашений
const invitesCache = new Map();

// При запуске кэшируем все приглашения
client.once('ready', async () => {
    console.log(`✅ Бот ${client.user.tag} в сети!`);

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const invites = await guild.invites.fetch();
            const map = new Map();
            invites.forEach(i => map.set(i.code, i.uses));
            invitesCache.set(guild.id, map);
            console.log(`Кэш приглашений загружен для ${guild.name}`);
        } catch (err) {
            console.log(`Не удалось получить приглашения для ${guild.name}:`, err.message);
        }
    }
});

// Обновляем кэш, если создают или удаляют приглашения
client.on('inviteCreate', invite => {
    const invites = invitesCache.get(invite.guild.id) || new Map();
    invites.set(invite.code, invite.uses);
    invitesCache.set(invite.guild.id, invites);
});

client.on('inviteDelete', invite => {
    const invites = invitesCache.get(invite.guild.id);
    if (invites) invites.delete(invite.code);
});

// Когда новый участник заходит
client.on('guildMemberAdd', async member => {
    if (member.user.bot) return;

    const guild = member.guild;
    let cachedInvites = invitesCache.get(guild.id);
    let newInvites;

    try {
        newInvites = await guild.invites.fetch();
    } catch (err) {
        console.log('Ошибка получения приглашений:', err.message);
        return;
    }

    // Проверяем, какая ссылка увеличила uses
    const usedInvite = newInvites.find(i => {
        const oldUses = cachedInvites?.get(i.code) ?? 0;
        return i.uses > oldUses;
    });

    // Обновляем кэш
    const newCache = new Map();
    newInvites.forEach(i => newCache.set(i.code, i.uses));
    invitesCache.set(guild.id, newCache);

    // Определяем, кто пригласил
    const inviter = usedInvite ? usedInvite.inviter : null;

    // Формируем сообщение
    const message = inviter
        ? `👋 ${member} только что присоединился! Его пригласил **${inviter.tag}**.`
        : `👋 ${member} только что присоединился! (Пригласивший не найден)`;

    // Отправляем в нужный канал
    const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) {
        channel.send(message).catch(console.error);
    } else {
        console.log('⚠️ Канал не найден, укажи ID в WELCOME_CHANNEL_ID');
    }
});

// Логин через токен из .env
client.login(process.env.DISCORD_TOKEN);
