import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, type Plugin } from 'vite'

// Dev-only endpoint used by /compile.html to write the compiled MindAR file into public/targets/.
function saveTargetPlugin(): Plugin {
  return {
    name: 'save-mind-target',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-target', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'targets.mind'
        if (!/^[\w-]+\.mind$/.test(name)) {
          res.statusCode = 400
          res.end('bad name')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          const out = path.resolve(__dirname, 'public/targets', name)
          fs.writeFileSync(out, Buffer.concat(chunks))
          res.end(JSON.stringify({ saved: `/targets/${name}`, bytes: fs.statSync(out).size }))
        })
      })
    },
  }
}

// Keep the supplied 4K master locally; only the mobile edit belongs in the deployed app.
function excludeBeeMaster(): Plugin {
  return {
    name: 'exclude-bee-master',
    apply: 'build',
    closeBundle() {
      fs.rmSync(path.resolve(__dirname, 'dist/videos/BEES AR.mp4'), { force: true })
    },
  }
}

// HTTPS=1 (npm run dev:phone) serves over a self-signed cert so phones on the LAN get camera access.
export default defineConfig({
  plugins: [react(), tailwindcss(), saveTargetPlugin(), excludeBeeMaster(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  build: {
    chunkSizeWarningLimit: 2500, // MindAR bundles TensorFlow.js; it is lazy-loaded on START AR
  },
})
