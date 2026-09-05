import assert from 'node:assert/strict';

// 1. Validar el contrato de Cloudflare Strategic Edge Function
const strategicFunctionUrl = new URL('../functions/api/strategic/[[path]].js', import.meta.url).href;
const { onRequest: onStrategicRequest } = await import(`${strategicFunctionUrl}?t=${Date.now()}`);
assert.equal(typeof onStrategicRequest, 'function', 'functions/api/strategic/[[path]].js debe exportar onRequest');

// 2. Probar OPTIONS preflight
const optionsReq = new Request('https://example.test/api/strategic/swot-generate', { method: 'OPTIONS' });
const optionsRes = await onStrategicRequest({ request: optionsReq, env: {} });
assert.equal(optionsRes.status, 204, 'OPTIONS debe devolver 204');

// 3. Probar rechazo sin token
const unauthReq = new Request('https://example.test/api/strategic/swot-generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ campaignId: '123' })
});
const unauthRes = await onStrategicRequest({ request: unauthReq, env: {} });
assert.equal(unauthRes.status, 401, 'POST sin token debe devolver 401');

// 4. Validar el contrato de Cloudflare SaaS Edge Function
const saasFunctionUrl = new URL('../functions/api/saas/[[path]].js', import.meta.url).href;
const { onRequest: onSaasRequest } = await import(`${saasFunctionUrl}?t=${Date.now()}`);
assert.equal(typeof onSaasRequest, 'function', 'functions/api/saas/[[path]].js debe exportar onRequest');

const saasUnauth = await onSaasRequest({
  request: new Request('https://example.test/api/saas/clients', { method: 'GET' }),
  env: {}
});
assert.equal(saasUnauth.status, 403, 'Petición SaaS sin token superadmin debe ser rechazada con 403');

console.log('PASS - Cloudflare Strategic & SaaS Edge Functions: Contratos y seguridad validados.');
