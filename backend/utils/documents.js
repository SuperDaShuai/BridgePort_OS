// 单据默认数据生成工具
// 根据报关责任自动生成购销合同/生产任务单/订舱委托书/报关要素/清关资料
// 报关草单(decl_data) 与 清关三单(customs_data) 的商品行均按 HS 编码分组聚合

/* ================== HS 编码分组聚合 ==================
   同一 HS 编码下的多个明细行合并为一行：
   - 箱数 = Σ 各行的 ctns 字段（报价转PI时 moq=箱数，已计算好 ctns 传入）
   - 数量 = Σ 各行的 qty 字段（ctns × pcs_per_ctn）
   - 毛重 = Σ(箱数 × 单箱毛重)，净重 = Σ(箱数 × 单箱净重)
   - 体积 = Σ(箱数 × 单箱体积)，金额 = Σ(数量 × 单价)
   - 单价 = 金额 / 数量（加权平均）
   - 品名/型号/规格 去重拼接
   注意：rawItems 在转PI时已传入 qty(件数) 和 ctns(箱数)；
         订单场景下无 ctns 时回退为 qty / pcs_per_ctn 计算
*/
function groupItemsByHs(items) {
  const map = new Map();
  (items || []).forEach((it) => {
    const key = (String(it.hs_code || '').trim()) || 'N/A';
    const qty = Number(it.qty || 0);           // 总数量(件)
    const pcs = Number(it.pcs_per_ctn) || 1;   // 件/箱
    // 箱数：优先用传入的 ctns，否则从 qty / pcs 回退计算
    const ctns = it.ctns != null ? Number(it.ctns) || 0 : (pcs > 0 ? qty / pcs : 0);
    if (!map.has(key)) {
      map.set(key, {
        hs_code: key, models: [], names: [], specs: [], units: [],
        qty: 0, ctn: 0, nw: 0, gw: 0, cbm: 0, amount: 0
      });
    }
    const g = map.get(key);
    g.qty += qty;
    g.ctn += ctns;
    g.nw += ctns * Number(it.nw_per_ctn || 0);
    g.gw += ctns * Number(it.gw_per_ctn || 0);
    g.cbm += ctns * Number(it.cbm_per_ctn || 0);
    g.amount += qty * Number(it.price || 0);
    if (it.model) g.models.push(String(it.model));
    if (it.name_en) g.names.push(String(it.name_en));
    if (it.spec) g.specs.push(String(it.spec));
    if (it.unit) g.units.push(String(it.unit));
  });

  const uniq = (a) => [...new Set(a.filter((x) => x && String(x).trim()))];
  return [...map.values()].map((g) => {
    const models = uniq(g.models);
    const names = uniq(g.names);
    const specs = uniq(g.specs);
    const units = uniq(g.units);
    // 报关草单中文名：型号 + 规格/品名，避免空 models 时产生前导 " / "
    const nameParts = [...models, ...specs];
    if (names.length) nameParts.push(...names);
    return {
      hs_code: g.hs_code === 'N/A' ? '' : g.hs_code,
      // 清关三单用英文品名（Description of goods）
      product: names.join(' / ') + (models.length ? ' (' + models.join('/') + ')' : ''),
      // 报关草单用中文申报要素（型号 + 规格/品名）
      name: nameParts.join(' / '),
      qty: Number(g.qty.toFixed(0)),
      ctn: Number(g.ctn.toFixed(2)),
      nw: Number(g.nw.toFixed(2)),
      gw: Number(g.gw.toFixed(2)),
      cbm: Number(g.cbm.toFixed(3)),
      shipping_mark: 'N/M',
      unit: units[0] || '台',
      price: g.qty ? Number((g.amount / g.qty).toFixed(2)) : 0,
      total: Number(g.amount.toFixed(2))
    };
  });
}

// 根据起运港推断出境关别
function deriveExitCustoms(loadingPort) {
  const p = String(loadingPort || '').toUpperCase();
  if (p.includes('NINGBO') || p.includes('宁波')) return '宁波海关';
  if (p.includes('SHANGHAI') || p.includes('上海')) return '上海海关';
  if (p.includes('SHENZHEN') || p.includes('深圳')) return '深圳海关';
  if (p.includes('GUANGZHOU') || p.includes('广州')) return '广州海关';
  if (p.includes('XIAMEN') || p.includes('厦门')) return '厦门海关';
  return '';
}

function generateDefaultDocuments(piNumber, signingDate, customsResp, items, ctx = {}) {
  const isCompany = customsResp !== '客户自行报关';

  const purchaseContract = {
    contract_no: piNumber + '-CG',
    sign_date: signingDate,
    delivery_deadline: '合同签订后30天内完成生产交货',
    delivery_location: '送至买方指定出口监管仓库',
    payment_terms: '预付定金30%，出货前买方QC验货合格，供方开具13%增值税专用发票后结清70%余款。',
    quality_req: '外销全检出厂标准',
    packing_req: '海运中性纸箱',
    penalty_req: '日万分之五违约金+质量全赔',
    dispute_req: '需方所在地法院起诉'
  };

  const productionOrder = {
    po_no: piNumber + '-PO',
    tech_req: '严格按照外销技术要求生产',
    mark_req: '包装双坑中性外箱'
  };

  const bookingData = {};

  const docs = {
    purchase_contract: purchaseContract,
    production_order: productionOrder,
    booking_data: bookingData
  };

  if (isCompany) {
    const grouped = groupItemsByHs(items);

    // ===== 清关外销三单共享数据（Commercial Invoice / Sales Contract / Packing List）=====
    docs.customs_data = {
      client_id: ctx.client_id || null,
      sc_no: piNumber + '-SC',
      inv_no: piNumber + '-INV',
      date: signingDate || '',
      payment_terms: ctx.payment_terms || '',
      price_terms: ctx.trade_terms || 'FOB',
      loading_time: ctx.delivery_date || '',
      loading_port: ctx.loading_port || '',
      dest_port: ctx.destination_port || '',
      shipping_method: 'By sea',
      shipping_mark: 'N/M',
      total_amount_en: '', // 前端预览/编辑时按金额自动补全
      items: grouped.map((g) => ({
        product: g.product,
        qty: g.qty,
        ctn: g.ctn,
        nw: g.nw,
        gw: g.gw,
        cbm: g.cbm,
        shipping_mark: g.shipping_mark,
        price: g.price,
        total: g.total
      }))
    };

    // ===== 出口报关草单（Declaration Draft，中华人民共和国海关出口货物报关单）=====
    const totalCtns = grouped.reduce((s, g) => s + (Number(g.ctn) || 0), 0);
    const totalNw = grouped.reduce((s, g) => s + (Number(g.nw) || 0), 0);
    const totalGw = grouped.reduce((s, g) => s + (Number(g.gw) || 0), 0);
    docs.decl_data = {
      broker: '',                          // 报关行
      pre_entry_no: '',                    // 预录入编号
      customs_no: '',                      // 海关编号
      shipper: ctx.company_name_cn || '',  // 境内发货人
      exit_customs: deriveExitCustoms(ctx.loading_port), // 出境关别
      export_date: '',                     // 出口日期
      declare_date: signingDate || '',     // 申报日期
      record_no: '',                       // 备案号
      consignee: ctx.client_name_en || ctx.client_name || '', // 境外收货人
      transport_mode: '海运',              // 运输方式
      vessel_voyage: '',                   // 运输工具名称及航次号
      bill_no: '',                         // 提运单号
      manufacturer: ctx.supplier_name || '', // 生产销售单位
      supervision_mode: '一般贸易',         // 监管方式
      levy_nature: '一般征税',              // 征免性质
      license_no: '',                      // 许可证号
      // —— 合同协议号行（PDF 版式独立行）——
      contract_no: piNumber,               // 合同协议号 = PI 号
      trade_country: '',                   // 贸易国（地区）
      dest_country: '',                    // 运抵国（地区）
      dest_port: ctx.destination_port || '', // 指运港
      exit_port: ctx.loading_port || '',   // 离境口岸
      // —— 包装种类行（PDF 版式独立行）——
      pack_type: '纸箱',                   // 包装种类
      total_packages: Number(totalCtns.toFixed(2)), // 件数（总箱数 = Σ MOQ ÷ 件/箱）
      gross_weight: Number(totalGw.toFixed(2)), // 毛重（千克）
      net_weight: Number(totalNw.toFixed(2)),   // 净重（千克）
      trade_mode: ctx.trade_terms || 'FOB',  // 成交方式
      freight: '',                          // 运费
      insurance: '',                        // 保费
      misc_fees: '',                        // 杂费
      // —— 随附单证 ——
      attached_docs_1: '',                  // 随附单证 1
      attached_docs_2: '',                  // 随附单证 2
      // —— 标记唛码及备注 ——
      shipping_marks_notes: 'N/M',          // 标记唛码及备注（支持多行）
      // —— 商品表扩展字段 ——
      special_relation: '否',              // 特殊关系确认
      price_affect: '否',                  // 价格影响确认
      royalty: '否',                       // 支付特许权使用费确认
      self_declare: '是',                  // 自报自缴
      declarer: '',                        // 申报人员
      declarer_no: '',                     // 申报人员证号
      declarer_tel: ctx.company_tel || '', // 电话
      declare_unit: ctx.company_name_cn || '', // 申报单位
      currency: ctx.currency || 'USD',     // 币制
      origin_country: '中国',              // 原产国
      dest_country_name: '',                // 最终目的国（地区）= PDF 中"最终目的国"列
      origin_source: '',                   // 境内货源地（如：金华、浙江）
      levy: '征税',                        // 征免
      items: grouped.map((g) => ({
        hs_code: g.hs_code,
        name: g.name,
        qty: g.qty,
        unit: g.unit,
        price: g.price,
        total: g.total,
        // 商品表附加字段
        currency: ctx.currency || 'USD',
        origin_country: '中国',
        dest_country: '',
        origin_source: '',
        levy: '征税',
        // 申报要素（每个商品独立一行，展示在商品表下方）
        elements: ''
      }))
    };
  }

  return docs;
}

module.exports = { generateDefaultDocuments, groupItemsByHs, deriveExitCustoms };
