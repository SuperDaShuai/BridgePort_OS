// 公共助手：异步包装 / 分页解析 / 字段白名单过滤
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

// 只保留允许写入的列，防止越权字段注入（如 id/created_at）
function pickFields(body, allowed) {
  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

// 数据归属过滤：权限等级 3（业务员）只能看到/操作自己创建的记录
// 等级 1(超级管理员)/2(业务主管)/4(财务)/5(跟单) 不做隔离
function isScopedOperator(req) {
  return Number(req.operator?.permission_level) === 3;
}

// 归属校验：业务员操作非本人记录时返回 404（不暴露记录存在性）
function checkOwnership(row, req, label) {
  if (isScopedOperator(req) && row?.owner_id !== req.operator.id) {
    return `${label || '记录'}不存在或无权操作`;
  }
  return null;
}

/* ================== 采购订货单 Excel：电源线/插头实物照片插入 ==================
   模板照片区为 A25:C29 + E25:J29 两个合并块（占位文字在 A25）。
   本函数把两块合并为 A{ph}:J{ph+4} 整块，并把 base64 实物照片按原始比例插入该区域。
   注意：ExcelJS insertRow 不会移动合并单元格，因此照片区必须按占位文字动态定位，
   并同时清理「目标范围」与「模板原范围」内残留的旧合并定义。 */
const PO_PHOTO_AREA_ROWS = 5;  // 照片区占 5 行
const PO_PHOTO_BASE_ROW = 25;  // 模板照片区起始行（未插行时）
const PO_PHOTO_COL_PX = [36.5, 90.75, 93.38, 93.38, 82.88, 92.5, 78.5, 60.13, 130.13, 130.13]; // A-J 列像素宽
const PHOTO_SLOT_W = 165;      // 单个横向槽位宽（含间距）
const PHOTO_BOX_W = 150;       // 单张图最大宽
const PHOTO_BOX_H = 115;       // 单张图最大高
const PHOTO_GAP_Y = 12;
const PHOTO_PAD_X = 10;
const PHOTO_PAD_Y = 8;

// 从 PNG/JPEG 二进制头解析图片原始尺寸（用于保持宽高比缩放）
function _imagePixelSize(buf) {
  try {
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) { // JPEG：扫描 SOF0~SOF15 段
      let off = 2;
      while (off < buf.length - 9) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
  } catch { /* 忽略解析失败 */ }
  return null;
}

// 定位照片区：按占位文字「请在此处粘贴」搜索 A 列（插行后地址会下移）
function _findPlugPhotoRow(ws) {
  const maxRow = Math.min(ws.rowCount || 60, 60);
  for (let r = PO_PHOTO_BASE_ROW - 5; r <= maxRow; r++) {
    const v = ws.getRow(r).getCell(1).value;
    const s = typeof v === 'string' ? v : (v && v.richText ? v.richText.map((t) => t.text).join('') : '');
    if (s.includes('请在此处粘贴')) return r;
  }
  return 0;
}

function addPlugPhotosToWorksheet(ws, photos) {
  const phRow = _findPlugPhotoRow(ws);
  if (!phRow) return;
  const lastRow = phRow + PO_PHOTO_AREA_ROWS - 1;

  // 1) 处理照片区残留合并：ExcelJS insertRow 只下移单元格不移动 _merges 定义，
  //    因此需要 (a) 删除 _merges 中与照片区相交的陈旧条目 (b) 解除实际单元格的合并引用
  const staleMerges = [];
  for (const [master, m] of Object.entries(ws._merges || {})) {
    const top = m && m.top !== undefined ? m.top : parseInt(String(master).replace(/\D/g, ''), 10);
    const bottom = m && m.bottom !== undefined ? m.bottom : top;
    if (bottom >= phRow && top <= lastRow) staleMerges.push(master);
  }
  for (const master of staleMerges) delete ws._merges[master];
  for (let r = phRow; r <= lastRow; r++) {
    for (let c = 1; c <= 10; c++) {
      const cell = ws.getRow(r).getCell(c);
      try { cell.unmerge(); } catch { /* 未合并单元格忽略 */ }
    }
  }

  // 2) 合并为整块 A{ph}:J{last}
  ws.mergeCells(`A${phRow}:J${lastRow}`);

  const list = (photos || []).filter(
    (p) => typeof p === 'string' && /^data:image\/(png|jpe?g);base64,/.test(p)
  );
  if (!list.length) return; // 无图：保留占位文字原样

  // 3) 清除占位文字，按图片视觉行数等比放大 5 行行高
  ws.getCell(`A${phRow}`).value = '';
  const visualRows = Math.ceil(list.length / Math.floor((PO_PHOTO_COL_PX.reduce((a, b) => a + b, 0) - 20) / PHOTO_SLOT_W));
  const rowH = Math.max(22, Math.ceil((22 * PO_PHOTO_AREA_ROWS * visualRows + 20) / PO_PHOTO_AREA_ROWS));
  for (let r = phRow; r <= lastRow; r++) ws.getRow(r).height = rowH;
  const rowPx = (rowH * 4) / 3;
  const areaH = rowPx * PO_PHOTO_AREA_ROWS;
  const areaW = PO_PHOTO_COL_PX.reduce((a, b) => a + b, 0);
  const perRow = Math.max(1, Math.floor((areaW - 20) / PHOTO_SLOT_W));

  // 4) 逐张插入（保持宽高比，槽位内居中）
  for (let i = 0; i < list.length; i++) {
    const dataUrl = list[i];
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
    const raw = Buffer.from(dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, ''), 'base64');
    const imgId = ws.workbook.addImage({ base64: dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, ''), extension: ext });

    const dim = _imagePixelSize(raw) || { w: PHOTO_BOX_W, h: PHOTO_BOX_H };
    const scale = Math.min(PHOTO_BOX_W / dim.w, PHOTO_BOX_H / dim.h);
    const w = Math.max(30, Math.round(dim.w * scale));
    const h = Math.max(24, Math.round(dim.h * scale));

    const visR = Math.floor(i / perRow);
    const inRow = i % perRow;
    const slotX = PHOTO_PAD_X + inRow * PHOTO_SLOT_W;
    let x = slotX + Math.max(0, Math.floor((PHOTO_SLOT_W - PHOTO_GAP_Y - w) / 2));
    let y = PHOTO_PAD_Y + visR * (PHOTO_BOX_H + PHOTO_GAP_Y) + Math.max(0, Math.floor((PHOTO_BOX_H - h) / 2));
    if (x + w > areaW - 4) x = Math.max(4, areaW - 4 - w);
    if (y + h > areaH - 4) y = Math.max(4, areaH - 4 - h);

    // 像素坐标 → ExcelJS tl 锚点（列按 A-I 累计宽，行按等高行内比例）
    let acc = 0;
    let colTl = PO_PHOTO_COL_PX.length - 1;
    for (let c = 0; c < PO_PHOTO_COL_PX.length; c++) {
      if (x < acc + PO_PHOTO_COL_PX[c]) { colTl = c + (x - acc) / PO_PHOTO_COL_PX[c]; break; }
      acc += PO_PHOTO_COL_PX[c];
    }
    ws.addImage(imgId, {
      tl: { col: colTl, row: (phRow - 1) + y / rowPx },
      ext: { width: w, height: h },
      editAs: 'oneCell'
    });
  }
}

module.exports = { asyncHandler, parsePagination, pickFields, isScopedOperator, checkOwnership, addPlugPhotosToWorksheet, addDetailThumbToWorksheet, clearUnusedDetailRows };

/* ================== 采购订货单 Excel：明细行产品缩略图 ==================
   模板明细区 C 列为「图片」列，每行产品图片以 44x44 嵌入。
   配套要求：明细行行高需设为 36pt（约48px），图片在本行内垂直居中，多行不重叠。 */
function addDetailThumbToWorksheet(ws, rowNo, dataUrl) {
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g);base64,/.test(dataUrl)) return;
  try {
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
    const base64 = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const imgId = ws.workbook.addImage({ base64, extension: ext });
    ws.addImage(imgId, {
      // C 列（col index 2，宽约 93px）水平居中；行高 36pt≈48px，图片 44px 上下各留 2px
      tl: { col: 2 + 0.26, row: (rowNo - 1) + 0.04 },
      ext: { width: 44, height: 44 },
      editAs: 'oneCell'
    });
  } catch { /* 图片嵌入失败不阻断 Excel 生成 */ }
}

/* ================== 采购订货单 Excel：清空明细区未使用行 ==================
   模板明细区预留行带有样例数据，实际明细不足时必须清空，避免样例残留在成品中。 */
function clearUnusedDetailRows(ws, detailStart, usedRows, totalRows) {
  for (let i = usedRows; i < totalRows; i++) {
    const row = ws.getRow(detailStart + i);
    for (let c = 1; c <= 10; c++) row.getCell(c).value = null;
  }
}
