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
        console.warn("⚠️ Nộp bài thất bại: Thiếu student_id hoặc urls", req.body);
        return res.status(400).json({ error: "Thiếu thông tin nộp bài hoặc Link bài tập." });
    }

    const type = urls.toLowerCase().match(/\.(mp4|webm|ogg|mov)/) ? 'video' : 'image';
    
    const insertQuery = "INSERT INTO submissions (student_id, type, file_paths) VALUES (?, ?, ?)";
    
    db.run(insertQuery, [student_id, type, urls], function(err) {
        if (err) {
            console.error("❌ Lỗi INSERT bài tập:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`✅ Đã nhận bài nộp từ StudentID: ${student_id}`);
        res.json({ message: "Đã lưu bài tập lên hệ thống thành công!" });
    });
});

// API: Chấm bài (Giáo viên)
app.post('/api/grade', (req, res) => {
    const { id, ids, stars } = req.body;
    const targetIds = ids || [id]; // Hỗ trợ cả 1 ID hoặc 1 mảng ID
    let comment = "";
    
    // ... lời phê và xử lý SQL cho mảng ID
    if (stars >= 3 && stars <= 5) comment = "Con cần cố gắng hơn.";
    else if (stars > 5 && stars <= 7) comment = "Con đã biết tự học.";
    else if (stars > 7 && stars <= 10) comment = "Con giỏi lắm, cần phát huy nhé!";

    // 1. Cập nhật tất cả các bản ghi submissions trong nhóm
    const updateSubmissionsQuery = "UPDATE submissions SET stars = ?, comment = ? WHERE id IN (" + targetIds.map(() => "?").join(",") + ")";
    
    db.run(updateSubmissionsQuery, [stars, comment, ...targetIds], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // 2. Chỉ cộng sao cho học sinh 1 LẦN duy nhất cho cả nhóm bài này
        db.get("SELECT student_id FROM submissions WHERE id = ?", [targetIds[0]], (err, row) => {
            if (row) {
                db.run("UPDATE students SET total_stars = total_stars + ? WHERE id = ?", [stars, row.student_id], (err) => {
                    if (err) console.error("Lỗi cập nhật tổng sao:", err.message);
                });
            }
        });

        res.json({ message: "Chấm xong " + targetIds.length + " bài!", stars, comment });
    });
});

// API: Bảng tin lớp học (Bài đã chấm)
// API: Bảng tin lớp học (Bài đã chấm)
app.get('/api/wall', (req, res) => {
    const wallQuery = `
        SELECT s.id, s.file_paths, s.type, s.stars, s.comment, s.created_at, st.name as student_name 
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
        SELECT s.id, s.file_paths, s.type, st.name as student_name, s.created_at
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

// API: Bảng vàng (Top 15 học sinh nhiều sao nhất)
app.get('/api/leaderboard', (req, res) => {
    const query = "SELECT id, name, total_stars FROM students WHERE total_stars > 0 ORDER BY total_stars DESC LIMIT 15";
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
    // Chạy dọn dẹp lần đầu khi khởi động
    cleanupOldSubmissions();
});

// --- HỆ THỐNG TỰ ĐỘNG DỌN DẸP (CLEANUP) ---
function cleanupOldSubmissions() {
    console.log("🧹 Đang kiểm tra và dọn dẹp bài tập cũ (> 24h)...");
    
    // Tính toán thời điểm cách đây 24 giờ (định dạng YYYY-MM-DD HH:MM:SS để khớp SQLite)
    const now = new Date();
    const boxDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 19);
    
    // 1. Tìm các bài nộp cũ để xóa tệp tin vật lý trước
    const findOldQuery = "SELECT file_paths FROM submissions WHERE created_at < ?";
    
    db.all(findOldQuery, [boxDate], (err, rows) => {
        if (err) return console.error("Lỗi tìm bài cũ:", err.message);
        
        rows.forEach(row => {
            if (row.file_paths) {
                const paths = row.file_paths.split(',');
                paths.forEach(filePath => {
                    // Chỉ xóa nếu là tệp cục bộ (bắt đầu bằng uploads/)
                    if (filePath.startsWith('uploads/')) {
                        const fullPath = path.join(__dirname, filePath);
                        if (fs.existsSync(fullPath)) {
                            try {
                                fs.unlinkSync(fullPath);
                                console.log(`🗑️ Đã xóa tệp: ${filePath}`);
                            } catch (e) {
                                console.error(`❌ Không thể xóa tệp ${filePath}:`, e.message);
                            }
                        }
                    }
                });
            }
        });

        // 2. Xóa bản ghi trong Database
        const deleteQuery = "DELETE FROM submissions WHERE created_at < ?";
        db.run(deleteQuery, [boxDate], function(err) {
            if (err) return console.error("Lỗi xóa DB:", err.message);
            if (this.changes > 0) {
                console.log(`✅ Đã dọn dẹp xong ${this.changes} bài tập cũ.`);
            }
        });
    });
}

// Chạy dọn dẹp định kỳ mỗi 1 tiếng (3600000 ms)
setInterval(cleanupOldSubmissions, 3600000);
