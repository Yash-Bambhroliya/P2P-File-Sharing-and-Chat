// src/PeerList.js
import React from 'react';

const PeerList = ({ peersList, setSelectedPeerId }) => {
  return (
    <div id="peer-list">
      <h2>Connected Peers</h2>
      <ul id="peers">
        {peersList.map((peer) => (
          <li key={peer}>
            <input
              type="radio"
              name="peer"
              value={peer}
              onChange={(e) => setSelectedPeerId(e.target.value)}
            />
            <span>{peer}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PeerList;
