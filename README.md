# AI Calculator 

Full-stack AI-powered calculator with a canvas frontend and an Express backend that uses Google Gemini to interpret drawings and solve math problems.

## Features

  - **Canvas Input:** Draw mathematical equations, expressions, or even abstract concepts on the canvas.
  - **AI-Powered Solving:** Utilizes the Google Gemini API to analyze the drawings and provide solutions.
  - **Multiple Problem Types:**
      - Simple mathematical expressions (e.g., 2 + 2).
      - Algebraic equations (e.g., x^2 + 2x + 1 = 0).
      - Variable assignments (e.g., x = 4).
      - Graphical math problems.
      - Abstract concept detection.
  - **Interactive UI:**
      - Draggable LaTeX results.
      - Color palette for drawing.
      - Brush and eraser tools.
      - Adjustable line width.
      - Undo/Redo functionality.
  - **Keyboard Shortcuts:**
      - `Ctrl/Cmd + Z`: Undo
      - `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: Redo
      - `Ctrl + Enter`: Run calculation
      - `Ctrl + Backspace/Delete`: Reset canvas

## Tech Stack

  - **Frontend:**
      - React
      - Vite
      - TypeScript
      - Mantine (for UI components)
      - Tailwind CSS
      - Axios
      - React Draggable
  - **Backend:**
      - Node.js
      - Express
      - @google/generative-ai
      - CORS
      - Dotenv

## Prerequisites

  - Node.js v18+ and npm
  - A Google Gemini API key

## Getting Started

### Backend (server)

1.  Navigate to the `server` directory:
    ```bash
    cd server
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file in the `server` directory and add your Google Gemini API key:
    ```
    GEMINI_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
    PORT=8000
    ```
4.  Start the server:
    ```bash
    npm start
    ```
    The server will be running on http://localhost:8000. You can check the health of the server at http://localhost:8000/health.

### Frontend (client)

1.  Navigate to the `client` directory:
    ```bash
    cd client
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  The client is configured to connect to the backend at `http://localhost:8000` by default, as specified in `client/.env`. If your backend is running on a different port, update this file accordingly.
4.  Start the development server:
    ```bash
    npm run dev
    ```
    The application will be running on http://localhost:5173.

## How It Works

1.  The user draws an equation or math problem on the HTML canvas in the frontend.
2.  When the "Run" button is clicked, the canvas content is converted to a base64 PNG image.
3.  This image data is sent to the backend via a POST request to the `/api/calculate` endpoint.
4.  The Express server receives the request and passes the image to the `analyzeImage` function.
5.  This function sends the image along with a detailed prompt to the Google Gemini API.
6.  The Gemini API processes the image, solves the mathematical problem, and returns a JSON response.
7.  The backend parses the JSON and sends it back to the frontend.
8.  The React UI then renders the results as draggable LaTeX labels on the screen.

## Notes

  - The request body size limit in `server/index.js` is currently set to 20mb to accommodate large image data.
  - The `gemini-analyzer.js` utility includes a fallback mechanism to try different Gemini models if the default one fails.
  - The Tailwind CSS theme is a minimal approximation.

## License

This project is licensed under the MIT License.
