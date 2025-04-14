// src/components/StatusDisplay.jsx
import React from 'react';
import PropTypes from 'prop-types';
import './StatusDisplay.css'; // We'll create this CSS file next

/**
 * Displays the current application status message.
 * @param {object} props - Component props.
 * @param {string} props.status - The status message to display.
 */
function StatusDisplay({ status }) {
    return (
        // Render the status text, using a non-breaking space as fallback
        // to maintain height if the status is temporarily empty.
        <div className="status-display">
            {status || '\u00A0'} {/* '\u00A0' is the unicode for &nbsp; */}
        </div>
    );
}

StatusDisplay.propTypes = {
    status: PropTypes.string.isRequired,
};

export default StatusDisplay;