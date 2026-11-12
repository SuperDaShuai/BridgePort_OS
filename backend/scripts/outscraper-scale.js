/**
 * 电子秤经销商批量爬取脚本
 * 目标国家：约旦 / 土耳其 / 阿联酋 / 迪拜 / 沙特
 *
 * 使用方法：
 *   1. 注册 https://app.outscraper.com/signup 获取 API Key
 *   2. 把 API Key 填到下方 OUTSCRAPER_API_KEY
 *   3. node scripts/outscraper-scale.js
 *   4. 结果输出到 data/scale-dealers-YYYYMMDD-HHmmss.xlsx
 */

const OUTSCRAPER_API_KEY = 'YOUR-API-KEY-HERE'; // ← 改这里

const fs = require('fs');
const path = require('path');
const Outscraper = require('outscraper');
const ExcelJS = require('exceljs');

// ===================== 1. 准备所有搜索 Query =====================
const QUERIES = [
  // --- 约旦 Jordan (JO) ---
  { query: 'scale dealer, Jordan',                    country: '约旦', countryCode: 'JO' },
  { query: 'weighing scale supplier, Jordan',         country: '约旦', countryCode: 'JO' },
  { query: 'تاجر موازين، الأردن',                     country: '约旦', countryCode: 'JO' },

  // --- 土耳其 Turkey (TR) ---
  { query: 'scale dealer, Turkey',                    country: '土耳其', countryCode: 'TR' },
  { query: 'weighing scale supplier, Turkey',         country: '土耳其', countryCode: 'TR' },
  { query: 'tartı aleti bayisi, Türkiye',             country: '土耳其', countryCode: 'TR' },

  // --- 阿联酋 UAE (AE) ---
  { query: 'scale dealer, United Arab Emirates',       country: '阿联酋', countryCode: 'AE' },
  { query: 'weighing scale supplier, UAE',            country: '阿联酋', countryCode: 'AE' },
  { query: 'تاجر موازين، الإمارات',                   country: '阿联酋', countryCode: 'AE' },

  // --- 迪拜 Dubai (阿联酋酋长国，单独搜一次更精准) ---
  { query: 'scale dealer, Dubai, UAE',                country: '迪拜', countryCode: 'AE' },
  { query: 'weighing scale supplier, Dubai',           country: '迪拜', countryCode: 'AE' },
  { query: 'تاجر موازين، دبي',                        country: '迪拜', countryCode: 'AE' },

  // --- 沙特 Saudi Arabia (SA) ---
  { query: 'scale dealer, Saudi Arabia',              country: '沙特', countryCode: 'SA' },
  { query: 'weighing scale supplier, Saudi Arabia',   country: '沙特', countryCode: 'SA' },
  { query: 'تاجر موازين، المملكة العربية السعودية',     country: '沙特', countryCode: 'SA' },
];

// ===================== 2. 工具函数 =====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dedupeByPlaceId(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const key = item.place_id || item.google_id || (item.name + item.full_address);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function normalizeEmail(raw) {
  if (!raw) return '';
  // enrichment 返回的可能是数组或字符串
  if (Array.isArray(raw)) return raw.join('; ');
  if (typeof raw === 'string') return raw;
  return '';
}

function normalizeEnrichment(raw) {
  if (!raw || typeof raw !== 'object') return '';
  const emails = raw.emails || [];
  return Array.isArray(emails) ? emails.join('; ') : String(emails || '');
}

// ===================== 3. 主流程 =====================
async function main() {
  if (!OUTSCRAPER_API_KEY || OUTSCRAPER_API_KEY === 'YOUR-API-KEY-HERE') {
    console.error('❌ 请先在脚本顶部填入 OUTSCRAPER_API_KEY');
    console.error('   注册地址: https://app.outscraper.com/signup');
    process.exit(1);
  }

  const client = new Outscraper(OUTSCRAPER_API_KEY);

  // 输出目录
  const outDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('========================================');
  console.log(' 电子秤经销商批量爬取');
  console.log(` 共 ${QUERIES.length} 个搜索任务`);
  console.log('========================================\n');

  // 收集所有结果
  const allResults = [];

  // 逐个提交（API 最多支持 1000 个 query 批量提交，这里我们也可以分批）
  // 但为了方便追踪进度，每个 query 单独提交
  for (let i = 0; i < QUERIES.length; i++) {
    const task = QUERIES[i];
    console.log(`[${i + 1}/${QUERIES.length}] 正在搜索: "${task.query}" (${task.country})`);

    try {
      // 提交异步请求
      const response = await client.googleMapsSearch([task.query], {
        limit: 200,                          // 每个 query 取 200 条（中东地区密度不高，200 足够覆盖）
        dropDuplicates: true,
        async: true,                          // 异步，超时更稳
        enrichment: ['leads_n_contacts'],     // 额外爬邮箱、社交链接
        filters: ['only_with_website', 'operational_only'], // 只要有网站 + 正常营业的
      });

      const requestId = response.id;
      console.log(`   → Request ID: ${requestId}，等待执行...`);

      // 轮询结果（最多等 3 分钟）
      let data = null;
      for (let poll = 0; poll < 18; poll++) {
        await sleep(10000); // 每 10 秒查一次

        try {
          const pollRes = await new Promise((resolve, reject) => {
            const https = require('https');
            const options = {
              hostname: 'api.outscraper.cloud',
              path: `/requests/${requestId}`,
              headers: { 'X-API-KEY': OUTSCRAPER_API_KEY },
            };
            https.get(options, (res) => {
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
              });
            }).on('error', reject);
          });

          if (pollRes.status === 'Success' || pollRes.status === 'success') {
            data = pollRes.data;
            break;
          } else if (pollRes.status === 'Failure' || pollRes.status === 'failure') {
            console.log(`   ❌ 请求失败: ${pollRes.errorMessage || pollRes.status}`);
            break;
          }
          // 否则继续等
          process.stdout.write(`   ⏳ 已等 ${(poll + 1) * 10}s...\r`);
        } catch (pollErr) {
          console.log(`   ⚠️ 轮询异常: ${pollErr.message}`);
        }
      }

      if (data) {
        // data 是数组，每个元素对应一个 query
        const items = Array.isArray(data) ? data.flat() : [];
        console.log(`   ✅ 找到 ${items.length} 条结果\n`);

        // 标记来源国家
        for (const item of items) {
          item._source_country = task.country;
          item._source_query = task.query;
        }
        allResults.push(...items);
      } else {
        console.log(`   ⏰ 超时未获取到结果\n`);
      }
    } catch (err) {
      console.log(`   ❌ 提交异常: ${err.message}\n`);
    }

    // 每个任务间隔 3 秒，避免触发频率限制
    if (i < QUERIES.length - 1) await sleep(3000);
  }

  // ===================== 4. 去重 =====================
  const unique = dedupeByPlaceId(allResults);
  console.log(`\n📊 去重前: ${allResults.length} 条 → 去重后: ${unique.length} 条`);

  // ===================== 5. 导出 Excel =====================
  if (unique.length === 0) {
    console.log('⚠️  没有任何结果，检查 query 或 API 配额');
    return;
  }

  const wb = new ExcelJS.Workbook();

  // Sheet 1: 全部结果
  const ws = wb.addWorksheet('全部电子秤经销商');

  ws.columns = [
    { header: '#',            key: 'idx',      width: 6  },
    { header: '来源国家',     key: '来源国家', width: 10 },
    { header: '公司名称',     key: 'name',      width: 30 },
    { header: '分类',         key: 'type',      width: 25 },
    { header: '国家',         key: 'country',   width: 18 },
    { header: '城市',         key: 'city',      width: 15 },
    { header: '完整地址',     key: 'full_address', width: 45 },
    { header: '电话',         key: 'phone',     width: 20 },
    { header: '网站',         key: 'site',      width: 35 },
    { header: '邮箱',         key: 'emails',    width: 30 },
    { header: '评分',         key: 'rating',    width: 8  },
    { header: '评论数',       key: 'reviews',   width: 10 },
    { header: 'Google验证',   key: 'verified',  width: 12 },
    { header: '经营状态',     key: 'business_status', width: 15 },
    { header: 'Google地图',   key: 'location_link', width: 50 },
  ];

  // 表头样式
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // 填充数据
  unique.forEach((item, idx) => {
    ws.addRow({
      idx:          idx + 1,
      '来源国家':    item._source_country || '',
      name:         item.name || '',
      type:         item.type || item.category || '',
      country:      item.country || '',
      city:         item.city || '',
      full_address: item.full_address || '',
      phone:        item.phone || '',
      site:         item.site || '',
      emails:       normalizeEmail(item.emails) || normalizeEnrichment(item.enrichment),
      rating:       item.rating ?? '',
      reviews:      item.reviews ?? '',
      verified:     item.verified ? '是' : (item.verified === false ? '否' : ''),
      business_status: item.business_status || '',
      location_link: item.location_link || '',
    });
  });

  // 冻结表头
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // 按国家再拆 Sheet
  const byCountry = {};
  for (const item of unique) {
    const c = item._source_country || '其他';
    if (!byCountry[c]) byCountry[c] = [];
    byCountry[c].push(item);
  }

  for (const [countryName, items] of Object.entries(byCountry)) {
    const sheetName = countryName.replace(/[\\\/\?\*\[\]:]/g, '_'); // Excel sheet 名不能有这些字符
    const ws2 = wb.addWorksheet(sheetName);

    ws2.columns = [
      { header: '#',         key: 'idx',       width: 6  },
      { header: '公司名称',   key: 'name',      width: 30 },
      { header: '分类',      key: 'type',      width: 25 },
      { header: '城市',      key: 'city',      width: 15 },
      { header: '完整地址',   key: 'full_address', width: 45 },
      { header: '电话',      key: 'phone',     width: 20 },
      { header: '网站',      key: 'site',      width: 35 },
      { header: '邮箱',      key: 'emails',    width: 30 },
      { header: '评分',      key: 'rating',    width: 8  },
      { header: '评论数',    key: 'reviews',   width: 10 },
      { header: 'Google地图', key: 'location_link', width: 50 },
    ];

    ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E75B6' } };
    ws2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.views = [{ state: 'frozen', ySplit: 1 }];

    items.forEach((item, idx) => {
      ws2.addRow({
        idx:          idx + 1,
        name:         item.name || '',
        type:         item.type || item.category || '',
        city:         item.city || '',
        full_address: item.full_address || '',
        phone:        item.phone || '',
        site:         item.site || '',
        emails:       normalizeEmail(item.emails) || normalizeEnrichment(item.enrichment),
        rating:       item.rating ?? '',
        reviews:      item.reviews ?? '',
        location_link: item.location_link || '',
      });
    });
  }

  // 保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `scale-dealers-${timestamp}.xlsx`;
  const filepath = path.join(outDir, filename);
  await wb.xlsx.writeFile(filepath);

  console.log(`\n📁 Excel 已保存: ${filepath}`);
  console.log(`   共 ${unique.length} 条经销商记录`);

  // 简单统计
  console.log('\n📊 各国数据统计:');
  for (const [c, items] of Object.entries(byCountry)) {
    const withEmail = items.filter(i => normalizeEmail(i.emails) || normalizeEnrichment(i.enrichment)).length;
    const withSite = items.filter(i => i.site).length;
    console.log(`   ${c}: ${items.length} 条 | 有网站 ${withSite} | 有邮箱 ${withEmail}`);
  }

  console.log('\n✅ 爬取完成');
}

main().catch(err => {
  console.error('❌ 脚本异常:', err);
  process.exit(1);
});
