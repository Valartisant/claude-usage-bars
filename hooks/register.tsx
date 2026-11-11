import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const PANE = 'usage-bars'
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [])
const nowAtom = atom({ plugin: 'usage-bars', key: 'now' } as const, 0)

const DAY = 86_400_000
const W = 28
const SW = 8
const sbar = (pct: number) => {
  const f = Math.round((clamp(pct) / 100) * SW)
  return '▰'.repeat(f) + '▱'.repeat(SW - f)
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const bar = (pct: number) => {
  const f = Math.round((clamp(pct) / 100) * W)
  return '█'.repeat(f) + '░'.repeat(W - f)
}
const tone = (pct: number) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')
const fmt = (n: number) => (Math.round(n * 10) / 10).toString()
const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (ms <= 0) return 'bientôt'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d}j ${h}h` : h > 0 ? `${h}h ${m % 60}min` : `${m}min`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'usage-bars', description: 'Ouvre le volet des barres d\'usage' })
    const u = await $.session.usage()
    await update($, limits, () => u.rateLimits.map(r => ({ ...r })))
    await update($, nowAtom, () => Date.now())
    return next(e)
  })

  on('command.run', { command: 'usage-bars' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Usage' })
    return { text: 'Volet usage ouvert.' }
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits.map(r => ({ ...r })))
    const t = await $.clock.now()
    await update($, nowAtom, () => t)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const t = await $.clock.now()
    await update($, nowAtom, () => t)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, limits)
    const now = (await read($, nowAtom)) || (await $.clock.now())
    const five = list.find(l => l.kind === 'five_hour')
    const week = list.find(l => l.kind === 'seven_day')
    if (e.props.hasSurvey || (!five && !week)) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    let day = 0
    let dayPct = 0
    let lead = 0
    if (week) {
      const share = 100 / 7
      const end = week.resetsAt ? Date.parse(week.resetsAt) : now + 7 * DAY
      day = Math.max(0, Math.min(6, Math.floor((now - (end - 7 * DAY)) / DAY)))
      dayPct = clamp(((week.percentUsed - day * share) / share) * 100)
      const u = week.percentUsed
      // + : avance non utilisée des jours précédents (manque pour entamer aujourd'hui)
      // - : dépassement du quota cumulé jusqu'à aujourd'hui ; 0 : dans le jour courant
      lead = u < day * share ? day * share - u : u > (day + 1) * share ? (day + 1) * share - u : 0
    }
    return (
      <Box>
        {five && (
          <Text color={tone(five.percentUsed)}>5h {sbar(five.percentUsed)} {fmt(five.percentUsed)}%  </Text>
        )}
        {week && (
          <Text color={tone(week.percentUsed)}>Sem {sbar(week.percentUsed)} {fmt(week.percentUsed)}%  </Text>
        )}
        {week && (
          <Text color={tone(dayPct)}>J{day + 1}/7 {sbar(dayPct)} {fmt(dayPct)}%  </Text>
        )}
        {week && Math.abs(lead) >= 0.05 && (
          <Text color={lead > 0 ? 'green' : 'red'}>({lead > 0 ? '-' : '+'}{fmt(Math.abs(lead))}%)</Text>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, limits)
    const now = (await read($, nowAtom)) || Date.now()
    const five = list.find(l => l.kind === 'five_hour')
    const week = list.find(l => l.kind === 'seven_day')

    if (!five && !week) {
      return <Text dimColor>Pas encore de mesure (envoie un message).</Text>
    }

    let weekBlock = null
    if (week) {
      const share = 100 / 7
      const end = week.resetsAt ? Date.parse(week.resetsAt) : now + 7 * DAY
      const start = end - 7 * DAY
      const day = Math.max(0, Math.min(6, Math.floor((now - start) / DAY)))
      const allowed = (day + 1) * share // quota cumulé jusqu'à aujourd'hui
      const todayUsed = week.percentUsed - day * share // consommé depuis le début d'aujourd'hui
      const left = allowed - week.percentUsed
      const dayPct = clamp((todayUsed / share) * 100)
      weekBlock = (
        <Box flexDirection="column">
          <Text bold>Hebdomadaire · {fmt(week.percentUsed)}%</Text>
          <Text color={tone(week.percentUsed)}>{bar(week.percentUsed)}</Text>
          <Text dimColor>Reset dans {until(week.resetsAt, now)}</Text>
          <Text> </Text>
          <Text bold>Jour {day + 1}/7 · quota virtuel {fmt(share)}%/jour</Text>
          <Text color={tone(dayPct)}>{bar(dayPct)}</Text>
          <Text color={left >= 0 ? 'green' : 'red'}>
            {left >= 0
              ? `Il te reste ${fmt(left)}% d'avance sur le quota cumulé`
              : `Dépassement de ${fmt(-left)}% sur le quota cumulé`}
          </Text>
          <Text dimColor>
            Cumul autorisé aujourd'hui : {fmt(allowed)}% · consommé : {fmt(week.percentUsed)}%
          </Text>
          <Text dimColor>{'·'.repeat(0)}Jours: {Array.from({ length: 7 }, (_, i) => (i < day ? '■' : i === day ? '▣' : '□')).join(' ')}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {five && (
          <Box flexDirection="column">
            <Text bold>Session 5h · {fmt(five.percentUsed)}%</Text>
            <Text color={tone(five.percentUsed)}>{bar(five.percentUsed)}</Text>
            <Text dimColor>Reset dans {until(five.resetsAt, now)}</Text>
            <Text> </Text>
          </Box>
        )}
        {weekBlock}
      </Box>
    )
  })
}
