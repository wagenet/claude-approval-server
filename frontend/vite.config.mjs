import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const uiPort = process.env.UI_PORT ? Number(process.env.UI_PORT) : undefined;

export default defineConfig({
  resolve: {
    alias: {
      // ember-cli-deprecation-workflow has "main": null, so Vite falls back to the
      // root index.js (Node.js build-time addon code with window.require calls).
      // Alias to the actual browser entry point.
      'ember-cli-deprecation-workflow': resolve(
        __dirname,
        'node_modules/ember-cli-deprecation-workflow/addon/index.js',
      ),
    },
  },
  plugins: [
    classicEmberSupport(),
    ember(),
    // extra plugins here
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
  server: {
    port: uiPort,
    proxy: {
      '^/(queue|idle|pending|decide|dismiss|snooze|snooze-idle|focus|focus-idle|post-tool-use|stop|explain|log|config|health|window-activity)':
        'http://localhost:4759',
    },
  },
});
