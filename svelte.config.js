// svelte.config.js
import dotenv from 'dotenv';
dotenv.config();
import vercel from '@sveltejs/adapter-vercel';
import statik from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isCap = process.env.BUILD_TARGET === 'capacitor';
// console.log("isCap =====>", process.env.BUILD_TARGET)
/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
    // 모든 a11y(접근성) 관련 경고를 무시하고 싶을 때
    warningFilter: (warning) => !warning.code.startsWith('a11y_') && !warning.code.startsWith('element_')
  },
	kit: {
    adapter: isCap
      ? statik({ pages: 'build', assets: 'build', fallback: 'index.html' })
      : vercel(),
    paths: {
      relative: true
    }
  }
};

export default config;