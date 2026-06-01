const fs = require("fs");

const file = "./data/nicknames.json";

function load() {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function trackNickname(oldMember, newMember) {
    const db = load();

    const id = newMember.id;
    const oldNick = oldMember.user.username;
    const newNick = newMember.user.username;

    if (!db[id]) db[id] = [];

    if (oldNick !== newNick) {
        db[id].push({
            old: oldNick,
            new: newNick,
            date: Date.now()
        });

        save(db);
    }
}

function getHistory(userId) {
    return load()[userId] || [];
}

module.exports = {
    trackNickname,
    getHistory
};
