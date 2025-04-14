// src/components/YouTubeWidget.jsx (Revised for Backend Search)
import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useEffect, useRef
import YouTube from "react-youtube";
import PropTypes from "prop-types";
import "./YouTubeWidget.css";

// --- REMOVED --- Backend API Key and URL are no longer needed here
// const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY';
// const YOUTUBE_API_URL = 'https://www.youtube.com/watch?v=QY8dhl1EQfI2';

// <<< ADDED: Need socket prop >>>
function YouTubeWidget({ isVisible, onClose, socket, initialQuery }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Keep track if initial search was done to prevent re-searching on re-renders
  const initialSearchDone = useRef(false);

  // --- Listener for search results/errors from backend ---
  useEffect(() => {
    if (!socket?.current) return; // Need socket to listen

    const handleResults = (data) => {
      console.log("Received YouTube results:", data.results);
      setIsLoading(false);
      setError(null);
      setSearchResults(data.results || []); // Ensure array
    };

    const handleError = (data) => {
      console.error("Received Youtube error:", data.error);
      setIsLoading(false);
      setError(data.error || "An unknown error occurred during search.");
      setSearchResults([]); // Clear results on error
    };

    socket.current.on("Youtube_results", handleResults);
    socket.current.on("Youtube_error", handleError);

    // Cleanup listeners on unmount or socket change
    return () => {
      socket.current?.off("Youtube_results", handleResults);
      socket.current?.off("Youtube_error", handleError);
    };
  }, [socket]); // Re-run if socket changes

  // --- Function to request search from backend ---
  const requestSearchFromBackend = useCallback(() => {
    if (!searchQuery.trim()) return;
    if (!socket?.current?.connected) {
      setError("Cannot search: Not connected to backend.");
      return;
    }

    console.log(`Requesting Youtube for: '${searchQuery}'`);
    setIsLoading(true);
    setError(null);
    setSearchResults([]); // Clear previous results while loading new ones
    setSelectedVideoId(null); // Clear selected video

    // Emit event to backend
    socket.current.emit("perform_Youtube", { search_query: searchQuery });
  }, [searchQuery, socket]);

  // --- Handle initial query passed as prop ---
  useEffect(() => {
    // Only run if visible, an initial query exists, and hasn't run before
    if (
      isVisible &&
      initialQuery &&
      !initialSearchDone.current &&
      socket?.current?.connected
    ) {
      console.log(`Performing initial search for prop: '${initialQuery}'`);
      setSearchQuery(initialQuery); // Set the input field
      // Use a slight delay to ensure state update is processed before emitting
      setTimeout(() => {
        requestSearchFromBackend();
      }, 50);
      initialSearchDone.current = true; // Mark as done
    }
    // Reset if component becomes hidden or initial query changes
    if (!isVisible) {
      initialSearchDone.current = false;
    }
  }, [isVisible, initialQuery, requestSearchFromBackend, socket]); // Add socket dependency

  // --- Event Handlers for UI ---
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSearchKeyPress = (event) => {
    if (event.key === "Enter") {
      requestSearchFromBackend(); // Request search from backend
    }
  };

  const handleSearchButtonClick = () => {
    requestSearchFromBackend(); // Request search from backend
  };

  const handleVideoSelect = (videoId) => {
    setSelectedVideoId(videoId);
  };

  // Options for the react-youtube player (unchanged)
  const playerOptions = {
    height: "300",
    width: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
    },
  };

  const onPlayerReady = (event) => {
    console.log("Player is ready");
  };

  const onPlayerError = (event) => {
    console.error("YouTube Player Error:", event.data);
    setError(
      `Player Error: Code ${event.data}. Video might be unavailable or restricted.`
    );
    setSelectedVideoId(null);
  };

  if (!isVisible) {
    return null;
  }

  // --- JSX Structure (Mostly Unchanged) ---
  return (
    <div className="youtube-widget-container">
      <button
        onClick={onClose}
        className="youtube-widget-close-button"
        aria-label="Close YouTube Widget"
      >
        ×
      </button>
      <h4>Youtube & Play</h4>

      {/* Search Area - Uses requestSearchFromBackend now */}
      <div className="Youtube-area">
        <input
          type="text"
          className="Youtube-input"
          placeholder="Search YouTube..."
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyPress={handleSearchKeyPress}
          disabled={isLoading}
        />
        <button
          className="Youtube-button"
          onClick={handleSearchButtonClick} // Use new handler
          disabled={isLoading || !searchQuery.trim()}
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Error Display */}
      {error && <p className="youtube-error-message">{error}</p>}

      {/* Loading Indicator */}
      {isLoading && (
        <p className="youtube-loading-message">Loading results...</p>
      )}

      {/* Results and Player Area */}
      <div className="youtube-content-area">
        {/* Player */}
        {selectedVideoId && (
          <div className="youtube-player-wrapper">
            <YouTube
              videoId={selectedVideoId}
              opts={playerOptions}
              onReady={onPlayerReady}
              onError={onPlayerError}
              className="youtube-iframe"
            />
          </div>
        )}

        {/* Search Results */}
        {!isLoading && searchResults.length > 0 && (
          <div
            className={`youtube-results-list ${
              selectedVideoId ? "has-player" : ""
            }`}
          >
            <h5>Results:</h5>
            <ul>
              {searchResults.map(
                (item) =>
                  // Ensure item and snippet exist before accessing nested properties
                  item?.id?.videoId && item?.snippet ? (
                    <li
                      key={item.id.videoId}
                      onClick={() => handleVideoSelect(item.id.videoId)}
                      className={
                        selectedVideoId === item.id.videoId ? "selected" : ""
                      }
                    >
                      <img
                        src={item.snippet.thumbnails?.default?.url} // Safer access
                        alt={item.snippet.title || "Video thumbnail"} // Fallback alt text
                        width={
                          item.snippet.thumbnails?.default?.width
                            ? item.snippet.thumbnails.default.width / 1.5
                            : 80
                        } // Safer access with fallback size
                        height={
                          item.snippet.thumbnails?.default?.height
                            ? item.snippet.thumbnails.default.height / 1.5
                            : 45
                        }
                      />
                      <span title={item.snippet.title || ""}>
                        {item.snippet.title || "Untitled Video"}
                      </span>
                    </li>
                  ) : null // Skip rendering if essential data is missing
              )}
            </ul>
          </div>
        )}
        {!isLoading &&
          !error &&
          searchResults.length === 0 &&
          searchQuery &&
          !initialQuery && <p>No results found for "{searchQuery}".</p>}
      </div>
    </div>
  );
}

YouTubeWidget.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  socket: PropTypes.object, // <<< ADDED: socket prop is now needed
  initialQuery: PropTypes.string, // <<< ADDED: Optional initial query prop
};

// <<< ADDED: Default prop for initialQuery >>>
YouTubeWidget.defaultProps = {
  initialQuery: "",
};

export default YouTubeWidget;
