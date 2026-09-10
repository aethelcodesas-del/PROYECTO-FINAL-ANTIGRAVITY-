/**
 * CLOUDFLARE WORKER: REGISTRADURÍA ELECTORAL SCHEDULER
 * Archivo: workers/registraduria-scheduler.ts
 * 
 * Worker dedicado exclusivamente a ejecutar el Scheduled Trigger de Cloudflare (cron: "0 3 * * 0")
 * para la validación y sincronización oficial de datos electorales de la Registraduría.
 * 
 * Reutiliza íntegramente la lógica oficial centralizada en cloudflareScheduledHandler.
 */

import cloudflareHandler, {
  handleScheduledEvent,
  CloudflareScheduledEvent,
  CloudflareWorkerEnv
} from '../src/services/registraduria/cloudflareScheduledHandler';

export default {
  /**
   * Invocado automáticamente por el Scheduled Trigger de Cloudflare
   */
  async scheduled(event: CloudflareScheduledEvent, env: CloudflareWorkerEnv, ctx: any) {
    return cloudflareHandler.scheduled(event, env, ctx);
  },

  /**
   * Endpoint administrativo manual autenticado (vía CRON_SECRET / SYNC_ADMIN_KEY)
   */
  async fetch(request: Request, env: CloudflareWorkerEnv, ctx: any) {
    return cloudflareHandler.fetch(request, env, ctx);
  }
};
