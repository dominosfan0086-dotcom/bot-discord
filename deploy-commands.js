require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const commands = [

    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Faire parler le bot')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouiller le salon'),

    new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Déverrouiller le salon'),

    new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Créer un sondage')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Question')
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Afficher le panel staff avancé'),

    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn un membre')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('raison')
            .setDescription('Raison')
            .setRequired(true)
    ),

    new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Voir les warns')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Supprimer un warn')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('raison')
            .setDescription('Raison')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Informations utilisateur')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Afficher un avatar')
    .addUserOption(option =>
        option
            .setName('membre')
            .setDescription('Membre')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Informations serveur'),

new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Verrouiller tous les salons'),

new SlashCommandBuilder()
    .setName('unlockdown')
    .setDescription('Déverrouiller tous les salons'),

new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Définir le salon logs')
    .addChannelOption(option =>
        option
            .setName('salon')
            .setDescription('Salon logs')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Faire une annonce')
    .addStringOption(option =>
        option
            .setName('message')
            .setDescription('Annonce')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Faire une suggestion')
    .addStringOption(option =>
        option
            .setName('suggestion')
            .setDescription('Suggestion')
            .setRequired(true)
    ),
    new SlashCommandBuilder()
    .setName('mutetemp')
    .setDescription('Mute temporaire')
    .addUserOption(option =>
        option.setName('membre').setDescription('Membre').setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('heures').setDescription('Durée en heures').setRequired(true)
    )
    .addStringOption(option =>
        option.setName('raison').setDescription('Raison')
    ),

new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute un membre')
    .addUserOption(option =>
        option.setName('membre').setDescription('Membre').setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('bantemp')
    .setDescription('Quarantaine temporaire')
    .addUserOption(option =>
        option.setName('membre').setDescription('Membre').setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName('heures').setDescription('Durée en heures').setRequired(true)
    )
    .addStringOption(option =>
        option.setName('raison').setDescription('Raison')
    ),

new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Retire la quarantaine')
    .addUserOption(option =>
        option.setName('membre').setDescription('Membre').setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('setai')
    .setDescription('Définit le salon IA du serveur')
    .addChannelOption(option =>
        option.setName('salon')
            .setDescription('Salon IA')
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName('eco_add')
    .setDescription('Ajouter des crédits (Admin)')
    .addUserOption(option => option.setName('user').setDescription('Utilisateur').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Montant').setRequired(true)),

new SlashCommandBuilder()
    .setName('eco_remove')
    .setDescription('Retirer des crédits (Admin)')
    .addUserOption(option => option.setName('user').setDescription('Utilisateur').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Montant').setRequired(true)),

new SlashCommandBuilder()
    .setName('eco_reset')
    .setDescription('Réinitialiser les crédits (Admin)')
    .addUserOption(option => option.setName('user').setDescription('Utilisateur').setRequired(true)),

new SlashCommandBuilder()
    .setName('eco_top')
    .setDescription('Classement économie'),

new SlashCommandBuilder()
    .setName('eco_fine')
    .setDescription('Amende économique (Staff)')
    .addUserOption(option => option.setName('user').setDescription('Utilisateur').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Montant').setRequired(true)),

new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Voir la boutique'),

new SlashCommandBuilder()
    .setName('shop_add')
    .setDescription('Ajouter un item (Admin)')
    .addStringOption(option => option.setName('id').setDescription('ID unique').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('Nom').setRequired(true))
    .addIntegerOption(option => option.setName('price').setDescription('Prix').setRequired(true)),

new SlashCommandBuilder()
    .setName('shop_remove')
    .setDescription('Supprimer un item (Admin)')
    .addStringOption(option => option.setName('id').setDescription('ID de l\'item').setRequired(true)),

new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Acheter un item')
    .addStringOption(option => option.setName('item').setDescription('ID de l\'item').setRequired(true)),

new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Voir son portefeuille'),

new SlashCommandBuilder()
    .setName('history')
    .setDescription('Historique des transactions'),

new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transférer de l\'argent')
    .addUserOption(option => option.setName('membre').setDescription('Destinataire').setRequired(true))
    .addIntegerOption(option => option.setName('montant').setDescription('Montant').setRequired(true)),

new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Voir son inventaire'),

new SlashCommandBuilder()
    .setName('shopcreate')
    .setDescription('Créer un item shop (Admin)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' })
.setToken(process.env.TOKEN);

(async () => {

    try {

        console.log('⏳ Enregistrement des commandes...');

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                '1364143160263049248'
            ),
            { body: commands }
        );

        console.log('✅ Commandes enregistrées.');

    } catch (error) {
        console.error(error);
    }
})();