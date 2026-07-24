const stopHandlers = new Set<() => void>();

export function registerWebcamStop(handler: () => void) {
  stopHandlers.add(handler);
  return () => {
    stopHandlers.delete(handler);
  };
}

export function stopAllWebcams() {
  for (const handler of Array.from(stopHandlers)) {
    handler();
  }
}
