const pool = require('./config/db');
(async () => {
  try {
    // 模拟真实压缩后合同章：2MB base64
    const big = 'data:image/png;base64,' + 'A'.repeat(2000000);
    const [r] = await pool.query('UPDATE company_settings SET contract_seal_img = ? WHERE id = 1', [big]);
    const [[row]] = await pool.query('SELECT LENGTH(contract_seal_img) AS len FROM company_settings WHERE id = 1');
    console.log('2MB test OK, stored length:', row.len);
    await pool.query("UPDATE company_settings SET contract_seal_img = NULL WHERE id = 1");
    const [p] = await pool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    console.log('max_allowed_packet:', p[0].Value);
    process.exit(0);
  } catch(e) { console.error('ERR:', e.message); process.exit(1); }
})();
