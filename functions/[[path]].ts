import { httpServerHandler } from "cloudflare:node";
import app from "../server.ts";

const worker = httpServerHandler(app);

export const onRequest: PagesFunction = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Solo interceptar rutas /api/ (backend)
  if (url.pathname.startsWith("/api")) {
    return worker.fetch(request, env, context);
  }

  // Dejar que Cloudflare sirva los archivos estáticos desde dist/
  return next();
};
