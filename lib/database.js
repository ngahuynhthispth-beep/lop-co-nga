const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let db;
let isPostgres = false;

if (process.env.DATABASE_URL) {
    db = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    isPostgres = true;
    console.log('--- KẾT NỐI CLOUD: Đã kết nối cơ sở dữ liệu PostgreSQL ---');
    initDb();
} else {
    const dbPath = path.resolve(__dirname, '../data.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Lỗi kết nối SQLite:', err.message);
        else {
            console.log('--- KẾT NỐI LOCAL: Đã kết nối cơ sở dữ liệu SQLite ---');
            initDb();
        }
    });
}

const dbWrapper = {
    all: (sql, params, cb) => {
        if (isPostgres) {
            let count = 0;
            const finalSql = sql.replace(/\?/g, () => `$${++count}`);
            db.query(finalSql, params, (err, res) => cb(err, res ? res.rows : null));
        } else {
            db.all(sql, params, cb);
        }
    },
    get: (sql, params, cb) => {
        if (isPostgres) {
            let count = 0;
            const finalSql = sql.replace(/\?/g, () => `$${++count}`);
            db.query(finalSql, params, (err, res) => cb(err, res && res.rows.length > 0 ? res.rows[0] : null));
        } else {
            db.get(sql, params, cb);
        }
    },
    run: function(sql, params, cb) {
        if (isPostgres) {
            let count = 0;
            let finalSql = sql.replace(/\?/g, () => `$${++count}`);
            
            // Tự động thêm RETURNING id cho câu lệnh INSERT
            if (finalSql.trim().toUpperCase().startsWith('INSERT')) {
                finalSql += ' RETURNING id';
            }

            db.query(finalSql, params, (err, res) => {
                const mockThis = { 
                    lastID: res && res.rows.length > 0 ? res.rows[0].id : null,
                    changes: res ? res.rowCount : 0
                };
                if (cb) cb.call(mockThis, err);
            });
        } else {
            db.run(sql, params, cb);
        }
    }
};

function initDb() {
    const studentTable = isPostgres 
        ? `CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, name TEXT NOT NULL, total_stars INTEGER DEFAULT 0)`
        : `CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, total_stars INTEGER DEFAULT 0)`;
    
    const submissionTable = isPostgres
        ? `CREATE TABLE IF NOT EXISTS submissions (id SERIAL PRIMARY KEY, student_id INTEGER, type TEXT, file_paths TEXT, stars INTEGER, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
        : `CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, type TEXT, file_paths TEXT, stars INTEGER, comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`;

    if (isPostgres) {
        db.query(studentTable)
            .then(() => db.query(submissionTable))
            .then(() => db.query("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_paths TEXT"))
            .then(() => seedStudents())
            .catch(err => console.error('Lỗi khởi tạo DB Cloud:', err));
    } else {
        db.serialize(() => {
            db.run(studentTable);
            db.run(submissionTable);
            // Migration cho SQLite (bỏ qua lỗi nếu cột đã tồn tại)
            db.run("ALTER TABLE submissions ADD COLUMN file_paths TEXT", (err) => {});
            seedStudents();
        });
    }
}

function seedStudents() {
    dbWrapper.get("SELECT COUNT(*) AS count FROM students", [], (err, row) => {
        const count = isPostgres ? (row ? parseInt(row.count) : 0) : (row ? row.count : 0);
        if (count === 0) {
            const txtPath = path.resolve(__dirname, '../students.txt');
            let lines = [];
            if (fs.existsSync(txtPath)) {
                const content = fs.readFileSync(txtPath, 'utf8');
                lines = content.split('\n').map(l => l.trim()).filter(l => l !== "");
            } else {
                for (let i = 1; i <= 38; i++) lines.push(`Học sinh ${i}`);
            }

            lines.forEach(name => {
                dbWrapper.run("INSERT INTO students (name) VALUES (?)", [name]);
            });
            console.log(`Đã khởi tạo xong danh sách ${lines.length} học sinh.`);
        }
    });
}

module.exports = dbWrapper;
