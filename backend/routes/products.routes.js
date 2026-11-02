const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields } = require('../utils/helpers');
const ExcelJS = require('exceljs');

const router = express.Router();

const ALLOWED = [
  'model', 'our_model', 'product_type', 'hs_code', 'hs_code_id', 'supplier_id', 'name_cn', 'name_en', 'spec', 'spec_cn', 'remark',
  'prod_length', 'prod_width', 'prod_height',
  'box_length', 'box_width', 'box_height',
  'ctn_length', 'ctn_width', 'ctn_height',
  'pcs_per_ctn', 'ctn_cbm', 'est_qty_20gp', 'est_qty_40gp', 'est_qty_40hq',
  'net_weight_kg', 'gross_weight_kg', 'unit_weight_kg', 'purchase_cost_rmb', 'export_price_usd', 'delivery_period', 'img_url'
];
const REQUIRED = ['model', 'hs_code', 'name_en'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const supplierId = parseInt(req.query.supplierId) || null;
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(p.model LIKE ? OR p.our_model LIKE ? OR p.name_cn LIKE ? OR p.name_en LIKE ? OR p.hs_code LIKE ? OR p.spec_cn LIKE ? OR p.remark LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (supplierId) {
      conditions.push('p.supplier_id = ?');
      params.push(supplierId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
    const [rows] = await pool.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[product]] = await pool.query(
      'SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = ?',
      [req.params.id]
    );
    if (!product) return res.fail('产品不存在', 404);
    res.success(product);
  })
);

// ===== 参数列表导出：选中产品 + 数量 → 关联计算箱数/总净重/总毛重/总体积 → xlsx =====
router.post(
  '/export-params',
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body.items)
      ? req.body.items.filter(it => it && Number(it.id) > 0).map(it => ({ id: Number(it.id), qty: Number(it.qty) || 0 }))
      : [];
    if (!items.length) return res.fail('请先选择产品');

    const ids = items.map(it => it.id);
    const qtyById = new Map(items.map(it => [it.id, it.qty]));
    const [rows] = await pool.query('SELECT * FROM products WHERE id IN (?)', [ids]);
    // 按前端选择顺序排列
    const idOrder = new Map(ids.map((id, i) => [id, i]));
    const products = rows.sort((a, b) => idOrder.get(a.id) - idOrder.get(b.id));

    // 关联计算：数量(件) → 箱数 = ceil(qty/pcs_per_ctn) → 总重 = 箱数 × 单箱重量
    const calcRow = (p) => {
      const qty = qtyById.get(p.id) || 0;
      const pcs = Number(p.pcs_per_ctn) || 0;
      const ctn = pcs > 0 && qty > 0 ? Math.ceil(qty / pcs) : 0;
      return {
        qty,
        ctn,
        nw: Math.round(ctn * (Number(p.net_weight_kg) || 0) * 1000) / 1000,
        gw: Math.round(ctn * (Number(p.gross_weight_kg) || 0) * 1000) / 1000,
        cbm: Math.round(ctn * (Number(p.ctn_cbm) || 0) * 1000) / 1000
      };
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('参数列表');
    const THIN = { style: 'thin', color: { argb: 'FF1F4E78' } };
    const border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
    const round = (v, n = 3) => Math.round((Number(v) || 0) * 10 ** n) / 10 ** n;

    // 列宽
    [6, 11, 14, 16, 26, 12, 10, 10, 8, 16, 12, 12, 11, 12, 12, 11].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });

    // 标题
    ws.mergeCells('A1:P1');
    const titleCell = ws.getCell('A1');
    titleCell.value = '产品参数列表';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // 表头（Row2）
    const headers = ['序号', '图片', '型号', '中文品名', '英文品名/规格', 'HS编码', '数量(件)', '装箱量', '箱数', '箱尺寸(cm)', '单箱净重(kg)', '单箱毛重(kg)', '箱体积(cbm)', '总净重(kg)', '总毛重(kg)', '总体积(cbm)'];
    headers.forEach((h, i) => {
      const c = ws.getCell(2, i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = border;
    });
    ws.getRow(2).height = 24;

    // 数据行
    let startRow = 3;
    products.forEach((p, idx) => {
      const r = calcRow(p);
      const row = ws.getRow(startRow + idx);
      row.height = 66; // 图片行高
      const ctnSize = [p.ctn_length, p.ctn_width, p.ctn_height].filter(v => v != null && v !== '').length === 3
        ? `${p.ctn_length}×${p.ctn_width}×${p.ctn_height}`
        : '';
      const values = [
        idx + 1, '', p.model || '', p.name_cn || '',
        `${p.name_en || ''}${p.spec ? '\n' + p.spec : ''}`,
        p.hs_code || '', r.qty, p.pcs_per_ctn ? `${p.pcs_per_ctn}件/箱` : '', r.ctn, ctnSize,
        p.net_weight_kg, p.gross_weight_kg, p.ctn_cbm, r.nw, r.gw, r.cbm
      ];
      values.forEach((v, ci) => {
        const c = row.getCell(ci + 1);
        c.value = v === '' ? null : v;
        c.border = border;
        c.alignment = { vertical: 'middle', horizontal: ci >= 6 && ci <= 8 ? 'right' : (ci === 0 || ci === 1 ? 'center' : 'left'), wrapText: true };
      });
      // B 列嵌入产品缩略图
      if (p.img_url && typeof p.img_url === 'string' && /^data:image\/(png|jpe?g);base64,/.test(p.img_url)) {
        try {
          const ext = p.img_url.startsWith('data:image/png') ? 'png' : 'jpeg';
          const base64 = p.img_url.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
          const imgId = wb.addImage({ base64, extension: ext });
          ws.addImage(imgId, { tl: { col: 1.15, row: startRow + idx - 1 + 0.08 }, ext: { width: 58, height: 58 }, editAs: 'oneCell' });
        } catch { /* 图片失败不阻断 */ }
      }
    });

    // 合计行
    const totalRow = startRow + products.length;
    const totals = { qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0 };
    products.forEach(p => {
      const r = calcRow(p);
      totals.qty += r.qty; totals.ctn += r.ctn; totals.nw += r.nw; totals.gw += r.gw; totals.cbm += r.cbm;
    });
    const tRow = ws.getRow(totalRow);
    tRow.height = 22;
    for (let c = 1; c <= 16; c++) {
      const cell = tRow.getCell(c);
      cell.border = border;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    tRow.getCell(1).value = '合计';
    tRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    tRow.getCell(7).value = totals.qty;
    tRow.getCell(9).value = totals.ctn;
    tRow.getCell(14).value = round(totals.nw);
    tRow.getCell(15).value = round(totals.gw);
    tRow.getCell(16).value = round(totals.cbm);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('产品参数列表.xlsx')}`);
    await wb.xlsx.write(res);
    res.end();
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const missing = REQUIRED.filter((k) => data[k] === undefined || data[k] === '');
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);

    const [r] = await pool.query('INSERT INTO products SET ?', data);
    res.success({ id: r.insertId }, '创建成功');
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    if (Object.keys(data).length === 0) return res.fail('无可更新字段', 400);

    const [r] = await pool.query('UPDATE products SET ? WHERE id = ?', [data, req.params.id]);
    if (r.affectedRows === 0) return res.fail('产品不存在', 404);
    res.success({ id: Number(req.params.id) }, '更新成功');
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const [r] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.fail('产品不存在', 404);
    res.success({ id: Number(req.params.id) }, '删除成功');
  })
);

module.exports = router;
