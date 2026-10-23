// 公共助手：异步包装 / 分页解析 / 字段白名单过滤
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ===== Excel 边框常量 =====
const BORDER_STYLE = 'medium';  // 中等粗细，打印清晰可见
const BORDER_COLOR = { argb: 'FF000000' };
const BORDER_MED = { style: BORDER_STYLE, color: BORDER_COLOR };
// 给一个单元格画四边边框
function drawCellBorder(cell) {
  cell.border = {
    top: BORDER_MED,
    left: BORDER_MED,
    bottom: BORDER_MED,
    right: BORDER_MED
  };
}
// 给一个合并区域 (topRow, leftCol, bottomRow, rightCol) 画完整网格边框
// 矩形内每个 cell 的四边都画 BORDER_MED —— 和明细行的每行画完整边框保持视觉一致
function drawRangeBorder(ws, topRow, leftCol, bottomRow, rightCol) {
  for (let r = topRow; r <= bottomRow; r++) {
    for (let c = leftCol; c <= rightCol; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = {
        top: BORDER_MED,
        left: BORDER_MED,
        bottom: BORDER_MED,
        right: BORDER_MED
      };
    }
  }
}

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
function isScopedOperator(req) {
  return Number(req.operator?.permission_level) === 3;
}

// 归属校验：业务员操作非本人记录时返回 404
function checkOwnership(row, req, label) {
  if (isScopedOperator(req) && row?.owner_id !== req.operator.id) {
    return `${label || '记录'}不存在或无权操作`;
  }
  return null;
}

/* ================== 采购订货单 Excel：明细行产品缩略图 ==================
   新模板 8 列结构（A-H），C 列为「图片」列，每行产品图片放大居中嵌入。
   配套要求：明细行行高需设为 85pt，图片 80x80 在 C 列水平垂直居中。 */
function addDetailThumbToWorksheet(ws, rowNo, dataUrl) {
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g);base64,/.test(dataUrl)) return;
  try {
    // 清除模板残留的占位文字
    ws.getCell(`C${rowNo}`).value = null;
    const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpeg';
    const base64 = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const imgId = ws.workbook.addImage({ base64, extension: ext });
    // C 列宽约 10 字符（约 75px），行高 85pt（约 113px），图片 80x80 居中
    const colWidth = 75;  // C 列像素宽
    const rowHeight = 113; // 85pt ≈ 113px
    const imgSize = 80;
    const offsetX = Math.max(0, (colWidth - imgSize) / 2) / 75; // 比例偏移
    const offsetY = Math.max(0, (rowHeight - imgSize) / 2) / rowHeight;
    ws.addImage(imgId, {
      tl: { col: 2 + offsetX, row: (rowNo - 1) + offsetY },
      ext: { width: imgSize, height: imgSize },
      editAs: 'oneCell'
    });
  } catch { /* 图片嵌入失败不阻断 Excel 生成 */ }
}

/* ================== 采购订货单 Excel：清空明细区未使用行 ==================
   新模板明细区预留 3 行（7-9），实际明细不足时必须清空，避免样例残留。
   8 列结构：A-H，其中 F:G 在明细行中是合并单元格。 */
function clearUnusedDetailRows(ws, detailStart, usedRows, totalRows) {
  for (let i = usedRows; i < totalRows; i++) {
    const row = ws.getRow(detailStart + i);
    for (let c = 1; c <= 8; c++) row.getCell(c).value = null;
  }
}

/* ================== 采购订货单 Excel：重建固定区合并单元格 ==================
   新模板固定区合并（行号在插行后整体下移 extra 行）：
   - 统一采购备注标题: A11:H11 → A(11+ext):H(11+ext)
   - 统一采购备注内容: A12:H12 → A(12+ext):H(12+ext)
   - 客户需求与其他备注标题: A14:H14 → A(14+ext):H(14+ext)
   - 实物图片区: A15:H15 → A(15+ext):H(15+ext)
   - 备注内容: A16:H16 → A(16+ext):H(16+ext)
   insertRow 只下移单元格值不移动 _merges，必须先删陈旧合并再重建。
   无论 extra 是否为 0，重建后都重新画边框（模板可能本身没画边框）。 */
function rebuildPoMerges(ws, extra) {
  // 原始合并行号
  const origRows = [11, 12, 14, 15, 16];

  // 清除原始位置的陈旧合并（extra>0 时才需要，extra=0 时直接清新位置）
  const rowsToClear = extra > 0 ? origRows.map(r => r + extra).concat(origRows) : origRows;
  for (const r of rowsToClear) {
    const stale = [];
    for (const [master, m] of Object.entries(ws._merges || {})) {
      const top = m && m.top !== undefined ? m.top : parseInt(String(master).replace(/\D/g, ''), 10);
      if (top === r) stale.push(master);
    }
    for (const master of stale) delete ws._merges[master];
    for (let c = 1; c <= 8; c++) {
      try { ws.getRow(r).getCell(c).unmerge(); } catch { /* 忽略 */ }
    }
  }

  // 重建合并 + 画边框（无论 extra 是否为 0，都重建并画边框）
  const e = extra;
  const ranges = [
    [11 + e, 11 + e],   // 模块二标题
    [12 + e, 12 + e],   // 模块二内容
    [14 + e, 14 + e],   // 模块三标题
    [15 + e, 15 + e],   // 实物图片区
    [16 + e, 16 + e],   // 备注内容
  ];
  for (const [top, bottom] of ranges) {
    ws.mergeCells(`A${top}:H${bottom}`);
    drawRangeBorder(ws, top, 1, bottom, 8);
  }
}

/* ================== 采购订货单 Excel：重建明细行 F:G 合并 ==================
   新模板明细行 F:G 列合并为「详细规范」列。insertRow 插入的新行不继承合并，
   需要为每个明细行重建 F:G 合并，合并后重新画边框（mergeCells 会丢样式）。 */
function rebuildDetailMerges(ws, detailStart, count) {
  const detailEnd = detailStart + count - 1;
  for (let i = 0; i < count; i++) {
    const row = detailStart + i;
    // 清除可能残留的合并
    const stale = [];
    for (const [master, m] of Object.entries(ws._merges || {})) {
      const top = m && m.top !== undefined ? m.top : parseInt(String(master).replace(/\D/g, ''), 10);
      if (top === row) stale.push(master);
    }
    for (const master of stale) delete ws._merges[master];
    try { ws.getRow(row).getCell(6).unmerge(); } catch { /* 忽略 */ }
    try { ws.getRow(row).getCell(7).unmerge(); } catch { /* 忽略 */ }
    // 重建 F:G 合并
    ws.mergeCells(`F${row}:G${row}`);
  }
  // 明细区域统一画一次完整网格（避免每行单独画导致相邻行双线重叠）
  if (detailEnd >= detailStart) {
    drawRangeBorder(ws, detailStart, 1, detailEnd, 8);
  }
}

module.exports = {
  asyncHandler,
  parsePagination,
  pickFields,
  isScopedOperator,
  checkOwnership,
  addDetailThumbToWorksheet,
  clearUnusedDetailRows,
  rebuildPoMerges,
  rebuildDetailMerges
};
