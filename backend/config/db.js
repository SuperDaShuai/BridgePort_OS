require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'trade_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_general_ci',
  dateStrings: true,
  decimalNumbers: true // DECIMAL 直接返回数字，避免前端拿到字符串
});

// 引入时主动自检一次连接，启动瞬间即可暴露配置问题
pool.getConnection()
  .then((connection) => {
    console.log('[DB] MySQL 连接成功');
    connection.release();
  })
  .catch((err) => {
    console.error('[DB] MySQL 连接失败:', err.message);
  });

module.exports = pool;
