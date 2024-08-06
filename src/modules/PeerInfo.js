// src/PeerInfo.js
import React from 'react';

const PeerInfo = ({ myPeerId }) => {
  return (
    <div id="peer-info">
      <p>Your Peer ID: <span id="my-peer-id">{myPeerId}</span></p>
    </div>
  );
};

export default PeerInfo;
