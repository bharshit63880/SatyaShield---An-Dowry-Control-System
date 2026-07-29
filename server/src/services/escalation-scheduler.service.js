import crypto from 'crypto';
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { logEvent } from './logger.service.js';
import { runSchedulerBatch } from './escalation-workflow.service.js';

export function createEscalationScheduler({
  clock = () => new Date(),
  intervalMs = env.escalationSchedulerIntervalSeconds * 1000
} = {}) {
  const workerId = `scheduler-${crypto.randomUUID()}`;
  let timer = null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runSchedulerBatch({ now: clock(), workerId });
    } catch {
      logEvent('error', 'escalation_scheduler_batch_failed', {
        outcome: 'retry_next_interval'
      });
    } finally {
      running = false;
    }
  };
  return {
    async start() {
      if (!env.escalationSchedulerEnabled || timer) return false;
      if (mongoose.connection.name !== env.escalationSchedulerDatabase) {
        throw new Error('Escalation scheduler database guard refused startup.');
      }
      await tick();
      timer = setInterval(tick, intervalMs);
      timer.unref?.();
      return true;
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      while (running) await new Promise((resolve) => setTimeout(resolve, 10));
    },
    tick,
    get running() { return running; }
  };
}
