/** This is GPT stuff because I don't care that much about the logger,
 *  mainly here for development purposes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, QueueNode } from '../worker/logger.js';

global.chrome = {
  storage: {
    local: {
      _store: {},
      get: vi.fn((key) => {
        return Promise.resolve({ [key]: global.chrome.storage.local._store[key] || [] });
      }),
      set: vi.fn((items) => {
        Object.assign(global.chrome.storage.local._store, items);
        return Promise.resolve();
      })
    }
  }
};

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    global.chrome.storage.local._store = {};
    logger = new Logger();
  });

  it('should enqueue a log entry when calling info()', () => {
    logger.info({ message: "test" });
    expect(logger.queue.size).toBe(1);
  });

  it('should dequeue and write logs to storage on flush()', async () => {
    logger.debug({ debug: "value" });
    console.log(JSON.stringify(logger.queue))
    logger.info({ info: "value" });

    console.log(JSON.stringify(logger.queue))
    await logger.flush();

    const storedLogs = global.chrome.storage.local._store.logs;
    expect(storedLogs.length).toBe(2);
    console.log(storedLogs)
    expect(storedLogs[0]).toContain('DEBUG');
    expect(storedLogs[1]).toContain('INFO');
    expect(logger.queue.size).toBe(0);
  });

  it('should not flush if queue is empty', async () => {
    const spy = vi.spyOn(global.chrome.storage.local, 'set');
    await logger.flush();
    expect(spy).not.toHaveBeenCalled();
  });
});