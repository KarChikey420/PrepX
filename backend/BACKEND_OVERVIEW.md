# PrepX Backend — System Architecture & Workflow

PrepX is an AI-powered interview assistant that uses a multi-agent system to conduct highly personalized, voice-enabled mock interviews. This document provides a technical overview of the backend architecture, core components, and the end-to-end interview lifecycle.

---

## 🏗️ System Architecture

The backend is built with **FastAPI** (Python 3.12+), utilizing a modern asynchronous stack for high performance and low-latency interactions.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Framework** | FastAPI | REST API, Request handling, Background tasks. |
| **Primary Database** | MongoDB (Beanie) | Persistent storage for user sessions, profiles, and final reports. |
| **State & Cache** | Redis | Ephemeral session state, real-time interview progress, and audio asset caching. |
| **AI Orchestration** | OpenAI / Azure | Powering the multi-agent system (Analyzer, Interviewer, Evaluator, Mentor). |
| **Voice Engine** | Azure Speech Services | Real-time Speech-to-Text (STT) and Text-to-Speech (TTS). |

---

## 🔄 Core Interview Workflow

The interview process follows a **5-step unified flow** designed to feel like a real conversation.

### 1. Upload & Analysis (`POST /upload`)
- **Input**: User's Resume (PDF/DOCX) and a Job Description (text).
- **Process**: 
    1.  Text is extracted from the uploaded document.
    2.  An **InterviewSession** is created in MongoDB with status `PROCESSING`.
    3.  A **ProfileAnalyzerAgent** runs in the background to identify key skills, experience levels, and potential interview focus areas based on the Job Description.
    4.  The session state is initialized in **Redis** for fast access.
- **Output**: `session_id`.

### 2. Initialization (`POST /{id}/start`)
- **Process**:
    1.  The system generates **10 personalized questions** tailored to the candidate's profile and the role's requirements.
    2.  The first question is synthesized into audio (TTS) and stored in Redis.
- **Output**: Question text and an `audio_url` for immediate playback.

### 3. The Interview Loop (`POST /{id}/turn`)
This step is repeated for each of the 10 questions.
1.  **Transcription**: Candidate's audio response is sent to Azure for **Speech-to-Text**.
2.  **Evaluation**: The **EvaluatorAgent** scores the response (1-10) and provides immediate feedback based on the expected keywords and focus area.
3.  **Mentorship**: The **MentorAgent** generates a transition hint to encourage the candidate or bridge to the next topic.
4.  **Progression**: The **InterviewerAgent** identifies the next question.
5.  **Synthesis**: The next question's audio (TTS) is pre-generated and cached.
- **Output**: Transcription, feedback, mentor hint, and the next question's `audio_url`.

### 4. Conclusion (`POST /{id}/finish`)
- **Process**:
    1.  The system aggregates all 10 turn evaluations.
    2.  A comprehensive **Final Report** is generated (Overall Score, Strong Areas, Weak Areas, Skill Gaps, and Communication Assessment).
    3.  The report is persisted to MongoDB.
    4.  The Redis session state is cleaned up.

### 5. Reporting (`GET /{id}/report`)
- **Output**: Retrieves the full performance report for the candidate to review.

---

## 🤖 AI Agent System

We use a modular agent architecture where each agent has a specific responsibility:

*   **Profile Analyzer**: Parses messy resumes and extracts structured candidate profiles.
*   **Interviewer Agent**: Manages the flow of the interview and adapts the phrasing of questions.
*   **Evaluator Agent**: Analyzes candidate responses for technical accuracy and depth.
*   **Mentor Agent**: Provides real-time coaching and smooth transitions between skills.

---

## ⚡ Performance Optimization

- **Redis Caching**: We store synthesized audio chunks in Redis. If a user refreshes the page or a network glitch occurs, the audio is served instantly from memory instead of re-calling the TTS service.
- **Background Tasks**: Heavy operations like resume analysis and report generation run asynchronously to ensure the API remains responsive.
- **Stateful Persistence**: While MongoDB handles long-term storage, Redis handles the "live" state of the interview, allowing for millisecond-latency during the conversation.

---

## 🛠️ Project Structure (Backend)

```text
backend/
├── api/v1/         # API Routers & Unified Interview logic
├── core/           # Config, Database, Redis, and Logging setup
├── models/         # Pydantic schemas and Beanie documents
├── services/       # Core business logic
│   ├── agents/     # The AI Agent brains (Interviewer, Evaluator, etc.)
│   └── voice/      # STT and TTS integrations
├── tests/          # Unit and integration tests
├── main.py         # Application entry point
└── Dockerfile      # Containerization setup
```
