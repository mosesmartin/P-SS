// WebRTC Configuration & Helpers

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Creates a standard RTCPeerConnection configured with Google STUN servers
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

/**
 * Screen capture constraints presets
 */
export const STREAM_PRESETS = {
  high: {
    video: {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
    audio: true,
  },
  medium: {
    video: {
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  },
  batterySaver: {
    video: {
      width: { ideal: 854, max: 854 },
      height: { ideal: 480, max: 480 },
      frameRate: { ideal: 15, max: 20 },
    },
    audio: false,
  },
};
