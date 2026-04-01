const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./lib/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình lưu trữ tệp tin
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// API: Lấy danh sách học sinh
app.get('/api/students', (req, res) => {
    db.all("SELECT * FROM students", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Nộp bài (Học sinh) - Cho phép nhiều file
// API: Nộp bài (Học sinh) - Cho phép nhiều file
// API: Nộp bài (Học sinh) - Nhận Link từ Đám mây
app.post('/api/upload', (req, res) => {
    const { student_id, urls } = req.body;

    if (!student_id || !urls) {
        return res.status(400).json({ error: "Thiếu thông tin nộp bài hoặc Link bài tập." });
    }

    const type = urls.toLowerCase().match(/\.(mp4|webm|ogg|mov)/) ? 'video' : 'image';
    
    const insertQuery = "INSERT INTO submissions (student_id, type, file_paths) VALUES (?, ?, ?)";
    
    db.run(insertQuery, [student_id, type, urls], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Đã lưu bài tập lên hệ thống thành công!" });
    });
});

// API: Chấm bài (Giáo viên)
app.post('/api/grade', (req, res) => {
    const { id, stars } = req.body;
    let comment = "";

    // Logic lời phê tự động
    if (stars >= 3 && stars <= 5) comment = "Con cần cố gắng hơn.";
    else if (stars > 5 && stars <= 7) comment = "Con đã biết tự học.";
    else if (stars > 7 && stars <= 10) comment = "Con giỏi lắm, cần phát huy nhé!";

    const query = "UPDATE submissions SET stars = ?, comment = ? WHERE id = ?";
    db.run(query, [stars, comment, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Cập nhật tổng sao cho học sinh (Ví dụ đơn giản: cộng dồn)
        db.get("SELECT student_id FROM submissions WHERE id = ?", [id], (err, row) => {
            if (row) {
                db.run("UPDATE students SET total_stars = total_stars + ? WHERE id = ?", [stars, row.student_id]);
            }
        });

        res.json({ message: "Chấm bài thành công!", stars, comment });
    });
});

// API: Bảng tin lớp học (Bài đã chấm)
// API: Bảng tin lớp học (Bài đã chấm)
app.get('/api/wall', (req, res) => {
    const wallQuery = `
        SELECT s.id, COALESCE(s.file_paths, s.file_path) as file_paths, s.type, s.stars, s.comment, s.created_at, st.name as student_name 
        FROM submissions s
        JOIN students st ON s.student_id = st.id
        WHERE s.stars IS NOT NULL
        ORDER BY s.created_at DESC
    `;
    db.all(wallQuery, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Bài chưa chấm (Dành cho giáo viên)
app.get('/api/pending', (req, res) => {
    const query = `
        SELECT s.id, COALESCE(s.file_paths, s.file_path) as file_paths, s.type, st.name as student_name, s.created_at
        FROM submissions s
        JOIN students st ON s.student_id = st.id
        WHERE s.stars IS NULL
        ORDER BY s.created_at ASC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API: Bảng vàng (Top 10 học sinh nhiều sao nhất)
app.get('/api/leaderboard', (req, res) => {
    const query = "SELECT id, name, total_stars FROM students WHERE total_stars > 0 ORDER BY total_stars DESC LIMIT 10";
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
});
