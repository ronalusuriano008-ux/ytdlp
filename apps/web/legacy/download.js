import { getDB, saveDB } from "../../core/storage/db.js";
import { getSession } from "../../core/auth/session.js";

export function saveDownload(title, url, type) {

  const username = getSession()
  if (!username) return

  const db = getDB()

  if (!db[username]) return

  db[username].downloads.push({
    title: title,
    url: url,
    type: type,
    date: Date.now()
  })

  saveDB(db)

}

export function getDownloads() {

  const username = getSession()
  if (!username) return []

  const db = getDB()

  if (!db[username]) return []

  return db[username].downloads

}