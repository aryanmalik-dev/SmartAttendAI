# SmartAttend AI

> **Intelligent Face Recognition Attendance & Classroom Monitoring System**  
> Powered by FastAPI, PostgreSQL, React 19, Vite, Tailwind CSS, InsightFace ArcFace models, and ONNX Runtime.

---

## 🌟 Overview & Key Features

SmartAttend AI is an enterprise-grade face recognition attendance system designed for educational institutions. It automates student attendance marking using classroom snapshots or live webcam streams, matching student faces against 512-dimensional ArcFace embedding vectors with cosine similarity.

### Core Capabilities
* **Role-Based Access Control (RBAC)**: Dedicated workflows for **Admin**, **Faculty**, and **Students**.
* **Institutional Hierarchy**: Programmatic management of **Courses**, **Departments**, **Subjects**, **Sections**, and **Classrooms**.
* **Faculty Assigned Classes**: Faculty view personalized class cards (**`Classes`**) with scoped student rosters and instant CSV/PDF export.
* **Bulk Master Sheet Excel Import**: Admin can bulk import multi-department student datasets with automatic header normalization.
* **Biometric Face Enrollment**: Enrolls 1 to 5 high-precision face photos per student (enforces a hard cap of 5 active face embeddings).
* **Multi-Mode Classroom Attendance**:
  * **📸 Snap & Process Photo**: Capture still classroom frames on demand.
  * **📁 Upload Classroom Photo**: Process uploaded photo files from camera or phone.
  * **🎥 Live Auto-Scan Stream**: Optional continuous frame scanning every 2.5s.
* **Real-Time AI Match Feedback**:
  * **`✓ PRESENT`**: Green match card with similarity confidence (e.g. `94.1%`).
  * **`ℹ DUPLICATE`**: Blue info badge for already-marked students.
  * **`⚠️ UNKNOWN FACE DETECTED`**: Amber alert badge for unrecognized faces below the 58% similarity threshold.

---

## 🏗 System Architecture

```
SmartAttendAI/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST API Endpoints (Auth, Students, Faculty, Attendance, etc.)
│   │   ├── core/            # Config, Security, JWT, Responses
│   │   ├── db/              # SQLAlchemy Session & Alembic Migrations
│   │   ├── models/          # Entities & Enums (PostgreSQL Schema)
│   │   ├── schemas/         # Pydantic Request/Response Models
│   │   └── services/        # Business Logic (Face ArcFace Provider, Attendance, Reports)
│   ├── storage/
│   │   └── face_uploads/    # Enrolled Student Biometric Image Storage
│   └── seed.py              # Initial Database Seeder
└── frontend/
    └── src/
        ├── app/             # App Shell & Role-Based Navigation
        ├── components/      # UI Design System (Cards, Modals, Buttons, Toasts)
        ├── features/        # Feature Pages (Manage Students, Classes, Attendance, Reports)
        └── lib/             # API Client & Axios Interceptors
```

---

## 💻 Fresh Machine Setup Guide

Follow this guide step-by-step to set up SmartAttend AI on a completely clean machine.

### Prerequisites
Before starting, ensure the following are installed:
1. **Python** 3.10 or higher (`python --version`)
2. **Node.js** 18 or higher (`node -v`) and `npm` (`npm -v`)
3. **PostgreSQL** 14 or higher (`psql --version`)

---

### Step 1: Database Setup

1. Open your PostgreSQL terminal (or pgAdmin) and create a database named `smartattend`:

```bash
# PostgreSQL CLI (Linux / macOS / Windows PowerShell)
createdb -U postgres smartattend
```

*(Alternatively, run `CREATE DATABASE smartattend;` inside SQL prompt)*.

---

### Step 2: Backend Setup

1. Open terminal and navigate to the `backend/` directory:

```bash
cd backend
```

2. Create and activate a Python virtual environment:

```powershell
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

3. Install required Python packages:

```bash
pip install -r requirements.txt
```

> [!NOTE]
> On the first run of the backend, **InsightFace** will automatically download the lightweight `buffalo_l` ONNX model weights into your user home directory (`~/.insightface/models/`).

4. Create your backend environment configuration:

Copy `.env.example` to `.env`:

```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Verify/update `backend/.env` database URL:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartattend
SECRET_KEY=super-secret-key-change-in-production
FACE_SIMILARITY_THRESHOLD=0.58
FACE_MAX_EMBEDDINGS_PER_STUDENT=5
```

5. Run Alembic Database Migrations:

```bash
alembic upgrade head
```

6. Seed Initial System Admin, Faculty, and Sample Data:

```bash
python seed.py
```

7. Start the FastAPI Backend Server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend server will run at: **`http://127.0.0.1:8000`**  
Interactive API Docs (Swagger): **`http://127.0.0.1:8000/docs`**

---

### Step 3: Frontend Setup

1. Open a new terminal window and navigate to `frontend/`:

```bash
cd frontend
```

2. Install Node.js dependencies:

```bash
npm install
```

3. Create frontend environment configuration:

Copy `.env.example` to `.env`:

```bash
# Windows PowerShell
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Ensure `frontend/.env` contains:
```env
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

4. Start the Frontend Development Server:

```bash
npm run dev
```

The frontend will run at: **`http://localhost:5173`** (or printed URL).

---

## 🔑 Default Login Credentials

After running `python seed.py`, the following default accounts are created:

| Role | Email | Password | Navigation Label |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@smartattend.ai` | `Admin@123` | **Manage Students** |
| **Faculty** | `faculty@smartattend.ai` | `Faculty@123` | **Classes** |
| **Student** | `student@smartattend.ai` | `Student@123` | **Students** |

---

## 📋 Complete Administrative Walkthrough (From Scratch)

Follow this workflow to set up an academic session from zero to automated attendance:

```mermaid
graph TD
    A[1. Admin Creates Infrastructure] -->|Course, Dept, Subject, Classroom| B[2. Admin Creates Faculty]
    B -->|Create Account & Assign Subject/Section| C[3. Create & Enroll Students]
    C -->|Upload 1-5 Face Photos| D[4. Faculty Starts Session]
    D -->|Select Assigned Subject & Room| E[5. AI Attendance Marking]
    E -->|Snap Photo / Upload Image| F[6. Verified Roster & Reports]
```

### 1. Create Academic Infrastructure (Admin)
1. Log in as **Admin** (`admin@smartattend.ai`).
2. **Courses** (`/courses`): Create courses (e.g. `BTech - Bachelor of Technology`).
3. **Departments** (`/departments`): Create departments under the course (e.g. `Computer Science & Engineering`).
4. **Subjects** (`/subjects`): Add subjects (e.g. `CS201 Data Structures`, Semester 3).
5. **Classrooms** (`/classrooms`): Add physical classrooms (e.g. `Room 301`, `Block A`, Capacity `60`).

### 2. Create & Assign Faculty (Admin)
1. Go to **Faculty** (`/faculty`).
2. Click **Add Faculty**:
   * **Name**: `Dr. Alan Turing`
   * **Email**: `alan.turing@smartattend.ai`
   * **Department**: `Computer Science & Engineering`
   * **Employee ID**: `EMP-101`
3. Go to **Assignments** (`/subject-assignments`):
   * Assign `Dr. Alan Turing` to `CS201 Data Structures` for `Section A` (`Academic Year: 2025-2026`).

### 3. Create & Enroll Students (Admin / Faculty)
1. Go to **Manage Students** (Admin) or **Classes** (Faculty).
2. Create a student manually or click **Import Excel** to upload a master spreadsheet.
   > **Required Student Fields**: `Roll No.`, `Admission No. / Student Number` (both must be strictly unique institution-wide), `Full Name`, `Course`, `Department`, `Semester`, `Section`.
3. **Biometric Face Enrollment**:
   * Click **Enroll** under the **Biometrics** column.
   * Upload **1 to 5 face photos** of the student (or capture via webcam).
   * Click **Submit Enrollment**. The InsightFace model extracts 512-dim ArcFace vectors and stores them in PostgreSQL. Enforces a hard limit of 5 embeddings per student.

### 4. Faculty Attendance Session & Marking (Faculty)
1. Log in as **Faculty** (`faculty@smartattend.ai`).
2. Click **Classes** in the left menu to view assigned class cards (e.g. *📘 CS201 Data Structures — Sec A*).
3. Go to **Attendance** (`/attendance`) and click **Create Session**:
   * Select Subject Assignment (`CS201 - Section A`).
   * Select Classroom (`Room 301`).
   * Select Date & Time.
4. Open the active session under **Recognition Control**:
   * **Snap & Process Photo**: Turn on webcam $\rightarrow$ Frame classroom $\rightarrow$ Click **"Snap & Process Photo"**.
   * **Upload Classroom Photo**: Click **"Upload Classroom Photo"** to select a photo file taken from a camera/phone.
   * **Auto-Scan Stream**: Check `[x] Enable Continuous Auto-Scan Stream` for automated 2.5s frame scanning.
5. **Inspect Recognition Feed**:
   * **`✓ PRESENT`** (Green): Recognized student match with confidence %.
   * **`ℹ DUPLICATE`** (Blue): Already marked student.
   * **`⚠️ UNKNOWN FACE DETECTED`** (Amber): Unrecognized face detected in classroom frame below 58% similarity threshold.

---

## ⚙️ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/smartattend` |
| `SECRET_KEY` | JWT encryption secret | Required |
| `FACE_SIMILARITY_THRESHOLD` | ArcFace cosine similarity threshold for face match | `0.58` |
| `FACE_MAX_EMBEDDINGS_PER_STUDENT` | Hard ceiling of active embeddings per student | `5` |
| `FACE_UPLOAD_ROOT` | Local disk directory for enrolled student face photos | `storage/face_uploads` |

---

## 🧪 Testing & Verification Commands

### Backend Tests & Verification
```powershell
cd backend
.\.venv\Scripts\python.exe -c "import app.main; print('Backend modules verified clean!')"
```

### Frontend Build Verification
```powershell
cd frontend
npm run build
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
