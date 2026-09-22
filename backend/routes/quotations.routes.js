const express = require('express');
const pool = require('../config/db');
const { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership } = require('../utils/helpers');
const { logOperation, ownerOf } = require('../utils/operation-log');

const router = express.Router();

// 订单明细字段（与 orders.routes.js 保持一致，用于转 PI 时写入 order_items）
const ORDER_ITEM_FIELDS = [
  'product_id', 'model', 'name_en', 'hs_code', 'unit',
  'img_url', 'spec',
  'pcs_per_ctn', 'ctns', 'qty',
  'price', 'subtotal_amount',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn'
];

const ALLOWED = [
  'quotation_number', 'quotation_date', 'valid_until', 'client_id', 'supplier_id',
  'currency', 'price_terms', 'lead_time', 'payment_terms',
  'loading_port', 'destination_port', 'remark', 'total_amount', 'status', 'rfq_id'
];
const REQUIRED = ['quotation_number', 'quotation_date', 'client_id'];
const ITEM_FIELDS = [
  'product_id', 'model', 'name_en', 'hs_code', 'unit',
  'img_url', 'spec', 'packing_desc',
  'pcs_per_ctn', 'ctn_length', 'ctn_width', 'ctn_height',
  'nw_per_ctn', 'gw_per_ctn', 'cbm_per_ctn',
  'price', 'moq',
  'est_qty_20gp', 'est_qty_40gp', 'est_qty_40hq',
  'load_quantity_desc'
];

// 明细行清洗：必须有型号与单价，其余字段做快照透传
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.model && it.price !== undefined && it.price !== '')
    .map((it) => ITEM_FIELDS.map((f) => (it[f] === undefined || it[f] === '' ? null : it[f])));
}

// 生成下一个报价单号（格式 QT-YYYYMMDD-NNN，同日内递增，跨日重置）
router.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = 'QT-' + today;
    const [[row]] = await pool.query(
      `SELECT quotation_number FROM quotations
       WHERE quotation_number LIKE ?
       ORDER BY quotation_number DESC LIMIT 1`,
      [prefix + '-%']
    );
    let seq = 1;
    if (row) {
      const m = row.quotation_number.match(/-(\d{3})$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    res.success(prefix + '-' + String(seq).padStart(3, '0'));
  })
);

// 列表：联查客户名，支持关键词 + 状态筛选
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req);
    const q = (req.query.q || '').trim();
    const status = (req.query.status || '').trim();
    const conditions = [];
    const params = [];
    if (q) {
      conditions.push('(qt.quotation_number LIKE ? OR c.name_en LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) {
      conditions.push('qt.status = ?');
      params.push(status);
    }
    // 业务员只能看到自己创建的报价单
    if (isScopedOperator(req)) {
      conditions.push('qt.owner_id = ?');
      params.push(req.operator.id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM quotations qt LEFT JOIN clients c ON qt.client_id = c.id ${where}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT qt.*, c.name_en AS client_name,
              (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = qt.id) AS item_count
       FROM quotations qt
       LEFT JOIN clients c ON qt.client_id = c.id
       ${where} ORDER BY qt.id DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.success({ list: rows, total, page, pageSize });
  })
);

// 详情：主表 + 明细行
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [[quotation]] = await pool.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    if (!quotation) return res.fail('报价单不存在', 404);
    const denied = checkOwnership(quotation, req, '报价单');
    if (denied) return res.fail(denied, 404);
    const [items] = await pool.query(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
      [quotation.id]
    );
    res.success({ ...quotation, items });
  })
);

// 转 PI：在事务内读取报价单 + 明细，映射为订单 + 订单明细，并标记报价单为「已转PI」
router.post(
  '/:id/convert-to-order',
  asyncHandler(async (req, res) => {
    const quoteId = Number(req.params.id);

    // 1. 读取报价单主表（行锁 SELECT ... FOR UPDATE）
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[quote]] = await conn.query(
        'SELECT * FROM quotations WHERE id = ? FOR UPDATE',
        [quoteId]
      );
      if (!quote) { await conn.rollback(); return res.fail('报价单不存在', 404); }
      const denied = checkOwnership(quote, req, '报价单');
      if (denied) { await conn.rollback(); return res.fail(denied, 404); }

      // 防重复转 PI
      if (quote.status === '已转PI') {
        await conn.rollback();
        return res.fail('该报价单已转为 PI，不能重复转化', 400);
      }

      const [items] = await conn.query(
        'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC',
        [quoteId]
      );
      if (items.length === 0) {
        await conn.rollback();
        return res.fail('报价单无产品明细，无法转为 PI', 400);
      }

      // 2. 生成新的 PI 号 BP-YYYY-NNN（同 orders.routes.js 逻辑）
      const year = new Date().getFullYear();
      const prefix = 'BP-' + year;
      const [[lastPi]] = await conn.query(
        `SELECT pi_number FROM orders WHERE pi_number LIKE ? ORDER BY pi_number DESC LIMIT 1`,
        [prefix + '-%']
      );
      let seq = 1;
      if (lastPi) {
        const m = lastPi.pi_number.match(/-(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      const piNumber = prefix + '-' + String(seq).padStart(3, '0');

      // 3. 取默认银行账户（取第一条作为兜底）
      const [[defaultBank]] = await conn.query(
        'SELECT id FROM bank_accounts ORDER BY id ASC LIMIT 1'
      );
      const bankAccountId = defaultBank ? defaultBank.id : null;

      // 4. 供应商优先取报价单上的 supplier_id，无则兜底取第一条
      let supplierId = quote.supplier_id || null;
      if (!supplierId) {
        const [[defaultSupplier]] = await conn.query(
          'SELECT id FROM suppliers ORDER BY id ASC LIMIT 1'
        );
        supplierId = defaultSupplier ? defaultSupplier.id : null;
      }

      // 5. 交货日期默认 30 天后
      const deliveryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10);

      // 6. 字段映射构造订单主表
      const orderData = {
        pi_number: piNumber,
        signing_date: quote.quotation_date,
        client_id: quote.client_id,
        supplier_id: supplierId,
        currency: quote.currency || 'USD',
        trade_terms: quote.price_terms || 'FOB',
        customs_responsibility: '请选择',
        bank_account_id: bankAccountId,
        payment_terms: quote.payment_terms || null,
        delivery_date: deliveryDate,
        loading_port: quote.loading_port || null,
        destination_port: quote.destination_port || null,
        packing_desc: 'Standard Neutral Export Cartons',
        special_req: 'Standard requirements.',
        show_special_req: 1,
        show_stamp: 1,
        current_node: 'PI确认',
        progress_percent: 0,
        quotation_id: quoteId
      };

      // 7. 明细映射：moq(箱数) → ctns，qty = ctns × pcs_per_ctn
      let totalAmount = 0;
      const orderItems = items.map((it) => {
        const pcs = Number(it.pcs_per_ctn) || 1;
        const ctns = Number(it.moq) || 0; // 报价单"数量(箱)"直接作为订单箱数
        const qty = ctns * pcs;           // 总数量 = 箱数 × 件/箱
        const price = Number(it.price) || 0;
        const subtotal = Number((qty * price).toFixed(2));
        totalAmount += subtotal;

        const row = {
          product_id: it.product_id,
          model: it.model,
          name_en: it.name_en,
          hs_code: it.hs_code,
          unit: it.unit || '台',
          img_url: it.img_url,
          spec: it.spec,
          pcs_per_ctn: pcs,
          ctns: ctns,
          qty: qty,
          price: price,
          subtotal_amount: subtotal,
          nw_per_ctn: it.nw_per_ctn,
          gw_per_ctn: it.gw_per_ctn,
          cbm_per_ctn: it.cbm_per_ctn
        };
        // 按 ORDER_ITEM_FIELDS 顺序输出数组
        return ORDER_ITEM_FIELDS.map((f) =>
          row[f] === undefined || row[f] === '' ? null : row[f]
        );
      });
      orderData.total_amount = Number(totalAmount.toFixed(2));
      // 负责人：转 PI 的操作人
      orderData.owner_name = ownerOf(req.operator);
      orderData.owner_id = req.operator.id;

      // 报关责任为「请选择」：此处不再预生成单据（购销合同/生产任务单/订舱委托书/报关要素/清关资料），
      // 由用户在外销订单编辑时选择报关责任后，orders.routes.js PUT 检测到「请选择 → 正式值」再自动生成

      // 8. 写入订单主表 + 明细
      const [r] = await conn.query('INSERT INTO orders SET ?', orderData);
      const orderId = r.insertId;
      await conn.query(
        `INSERT INTO order_items (order_id, ${ORDER_ITEM_FIELDS.join(', ')}) VALUES ?`,
        [orderItems.map((row) => [orderId, ...row])]
      );

      // 9. 更新报价单状态为「已转PI」
      await conn.query(
        'UPDATE quotations SET status = ? WHERE id = ?',
        ['已转PI', quoteId]
      );

      // 记录操作日志：转 PI 生成了新订单
      await logOperation(conn, {
        module: 'order', action: '新增',
        targetId: orderId, targetNo: piNumber, operator: req.operator
      });

      await conn.commit();
      res.success(
        { id: orderId, pi_number: piNumber, quotation_id: quoteId, total_amount: orderData.total_amount },
        '报价单已转为正式 PI，报关责任请选择，请在外销订单中编辑确认'
      );
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 创建：主表 + 明细整体在事务内写入
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);

    // 报价单号自动生成 + 唯一性校验
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = 'QT-' + today;
    if (!data.quotation_number) {
      // 未传 → 自动生成（同日期最大编号 + 1）
      const [[row]] = await pool.query(
        `SELECT quotation_number FROM quotations
         WHERE quotation_number LIKE ? ORDER BY quotation_number DESC LIMIT 1`,
        [prefix + '-%']
      );
      let seq = 1;
      if (row) {
        const m = row.quotation_number.match(/-(\d{3})$/);
        if (m) seq = parseInt(m[1], 10) + 1;
      }
      data.quotation_number = prefix + '-' + String(seq).padStart(3, '0');
    } else {
      // 已传 → 检查是否重复
      const [[dup]] = await pool.query(
        'SELECT id FROM quotations WHERE quotation_number = ?',
        [data.quotation_number]
      );
      if (dup) {
        // 重复 → 自动递增编号直到唯一
        const [[row]] = await pool.query(
          `SELECT quotation_number FROM quotations
           WHERE quotation_number LIKE ? ORDER BY quotation_number DESC LIMIT 1`,
          [prefix + '-%']
        );
        let seq = 1;
        if (row) {
          const m = row.quotation_number.match(/-(\d{3})$/);
          if (m) seq = parseInt(m[1], 10) + 1;
        }
        data.quotation_number = prefix + '-' + String(seq).padStart(3, '0');
      }
    }

    const missing = REQUIRED.filter((k) => !data[k]);
    if (missing.length) return res.fail(`缺少必填字段: ${missing.join(', ')}`, 400);
    // 负责人自动写入当前登录人
    data.owner_name = ownerOf(req.operator);
    data.owner_id = req.operator.id;
    const items = normalizeItems(req.body.items);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [r] = await conn.query('INSERT INTO quotations SET ?', data);
      if (items.length) {
        await conn.query(
          `INSERT INTO quotation_items (quotation_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
          [items.map((row) => [r.insertId, ...row])]
        );
      }
      await logOperation(conn, {
        module: 'quotation', action: '新增',
        targetId: r.insertId, targetNo: data.quotation_number, operator: req.operator
      });
      await conn.commit();
      res.success({ id: r.insertId, item_count: items.length }, '创建成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 更新：主表更新，items 若传入则整体替换
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = pickFields(req.body, ALLOWED);
    const hasItems = Array.isArray(req.body.items);
    if (Object.keys(data).length === 0 && !hasItems) return res.fail('无可更新字段', 400);

    // 归属校验：业务员只能修改自己的报价单
    const [[before]] = await pool.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('报价单不存在', 404);
    const denied = checkOwnership(before, req, '报价单');
    if (denied) return res.fail(denied, 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (Object.keys(data).length > 0) {
        const [r] = await conn.query('UPDATE quotations SET ? WHERE id = ?', [data, req.params.id]);
        if (r.affectedRows === 0) {
          await conn.rollback();
          return res.fail('报价单不存在', 404);
        }
      }
      if (hasItems) {
        await conn.query('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
        const items = normalizeItems(req.body.items);
        if (items.length) {
          await conn.query(
            `INSERT INTO quotation_items (quotation_id, ${ITEM_FIELDS.join(', ')}) VALUES ?`,
            [items.map((row) => [Number(req.params.id), ...row])]
          );
        }
      }
      // 取业务编号记录操作日志
      const [[qRow]] = await conn.query('SELECT quotation_number FROM quotations WHERE id = ?', [req.params.id]);
      await logOperation(conn, {
        module: 'quotation', action: '修改',
        targetId: Number(req.params.id), targetNo: qRow?.quotation_number, operator: req.operator
      });
      await conn.commit();
      res.success({ id: Number(req.params.id) }, '更新成功');
    } catch (e) {
      console.error('[quotations PUT error]', e);
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// 删除：明细无外键约束，事务内先删明细
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // 归属校验：业务员只能删除自己的报价单
    const [[before]] = await pool.query('SELECT * FROM quotations WHERE id = ?', [req.params.id]);
    if (!before) return res.fail('报价单不存在', 404);
    const denied = checkOwnership(before, req, '报价单');
    if (denied) return res.fail(denied, 404);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
      const [r] = await conn.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) {
        await conn.rollback();
        return res.fail('报价单不存在', 404);
      }
      await conn.commit();
      res.success({ id: Number(req.params.id) }, '删除成功');
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
