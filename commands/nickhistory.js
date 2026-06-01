const { getHistory } = require("../systems/nicknameTracker");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "nickhistory",
    async execute(interaction) {

        const user = interaction.options.getUser("membre") || interaction.user;
        const history = getHistory(user.id);

        if (history.length === 0) {
            return interaction.reply({
                content: "❌ Aucun historique trouvé.",
                ephemeral: true
            });
        }

        const list = history
            .slice(-10)
            .map(
                (h, i) =>
                    `**${i + 1}.** ${h.old} ➜ ${h.new} ()`
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle(`👤 Historique des pseudos`)
            .setDescription(list)
            .setFooter({
                text: `Utilisateur : ${user.tag}`
            });

        return interaction.reply({ embeds: [embed] });
    }
};
