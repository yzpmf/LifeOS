// Life OS Web 导出脚本
const { execSync } = require('child_process');
const path = require('path');

const projectDir = 'D:\\一些项目\\Life OS\\LifeOSApp';

console.log('==============================');
console.log('  Life OS Web Export');
console.log('==============================\n');

try {
  console.log('Installing dependencies...');
  execSync('npm install', { cwd: projectDir, stdio: 'inherit' });

  console.log('\nBuilding web version...');
  execSync('npx expo export --platform web', { cwd: projectDir, stdio: 'inherit' });

  console.log('\n✅ Build complete! Check dist/ folder.');
} catch (err) {
  console.error('❌ Build failed:', err.message);
}
