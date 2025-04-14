# ADA - Advanced Design Assistant Application

## Overview

This application is a conversational AI assistant named Ada, built with a Python backend (Flask, SocketIO, Google Gemini) and a React frontend. It supports text input, client-side speech-to-text (Web Speech API), text-to-speech (ElevenLabs), webcam video frame processing, and integrates with external APIs for weather (python_weather), maps/directions (googlemaps), and web search (googlesearch-python, aiohttp, BeautifulSoup). Communication between the frontend and backend happens in real-time using WebSockets (SocketIO).

## How it Works

1.  **Backend (`backend/app.py`, `backend/ADA_Online.py`):**

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

2.  **Frontend (`frontend/src/App.jsx`, components):**
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

## Getting Started

These instructions assume you have Git, Python 3.7+, pip, and Node.js (with npm) installed on your system.

1.  **Clone the Repository:**
    Open your terminal or command prompt and clone the project repository from its source (replace `<repository_url>` with the actual URL):

    ```bash
    git clone <repository_url>
    cd <repository_directory_name> # Navigate into the cloned project directory
    ```

2.  **Backend Setup:** Follow the steps in the [Backend Setup (Python)](#backend-setup-python) section.

3.  **Frontend Setup:** Follow the steps in the [Frontend Setup (React)](#frontend-setup-react) section.

4.  **Configuration:** Create and populate the `.env` file as described in the [Configuration](#configuration) section.

5.  **Run the Application:** Follow the steps in the [Running the Application](#running-the-application) section.

## Backend Setup (Python)

1.  **Navigate to Backend Directory:**
    From the root project directory you cloned, navigate into the backend folder:

    ```bash
    cd backend # Or the name of your backend directory
    ```

2.  **Create & Activate Virtual Environment:**
    It's highly recommended to use a virtual environment to manage dependencies.

    ```bash
    python -m venv venv
    source venv/bin/activate  # On Linux/macOS
    # OR
    # venv\Scripts\activate    # On Windows Command Prompt/PowerShell
    ```

    You should see `(venv)` prefixing your terminal prompt.

3.  **Install Dependencies:**
    Ensure you have a `requirements.txt` file in the `backend` directory with the following content:

    ```txt
    # requirements.txt
    Flask
    Flask-SocketIO
    python-dotenv
    google-generativeai
    torch # Or torch-cpu if no CUDA GPU / for simpler setup
    python-weather
    googlemaps
    websockets
    googlesearch-python
    aiohttp
    beautifulsoup4
    lxml # Parser for BeautifulSoup
    requests # Often a dependency
    eventlet # Recommended async mode for Flask-SocketIO
    ```

    Install the packages using pip:

    ```bash
    pip install -r requirements.txt
    ```

    _(Note: `torch` installation can be complex. If you encounter issues or don't have an NVIDIA GPU, consider using `torch-cpu` in `requirements.txt`. Visit the [PyTorch website](https://pytorch.org/) for specific installation instructions for your system if needed.)_

4.  **Configuration:**
    Make sure you have created the `.env` file inside this `backend` directory as detailed in the [Configuration](#configuration) section.

## Frontend Setup (React)

1.  **Navigate to Frontend Directory:**
    From the root project directory you cloned, navigate into the frontend folder:

    ```bash
    cd ../frontend # Or the name of your frontend directory (use 'cd ..' first if still in 'backend')
    ```

2.  **Install Dependencies:**
    This command reads the `package.json` file and installs all the necessary Node.js modules.
    ```bash
    npm install
    ```
    This will install React, `socket.io-client`, `react-youtube`, `prop-types`, and any other dependencies defined in `package.json`.

## Configuration

1.  **Locate Backend Directory:** Ensure you are in the **backend** directory (e.g., `cd backend` from the root project folder).
2.  **Create `.env` file:** Create a file named exactly `.env`.
3.  **Add API Keys and Secrets:** Open the `.env` file and add the following lines, replacing the placeholder values with your actual keys and desired settings:

    ```dotenv
    # --- Backend API Keys ---
    # Get from ElevenLabs website
    ELEVENLABS_API_KEY="YOUR_ELEVENLABS_API_KEY"

    # Get from Google AI Studio (for Gemini Models)
    GOOGLE_API_KEY="YOUR_GOOGLE_GEMINI_API_KEY"

    # Get from Google Cloud Console (Enabled for Directions API)
    MAPS_API_KEY="YOUR_Maps_API_KEY"

    # --- Flask Server Settings ---
    # Used for session security, generate a random string
    FLASK_SECRET_KEY="a_very_strong_and_random_secret_key_please_change_me"

    # --- Frontend Settings (for Backend CORS) ---
    # Port the React frontend development server runs on
    REACT_APP_PORT="5173" # Default for Vite. Use 3000 for Create React App, or your custom port.
    ```

    **Important:**

    - Never commit your `.env` file to Git. Add `.env` to your `.gitignore` file in the backend directory.
    - Ensure the `MAPS_API_KEY` corresponds to a Google Cloud project where the **Directions API** is enabled.
    - Ensure the `GOOGLE_API_KEY` is for **Google Gemini models** (available via Google AI Studio).
    - Generate a truly random and strong `FLASK_SECRET_KEY`.

## Running the Application

You will need two separate terminals open: one for the backend and one for the frontend.

1.  **Start the Backend Server:**

    - Open Terminal 1.
    - Navigate to the `backend` directory.
    - Activate the Python virtual environment: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows).
    - Run the Flask application:
      ```bash
      python app.py
      ```
    - Wait for output indicating the server is running (e.g., `* Running on http://0.0.0.0:5000` and WebSocket server started messages). Leave this terminal running.

2.  **Start the Frontend Development Server:**

    - Open Terminal 2.
    - Navigate to the `frontend` directory.
    - Run the start script (use the command appropriate for your project setup):
      ```bash
      npm run dev  # If using Vite (likely based on main.jsx structure)
      # OR
      # npm start    # If using Create React App
      ```
    - This should automatically open the application in your default web browser, pointing to `http://localhost:5173` (or the port specified in `REACT_APP_PORT` if configured differently).

3.  **Use the Application:**
    - Interact with the interface in your browser. Grant microphone and webcam permissions when prompted if you wish to use those features.

## Stopping the Application

1.  **Stop the Frontend Server:** Go to Terminal 2 (where the frontend is running) and press `Ctrl + C`. Confirm if prompted.
2.  **Stop the Backend Server:** Go to Terminal 1 (where the backend is running) and press `Ctrl + C`.
3.  **Deactivate Virtual Environment (Optional):** In Terminal 1, you can type `deactivate`.
