# PrepX Frontend

The frontend for PrepX is a high-performance React application built with TypeScript and Vite, styled using Tailwind CSS. It provides a voice-first user experience for conducting AI-powered mock interviews.

## 🛠️ Tech Stack

- **Framework**: React 19
- **Type Safety**: TypeScript
- **Styling**: Tailwind CSS (v3 for utility-first styling)
- **State Management**: Zustand
- **Motion/Animations**: Framer Motion
- **Icons**: Lucide React
- **HTTP Client**: Axios

## 📂 Structure

- `/src/components`: UI components (Buttons, Cards, Modals, etc.)
- `/src/pages`: Main application views (Dashboard, Interview, Setup, etc.)
- `/src/services`: API client and endpoint abstractions
- `/src/store`: Global state management for sessions and user data
- `/src/hooks`: Custom React hooks for logic reuse
- `/src/types`: TypeScript interfaces and types

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables in `.env`:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Building for Production

```bash
npm run build
```
The output will be in the `dist/` directory.
