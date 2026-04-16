# Karyera.az — Quraşdırma Təlimatı

## Struktur
```
karyera_v2/
├── backend/        ← FastAPI server
└── frontend/       ← React + Vite app
```

## Backend Quraşdırma

```powershell
cd backend

# 1. .env fayl yarat (.env.example-dan kopyala)
# İçinə yaz:
# DEEPSEEK_API_KEY=sk-102ec003c59d417fa0b6ad4cd055cd5a
# CORS_ORIGINS=["http://localhost:5173"]

# 2. Paketlər
pip install -r requirements.txt

# 3. Serveri başlat
python -m uvicorn main:app --reload --port 8000

# Yoxla: http://localhost:8000/api/cv/health
```

## Frontend Quraşdırma

```powershell
cd frontend

# .env artıq hazırdır (VITE_API_URL=http://localhost:8000)

npm install
npm run dev

# Açıl: http://localhost:5173
```

## Hər iki terminal eyni vaxtda işləməlidir!
