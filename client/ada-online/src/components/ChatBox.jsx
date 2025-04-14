// src/components/ChatBox.jsx
import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Message from './Message'; // Import the new Message component
import './ChatBox.css';

/**
 * Renders the chat message history area and handles auto-scrolling.
 * Uses the Message component to render individual messages.
 * @param {object} props - Component props.
 * @param {Array<object>} props.messages - Array of message objects.
 */
function ChatBox({ messages }) {
    const chatboxRef = useRef(null);

    useEffect(() => {
        if (chatboxRef.current) {
            chatboxRef.current.scrollTo({
                top: chatboxRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    return (
        <div className="chatbox" ref={chatboxRef}>
            {/* Map over messages and render the Message component for each */}
            {messages.map((msg, index) => (
                <Message
                    key={index} // Still using index as key here
                    message={msg} // Pass the whole message object as a prop
                />
            ))}
        </div>
    );
}

ChatBox.propTypes = {
    messages: PropTypes.arrayOf(PropTypes.shape({
        sender: PropTypes.oneOf(['user', 'ada']).isRequired,
        text: PropTypes.string.isRequired,
    })).isRequired,
};

export default ChatBox;