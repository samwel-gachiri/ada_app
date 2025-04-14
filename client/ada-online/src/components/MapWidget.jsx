// src/components/MapWidget.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "./MapWidget.css"; // Create this CSS file next

// Placeholder for map rendering - replace with your chosen library (e.g., Google Maps Embed API, react-google-maps, Leaflet)
const MapDisplay = ({ routeData }) => {
  if (!routeData || !routeData.destination) {
    return <p>Waiting for route data...</p>;
  }

  // --- Example using Google Maps Embed API (Requires an API Key) ---
  // Make sure to URL-encode the destination and origin
  const apiKey = "YOUR API KEY"; // Replace with your actual API key
  const origin = routeData.origin
    ? encodeURIComponent(routeData.origin)
    : "current+location"; // Default to current location if no origin
  const destination = encodeURIComponent(routeData.destination);
  const mapSrc = `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}`;

  return (
    <iframe
      width="100%"
      height="100%"
      style={{ border: 0 }}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      src={mapSrc}
    ></iframe>
  );
  // --- End Example ---

  // --- Placeholder if not using Embed API ---
  // return (
  //   <div>
  //     <h4>Directions</h4>
  //     <p>From: {routeData.origin || 'Current Location'}</p>
  //     <p>To: {routeData.destination}</p>
  //     {/* Add map visualization here using your chosen library */}
  //   </div>
  // );
  // --- End Placeholder ---
};

MapDisplay.propTypes = {
  routeData: PropTypes.shape({
    origin: PropTypes.string,
    destination: PropTypes.string.isRequired,
    // Add other potential route properties here (e.g., waypoints, route steps)
  }),
};

function MapWidget({ mapData }) {
  const [isVisible, setIsVisible] = useState(true); // Start visible when data arrives
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 40, y: 40 }); // Initial position
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Reset visibility when mapData changes (new route requested)
  useEffect(() => {
    if (mapData) {
      setIsVisible(true);
      // Optionally reset position
      // setPosition({ x: 40, y: 40 });
    } else {
      setIsVisible(false); // Hide if no map data
    }
  }, [mapData]);

  // --- Dragging Logic (Similar to WeatherWidget) ---
  const handleMouseDown = useCallback((e) => {
    if (
      !widgetRef.current ||
      e.target.classList.contains("map-widget-close-button") ||
      e.target.tagName === "IFRAME"
    ) {
      // Don't drag if clicking close or the iframe content
      return;
    }
    setIsDragging(true);
    const rect = widgetRef.current.getBoundingClientRect();
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    widgetRef.current.classList.add("dragging");
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !widgetRef.current) return;
      const newX = e.clientX - offset.x;
      const newY = e.clientY - offset.y;
      setPosition({ x: newX, y: newY });
    },
    [isDragging, offset]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (widgetRef.current) {
        widgetRef.current.classList.remove("dragging");
      }
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  // --- End Dragging Logic ---

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!mapData || !isVisible) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      className="map-widget" // Use this class for styling
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={handleClose}
        className="map-widget-close-button" // Style this button
        aria-label="Close Map Widget"
      >
        &times;
      </button>
      <h4>Route to {mapData.destination}</h4>
      {/* Render the map display sub-component */}
      <div className="map-display-area">
        {" "}
        {/* Added wrapper for potential map library needs */}
        <MapDisplay routeData={mapData} />
      </div>
    </div>
  );
}

MapWidget.propTypes = {
  mapData: PropTypes.shape({
    origin: PropTypes.string, // Or whatever data your backend sends
    destination: PropTypes.string.isRequired,
    // Add other expected properties
  }),
};

export default MapWidget;
