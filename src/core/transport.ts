import { bounded, INPUT_LIMIT, text } from './bytes';
import { BridgeError, fail } from './errors';
import { MASTER_ENDPOINT, PHOTOS_ENDPOINT } from './profile';

export type AuthStage = 'master' | 'photos';
export type AuthRequest = { stage: AuthStage; body: string; device?: string };
export type AuthResponse = { status: number; body: string };
export type AuthTransport = (request: AuthRequest, signal: AbortSignal) => Promise<AuthResponse>;
export function ensureActive(signal: AbortSignal): void { if (signal.aborted) fail('cancelled', '操作已取消。'); }

export function fetchTransport(fetcher: typeof fetch): AuthTransport {
  return async (request, signal) => {
    ensureActive(signal); bounded(request.body);
    const controller = new AbortController(); let timedOut = false;
    const cancel = () => controller.abort(); signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Encoding': 'identity',
        'User-Agent': request.stage === 'master' ? 'GoogleAuth/1.4' : 'GoogleAuth/1.4 (Pixel XL PQ2A.190205.001); gzip',
      };
      if (request.stage === 'photos') {
        if (!/^[0-9a-f]{16}$/i.test(request.device ?? '')) fail('device-id', '设备 ID 无效。');
        headers.app = 'com.google.android.apps.photos'; headers.device = request.device!;
      }
      const response = await fetcher(request.stage === 'master' ? MASTER_ENDPOINT : PHOTOS_ENDPOINT, {
        method: 'POST', headers, body: request.body, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      ensureActive(signal);
      if (response.status >= 300 && response.status < 400 || response.redirected) fail('redirect', '认证端点重定向，已停止发送凭证。');
      const declared = response.headers.get('content-length');
      if (declared && /^\d+$/.test(declared) && Number(declared) > INPUT_LIMIT) fail('response-size', '认证响应过大，已停止读取。');
      if (!response.body) fail('response', '认证服务没有返回可读取的响应。');
      reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const result = await reader.read(); ensureActive(signal);
        if (result.done) break; size += result.value.byteLength;
        if (size > INPUT_LIMIT) fail('response-size', '认证响应过大，已停止读取。');
        chunks.push(result.value);
      }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      return { status: response.status, body: text(bytes) };
    } catch (error) {
      if (signal.aborted) fail('cancelled', '操作已取消。');
      if (timedOut) fail('timeout', '认证请求超时，请检查网络后重试。');
      if (error instanceof BridgeError) throw error;
      return fail('network', '无法连接认证服务，请检查网络、TLS 或端点是否拒绝了请求。');
    } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); controller.abort(); await reader?.cancel().catch(() => {}); }
  };
}
