const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let peers = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'new-peer') {
            peers.set(ws, data.id);
            broadcastPeers();
        }
    });

    ws.on('close', () => {
        peers.delete(ws);
        broadcastPeers();
    });
});

function broadcastPeers() {
    const peerIds = Array.from(peers.values());
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'peer-list', peers: peerIds }));
        }
    });
}

console.log('WebSocket server running on ws://localhost:8080');
