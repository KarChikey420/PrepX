# PrepX: AI-Powered Career Interview Assistant

PrepX is a cutting-edge, AI-driven mock interview platform designed to help candidates prepare for their dream jobs. By leveraging a multi-agent system and real-time voice processing, PrepX conducts personalized, realistic interviews based on your resume and target job description.

## 🚀 Key Features

- **Profile-Specific Interviews**: Analyzes your resume (PDF/DOCX) and a Job Description (JD) to tailor every question to your experience.
- **Multi-Agent AI System**: Orchestrates specialized agents (Analyzer, Interviewer, Evaluator, Mentor) for a holistic interview experience.
- **Voice-First Interaction**: Fully immersive voice-enabled interface using low-latency Speech-to-Text (STT) and Text-to-Speech (TTS).
- **Real-Time Feedback**: Receive instant evaluative feedback and mentoring hints after every response.
- **Comprehensive Performance Reports**: Detailed final analysis covering technical accuracy, communication skills, and areas for improvement.

---

## 🔄 Core Interview Workflow (The Full Flow)

PrepX follows a unified 5-step lifecycle to ensure a seamless and high-value preparation experience:

### 1. Document Upload & Analysis
- **Action**: User uploads their resume and pastes a Job Description.
- **Under the hood**: The system extracts text using `pdfplumber` or `python-docx`. A **Profile Analyzer Agent** identifies key skills, seniority, and focus areas to calibrate the interview difficulty.

### 2. Session Initialization
- **Action**: The system initializes the interview session.
- **Under the hood**: 10 personalized questions are pre-generated. The first question is synthesized into audio and cached in **Redis** for immediate playback.

### 3. The Interactive Interview Loop (10 Turns)
For each of the 10 questions:
- **Audio Output**: The system plays the question (TTS).
- **Audio Input**: The candidate responds via their microphone.
- **Transcription**: The response is converted to text (STT) in real-time.
- **Evaluation**: The **Evaluator Agent** scores the response and checks for key technical points.
- **Mentorship**: The **Mentor Agent** provides a "bridge" or transition hint to keep the candidate engaged and prepared for the next topic.

### 4. Conclusion & Synthesis
- **Action**: Once all questions are answered, the system finalizes the session.
- **Under the hood**: All turn evaluations are aggregated. A comprehensive **Final Report** is generated using LLM analysis, focusing on strengths, weaknesses, and a final "Hire/No Hire" assessment.

### 5. Final Reporting
- **Action**: User reviews their full performance dashboard.
- **Result**: Data-driven insights to help the candidate refine their interview strategy.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: [React 19](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **Database**: [MongoDB](https://www.mongodb.com/) (using [Beanie ODM](https://beanie-odm.dev/))
- **Caching**: [Redis](https://redis.io/) (via [Upstash REST](https://upstash.com/))
- **AI/LLM**: Kimi K2 (OpenAI-compatible) via [NVIDIA API](https://build.nvidia.com/)
- **Voice (STT)**: NVIDIA Nematron / OpenAI Whisper
- **Voice (TTS)**: NVIDIA Riva

---

## 📂 Project Structure

```text
PrepX/
├── frontend/               # React + Tailwind Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page-level components (Landing, Setup, Interview, Report)
│   │   ├── services/       # API abstraction layer
│   │   └── store/          # Zustand global state
├── backend/                # FastAPI Backend
│   ├── api/                # API routes and business logic
│   ├── core/               # Configuration, Database, and Redis setup
│   ├── models/             # Pydantic schemas and Beanie documents
│   ├── services/           # AI Agental logic and Voice pipeline
│   ├── BACKEND_OVERVIEW.md # Detailed technical architecture
│   └── main.py             # Application entry point
└── README.md
```

---

## ⚡ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.12+)
- MongoDB & Redis (Upstash) instances
- NVIDIA API Keys (for Kimi K2 and Riva)

### Backend Setup
1. Navigate to `backend/`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux/macOS)
4. Install dependencies: `pip install -r requirements.txt`
5. Configure `.env` based on `.env.example`
6. Start the server: `python main.py` (or `uvicorn main:app --reload`)

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Configure `.env` with your `VITE_API_BASE_URL`
4. Start development server: `npm run dev`

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
