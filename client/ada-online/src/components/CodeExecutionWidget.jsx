// src/components/CodeExecutionWidget.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import "./CodeExecutionWidget.css";

// --- Constants ---
const INITIAL_TOP_OFFSET = 20; // Pixels from top
const INITIAL_RIGHT_OFFSET = 20; // Pixels from right

function CodeExecutionWidget({ code, language, onClose }) {
  // --- Existing Logic ---
  if (!code) {
    return null;
  }
  const formattedLanguage = language
    ? language.replace("Language.", "").toLowerCase()
    : "code";

  // --- Render JSX ---
  // Removed ref, style, and onMouseDown from the div
  return (
    <div className="code-widget-container">
      <button
        onClick={onClose}
        className="code-widget-close-button"
        aria-label="Close Code Widget"
      >
        &times;
      </button>
      <h4>Executable Code ({formattedLanguage})</h4>
      <pre className="code-widget-pre">
        <code className={`language-${formattedLanguage}`}>{code}</code>
      </pre>
    </div>
  );
}

// PropTypes and DefaultProps remain the same
CodeExecutionWidget.propTypes = {
  code: PropTypes.string,
  language: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
CodeExecutionWidget.defaultProps = {
  code: null,
  language: "code",
};

export default CodeExecutionWidget;
