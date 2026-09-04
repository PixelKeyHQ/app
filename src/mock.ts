import type { AuthTransport } from './core/transport';

export const MOCK = process.env.EXPO_PUBLIC_PK_MOCK === '1';
export const MOCK_LOGIN_URL = 'https://accounts.example.invalid/EmbeddedSetup';

export const mockTransport: AuthTransport = async request => {
  if (request.stage !== 'master') return { status: 400, body: 'Error=ServiceUnavailable' };
  await new Promise(resolve => setTimeout(resolve, 2500));
  return { status: 200, body: 'Email=test@example.com\nToken=aas_et/MOCK-master-token-not-real-0000000000000000' };
};

export const MOCK_LOGIN_HTML = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
body{margin:0;background:#fff;font-family:-apple-system,Roboto,"PingFang SC",sans-serif}
main{box-sizing:border-box;min-height:100vh;padding:48px 28px 32px;display:flex;flex-direction:column;gap:16px}
.t{font-size:13px;font-weight:600;color:#A1A1AA}
.b{display:block;border-radius:6px;background:#EBEBEC}
.f{margin-top:20px;height:54px;border-radius:8px;border:1px solid rgba(0,0,0,.08);display:flex;align-items:center;padding:0 14px;font-size:16px;color:#A1A1AA}
.n{margin-top:auto;display:flex;justify-content:flex-end}
button{height:40px;padding:0 24px;border:0;border-radius:20px;background:#8359E3;color:#FCFCFC;font-size:15px;font-weight:600;font-family:inherit}
</style></head><body><main>
<span class="t">Google 登录网页（示意）</span>
<span class="b" style="width:60%;height:22px"></span>
<span class="b" style="width:80%;height:12px"></span>
<div class="f">邮箱或电话号码</div>
<span class="b" style="width:40%;height:10px"></span>
<div class="n"><button id="next">下一步</button></div>
</main><script>
document.getElementById('next').onclick = function () {
  document.cookie = 'oauth_token=MOCK-oauth-token-not-real-0000000000; path=/; secure';
  location.hash = 'done';
};
</script></body></html>`;
