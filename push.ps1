Write-Host "--- DANG CHUAN BI DAY CODE LEN CLOUD (RENDER) ---" -ForegroundColor Cyan

# 1. Kiem tra xem da co Git chua
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Loi: May ban chua cài Git. Hay cai Git de tiep tuc." -ForegroundColor Red
    exit
}

# 2. Add tat ca thay doi
Write-Host "> Dang gom nhom cac thay doi..." -ForegroundColor Gray
git add .

# 3. Commit voi tin nhan mac dinh hoac tu chon
$message = "Cap nhat ung dung: " + (Get-Date -Format "yyyy-MM-dd HH:mm")
Write-Host "> Dang ghi chu thay doi: $message" -ForegroundColor Gray
git commit -m $message

# 4. Push len GitHub
Write-Host "> Dang day code len GitHub... (Vui long cho giay lat)" -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "--- THANH CONG! Cho Render cap nhat trong 1-2 phut nhe. ---" -ForegroundColor Green
} else {
    Write-Host "--- CO LOI: Vui long kiem tra lai ket noi hoac quyen truy cap GitHub. ---" -ForegroundColor Red
}
