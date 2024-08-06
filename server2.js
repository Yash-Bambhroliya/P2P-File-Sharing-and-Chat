const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let peers = new Map(); // Map of WebSocket connections to peer IDs
let prefixSuffix = new Map(); // Map to track suffixes for each prefix

const prefixes = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];

// Generate a new peer ID based on the current number of peers
function getNextPeerId() {
    const numPeers = peers.size;
    // print the number of peers in com
    const prefixIndex = numPeers % prefixes.length;  // Use modulus to cycle through prefixes
    const prefix = prefixes[prefixIndex];
    const suffix = Math.floor(numPeers / prefixes.length) + 1;
    prefixSuffix.set(prefix, suffix);
    return `${prefix} ${suffix}`;
}

wss.on('connection', (ws) => {
    // Assign a new ID to the newly connected peer
    const peerId = getNextPeerId();
    peers.set(ws, peerId);

    // Notify all clients of the new peer list
    broadcastPeers();

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'new-peer') {
            // Update the peer ID if necessary
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
