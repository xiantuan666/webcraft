import './style.css';
import { initTextures } from './render/textures';
import { Game } from './game';

// 全局错误提示条（方便排查黑屏等运行时错误）
function showFatal(msg: string): void {
  let box = document.getElementById('fatal');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal';
    box.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(180,40,40,.95);' +
      'color:#fff;padding:10px 18px;border-radius:8px;z-index:999;font-size:13px;max-width:92vw;text-align:center;white-space:pre-wrap;';
    document.body.appendChild(box);
  }
  box.textContent = '⚠️ 出错了：' + msg;
}

window.addEventListener('error', (e) => {
  showFatal((e.error && e.error.message) || e.message || '未知脚本错误');
});
window.addEventListener('unhandledrejection', (e) => {
  showFatal(e.reason && e.reason.message ? e.reason.message : String(e.reason));
});

async function boot(): Promise<void> {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.remove('hidden');
  try {
    await initTextures();
  } catch {
    // 贴图加载失败时回退到程序化贴图，不阻塞启动
  } finally {
    if (loading) loading.classList.add('hidden');
  }
  new Game();
}

void boot();