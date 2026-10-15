/**
 * painter-worker.js — runs the Painter off the main thread.
 * Receives pixel data + options, streams committed shapes back.
 */
import { Painter } from './painter.js';

let painter = null;

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'start': {
      const { id, width, height, imageData, options } = msg;
      const pixels = imageData instanceof Uint8ClampedArray
        ? imageData
        : new Uint8ClampedArray(imageData);

      painter = new Painter({
        width,
        height,
        imageData: pixels,
        options: {
          ...options,
          onShape: (ps) => self.postMessage({ type: 'shape', id, shape: ps }),
          onProgress: (p) => self.postMessage({ type: 'progress', id, progress: p }),
          onDone: (result) => {
            self.postMessage({ type: 'done', id, result: { count: result.count, sim: result.sim } });
            painter = null;
          },
        },
      });
      painter.start();
      break;
    }
    case 'stop':
      if (painter) painter.stop();
      self.postMessage({ type: 'stopped', id: msg.id });
      break;
  }
};
