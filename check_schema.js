const db = require('./lib/database');

db.all("PRAGMA table_info(submissions)", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Submissions Schema:");
        rows.forEach(r => console.log(r.name, r.type));
    }
});
