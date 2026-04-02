document.addEventListener('DOMContentLoaded', () => {
    const isTeacher = window.location.pathname.includes('teacher.html') || window.location.pathname.endsWith('/teacher');
    
    if (isTeacher) {
        loadPending();
    } else {
        loadStudents();
        loadLeaderboard();
        loadWall();
    }

    // --- STUDENT LOGIC ---
    function loadStudents() {
        const select = document.getElementById('student-select');
        if (!select) return;

        fetch('/api/students')
            .then(res => res.json())
            .then(students => {
                students.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.innerText = s.name;
                    select.appendChild(opt);
                });
            });
    }

    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentId = document.getElementById('student-select').value;
            const fileInput = document.getElementById('file-input');
            const status = document.getElementById('upload-status');

            if (!studentId || !fileInput.files[0]) {
                status.innerText = "❌ Vui lòng chọn tên và chụp bài tập.";
                status.style.color = "var(--danger)";
                return;
            }

            const files = Array.from(fileInput.files);
            const urls = [];
            const fileProgress = new Array(files.length).fill(0);
            
            status.innerText = `⚡ Đang chuẩn bị ${files.length} bài của con...`;
            status.style.color = "var(--accent)";

            // Hàm upload từng file trực tiếp lên Cloudinary (Unsigned)
            const uploadToCloudinary = (file, index) => {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', 'u0v4sn9e'); 
                    formData.append('cloud_name', 'dald3w5pi');

                    xhr.open('POST', `https://api.cloudinary.com/v1_1/dald3w5pi/upload`, true);

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            fileProgress[index] = (e.loaded / e.total) * 100;
                            const totalPercent = Math.round(fileProgress.reduce((a, b) => a + b, 0) / files.length);
                            status.innerText = `🚀 Đang gửi bài: ${totalPercent}%... Cô vui lòng không đóng trang nhé!`;
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status === 200) {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response.secure_url);
                        } else {
                            // Lấy chi tiết lỗi từ Cloudinary để báo cho Cô
                            const errorDetail = JSON.parse(xhr.responseText);
                            reject(new Error("Cloudinary báo: " + (errorDetail.error ? errorDetail.error.message : xhr.statusText)));
                        }
                    };

                    xhr.onerror = () => reject(new Error("Lỗi kết nối mạng."));
                    xhr.send(formData);
                });
            };

            try {
                // Xử lý nén ảnh đồng thời trước khi gửi
                const preparedFiles = await Promise.all(files.map(async (f) => {
                    if (f.type.startsWith('image/')) return await compressImage(f);
                    return f;
                }));

                status.innerText = `🚀 Đang bắt đầu gửi đồng thời ${files.length} bài...`;

                // Gửi tất cả các tệp cùng lúc (SONG SONG)
                const uploadedUrls = await Promise.all(preparedFiles.map((file, i) => uploadToCloudinary(file, i)));
                
                status.innerText = `✅ Đã lưu xong ${files.length} bài lên Đám mây! Đang hoàn tất...`;
                
                // Gửi Link về server để lưu vào sổ điểm
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        student_id: studentId, 
                        urls: uploadedUrls.join(',')
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Không thể lưu bài vào máy chủ.");
                }

                const result = await response.json();
                status.innerText = "🌟 Gửi bài phi mã thành công! Đang chờ Cô vinh danh nhé.";
                status.style.color = "var(--success)";
                uploadForm.reset();
                setTimeout(() => { status.innerText = ""; }, 5000);
                loadWall(); 
            } catch (err) {
                console.error(err);
                status.innerText = "❌ Lỗi: " + err.message;
                status.style.color = "var(--danger)";
            }
        });
    }

    // --- HELPER: Nén ảnh thông minh ---
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1280;
                    const MAX_HEIGHT = 1280;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Xuất ra Blob với chất lượng 0.7 (giảm 70-90% dung lượng)
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', 0.7);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    function loadWall() {
        const wall = document.getElementById('class-wall');
        if (!wall) return;

        fetch('/api/wall')
            .then(res => res.json())
            .then(data => {
                wall.innerHTML = '';
                if (data.length === 0) {
                    wall.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--text-light);">Cố gắng làm bài để được lên bảng tin lớp mình nhé!</p>';
                    return;
                }
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'submission fade-in';
                    
                    const paths = item.file_paths.split(',');
                    let mediaHtml = '<div class="submission-gallery">';
                    
                    paths.forEach(path => {
                        if (!path) return;
                        let src = path.startsWith('http') ? path : (path.startsWith('/') ? path : '/' + path);
                        if (src.includes('cloudinary.com')) {
                            src = src.replace('/upload/', '/upload/f_auto,q_auto/');
                        }
                        if (path.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)) {
                            mediaHtml += `<video src="${src}" class="submission-media" controls playsinline webkit-playsinline preload="metadata"></video>`;
                        } else {
                            mediaHtml += `<img src="${src}" class="submission-media">`;
                        }
                    });
                    mediaHtml += '</div>';

                    card.innerHTML = `
                        ${mediaHtml}
                        <div class="submission-info">
                            <span class="student-name">${item.student_name}</span>
                            <div class="stars">${'⭐'.repeat(item.stars)}</div>
                            <div class="comment">${item.comment}</div>
                            <span class="badge">${new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                    `;
                    wall.appendChild(card);
                });
            })
            .catch(err => {
                console.error("Lỗi tải bảng tin:", err);
                wall.innerHTML = '<p style="text-align: center; color: var(--danger);">⚠️ Lỗi tải dữ liệu. Cô thử tải lại trang nhé!</p>';
            });
    }

    // --- TEACHER LOGIC ---
    function loadPending() {
        const list = document.getElementById('pending-list');
        if (!list) return;

        fetch('/api/pending')
            .then(res => res.json())
            .then(data => {
                list.innerHTML = '';
                if (data.length === 0) {
                    list.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--text-light);">🎁 Hôm nay các con nộp bài ngoan lắm, Cô đã chấm hết rồi!</p>';
                    return;
                }
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'submission fade-in';
                    
                    const paths = item.file_paths.split(',');
                    let mediaPreview = '<div class="submission-gallery preview">';
                    paths.forEach(path => {
                        if (!path) return;
                        let src = path.startsWith('http') ? path : (path.startsWith('/') ? path : '/' + path);
                        if (src.includes('cloudinary.com')) {
                            src = src.replace('/upload/', '/upload/f_auto,q_auto/');
                        }
                        if (path.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)) {
                            mediaPreview += `<video src="${src}" class="submission-media" style="height: 80px" controls playsinline webkit-playsinline preload="metadata"></video>`;
                        } else {
                            mediaPreview += `<img src="${src}" class="submission-media" style="height: 80px">`;
                        }
                    });
                    mediaPreview += '</div>';

                    card.innerHTML = `
                        ${mediaPreview}
                        <div class="submission-info">
                            <span class="student-name">${item.student_name}</span>
                            <div class="badge">${paths.length} file nộp</div>
                            <button class="btn" style="margin-top: 1rem; padding: 0.4rem; font-size: 0.9rem;" onclick="openGradeModal(${item.id}, '${item.student_name}')">✏️ Chấm Điểm</button>
                        </div>
                    `;
                    list.appendChild(card);
                });
            })
            .catch(err => {
                console.error("Lỗi tải bài chưa chấm:", err);
                list.innerHTML = '<p style="text-align: center; color: var(--danger);">⚠️ Lỗi tải bài từ máy chủ. Cô kiểm tra kết nối mạng nhé!</p>';
            });
    }

    // Export function to global for inline buttons
    window.openGradeModal = function(id, name) {
        document.getElementById('grade-submission-id').value = id;
        document.getElementById('grade-student-name').innerText = "Chấm bài cho bạn: " + name;
        document.getElementById('grading-modal').style.display = 'block';
        document.getElementById('overlay').style.display = 'block';
    };

    const gradingForm = document.getElementById('grading-form');
    if (gradingForm) {
        gradingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('grade-submission-id').value;
            const stars = document.getElementById('star-range').value;

            fetch('/api/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id), stars: parseInt(stars) })
            })
            .then(res => res.json())
            .then(data => {
                alert("Đã chấm xong cho bạn nhỏ: " + stars + " sao!");
                document.getElementById('grading-modal').style.display = 'none';
                document.getElementById('overlay').style.display = 'none';
                loadPending();
            });
        });
    }

    function loadLeaderboard() {
        const lbSection = document.getElementById('leaderboard-section');
        const lbContainer = document.getElementById('leaderboard');
        if (!lbContainer) return;

        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => {
                if (data.length === 0) {
                    lbSection.style.display = 'none';
                    return;
                }
                lbSection.style.display = 'block';
                lbContainer.innerHTML = '';
                
                data.forEach((item, index) => {
                    const rank = index + 1;
                    const itemDiv = document.createElement('div');
                    itemDiv.className = `leaderboard-item fade-in rank-${rank <= 3 ? rank : 'other'}`;
                    
                    let medal = '';
                    if (rank === 1) medal = '🥇';
                    else if (rank === 2) medal = '🥈';
                    else if (rank === 3) medal = '🥉';

                    itemDiv.innerHTML = `
                        <div class="rank">${rank}</div>
                        <div class="leaderboard-name">${medal} ${item.name}</div>
                        <div class="leaderboard-stars">
                            ${item.total_stars} <span>⭐</span>
                        </div>
                    `;
                    lbContainer.appendChild(itemDiv);
                });
            });
    }
});
