// src/components/WeatherWidget.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "./WeatherWidget.css"; // Make sure CSS is imported

function WeatherWidget({ weatherData }) {
  const [isVisible, setIsVisible] = useState(true); // State to control visibility
  const [isDragging, setIsDragging] = useState(false);
  // Start near the top-left corner
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null); // Ref to the widget element

  // --- NEW: Effect to reset visibility on new data ---
  useEffect(() => {
    // If new, valid weather data arrives, make the widget visible again
    if (weatherData && weatherData.location) {
      console.log("New weather data received, ensuring widget is visible.");
      setIsVisible(true);
      // Optionally reset position here if desired:
      // setPosition({ x: 20, y: 20 });
    } else {
      // Optionally hide if data becomes null (e.g., on disconnect/error)
      // setIsVisible(false);
    }
  }, [weatherData]); // Re-run this effect whenever weatherData prop changes

  const handleMouseDown = useCallback((e) => {
    if (!widgetRef.current) return;
    // Prevent dragging if clicking on the close button itself
    if (e.target.classList.contains("weather-widget-close-button")) {
      return;
    }

    setIsDragging(true);
    const rect = widgetRef.current.getBoundingClientRect();
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    // Add class for grabbing cursor
    widgetRef.current.classList.add("dragging");
    // Prevent text selection while dragging
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !widgetRef.current) return;

      // Calculate new top-left corner position
      const newX = e.clientX - offset.x;
      const newY = e.clientY - offset.y;

      // Optional: Boundary checks (uncomment if you want to keep it within viewport)
      // const maxX = window.innerWidth - widgetRef.current.offsetWidth;
      // const maxY = window.innerHeight - widgetRef.current.offsetHeight;
      // const boundedX = Math.max(0, Math.min(newX, maxX));
      // const boundedY = Math.max(0, Math.min(newY, maxY));
      // setPosition({ x: boundedX, y: boundedY });

      setPosition({ x: newX, y: newY }); // Use direct values for free movement
    },
    [isDragging, offset] // Dependencies for the callback
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (widgetRef.current) {
        widgetRef.current.classList.remove("dragging");
      }
    }
  }, [isDragging]); // Dependency for the callback

  // Effect to add/remove global mouse move/up listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]); // Dependencies for the effect

  // Handler for the close button
  const handleClose = () => {
    setIsVisible(false);
  };

  // If no data or not visible, don't render anything
  if (!weatherData || !weatherData.location || !isVisible) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      className="weather-widget"
      style={{
        // Apply position using left and top
        left: `${position.x}px`,
        top: `${position.y}px`,
        // Ensure height isn't being set or interfered with here
      }}
      onMouseDown={handleMouseDown} // Attach mouse down listener here
    >
      {/* Close Button */}
      <button
        onClick={handleClose}
        className="weather-widget-close-button"
        aria-label="Close Weather Widget"
      >
        &times; {/* HTML entity for 'x' */}
      </button>

      <h4>Weather in {weatherData.location}</h4>
      <p>Currently: {weatherData.current_temp_f}°F</p>
      <p>Condition: {weatherData.description || "N/A"}</p>
      {/* Optional: Add more weather details */}
    </div>
  );
}

WeatherWidget.propTypes = {
  weatherData: PropTypes.shape({
    location: PropTypes.string,
    current_temp_f: PropTypes.number,
    description: PropTypes.string,
    precipitation: PropTypes.number,
  }),
};

export default WeatherWidget;
