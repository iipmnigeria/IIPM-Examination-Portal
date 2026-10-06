import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'preserve-native-module-loading',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            return html.replace(
              /<script type="module" crossorigin src=/,
              '<script type="module" crossorigin data-cfasync="false" src=',
            );
          },
        },
      },
      {
        name: 'inline-agilecert-production-css',
        apply: 'build',
        async closeBundle() {
          const distDirectory = path.resolve(__dirname, 'dist');
          const indexPath = path.join(distDirectory, 'index.html');
          let html = await fs.readFile(indexPath, 'utf8');
          const stylesheetPattern = /<link\s+rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g;
          const stylesheetLinks = [...html.matchAll(stylesheetPattern)];

          if (stylesheetLinks.length === 0) {
            throw new Error('AgileCert build did not emit a stylesheet link to inline.');
          }

          for (const link of stylesheetLinks) {
            const href = link[1];
            const cleanHref = href.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '');
            const cssPath = path.join(distDirectory, cleanHref);
            const css = await fs.readFile(cssPath, 'utf8');
            const safeCss = css.replace(/<\/style/gi, '<\\/style');
            html = html.replace(
              link[0],
              `<style data-agilecert-inline-css="${cleanHref}">${safeCss}</style>`,
            );
          }

          await fs.writeFile(indexPath, html, 'utf8');
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
