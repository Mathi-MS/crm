import crypto from 'node:crypto'
import { Router } from 'express'
import mongoose from 'mongoose'

const GRAPH = process.env.META_GRAPH_URL || `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`

// ---- models -----------------------------------------------------------------
const metaSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'meta', unique: true },
    pageId: String,
    pageName: String,
    accessToken: String, // never sent to the browser
    appSecret: String, // never sent to the browser
    verifyToken: String,
    connectedAt: Date,
  },
  { timestamps: true },
)
const MetaConnection = mongoose.model('MetaConnection', metaSchema)

// The stages a lead moves through. `key` is what's stored; order = left to right on the board.
export const LEAD_STATUSES = [
  { key: 'new', label: 'New Lead', color: '#3b82f6' },
  { key: 'contacted', label: 'Contacted', color: '#f59e0b' },
  { key: 'qualified', label: 'Qualified', color: '#10b981' },
  { key: 'payment', label: 'Payment', color: '#8b5cf6' },
  { key: 'converted', label: 'Converted', color: '#06b6d4' },
  { key: 'lost', label: 'Lost', color: '#ec4899' },
]
const STATUS_KEYS = LEAD_STATUSES.map((s) => s.key)

const leadSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'meta' },
    leadgenId: { type: String, unique: true, sparse: true },
    formId: String,
    pageId: String,
    adId: String,
    name: String,
    email: String,
    phone: String,
    fields: { type: Map, of: String },
    status: { type: String, default: 'new' },
    isTest: { type: Boolean, default: false }, // sent with "Send test data" from Google Ads
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
export const Lead = mongoose.model('Lead', leadSchema)

const googleSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'google', unique: true },
    webhookKey: String, // shared secret Google sends back in every lead
    connectedAt: Date,
  },
  { timestamps: true },
)
const GoogleConnection = mongoose.model('GoogleConnection', googleSchema)

// ---- helpers ----------------------------------------------------------------
async function graph(path, { method = 'GET', token, params = {} } = {}) {
  const url = new URL(`${GRAPH}/${path}`)
  const body = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(method === 'GET' ? `${url}?${body}` : url, {
    method,
    ...(method === 'GET' ? {} : { body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Meta API error (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

function leadFromGraph(data, extra) {
  const fields = {}
  for (const f of data.field_data || []) fields[f.name] = (f.values || []).join(', ')
  const pick = (...keys) => keys.map((k) => fields[k]).find(Boolean) || ''
  return {
    leadgenId: data.id,
    formId: data.form_id || extra.formId,
    pageId: extra.pageId,
    adId: data.ad_id || extra.adId,
    name: pick('full_name') || [fields.first_name, fields.last_name].filter(Boolean).join(' '),
    email: pick('email'),
    phone: pick('phone_number', 'phone'),
    fields,
    receivedAt: data.created_time ? new Date(data.created_time) : new Date(),
  }
}

// Google Ads lead form webhook payload -> our lead shape
function leadFromGoogle(b) {
  const fields = {}
  const byId = {}
  for (const c of b.user_column_data || []) {
    const val = String(c.string_value ?? '')
    byId[c.column_id] = val
    fields[c.column_name || c.column_id] = val
  }
  if (b.campaign_id) fields.campaign_id = String(b.campaign_id)
  if (b.gcl_id) fields.gcl_id = String(b.gcl_id)
  return {
    source: 'google',
    leadgenId: `google:${b.lead_id}`,
    formId: String(b.form_id ?? ''),
    adId: String(b.creative_id ?? ''),
    name: byId.FULL_NAME || [byId.FIRST_NAME, byId.LAST_NAME].filter(Boolean).join(' '),
    email: byId.EMAIL || '',
    phone: byId.PHONE_NUMBER || '',
    fields,
    status: 'new',
    isTest: !!b.is_test,
    receivedAt: new Date(),
  }
}

const safeEqual = (a, b) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

// ---- routes -----------------------------------------------------------------
export function metaRoutes(requireAuth, requireAdmin) {
  const router = Router()

  // Status for the Settings page (secrets never returned)
  router.get('/api/integrations/meta', requireAdmin, async (_req, res) => {
    const c = await MetaConnection.findOne({ key: 'meta' })
    if (!c) return res.json({ connected: false })
    res.json({
      connected: true,
      pageId: c.pageId,
      pageName: c.pageName,
      verifyToken: c.verifyToken,
      hasAppSecret: !!c.appSecret,
      connectedAt: c.connectedAt,
    })
  })

  router.put('/api/integrations/meta', requireAdmin, async (req, res) => {
    const { pageId, accessToken, appSecret } = req.body ?? {}
    if (typeof pageId !== 'string' || !/^\d{5,25}$/.test(pageId.trim())) {
      return res.status(400).json({ message: 'Enter a valid Facebook Page ID (numbers only).' })
    }
    if (typeof accessToken !== 'string' || accessToken.trim().length < 20) {
      return res.status(400).json({ message: 'Enter a valid Page access token.' })
    }
    const id = pageId.trim()
    const token = accessToken.trim()

    let page
    try {
      page = await graph(id, { token, params: { fields: 'name' } })
    } catch (e) {
      return res.status(400).json({ message: `Meta rejected the Page ID / token: ${e.message}` })
    }

    // Subscribe the page to lead notifications
    try {
      await graph(`${id}/subscribed_apps`, { method: 'POST', token, params: { subscribed_fields: 'leadgen' } })
    } catch (e) {
      return res.status(400).json({
        message: `Connected to the page, but could not subscribe to leads: ${e.message}. The token needs the pages_manage_metadata, pages_show_list and leads_retrieval permissions.`,
      })
    }

    const existing = await MetaConnection.findOne({ key: 'meta' })
    const c = await MetaConnection.findOneAndUpdate(
      { key: 'meta' },
      {
        pageId: id,
        pageName: page.name,
        accessToken: token,
        appSecret: typeof appSecret === 'string' && appSecret.trim() ? appSecret.trim() : existing?.appSecret,
        verifyToken: existing?.verifyToken || crypto.randomBytes(16).toString('hex'),
        connectedAt: new Date(),
      },
      { upsert: true, returnDocument: 'after' },
    )
    res.json({ connected: true, pageId: c.pageId, pageName: c.pageName, verifyToken: c.verifyToken, hasAppSecret: !!c.appSecret, connectedAt: c.connectedAt })
  })

  router.delete('/api/integrations/meta', requireAdmin, async (_req, res) => {
    const c = await MetaConnection.findOne({ key: 'meta' })
    if (c) {
      try {
        await graph(`${c.pageId}/subscribed_apps`, { method: 'DELETE', token: c.accessToken })
      } catch {
        /* token may already be revoked; still disconnect locally */
      }
      await c.deleteOne()
    }
    res.json({ connected: false })
  })

  // Meta webhook verification handshake
  router.get('/api/webhooks/meta', async (req, res) => {
    const c = await MetaConnection.findOne({ key: 'meta' })
    const mode = req.query['hub.mode']
    const token = String(req.query['hub.verify_token'] ?? '')
    if (c && mode === 'subscribe' && safeEqual(token, c.verifyToken)) {
      return res.status(200).send(String(req.query['hub.challenge'] ?? ''))
    }
    res.sendStatus(403)
  })

  // New lead notifications
  router.post('/api/webhooks/meta', async (req, res) => {
    const c = await MetaConnection.findOne({ key: 'meta' })
    if (!c) return res.sendStatus(404)

    if (c.appSecret) {
      const sig = String(req.headers['x-hub-signature-256'] ?? '')
      const expected = 'sha256=' + crypto.createHmac('sha256', c.appSecret).update(req.rawBody ?? '').digest('hex')
      if (!safeEqual(sig, expected)) return res.sendStatus(401)
    }

    // Acknowledge fast; Meta retries on slow responses
    res.sendStatus(200)

    for (const entry of req.body?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue
        const v = change.value
        try {
          const data = await graph(v.leadgen_id, { token: c.accessToken })
          const doc = leadFromGraph(data, { formId: v.form_id, pageId: v.page_id || entry.id, adId: v.ad_id })
          await Lead.updateOne({ leadgenId: doc.leadgenId }, { $setOnInsert: doc }, { upsert: true })
        } catch (e) {
          console.error('Could not fetch Meta lead', v.leadgen_id, e.message)
        }
      }
    }
  })

  // ---- Google Ads lead form webhook ----------------------------------------
  const googleStatus = (c) =>
    c ? { connected: true, webhookKey: c.webhookKey, connectedAt: c.connectedAt } : { connected: false }

  router.get('/api/integrations/google', requireAdmin, async (_req, res) => {
    res.json(googleStatus(await GoogleConnection.findOne({ key: 'google' })))
  })

  // Connect (creates the key) or regenerate it
  router.put('/api/integrations/google', requireAdmin, async (req, res) => {
    const existing = await GoogleConnection.findOne({ key: 'google' })
    const regenerate = req.body?.regenerate === true
    const c = await GoogleConnection.findOneAndUpdate(
      { key: 'google' },
      {
        webhookKey: !existing || regenerate ? crypto.randomBytes(24).toString('hex') : existing.webhookKey,
        connectedAt: existing?.connectedAt ?? new Date(),
      },
      { upsert: true, returnDocument: 'after' },
    )
    res.json(googleStatus(c))
  })

  router.delete('/api/integrations/google', requireAdmin, async (_req, res) => {
    await GoogleConnection.deleteOne({ key: 'google' })
    res.json({ connected: false })
  })

  // Google posts each new lead here; the shared key is in the JSON body (google_key)
  router.post('/api/webhooks/google', async (req, res) => {
    const c = await GoogleConnection.findOne({ key: 'google' })
    if (!c) return res.sendStatus(404)
    if (!safeEqual(String(req.body?.google_key ?? ''), c.webhookKey)) return res.sendStatus(401)
    if (!req.body.lead_id) return res.status(400).json({ message: 'lead_id is required.' })

    const doc = leadFromGoogle(req.body)
    await Lead.updateOne({ leadgenId: doc.leadgenId }, { $setOnInsert: doc }, { upsert: true })
    res.sendStatus(200)
  })

  // Leads list for the Leads page
  router.get('/api/leads', requireAuth, async (_req, res) => {
    const leads = await Lead.find().sort({ receivedAt: -1 }).limit(200).lean()
    res.json({
      statuses: LEAD_STATUSES,
      leads: leads.map((l) => ({
        id: l._id.toString(),
        name: l.name,
        email: l.email,
        phone: l.phone,
        source: l.source,
        formId: l.formId,
        // older leads may carry a value that is not a stage (e.g. "test"): show them as New Lead
        status: STATUS_KEYS.includes(l.status) ? l.status : 'new',
        isTest: !!l.isTest || l.status === 'test',
        receivedAt: l.receivedAt,
      })),
    })
  })

  // Numbers for the Home dashboard. Filters: days = 7 | 30 | 90 (0 = all time), source = meta | google | manual | all.
  // "Last 30 days" means 30 whole calendar days in the viewer's time zone, ending today.
  router.get('/api/dashboard', requireAuth, async (req, res) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 0
    const source = ['meta', 'google', 'manual'].includes(String(req.query.source)) ? String(req.query.source) : 'all'

    // use the viewer's time zone if it is a real one, otherwise UTC
    let tz = 'UTC'
    try {
      const t = String(req.query.tz ?? '')
      if (/^[A-Za-z_]+(\/[A-Za-z_+\-0-9]+){0,2}$/.test(t)) {
        new Intl.DateTimeFormat('en-CA', { timeZone: t })
        tz = t
      }
    } catch {
      /* unknown name: stay on UTC */
    }

    const dayKey = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t)) // YYYY-MM-DD
    const shift = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10) // pure calendar maths
    const dayOfLead = { $dateToString: { format: '%Y-%m-%d', date: '$receivedAt', timezone: tz } }

    const today = dayKey(Date.now())
    const start = days ? shift(today, -(days - 1)) : null // first day of the period
    const prevStart = days ? shift(today, -(2 * days - 1)) : null // the same-length period just before it

    const filter = (from, before) => {
      const f = {}
      const parts = []
      if (from) parts.push({ $gte: [dayOfLead, from] })
      if (before) parts.push({ $lt: [dayOfLead, before] })
      if (parts.length) f.$expr = { $and: parts }
      if (source !== 'all') f.source = source
      return f
    }

    const [facet] = await Lead.aggregate([
      { $match: filter(start, null) },
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
          bySource: [{ $group: { _id: '$source', n: { $sum: 1 } } }],
          daily: [{ $group: { _id: dayOfLead, n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        },
      },
    ])

    // every stage appears, even with 0; a status that is no longer a stage counts as New Lead
    const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]))
    for (const r of facet.byStatus) byStatus[STATUS_KEYS.includes(r._id) ? r._id : 'new'] += r.n
    const bySource = Object.fromEntries(facet.bySource.map((r) => [r._id, r.n]))
    const total = Object.values(byStatus).reduce((s, n) => s + n, 0)

    // one entry per day in the period (zeros included) so the chart has no gaps
    const counts = new Map(facet.daily.map((d) => [d._id, d.n]))
    const daily = days
      ? Array.from({ length: days }, (_, i) => {
          const date = shift(start, i)
          return { date, count: counts.get(date) ?? 0 }
        })
      : facet.daily.map((d) => ({ date: d._id, count: d.n }))

    const previousTotal = days ? await Lead.countDocuments(filter(prevStart, start)) : null

    res.json({ filters: { days, source }, statuses: LEAD_STATUSES, total, previousTotal, byStatus, bySource, daily })
  })

  // The stages, for the "New lead" form
  router.get('/api/leads/statuses', requireAuth, (_req, res) => res.json({ statuses: LEAD_STATUSES }))

  // Add a lead by hand (phone call, walk-in, referral...). Any logged-in user can do this.
  router.post('/api/leads', requireAuth, async (req, res) => {
    const text = (v) => (typeof v === 'string' ? v.trim() : '')
    const name = text(req.body?.name)
    const email = text(req.body?.email).toLowerCase()
    const phone = text(req.body?.phone)
    const status = req.body?.status === undefined || req.body?.status === '' ? 'new' : req.body.status

    if (!name || name.length > 80) return res.status(400).json({ message: 'Name is required (max 80 characters).' })
    if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ message: 'Enter a valid email address.' })
    }
    if (phone && !/^[0-9+()\-\s]{6,20}$/.test(phone)) {
      return res.status(400).json({ message: 'Enter a valid phone number (digits, spaces, + and - only).' })
    }
    if (!email && !phone) return res.status(400).json({ message: 'Enter an email or a phone number so you can reach this lead.' })
    if (typeof status !== 'string' || !STATUS_KEYS.includes(status)) return res.status(400).json({ message: 'Choose a valid status.' })

    const lead = await Lead.create({ source: 'manual', name, email, phone, status, receivedAt: new Date() })
    res.status(201).json({
      lead: { id: lead._id.toString(), name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, status: lead.status, isTest: false, receivedAt: lead.receivedAt },
    })
  })

  // Move a lead to another stage (any logged-in user)
  router.patch('/api/leads/:id', requireAuth, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Lead not found.' })
    const status = req.body?.status
    if (typeof status !== 'string' || !STATUS_KEYS.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status.' })
    }
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' }).lean()
    if (!lead) return res.status(404).json({ message: 'Lead not found.' })
    res.json({ id: lead._id.toString(), status: lead.status })
  })

  return router
}
