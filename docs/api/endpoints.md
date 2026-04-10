# API Documentation
Ngày cập nhật: 02-04-2026
Base URL: http://localhost:3000 (Local) | https://lop-co-nga.onrender.com (Production)

---

## 🏫 Học sinh & Lớp học
### GET /api/students
Lấy danh sách 38 bạn nhỏ, bao gồm tên và tổng số sao.

### GET /api/leaderboard
Bảng vàng - Top 15 học sinh có số sao cao nhất lớp.

### GET /api/wall
Lấy các bài đã được cô chấm điểm để hiện lên bảng tin.

---

## 📝 Chấm & Nộp bài
### POST /api/upload
Học sinh nộp bài tập (Ảnh hoặc Video).
- Body: {"student_id": 1, "urls": "link1.jpg"}

### POST /api/grade
Cô chấm điểm bằng số sao và thêm lời phê (tự động gợi ý).
- Body: {"id": submission_id, "stars": 10} hoặc {"ids": [id1, id2], "stars": 10}

### GET /api/pending
Danh sách bài tập cô chưa chấm.
