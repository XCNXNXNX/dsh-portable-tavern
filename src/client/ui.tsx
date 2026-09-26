/**
 * Shared form primitives for the portable tavern panels. Extracted so the
 * character, party, RPG and plugin panels all render with one visual language
 * instead of four slightly different ones.
 */

import { useState } from 'react'
import type * as React from 'react'
import { css } from './styles.ts'

/** Join class names, dropping falsy entries. */
export function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ')
}

/** A collapsible titled block. */
export function Section(props: { title: string; hint?: string; defaultOpen?: boolean; children: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(props.defaultOpen !== false)
  return (
    <div className={css.stSection}>
      <button type="button" className={css.stSectionHead} onClick={() => setOpen(!open)}>
        <span className={css.stSectionTitle}>{props.title}</span>
        {props.hint ? <span className={css.stSectionHint}>{props.hint}</span> : null}
        <span className={css.stSectionCaret}>{open ? '-' : '+'}</span>
      </button>
      {open ? <div className={css.stSectionBody}>{props.children}</div> : null}
    </div>
  )
}

/** A labelled row. */
export function Field(props: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={css.stField}>
      <div className={css.stLabel}>{props.label}</div>
      {props.children}
    </div>
  )
}

/** A labelled range input with end captions. */
export function Slider(props: { min: number; max: number; value: number; left: string; right: string; onChange: (v: number) => void }): React.ReactElement {
  return (
    <div className={css.stSliderRow}>
      <span className={css.stSliderEnd}>{props.left}</span>
      <input type="range" min={props.min} max={props.max} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} className={css.stSlider} />
      <span className={css.stSliderEnd}>{props.right}</span>
      <span className={css.stSliderVal}>{props.value}</span>
    </div>
  )
}

/** A radio group rendered as pills. */
export function RadioGroup(props: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div className={css.stRadioGroup}>
      {props.options.map((o) => (
        <label key={o.value} className={cx(css.stRadio, props.value === o.value && css.stRadioActive)}>
          <input type="radio" checked={props.value === o.value} onChange={() => props.onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

/** A multi- or single-select chip row. */
export function Chips(props: { options: string[]; values: string[] | string; multiple?: boolean; onChange: (v: string[] | string) => void }): React.ReactElement {
  const multiple = props.multiple === true
  const values = multiple ? (props.values as string[]) : [props.values as string]
  return (
    <div className={css.stChipWrap}>
      {props.options.map((o) => {
        const active = values.includes(o)
        return (
          <button
            key={o}
            type="button"
            className={cx(css.stChip, active && css.stChipActive)}
            onClick={() => {
              if (multiple) props.onChange(active ? values.filter((v) => v !== o) : [...values, o])
              else props.onChange(o)
            }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

/** A palette of swatches plus a free colour input. */
export function ColorSwatches(props: { palette: string[]; value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <div className={css.stSwatches}>
      {props.palette.map((c) => (
        <button key={c} type="button" className={cx(css.stSwatch, props.value === c && css.stSwatchActive)} style={{ background: c }} title={c} onClick={() => props.onChange(c)} />
      ))}
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} className={css.stColorInput} title="自定义颜色" />
      <input className={cx(css.stInput, css.stColorText)} value={props.value} onChange={(e) => props.onChange(e.target.value)} />
    </div>
  )
}

/** An input plus an "add" button that appends to a string list. */
export function CustomAdd(props: { values: string[]; onAdd: (v: string[]) => void; placeholder: string }): React.ReactElement {
  const [v, setV] = useState('')
  const submit = (): void => {
    const t = v.trim()
    if (t && !props.values.includes(t)) props.onAdd([...props.values, t])
    setV('')
  }
  return (
    <div className={css.stCustomAdd}>
      <input className={css.stInput} value={v} onChange={(e) => setV(e.target.value)} placeholder={props.placeholder} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      <button type="button" className={cx(css.stBtn, css.stBtnSm)} onClick={submit}>添加</button>
    </div>
  )
}

/** The standard button. */
export function Btn(props: { children: React.ReactNode; variant?: 'primary' | 'ghost'; disabled?: boolean; onClick?: () => void; title?: string }): React.ReactElement {
  return (
    <button
      type="button"
      className={cx(css.stBtn, props.variant === 'primary' && css.stBtnPrimary, props.variant === 'ghost' && css.stBtnGhost, props.disabled && css.stBtnDisabled)}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
    >
      {props.children}
    </button>
  )
}


/**
 * Read an image file and downscale it to a compact JPEG data URL, so avatars
 * and portraits can live in localStorage and inside exported JSON.
 * @param file - the picked image.
 * @param cb - receives the data URL, or '' when the file cannot be read.
 */
export function fileToAvatar(file: File, cb: (dataUrl: string) => void, max = 256): void {
  const reader = new FileReader()
  reader.onload = () => {
    const src = String(reader.result)
    const img = new Image()
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) { cb(src); return }
        const scale = Math.min(1, max / Math.max(w, h))
        w = Math.max(1, Math.round(w * scale))
        h = Math.max(1, Math.round(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const g = canvas.getContext('2d')
        if (!g) { cb(src); return }
        g.drawImage(img, 0, 0, w, h)
        cb(canvas.toDataURL('image/jpeg', 0.85))
      } catch { cb(src) }
    }
    img.onerror = () => cb(src)
    img.src = src
  }
  reader.onerror = () => cb('')
  reader.readAsDataURL(file)
}

/** The image file picker used by the avatar and portrait rows. */
export function AvatarPicker(props: {
  avatar: string
  name: string
  fallbackGradient: string
  onChange: (dataUrl: string) => void
  size?: number
}): React.ReactElement {
  return (
    <div className={css.stAvatarRow}>
      <div className={css.stAvatarPreview} style={props.avatar ? undefined : { background: props.fallbackGradient }}>
        {props.avatar
          ? <img className={css.stAvatarPreviewImg} src={props.avatar} alt={props.name} />
          : (props.name || '?').slice(0, 1)}
      </div>
      <div className={css.stAvatarActions}>
        <label className={css.stBtn}>
          上传图片
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              fileToAvatar(file, (url) => { if (url) props.onChange(url) }, props.size ?? 256)
            }}
          />
        </label>
        {props.avatar ? <Btn onClick={() => props.onChange('')}>清除</Btn> : null}
      </div>
    </div>
  )
}

/** Trigger a browser download for a blob. */
export function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
