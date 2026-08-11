// 用于测试渲染——先启后端再开这个
const http = require('http');

// 看看页面是否正常
http.get('http://localhost:2456/', (res) => {
  console.log('Status:', res.statusCode);
  // 也检查 JS bundle
  http.get('http://localhost:2456/_expo/static/js/web/index-3d407203c93c99c76f47c2fbf300bbc7.js', (r2) => {
    console.log('JS Status:', r2.statusCode);
    console.log('JS Content-Type:', r2.headers['content-type']);
    process.exit(0);
  });
});
