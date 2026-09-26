/**
 * Reproduce the "team disappears after a refresh" report without a browser:
 * measure what each store actually costs in localStorage, and prove the
 * round-trip that the panel relies on.
 */
const store = new Map<string, string>()
let refused = 0
const QUOTA = 5 * 1024 * 1024
;(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => {
    const total = [...store.entries()].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0) + k.length + v.length
    if (total > QUOTA) { refused++; throw new DOMException('QuotaExceededError') }
    store.set(k, v)
  },
  removeItem: (k: string) => { store.delete(k) },
}

const { makeParty, makeMember, makeRpgState, loadCurrentParty, saveCurrentParty } = await import('file:///C:/tool/DeepSeek/DeepSeekHarness/my-plugins/dsh-portable-tavern/src/client/party.ts')

/** A portrait roughly the size the avatar downscaler produces. */
function fakeAvatar(seed: string): string {
  return 'data:image/jpeg;base64,' + ('A'.repeat(14000) + seed).slice(0, 14000 + seed.length)
}

const party = makeParty('雾岭小队')
party.members = []
for (let i = 0; i < 12; i++) {
  party.members.push(makeMember(i, {
    name: '队员' + (i + 1),
    avatar: fakeAvatar(String(i)),
    prompt: '人设'.repeat(120),
  }))
}

const partyBytes = JSON.stringify(party).length
console.log('party json: ' + Math.round(partyBytes / 1024) + ' KB (12 members with portraits)')

// round-trip
saveCurrentParty(party)
const back = loadCurrentParty()
console.log('round-trip members: ' + (back === null ? 'NULL' : back.members.length))
console.log('round-trip name: ' + (back === null ? '-' : back.name))
console.log('ids preserved: ' + (back !== null && back.members.every((m, i) => m.id === party.members[i].id)))
console.log('portraits preserved: ' + (back !== null && back.members.every((m, i) => m.avatar === party.members[i].avatar)))

// Now the whole origin budget, the way the panel actually uses it.
const rpg = makeRpgState()
rpg.log = Array.from({ length: 60 }, (_, i) => ({
  id: 'l' + i, kind: 'scene' as const, who: '守秘人', at: i,
  text: '叙述'.repeat(200),
}))
rpg.setup.outline = Array.from({ length: 6 }, (_, i) => ({
  id: 'b' + i, title: '节点' + i, trigger: { kind: 'turn' as const, turn: i + 1 },
  event: '事件'.repeat(80), once: true, fired: false, firedAtTurn: 0,
}))

const parts: [string, string][] = [
  ['workspace', JSON.stringify({ spec: {}, card: { data: { avatar: fakeAvatar('c'), first_mes: 'x'.repeat(2000) } }, chat: Array.from({ length: 120 }, () => ({ role: 'assistant', content: '对白'.repeat(60) })) })],
  ['party.current', JSON.stringify(party)],
  ['rpg', JSON.stringify(rpg)],
  ['threads', JSON.stringify(Object.fromEntries(party.members.map((m) => [m.id, Array.from({ length: 40 }, () => ({ role: 'assistant', content: '私聊'.repeat(60) }))])))],
  ['characters', JSON.stringify(Array.from({ length: 10 }, () => ({ card: { data: { avatar: fakeAvatar('x') } } })))],
  ['parties', JSON.stringify([party, party, party])],
]
let total = 0
for (const [name, body] of parts) {
  total += body.length
  console.log('  ' + name.padEnd(16) + Math.round(body.length / 1024) + ' KB')
}
console.log('TOTAL: ' + Math.round(total / 1024) + ' KB  (localStorage budget is typically 5120 KB)')
console.log('writes refused by the quota: ' + refused)
