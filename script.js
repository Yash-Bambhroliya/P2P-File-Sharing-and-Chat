let peer = new Peer();
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file-btn');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const speedText = document.getElementById('speed-text');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatMessages = document.getElementById('chat-messages');
const newPeerIdInput = document.getElementById('new-peer-id');
const changePeerIdBtn = document.getElementById('change-peer-id-btn');

let myPeerId = null;
let selectedPeerId = null;
let peersList = [];
let socket = null;

peer.on('open', (id) => {
    myPeerId = id;
    document.getElementById('my-peer-id').textContent = id;
    setupWebSocket(id);
});

peer.on('connection', handleConnection);

fileInput.addEventListener('change', () => {
    sendFileBtn.disabled = !fileInput.files.length;
});

sendFileBtn.addEventListener('click', () => {
    if (selectedPeerId && fileInput.files.length) {
        const file = fileInput.files[0];
        const conn = peer.connect(selectedPeerId);
        conn.on('open', () => {
            conn.send({
                type: 'file-request',
                fileName: file.name,
                fileSize: file.size
            });
        });

        conn.on('data', (data) => {
            if (data.type === 'accept') {
                console.log('File request accepted. Starting file transfer...');
                startFileTransfer(conn, file);
            }
        });
    } else {
        alert('Select a file and a peer first.');
    }
});

chatSend.addEventListener('click', () => {
    if (selectedPeerId && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        const conn = peer.connect(selectedPeerId);
        conn.on('open', () => {
            conn.send({
                type: 'chat-message',
                message: message,
                sender: myPeerId
            });
            chatInput.value = ''; // Clear input after sending
        });
    } else {
        alert('Select a peer and type a message.');
    }
});

changePeerIdBtn.addEventListener('click', () => {
    const newPeerId = newPeerIdInput.value.trim();
    if (newPeerId && !peersList.includes(newPeerId)) {
        // Notify server to remove old ID
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'remove-peer', id: myPeerId }));
        }

        // Destroy the old Peer and create a new one with the new ID
        peer.destroy();
        peer = new Peer(newPeerId);
        peer.on('open', (id) => {
            myPeerId = id;
            document.getElementById('my-peer-id').textContent = id;
            setupWebSocket(id);
        });
        peer.on('connection', handleConnection);
    } else {
        alert('Peer ID already exists or is invalid. Please choose a different ID.');
    }
});

function handleConnection(conn) {
    conn.on('data', (data) => {
        if (data.type === 'file-request') {
            showFileRequest(conn, data);
        } else if (data.type === 'file-chunk') {
            receiveFileChunk(conn, data);
        } else if (data.type === 'chat-message') {
            displayChatMessage(data);
        }
    });
}

function setupWebSocket(myId) {
    // Close previous socket if open
    if (socket) {
        socket.close();
    }

    // Directly use the WebSocket URL for production
    const socketUrl = 'wss://lovely-admitted-protest.glitch.me';
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        console.log(`Connected to WebSocket server at ${socketUrl}`);
        socket.send(JSON.stringify({ type: 'new-peer', id: myId }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'peer-list') {
            peersList = data.peers;
            updatePeerList(data.peers);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event);
    };
}

function updatePeerList(peers) {
    const peerList = document.getElementById('peers');
    peerList.innerHTML = '';

    peers.forEach(peer => {
        if (peer !== myPeerId) {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <input type="radio" name="peer" value="${peer}">
                <span>${peer}</span>
            `;
            listItem.querySelector('input').addEventListener('change', (event) => {
                selectedPeerId = event.target.value;
            });
            peerList.appendChild(listItem);
        }
    });
}

function showFileRequest(conn, data) {
    console.log('File request received. Data:', data);

    const { fileName, fileSize } = data;
    if (!fileName || !fileSize) {
        console.error('Error: File name or size is missing.');
        return;
    }

    console.log('File name:', fileName, 'File size:', fileSize);
    
    const accept = confirm(`Peer wants to send you a file: ${fileName}. Do you accept?`);
    if (accept) {
        conn.fileSize = fileSize;
        conn.fileChunks = [];
        conn.send({ type: 'accept' });
        console.log('File request accepted. File size set:', conn.fileSize);
    } else {
        conn.send({ type: 'reject' });
    }
}

function startFileTransfer(conn, file) {
    const chunkSize = 10240 * 1024;
    let offset = 0;
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const startTime = Date.now();

    progressBar.value = 0;
    progressBar.max = totalSize;
    progressText.textContent = 'Transfer progress: 0%';
    speedText.textContent = 'Speed: 0 Mbps';

    console.log('Total chunks to send:', totalChunks);

    function sendChunk(chunkNumber) {
        const chunk = file.slice(offset, offset + chunkSize);
        const reader = new FileReader();

        reader.onload = (e) => {
            console.log(`Chunk ${chunkNumber} of ${totalChunks} sent. Chunk size: ${e.target.result.byteLength}`);
            conn.send({ type: 'file-chunk', fileName: file.name, chunk: e.target.result, chunkNumber, totalChunks });

            offset += chunkSize;
            progressBar.value = offset;
            const percentComplete = ((offset / totalSize) * 100).toFixed(2);
            progressText.textContent = `Transfer progress: ${percentComplete}%`;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const speed = ((offset / (1024 * 1024)) / elapsedTime).toFixed(2);
            speedText.textContent = `Speed: ${speed} Mbps`;

            if (offset < totalSize) {
                sendChunk(chunkNumber + 1);
            }
        };
        reader.readAsArrayBuffer(chunk);
    }
    sendChunk(1);
}

function receiveFileChunk(conn, data) {
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

    if (!conn.fileSize) {
        console.error('Error: File size not set.');
        return;
    }

    conn.fileChunks[chunkNumber - 1] = chunk;
    console.log(`Added chunk ${chunkNumber} to fileChunks array. Total chunks received: ${conn.fileChunks.length}`);

    const receivedSize = conn.fileChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    progressBar.value = receivedSize;
    const percentComplete = ((receivedSize / conn.fileSize) * 100).toFixed(2);
    progressText.textContent = `Transfer progress: ${percentComplete}%`;

    if (conn.fileChunks.length === totalChunks) {
        console.log('All chunks received. Concatenating chunks...');
        const fileBlob = new Blob(conn.fileChunks, { type: 'application/octet-stream' });
        saveAs(fileBlob, fileName);
        console.log('File saved:', fileName);
    }
}

function displayChatMessage(data) {
    const { message, sender } = data;
    if (!message || !sender) {
        console.error('Error: Invalid chat message format.');
        return;
    }

    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the latest message
}
