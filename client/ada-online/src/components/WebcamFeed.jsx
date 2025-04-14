// src/components/WebcamFeed.jsx
import React, { useRef, useEffect, useState, useCallback } from "react"; // Added useCallback
import PropTypes from "prop-types";
import "./WebcamFeed.css";

// **** ADD SOCKET PROP ****
function WebcamFeed({ isVisible, onClose, socket }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null); // **** ADD CANVAS REF ****
  const intervalRef = useRef(null); // **** ADD INTERVAL REF ****
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // **** FUNCTION TO CAPTURE AND SEND FRAME ****
  const captureAndSendFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !socket?.current || // Check if socket ref and current exist
      videoRef.current.readyState < videoRef.current.HAVE_METADATA // Ensure video is ready
    ) {
      // console.log("Video or canvas not ready, or socket unavailable.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas dimensions to match video (or desired capture size)
    const captureWidth = video.videoWidth;
    const captureHeight = video.videoHeight;
    if (canvas.width !== captureWidth) canvas.width = captureWidth;
    if (canvas.height !== captureHeight) canvas.height = captureHeight;

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Get frame as base64 encoded JPEG
      // Use a lower quality (e.g., 0.7) to reduce data size
      const frameDataUrl = canvas.toDataURL("image/jpeg", 0.7);

      // Send frame data via socket
      if (socket.current.connected) {
        // console.log("Sending video frame..."); // Optional: for debugging
        socket.current.emit("send_video_frame", { frame: frameDataUrl });
      }
    } catch (e) {
      console.error("Error converting canvas to data URL:", e);
      // Handle cases where canvas might be tainted (though unlikely with webcam)
    }
  }, [socket]); // Dependency: socket

  useEffect(() => {
    if (!isVisible) {
      // Stop the stream and interval when hidden
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        console.log("Webcam stream stopped.");
      }
      // **** CLEAR INTERVAL ****
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("Frame capture interval cleared.");
      }
      setHasError(false);
      return;
    }

    const startWebcam = async () => {
      if (streamRef.current) return;

      setHasError(false);
      setErrorMessage("");
      console.log("Attempting to start webcam...");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            /* constraints */
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Wait for video metadata to load before playing and starting interval
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current.play();
              console.log("Webcam stream started and playing.");
              // **** START INTERVAL AFTER VIDEO IS PLAYING ****
              if (intervalRef.current) clearInterval(intervalRef.current); // Clear previous just in case
              intervalRef.current = setInterval(captureAndSendFrame, 1000); // Capture every second
              console.log("Frame capture interval started.");
            } catch (playError) {
              console.error("Error playing video stream:", playError);
              setHasError(true);
              setErrorMessage("Could not play video stream.");
              // Cleanup
              stream.getTracks().forEach((track) => track.stop());
              streamRef.current = null;
              videoRef.current.srcObject = null;
            }
          };
        } else {
          // ... (cleanup if videoRef not ready)
          console.warn("Video element not available after getting stream...");
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      } catch (err) {
        // ... (error handling remains the same) ...
        console.error("Error accessing webcam:", err);
        setHasError(true);
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setErrorMessage("Webcam permission denied...");
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          setErrorMessage("No webcam found.");
        } else {
          setErrorMessage("Could not access webcam. Error: " + err.message);
        }
        // Ensure cleanup on error
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };

    startWebcam();

    // Cleanup function
    return () => {
      if (streamRef.current) {
        console.log("Cleanup: Stopping webcam stream.");
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      // **** CLEAR INTERVAL ON CLEANUP ****
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("Cleanup: Frame capture interval cleared.");
      }
    };
    // **** ADD captureAndSendFrame to dependency array ****
  }, [isVisible, captureAndSendFrame]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="webcam-feed-container">
      {/* **** ADD HIDDEN CANVAS **** */}
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      {hasError ? (
        <div className="webcam-error">
          {/* ... error display ... */}
          <p>{errorMessage}</p>
          <button onClick={onClose} className="webcam-close-button error-close">
            Close
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="webcam-video"
          ></video>
          <button
            onClick={onClose}
            className="webcam-close-button"
            aria-label="Close Webcam Feed"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

WebcamFeed.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  socket: PropTypes.object, // **** ADD SOCKET PROP TYPE **** (consider shape if possible)
};

export default WebcamFeed;
