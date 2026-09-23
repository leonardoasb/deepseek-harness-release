import fs from 'node:fs'
const log = fs.readFileSync('/tmp/dsh-webG.log', 'utf8')
const banners = [...log.matchAll(/dsh web: (http:\S+)/g)].map(m => m[1])
console.log('banners no log:', banners.length)
const url = banners.at(-1)
const r = await fetch(url, { redirect: 'manual' })
console.log('status redirect-manual:', r.status)
console.log('set-cookie:', r.headers.get('set-cookie')?.slice(0, 60) ?? '(nenhum)')
console.log('location:', r.headers.get('location'))
const cookie = r.headers.get('set-cookie')?.split(';')[0]
if (cookie) {
  const r2 = await fetch(new URL('/', url), { headers: { cookie } })
  console.log('com cookie /:', r2.status)
  const body = await r2.text()
  console.log('body[:120]:', body.slice(0, 120).replace(/\n/g, ' '))
}