// WebRTC Configuration & Helpers

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Creates a standard RTCPeerConnection configured with Google/Mozilla STUN servers
 */
export function createPeerConnection(onIceCandidate, onTrack, onConnectionStateChange) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  if (onIceCandidate) {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };
  }

  if (onTrack) {
    pc.ontrack = (event) => {
      onTrack(event);
    };
  }

  if (onConnectionStateChange) {
    pc.onconnectionstatechange = () => {
      onConnectionStateChange(pc.connectionState);
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[ICE State]', pc.iceConnectionState);
    };
  }

  return pc;
}
