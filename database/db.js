const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'portfolio_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Execute SQL file
async function executeSQLFile(filename) {
  const sqlPath = path.join(__dirname, filename);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    await pool.query(sql);
    console.log(`✅ Executed ${filename} successfully`);
  } catch (error) {
    console.error(`❌ Error executing ${filename}:`, error.message);
    throw error;
  }
}

// Initialize database schema
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Could not connect to database');
    }
    
    // Create tables
    await executeSQLFile('schema.sql');
    
    // Check if admin user exists, if not create default
    await createDefaultAdmin();
    
    console.log('✅ Database initialization complete');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Create default admin user if none exists
async function createDefaultAdmin() {
  const bcrypt = require('bcryptjs');
  
  try {
    const result = await pool.query('SELECT id FROM admin_users LIMIT 1');
    
    if (result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 12);
      
      await pool.query(
        'INSERT INTO admin_users (email, password_hash, created_at) VALUES ($1, $2, NOW())',
        [process.env.ADMIN_EMAIL || 'admin@example.com', hashedPassword]
      );
      
      console.log('✅ Default admin user created');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
    throw error;
  }
}

// Query helper function
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('📊 Executed query', { text, duration, rows: res.rowCount });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  }
}

// Transaction helper
async function withTransaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
async function closePool() {
  await pool.end();
  console.log('🔌 Database pool closed');
}

module.exports = {
  pool,
  query,
  withTransaction,
  initializeDatabase,
  closePool,
  testConnection
};