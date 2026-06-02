import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateInsight } from '@/lib/groq'

interface ScrapeResult {
  html: string
  textContent: string
  wordCount: number
  title: string
  metaDescription: string
  h1Tags: string[]
  techStack: string[]
}

async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    const result = await page.evaluate(() => {
      const html = document.documentElement.outerHTML

      // Plain text
      const bodyClone = document.body.cloneNode(true) as HTMLElement
      bodyClone.querySelectorAll('script, style, noscript').forEach((el) => el.remove())
      const textContent = (bodyClone.textContent ?? '').replace(/\s+/g, ' ').trim()
      const wordCount = textContent.split(' ').filter(Boolean).length

      // Meta
      const title = document.title ?? ''
      const metaDesc =
        (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content ?? ''
      const h1Tags = Array.from(document.querySelectorAll('h1')).map((el) =>
        el.textContent?.trim() ?? ''
      )

      // Tech stack detection
      const techStack: string[] = []
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .map((s) => (s as HTMLScriptElement).src)
        .join(' ')
      const metas = Array.from(document.querySelectorAll('meta[name="generator"]'))
        .map((m) => (m as HTMLMetaElement).content)
        .join(' ')

      const checks: [string, RegExp][] = [
        ['Next.js', /\/_next\//],
        ['React', /react(?:\.min)?\.js/],
        ['Vue.js', /vue(?:\.min)?\.js/],
        ['Angular', /angular(?:\.min)?\.js/],
        ['WordPress', /wp-content|wp-includes/],
        ['Shopify', /cdn\.shopify/],
        ['Wix', /wix\.com/],
        ['Webflow', /webflow\.io|assets\.website-files/],
        ['jQuery', /jquery(?:\.min)?\.js/],
        ['Tailwind', /tailwind/],
        ['Bootstrap', /bootstrap(?:\.min)?\.js|bootstrap(?:\.min)?\.css/],
        ['HubSpot', /hubspot\.com/],
        ['Google Analytics', /gtag|google-analytics/],
        ['Hotjar', /hotjar/],
      ]

      const combined = scripts + ' ' + metas + ' ' + document.documentElement.innerHTML
      for (const [name, regex] of checks) {
        if (regex.test(combined)) techStack.push(name)
      }

      return { html, textContent, wordCount, title, metaDescription: metaDesc, h1Tags, techStack }
    })

    return result
  } finally {
    await browser.close()
  }
}

function buildDiff(prev: string, next: string): { added: string[]; removed: string[]; changePercent: number } {
  const prevWords = new Set(prev.split(/\s+/).filter(Boolean))
  const nextWords = new Set(next.split(/\s+/).filter(Boolean))

  const added = [...nextWords].filter((w) => !prevWords.has(w)).slice(0, 30)
  const removed = [...prevWords].filter((w) => !nextWords.has(w)).slice(0, 30)

  const union = new Set([...prevWords, ...nextWords])
  const intersection = [...prevWords].filter((w) => nextWords.has(w))
  const changePercent = union.size > 0
    ? Math.round(((union.size - intersection.length) / union.size) * 100)
    : 0

  return { added, removed, changePercent }
}

function detectSeverity(changePercent: number): 'low' | 'medium' | 'high' {
  if (changePercent >= 30) return 'high'
  if (changePercent >= 10) return 'medium'
  return 'low'
}

function detectChangeType(
  prev: { title: string; techStack: string[] } | null,
  next: { title: string; techStack: string[] }
): string {
  if (!prev) return 'initial_scan'
  if (prev.title !== next.title) return 'copy_change'
  const newTech = next.techStack.filter((t) => !prev.techStack.includes(t))
  if (newTech.length > 0) return 'tech_change'
  return 'copy_change'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { competitorId } = body as { competitorId: string }

    if (!competitorId) {
      return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Fetch competitor
    const { data: competitor, error: compError } = await supabase
      .from('competitors')
      .select('id, name, url, client_id, clients(agency_id)')
      .eq('id', competitorId)
      .single()

    if (compError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    const agencyId = Array.isArray(competitor.clients)
      ? competitor.clients[0]?.agency_id
      : (competitor.clients as { agency_id: string } | null)?.agency_id

    // Fetch previous snapshot for diffing
    const { data: prevSnapshot } = await supabase
      .from('snapshots')
      .select('text_content, title, tech_stack')
      .eq('competitor_id', competitorId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Scrape
    const scraped = await scrapeUrl(competitor.url)

    // Save snapshot
    const { data: snapshot } = await supabase
      .from('snapshots')
      .insert({
        competitor_id: competitorId,
        html: scraped.html.slice(0, 500000), // cap at 500KB
        text_content: scraped.textContent,
        word_count: scraped.wordCount,
        title: scraped.title,
        meta_description: scraped.metaDescription,
        h1_tags: scraped.h1Tags,
        tech_stack: scraped.techStack,
      })
      .select('id')
      .single()

    // Save metadata
    await supabase.from('competitor_metadata').upsert({
      competitor_id: competitorId,
      title: scraped.title,
      meta_description: scraped.metaDescription,
      h1_tags: scraped.h1Tags,
      tech_stack: scraped.techStack,
      word_count: scraped.wordCount,
      last_scraped_at: new Date().toISOString(),
    })

    // Update last_scraped_at on competitor
    await supabase
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitorId)

    let changesFound = false

    if (prevSnapshot && scraped.textContent !== prevSnapshot.text_content) {
      const diff = buildDiff(prevSnapshot.text_content ?? '', scraped.textContent)

      if (diff.changePercent > 0) {
        changesFound = true
        const severity = detectSeverity(diff.changePercent)
        const changeType = detectChangeType(
          prevSnapshot
            ? { title: prevSnapshot.title ?? '', techStack: prevSnapshot.tech_stack ?? [] }
            : null,
          { title: scraped.title, techStack: scraped.techStack }
        )

        // Generate AI insight
        const insightPrompt =
          `Competitor: ${competitor.name} (${competitor.url})\n` +
          `Change type: ${changeType}\n` +
          `Change magnitude: ${diff.changePercent}% of content changed\n` +
          `New words/phrases (sample): ${diff.added.slice(0, 15).join(', ')}\n` +
          `Removed words/phrases (sample): ${diff.removed.slice(0, 15).join(', ')}\n` +
          `Title: ${scraped.title}\n` +
          `H1 tags: ${scraped.h1Tags.join(' | ')}\n` +
          `Tech stack: ${scraped.techStack.join(', ')}\n\n` +
          `What does this change signal for the Indian digital marketing landscape?`

        const aiInsight = await generateInsight(insightPrompt)

        // Save change
        await supabase.from('changes').insert({
          competitor_id: competitorId,
          snapshot_id: snapshot?.id ?? null,
          change_type: changeType,
          severity,
          description: `${diff.changePercent}% content change detected on ${competitor.name}`,
          ai_insight: aiInsight,
          diff_data: { added: diff.added, removed: diff.removed, changePercent: diff.changePercent },
          reviewed: false,
        })
      }
    }

    // Log to activity feed
    if (agencyId) {
      await supabase.from('activity_feed').insert({
        agency_id: agencyId,
        event_type: 'scrape_complete',
        description: changesFound
          ? `Changes detected on ${competitor.name}`
          : `Scraped ${competitor.name} — no changes`,
        metadata: { competitor_id: competitorId, changes_found: changesFound },
      })
    }

    return NextResponse.json({ success: true, changesFound })
  } catch (err: unknown) {
    console.error('Scrape error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
