import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import { makeRoutes } from '../src/routes.ts'
import { TAVERN_API } from '../src/protocol.ts'
import { extensionDir, extensionsRoot, readExtensionFile, safeId } from '../src/extensions/store.ts'
import { relative, isAbsolute } from 'node:path'

const prompts: any[] = []
const ctx: any = {
  get: (name: string) => name === 'agentDefaultModel' ? { currentSelection: () => ({ provider: 'test', model: 'test' }) } : undefined,
  llm: {
    async *stream(options: any) {
      prompts.push(options)
      yield { type: 'text-delta', text: '测试回复' }
    },
  },
}

async function request(path: string, payload: unknown, source: { address?: string; headers?: Record<string, string> } = {}) {
  const req: any = Readable.from([Buffer.from(JSON.stringify(payload))])
  req.method = 'POST'
  req.headers = { host: '127.0.0.1:3000', 'sec-fetch-site': 'same-origin', ...source.headers }
  req.socket = { remoteAddress: source.address ?? '127.0.0.1' }
  let status = 0
  let result: any
  const res: any = {
    writeHead(code: number) { status = code },
    end(body: string) { result = JSON.parse(body) },
  }
  const route = makeRoutes(ctx).find((r) => r.path === path)!
  await route.handler(req, res)
  return { status, result }
}

test('member chat carries the browser encounter summary into the model prompt', async () => {
  const response = await request(TAVERN_API.chatMember, {
    member: { name: '艾拉' }, messages: [{ role: 'user', content: '该怎么办？' }],
    adventure: { scene: '门前', beat: '封印亮起', encounter: { title: '守卫追来', description: '身后有脚步声', options: ['正面对抗', '拔腿就跑'] } },
  })
  assert.equal(response.status, 200)
  assert.match(prompts.at(-1).system, /守卫追来/)
  assert.match(prompts.at(-1).system, /正面对抗 \/ 拔腿就跑/)
})

test('member chat drops malformed options without dropping the encounter', async () => {
  const response = await request(TAVERN_API.chatMember, {
    member: { name: '艾拉' }, messages: [{ role: 'user', content: '观察一下' }],
    adventure: { encounter: { title: '石门', description: '无法开启', options: [null, 12, '观察'] } },
  })
  assert.equal(response.status, 200)
  assert.match(prompts.at(-1).system, /眼前的遭遇：石门/)
  assert.match(prompts.at(-1).system, /可选行动：观察/)
})

test('extension uploads above 4 MiB reach ZIP validation instead of JSON rejection', async () => {
  const response = await request(TAVERN_API.extInstall, { zipBase64: 'A'.repeat(5 * 1024 * 1024) })
  assert.equal(response.status, 500)
  assert.match(response.result.error, /zip 文件/)
})

test('the upload limit still rejects an oversized base64 ZIP', async () => {
  const response = await request(TAVERN_API.extInstall, { zipBase64: 'A'.repeat(64 * 1024 * 1024 + 1) })
  assert.equal(response.status, 413)
})

test('ordinary API requests retain the 4 MiB JSON limit', async () => {
  const response = await request(TAVERN_API.chatMember, { padding: 'A'.repeat(5 * 1024 * 1024) })
  assert.equal(response.status, 400)
})

test('dot-only extension ids cannot point to the store or its parent', () => {
  for (const id of ['.', '..', '...', ' .. ']) {
    assert.throws(() => extensionDir(id), /id/i)
    assert.equal(readExtensionFile(id, 'secret.txt'), null)
  }
  for (const id of ['theme', 'my.theme', '../../outside', 'C:\\outside']) {
    const rel = relative(extensionsRoot(), extensionDir(id))
    assert.ok(rel !== '' && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') && !isAbsolute(rel))
  }
  assert.equal(safeId('My Theme'), 'my-theme')
})

test('extension uploads retain loopback and same-origin guards', async () => {
  for (const source of [
    { address: '192.168.1.20' },
    { headers: { 'sec-fetch-site': 'cross-site' } },
    { headers: { origin: 'https://example.com' } },
  ]) assert.equal((await request(TAVERN_API.extInstall, {}, source)).status, 403)
})
