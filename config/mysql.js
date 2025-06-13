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
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    console.log('MySQL connection pool created successfully.');
    console.log('Solution from MySQL query:', rows[0].solution);
  } catch (error) {
    console.error('Error initializing MySQL connection pool:', error);
    process.exit(1); // Exit if MySQL connection fails
  }
};

export default pool; 