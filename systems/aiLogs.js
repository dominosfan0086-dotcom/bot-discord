const fs = require("fs");

const file = "./data/aiLogs.json";

function logAI(entry) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");

    const db = JSON.parse(fs.readFileSync(file, "utf8"));

    const id = Date.now();

    db[id] = {
        ...entry,
        date: new Date().toISOString()
    };

    fs.writeFileSync(file, JSON.stringify(db, null, 2));
}

module.exports = { logAI };
