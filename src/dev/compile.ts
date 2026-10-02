import { Compiler } from 'mind-ar/dist/mindar-image.prod.js'
import { experience } from '../data/targets'

const $ = (id: string) => document.getElementById(id)!
const status = (s: string) => ($('status').textContent = s)
const targets = [...experience.targets].sort((a, b) => a.targetIndex - b.targetIndex)
const fileName = experience.mindFile.split('/').pop()!

targets.forEach((t, i) => {
  if (t.targetIndex !== i) status(`⚠ targetIndex values must be 0..${targets.length - 1} with no gaps (check "${t.id}")`)
  const img = document.createElement('img')
  img.src = t.image
  img.title = `${t.targetIndex}: ${t.id}`
  $('images').appendChild(img)
})

async function compile() {
  status('Loading images…')
  const images = await Promise.all(
    targets.map(async (t) => {
      const img = new Image()
      img.src = t.image
      await img.decode()
      return img
    }),
  )
  const compiler = new Compiler()
  const started = performance.now()
  await compiler.compileImageTargets(images, (p) => {
    ;($('bar') as HTMLProgressElement).value = p
    status(`Compiling… ${p.toFixed(0)}%`)
  })
  const data = compiler.exportData()
  const res = await fetch(`/__save-target?name=${fileName}`, { method: 'POST', body: data as BlobPart })
  const secs = ((performance.now() - started) / 1000).toFixed(1)
  if (res.ok) {
    const { saved, bytes } = await res.json()
    status(`✓ Saved ${saved} (${(bytes / 1024).toFixed(0)} KB) in ${secs}s`)
  } else {
    // Fallback: hand the file to the user.
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([data as BlobPart]))
    a.download = fileName
    a.click()
    status(`Downloaded ${fileName}; move it to public/targets/`)
  }
  document.title = 'Target Compiler — done'
}

$('go').addEventListener('click', () => {
  compile().catch((e) => {
    console.error(e)
    status(`✗ ${e}`)
  })
})
if (new URLSearchParams(location.search).has('auto')) $('go').click()
