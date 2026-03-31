// Mock for @react-native-community/netinfo
const NetInfo = {
  addEventListener: (callback: Function) => {
    callback({ isConnected: true });
    return () => {};
  },
  fetch: async () => ({ isConnected: true }),
};

export default NetInfo;
