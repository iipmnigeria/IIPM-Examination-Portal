let securedCameraStream: MediaStream | null = null;

export const takeSecuredCameraStream = (): MediaStream | null => securedCameraStream;

export const holdSecuredCameraStream = (stream: MediaStream): void => {
  securedCameraStream?.getTracks().forEach((track) => track.stop());
  securedCameraStream = stream;
};

export const clearSecuredCameraStream = (stopTracks = true): void => {
  if (stopTracks) securedCameraStream?.getTracks().forEach((track) => track.stop());
  securedCameraStream = null;
};

export const hasLiveSecuredCameraStream = (): boolean => Boolean(
  securedCameraStream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled),
);
