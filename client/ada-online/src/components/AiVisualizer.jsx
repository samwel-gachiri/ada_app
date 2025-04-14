import React from 'react';
import styles from './Visualizer.module.css'; // We'll create this CSS file next

// Define the possible statuses using constants or TypeScript enum if preferred
export const STATUS = {
  IDLE: 'idle',
  LISTENING: 'listening',
  SPEAKING: 'speaking',
};

const AiVisualizer = ({ status = STATUS.IDLE }) => {
  // Determine the CSS class based on the status prop
  const getStatusClass = () => {
    switch (status) {
      case STATUS.LISTENING:
        return styles.listening;
      case STATUS.SPEAKING:
        return styles.speaking;
      case STATUS.IDLE:
      default:
        return styles.idle;
    }
  };

  return (
    <div className={styles.orbContainer}>
      <div className={`${styles.orb} ${getStatusClass()}`}>
        {/* Optional: Inner elements for more complex animations */}
        <div className={styles.orbCore}></div>
      </div>
    </div>
  );
};

export default AiVisualizer;