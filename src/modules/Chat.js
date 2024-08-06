// src/Chat.js
import React from 'react';

const Chat = ({ sendMessage, chatMessages, chatInputRef }) => {
  return (
    <div>
      <h2>Chat</h2>
      <div id="chat-messages">
        {chatMessages.map((msg, index) => (
          <p key={index}>{msg}</p>
        ))}
      </div>
      <input type="text" ref={chatInputRef} placeholder="Type your message here..." />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

export default Chat;
