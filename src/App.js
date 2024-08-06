import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import './styles.css'; // Ensure you have styles.css in the src directory
import Peer from 'peerjs';
import { saveAs } from 'file-saver';
import PeerInfo from './modules/PeerInfo';
import PeerList from './modules/PeerList';
import FileTransfer from './modules/FileTransfer';
import Chat from './modules/Chat';
import Particles from './modules/Particles';

function App() {
  const [myPeerId, setMyPeerId] = useState(null);
  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [peersList, setPeersList] = useState([]);
  const [socket, setSocket] = useState(null);
  const [progress, setProgress] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const peerRef = useRef(null);
  const chatInputRef = useRef(null);

  const handleConnection = useCallback((conn) => {
    conn.on('data', (data) => {
      switch (data.type) {
        case 'file-request':
          showFileRequest(conn, data);
          break;
        case 'file-chunk':
          receiveFileChunk(conn, data);
          break;
        case 'chat-message':
          displayChatMessage(data);
          break;
        default:
          console.error('Unknown data type:', data.type);
      }
    });
  }, []);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      setupWebSocket(id);
    });

    peer.on('connection', handleConnection);

    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, [handleConnection]);

  const setupWebSocket = (id) => {
    const host = window.location.hostname;
    const port = '8080';
    const socketUrl = `ws://${host}:${port}`;
    const newSocket = new WebSocket(socketUrl);

    newSocket.onopen = () => {
      console.log(`Connected to WebSocket server at ${socketUrl}`);
      newSocket.send(JSON.stringify({ type: 'new-peer', id }));
    };

    newSocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'peer-list') {
        setPeersList(data.peers);
      }
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    newSocket.onclose = (event) => {
      console.log('WebSocket connection closed:', event);
    };

    setSocket(newSocket);
  };

  const showFileRequest = (conn, data) => {
    console.log('File request received. Data:', data);
    const { fileName, fileSize } = data;
    if (!fileName || !fileSize) {
      console.error('Error: File name or size is missing.');
      return;
    }
    console.log('File name:', fileName, 'File size:', fileSize);
    const accept = window.confirm(`Peer wants to send you a file: ${fileName}. Do you accept?`);
    if (accept) {
      conn.fileSize = fileSize; // Ensure fileSize is set
      conn.fileChunks = [];
      conn.send({ type: 'accept' });
      console.log('File request accepted. File size set:', conn.fileSize);
    } else {
      conn.send({ type: 'reject' });
    }
  };

  const receiveFileChunk = (conn, data) => {
    console.log('Received data:', data);
  
    if (!data || typeof data !== 'object') {
      console.error('Error: Invalid data format.');
      return;
    }
  
    const { chunk, fileName, chunkNumber, totalChunks } = data;
    console.log(`Received chunk number: ${chunkNumber}, total chunks: ${totalChunks}`);
  
    if (!conn.fileChunks) {
      conn.fileChunks = [];
      console.log('Initialized fileChunks array.');
    }
  
    // Ensure fileSize is set before processing chunks
    if (!conn.fileSize) {
      console.error('Error: File size not set.');
      return;
    }
  
    conn.fileChunks[chunkNumber - 1] = chunk;
    console.log(`Added chunk ${chunkNumber} to fileChunks array. Total chunks received: ${conn.fileChunks.length}`);
  
    const receivedSize = conn.fileChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    setProgress((receivedSize / conn.fileSize) * 100);
  
    if (conn.fileChunks.length === totalChunks) {
      console.log('All chunks received. Concatenating chunks...');
      const fileBlob = new Blob(conn.fileChunks, { type: 'application/octet-stream' });
      saveAs(fileBlob, fileName);
      console.log('File saved:', fileName);
    }
  };
  

  const displayChatMessage = (data) => {
    const { message, sender } = data;
    if (!message || !sender) {
      console.error('Error: Invalid chat message format.');
      return;
    }
    setChatMessages((prevMessages) => [...prevMessages, `${sender}: ${message}`]);
  };

  const sendMessage = () => {
    const chatInput = chatInputRef.current;
    if (selectedPeerId && chatInput.value.trim()) {
      const message = chatInput.value.trim();
      const conn = peerRef.current.connect(selectedPeerId);
      conn.on('open', () => {
        conn.send({
          type: 'chat-message',
          message: message,
          sender: myPeerId,
        });
        setChatMessages((prevMessages) => [...prevMessages, `${myPeerId}: ${message}`]);
        chatInput.value = '';
      });
    } else {
      alert('Select a peer and type a message.');
    }
  };

  const sendFile = () => {
    if (!selectedPeerId) {
      alert('Select a peer to send the file to.');
      return;
    }
  
    // Open file picker
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const conn = peerRef.current.connect(selectedPeerId);
        conn.on('open', () => {
          console.log('Connection established for file transfer.');
          // Send file details to the peer before sending chunks
          conn.send({ type: 'file-request', fileName: file.name, fileSize: file.size });
          startFileTransfer(conn, file);
        });
        conn.on('error', (err) => {
          console.error('Connection error:', err);
        });
      }
    };
    fileInput.click();
  };

  function startFileTransfer(conn, file) {
    const chunkSize = 2048 * 1024; // 2 MB chunks
    let offset = 0;
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const startTime = Date.now();
  
    console.log('Total chunks to send:', totalChunks);
  
    function sendChunk(chunkNumber) {
      const chunk = file.slice(offset, offset + chunkSize);
      const reader = new FileReader();
  
      reader.onload = (e) => {
        console.log(`Chunk ${chunkNumber} of ${totalChunks} sent. Chunk size: ${e.target.result.byteLength}`);
        conn.send({ type: 'file-chunk', fileName: file.name, chunk: e.target.result, chunkNumber, totalChunks });
  
        offset += chunkSize;
        const percentComplete = ((offset / totalSize) * 100).toFixed(2);
        console.log(`Transfer progress: ${percentComplete}%`);
  
        const elapsedTime = (Date.now() - startTime) / 1000;
        const speed = ((offset / (1024 * 1024)) / elapsedTime).toFixed(2);
        console.log(`Speed: ${speed} Mbps`);
  
        if (offset < totalSize) {
          sendChunk(chunkNumber + 1);
        }
      };
      reader.readAsArrayBuffer(chunk);
    }
    sendChunk(1);
  }


  return (
    <div className="App">
      <Particles />
      <div id="container">
        <h1>DataWave</h1>
        <PeerInfo myPeerId={myPeerId} />
        <div id="peer-id-change-section">
          <input type="text" id="new-peer-id" placeholder="Enter new Peer ID" />
          <button id="change-peer-id-btn">Change Peer ID</button>
        </div>
        <PeerList peersList={peersList} setSelectedPeerId={setSelectedPeerId} />
        <FileTransfer sendFile={sendFile} progress={progress} />
        <Chat sendMessage={sendMessage} chatMessages={chatMessages} chatInputRef={chatInputRef} />
      </div>
      <div className="count-particles">
        <span className="js-count-particles">--</span> particles
      </div>
    </div>
  );
}

export default App;
