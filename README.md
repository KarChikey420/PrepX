# PrepX - AI Voice Interviewer

PrepX is an enterprise-grade, real-time AI voice interview platform. It uses a FastAPI backend and a React/Vite frontend to conduct technical interviews with voice streaming, automated evaluation, and performance report generation.

## Project Structure

### Root Files
- `README.md`: This file. Detailed documentation of the project.

### Backend (`/backend`)
The backend is built with FastAPI, MongoDB, and Redis.

- `main.py`: Entry point for the FastAPI application. Handles app initialization, middleware, routing, and lifecycle events.
- `requirements.txt`: Python package dependencies.
- `docker-compose.yml`: Docker configuration for the app, MongoDB, and Redis.
- `Dockerfile`: Container definition for the backend service.
- `.env`: Environment variables (API keys, DB connection strings).
- `api_tests.http`: REST manual tests for HTTP Client.

#### Core (`/backend/core`)
- `config.py`: Settings management using Pydantic Settings.
- `database.py`: MongoDB connection and Beanie ODM initialization.
- `redis.py`: Upstash Redis client for session state caching.
- `logging.py`: Structured logging setup.
- `exceptions.py`: Custom application exceptions and error handlers.

#### Models (`/backend/models`)
- `session.py`: Beanie document model for `InterviewSession`.
- `user.py`: Beanie document model for `User`.
- `schemas.py`: Pydantic V2 request and response schemas.

#### API (`/backend/api`)
- `v1/router.py`: Aggregate router for versioned API endpoints.
- `v1/interview.py`: REST endpoints for the interview session lifecycle.
- `ws/interview.py`: WebSocket handler for real-time audio and orchestration.
- `rest/interview.py`: REST-based turn-based interview processing.

#### Services (`/backend/services`)
- `voice/stt.py`: Speech-to-Text integration (Deepgram).
- `voice/tts.py`: Text-to-Speech integration (Deepgram).
- `agents/evaluator.py`: AI agent that evaluates candidate responses.
- `agents/interviewer.py`: AI agent that generates interview questions.
- `agents/mentor.py`: AI agent that provides feedback and transitions.
- `report.py`: Service for Markdown report generation using Kimi K2.

### Frontend (`/frontend`)
The frontend is a React application built with TypeScript and Vite.

- `index.html`: Main HTML entry point.
- `vite.config.ts`: Vite configuration.
- `package.json`: Frontend package dependencies and scripts.
- `tsconfig.json`: TypeScript configuration.

#### Core Source (`/frontend/src`)
- `main.tsx`: React entry point.
- `App.tsx`: Main application component, manages global UI state.
- `types.ts`: TypeScript interfaces and types shared across the frontend.
- `index.css`: Global styles using modern CSS/Glassmorphism.

#### Components & Views (`/frontend/src/components` & `/frontend/src/views`)
- `components/AICore.tsx`: UI component for visualizing AI status/audio levels.
- `views/SetupView.tsx`: Configuration screen for initializing a session.
- `views/InterviewView.tsx`: Real-time interview screen with microphone and chat.
- `views/ReportView.tsx`: Displays the final Markdown report.

#### Hooks (`/frontend/src/hooks`)
- `useWebSocket.ts`: Hook for managing WebSocket-based voice streaming.
- `useRestInterview.ts`: Hook for managing REST-based turn processing.
- `useAudioRecorder.ts`: Hook for handling microphone input and encoding.
- `useAudioPlayer.ts`: Hook for playing back base64 audio responses.

## Getting Started

### Backend
1. Install dependencies: `pip install -r requirements.txt`
2. Run the server: `uvicorn main:app --reload`

### Frontend
1. Install dependencies: `npm install`
2. Run the app: `npm run dev`
