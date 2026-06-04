export const maxDuration = 60

import { NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { generateInsight } from '@/lib/groq'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceHeaders(extra?: Record<string, string>) {
  return {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'global.headers.Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    ...extra,
  }
}

async function logFetchError(operation: string, res: Response) {
  let body: unknown = '<empty body>'
  try { body = await res.clone().json() } catch { /* non-JSON body */ }
  console.error(`[scrape/route] FAILED — ${operation}`)
  console.error(`  status: ${res.status} ${res.statusText}`)
  console.error(`  body: ${JSON.stringify(body)}`)
}

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

  try {
    const { competitorId } = await request.json()

    if (!competitorId) {
      return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })
    }

    // ── STEP 1 — Validate and fetch competitor ─────────────────────────────────
    console.log('[scrape/route] STEP 1: fetching competitor', competitorId)

    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/competitors?id=eq.${encodeURIComponent(competitorId)}&select=*`,
      { headers: serviceHeaders(), cache: 'no-store' }
    )
    if (!compRes.ok) {
      await logFetchError('fetch competitor', compRes)
      return NextResponse.json({ error: 'Failed to fetch competitor' }, { status: 500 })
    }
    const competitors: Record<string, unknown>[] = await compRes.json()
    if (!competitors.length) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }
    const competitor = competitors[0] as {
      id: string
      name: string
      url: string
      client_id: string
      is_active: boolean
    }

    if (competitor.is_active === false) {
      return NextResponse.json({ success: false, error: 'competitor_is_paused' })
    }

    const clientRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(competitor.client_id)}&select=id,agency_id`,
      { headers: serviceHeaders(), cache: 'no-store' }
    )
    let agencyId: string | undefined
    if (clientRes.ok) {
      const clients: { id: string; agency_id: string }[] = await clientRes.json()
      agencyId = clients[0]?.agency_id
    }
    console.log('[scrape/route] STEP 1 done: competitor', competitor.name, 'agency_id', agencyId)

    // ── STEP 2 — Launch Playwright and scrape ──────────────────────────────────
    console.log('[scrape/route] STEP 2: launching Playwright for', competitor.url)

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    try {
      await page.goto(competitor.url, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (navErr: unknown) {
      const msg = navErr instanceof Error ? navErr.message : String(navErr)
      if (msg.toLowerCase().includes('timeout')) {
        // Save an empty snapshot so the attempt is recorded
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/snapshots`, {
            method: 'POST',
            headers: serviceHeaders({ Prefer: 'return=representation' }),
            body: JSON.stringify({
              competitor_id: competitorId,
              html_content: '',
              text_content: '',
              word_count: 0,
            }),
          })
        } catch { /* best-effort */ }
        return NextResponse.json({
          success: false,
          error: 'timeout',
          message: 'Site took too long to respond',
        })
      }
      throw navErr
    }

    await page.waitForTimeout(2000)

    const pageText = await page.evaluate(() => document.body.innerText).catch(() => '')
    const titleTag = await page.title().catch(() => '')
    const metaDescription = await page
      .$eval('meta[name="description"]', el => el.getAttribute('content') || '')
      .catch(() => '')
    const metaKeywords = await page
      .$eval('meta[name="keywords"]', el => el.getAttribute('content') || '')
      .catch(() => '')
    const h1Tags = await page
      .$$eval('h1', els => els.map(el => (el as HTMLElement).innerText.trim()).filter(Boolean))
      .catch(() => [] as string[])
    const h2Tags = await page
      .$$eval('h2', els => els.map(el => (el as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 10))
      .catch(() => [] as string[])
    const wordCount = pageText.split(/\s+/).filter(Boolean).length
    const canonicalUrl = await page
      .$eval('link[rel="canonical"]', el => el.getAttribute('href') || '')
      .catch(() => '')

    const scriptSrcs = await page
      .$$eval('script[src]', els => els.map(el => (el as HTMLScriptElement).src))
      .catch(() => [] as string[])
    const allScripts = scriptSrcs.join(' ') + pageText.toLowerCase()
    const techStack: string[] = []
    const techChecks: Record<string, string[]> = {
      'Next.js': ['_next/', '__next', 'next/dist'],
      'React': ['react.development', 'react.production', 'react-dom'],
      'Vue.js': ['vue.min.js', 'vue.runtime'],
      'Angular': ['ng-version', 'angular/core'],
      'WordPress': ['wp-content', 'wp-includes', 'wordpress'],
      'Shopify': ['cdn.shopify.com', 'shopify.com/s/'],
      'Webflow': ['webflow.com', 'assets.website'],
      'Wix': ['wix.com', 'wixstatic.com'],
      'Google Analytics': ['google-analytics.com', 'gtag/js', 'ga.js'],
      'Google Tag Manager': ['googletagmanager.com'],
      'Hotjar': ['hotjar.com', 'hjSetting'],
      'Intercom': ['intercom.io', 'intercomSettings'],
      'Zendesk': ['zendesk.com', 'zESettings'],
      'Stripe': ['js.stripe.com', 'stripe.com/v3'],
      'Razorpay': ['checkout.razorpay.com', 'razorpay.com'],
      'Crisp': ['crisp.chat'],
      'HubSpot': ['hubspot.com', 'hs-scripts'],
      'Freshworks': ['freshworks.com', 'freshchat'],
    }
    for (const [tech, signatures] of Object.entries(techChecks)) {
      if (signatures.some(sig => allScripts.includes(sig))) {
        techStack.push(tech)
      }
    }

    const pricingKeywords = [
      '₹', 'rs.', 'inr', 'price', 'pricing', 'plan', 'subscribe',
      'per month', '/mo', 'free trial', 'buy now', 'get started',
    ]
    const hasPricingContent = pricingKeywords.some(kw => pageText.toLowerCase().includes(kw))

    const ctaTexts = await page
      .$$eval(
        'button, a.btn, a.button, [class*="cta"]',
        els => els.map(el => (el as HTMLElement).innerText.trim()).filter(Boolean).slice(0, 10)
      )
      .catch(() => [] as string[])

    const outboundLinks = await page
      .$$eval(
        'a[href]',
        els =>
          [...new Set(els.map(el => (el as HTMLAnchorElement).href).filter(h => h.startsWith('http')))].slice(0, 30)
      )
      .catch(() => [] as string[])

    const socialLinks: string[] = []
    const socialDomains = ['instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'youtube.com']
    for (const link of outboundLinks) {
      if (socialDomains.some(d => link.includes(d))) socialLinks.push(link)
    }

    await browser.close()
    browser = undefined
    console.log('[scrape/route] STEP 2 done: wordCount', wordCount, 'techStack', techStack)

    // ── STEP 3 — Save snapshot ─────────────────────────────────────────────────
    console.log('[scrape/route] STEP 3: saving snapshot')
    let newSnapshotId: string | undefined
    try {
      const snapRes = await fetch(`${SUPABASE_URL}/rest/v1/snapshots`, {
        method: 'POST',
        headers: serviceHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({
          competitor_id: competitorId,
          html_content: pageText.substring(0, 50000),
          text_content: pageText.substring(0, 10000),
          word_count: wordCount,
        }),
      })
      if (snapRes.ok) {
        const snapData: { id: string }[] = await snapRes.json()
        newSnapshotId = snapData[0]?.id
        console.log('[scrape/route] STEP 3 done: snapshotId', newSnapshotId)
      } else {
        await logFetchError('save snapshot', snapRes)
      }
    } catch (e) {
      console.error('[scrape/route] STEP 3 threw:', e)
    }

    // ── STEP 4 — Save metadata ─────────────────────────────────────────────────
    console.log('[scrape/route] STEP 4: saving competitor metadata')
    try {
      const metaRes = await fetch(`${SUPABASE_URL}/rest/v1/competitor_metadata`, {
        method: 'POST',
        headers: serviceHeaders({ Prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify({
          competitor_id: competitorId,
          title_tag: titleTag,
          meta_description: metaDescription,
          h1_tags: h1Tags,
          technology_stack: techStack,
          outbound_links: outboundLinks,
          checked_at: new Date().toISOString(),
        }),
      })
      if (!metaRes.ok) {
        await logFetchError('save metadata', metaRes)
      } else {
        console.log('[scrape/route] STEP 4 done')
      }
    } catch (e) {
      console.error('[scrape/route] STEP 4 threw:', e)
    }

    // ── STEP 5 — Fetch previous snapshot for diff ──────────────────────────────
    console.log('[scrape/route] STEP 5: fetching previous snapshots')
    const snapshotsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/snapshots?competitor_id=eq.${encodeURIComponent(competitorId)}&order=scraped_at.desc&limit=2`,
      { headers: serviceHeaders(), cache: 'no-store' }
    ).catch(() => null)

    if (!snapshotsRes?.ok) {
      console.log('[scrape/route] STEP 5: failed to fetch snapshots')
      return NextResponse.json({ success: true, changesFound: false, message: 'first_scrape' })
    }

    const snapshots: { id: string; text_content: string }[] = await snapshotsRes.json()
    console.log('[scrape/route] STEP 5: found', snapshots.length, 'snapshots')

    if (snapshots.length < 2) {
      return NextResponse.json({ success: true, changesFound: false, message: 'first_scrape' })
    }

    const currentSnapshot = snapshots[0]
    const previousSnapshot = snapshots[1]

    // Fetch previous metadata for STEP 7 comparisons
    let previousMetadata:
      | {
          title_tag: string
          meta_description: string
          h1_tags: string[]
          technology_stack: string[]
          outbound_links: string[]
        }
      | undefined
    try {
      const prevMetaRes = await fetch(
        `${SUPABASE_URL}/rest/v1/competitor_metadata?competitor_id=eq.${encodeURIComponent(competitorId)}&select=*`,
        { headers: serviceHeaders(), cache: 'no-store' }
      )
      if (prevMetaRes.ok) {
        const prevMetaData = await prevMetaRes.json()
        previousMetadata = prevMetaData[0]
      }
    } catch (e) {
      console.error('[scrape/route] fetch previous metadata threw:', e)
    }

    // ── STEP 6 — Calculate text diff ──────────────────────────────────────────
    console.log('[scrape/route] STEP 6: calculating text diff')
    const oldSentencesSet = new Set((previousSnapshot.text_content || '').split('. ').filter(Boolean))
    const newSentencesArr = pageText.substring(0, 10000).split('. ').filter(Boolean)
    const addedSentences = newSentencesArr.filter(s => !oldSentencesSet.has(s))
    const removedSentences = [...oldSentencesSet].filter(s => !newSentencesArr.includes(s))
    const totalOldSentences = oldSentencesSet.size || 1
    const changePercentage = (addedSentences.length + removedSentences.length) / totalOldSentences * 100

    console.log('[scrape/route] STEP 6: changePercentage', changePercentage.toFixed(2))

    if (changePercentage < 2) {
      return NextResponse.json({ success: true, changesFound: false })
    }

    const diffSummary = [
      removedSentences.length > 0 ? `Removed: ${removedSentences.slice(0, 3).join('. ')}` : '',
      addedSentences.length > 0 ? `Added: ${addedSentences.slice(0, 3).join('. ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .substring(0, 1000)

    // ── STEP 7 — Detect change type and severity ──────────────────────────────
    console.log('[scrape/route] STEP 7: detecting change type')
    const oldText = (previousSnapshot.text_content || '').toLowerCase()
    const newText = pageText.toLowerCase()

    const pricingTerms = [
      '₹', 'rs ', 'inr', 'price', 'pricing', '/mo', '/month', 'per month', 'free', 'plan', 'subscribe',
    ]
    const oldPricingScore = pricingTerms.filter(t => oldText.includes(t)).length
    const newPricingScore = pricingTerms.filter(t => newText.includes(t)).length
    const pricingChanged =
      Math.abs(newPricingScore - oldPricingScore) >= 2 ||
      addedSentences.some(s => pricingTerms.some(t => s.toLowerCase().includes(t)))

    const seoChanged =
      titleTag !== previousMetadata?.title_tag ||
      metaDescription !== previousMetadata?.meta_description ||
      h1Tags.join() !== (previousMetadata?.h1_tags || []).join()

    const techChanged =
      [...techStack].sort().join() !== (previousMetadata?.technology_stack || []).slice().sort().join()

    const newPageDetected =
      outboundLinks.length > (previousMetadata?.outbound_links?.length || 0) + 3

    let changeType: string
    if (pricingChanged) changeType = 'pricing'
    else if (newPageDetected) changeType = 'new_page'
    else if (seoChanged) changeType = 'seo'
    else if (techChanged) changeType = 'tech'
    else changeType = 'copy'

    let severity: string
    if (changeType === 'pricing') severity = 'high'
    else if (changeType === 'new_page' || changeType === 'tech') severity = 'medium'
    else severity = 'low'

    console.log('[scrape/route] STEP 7 done: changeType', changeType, 'severity', severity)

    // ── STEP 8 — Generate AI insight ──────────────────────────────────────────
    console.log('[scrape/route] STEP 8: generating AI insight')
    let insight: string
    try {
      const rawInsight = await generateInsight(
        `You are a competitive intelligence analyst for Indian digital marketing agencies.

  Analyze this website change for ${competitor.name} and provide a single sentence
  insight (max 150 characters) about what changed and its strategic significance
  for their competitors in the Indian market.

  Change type: ${changeType}
  Previous content: ${previousSnapshot.text_content.substring(0, 300)}
  New content: ${pageText.substring(0, 300)}
  Added content: ${addedSentences.slice(0, 3).join('. ')}

  Respond with only the insight sentence, no preamble or explanation.`
      )
      insight = rawInsight.substring(0, 200)
    } catch (e) {
      console.error('[scrape/route] STEP 8 Groq error:', e)
      insight = `${competitor.name} updated their ${changeType} content`
    }
    console.log('[scrape/route] STEP 8 done: insight', insight)

    // ── STEP 9 — Save change ──────────────────────────────────────────────────
    console.log('[scrape/route] STEP 9: saving change record')
    let changeId: string | undefined
    try {
      const changeRes = await fetch(`${SUPABASE_URL}/rest/v1/changes`, {
        method: 'POST',
        headers: serviceHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({
          competitor_id: competitorId,
          snapshot_old_id: previousSnapshot.id,
          snapshot_new_id: newSnapshotId,
          change_type: changeType,
          diff_summary: diffSummary,
          ai_insight: insight,
          severity: severity,
          detected_at: new Date().toISOString(),
          is_reviewed: false,
        }),
      })
      if (changeRes.ok) {
        const changeData: { id: string }[] = await changeRes.json()
        changeId = changeData[0]?.id
        console.log('[scrape/route] STEP 9 done: changeId', changeId)
      } else {
        await logFetchError('save change', changeRes)
      }
    } catch (e) {
      console.error('[scrape/route] STEP 9 threw:', e)
    }

    // ── STEP 10 — Fire alerts ─────────────────────────────────────────────────
    console.log('[scrape/route] STEP 10: firing alerts')
    let alertsFired = 0
    try {
      const alertsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/alerts?competitor_id=eq.${encodeURIComponent(competitorId)}&is_active=eq.true`,
        { headers: serviceHeaders(), cache: 'no-store' }
      )
      if (alertsRes.ok) {
        const alerts: { id: string; alert_type: string }[] = await alertsRes.json()
        for (const alert of alerts) {
          if (alert.alert_type === changeType || alert.alert_type === 'any') {
            try {
              const triggerRes = await fetch(`${SUPABASE_URL}/rest/v1/alert_triggers`, {
                method: 'POST',
                headers: serviceHeaders(),
                body: JSON.stringify({
                  alert_id: alert.id,
                  change_id: changeId,
                  triggered_at: new Date().toISOString(),
                  message: insight,
                }),
              })
              if (triggerRes.ok) {
                alertsFired++
              } else {
                await logFetchError('fire alert trigger', triggerRes)
              }
            } catch (e) {
              console.error('[scrape/route] STEP 10 alert trigger threw:', e)
            }
          }
        }
      } else {
        await logFetchError('fetch alerts', alertsRes)
      }
    } catch (e) {
      console.error('[scrape/route] STEP 10 threw:', e)
    }
    console.log('[scrape/route] STEP 10 done: alertsFired', alertsFired)

    // ── STEP 11 — Update activity feed ────────────────────────────────────────
    console.log('[scrape/route] STEP 11: updating activity feed')
    if (agencyId) {
      try {
        const activityRes = await fetch(`${SUPABASE_URL}/rest/v1/activity_feed`, {
          method: 'POST',
          headers: serviceHeaders(),
          body: JSON.stringify({
            agency_id: agencyId,
            competitor_id: competitorId,
            event_type: 'scrape_complete',
            event_data: {
              competitor_name: competitor.name,
              changes_found: true,
              change_type: changeType,
              severity: severity,
              alerts_fired: alertsFired,
            },
            created_at: new Date().toISOString(),
          }),
        })
        if (!activityRes.ok) {
          await logFetchError('update activity feed', activityRes)
        } else {
          console.log('[scrape/route] STEP 11 done')
        }
      } catch (e) {
        console.error('[scrape/route] STEP 11 threw:', e)
      }
    }

    // ── STEP 12 — Return full response ────────────────────────────────────────
    console.log('[scrape/route] STEP 12: returning success')
    return NextResponse.json({
      success: true,
      changesFound: true,
      changeType,
      severity,
      insight,
      wordCount,
      techStack,
      alertsFired,
      snapshotId: newSnapshotId,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: 'timeout',
        message: 'Site took too long to respond',
      })
    }
    console.error('[scrape/route] uncaught error:', err)
    return NextResponse.json(
      { success: false, error: msg || 'Internal error' },
      { status: 500 }
    )
  } finally {
    await browser?.close().catch(() => {})
  }
}
