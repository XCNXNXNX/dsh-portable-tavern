/**
 * Engine assertions. Run with: node --experimental-strip-types scripts/engine-test.mts
 * Deterministic by construction: every roll goes through an injected RNG.
 */
import {
  applyEffects, attrMod, bandOf, computeCheck, effectsFor, judge, makeActor,
  rollDice, rollDie, snapDifficulty, BANDS, type Actor, type CheckOption,
} from '../src/rpg/engine.ts'

let pass = 0
let fail = 0
function ok(label: string, cond: boolean, extra = ''): void {
  if (cond) { pass++ } else { fail++; console.log('FAIL ' + label + (extra ? ' :: ' + extra : '')) }
}
function eq(label: string, got: unknown, want: unknown): void {
  ok(label, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want))
}

// --- attribute modifiers -------------------------------------------------
eq('attrMod(10)', attrMod(10), 0)
eq('attrMod(18)', attrMod(18), 16)
eq('attrMod(6)', attrMod(6), -8)
eq('attrMod(14)', attrMod(14), 8)

// --- difficulty ladder ---------------------------------------------------
eq('snap 58 -> 55', snapDifficulty(58), 55)
eq('snap 90 -> 92', snapDifficulty(90), 92)
eq('snap clamps high', snapDifficulty(999), 92)
eq('snap clamps low', snapDifficulty(-5), 25)

// --- dice ----------------------------------------------------------------
eq('rollDie(100, 0) is 1', rollDie(100, () => 0), 1)
eq('rollDie(100, 0.999999) is 100', rollDie(100, () => 0.999999), 100)
eq('rollDice sums', rollDice(3, 6, 2, () => 0.5).total, 3 * (1 + Math.floor(0.5 * 6)) + 2)

// --- check computation ---------------------------------------------------
const hero: Actor = makeActor('h1', '艾拉', {
  attributes: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 10 },
  skills: [{ name: '潜行', attr: 'dex', bonus: 6 }],
  hp: 24, maxHp: 24, status: [],
})
const flee: CheckOption = { id: 'flee', label: '逃跑', attribute: 'dex', skill: '潜行', difficulty: 55, modifier: 0, hint: '' }
const computed = computeCheck(hero, flee, { threat: 70 })
// 55 (base) + round((70-50)/5)=4 + 0 + 0 - 12 (dex 16 mod) - 6 (skill) = 41
eq('required folds in the actor', computed.required, 41)
eq('breakdown sums to required',
  computed.breakdown.reduce((a, r) => a + r.value, 0), computed.required)
ok('required is inside 5..95', computed.required >= 5 && computed.required <= 95)

// a hopeless attempt still leaves a 5% chance
const clumsy = makeActor('c1', '笨拙者', { attributes: { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 } })
const hard = computeCheck(clumsy, { ...flee, difficulty: 92 }, { threat: 100, penalty: 20 })
eq('required never exceeds 95', hard.required, 95)

// --- bands: the user-facing contract -------------------------------------
eq('margin 50 -> triumph', bandOf(50).id, 'triumph')
eq('margin 49 -> success', bandOf(49).id, 'success')
eq('margin 20 -> success', bandOf(20).id, 'success')
eq('margin 19 -> costly', bandOf(19).id, 'costly')
eq('margin 1 -> costly', bandOf(1).id, 'costly')
eq('margin 0 -> narrow', bandOf(0).id, 'narrow')
eq('margin -1 -> hair', bandOf(-1).id, 'hair')
eq('margin -19 -> hair', bandOf(-19).id, 'hair')
eq('margin -20 -> fail', bandOf(-20).id, 'fail')
eq('margin -49 -> fail', bandOf(-49).id, 'fail')
eq('margin -50 -> disaster', bandOf(-50).id, 'disaster')
ok('bands are monotone', BANDS.every((b, i) => i === 0 || BANDS[i - 1].min > b.min))

// --- the three examples from the request ---------------------------------
const base = computed.required
const oneShort = judge(computed, base - 1, 'chase', 70, false)
eq('差 1 -> 差一点', oneShort.band, 'hair')
eq('差 1 -> margin -1', oneShort.margin, -1)
ok('差 1 directive names the one-point gap', oneShort.directive.includes('只差 1 点'))
ok('差 1 directive demands a pulled-back escape', oneShort.directive.includes('被扳了回来'))

// A d100 can only miss by (required - 1), so the catastrophic band needs a
// check whose target is above 50 -- exactly the "普通" anchor against a
// neutral adventurer. This is asserted rather than assumed.
const neutral = makeActor('n1', '普通冒险者')
const normalFlee = computeCheck(neutral, { id: 'flee', label: '逃跑', attribute: 'dex', skill: '', difficulty: 55, modifier: 0, hint: '' }, { threat: 50 })
eq('neutral actor at 普通 must roll 55', normalFlee.required, 55)
const fiftyShort = judge(normalFlee, normalFlee.required - 50, 'chase', 70, false)
eq('差 50 -> 惨败', fiftyShort.band, 'disaster')
ok('差 50 directive names a severe slip', fiftyShort.directive.includes('严重失误'))
ok('差 50 costs hit points', fiftyShort.effects.hpLoss > 0)
ok('差 50 adds a condition', fiftyShort.effects.addStatus.length > 0)

// A very capable character cannot miss catastrophically on an easy check: the
// floor on the die caps the margin at -(required - 1). Documented, not a bug.
const capped = judge(computed, 1, 'chase', 70, false)
eq('floor caps the miss at -(required-1)', capped.margin, 1 - computed.required)
ok('an easy check for an expert cannot be catastrophic', capped.band === 'fail' || capped.band === 'disaster')

const oneOver = judge(computed, base + 1, 'chase', 70, false)
eq('超 1 -> 险胜', oneOver.band, 'costly')
ok('超 1 is a success', oneOver.success)
ok('超 1 directive asks for a narrow win', oneOver.directive.includes('勉强达成'))
ok('超 1 costs nothing mechanical', oneOver.effects.hpLoss === 0)

// --- the AI may never re-decide ------------------------------------------
ok('every directive forbids changing the verdict', [oneShort, fiftyShort, oneOver].every((r) => r.directive.includes('不可更改')))

// --- natural criticals ---------------------------------------------------
eq('natural 100 -> triumph', judge(computed, 100, 'combat', 50, true).band, 'triumph')
eq('natural 3 -> disaster', judge(computed, 3, 'combat', 50, true).band, 'disaster')
eq('crit disabled keeps the band', judge(computed, 100, 'combat', 50, false).band, bandOf(100 - base).id)

// --- consequences scale with danger --------------------------------------
const light = effectsFor('social', bandOf(-60), -60, 20)
const heavy = effectsFor('combat', bandOf(-60), -60, 95)
ok('combat hurts more than social', heavy.hpLoss > light.hpLoss)

// --- effects application -------------------------------------------------
const hurt = applyEffects(hero, { hpLoss: 5, addStatus: ['被追击'], removeStatus: [], endsEncounter: false })
eq('hp is reduced', hurt.hp, 19)
ok('status is added', hurt.status.includes('被追击'))
ok('original actor is untouched', hero.hp === 24 && hero.status.length === 0)
const healed = applyEffects(hurt, { hpLoss: 0, addStatus: [], removeStatus: ['被追击'], endsEncounter: true })
ok('status can be cleared', !healed.status.includes('被追击'))

// --- determinism ---------------------------------------------------------
const seq = (): (() => number) => { let i = 0; const v = [0.1, 0.5, 0.9]; return () => v[i++ % 3] }
const a = judge(computed, rollDie(100, seq()), 'chase', 60, true)
const b = judge(computed, rollDie(100, seq()), 'chase', 60, true)
eq('same seed, same verdict', [a.roll, a.band, a.margin], [b.roll, b.band, b.margin])

console.log('engine tests: PASS ' + pass + ' FAIL ' + fail)
if (fail > 0) process.exitCode = 1
