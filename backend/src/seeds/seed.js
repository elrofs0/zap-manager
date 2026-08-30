const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://zapmanager:zapmanager_secret@localhost:5432/zapmanager';

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Seeding database...');

    // Check if admin user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = 'admin@zapmanager.com'");
    if (existingUser.rows.length > 0) {
      console.log('Seed data already exists, skipping...');
      return;
    }

    // Admin user (password: admin123)
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)`,
      ['Administrador', 'admin@zapmanager.com', hash, 'admin']
    );

    // Motoboys
    await pool.query(
      `INSERT INTO motoboys (name, whatsapp, status, last_lat, last_lng) VALUES
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10)`,
      [
        'Carlos Silva', '5511999990001', 'available', -23.5505, -46.6333,
        'Roberto Santos', '5511999990002', 'available', -23.5610, -46.6550
      ]
    );

    // Employees
    await pool.query(
      `INSERT INTO employees (name, whatsapp, role, department) VALUES
       ($1, $2, $3, $4),
       ($5, $6, $7, $8),
       ($9, $10, $11, $12)`,
      [
        'Ana Paula Costa', '5511999990003', 'Atendente', 'Atendimento',
        'Fernando Lima', '5511999990004', 'Cozinheiro', 'Cozinha',
        'Mariana Oliveira', '5511999990005', 'Atendente', 'Atendimento'
      ]
    );

    console.log('Seeding completed successfully!');
    console.log('Admin login: admin@zapmanager.com / admin123');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seed().catch(() => process.exit(1));
}

module.exports = seed;
