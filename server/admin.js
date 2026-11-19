import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Role, User, publicUser } from './models.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isDuplicate = (e) => e?.code === 11000
const bad = (res, message, status = 400) => res.status(status).json({ message })
const str = (v) => (typeof v === 'string' ? v.trim() : '')

// How many users would still be admins if `excludeUserId` stopped being one
async function otherAdminCount(excludeUserId) {
  const adminRoleIds = (await Role.find({ isAdmin: true }).select('_id').lean()).map((r) => r._id)
  // only active admins count: a deactivated admin cannot rescue the system
  return User.countDocuments({ role: { $in: adminRoleIds }, _id: { $ne: excludeUserId }, isActive: { $ne: false } })
}

export function adminRoutes(requireAdmin) {
  const router = Router()

  // ---- roles (Masters) ------------------------------------------------------
  const roleOut = (r, userCount) => ({
    id: r._id.toString(),
    name: r.name,
    description: r.description,
    isAdmin: r.isAdmin,
    isSystem: r.isSystem,
    userCount,
  })

  router.get('/api/roles', requireAdmin, async (_req, res) => {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean()
    const counts = await User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }])
    const byId = new Map(counts.map((c) => [String(c._id), c.n]))
    res.json({ roles: roles.map((r) => roleOut(r, byId.get(String(r._id)) ?? 0)) })
  })

  function readRole(body) {
    const name = str(body?.name)
    const description = str(body?.description)
    if (!name || name.length > 40) return { error: 'Role name is required (max 40 characters).' }
    if (description.length > 200) return { error: 'Description is too long (max 200 characters).' }
    return { name, description, isAdmin: body?.isAdmin === true }
  }

  router.post('/api/roles', requireAdmin, async (req, res) => {
    const r = readRole(req.body)
    if (r.error) return bad(res, r.error)
    try {
      const role = await Role.create(r)
      res.status(201).json({ role: roleOut(role, 0) })
    } catch (e) {
      if (isDuplicate(e)) return bad(res, 'A role with this name already exists.', 409)
      throw e
    }
  })

  router.put('/api/roles/:id', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Role not found.', 404)
    const role = await Role.findById(req.params.id)
    if (!role) return bad(res, 'Role not found.', 404)
    const r = readRole(req.body)
    if (r.error) return bad(res, r.error)

    if (role.isSystem) {
      // built-in Admin: only the description can change
      role.description = r.description
    } else {
      if (role.isAdmin && !r.isAdmin) {
        // turning admin rights off must not leave the system without an admin
        const adminRoleIds = (await Role.find({ isAdmin: true, _id: { $ne: role._id } }).select('_id').lean()).map((x) => x._id)
        if ((await User.countDocuments({ role: { $in: adminRoleIds } })) === 0) {
          return bad(res, 'This would leave no administrator. Keep at least one admin.')
        }
      }
      role.name = r.name
      role.description = r.description
      role.isAdmin = r.isAdmin
    }
    try {
      await role.save()
    } catch (e) {
      if (isDuplicate(e)) return bad(res, 'A role with this name already exists.', 409)
      throw e
    }
    res.json({ role: roleOut(role, await User.countDocuments({ role: role._id })) })
  })

  router.delete('/api/roles/:id', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Role not found.', 404)
    const role = await Role.findById(req.params.id)
    if (!role) return bad(res, 'Role not found.', 404)
    if (role.isSystem) return bad(res, 'The built-in Admin role cannot be deleted.')
    const n = await User.countDocuments({ role: role._id })
    if (n > 0) return bad(res, `${n} user${n === 1 ? ' is' : 's are'} using this role. Move them to another role first.`, 409)
    await role.deleteOne()
    res.json({ ok: true })
  })

  // ---- users ----------------------------------------------------------------
  router.get('/api/users', requireAdmin, async (_req, res) => {
    const users = await User.find().populate('role').sort({ createdAt: 1 })
    res.json({ users: users.map(publicUser) })
  })

  async function readUser(body, { passwordRequired }) {
    const name = str(body?.name)
    const email = str(body?.email).toLowerCase()
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!name || name.length > 80) return { error: 'Name is required (max 80 characters).' }
    if (!EMAIL_RE.test(email) || email.length > 120) return { error: 'Enter a valid email address.' }
    if (!mongoose.isValidObjectId(body?.role)) return { error: 'Choose a role.' }
    const role = await Role.findById(body.role)
    if (!role) return { error: 'That role no longer exists.' }
    if (passwordRequired || password) {
      if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
      if (password.length > 72) return { error: 'Password must be 72 characters or fewer.' }
    }
    return { name, email, role, password }
  }

  router.post('/api/users', requireAdmin, async (req, res) => {
    const u = await readUser(req.body, { passwordRequired: true })
    if (u.error) return bad(res, u.error)
    try {
      const user = await User.create({
        name: u.name,
        email: u.email,
        role: u.role._id,
        passwordHash: await bcrypt.hash(u.password, 10),
      })
      await user.populate('role')
      res.status(201).json({ user: publicUser(user) })
    } catch (e) {
      if (isDuplicate(e)) return bad(res, 'A user with this email already exists.', 409)
      throw e
    }
  })

  router.put('/api/users/:id', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404)
    const user = await User.findById(req.params.id).populate('role')
    if (!user) return bad(res, 'User not found.', 404)
    const u = await readUser(req.body, { passwordRequired: false })
    if (u.error) return bad(res, u.error)

    if (user.role?.isAdmin && !u.role.isAdmin && (await otherAdminCount(user._id)) === 0) {
      return bad(res, 'This is the only administrator. Make someone else an admin first.')
    }
    user.name = u.name
    user.email = u.email
    user.role = u.role._id
    if (u.password) user.passwordHash = await bcrypt.hash(u.password, 10)
    try {
      await user.save()
    } catch (e) {
      if (isDuplicate(e)) return bad(res, 'A user with this email already exists.', 409)
      throw e
    }
    await user.populate('role')
    res.json({ user: publicUser(user) })
  })

  // Switch a user on or off
  router.patch('/api/users/:id/status', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404)
    if (typeof req.body?.isActive !== 'boolean') return bad(res, 'isActive must be true or false.')
    const isActive = req.body.isActive
    if (!isActive && req.params.id === req.me._id.toString()) return bad(res, 'You cannot deactivate your own account.')
    const user = await User.findById(req.params.id).populate('role')
    if (!user) return bad(res, 'User not found.', 404)
    if (!isActive && user.role?.isAdmin && (await otherAdminCount(user._id)) === 0) {
      return bad(res, 'This is the only active administrator and cannot be deactivated.')
    }
    user.isActive = isActive
    await user.save()
    res.json({ user: publicUser(user) })
  })

  router.delete('/api/users/:id', requireAdmin, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'User not found.', 404)
    if (req.params.id === req.me._id.toString()) return bad(res, 'You cannot delete your own account.')
    const user = await User.findById(req.params.id).populate('role')
    if (!user) return bad(res, 'User not found.', 404)
    if (user.role?.isAdmin && (await otherAdminCount(user._id)) === 0) {
      return bad(res, 'This is the only administrator and cannot be deleted.')
    }
    await user.deleteOne()
    res.json({ ok: true })
  })

  return router
}
