const fs = require("fs");

const file = "./data/tickets.json";

function load() {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "{}");
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function createTicket(userId, channelId, category) {
    const db = load();

    db[channelId] = {
        userId,
        category,
        createdAt: Date.now(),
        priority: "normal",
        assigned: null,
        notes: []
    };

    save(db);
}

function setPriority(channelId, priority) {
    const db = load();
    if (!db[channelId]) return;

    db[channelId].priority = priority;
    save(db);
}

function assignStaff(channelId, staffId) {
    const db = load();
    if (!db[channelId]) return;

    db[channelId].assigned = staffId;
    save(db);
}

function addNote(channelId, note) {
    const db = load();
    if (!db[channelId]) return;

    db[channelId].notes.push({
        note,
        date: Date.now()
    });

    save(db);
}

function getTicket(channelId) {
    return load()[channelId];
}

function closeTicket(channelId) {
    const db = load();
    delete db[channelId];
    save(db);
}

module.exports = {
    createTicket,
    setPriority,
    assignStaff,
    addNote,
    getTicket,
    closeTicket
};
