import fs from 'node:fs';
import Architecture from '../models/Architecture.js';
import contentConnection from '../config/content-database.js';

const localGalleries = JSON.parse(fs.readFileSync(new URL('../data/architecture.json', import.meta.url), 'utf8'));

export async function loadArchitecture() {
  if (contentConnection.readyState === 1) {
    try {
      const galleries = await Architecture.find({}, { _id: 0, __v: 0 }).sort({ number: 1 }).lean();
      return { galleries, architectureUnavailable: false };
    } catch { /* Keep the gallery available while the database recovers. */ }
  }
  return { galleries: localGalleries, architectureUnavailable: true };
}
