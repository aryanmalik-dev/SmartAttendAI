# SmartAttend AI

SmartAttend AI is a full-stack Intelligent Face Recognition Attendance & Classroom Monitoring System for educational institutions. It uses FastAPI, PostgreSQL, React 19, Vite, Tailwind CSS, InsightFace ArcFace models, and ONNX Runtime.

## Architecture

- `backend/app/core`: settings, JWT, password hashing, response helpers
- `backend/app/models`: normalized SQLAlchemy models for users, students, faculty, departments, courses, classrooms, sessions, records, embeddings, notifications, and settings
- `backend/app/services`: attendance marking, InsightFace recognition abstraction, analytics, PDF/CSV reports, SMTP email
- `backend/app/api/v1`: REST API routers with validation, RBAC, pagination, filtering, and consistent JSON responses
- `frontend/src/app`: React Router shell and role-aware navigation
- `frontend/src/features`: dashboards, admin resources, attendance webcam capture, monitoring, reports, student portal

## Database

The PostgreSQL schema is managed by Alembic. The academic hierarchy is:

- `courses`: top-level programs such as `BTech`
- `departments`: branches associated with a course such as `CSE`, `IT`, or `CS`
- `subjects`: branch and semester-specific subjects with codes

Face embeddings are stored in `face_embeddings.embedding` as JSONB vectors with model metadata. Recognition compares normalized ArcFace embeddings using cosine similarity and `FACE_SIMILARITY_THRESHOLD`. Uploaded enrollment photos are written to `backend/storage/face_uploads/` by default, and the database stores their relative paths in `face_embeddings.image_path` so the original images remain available for future training or review.

## Local Setup

1. Create PostgreSQL database:

```powershell
createdb smartattend
```

2. Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
```

3. Frontend:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

`backend/requirements.txt` is the single backend dependency file. `backend/.env.example` is the backend template, `frontend/.env.example` is the frontend template, and the real `backend/.env` stays local only.

The repository ignores local `.env` files, virtual environments, generated logs, build output, the backend face-upload storage directory, and `node_modules/`, so the Git history stays free of machine-specific or sensitive data. Rebuild your venv locally as needed; it will not be picked up by Git.

Backend file storage can be configured with `FACE_UPLOAD_ROOT` in `backend/.env`. Keep it local and outside Git.

Default seeded accounts:

- Admin: `admin@smartattend.edu` / `Admin@12345`
- Faculty: `faculty@smartattend.edu` / `Faculty@12345`
- Student: `student@smartattend.edu` / `Student@12345`

## InsightFace Design

All face detection, alignment, embedding generation, and recognition is isolated in `backend/app/services/face.py`.

- `FaceRecognitionProvider` defines the stable interface.
- `InsightFaceArcFaceProvider` implements InsightFace + ONNX Runtime.
- Attendance logic depends only on the provider interface, so future model upgrades do not require changes to session or attendance APIs.

The first run may download InsightFace model assets. Use CPU by default through `CPUExecutionProvider`; configure another ONNX Runtime provider through `FACE_PROVIDER`.

## Main API

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET|POST /api/v1/departments`
- `GET|POST /api/v1/courses`
- `GET|POST /api/v1/classrooms`
- `GET|POST /api/v1/faculty`
- `GET|POST /api/v1/students`
- `POST /api/v1/students/{id}/faces`
- `POST /api/v1/students/{id}/reenroll-face`
- `GET|POST /api/v1/attendance/sessions`
- `POST /api/v1/attendance/sessions/{id}/recognize`
- `POST /api/v1/attendance/sessions/{id}/manual`
- `GET /api/v1/analytics/dashboard`
- `GET /api/v1/reports/export/pdf`
- `GET /api/v1/reports/export/csv`
- `POST /api/v1/notifications/send-summary`
- `GET /api/v1/monitoring/sessions/{id}`
