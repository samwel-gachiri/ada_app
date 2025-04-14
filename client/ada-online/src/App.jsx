// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";

// Import Components
import ChatBox from "./components/ChatBox";
import InputArea from "./components/InputArea";
import StatusDisplay from "./components/StatusDisplay";
import AiVisualizer, {
  STATUS as VISUALIZER_STATUS,
} from "./components/AiVisualizer";
import WebcamFeed from "./components/WebcamFeed";
import WeatherWidget from "./components/WeatherWidget";
import MapWidget from "./components/MapWidget";
import CodeExecutionWidget from "./components/CodeExecutionWidget";
import SearchResultsWidget from "./components/SearchResultsWidget"; // **** IMPORT NEW WIDGET ****

// Import CSS
import "./App.css";
import "./components/ChatBox.css";
import "./components/InputArea.css";
import "./components/StatusDisplay.css";
import "./components/WebcamFeed.css";
import "./components/MapWidget.css";
import "./components/CodeExecutionWidget.css";
import "./components/SearchResultsWidget.css"; // **** IMPORT NEW CSS ****
// import './components/Visualizer.module.css'; // Already imported via AiVisualizer

// Constants
const SERVER_URL = "http://localhost:5000"; // Adjust if your server runs elsewhere

function App() {
  console.log("--- App component rendered ---");

  // --- State Variables ---
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [statusText, setStatusText] = useState("Initializing...");
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);
  const [mapInfo, setMapInfo] = useState(null);
  const [visualizerStatus, setVisualizerStatus] = useState(
    VISUALIZER_STATUS.IDLE
  );
  const [showWebcam, setShowWebcam] = useState(false);
  const [executableCode, setExecutableCode] = useState(null);
  const [codeLanguage, setCodeLanguage] = useState(null);
  // **** ADD SEARCH RESULTS STATE ****
  const [searchInfo, setSearchInfo] = useState(null); // Holds {query: '...', results: [...]}
  // **** END SEARCH RESULTS STATE ****

  // --- Refs ---
  const socket = useRef(null);
  const recognition = useRef(null);
  const audioContext = useRef(null);
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);
  const userRequestedStop = useRef(false);
  const restartTimer = useRef(null);
  const adaMessageIndex = useRef(-1);
  const isMutedRef = useRef(isMuted);
  const isListeningRef = useRef(isListening);
  const startRecognitionRef = useRef();
  const isConnectedRef = useRef(isConnected);
  const playNextAudioChunkRef = useRef();

  // --- Footer Time ---
  const getCurrentTime = () => {
    return new Date().toLocaleString("en-US", {
      // Note: Changed timeZone to reflect your actual location based on context
      timeZone: "America/New_York", // e.g., 'America/New_York' for Smyrna, GA
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
    });
  };
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(getCurrentTime()), 1000);
    return () => clearInterval(timerId);
  }, []);

  // --- AudioContext Management (Callbacks) ---
  const initializeAudioContext = useCallback(() => {
    if (!audioContext.current) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.error("Web Audio API not supported.");
          setStatusText((prev) => `${prev} (Audio Playback Not Supported)`);
          return false;
        }
        audioContext.current = new AudioCtx({ sampleRate: 24000 });
        console.log("AudioContext created. State:", audioContext.current.state);
        if (audioContext.current.state === "suspended") {
          console.log("AudioContext suspended...");
          setStatusText("Click page or button to enable audio.");
        }
        return true;
      } catch (e) {
        console.error("Error creating AudioContext:", e);
        setStatusText("Browser Audio Error.");
        return false;
      }
    }
    return true;
  }, []);
  const resumeAudioContext = useCallback(async () => {
    if (audioContext.current && audioContext.current.state === "suspended") {
      try {
        console.log("Attempting to resume AudioContext...");
        await audioContext.current.resume();
        console.log("AudioContext resumed. State:", audioContext.current.state);
        setStatusText((prev) =>
          prev === "Click page or button to enable audio."
            ? "Audio enabled."
            : prev
        );
        // Check ref before calling
        if (
          audioQueue.current.length > 0 &&
          !isPlaying.current &&
          playNextAudioChunkRef.current
        ) {
          playNextAudioChunkRef.current();
        }
      } catch (e) {
        console.error("Error resuming AudioContext:", e);
        setStatusText("Failed to enable audio.");
      }
    }
  }, []);

  // --- Audio Playback Logic ---
  const playNextAudioChunk = useCallback(async () => {
    if (isPlaying.current || audioQueue.current.length === 0) return;
    if (
      !audioContext.current ||
      !["running", "suspended"].includes(audioContext.current.state)
    ) {
      console.warn("AudioContext not initialized or closed. Cannot play.");
      initializeAudioContext(); // Attempt to re-initialize
      return;
    }
    if (audioContext.current.state === "suspended") {
      await resumeAudioContext();
      if (audioContext.current.state !== "running") {
        console.warn(
          "AudioContext still suspended after resume attempt. Playback skipped."
        );
        return;
      }
    }

    isPlaying.current = true;
    setVisualizerStatus(VISUALIZER_STATUS.SPEAKING);
    setStatusText("Ada is speaking...");
    const base64Chunk = audioQueue.current.shift();

    try {
      const binaryString = window.atob(base64Chunk);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      // Assuming PCM 16-bit signed little-endian (common from ElevenLabs pcm_24000)
      const pcmData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0; // Convert to [-1.0, 1.0] range
      }
      const audioBuffer = audioContext.current.createBuffer(
        1, // Number of channels
        floatData.length,
        audioContext.current.sampleRate
      );
      audioBuffer.copyToChannel(floatData, 0); // Channel 0

      const source = audioContext.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.current.destination);
      source.onended = () => {
        isPlaying.current = false;
        if (audioQueue.current.length === 0) {
          // Only set idle if not actively listening
          if (!isListeningRef.current) {
            setVisualizerStatus(VISUALIZER_STATUS.IDLE);
          }
          // Update status based on current state
          setStatusText(
            isMutedRef.current
              ? "Muted."
              : isConnectedRef.current
              ? "Ready."
              : "Disconnected."
          );
        }
        // Check ref before calling
        if (playNextAudioChunkRef.current) {
          playNextAudioChunkRef.current();
        }
      };
      source.start(); // Play the sound now
    } catch (error) {
      console.error("Error processing or playing audio chunk:", error);
      isPlaying.current = false;
      // Only set idle if not actively listening
      if (!isListeningRef.current) {
        setVisualizerStatus(VISUALIZER_STATUS.IDLE);
      }
      // Check ref before calling
      if (playNextAudioChunkRef.current) {
        playNextAudioChunkRef.current();
      }
    }
  }, [initializeAudioContext, resumeAudioContext]);

  // --- Web Speech API (STT) Management (Callbacks) ---
  const startRecognition = useCallback(() => {
    console.log(
      `DEBUG: Attempting startRecognition. Conditions - isListening: ${
        isListeningRef.current
      }, recognition.current: ${!!recognition.current}, isMuted: ${
        isMutedRef.current
      }, micSupported: ${micSupported}`
    );
    // Ensure audio context is running before starting recognition
    if (audioContext.current?.state === "suspended") {
      resumeAudioContext();
    }

    if (
      !isListeningRef.current &&
      recognition.current &&
      !isMutedRef.current &&
      micSupported
    ) {
      try {
        userRequestedStop.current = false; // Reset stop flag
        console.log("DEBUG: Calling recognition.start()");
        recognition.current.start();
        // Status updated in onstart handler
      } catch (e) {
        // Handle potential errors like "recognition already started"
        console.error("DEBUG: Error calling recognition.start():", e);
        // If it failed because it was already started, we might not need to change state
        // If it failed for other reasons, update status
        if (e.name !== "InvalidStateError") {
          // Common error if already started
          setStatusText("Mic Error - Could not start.");
        }
      }
    } else {
      console.log("DEBUG: recognition.start() skipped or conditions not met.");
    }
  }, [micSupported, resumeAudioContext]); // Added resumeAudioContext dependency

  const stopRecognition = useCallback((forceStop = false) => {
    if (recognition.current) {
      // Only stop if it's actually listening
      if (isListeningRef.current) {
        console.log(
          `DEBUG: Calling recognition.stop(). Force stop: ${forceStop}`
        );
        userRequestedStop.current = forceStop || isMutedRef.current; // Flag that stop was intentional or due to mute
        try {
          recognition.current.stop(); // This will trigger the 'onend' event
        } catch (e) {
          console.error("Error calling recognition.stop():", e);
          // If stopping failed, we might need to manually reset state, though unlikely
        }
      } else {
        console.log(
          "DEBUG: stopRecognition called but not currently listening."
        );
        // Still set the flag if forcing stop, maybe to prevent immediate restart
        if (forceStop) userRequestedStop.current = true;
      }
    } else {
      console.log(
        "DEBUG: stopRecognition called but recognition object doesn't exist."
      );
      if (forceStop) userRequestedStop.current = true;
    }
  }, []); // isMutedRef is read inside, no need for dependency if logic relies on ref

  // --- Effect to keep refs updated ---
  useEffect(() => {
    // Keep refs in sync with the latest state values
    isMutedRef.current = isMuted;
    isListeningRef.current = isListening;
    isConnectedRef.current = isConnected;
    // Store callbacks in refs to avoid dependency issues in other useEffects
    startRecognitionRef.current = startRecognition;
    playNextAudioChunkRef.current = playNextAudioChunk;
  }); // Runs after every render

  // --- Effect to Initialize Web Speech API ---
  useEffect(() => {
    console.log("--- Speech Recognition useEffect SETUP ---");
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("Web Speech API not supported in this browser.");
      setStatusText("Speech recognition not supported.");
      setMicSupported(false);
      setIsMuted(true); // Force mute if not supported
      return; // Exit effect early
    }

    setMicSupported(true); // Mic API exists

    // Initialize only once
    if (!recognition.current) {
      recognition.current = new SpeechRecognitionAPI();
      recognition.current.continuous = false; // Process speech after pauses
      recognition.current.interimResults = true; // Get results while speaking
      recognition.current.lang = "en-US"; // Set language
      console.log("SpeechRecognition instance created.");
    }

    let finalTranscriptForCycle = ""; // Store final transcript for the current speech segment

    // --- Event Handlers for Recognition ---
    const handleStart = () => {
      console.log("DEBUG: recognition.onstart fired.");
      setIsListening(true);
      finalTranscriptForCycle = ""; // Reset transcript for new cycle
      setStatusText("Listening...");
      setVisualizerStatus(VISUALIZER_STATUS.LISTENING);
    };

    const handleResult = (event) => {
      let interimTranscript = "";
      let cycleFinalTranscript = ""; // Use local variable within handler scope
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          cycleFinalTranscript += transcriptPart; // Append final parts
        } else {
          interimTranscript += transcriptPart; // Append interim parts
        }
      }
      // Update the cycle's final transcript if we got a new final part
      if (cycleFinalTranscript) {
        finalTranscriptForCycle = cycleFinalTranscript.trim();
      }
      // Optional: Display interim transcript visually if needed
      // console.log("Interim:", interimTranscript);
    };

    const handleSpeechEnd = () => {
      console.log("DEBUG: recognition.onspeechend fired.");
      // Called when speech detected by the recognition service has stopped
      // Recognition might still be processing. Don't stop recognition here.
      // Status might briefly change to "Processing..." but often 'onend' follows quickly.
      setStatusText("Processing speech...");
    };

    const handleError = (event) => {
      console.error(
        "DEBUG: recognition.onerror fired:",
        event.error,
        event.message
      );
      clearTimeout(restartTimer.current); // Stop any pending restarts
      setIsListening(false); // Update listening state
      // Set visualizer to idle only if Ada isn't speaking
      if (!isPlaying.current) {
        setVisualizerStatus(VISUALIZER_STATUS.IDLE);
      }

      // Handle specific errors
      if (event.error === "no-speech") {
        setStatusText("No speech detected.");
        userRequestedStop.current = false; // Allow potential restart
      } else if (event.error === "audio-capture") {
        setStatusText("Mic Error: Audio capture issue.");
        userRequestedStop.current = true; // Prevent restart
      } else if (event.error === "not-allowed") {
        setStatusText("Mic permission denied.");
        userRequestedStop.current = true; // Prevent restart
        setIsMuted(true); // Reflect denied state in UI
      } else {
        setStatusText(`Speech Error: ${event.error}`);
        userRequestedStop.current = true; // Prevent restart for other errors
      }
    };

    const handleEnd = () => {
      console.log("DEBUG: recognition.onend fired.");
      setIsListening(false); // No longer listening
      // Set visualizer to idle only if Ada isn't speaking
      if (!isPlaying.current) {
        setVisualizerStatus(VISUALIZER_STATUS.IDLE);
      }

      // Process the final transcript collected during the cycle
      const processedTranscript = finalTranscriptForCycle.trim();
      finalTranscriptForCycle = ""; // Clear for the next potential cycle

      clearTimeout(restartTimer.current); // Clear any pending restart timer

      // Send transcript if valid, not muted, and stop wasn't manually requested
      if (
        processedTranscript &&
        !userRequestedStop.current &&
        !isMutedRef.current
      ) {
        console.log("DEBUG: Sending transcript:", processedTranscript);
        setMessages((prev) => [
          ...prev,
          { sender: "user", text: processedTranscript },
        ]);
        adaMessageIndex.current = -1; // Reset index for next Ada message
        if (socket.current?.connected) {
          socket.current.emit("send_transcribed_text", {
            transcript: processedTranscript,
          });
        }
        setStatusText("Waiting for Ada..."); // Update status
      } else {
        // Update status if no transcript sent (e.g., muted, stopped, empty)
        if (isMutedRef.current) setStatusText("Muted.");
        else if (!processedTranscript && !userRequestedStop.current)
          setStatusText("Ready to listen...");
        // If userRequestedStop, status might already be set by handleToggleMute or handleError
      }

      // Auto-restart logic: If not muted and not intentionally stopped, try restarting after a short delay
      if (!isMutedRef.current && !userRequestedStop.current) {
        restartTimer.current = setTimeout(() => {
          // Check conditions again *inside* the timeout
          if (
            !isMutedRef.current &&
            !isListeningRef.current &&
            recognition.current &&
            startRecognitionRef.current
          ) {
            console.log("DEBUG: Attempting auto-restart via ref...");
            startRecognitionRef.current();
          } else {
            console.log(
              "DEBUG: Auto-restart skipped inside timeout (conditions changed)."
            );
          }
        }, 300); // Short delay before restarting
      } else {
        console.log(
          `DEBUG: Restart skipped. Muted: ${isMutedRef.current}, Stop Requested: ${userRequestedStop.current}`
        );
      }
    };

    // --- Assign Handlers ---
    recognition.current.onstart = handleStart;
    recognition.current.onresult = handleResult;
    recognition.current.onspeechend = handleSpeechEnd; // Useful for intermediate state
    recognition.current.onerror = handleError;
    recognition.current.onend = handleEnd;

    // --- Cleanup Function ---
    return () => {
      console.log("--- Speech Recognition useEffect CLEANUP ---");
      clearTimeout(restartTimer.current); // Clear timer on unmount
      if (recognition.current) {
        // Attempt to abort if it's running (might prevent errors on rapid unmount/remount)
        try {
          recognition.current.abort();
          console.log("SpeechRecognition aborted during cleanup.");
        } catch (e) {
          console.warn("Could not abort SpeechRecognition during cleanup:", e);
        }
        // Remove all event listeners
        recognition.current.onstart = null;
        recognition.current.onresult = null;
        recognition.current.onspeechend = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current = null; // Release the object
        console.log("SpeechRecognition instance cleaned up.");
      }
    };
  }, []); // Empty dependency array: Initialize and clean up only once

  // --- Socket.IO Connection Effect ---
  useEffect(() => {
    console.log("--- Socket.IO useEffect SETUP ---");
    // Connect to the server
    socket.current = io(SERVER_URL, {
      reconnectionAttempts: 5, // Try to reconnect a few times
      transports: ["websocket"], // Prefer WebSocket
    });

    // --- Socket Event Handlers ---
    const handleConnect = () => {
      console.log("Socket connected:", socket.current.id);
      setIsConnected(true);
      // Update status based on mute state
      setStatusText(
        isMutedRef.current ? "Connected. Mic is Muted." : "Connected. Ready."
      );
      // Attempt to start recognition if not muted
      if (!isMutedRef.current && startRecognitionRef.current) {
        startRecognitionRef.current();
      }
    };

    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      setStatusText("Disconnected.");
      // Stop processes that rely on connection
      stopRecognition(true); // Force stop recognition
      isPlaying.current = false; // Stop audio playback flag
      audioQueue.current = []; // Clear any pending audio
      setVisualizerStatus(VISUALIZER_STATUS.IDLE); // Reset visualizer
      // Clear widgets that depend on live data potentially
      // setWeatherInfo(null);
      // setMapInfo(null);
      // setSearchInfo(null);
      // setExecutableCode(null);
    };

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error);
      setIsConnected(false);
      setStatusText(`Connection Error`);
      setVisualizerStatus(VISUALIZER_STATUS.IDLE); // Reset visualizer
    };

    // Handles general status updates from the backend
    const handleStatus = (data) => {
      // Only update status if not actively listening or speaking, and not muted
      if (
        !isListeningRef.current &&
        !isPlaying.current &&
        !isMutedRef.current &&
        isConnectedRef.current // Check connection ref
      ) {
        setStatusText(data.message || "Ready."); // Use message or default
      }
    };

    // Handles specific error events from the backend
    const handleErrorEvent = (data) => {
      console.error("Backend Server Error:", data.message);
      setStatusText(`Assistant Error: ${data.message}`);
      stopRecognition(true); // Stop listening on error
      setVisualizerStatus(VISUALIZER_STATUS.IDLE); // Reset visualizer
    };

    // Handles incoming text chunks for Ada's response
    const handleTextChunk = (data) => {
      if (!data || !data.text) return; // Ignore empty chunks
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        // Check if the last message is from Ada and append, or add new message
        if (
          adaMessageIndex.current !== -1 && // Ensure index is valid
          adaMessageIndex.current < newMessages.length && // Bounds check
          newMessages[adaMessageIndex.current]?.sender === "ada"
        ) {
          newMessages[adaMessageIndex.current].text += data.text;
        } else {
          // Add a new message entry for Ada
          newMessages.push({ sender: "ada", text: data.text });
          adaMessageIndex.current = newMessages.length - 1; // Update index
        }
        return newMessages;
      });
    };

    // Handles incoming audio chunks for Ada's speech
    const handleAudioChunk = (data) => {
      if (!data || !data.audio) return; // Ignore empty chunks
      if (audioContext.current) {
        audioQueue.current.push(data.audio);
        // Start playback if not already playing
        if (!isPlaying.current && playNextAudioChunkRef.current) {
          playNextAudioChunkRef.current();
        }
      } else {
        console.warn("Received audio chunk but AudioContext not ready.");
        // Optional: Attempt to initialize here if critical, but might cause issues
        // initializeAudioContext();
      }
    };

    // **** ADD WEATHER UPDATE HANDLER ****
    const handleWeatherUpdate = (data) => {
      console.log("Received weather update:", data);
      if (data && data.location) {
        // Basic validation
        setWeatherInfo(data); // Update state with the weather data object
      } else {
        console.warn("Received invalid weather update data:", data);
      }
    };

    // ++++ ADD MAP UPDATE HANDLER ++++
    const handleMapUpdate = (data) => {
      console.log("Received map update:", data);
      if (data && data.destination) {
        // Basic validation
        setMapInfo(data); // Update state with the map data object
      } else {
        console.warn("Received invalid map update data:", data);
      }
    };

    // <<< --- NEW LISTENER for executable code --- >>>
    const handleExecutableCode = (data) => {
      console.log("Received executable code:", data);
      if (data && data.code) {
        setExecutableCode(data.code);
        setCodeLanguage(data.language || "code"); // Store language, default to 'code'
        // No need to manage showCodeWidget state, rendering handles it
      } else {
        console.warn(
          "Received executable_code_received event with invalid data:",
          data
        );
        // Optionally clear the code widget if invalid data is received
        // setExecutableCode(null);
        // setCodeLanguage(null);
      }
    };

    // **** ADD SEARCH RESULTS LISTENER ****
    const handleSearchResultsUpdate = (data) => {
      console.log("Received search results update:", data);
      // Expecting data format: { query: "...", results: [{ url: "...", title: "..." }, ...] }
      if (data && Array.isArray(data.results)) {
        // Check if results is an array
        setSearchInfo(data); // Store the whole object {query: ..., results: ...}
      } else {
        console.warn(
          "Received search_results_update with invalid data structure:",
          data
        );
        // Optionally set empty results to still show the widget with a message
        setSearchInfo({ query: data?.query || "Search", results: [] });
      }
    };

    // --- Assign Socket Listeners ---
    socket.current.on("connect", handleConnect);
    socket.current.on("disconnect", handleDisconnect);
    socket.current.on("connect_error", handleConnectError);
    socket.current.on("status", handleStatus);
    socket.current.on("error", handleErrorEvent);
    socket.current.on("receive_text_chunk", handleTextChunk);
    socket.current.on("receive_audio_chunk", handleAudioChunk);
    socket.current.on("weather_update", handleWeatherUpdate); // Listen for weather
    socket.current.on("map_update", handleMapUpdate); // Listen for map
    socket.current.on("executable_code_received", handleExecutableCode); // Listen for code
    socket.current.on("search_results_update", handleSearchResultsUpdate); // Listen for search results

    // --- Cleanup Function ---
    return () => {
      console.log("--- Socket.IO useEffect CLEANUP ---");
      if (socket.current) {
        // Remove all listeners
        socket.current.off("connect", handleConnect);
        socket.current.off("disconnect", handleDisconnect);
        socket.current.off("connect_error", handleConnectError);
        socket.current.off("status", handleStatus);
        socket.current.off("error", handleErrorEvent);
        socket.current.off("receive_text_chunk", handleTextChunk);
        socket.current.off("receive_audio_chunk", handleAudioChunk);
        socket.current.off("weather_update", handleWeatherUpdate);
        socket.current.off("map_update", handleMapUpdate);
        socket.current.off("executable_code_received", handleExecutableCode);
        socket.current.off("search_results_update", handleSearchResultsUpdate);

        // Disconnect the socket
        socket.current.disconnect();
        socket.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array: Run only once on mount

  // --- Effect for Initializing and Resuming AudioContext ---
  useEffect(() => {
    console.log("--- AudioContext useEffect SETUP ---");
    const audioSupported = initializeAudioContext(); // Initialize on mount

    // Handler to resume context on user interaction
    const resumeHandler = () => {
      if (audioSupported) {
        // Only resume if supported
        resumeAudioContext();
      }
    };

    // Add listeners for user interaction
    document.addEventListener("click", resumeHandler);
    document.addEventListener("touchend", resumeHandler, { passive: true }); // Use passive for touch

    // --- Cleanup Function ---
    return () => {
      console.log("--- AudioContext useEffect CLEANUP ---");
      // Remove interaction listeners
      document.removeEventListener("click", resumeHandler);
      document.removeEventListener("touchend", resumeHandler);

      // Close the AudioContext
      if (audioContext.current) {
        audioContext.current
          .close()
          .then(() => console.log("AudioContext closed successfully."))
          .catch((e) => console.error("Error closing AudioContext:", e));
        audioContext.current = null; // Clear the ref
      }
    };
  }, [initializeAudioContext, resumeAudioContext]); // Depend on the callback functions

  // --- Effect to Start/Stop Recognition When Mute State Changes ---
  useEffect(() => {
    console.log(
      `DEBUG: Effect for isMuted change. isMuted: ${isMuted}, isConnected: ${isConnected}`
    );
    if (isConnected) {
      // Only act if connected
      if (!isMuted) {
        // If unmuting, attempt to start recognition (if supported and ref exists)
        if (
          startRecognitionRef.current &&
          micSupported &&
          !isListeningRef.current
        ) {
          console.log(
            "DEBUG: isMuted changed to false, calling startRecognition..."
          );
          startRecognitionRef.current();
        } else {
          console.log(
            "DEBUG: isMuted changed to false, but skipping startRecognition call (already listening or not supported)."
          );
        }
      } else {
        // If muting, stop recognition
        console.log(
          "DEBUG: isMuted changed to true, calling stopRecognition..."
        );
        // No need to force stop here, `stopRecognition` handles the logic
        if (stopRecognition) {
          // Check if function exists before calling
          stopRecognition();
        }
        // Update visualizer and status immediately on mute
        if (!isPlaying.current) {
          // Only change if not speaking
          setVisualizerStatus(VISUALIZER_STATUS.IDLE);
        }
        setStatusText("Muted.");
      }
    } else {
      // If disconnected, ensure visualizer is idle when muted/unmuted
      if (!isPlaying.current) {
        setVisualizerStatus(VISUALIZER_STATUS.IDLE);
      }
      setStatusText("Disconnected.");
    }
    // Add stopRecognition to dependency array as it's used directly
  }, [isMuted, isConnected, micSupported, stopRecognition]);

  // --- Component Event Handlers ---

  // Send text message handler
  const handleSendText = useCallback(
    (text) => {
      if (text && socket.current?.connected) {
        console.log("Sending text:", text);
        const wasListening = isListeningRef.current; // Check if was listening before stopping

        // Stop recognition temporarily to send text
        if (stopRecognition) stopRecognition(); // Use the function directly

        // Update messages UI
        setMessages((prev) => [...prev, { sender: "user", text: text }]);
        adaMessageIndex.current = -1; // Reset Ada message index

        // Emit text message to backend
        socket.current.emit("send_text_message", { message: text });
        setStatusText("Waiting for Ada..."); // Update status

        // Restart recognition if it was listening before and isn't muted now
        clearTimeout(restartTimer.current); // Clear previous restart timer
        if (
          wasListening &&
          !isMutedRef.current &&
          micSupported &&
          startRecognitionRef.current
        ) {
          // Restart after a short delay to allow message sending
          restartTimer.current = setTimeout(() => {
            // Check conditions again inside timeout
            if (!isMutedRef.current && !isListeningRef.current) {
              startRecognitionRef.current();
            }
          }, 500);
        } else if (!isMutedRef.current && isConnectedRef.current) {
          // If wasn't listening but is unmuted, set status back to ready
          setStatusText("Ready.");
        }
      }
    },
    [micSupported, stopRecognition] // Include stopRecognition in dependencies
  );

  // Toggle microphone mute state
  const handleToggleMute = useCallback(() => {
    console.log(
      `DEBUG: handleToggleMute called. Current isMuted (from state): ${isMuted}`
    );
    // Ensure audio context is active
    resumeAudioContext();

    // Update state - the useEffect for isMuted will handle starting/stopping recognition
    setIsMuted((prevMuted) => !prevMuted);

    // Note: Visualizer and status text updates are now primarily handled
    // by the isMuted useEffect to simplify logic here.
    // We just trigger the state change.
  }, [isMuted, resumeAudioContext]); // Depend on isMuted and resumeAudioContext

  // Toggle webcam visibility
  const handleToggleWebcam = useCallback(() => {
    console.log("Toggling webcam visibility");
    setShowWebcam((prevShow) => {
      const becomingHidden = !prevShow; // Is the webcam turning OFF now?
      // Emit event *before* changing state if turning off
      if (becomingHidden && socket.current?.connected) {
        console.log("Emitting video_feed_stopped event.");
        socket.current.emit("video_feed_stopped");
      }
      return !prevShow; // Return the new state value
    });
  }, []); // Dependencies: empty, as socket.current is a stable ref

  // Close handler for Code Widget
  const handleCloseCodeWidget = useCallback(() => {
    setExecutableCode(null); // Clear code data
    setCodeLanguage(null); // Clear language
  }, []);

  // **** ADD CLOSE HANDLER FOR SEARCH WIDGET ****
  const handleCloseSearchResultsWidget = useCallback(() => {
    setSearchInfo(null); // Clear the data to hide the widget
  }, []);
  // **** END CLOSE HANDLER ****

  // --- Render JSX ---
  return (
    <div className="app-container">
      <h1>A.D.A</h1>
      <AiVisualizer status={visualizerStatus} />
      <StatusDisplay status={statusText} />
      <ChatBox messages={messages} />
      <InputArea
        onSendText={handleSendText}
        isMuted={isMuted}
        isListening={isListening} // Pass isListening for button text/style if needed
        onToggleMute={handleToggleMute}
        micSupported={micSupported}
        isWebcamVisible={showWebcam}
        onToggleWebcam={handleToggleWebcam}
      />

      {/* Widgets Area - Render conditionally based on state */}
      <WebcamFeed
        isVisible={showWebcam}
        onClose={handleToggleWebcam}
        socket={socket} // Pass socket ref to WebcamFeed
      />

      {/* WeatherWidget always tries to render, but returns null if no data */}
      <WeatherWidget weatherData={weatherInfo} />

      {/* MapWidget always tries to render, but returns null if no data */}
      <MapWidget mapData={mapInfo} />

      {/* CodeExecutionWidget renders only when executableCode has data */}
      {executableCode && (
        <CodeExecutionWidget
          code={executableCode}
          language={codeLanguage}
          onClose={handleCloseCodeWidget}
        />
      )}

      {/* **** RENDER SEARCH RESULTS WIDGET CONDITIONALLY **** */}
      {/* Renders only when searchInfo has data (results array might be empty) */}
      {searchInfo && (
        <SearchResultsWidget
          searchData={searchInfo}
          onClose={handleCloseSearchResultsWidget}
        />
      )}
      {/* **** END SEARCH RESULTS WIDGET RENDER **** */}

      <footer>
        {/* Updated Location */}
        <p>Location: Smyrna, Georgia</p>
        <p>Current Time: {currentTime}</p>
      </footer>
    </div>
  );
}

export default App;
