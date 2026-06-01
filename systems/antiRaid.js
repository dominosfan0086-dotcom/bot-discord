const { EmbedBuilder } = require('discord.js');

const joinMap = new Map();
const botJoinMap = new Map();
const messageMap = new Map();
const raidMode = new Map();

function activateRaidMode(guild) {
    const startedAt = Date.now();
    raidMode.set(guild.id, startedAt);

    console.log(`🚨 RAID MODE ACTIVÉ sur ${guild.name}`);

    alertStaff(guild, 'Détection de raid / rafale de joins. Verrouillage automatique des salons.');
    logSecurity(guild, 'Mode raid activé après détection de joins anormaux.');

    guild.channels.cache.forEach(channel => {
        if (channel.isTextBased()) {
            channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: false
            }).catch(() => {});
        }
    });

    setTimeout(() => {
        if (raidMode.get(guild.id) === startedAt) {
            deactivateRaidMode(guild);
        }
    }, 60000);
}

function deactivateRaidMode(guild) {
    raidMode.delete(guild.id);

    guild.channels.cache.forEach(channel => {
        if (channel.isTextBased()) {
            channel.permissionOverwrites.edit(guild.roles.everyone, {
                SendMessages: true
            }).catch(() => {});
        }
    });

    console.log(`🟢 RAID MODE OFF ${guild.name}`);
    logSecurity(guild, 'Mode raid désactivé automatiquement après expiration du délai de sécurité.');
}

function alertStaff(guild, message) {
    const role = guild.roles.cache.get('1365103343759790111');

    if (!role) return;

    const channel = guild.channels.cache.find(c => c.isTextBased());

    if (channel) {
        channel.send({
            content: `<@&${role.id}> 🚨 ${message}`
        }).catch(() => {});
    }
}

function logSecurity(guild, text) {
    const logChannel = guild.channels.cache.find(c =>
        c.name.toLowerCase().includes('log') ||
        c.name.toLowerCase().includes('logs')
    );

    if (!logChannel) return;

    logChannel.send({
        embeds: [
            new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🛡️ Security Log')
                .setDescription(text)
                .setTimestamp()
        ]
    }).catch(() => {});
}

function trackJoin(member) {
    if (!member.guild) return;

    const guildId = member.guild.id;
    const now = Date.now();

    if (!joinMap.has(guildId)) {
        joinMap.set(guildId, []);
    }

    const joins = joinMap.get(guildId);
    joins.push(now);

    const filtered = joins.filter(time => now - time < 10000);
    joinMap.set(guildId, filtered);

    if (filtered.length >= 5) {
        activateRaidMode(member.guild);
        alertStaff(member.guild, 'Rafale de joins détectée. Le serveur est verrouillé temporairement.');
        logSecurity(member.guild, `Rafale de joins détectée (${filtered.length} joins en 10s).`);
        return;
    }

    if (member.user.bot) {
        if (!botJoinMap.has(guildId)) {
            botJoinMap.set(guildId, []);
        }

        const bots = botJoinMap.get(guildId);
        bots.push(now);

        const filteredBots = bots.filter(time => now - time < 10000);
        botJoinMap.set(guildId, filteredBots);

        if (filteredBots.length >= 3) {
            activateRaidMode(member.guild);
            alertStaff(member.guild, 'Rafale de bots détectée. Lockdown automatique activé.');
            logSecurity(member.guild, `Rafale de bots détectée (${filteredBots.length} bots en 10s).`);
        }
    }
}

function trackMessage(message) {
    if (!message.guild || message.author.bot) return;

    const key = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();

    if (!messageMap.has(key)) {
        messageMap.set(key, []);
    }

    const msgs = messageMap.get(key);
    msgs.push(now);

    const filtered = msgs.filter(time => now - time < 5000);
    messageMap.set(key, filtered);

    if (filtered.length >= 6) {
        message.delete().catch(() => {});

        message.channel.send({
            content: `⚠️ ${message.author}, spam détecté.`
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    }
}

function checkMentions(message) {
    if (!message.guild || message.author.bot) return;

    if (message.mentions.users.size >= 5) {
        message.delete().catch(() => {});

        message.channel.send({
            content: `🚫 ${message.author}, trop de mentions détectées.`
        }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    }
}

module.exports = {
    trackJoin,
    trackMessage,
    checkMentions,
    activateRaidMode,
    deactivateRaidMode,
    alertStaff,
    logSecurity
};
