// src/components/SearchResultsWidget.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import "./SearchResultsWidget.css"; // Create this CSS file next

function SearchResultsWidget({ searchData, onClose }) {
  const [isVisible, setIsVisible] = useState(true); // Controlled by parent rendering
  const [isDragging, setIsDragging] = useState(false);
  // Position it near the other widgets, adjust as needed
  const [position, setPosition] = useState({ x: 20, y: 280 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef(null);

  // Ensure widget becomes visible when new data arrives (if parent logic doesn't unmount/remount)
  useEffect(() => {
    if (searchData?.results?.length > 0) {
      setIsVisible(true);
    }
  }, [searchData]);

  // --- Dragging Logic (Similar to Weather/Map Widgets) ---
  const handleMouseDown = useCallback((e) => {
    if (
      !widgetRef.current ||
      e.target.classList.contains("search-widget-close-button") ||
      e.target.tagName === "A" // Don't drag when clicking a link
    ) {
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

  // Use the onClose prop directly for the close button
  const handleCloseClick = (e) => {
    e.stopPropagation(); // Prevent triggering drag on button click
    onClose();
  };

  // If no data or not visible (handled by parent), don't render
  if (!searchData?.results || !isVisible) {
    return null;
  }

  const results = searchData.results;
  const query = searchData.query || "Search"; // Fallback title

  return (
    <div
      ref={widgetRef}
      className="search-widget-container"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      <button
        onClick={handleCloseClick}
        className="search-widget-close-button"
        aria-label="Close Search Results Widget"
      >
        &times;
      </button>
      <h4>Sources for "{query}"</h4>
      <ul className="search-widget-list">
        {results.length > 0 ? (
          results.map((result, index) => (
            <li key={index}>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                title={result.url} // Show full URL on hover
              >
                {result.title || result.url} {/* Show title or URL */}
              </a>
              {/* Optional: Display snippet */}
              {/* {result.meta_snippet && <p>{result.meta_snippet}</p>} */}
            </li>
          ))
        ) : (
          <li>No results found.</li>
        )}
      </ul>
    </div>
  );
}

SearchResultsWidget.propTypes = {
  searchData: PropTypes.shape({
    query: PropTypes.string, // The search query term
    results: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string.isRequired,
        title: PropTypes.string, // Title is optional but nice
        meta_snippet: PropTypes.string, // Optional snippet
        page_content_summary: PropTypes.string, // Optional summary
      })
    ),
  }),
  onClose: PropTypes.func.isRequired,
};

export default SearchResultsWidget;
