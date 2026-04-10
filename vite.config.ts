import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(), 
    tailwindcss(),
    mode === 'lib' && dts({ tsconfigPath: './tsconfig.app.json' })
  ],

  // GitHub Pages serve o site em /ganttRx/ — necessário para assets carregarem
  base: mode === 'lib' ? '/' : (process.env.GITHUB_PAGES ? '/ganttRx/' : '/'),

  ...(mode === 'lib' && {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'GanttRx',
        formats: ['es', 'cjs'],
        fileName: (format) => `gantt-rx.${format}.js`,
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'style.css') return 'style.css';
            if (assetInfo.names?.some(n => n.endsWith('.css')) || assetInfo.name?.endsWith('.css')) return 'style.css';
            return assetInfo.name || '[name][extname]';
          },
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'react/jsx-runtime': 'ReactJSXRuntime',
          },
        },
      },
      sourcemap: true,
      emptyOutDir: true,
    },
  }),
}))
