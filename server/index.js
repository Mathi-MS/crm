import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import { Lead, metaRoutes } from './meta.js'
import { adminRoutes } from './admin.js'
import { Role, User, publicUser } from './models.js'

const PORT = process.env.PORT || 4000
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim())
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h'
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm'

let JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex')
  console.warn('JWT_SECRET not set: using a random one (tokens reset on restart). Set it in server/.env')
}

// models live in models.js (User, Role)

// A hash to compare against when the email is unknown, so timing doesn't reveal valid emails
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10)

// The built-in Admin role, plus a first admin user on a fresh database
async function seedData() {
  let adminRole = await Role.findOne({ isSystem: true })
  if (!adminRole) {
    adminRole = await Role.create({ name: 'Admin', description: 'Full access', isAdmin: true, isSystem: true })
  }

  if ((await User.estimatedDocumentCount()) === 0) {
    const email = process.env.SEED_EMAIL || 'admin@example.com'
    const password = process.env.SEED_PASSWORD || 'Admin@12345'
    await User.create({ name: 'Admin', email, role: adminRole._id, passwordHash: await bcrypt.hash(password, 10) })
    console.log(`Seeded user: ${email} / ${password}  (change this!)`)
    return
  }

  // Upgrade from the version without roles: if nobody is an admin yet, the oldest user becomes one
  if ((await User.countDocuments({ role: adminRole._id })) === 0) {
    const first = await User.findOne({ role: null }).sort({ createdAt: 1 })
    if (first) {
      first.role = adminRole._id
      await first.save()
      console.log(`Gave the Admin role to existing user ${first.email}`)
    }
  }
}

// ---- app --------------------------------------------------------------------
const app = express()
app.use(cors({ origin: CLIENT_ORIGIN }))
app.use(
  express.json({
    limit: '100kb',
    // keep the raw bytes so Meta webhook signatures can be verified
    verify: (req, _res, buf) => {
      req.rawBody = buf
    },
  }),
)

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again later.' },
})

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 }),
)

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body ?? {}
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).populate('role')
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)
    if (!user || !ok) return res.status(401).json({ message: 'Invalid email or password.' })
    // only said after the password was right, so this can't be used to probe which emails exist
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account is inactive. Please contact your administrator.' })
    }
    user.lastLoginAt = new Date()
    await User.updateOne({ _id: user._id }, { lastLoginAt: user.lastLoginAt })

    const token = jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    })
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Not authenticated.' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
  try {
    // checked on every request so deactivating or deleting a user cuts off their open sessions
    const u = await User.findById(payload.sub).select('isActive').lean()
    if (!u || u.isActive === false) {
      return res.status(401).json({ message: 'This account is inactive or no longer exists.' })
    }
    req.auth = payload
    next()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
}

// Admin-only routes: the user's role must have admin rights (checked on every request)
function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    try {
      const me = await User.findById(req.auth.sub).populate('role')
      if (!me) return res.status(401).json({ message: 'User not found.' })
      if (!me.role?.isAdmin) return res.status(403).json({ message: 'Admins only.' })
      req.me = me
      next()
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error.' })
    }
  })
}

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.sub).populate('role')
    if (!user) return res.status(401).json({ message: 'User not found.' })
    res.json({ user: publicUser(user) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error.' })
  }
})

// ---- per-user appearance settings --------------------------------------------
const FONT_IDS = ['satoshi', 'inter', 'poppins', 'dmsans', 'space', 'lora', 'system', 'mono']
const MODES = ['light', 'dark', 'system']
const SIZES = ['sm', 'md', 'lg']
const HEX = /^#[0-9a-fA-F]{6}$/

const publicPrefs = (p) => (p ? { mode: p.mode, accent: p.accent, font: p.font, size: p.size } : null)

app.get('/api/settings/preferences', requireAuth, async (req, res) => {
  // lean(): read the raw document so "never saved" stays null instead of schema defaults
  const user = await User.findById(req.auth.sub).lean()
  if (!user) return res.status(401).json({ message: 'User not found.' })
  res.json({ preferences: publicPrefs(user.preferences ?? null) })
})

app.put('/api/settings/preferences', requireAuth, async (req, res) => {
  const { mode, accent, font, size } = req.body ?? {}
  if (!MODES.includes(mode) || !SIZES.includes(size) || !FONT_IDS.includes(font) || typeof accent !== 'string' || !HEX.test(accent)) {
    return res.status(400).json({ message: 'Invalid settings.' })
  }
  const user = await User.findByIdAndUpdate(
    req.auth.sub,
    { preferences: { mode, accent: accent.toLowerCase(), font, size } },
    { returnDocument: 'after' },
  )
  if (!user) return res.status(401).json({ message: 'User not found.' })
  res.json({ preferences: publicPrefs(user.preferences) })
})

app.use(metaRoutes(requireAuth, requireAdmin))
app.use(adminRoutes(requireAdmin))

// Last-resort error handler: return a 500 instead of leaking details
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Server error.' })
})

// ---- start ------------------------------------------------------------------
try {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  console.log(`MongoDB connected: ${MONGODB_URI}`)
  await seedData()
  // the "Demo" stage was removed: leads that were in it move to Qualified
  const moved = await Lead.updateMany({ status: 'demo' }, { status: 'qualified' })
  if (moved.modifiedCount) console.log(`Moved ${moved.modifiedCount} leads from the removed Demo stage to Qualified`)
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  process.exit(1)
}
