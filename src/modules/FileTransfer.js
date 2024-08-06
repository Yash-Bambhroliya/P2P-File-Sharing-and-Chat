// src/FileTransfer.js
import React, { useRef } from 'react';

const FileTransfer = ({ sendFile, progress, speed }) => {
  const fileInputRef = useRef(null);

  return (
    <div id="file-section">
      <input type="file" id="file-input" ref={fileInputRef} onChange={sendFile} />
      <button id="send-file-btn" disabled={!fileInputRef.current?.files?.length} onClick={sendFile}>
        Send File
      </button>
      <div id="progress-section">
        <progress id="progress-bar" value={progress} max="100"></progress>
        <p id="progress-text">Transfer progress: {progress}%</p>
        <p id="speed-text">Speed: {speed} Mbps</p>
      </div>
    </div>
  );
};

export default FileTransfer;
