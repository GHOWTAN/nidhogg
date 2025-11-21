import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
    const env = loadEnv(mode, process.cwd(), '');

    return {
      // -----------------------------------------------------------------------
      // 1. IMPORTANT: Replace 'YOUR_REPO_NAME' with the actual name of your repo
      //    Example: base: '/react-8-fantasy-console/',
      // -----------------------------------------------------------------------
      base: '/nidhogg/', 

      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      
      // This allows you to keep using process.env in your code
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      
      resolve: {
        alias: {
          // -------------------------------------------------------------------
          // 2. IMPORTANT: Point '@' to './src' since you moved your code there
          // -------------------------------------------------------------------
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});