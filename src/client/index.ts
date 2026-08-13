/**
 * Browser-half entry for dsh-portable-tavern. Registers two surfaces through
 * the slots service: the floating right-edge panel (shell.overlay) and a
 * secondary entry in the settings panel (settings.section). Uses createElement
 * here because the entry file stays `.ts` (the build.mjs client entry is
 * `src/client/index.ts`); the components live in PortableTavern.tsx.
 */

import { createElement } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { makeStore, SettingsEntry, TavernRoot } from './PortableTavern.tsx'
import { adoptStyles } from './styles.ts'

/** Minimal structural face of the slots service (full typing lives in the SDK). */
interface SlotsService {
  inject(key: string, callback: () => () => void): () => void
  register(
    options: { name: string; id?: string; order?: number; label?: string },
    render: (props: unknown) => unknown,
  ): () => void
}

/** Required services (fiber inject waiting — the slot registry must be up first). */
export const inject = ['slots']

/** Mount the portable tavern surfaces. */
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as SlotsService | undefined
  if (!slots) return
  adoptStyles()
  const store = makeStore(false)

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-portable-tavern', order: 50, label: '便携酒馆' },
    () => createElement(TavernRoot, { store }),
  ))

  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'dsh-portable-tavern', order: 60, label: '便携酒馆' },
    () => createElement(SettingsEntry, { onOpen: () => store.set(true) }),
  ))
}
