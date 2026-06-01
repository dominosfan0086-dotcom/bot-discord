require('dotenv').config();

process.on('unhandledRejection', (err) => {
    console.log('❌ UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
    console.log('❌ UNCAUGHT EXCEPTION:', err);
});

process.on('uncaughtExceptionMonitor', (err) => {
    console.log('⚠️ EXCEPTION MONITOR:', err);
});

const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const badwords = require('./config/badwords');
const { trackJoin, trackMessage, checkMentions } = require('./systems/antiRaid');
const { trackNickname } = require('./systems/nicknameTracker');
const { analyzeSituation } = require('./ai/moderationAI');
const OpenAI = require('openai');

// ---------- KEEP ALIVE SERVER ----------
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is alive');
});

app.listen(3000, () => {
    console.log('✅ Keep-alive server running on port 3000');
});

const QUARANTINE_ROLE_ID = '1509271594495905913';

const liensInterdits = [
    'discord.gg/',
    'https://discord.gg/',
    'http://discord.gg/',
    'discord.com/invite/',
    'https://',
    'http://'
];

const logsFile = './data/logs.json';
const muteFile = './data/mutes.json';
const warnsFile = './data/warns.json';
const ticketCooldown = new Map();
const ticketCategorySelection = new Map();

function ensureFile(path) {
    const dir = require('path').dirname(path);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(path)) {
        fs.writeFileSync(path, '{}');
    }
}

function ensureWarnsFile() {
    fs.mkdirSync('./data', { recursive: true });
    if (!fs.existsSync(warnsFile)) {
        fs.writeFileSync(warnsFile, '{}');
    }
}

function loadWarns() {
    ensureWarnsFile();
    return JSON.parse(fs.readFileSync(warnsFile, 'utf8'));
}

function saveWarns(data) {
    ensureWarnsFile();
    fs.writeFileSync(warnsFile, JSON.stringify(data, null, 4));
}

function loadLogs() {
    fs.mkdirSync('./data', { recursive: true });
    if (!fs.existsSync(logsFile)) {
        fs.writeFileSync(logsFile, '{}');
    }
    return JSON.parse(fs.readFileSync(logsFile, 'utf8'));
}

function saveLogs(data) {
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync(logsFile, JSON.stringify(data, null, 4));
}

const aiFile = './data/ai.json';

function loadAI() {
    ensureFile(aiFile);
    return JSON.parse(fs.readFileSync(aiFile, 'utf8'));
}

function saveAI(data) {
    ensureFile(aiFile);
    fs.writeFileSync(aiFile, JSON.stringify(data, null, 4));
}

const creditsFile = './data/credits.json';

function loadCredits() {
    ensureFile(creditsFile);
    return JSON.parse(fs.readFileSync(creditsFile, 'utf8'));
}

function saveCredits(data) {
    ensureFile(creditsFile);
    fs.writeFileSync(creditsFile, JSON.stringify(data, null, 4));
}

function addCredits(guildId, userId, amount) {
    const data = loadCredits();
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][userId]) data[guildId][userId] = 0;

    data[guildId][userId] += amount;
    saveCredits(data);
}

function removeCredits(guildId, userId, amount) {
    const data = loadCredits();
    if (!data[guildId]?.[userId]) return false;

    if (data[guildId][userId] < amount) return false;

    data[guildId][userId] -= amount;
    saveCredits(data);
    return true;
}

function getCredits(guildId, userId) {
    const data = loadCredits();
    return data[guildId]?.[userId] || 0;
}

const ticketAIFile = './data/ticket_ai.json';

function loadTicketAI() {
    ensureFile(ticketAIFile);
    return JSON.parse(fs.readFileSync(ticketAIFile, 'utf8'));
}

function saveTicketAI(data) {
    ensureFile(ticketAIFile);
    fs.writeFileSync(ticketAIFile, JSON.stringify(data, null, 4));
}

const ecoFile = './data/economy.json';

function loadEco() {
    ensureFile(ecoFile);
    return JSON.parse(fs.readFileSync(ecoFile, 'utf8'));
}

function saveEco(data) {
    ensureFile(ecoFile);
    fs.writeFileSync(ecoFile, JSON.stringify(data, null, 4));
}

function getUserEco(guildId, userId) {
    const data = loadEco();

    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][userId]) {
        data[guildId][userId] = {
            wallet: 0,
            bank: 0,
            xp: 0,
            lastDaily: 0,
            lastWork: 0,
            lastMsg: 0,
            transactions: []
        };
    }

    return data[guildId][userId];
}

function addMoney(guildId, userId, amount, reason = "unknown") {
    const data = loadEco();
    const user = getUserEco(guildId, userId);

    user.wallet += amount;
    user.transactions.push({
        type: "GAIN",
        amount,
        reason,
        date: Date.now()
    });

    data[guildId][userId] = user;
    saveEco(data);
}

function removeMoney(guildId, userId, amount, reason = "unknown") {
    const data = loadEco();
    const user = getUserEco(guildId, userId);

    if (user.wallet < amount) return false;

    user.wallet -= amount;
    user.transactions.push({
        type: "LOSS",
        amount,
        reason,
        date: Date.now()
    });

    data[guildId][userId] = user;
    saveEco(data);
    return true;
}

function applyTax(amount) {
    return Math.floor(amount * 0.95);
}

const shopFile = './data/shop.json';

function loadShop() {
    if (!fs.existsSync(shopFile)) {
        fs.writeFileSync(shopFile, JSON.stringify({ items: [] }, null, 4));
    }
    return JSON.parse(fs.readFileSync(shopFile, 'utf8'));
}

function saveShop(data) {
    fs.writeFileSync(shopFile, JSON.stringify(data, null, 4));
}

const shopCreationState = new Map();

function loadData(path) {
    ensureFile(path);
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function saveData(path, data) {
    ensureFile(path);
    fs.writeFileSync(path, JSON.stringify(data, null, 4));
}

async function handleWarnEscalation(member, warns, interaction) {
    const count = warns[member.id]?.length || 0;

    if (count <= 3) return;

    try {
        if (count <= 6) {
            const time = (count - 3) * 60 * 60 * 1000;
            await member.timeout(time, 'Escalade de warn');
            return;
        }

        if (count <= 9) {
            const time = (count - 6) * 12 * 60 * 60 * 1000;
            await member.timeout(time, 'Escalade sévère');
            return;
        }

        if (count <= 11) {
            const time = (count - 9) * 5 * 24 * 60 * 60 * 1000;
            await member.timeout(time, 'Escalade critique');
            return;
        }

        if (count === 12) {
            const role = interaction.guild.roles.cache.get('1365103343759790111');

            if (role) {
                await interaction.channel.send({ content: `<@&${role.id}>` });
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 CAS CRITIQUE - 12 WARN')
                .setDescription(
                    `**${member.user.tag}** a atteint **12 avertissements**.\n\n` +
                    `Ce membre doit être pris en charge immédiatement par un membre haut gradé du staff.\n\n` +
                    `Tous les autres membres du staff sont priés de ne pas interférer dans cette procédure.`
                )
                .setFooter({ text: 'Procédure disciplinaire avancée' });

            await interaction.channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Erreur lors de l\'escalade des warns :', err);
    }
}

client.once('ready', () => {
    console.log(`${client.user.tag} est connecté !`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Système IA configurable
    const ai = loadAI();
    const aiChannel = ai[message.guild?.id];

    if (aiChannel && message.channel.id === aiChannel) {
        try {
            await message.channel.sendTyping();

            const clientAI = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });

            const response = await clientAI.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Tu es une IA de support pour un serveur Discord. Réponds de façon concise et utile."
                    },
                    {
                        role: "user",
                        content: message.content
                    }
                ]
            });

            const reply = response.choices[0].message.content;

            return message.reply({
                content: reply
            });

        } catch (err) {
            console.log(err);
            return message.reply("❌ Erreur IA.");
        }
    }

    try {
        trackMessage(message);
        checkMentions(message);
        
        const user = getUserEco(message.guild.id, message.author.id);
        if (Date.now() - user.lastMsg > 15000) {
            addMoney(message.guild.id, message.author.id, 1, "chat");
        }
        user.lastMsg = Date.now();
        const data = loadEco();
        if (!data[message.guild.id]) data[message.guild.id] = {};
        data[message.guild.id][message.author.id] = user;
        saveEco(data);
    } catch (err) {
        console.error('Erreur anti-raid:', err);
    }

    const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
    const containsForbiddenLink = liensInterdits.some(link =>
        message.content.toLowerCase().includes(link)
    );

    if (containsForbiddenLink && !isAdmin) {
        await message.delete().catch(() => {});
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚫 Lien interdit')
            .setDescription(`${message.author}, les liens sont interdits ici.`)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: 'Protection automatique' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] }).catch(() => {});
        return;
    }

    const content = message.content
        .toLowerCase()
        .replace(/[^a-zA-Z0-9À-ÿ]/g, '');

    const detected = badwords.some(word =>
        content.includes(
            word.toLowerCase().replace(/[^a-zA-Z0-9À-ÿ]/g, '')
        )
    );

    if (detected) {
        await message.delete().catch(() => {});
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('⚠️ Insulte détectée')
            .setDescription(`${message.author}, les insultes sont interdites.`)
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: 'Protection automatique' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] }).catch(() => {});
    }
});

client.on('guildMemberAdd', (member) => {
    try {
        trackJoin(member);
    } catch (err) {
        console.error('Erreur trackJoin:', err);
    }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
    try {
        trackNickname(oldMember, newMember);
    } catch (err) {
        console.error('Erreur trackNickname:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        // ---------- COMMAND: mutetemp ----------
        if (interaction.isCommand() && interaction.commandName === 'mutetemp') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '❌ Permission requise', ephemeral: true });
            }

            const member = interaction.options.getMember('membre');
            const hours = interaction.options.getInteger('heures');
            const reason = interaction.options.getString('raison') || 'Aucune raison';

            if (!member) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            if (!hours || hours <= 0) {
                return interaction.reply({ content: '❌ Durée invalide', ephemeral: true });
            }

            const duration = hours * 60 * 60 * 1000;
            await member.timeout(duration, reason);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('🔇 Mute temporaire')
                        .addFields(
                            { name: 'Utilisateur', value: member.user.tag, inline: true },
                            { name: 'Durée', value: `${hours} heure(s)`, inline: true },
                            { name: 'Raison', value: reason, inline: false }
                        )
                        .setTimestamp()
                ]
            });
        }

        // ---------- COMMAND: unmute ----------
        if (interaction.isCommand() && interaction.commandName === 'unmute') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return interaction.reply({ content: '❌ Permission requise', ephemeral: true });
            }

            const member = interaction.options.getMember('membre');
            if (!member) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            await member.timeout(null);

            return interaction.reply({
                content: `🔊 ${member.user.tag} a été unmute.`
            });
        }

        // ---------- COMMAND: bantemp ----------
        if (interaction.isCommand() && interaction.commandName === 'bantemp') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const member = interaction.options.getMember('membre');
            const hours = interaction.options.getInteger('heures');
            const reason = interaction.options.getString('raison') || 'Aucune raison';

            if (!member) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            if (!hours || hours <= 0) {
                return interaction.reply({ content: '❌ Durée invalide', ephemeral: true });
            }

            const duration = hours * 60 * 60 * 1000;

            await member.roles.add(QUARANTINE_ROLE_ID).catch(() => {});

            setTimeout(async () => {
                const fresh = await interaction.guild.members.fetch(member.id).catch(() => null);
                if (!fresh) return;
                await fresh.roles.remove(QUARANTINE_ROLE_ID).catch(() => {});
            }, duration);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🚨 Quarantaine temporaire')
                        .addFields(
                            { name: 'Utilisateur', value: member.user.tag },
                            { name: 'Durée', value: `${hours} heure(s)` },
                            { name: 'Raison', value: reason }
                        )
                        .setTimestamp()
                ]
            });
        }

        // ---------- COMMAND: unban (remove quarantine role) ----------
        if (interaction.isCommand() && interaction.commandName === 'unban') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const member = interaction.options.getMember('membre');
            if (!member) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            await member.roles.remove(QUARANTINE_ROLE_ID).catch(() => {});

            return interaction.reply({
                content: `✅ ${member.user.tag} n'est plus en quarantaine.`
            });
        }

        // ---------- BUTTONS ----------
        if (interaction.isButton()) {
            const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);
            if (!isAdmin) {
                return interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
            }

            // staff_info_server
            if (interaction.customId === 'staff_info_server') {
                const serverEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🖥️ Informations serveur')
                    .setThumbnail(interaction.guild.iconURL())
                    .addFields(
                        { name: '📛 Nom', value: interaction.guild.name, inline: true },
                        { name: '👥 Membres', value: `${interaction.guild.memberCount}`, inline: true },
                        { name: '🆔 ID', value: interaction.guild.id, inline: true }
                    )
                    .setTimestamp();

                return interaction.reply({ embeds: [serverEmbed], ephemeral: true });
            }

            // staff_warn_menu
            if (interaction.customId === 'staff_warn_menu') {
                const warnEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('⚠️ Menu de warns')
                    .setDescription('Utilise `/warn <membre> <raison>` pour sanctionner, `/warnings <membre>` pour consulter et `/unwarn <membre>` pour retirer un avertissement.')
                    .setTimestamp();

                return interaction.reply({ embeds: [warnEmbed], ephemeral: true });
            }

            // staff_lockdown
            if (interaction.customId === 'staff_lockdown') {
                const lockdownEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🔒 Lockdown')
                    .setDescription('Utilise `/lockdown` pour verrouiller tous les salons et `/unlockdown` pour les déverrouiller.')
                    .setTimestamp();

                return interaction.reply({ embeds: [lockdownEmbed], ephemeral: true });
            }

            // staff_logs
            if (interaction.customId === 'staff_logs') {
                const logs = loadLogs();
                const channelId = logs[interaction.guild.id];
                const channel = interaction.guild.channels.cache.get(channelId);

                const logsEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📁 Salon de logs')
                    .setDescription(channel ? `Le salon de logs est ${channel}.` : 'Aucun salon de logs n’a été défini. Utilise `/setlogs`.')
                    .setTimestamp();

                return interaction.reply({ embeds: [logsEmbed], ephemeral: true });
            }

            // staff_tickets
            if (interaction.customId === 'staff_tickets') {
                const ticketsEmbed = new EmbedBuilder()
                    .setColor('#00aaff')
                    .setTitle('🎫 Gestion des tickets')
                    .setDescription('Clique sur "Envoyer le panel tickets" pour afficher le panneau de création de ticket, puis utilise le bouton de création.')
                    .setTimestamp();

                return interaction.reply({ embeds: [ticketsEmbed], ephemeral: true });
            }

            // staff_userinfo
            if (interaction.customId === 'staff_userinfo') {
                const userinfoEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('👤 Informations utilisateur')
                    .setDescription('Utilise `/userinfo <membre>` pour consulter les informations d’un membre du serveur.')
                    .setTimestamp();

                return interaction.reply({ embeds: [userinfoEmbed], ephemeral: true });
            }

            // staff_ticket_panel_send
            if (interaction.customId === 'staff_ticket_panel_send') {
                const ticketPanelEmbed = new EmbedBuilder()
                    .setColor('#00aaff')
                    .setTitle('🎫 Centre de support')
                    .setDescription('Choisis une catégorie puis crée ton ticket. Les tickets peuvent être clôturés ou réclamés par le staff.')
                    .setTimestamp();

                const categoryMenu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_category_select')
                    .setPlaceholder('Choisir une catégorie')
                    .addOptions(
                        { label: 'Général', value: 'general', description: 'Questions générales' },
                        { label: 'Modération', value: 'moderation', description: 'Signalement et sanctions' },
                        { label: 'Technique', value: 'technique', description: 'Problèmes techniques' }
                    );

                const ticketButton = new ButtonBuilder()
                    .setCustomId('ticket_create')
                    .setLabel('Créer un ticket')
                    .setEmoji('🎫')
                    .setStyle(ButtonStyle.Primary);

                const row1 = new ActionRowBuilder().addComponents(categoryMenu);
                const row2 = new ActionRowBuilder().addComponents(ticketButton);

                return interaction.reply({ embeds: [ticketPanelEmbed], components: [row1, row2], ephemeral: true });
            }

            // ticket_create
            if (interaction.customId === 'ticket_create') {
                const category = ticketCategorySelection.get(interaction.user.id) || 'general';
                const categoryLabel = { general: 'Général', moderation: 'Modération', technique: 'Technique' }[category] || 'Général';

                const cooldown = ticketCooldown.get(interaction.user.id);
                if (cooldown && Date.now() - cooldown < 30000) {
                    return interaction.reply({ content: '⏳ Merci d’attendre 30 secondes avant de créer un nouveau ticket.', ephemeral: true });
                }

                ticketCooldown.set(interaction.user.id, Date.now());
                setTimeout(() => ticketCooldown.delete(interaction.user.id), 30000);

                const safeName = interaction.user.username
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');

                const channel = await interaction.guild.channels.create({
                    name: `ticket-${safeName}-${category}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`🎫 Ticket ${categoryLabel}`)
                    .setDescription(`Bienvenue ${interaction.user} dans ton ticket de support.\n\nExplique ton problème au staff.\n\nCatégorie : **${categoryLabel}**`)
                    .setFooter({ text: 'Support • Rise Of Alpha Security' })
                    .setTimestamp();

                const closeButton = new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger);
                const claimButton = new ButtonBuilder().setCustomId('ticket_claim').setLabel('Réclamer le ticket').setStyle(ButtonStyle.Success);
                const closeReqButton = new ButtonBuilder().setCustomId('ticket_close_request').setLabel('Fermer (Validation Staff)').setStyle(ButtonStyle.Danger);
                const humanButton = new ButtonBuilder().setCustomId('ticket_request_human').setLabel('Demander un Humain').setStyle(ButtonStyle.Primary);
                const changeStaffButton = new ButtonBuilder().setCustomId('ticket_change_staff').setLabel('Changer de Staff').setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);
                const aiPanel = new ActionRowBuilder().addComponents(closeReqButton, humanButton, changeStaffButton);

                await channel.send({ embeds: [ticketEmbed], components: [row] });

                return interaction.reply({ content: `✅ Ton ticket a été créé : ${channel} (${categoryLabel})`, ephemeral: true });
            }

            // ticket_close
            if (interaction.customId === 'ticket_close') {
                await interaction.reply({ content: '❌ Le ticket va être fermé dans 3 secondes.', ephemeral: true });
                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 3000);
                return;
            }

            // ticket_claim
            if (interaction.customId === 'ticket_claim') {
                await interaction.reply({ content: `🎫 Ticket réclamé par ${interaction.user}.`, ephemeral: true });
                await interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#00ff88')
                            .setTitle('✅ Ticket réclamé')
                            .setDescription(`Ce ticket a été réclamé par ${interaction.user}.`)
                            .setTimestamp()
                    ]
                }).catch(() => {});
                return;
            }
        }

        // ---------- SELECT MENUS ----------
        // ---------- SELECT MENUS ----------
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category_select') {
                const selected = interaction.values[0];
                ticketCategorySelection.set(interaction.user.id, selected);

                return interaction.update({
                    content: `🎫 Catégorie choisie : **${selected}**`,
                    components: interaction.message.components,
                    embeds: interaction.message.embeds
                });
            }

            // shop_type_select
            if (interaction.customId === "shop_type_select") {
                const type = interaction.values[0];
                shopCreationState.set(interaction.user.id, { type });

                const roleMenu = new RoleSelectMenuBuilder()
                    .setCustomId("shop_role_select")
                    .setPlaceholder("Choisir le rôle à vendre");

                const row = new ActionRowBuilder().addComponents(roleMenu);

                return interaction.reply({
                    content: "🎯 Choisis le rôle à associer à cet item",
                    components: [row],
                    ephemeral: true
                });
            }

            // unwarn select menu handling
            if (interaction.customId.startsWith('unwarn_')) {
                const membreId = interaction.customId.split('_')[1];
                const warns = loadWarns();
                const warnIndex = parseInt(interaction.values[0], 10);

                if (!warns[membreId] || !warns[membreId][warnIndex]) {
                    return interaction.update({ content: 'Warn introuvable.', components: [], embeds: [] });
                }

                const removedWarn = warns[membreId][warnIndex];
                warns[membreId].splice(warnIndex, 1);
                saveWarns(warns);

                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('🗑️ Warn supprimé')
                            .setDescription(`Le warn a été supprimé.`)
                            .addFields({ name: '📝 Raison supprimée', value: removedWarn.raison })
                            .setTimestamp()
                    ],
                    components: []
                });
                return;
            }
        }

        // ---------- ROLE SELECT MENU ----------
        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === "shop_role_select") {
                const roleId = interaction.values[0];
                const state = shopCreationState.get(interaction.user.id);

                if (!state) {
                    return interaction.reply({ content: "❌ Session expirée", ephemeral: true });
                }

                state.roleId = roleId;
                shopCreationState.set(interaction.user.id, state);

                const modal = new ModalBuilder()
                    .setCustomId("shop_create_modal")
                    .setTitle("Créer un item shop");

                const name = new TextInputBuilder()
                    .setCustomId("name")
                    .setLabel("Nom")
                    .setStyle(TextInputStyle.Short);

                const desc = new TextInputBuilder()
                    .setCustomId("description")
                    .setLabel("Description")
                    .setStyle(TextInputStyle.Paragraph);

                const price = new TextInputBuilder()
                    .setCustomId("price")
                    .setLabel("Prix")
                    .setStyle(TextInputStyle.Short);

                const duration = new TextInputBuilder()
                    .setCustomId("duration")
                    .setLabel("Durée (jours) - 0 = permanent")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(name),
                    new ActionRowBuilder().addComponents(desc),
                    new ActionRowBuilder().addComponents(price),
                    new ActionRowBuilder().addComponents(duration)
                );

                return interaction.showModal(modal);
            }
        }

        // ---------- MODAL SUBMIT ----------
        if (interaction.isModalSubmit()) {
            if (interaction.customId === "shop_create_modal") {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: "❌ Interdit", ephemeral: true });
                }

                const state = shopCreationState.get(interaction.user.id);
                if (!state || !state.roleId) {
                    return interaction.reply({ content: "❌ Données incomplètes", ephemeral: true });
                }

                const shop = loadShop();

                const item = {
                    id: Date.now().toString(),
                    name: interaction.fields.getTextInputValue("name"),
                    description: interaction.fields.getTextInputValue("description"),
                    price: parseInt(interaction.fields.getTextInputValue("price")),
                    roleId: state.roleId,
                    type: state.type,
                    duration: interaction.fields.getTextInputValue("duration") ? parseInt(interaction.fields.getTextInputValue("duration")) : null
                };

                if (!interaction.guild.roles.cache.has(item.roleId)) {
                    return interaction.reply({ content: "❌ Rôle invalide", ephemeral: true });
                }

                shop.items.push(item);
                saveShop(shop);

                shopCreationState.delete(interaction.user.id);

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#00ff88")
                            .setTitle("🛒 Item créé")
                            .addFields(
                                { name: "Nom", value: item.name },
                                { name: "Type", value: item.type },
                                { name: "Prix", value: `${item.price}` },
                                { name: "Durée", value: item.duration ? `${item.duration} jours` : "Permanent" },
                                { name: "Rôle", value: `<@&${item.roleId}>` }
                            )
                    ],
                    ephemeral: true
                });
            }
        }

        // ---------- COMMAND: say ----------
        if (interaction.isCommand() && interaction.commandName === 'say') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const messageToSend = interaction.options.getString('message');
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff88')
                        .setTitle('✅ Message envoyé')
                        .setDescription('Le message a été envoyé avec succès.')
                        .setTimestamp()
                ],
                ephemeral: true
            });

            await interaction.channel.send(messageToSend).catch(() => {});
            return;
        }

        // ---------- COMMAND: lock ----------
        if (interaction.isCommand() && interaction.commandName === 'lock') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔒 Salon verrouillé')
                        .setDescription(`${interaction.channel} a été verrouillé.`)
                        .setFooter({ text: `Par ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });
            return;
        }

        // ---------- COMMAND: unlock ----------
        if (interaction.isCommand() && interaction.commandName === 'unlock') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff88')
                        .setTitle('🔓 Salon déverrouillé')
                        .setDescription(`${interaction.channel} a été déverrouillé.`)
                        .setFooter({ text: `Par ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });
            return;
        }

        // ---------- COMMAND: poll ----------
        if (interaction.isCommand() && interaction.commandName === 'poll') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const question = interaction.options.getString('question');
            const msg = await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📊 Nouveau sondage')
                        .setDescription(`>>> ${question}`)
                        .setFooter({ text: `Créé par ${interaction.user.tag}` })
                        .setTimestamp()
                ],
                fetchReply: true
            });

            await msg.react('✅').catch(() => {});
            await msg.react('❌').catch(() => {});
            return;
        }

        // ---------- COMMAND: panel ----------
        if (interaction.isCommand() && interaction.commandName === 'panel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const panelEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🛠️ Panel staff avancé')
                .setDescription('Utilise ce panneau pour accéder aux outils de modération et au support avancé.')
                .setTimestamp();

            const infoButton = new ButtonBuilder().setCustomId('staff_info_server').setLabel('Infos serveur').setEmoji('🖥️').setStyle(ButtonStyle.Secondary);
            const warnButton = new ButtonBuilder().setCustomId('staff_warn_menu').setLabel('Warns').setEmoji('⚠️').setStyle(ButtonStyle.Secondary);
            const lockdownButton = new ButtonBuilder().setCustomId('staff_lockdown').setLabel('Lockdown').setEmoji('🔒').setStyle(ButtonStyle.Secondary);
            const logsButton = new ButtonBuilder().setCustomId('staff_logs').setLabel('Logs').setEmoji('📁').setStyle(ButtonStyle.Secondary);
            const ticketsButton = new ButtonBuilder().setCustomId('staff_tickets').setLabel('Tickets').setEmoji('🎫').setStyle(ButtonStyle.Secondary);
            const userinfoButton = new ButtonBuilder().setCustomId('staff_userinfo').setLabel('Userinfo').setEmoji('👤').setStyle(ButtonStyle.Secondary);
            const panelSendButton = new ButtonBuilder().setCustomId('staff_ticket_panel_send').setLabel('Envoyer panel tickets').setEmoji('📢').setStyle(ButtonStyle.Primary);

            const row1 = new ActionRowBuilder().addComponents(infoButton, warnButton, lockdownButton);
            const row2 = new ActionRowBuilder().addComponents(logsButton, ticketsButton, userinfoButton);
            const row3 = new ActionRowBuilder().addComponents(panelSendButton);

            await interaction.reply({ embeds: [panelEmbed], components: [row1, row2, row3], ephemeral: true });
            return;
        }

        // ---------- COMMAND: warn ----------
        if (interaction.isCommand() && interaction.commandName === 'warn') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const membre = interaction.options.getUser('membre');
            const raison = interaction.options.getString('raison');

            if (!membre) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            const warns = loadWarns();
            if (!warns[membre.id]) warns[membre.id] = [];

            warns[membre.id].push({ raison, date: new Date().toLocaleString() });
            saveWarns(warns);

            const memberToWarn = await interaction.guild.members.fetch(membre.id).catch(() => null);
            if (memberToWarn) {
                await handleWarnEscalation(memberToWarn, warns, interaction);
            }

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setAuthor({ name: membre.tag, iconURL: membre.displayAvatarURL() })
                .setTitle('⚠️ Avertissement reçu')
                .setDescription(`Le membre a reçu un avertissement.`)
                .addFields(
                    { name: '👤 Membre', value: `${membre}`, inline: true },
                    { name: '🛡️ Modérateur', value: `${interaction.user}`, inline: true },
                    { name: '📊 Total Warns', value: `${warns[membre.id].length}`, inline: true },
                    { name: '📝 Raison', value: raison }
                )
                .setThumbnail(membre.displayAvatarURL())
                .setFooter({ text: `Rise Of Alpha Security • Modération` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            return;
        }

        // ---------- COMMAND: warnings ----------
        if (interaction.isCommand() && interaction.commandName === 'warnings') {
            const membre = interaction.options.getUser('membre');
            if (!membre) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            const warns = loadWarns();

            if (!warns[membre.id] || warns[membre.id].length === 0) {
                const noWarnEmbed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('✅ Aucun avertissement')
                    .setDescription(`${membre} n'a aucun warn.`)
                    .setThumbnail(membre.displayAvatarURL())
                    .setFooter({ text: `Rise Of Alpha Security` })
                    .setTimestamp();

                return interaction.reply({ embeds: [noWarnEmbed] });
            }

            const liste = warns[membre.id]
                .map((w, i) =>
                    `> ⚠️ **Warn ${i + 1}**\n> 📝 ${w.raison}\n> 📅 ${w.date}`
                )
                .join('\n\n');

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setAuthor({ name: membre.tag, iconURL: membre.displayAvatarURL() })
                .setTitle('📋 Liste des avertissements')
                .setDescription(liste)
                .setThumbnail(membre.displayAvatarURL())
                .addFields({ name: '📊 Nombre total', value: `${warns[membre.id].length}`, inline: true })
                .setFooter({ text: `Demandé par ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---------- COMMAND: unwarn ----------
        if (interaction.isCommand() && interaction.commandName === 'unwarn') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const membre = interaction.options.getUser('membre');
            if (!membre) {
                return interaction.reply({ content: '❌ Membre introuvable', ephemeral: true });
            }

            const warns = loadWarns();
            if (!warns[membre.id] || warns[membre.id].length === 0) {
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#00ff88')
                            .setTitle('✅ Aucun warn')
                            .setDescription(`${membre} n'a aucun warn.`)
                    ],
                    ephemeral: true
                });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`unwarn_${membre.id}`)
                .setPlaceholder('Choisis un warn')
                .addOptions(
                    warns[membre.id].map((w, i) => ({
                        label: `Warn ${i + 1}`,
                        description: w.raison.slice(0, 100),
                        value: `${i}`
                    }))
                );

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('🗑️ Suppression de warn')
                        .setDescription(`Sélectionne un warn à supprimer pour ${membre}`)
                        .setThumbnail(membre.displayAvatarURL())
                        .setTimestamp()
                ],
                components: [row],
                ephemeral: true
            });
            return;
        }

        // ---------- COMMAND: avatar ----------
        if (interaction.isCommand() && interaction.commandName === 'avatar') {
            const membre = interaction.options.getUser('membre') || interaction.user;
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`🖼️ Avatar de ${membre.tag}`)
                        .setImage(membre.displayAvatarURL({ size: 4096 }))
                ]
            });
        }

        // ---------- COMMAND: serverinfo ----------
        if (interaction.isCommand() && interaction.commandName === 'serverinfo') {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🌐 Informations serveur')
                        .setThumbnail(interaction.guild.iconURL())
                        .addFields(
                            { name: '📛 Nom', value: interaction.guild.name, inline: true },
                            { name: '👥 Membres', value: `${interaction.guild.memberCount}`, inline: true },
                            { name: '🆔 ID', value: interaction.guild.id }
                        )
                        .setTimestamp()
                ]
            });
        }

        // ---------- COMMAND: lockdown ----------
        if (interaction.isCommand() && interaction.commandName === 'lockdown') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const channels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);

            for (const channel of channels.values()) {
                try {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
                } catch (err) {
                    console.log(`Erreur avec ${channel.name}`);
                }
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🔒 Lockdown activé')
                        .setDescription('Tous les salons textuels ont été verrouillés.')
                        .setTimestamp()
                ]
            });
            return;
        }

        // ---------- COMMAND: unlockdown ----------
        if (interaction.isCommand() && interaction.commandName === 'unlockdown') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const channels = interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildText);

            for (const channel of channels.values()) {
                try {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
                } catch (err) {
                    console.log(`Erreur avec ${channel.name}`);
                }
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff88')
                        .setTitle('🔓 Lockdown désactivé')
                        .setDescription('Tous les salons textuels ont été déverrouillés.')
                        .setTimestamp()
                ]
            });
            return;
        }

        // ---------- COMMAND: suggest ----------
        if (interaction.isCommand() && interaction.commandName === 'suggest') {
            const suggestion = interaction.options.getString('suggestion');
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('💡 Nouvelle suggestion')
                .setDescription(suggestion)
                .addFields(
                    { name: '👤 Auteur', value: `${interaction.user}`, inline: true },
                    { name: '📍 Serveur', value: interaction.guild.name, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
            await msg.react('👍').catch(() => {});
            await msg.react('👎').catch(() => {});
            return;
        }

        // ---------- COMMAND: userinfo ----------
        if (interaction.isCommand() && interaction.commandName === 'userinfo') {
            const user = interaction.options.getUser('membre') || interaction.user;
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('👤 Informations utilisateur')
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: 'Pseudo', value: `${user.tag}`, inline: true },
                    { name: 'ID', value: `${user.id}`, inline: true },
                    { name: 'Serveur rejoint le', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Inconnu', inline: false },
                    { name: 'Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ---------- COMMAND: setlogs ----------
        if (interaction.isCommand() && interaction.commandName === 'setlogs') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: '❌ Tu dois être administrateur.', ephemeral: true });
            }

            const channel = interaction.options.getChannel('salon');
            if (!channel) {
                return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });
            }

            const logs = loadLogs();
            logs[interaction.guild.id] = channel.id;
            saveLogs(logs);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#00ff88')
                        .setTitle('📁 Salon logs défini')
                        .setDescription(`Logs envoyés dans ${channel}`)
                ],
                ephemeral: true
            });
        }

        // ---------- COMMAND: setai ----------
        if (interaction.isCommand() && interaction.commandName === 'setai') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({
                    content: '❌ Admin requis',
                    ephemeral: true
                });
            }

            const channel = interaction.options.getChannel('salon');
            const ai = loadAI();

            ai[interaction.guild.id] = channel.id;
            saveAI(ai);

            // Message de bienvenue optionnel
            const guildChannel = interaction.guild.channels.cache.get(channel.id);
            if (guildChannel) {
                guildChannel.send("🧠 **IA activée** — posez vos questions ici.").catch(() => {});
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🧠 IA configurée')
                        .setDescription(`Salon IA défini sur ${channel}`)
                ],
                ephemeral: true
            });
        }

        // ---------- COMMAND: credits ----------
        if (interaction.isCommand() && interaction.commandName === 'credits') {
            const target = interaction.options.getUser('user') || interaction.user;
            const credits = getCredits(interaction.guild.id, target.id);

            return interaction.reply({
                content: `💰 ${target.tag} possède **${credits} crédits**`
            });
        }

        // ---------- COMMAND: pay ----------
        if (interaction.isCommand() && interaction.commandName === 'pay') {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            const ok = removeCredits(interaction.guild.id, interaction.user.id, amount);
            if (!ok) return interaction.reply({ content: "❌ Pas assez de crédits", ephemeral: true });

            addCredits(interaction.guild.id, user.id, amount);

            return interaction.reply(`💸 Transfert de ${amount} crédits à ${user.tag}`);
        }

        // ---------- COMMAND: shopcreate ----------
        if (interaction.commandName === "shopcreate") {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.reply({ content: "❌ Interdit", ephemeral: true });
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId("shop_type_select")
                .setPlaceholder("Choisir le type d'item")
                .addOptions(
                    { label: "Rôle permanent", value: "role" },
                    { label: "Rôle temporaire", value: "temp_role" }
                );

            return interaction.reply({
                content: "🛒 Création d'un item shop",
                components: [new ActionRowBuilder().addComponents(menu)],
                ephemeral: true
            });
        }

        // ---------- COMMAND: buy ----------
        if (interaction.commandName === "buy") {
            const id = interaction.options.getString("item");
            const shop = loadShop();
            const item = shop.items.find(i => i.id === id);

            if (!item) {
                return interaction.reply({ content: "❌ Item introuvable", ephemeral: true });
            }

            const userEco = getUserEco(interaction.guild.id, interaction.user.id);

            if (userEco.wallet < item.price) {
                return interaction.reply({ content: "❌ Pas assez de crédits", ephemeral: true });
            }

            removeMoney(interaction.guild.id, interaction.user.id, item.price, `achat_${item.id}`);

            if (item.type === "role" || item.type === "temp_role") {
                const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                if (member && item.roleId) {
                    await member.roles.add(item.roleId).catch(() => {});
                }

                if (item.type === "temp_role" && item.duration) {
                    const ms = item.duration * 24 * 60 * 60 * 1000;
                    setTimeout(async () => {
                        const fresh = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                        if (!fresh) return;
                        if (item.roleId) {
                            await fresh.roles.remove(item.roleId).catch(() => {});
                        }
                    }, ms);
                }
            }

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#00ff88")
                        .setTitle("🛍️ Achat réussi")
                        .setDescription(`Tu as acheté **${item.name}**`)
                ]
            });
        }

        // ---------- COMMAND: ticket-ai-analyze ----------
        if (interaction.isCommand() && interaction.commandName === 'ticket-ai-analyze') {
            const channel = interaction.channel;
            const ticketAI = loadTicketAI();
            const data = ticketAI[channel.id];

            if (!data) {
                return interaction.reply({ content: "❌ Pas un ticket IA", ephemeral: true });
            }

            const lastMessages = data.messages.slice(-10).map(m => m.content).join("\n");

            const fakeAIResponse = `🧠 Analyse IA :
- Problème détecté : support utilisateur
- Solution proposée : redémarrage procédure
- Niveau : faible`;

            data.suggestedResponse = fakeAIResponse;
            data.status = "awaiting_staff_validation";
            saveTicketAI(ticketAI);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('🤖 Proposition IA')
                        .setDescription(fakeAIResponse)
                ]
            });
        }

        // ---------- BUTTON: ticket_close_request ----------
        if (interaction.customId === 'ticket_close_request') {
            return interaction.reply({
                content: "⛔ Demande de fermeture envoyée au staff. En attente de validation.",
                ephemeral: true
            });
        }

        // ---------- BUTTON: ticket_request_human ----------
        if (interaction.customId === 'ticket_request_human') {
            const ticketAI = loadTicketAI();
            if (ticketAI[interaction.channel.id]) {
                ticketAI[interaction.channel.id].status = "human_only";
                saveTicketAI(ticketAI);
            }

            return interaction.reply({
                content: "🧑 Un staff a été demandé. L'IA est désactivée.",
                ephemeral: true
            });
        }

        // ---------- BUTTON: ticket_change_staff ----------
        if (interaction.customId === 'ticket_change_staff') {
            return interaction.reply({
                content: "🔄 Demande de changement de staff envoyée.",
                ephemeral: true
            });
        }
    } catch (err) {
        console.error('Erreur interactionCreate:', err);
        if (interaction && !interaction.replied) {
            try {
                await interaction.reply({ content: 'Une erreur est survenue lors du traitement de la commande.', ephemeral: true });
            } catch {}
        }
    }
});

client.login(process.env.TOKEN);