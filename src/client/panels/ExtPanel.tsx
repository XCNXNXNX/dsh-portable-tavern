/**
 * 酒馆插件商店 / 扩展管理面板。
 *
 * 五段式布局：内置美化主题（自带社区美化插件的门面）、已安装扩展的启停与
 * 卸载、四种来源的安装入口、社区推荐清单、兼容性日志。数据一律走 TavernApi
 * （extList / extCatalog / extInstall / extRemove），组件自己不 fetch，也不关心
 * 宿主把扩展装在了哪个目录。
 */

import { useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { StExtension, StInstallResponse, StManifest } from '../../protocol.ts'
import type { TavernApi } from '../api.ts'
import { Btn, Field, Section, cx } from '../ui.tsx'
import { css } from '../styles.ts'

export interface ExtPanelProps {
  /** 数据访问层。 */
  api: TavernApi
  /** 当前已启用（已加载）的扩展 id 集合。 */
  enabled: string[]
  /** 切换某个扩展的启用状态。 */
  onToggle: (id: string, on: boolean) => void
  /** 已安装扩展发生变化（安装/删除成功）后通知父组件重新拉取列表与重新加载。 */
  onChanged: () => void
  /** 兼容宿主产生的日志（加载失败、被桩掉的模块、告警）。 */
  log: string[]
  /** 当前生效的内置主题 id（'' 表示无）。 */
  theme: string
  /** 应用内置主题；传 '' 表示清除。 */
  onTheme: (id: string) => void
}

/** 推荐列表里的一条社区扩展（与 extCatalog 的返回形状一致）。 */
interface CatalogEntry {
  name: string
  url: string
  note: string
}

/**
 * 宿主返回的扩展对象可能比 StExtension 多带几个可选字段（tags / palette）；
 * 这里统一按可选声明，读取时一律做防御式校验，拿不到就退回本地推导。
 */
type ExtensionExtra = Partial<StManifest> & { tags?: unknown; palette?: unknown }

/** 取扩展对象上的可选附加字段。 */
function extrasOf(ext: StExtension): ExtensionExtra {
  return ext as StExtension & ExtensionExtra
}

/** 日志区最多显示的条数（超出只保留最近的）。 */
const LOG_LIMIT = 100

/** 主题预览条的高度，单位 px。 */
const PREVIEW_HEIGHT = 120

/** 主题卡片网格的最小列宽，单位 px。 */
const CARD_MIN = 168

/** 安装来源输入框的占位提示：三种来源各举一例。 */
const SOURCE_HINT = '支持三种来源：\n'
  + '1) GitHub 仓库地址：https://github.com/IceFog72/SillyTavern-Not-A-Discord-Theme\n'
  + '2) manifest.json 直链：https://example.com/ext/manifest.json\n'
  + '3) 本机目录绝对路径（宿主侧，不是浏览器侧）：C:\\ext\\my-extension'

/** 把任意异常转成一行可展示的文字。 */
function errText(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

/** 稳定字符串哈希（djb2）：同一个主题 id 永远得到同一个数字。 */
function hashString(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) >>> 0
  return h
}

/**
 * 给拿不到配色的主题生成一个稳定渐变：色相全部由 id 哈希推导，所以不同主题
 * 看起来不同，而同一个主题每次刷新又总是同一套颜色。
 */
function hashedGradient(id: string): string {
  const h = hashString(id === '' ? 'theme' : id)
  const a = h % 360
  const b = (a + 45 + ((h >>> 8) % 90)) % 360
  const c = (a + 200 + ((h >>> 16) % 60)) % 360
  return 'linear-gradient(120deg, hsl(' + a + ' 60% 42%), hsl(' + b + ' 55% 28%) 45%, hsl(' + c + ' 60% 16%))'
}

/** 从一段文字里抠出十六进制色值（主题描述里常写配色），去重后最多取 4 个。 */
function colorsFromText(text: string): string[] {
  const found = text.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g)
  if (found === null) return []
  return [...new Set(found.map((c) => c.toLowerCase()))].slice(0, 4)
}

/** 主题配色：优先宿主附带的调色板，其次从描述文字里读，都没有就交给哈希渐变。 */
function themeColors(ext: StExtension): string[] {
  const palette = extrasOf(ext).palette
  if (Array.isArray(palette)) {
    const list = palette.filter((c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c))
    if (list.length > 0) return list.slice(0, 4)
  }
  return colorsFromText(ext.description || '')
}

/** 主题预览与卡片色块用的渐变。 */
function themeGradient(ext: StExtension): string {
  const colors = themeColors(ext)
  if (colors.length === 0) return hashedGradient(ext.id)
  if (colors.length === 1) return 'linear-gradient(120deg, ' + colors[0] + ', #12141a)'
  return 'linear-gradient(120deg, ' + colors.join(', ') + ')'
}

/** 卡片上展示的标签：宿主给了就用宿主的，没给就按扩展自身信息推导。 */
function displayTags(ext: StExtension): string[] {
  const raw = extrasOf(ext).tags
  if (Array.isArray(raw)) {
    const list = raw.filter((t: unknown): t is string => typeof t === 'string' && t.trim() !== '')
    if (list.length > 0) return list.slice(0, 6)
  }
  const derived: string[] = []
  derived.push(ext.builtin ? '内置' : '第三方')
  derived.push(ext.js === '' ? '纯样式' : '含脚本')
  if (ext.css !== '') derived.push('含 CSS')
  const fileCount = Array.isArray(ext.files) ? ext.files.length : 0
  if (fileCount > 0) derived.push(fileCount + ' 个文件')
  return derived
}

/** 截断长描述，避免 README 正文把卡片撑开。 */
function shortText(text: string, max: number): string {
  const flat = text.split(/\s+/).join(' ').trim()
  if (flat.length <= max) return flat
  return flat.slice(0, max) + '…'
}

/** 把字节数写成人看的大小。 */
function sizeText(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}

/** 酒馆插件商店 / 扩展管理面板。 */
export function ExtPanel(props: ExtPanelProps): React.ReactElement {
  const [installed, setInstalled] = useState<StExtension[]>([])
  const [builtin, setBuiltin] = useState<StExtension[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [previewId, setPreviewId] = useState('')

  const [source, setSource] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState('')
  const [result, setResult] = useState<StInstallResponse | null>(null)
  const [busy, setBusy] = useState('')

  const [removing, setRemoving] = useState('')
  const [removeError, setRemoveError] = useState('')

  const [zipName, setZipName] = useState('')
  const [zipSize, setZipSize] = useState(0)
  const [zipBase64, setZipBase64] = useState('')
  const [zipError, setZipError] = useState('')

  /** 请求序号：只有最后一次拉取的结果允许写进 state，旧响应不会覆盖新列表。 */
  const loadSeq = useRef(0)
  /** 隐藏的 zip 文件选择框，读完或安装完用它清空已选。 */
  const zipRef = useRef<HTMLInputElement | null>(null)

  /** 重新拉取列表：refreshKey 自增即触发下面的 effect。 */
  const refresh = (): void => setRefreshKey((k) => k + 1)

  useEffect(() => {
    const seq = loadSeq.current + 1
    loadSeq.current = seq
    setLoading(true)
    setLoadError('')
    Promise.all([props.api.extList(), props.api.extCatalog()])
      .then(([list, cat]) => {
        if (loadSeq.current !== seq) return
        setInstalled(list.installed)
        setBuiltin(list.builtin)
        setCatalog(cat.entries)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (loadSeq.current !== seq) return
        setLoadError('读取扩展列表失败：' + errText(e))
        setLoading(false)
      })
  }, [props.api, refreshKey])

  /**
   * 安装的共同收尾：禁用按钮、显示等待提示、成功后就地刷新列表并通知父组件
   * 重新加载；失败只写错误，不动列表。
   * @param payload - 传给宿主安装接口的载荷（来源地址或 zip 的 base64）。
   * @param note - 安装过程中的等待提示。
   */
  const runInstall = async (payload: { url?: string; zipBase64?: string }, note: string): Promise<void> => {
    setInstalling(true)
    setBusy(note)
    setInstallError('')
    setResult(null)
    try {
      const res = await props.api.extInstall({ ...payload, overwrite })
      setResult(res)
      setSource('')
      setZipBase64('')
      setZipName('')
      setZipSize(0)
      if (zipRef.current !== null) zipRef.current.value = ''
      refresh()
      props.onChanged()
    } catch (e) {
      setInstallError('安装失败：' + errText(e))
    } finally {
      setInstalling(false)
      setBusy('')
    }
  }

  /** 从输入框里的来源安装：GitHub 仓库地址、manifest.json 直链或本机目录。 */
  const installFromSource = async (): Promise<void> => {
    const url = source.trim()
    if (url === '') { setInstallError('请先填写扩展来源。'); return }
    await runInstall({ url }, '正在安装（GitHub 仓库会先下载 zip 包，稍等片刻）…')
  }

  /** 安装已经读进内存的 zip 包。 */
  const installFromZip = async (): Promise<void> => {
    if (zipBase64 === '') { setInstallError('请先选择 zip 文件。'); return }
    await runInstall({ zipBase64 }, '正在上传并安装 zip 包，大文件请稍候…')
  }

  /**
   * 读取用户选中的 zip 包并转成 base64 待安装。大文件只读一次，读取期间用
   * busy 提示，避免用户以为界面卡死。
   */
  const onZipPick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files !== null && e.target.files.length > 0 ? e.target.files[0] : null
    e.target.value = ''
    if (file === null) return
    setZipError('')
    setResult(null)
    setZipName(file.name)
    setZipSize(file.size)
    setZipBase64('')
    setBusy('正在读取 ' + file.name + '（' + sizeText(file.size) + '），大文件请稍候…')
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const comma = text.indexOf(',')
      setZipBase64(comma >= 0 ? text.slice(comma + 1) : text)
      setBusy('')
    }
    reader.onerror = () => {
      setZipError('读取 ' + file.name + ' 失败，请重试，或改用来源地址安装。')
      setBusy('')
      setZipName('')
      setZipSize(0)
    }
    reader.readAsDataURL(file)
  }

  /** 卸载一个扩展：window.confirm 二次确认后删目录，成功则刷新列表并通知父组件。 */
  const doRemove = async (ext: StExtension): Promise<void> => {
    const ask = '确定要卸载扩展「' + ext.name + '」吗？\n该扩展的目录会被删除，此操作不可撤销。'
    if (typeof window !== 'undefined' && !window.confirm(ask)) return
    setRemoving(ext.id)
    setRemoveError('')
    try {
      await props.api.extRemove(ext.id)
      refresh()
      props.onChanged()
    } catch (e) {
      setRemoveError('卸载「' + ext.name + '」失败：' + errText(e))
    } finally {
      setRemoving('')
    }
  }

  const enabledCount = installed.filter((ext) => props.enabled.includes(ext.id)).length
  const previewFound = builtin.find((t) => t.id === (previewId !== '' ? previewId : props.theme))
  const previewExt = previewFound === undefined ? null : previewFound
  const logLines = props.log.length > LOG_LIMIT ? props.log.slice(props.log.length - LOG_LIMIT) : props.log

  return (
    <div className={css.stChar}>
      <div className={css.stSettingsDesc}>
        扩展以兼容模式运行：纯 CSS 的美化类扩展最稳；含脚本的扩展会用到被桩掉的 SillyTavern 内部模块，可能只有部分功能可用（详情见底部日志）。
      </div>

      {loading ? <div className={css.stNotice}>正在读取扩展列表…</div> : null}
      {loadError !== '' ? <div className={css.stNotice}>{loadError}</div> : null}

      <Section title="内置美化主题" hint="随插件自带，开箱即用" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={css.stLabel}>
            {'主题预览' + (previewExt === null ? '：未选择主题' : '：' + previewExt.name + ' · ' + previewExt.author)}
          </div>
          <div
            style={{
              height: PREVIEW_HEIGHT,
              borderRadius: 10,
              border: '1px solid #2e323d',
              background: previewExt === null ? 'linear-gradient(120deg, #1b1e25, #262b36)' : themeGradient(previewExt),
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 10,
              padding: 12,
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: 12, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.65)' }}>
              {previewExt === null ? '点击下方任意主题卡片预览配色' : previewExt.name + ' · v' + previewExt.version}
            </span>
            <span style={{ fontSize: 11, color: '#fff', opacity: 0.85, textShadow: '0 1px 3px rgba(0,0,0,0.65)' }}>
              {props.theme === '' ? '当前无主题（宿主默认外观）' : '当前生效：' + props.theme}
            </span>
          </div>
          <div className={css.stRow}>
            <Btn disabled={props.theme === ''} onClick={() => props.onTheme('')}>清除主题</Btn>
            <span className={css.stLabel}>{'共 ' + builtin.length + ' 款内置主题' + (props.theme === '' ? '，当前使用宿主默认外观' : '，当前使用 ' + props.theme)}</span>
          </div>
        </div>

        {builtin.length === 0
          ? <div className={css.stLibHead}>{loading ? '正在读取内置主题…' : '内置主题包为空：当前宿主版本还没有打包主题。'}</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(' + CARD_MIN + 'px, 1fr))', gap: 8 }}>
              {builtin.map((t) => {
                const active = props.theme === t.id
                const picked = previewExt !== null && previewExt.id === t.id
                return (
                  <div
                    key={t.id}
                    className={css.stWbEntry}
                    style={{
                      margin: 0,
                      padding: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      cursor: 'pointer',
                      borderColor: active ? 'var(--st-accent, #4f7cff)' : picked ? '#3a404d' : '#262932',
                    }}
                    title="点击卡片预览该主题的配色"
                    onClick={() => setPreviewId(t.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e9ec' }}>{t.name}</span>
                      {active
                        ? <span style={{ fontSize: 10, color: '#cfe0ff', background: '#35405a', borderRadius: 999, padding: '1px 7px' }}>使用中</span>
                        : null}
                    </div>
                    <div className={css.stLibMeta}>{t.author + ' · v' + t.version}</div>
                    <div style={{ height: 26, borderRadius: 6, border: '1px solid #262932', background: themeGradient(t) }} />
                    {t.description !== ''
                      ? <div style={{ fontSize: 11, color: '#9aa0ab', lineHeight: 1.6 }}>{shortText(t.description, 96)}</div>
                      : null}
                    <div className={css.stCardTags}>
                      {displayTags(t).map((tag) => <span key={tag} className={css.stCardTag}>{tag}</span>)}
                    </div>
                    <div className={css.stRow}>
                      <Btn
                        variant={active ? 'ghost' : 'primary'}
                        disabled={active}
                        onClick={() => props.onTheme(t.id)}
                      >
                        {active ? '使用中' : '应用'}
                      </Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </Section>

      <Section title="已安装扩展" hint="启用 / 停用与卸载" defaultOpen>
        <div className={css.stRow}>
          <span className={css.stLabel}>{'已安装 ' + installed.length + ' 个，其中启用 ' + enabledCount + ' 个'}</span>
          <Btn disabled={loading} onClick={refresh}>{loading ? '刷新中…' : '刷新列表'}</Btn>
        </div>
        {installed.length === 0
          ? <div className={css.stLibHead}>{loading ? '正在读取已安装扩展…' : '还没有安装任何扩展。可在下方从 GitHub 仓库、manifest.json 直链、本机目录或 zip 包安装。'}</div>
          : installed.map((ext) => {
            const on = props.enabled.includes(ext.id)
            return (
              <div key={ext.id} className={css.stLibItem} style={{ alignItems: 'flex-start' }}>
                <label className={css.stCheck} style={{ marginTop: 2 }}>
                  <input type="checkbox" checked={on} onChange={(e) => props.onToggle(ext.id, e.target.checked)} />
                  {on ? '启用' : '停用'}
                </label>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e9ec' }}>{ext.name}</span>
                    <span className={css.stLibMeta}>{ext.author + ' · v' + ext.version}</span>
                    {ext.builtin
                      ? <span style={{ fontSize: 10, color: '#cfe0ff', background: '#35405a', borderRadius: 999, padding: '1px 7px' }}>内置</span>
                      : null}
                  </div>
                  <div className={css.stLibMeta} style={{ whiteSpace: 'normal' }}>
                    {'来源：' + (ext.source === '' ? '未知' : ext.source) + ' · 入口：' + (ext.js === '' ? '仅样式' : ext.js)}
                  </div>
                  {ext.description !== ''
                    ? <div style={{ fontSize: 11, color: '#9aa0ab', lineHeight: 1.6 }}>{shortText(ext.description, 180)}</div>
                    : null}
                  <div className={css.stCardTags}>
                    {displayTags(ext).map((tag) => <span key={tag} className={css.stCardTag}>{tag}</span>)}
                  </div>
                </div>
                {ext.builtin
                  ? null
                  : (
                    <Btn variant="ghost" disabled={removing === ext.id} onClick={() => { void doRemove(ext) }}>
                      {removing === ext.id ? '卸载中…' : '卸载'}
                    </Btn>
                  )}
              </div>
            )
          })}
        {removeError !== '' ? <div className={css.stNotice}>{removeError}</div> : null}
      </Section>

      <Section title="安装扩展" hint="GitHub 仓库 / manifest.json 直链 / 本机目录 / zip 包" defaultOpen>
        <Field label="扩展来源（三种都支持，粘贴一行即可）">
          <textarea
            className={cx(css.stInput, css.stTextarea)}
            rows={3}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={SOURCE_HINT}
            disabled={installing}
          />
        </Field>
        <div className={css.stLabel}>
          第三种是本机（宿主）绝对路径：宿主会直接从运行 DSH 的那台机器的目录复制扩展，浏览器所在机器的路径无效。
        </div>
        <label className={css.stCheck}>
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} disabled={installing} />
          覆盖重装（同名扩展已存在时先清空旧目录）
        </label>
        <div className={css.stRow}>
          <Btn variant="primary" disabled={installing || source.trim() === ''} onClick={() => { void installFromSource() }}>
            {installing ? '安装中…' : '安装'}
          </Btn>
          <label className={cx(css.stBtn, installing && css.stBtnDisabled)} style={{ cursor: installing ? 'not-allowed' : 'pointer' }}>
            选择 zip 包
            <input
              ref={zipRef}
              type="file"
              accept=".zip,application/zip"
              style={{ display: 'none' }}
              disabled={installing}
              onChange={onZipPick}
            />
          </label>
          <Btn variant="primary" disabled={installing || zipBase64 === ''} onClick={() => { void installFromZip() }}>
            {installing ? '安装中…' : '安装 zip'}
          </Btn>
          {zipName !== '' ? <span className={css.stLabel}>{'已读取：' + zipName + '（' + sizeText(zipSize) + '）'}</span> : null}
        </div>
        {zipError !== '' ? <div className={css.stNotice}>{zipError}</div> : null}
        {busy !== '' ? <div className={css.stNotice}>{busy}</div> : null}
        {installError !== '' ? <div className={css.stNotice}>{installError}</div> : null}
        {result !== null
          ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ border: '1px solid #2e4a2e', background: '#16241a', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#9adc9a' }}>
                {'安装成功：' + result.extension.name + '（' + result.extension.id + ' · v' + result.extension.version + ' · 来源 ' + (result.extension.source === '' ? '未知' : result.extension.source) + '）'}
              </div>
              {result.warnings.length > 0
                ? (
                  <div className={css.stNotice}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{'安装告警（' + result.warnings.length + ' 条）'}</div>
                    {result.warnings.map((w, i) => <div key={i} style={{ lineHeight: 1.6 }}>· {w}</div>)}
                  </div>
                )
                : null}
              {result.stubs.length > 0
                ? (
                  <div className={css.stNotice} style={{ background: '#1a2233', borderColor: '#2f4468', color: '#9dc0ff' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{'被桩掉的 SillyTavern 内部模块（' + result.stubs.length + ' 个）'}</div>
                    <div style={{ lineHeight: 1.6 }}>
                      该扩展引用了 SillyTavern 内部模块，这些模块在本宿主中不存在，已替换为空实现（扩展可能部分功能失效）。
                    </div>
                    <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                      {result.stubs.map((s, i) => <div key={i}>· {s}</div>)}
                    </div>
                  </div>
                )
                : null}
            </div>
          )
          : null}
      </Section>

      <Section title="推荐扩展" hint="社区常用、以 CSS 美化为主" defaultOpen>
        <div className={css.stNotice} style={{ background: '#1a2233', borderColor: '#2f4468', color: '#9dc0ff' }}>
          这些是社区扩展，安装后会以兼容模式运行；纯 CSS 的美化类扩展兼容性最好。
        </div>
        {catalog.length === 0
          ? <div className={css.stLibHead}>{loading ? '正在读取推荐列表…' : '推荐列表为空。'}</div>
          : catalog.map((entry, i) => (
            <div key={entry.url + '#' + i} className={css.stLibItem} style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 13, color: '#e8e9ec' }}>{entry.name}</span>
                {entry.note !== '' ? <span style={{ fontSize: 11, color: '#9aa0ab', lineHeight: 1.6 }}>{entry.note}</span> : null}
                <span style={{ fontSize: 11, color: '#6f7683', wordBreak: 'break-all' }}>{entry.url}</span>
              </div>
              <Btn onClick={() => { setSource(entry.url); setResult(null); setInstallError('') }} title="填入上方的来源输入框">
                填入
              </Btn>
            </div>
          ))}
      </Section>

      <Section title="兼容性日志" hint="加载失败 / 被桩掉的模块 / 告警" defaultOpen>
        {props.log.length === 0
          ? <div className={css.stLibHead}>暂无日志</div>
          : (
            <div
              className={css.stLivePre}
              style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, maxHeight: 200, overflowY: 'auto', margin: 0 }}
            >
              {logLines.map((line, i) => <div key={i} style={{ wordBreak: 'break-all' }}>{line}</div>)}
            </div>
          )}
        {props.log.length > logLines.length
          ? <div className={css.stLabel}>{'共 ' + props.log.length + ' 条，仅显示最近 ' + logLines.length + ' 条'}</div>
          : null}
      </Section>
    </div>
  )
}
