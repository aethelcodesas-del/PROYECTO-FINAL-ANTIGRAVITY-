/**
 * UTILIDAD DE HASHING SHA-256 ESTÁNDAR (WEB CRYPTO API)
 * 100% compatible con Cloudflare Workers, Edge Runtime, Node.js y Navegador.
 */

export async function calculateSha256(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }

  // Uso de Web Crypto API nativa en Cloudflare Workers y Node.js globalThis.crypto
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple si subtle no estuviera disponible (entornos de prueba legacy)
  throw new Error('Web Crypto API (crypto.subtle) no está disponible en este entorno.');
}
