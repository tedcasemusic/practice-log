import { openDB, type DBSchema } from 'idb'

interface PracticeDB extends DBSchema {
  sessions: {
    key: string
    value: {
      id: string
      user_id?: string | null
      started_at: string
      ended_at: string
      minutes: number
      category: 'scales'|'review'|'new'|'technique'
      note?: string | null
      synced?: boolean
    }
    indexes: { 'by-user': string }
  }
  weekly_plans: {
    key: string
    value: {
      id: string
      user_id?: string | null
      week_start: string // YYYY-MM-DD
      daily_goal_minutes: number
      items: Array<{ category: 'scales'|'review'|'new'|'technique'; target_minutes: number; note?: string | null }>
      synced?: boolean
    }
    indexes: { 'by-user-week': string }
  }
}

export async function getDB() {
  return openDB<PracticeDB>('practice-log', 1, {
    upgrade(db) {
      const s = db.createObjectStore('sessions', { keyPath: 'id' })
      s.createIndex('by-user', 'user_id')

      const w = db.createObjectStore('weekly_plans', { keyPath: 'id' })
      w.createIndex('by-user-week', 'week_start')
    }
  })
}
