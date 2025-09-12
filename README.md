# iPad Calculator (MERN + Gemini)

Full-stack AI-powered calculator with a canvas frontend and an Express backend that uses Google Gemini to interpret drawings and solve math problems.

## Prerequisites

- Node.js 18+ and npm
- A Google Gemini API key

## Backend (server)

1. Copy `server/.env` and set your key:
   - `GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"`
   - `PORT=8000` (optional)
2. Install and run:

```powershell
cd server
npm install
npm start
```

Server will run on http://localhost:8000

Health check: http://localhost:8000/health

## Frontend (client)

1. Install dependencies:

```powershell
cd client
npm install
```

2. Configure API URL (already set by default): `client/.env`

```
VITE_API_URL=http://localhost:8000
```

3. Start the dev server:

```powershell
npm run dev
```

Open http://localhost:5173

## How it works

- Draw equations or math problems on the canvas and click "Run".
- The canvas image is sent to the backend (`/api/calculate`).
- The backend calls Gemini with a strict prompt and returns parsed JSON.
- The UI renders results as draggable LaTeX labels and assigns variable values when provided.

## Notes

- Increase request body size in `server/index.js` (currently 10mb) if needed.
- If Gemini returns non-JSON text, the backend currently returns an empty array; you can add fallback parsing in `server/utils/gemini-analyzer.js`.
- Tailwind theme is a minimal approximation. If you have a reference theme, we can replicate it exactly.

## License

MIT
