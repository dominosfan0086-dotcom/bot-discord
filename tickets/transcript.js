const fs = require("fs");

// Module pour gérer les transcriptions de tickets

function saveTranscript(channelId, messages) {
    const transcriptFile = `./data/transcripts/${channelId}.txt`;
    const dir = "./data/transcripts";
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    let transcript = `=== Transcript for Ticket ${channelId} ===\n`;
    transcript += `Created: ${new Date().toLocaleString()}\n\n`;
    
    for (const msg of messages) {
        transcript += `[${new Date(msg.createdTimestamp).toLocaleTimeString()}] ${msg.author.username}: ${msg.content}\n`;
    }
    
    fs.writeFileSync(transcriptFile, transcript);
}

module.exports = {
    saveTranscript
};
