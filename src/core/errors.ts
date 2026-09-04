export class BridgeError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'BridgeError'; }
}

export function fail(code: string, message: string): never { throw new BridgeError(code, message); }

export function safeMessage(error: unknown): string {
  return error instanceof BridgeError ? error.message : '操作未完成，请检查输入或网络后重试。';
}

export function serviceFailure(code: string): never {
  const messages: Record<string, string> = {
    BadAuthentication: '认证材料被拒绝，请重新登录或重新导入本人完整请求。',
    NeedsBrowser: '服务要求重新在浏览器登录，请完成官方页面的验证后重试。',
    MissingDroidguard: '服务要求有效的设备验证。本工具无法提供，已停止连接。',
    DeviceManagementRequired: '服务要求设备管理或额外验证，本工具无法完成。',
    TokenBindingRequired: '服务要求原账号绑定密钥，请导入本人原始 alias。',
    binding_required: '服务要求原账号绑定密钥，请导入本人原始 alias。',
    unknown_key: '服务不认可这份绑定密钥，请核对原账号和原设备。',
    bad_assertion: '服务拒绝绑定签名，请核对原绑定密钥和设备时间。',
    ServiceUnavailable: '认证服务暂时不可用，请稍后重试。',
  };
  fail('service-rejected', messages[code] ?? '认证服务拒绝了请求，请重新核对本人材料。');
}
