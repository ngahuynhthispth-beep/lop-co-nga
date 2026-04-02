const db = require('./lib/database');

console.log("Checking students...");
db.all("SELECT * FROM students", [], (err, rows) => {
    if (err) console.error(err);
    else console.log("Students:", rows.length);
});

console.log("Checking submissions...");
db.all("SELECT * FROM submissions", [], (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Total Submissions:", rows.length);
        rows.forEach(r => console.log(r));
    }
});
