const { analyzeSituation } = require("../ai/moderationAI");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "analyse",
    async execute(interaction) {

        const input = interaction.options.getString("situation");

        const result = await analyzeSituation(input, []);

        if (!result) {
            return interaction.reply({
                content: "❌ IA indisponible",
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(
                result.risk === "severe"
                    ? "#ff0000"
                    : result.risk === "high"
                    ? "#ff6600"
                    : "#ffaa00"
            )
            .setTitle("🧠 Analyse IA")
            .addFields(
                { name: "Risque", value: result.risk },
                { name: "Action", value: result.sanction },
                { name: "Durée", value: result.duration || "Aucune" },
                { name: "Raison", value: result.reason }
            );

        return interaction.reply({ embeds: [embed] });
    }
};
