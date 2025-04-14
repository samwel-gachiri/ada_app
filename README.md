# ADA - Advanced Design Assistant Application

## Overview

This application is a conversational AI assistant named Ada, built with a Python backend (Flask, SocketIO, Google Gemini) and a React frontend. It supports text input, client-side speech-to-text (Web Speech API), text-to-speech (ElevenLabs), webcam video frame processing, and integrates with external APIs for weather (python_weather), maps/directions (googlemaps), and web search (googlesearch-python, aiohttp, BeautifulSoup). Communication between the frontend and backend happens in real-time using WebSockets (SocketIO). (FOR MORE DETAILED ON BACKEND REFERENCE THE ADA REPO "https://github.com/Nlouis38/ada")

## How it Works

1.  **Backend (`app.py`, `ADA_Online.py`):**

    - A Flask server manages HTTP requests and SocketIO connections.
    - SocketIO handles real-time bidirectional communication with the React frontend.
    - An `ADA` class instance (`ADA_Online.py`) encapsulates the core assistant logic.
    - It uses `asyncio` within a separate thread to manage asynchronous tasks like interacting with the Gemini API, handling TTS streams, and processing inputs without blocking the Flask server.
    - It connects to the Google Gemini API (`google-generativeai`) for conversational AI capabilities, configured with specific system instructions and tool functions (weather, travel duration, search).
    - It receives text input, transcribed speech, and video frames from the client via SocketIO.
    - It processes text and video frames, sending them to the Gemini API.
    - It handles function calls requested by Gemini, executing corresponding Python functions (e.g., `get_weather`, `get_travel_duration`, `get_search_results`).
    - The search function fetches URLs and then asynchronously extracts content (title, snippet, paragraph text) from those pages using `aiohttp` and `BeautifulSoup`.
    - It streams Gemini's text responses back to the client chunk by chunk via SocketIO.
    - It streams text responses to the ElevenLabs TTS API via WebSocket to generate audio.
    - Generated audio chunks (PCM) are received from ElevenLabs and streamed back to the client via SocketIO.
    - API results (weather, maps, search) are also emitted to the client via dedicated SocketIO events to update specific UI widgets.

2.  **Frontend (`App.jsx`, components):**
    - A React application provides the user interface.
    - It establishes a SocketIO connection to the backend server.
    - It renders components for chat display (`ChatBox`), user input (`InputArea`), status messages (`StatusDisplay`), AI visualization (`AiVisualizer`), webcam feed (`WebcamFeed`), and widgets for weather (`WeatherWidget`), maps (`MapWidget`), code execution (`CodeExecutionWidget`), and search results (`SearchResultsWidget`).
    - **Input:**
      - Text input is sent via the `send_text_message` SocketIO event.
      - The Web Speech API is used for client-side speech recognition. Final transcripts are sent via the `send_transcribed_text` event.
      - If the webcam is enabled, video frames are captured periodically from a `<video>` element onto a `<canvas>`, converted to JPEG data URLs, and sent via the `send_video_frame` event.
    - **Output:**
      - Status messages and errors from the backend are displayed.
      - Text chunks received via `receive_text_chunk` are assembled and displayed in the chatbox.
      - Base64 encoded audio chunks received via `receive_audio_chunk` are queued and played back using the Web Audio API (`AudioContext`).
      - Data received via `weather_update`, `map_update`, `executable_code_received`, and `search_results_update` updates the state, causing the respective widgets to render or update.
    - The `AiVisualizer` component changes appearance based on Ada's status (idle, listening, speaking).
    - The `WebcamFeed` component handles accessing the user's camera, displaying the feed (mirrored), and capturing frames.
    - Other widgets (`Weather`, `Map`, `Code`, `Search`) are displayed conditionally when relevant data is received from the backend.

## Backend Setup (Python)

1.  **Prerequisites:**

    - Python 3.7+ installed.
    - `pip` (Python package installer).

2.  **Create Environment (Recommended):**

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3.  **Install Dependencies:**
    Navigate to the directory containing `app.py` and `ADA_Online.py`. Create a `requirements.txt` file with the following content:

    ```
    Flask
    Flask-SocketIO
    python-dotenv
    google-generativeai
    torch # Or torch-cpu if no CUDA GPU
    python-weather
    googlemaps
    websockets
    googlesearch-python
    aiohttp
    beautifulsoup4
    lxml # Parser for BeautifulSoup
    requests # Often a dependency for googlemaps or others
    eventlet # Often needed by Flask-SocketIO for async
    ```

    Then run:

    ```bash
    pip install -r requirements.txt
    ```

    _(Note: `torch` installation might vary depending on your system and CUDA setup. Visit the PyTorch website for specific instructions if needed.)_

4.  **Configuration:** See the [Configuration](#configuration) section below.

## Frontend Setup (React)

1.  **Prerequisites:**

    - Node.js (which includes npm) installed. Recommended version: LTS.

2.  **Install Dependencies:**

    - Navigate to the root directory of your React project (where `package.json` is located, likely the parent directory of `src`).
    - If you don't have a `package.json` or haven't initialized the project, you might need to do so (e.g., using Create React App or Vite). Assuming you have one, run:

    ```bash
    npm install
    ```

    This will install React and other dependencies listed in your `package.json`. Based on the imports in `App.jsx`, you'll likely need at least:

    - `react`
    - `react-dom`
    - `socket.io-client`
    - `prop-types`
    - `react-youtube` (if using the `YouTubeWidget`)

    _(If you started with a template like Create React App or Vite, these might already be included or managed)._

## Configuration

1.  **Create `.env` file:** In the **backend** directory (same level as `app.py`), create a file named `.env`.
2.  **Add API Keys and Secrets:** Add the following lines to the `.env` file, replacing the placeholder values with your actual keys and desired settings:

    ```dotenv
    # Backend Keys
    ELEVENLABS_API_KEY="YOUR_ELEVENLABS_API_KEY"
    GOOGLE_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"
    MAPS_API_KEY="YOUR_Maps_API_KEY" # For Directions API
    FLASK_SECRET_KEY="a_strong_random_secret_key_here" # Change for production

    # Frontend Configuration (Used by backend for CORS)
    REACT_APP_PORT="5173" # The port your React app runs on (Default for Vite)
    ```

    - **`ELEVENLABS_API_KEY`**: Your API key from ElevenLabs for text-to-speech.
    - **`GOOGLE_API_KEY`**: Your Google AI Studio API key for the Gemini model.
    - **`MAPS_API_KEY`**: Your Google Cloud API key enabled for the Directions API.
    - **`FLASK_SECRET_KEY`**: A random secret key used by Flask for session management. Generate a strong random string for this.
    - **`REACT_APP_PORT`**: The port the React development server will run on. This is used by the Flask backend to configure CORS correctly, allowing the frontend to connect. Ensure this matches the port used when running the frontend (e.g., Vite defaults to 5173, Create React App to 3000).

## Running the Application

1.  **Start the Backend Server:**

    - Open a terminal or command prompt.
    - Navigate to the backend directory (containing `app.py`).
    - Activate the Python virtual environment (e.g., `source venv/bin/activate`).
    - Run the Flask application:
      ```bash
      python app.py
      ```
    - The server should start, typically on `http://0.0.0.0:5000`. Look for output indicating it's running and listening for connections.

2.  **Start the Frontend Development Server:**

    - Open a _separate_ terminal or command prompt.
    - Navigate to the frontend project's root directory (containing `package.json`).
    - Run the start script:
      ```bash
      npm run dev  # If using Vite (common)
      # OR
      # npm start    # If using Create React App
      ```
    - This will compile the React code and start the development server, usually opening the application automatically in your web browser (e.g., at `http://localhost:5173`).

3.  **Use the Application:**
    - The React app should connect to the Flask backend via SocketIO.
    - You can type messages or click the microphone button (if supported and permission granted) to talk to Ada.
    - Enable the webcam to send video frames for analysis with your prompts.

## Stopping the Application

1.  **Stop the Frontend Server:** Press `Ctrl + C` in the frontend terminal.
2.  **Stop the Backend Server:** Press `Ctrl + C` in the backend terminal.
