import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /staff 는 머리 부분(매니페스트 · 아이콘 · 이름)만 다른 staff.html 로 연다(홈 화면 추가용). 운영(Vercel)은 vercel.json 이 같은 일을 한다.
function staffHtml() {
  const rewrite = (server) => {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/staff' || req.url?.startsWith('/staff?')) req.url = '/staff.html' + req.url.slice('/staff'.length);
      next();
    });
  };
  return { name: 'festflow-staff-html', configureServer: rewrite, configurePreviewServer: rewrite };
}

export default defineConfig({
  plugins: [react(), staffHtml()],
  build: {
    rolldownOptions: {
      input: { main: 'index.html', staff: 'staff.html' },
      checks: {
        pluginTimings: false,
      },
    },
  },
});
