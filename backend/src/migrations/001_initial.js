const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://zapmanager:zapmanager_secret@localhost:5432/zapmanager';

async function migrate() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Running migrations...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'supervisor', 'admin')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS motoboys (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
        last_lat DOUBLE PRECISION,
        last_lng DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        whatsapp VARCHAR(20) NOT NULL UNIQUE,
        role VARCHAR(100),
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        tracking_code VARCHAR(20) UNIQUE NOT NULL,
        route_description TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        customer_name VARCHAR(255),
        customer_whatsapp VARCHAR(20),
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'in_transit', 'delivered', 'cancelled', 'refused')),
        motoboy_id INTEGER REFERENCES motoboys(id),
        assignment_mode VARCHAR(20) DEFAULT 'round_robin' CHECK (assignment_mode IN ('round_robin', 'nearest')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        delivered_at TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS delivery_locations (
        id SERIAL PRIMARY KEY,
        delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        task TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'swap_requested', 'absent', 'cancelled')),
        swap_reason TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_ai_logs (
        id SERIAL PRIMARY KEY,
        request_text TEXT NOT NULL,
        ai_response TEXT,
        approved_by INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        context_type VARCHAR(50),
        context_data JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tracking_code);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_motoboy ON deliveries(motoboy_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_locations_delivery ON delivery_locations(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_employee ON schedules(employee_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone);
    `);

    console.log('Migrations completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch(() => process.exit(1));
}

module.exports = migrate;
