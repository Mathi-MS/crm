// Dummy leads (Tamil Nadu names) for trying out the Leads page.
//   npm run seed:leads               add 50 dummy leads. If they already exist it refreshes their names,
//                                    emails and phones but keeps each lead's stage and arrival time.
//   npm run seed:leads -- --remove   delete only the dummy leads, real leads are never touched
import 'dotenv/config'
import mongoose from 'mongoose'
import { Lead } from './meta.js'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm'
const PREFIX = 'dummy:' // every dummy lead's leadgenId starts with this
const COUNT = 50

// how many of the 50 sit in each stage, in order: new, contacted, qualified, payment, converted, lost
const STAGES = [['new', 14], ['contacted', 11], ['qualified', 12], ['payment', 4], ['converted', 5], ['lost', 4]]
const STATUS_FOR = STAGES.flatMap(([key, n]) => Array(n).fill(key))

const NAMES = [
  'Karthik Subramanian', 'Priya Dharshini', 'Arun Kumar', 'Kavitha Selvaraj', 'Senthil Murugan',
  'Meenakshi Sundaram', 'Vignesh Raja', 'Lakshmi Narayanan', 'Prakash Shanmugam', 'Deepa Rajan',
  'Muthu Krishnan', 'Revathi Murugesan', 'Saravanan Palanisamy', 'Anitha Krishnan', 'Ganesh Babu',
  'Janani Venkatraman', 'Rajesh Kannan', 'Sangeetha Pandian', 'Dinesh Selvam', 'Nandhini Shanmugam',
  'Manikandan Ramasamy', 'Divya Bharathi', 'Harish Venkatesh', 'Pavithra Karthikeyan', 'Bala Subramaniam',
  'Thenmozhi Ayyappan', 'Ashok Kumar', 'Gayathri Ramanathan', 'Vijay Anand', 'Swetha Balaji',
  'Surya Prakash', 'Sowmiya Arunachalam', 'Naveen Chandran', 'Abirami Thangavel', 'Gopinath Sundaram',
  'Kalaivani Duraisamy', 'Ramesh Natarajan', 'Yamini Raghavan', 'Velmurugan Arumugam', 'Ramya Sivakumar',
  'Tamilselvan Rajendran', 'Mythili Gopalan', 'Mohan Raj', 'Keerthana Mohan', 'Elango Pandian',
  'Vasanthi Perumal', 'Siva Kumar', 'Bhuvaneswari Kandasamy', 'Anbu Chezhian', 'Nithya Elumalai',
]
const COMPANIES = [
  'Sri Murugan Textiles', 'Kovai Tech Solutions', 'Madurai Foods', 'Chennai Infra', 'Salem Steels',
  'Trichy Traders', 'Coimbatore Pumps', 'Nellai Agro', 'Erode Spinning Mills', 'Tirupur Garments',
]
const CITIES = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Tiruppur', 'Vellore', 'Thanjavur']
const MOBILE_START = ['98', '97', '94', '90', '99', '88', '73', '81', '63', '72'] // Indian mobile numbers start with 6-9
const MAIL = ['gmail.com', 'company', 'outlook.com'] // gmail, the person's company, outlook

// small deterministic "random" so every run produces the same 50 leads
let seed = 42
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const pick = (a) => a[Math.floor(rnd() * a.length)]
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.')

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
try {
  if (process.argv.includes('--remove')) {
    const r = await Lead.deleteMany({ leadgenId: { $regex: `^${PREFIX}` } })
    console.log(`Removed ${r.deletedCount} dummy leads.`)
  } else {
    const now = Date.now()
    const ops = NAMES.slice(0, COUNT).map((name, i) => {
      const source = i % 3 === 1 ? 'google' : 'meta' // roughly 2/3 Meta, 1/3 Google
      const company = pick(COMPANIES)
      const domain = MAIL[i % 3] === 'company' ? `${slug(company).replace(/\./g, '')}.in` : MAIL[i % 3]
      const email = `${slug(name)}@${domain}`
      const digits = String(Math.floor(rnd() * 1e8)).padStart(8, '0')
      const mobile = `+91 ${pick(MOBILE_START)}${digits.slice(0, 3)} ${digits.slice(3)}` // e.g. +91 98765 43210
      const receivedAt = new Date(now - Math.floor(rnd() * 30 * 24 * 60) * 60000) // within the last 30 days
      const city = pick(CITIES)
      return {
        updateOne: {
          filter: { leadgenId: `${PREFIX}${i + 1}` },
          update: {
            // always refreshed, so re-running swaps old dummy names for these
            $set: {
              source,
              formId: source === 'meta' ? `F-${1000 + (i % 4)}` : `G-${200 + (i % 3)}`,
              name,
              email,
              phone: mobile,
              fields: { company, city },
            },
            // only set when the lead is first created, so a refresh never moves a lead back a stage
            $setOnInsert: { leadgenId: `${PREFIX}${i + 1}`, status: STATUS_FOR[i] ?? 'new', receivedAt },
          },
          upsert: true,
        },
      }
    })
    const r = await Lead.bulkWrite(ops)
    console.log(`Dummy leads: ${r.upsertedCount} added, ${r.modifiedCount} refreshed.`)
  }
  console.log(`Leads in the database now: ${await Lead.countDocuments()}`)
} finally {
  await mongoose.disconnect()
}
