import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
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
    proxy: {
      '^/(queue|idle|pending|decide|dismiss|focus|focus-idle|post-tool-use|stop|explain|log|config|health)':
        'http://localhost:4759',
    },
  },
});
