'use strict';

const { Practitioner } = require('../models');

const DEFAULT_TTL_MS = 30 * 1000;

const ttlEnv = Number.parseInt(process.env.PRACTITIONER_CACHE_TTL_MS, 10);
const TTL_MS = Number.isFinite(ttlEnv) && ttlEnv > 0 ? ttlEnv : DEFAULT_TTL_MS;

const caches = {
  id: new Map(),
  slug: new Map(),
  publicSlug: new Map(),
};

function normalizeId(id) {
  if (id === undefined || id === null) {
    return null;
  }
  return String(id);
}

function normalizeSlug(slug) {
  if (slug === undefined || slug === null) {
    return null;
  }
  const value = String(slug).trim();
  return value.length ? value : null;
}

function getEntry(cache, key) {
  if (!key) {
    return { hit: false, value: null };
  }

  const entry = cache.get(key);
  if (!entry) {
    return { hit: false, value: null };
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return { hit: false, value: null };
  }

  return { hit: true, value: entry.value };
}

function setEntry(cache, key, value) {
  if (!key) {
    return;
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

function remember(practitioner) {
  if (!practitioner) {
    return;
  }

  setEntry(caches.id, normalizeId(practitioner.id), practitioner);
  setEntry(caches.slug, normalizeSlug(practitioner.slug), practitioner);
  setEntry(caches.publicSlug, normalizeSlug(practitioner.publicSlug), practitioner);
}

async function getById(id) {
  const key = normalizeId(id);
  const { hit, value } = getEntry(caches.id, key);
  if (hit) {
    return value;
  }
  if (!key) {
    return null;
  }

  const practitioner = await Practitioner.findByPk(id);
  if (!practitioner) {
    setEntry(caches.id, key, null);
    return null;
  }

  remember(practitioner);
  return practitioner;
}

async function getBySlug(slug) {
  const key = normalizeSlug(slug);
  const { hit, value } = getEntry(caches.slug, key);
  if (hit) {
    return value;
  }
  if (!key) {
    return null;
  }

  const practitioner = await Practitioner.findOne({ where: { slug: key } });
  if (!practitioner) {
    setEntry(caches.slug, key, null);
    return null;
  }

  remember(practitioner);
  return practitioner;
}

async function getByPublicSlug(publicSlug) {
  const key = normalizeSlug(publicSlug);
  const { hit, value } = getEntry(caches.publicSlug, key);
  if (hit) {
    return value;
  }
  if (!key) {
    return null;
  }

  const practitioner = await Practitioner.findOne({ where: { publicSlug: key } });
  if (!practitioner) {
    setEntry(caches.publicSlug, key, null);
    return null;
  }

  remember(practitioner);
  return practitioner;
}

function clearCache() {
  caches.id.clear();
  caches.slug.clear();
  caches.publicSlug.clear();
}

module.exports = {
  getById,
  getBySlug,
  getByPublicSlug,
  clearCache,
  // Exported for testing/inspection
  _TTL_MS: TTL_MS,
};
