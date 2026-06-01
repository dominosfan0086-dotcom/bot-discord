const fs = require("fs");

function getStats() {
    const db = JSON.parse(fs.readFileSync("./data/tickets.json", "utf8"));

    const total = Object.keys(db).length;

    const priorities = {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0
    };

    for (const t of Object.values(db)) {
        priorities[t.priority]++;
    }

    return { total, priorities };
}

module.exports = { getStats };
