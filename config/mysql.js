import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT, 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const initializeMySQL = async () => {
  try {
    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        balance DECIMAL(10,2) DEFAULT 0
      )
    `);

    // Create transfer table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transfer (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_field VARCHAR(255),
        to_field VARCHAR(255),
        amount DECIMAL(10,2),
        description TEXT,
        time_stamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_field) REFERENCES users(username),
        FOREIGN KEY (to_field) REFERENCES users(username)
      )
    `);

    // Create bids table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        bid_amount DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_winner BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (username) REFERENCES users(username)
      )
    `);

    console.log('MySQL tables initialized successfully');
  } catch (error) {
    console.error('Error initializing MySQL tables:', error);
    throw error;
  }
};

export default pool; 