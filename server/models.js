import mongoose from 'mongoose'

// ---- roles (created by an admin under Masters) --------------------------------
const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, unique: true }, // lowercase copy so "Sales" and "sales" collide
    description: { type: String, default: '', trim: true },
    isAdmin: { type: Boolean, default: false }, // can manage users, roles and connections
    isSystem: { type: Boolean, default: false }, // the built-in Admin role can't be deleted
  },
  { timestamps: true },
)
roleSchema.pre('validate', function () {
  this.nameKey = this.name.trim().toLowerCase()
})
export const Role = mongoose.model('Role', roleSchema)

// ---- users --------------------------------------------------------------------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    // Inactive users cannot log in. Older records have no value here and count as active.
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    // Appearance settings; null until the user saves them for the first time
    preferences: {
      type: new mongoose.Schema(
        {
          mode: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
          accent: { type: String, default: '#a28bec' },
          font: { type: String, default: 'satoshi' },
          size: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
)
export const User = mongoose.model('User', userSchema)

// ---- shapes sent to the browser (never the password hash) ---------------------
export const roleInfo = (r) => (r ? { id: r._id.toString(), name: r.name, isAdmin: !!r.isAdmin } : null)

// `u.role` must be populated
export const publicUser = (u) => ({
  id: u._id.toString(),
  name: u.name,
  email: u.email,
  role: roleInfo(u.role && u.role._id ? u.role : null),
  isActive: u.isActive !== false,
  lastLoginAt: u.lastLoginAt ?? null,
  createdAt: u.createdAt,
})
