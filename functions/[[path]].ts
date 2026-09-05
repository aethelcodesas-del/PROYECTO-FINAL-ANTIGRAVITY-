import http from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import app from '../server.ts';

const server = http.createServer(app);
const worker = httpServerHandler(server);

export const onRequest: PagesFunction = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api')) {
    return worker.fetch(request, env, context);
  }

  return next();
};
