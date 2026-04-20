// Last-write-wins conflict resolution strategy
const resolveConflict = (localData, remoteData, localTimestamp, remoteTimestamp) => {
  if (remoteTimestamp > localTimestamp) {
    return { resolved: remoteData, winner: 'remote' };
  }
  return { resolved: localData, winner: 'local' };
};

// Track conflicts for user notification
const trackConflict = (entityId, entityType, localData, remoteData) => {
  return {
    entityId,
    entityType,
    localData,
    remoteData,
    detectedAt: new Date(),
    resolved: false,
  };
};

module.exports = {
  resolveConflict,
  trackConflict,
};
