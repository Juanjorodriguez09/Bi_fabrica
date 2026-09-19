const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Adaptador pg (JavaScript puro) en vez del motor nativo en Rust — el motor
// nativo paniquea ("timer has gone away") en hosting compartido con CPU muy
// limitada/acelerada. Ver GUIA_INSTALACION_FABRICA.md §E.4.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

module.exports = prisma;
