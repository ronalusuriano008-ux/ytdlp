export const API = location.origin;

export const state = {
  videoList: [],
  currentIndex: 0,

  preloadPlayer: null,
  isPrebuffering: false,
  isPrebuffered: false,
  prebufferedIndex: null,
  currentPrebufferId: 0,
  prebufferController: null,

  currentRequestId: 0,
  streamController: null,
  isLoadingVideo: false,

  statusInterval: null,
  statusToken: null,

  lastLoadedVideoUrl: null,
  lastPrebufferedVideoUrl: null
};