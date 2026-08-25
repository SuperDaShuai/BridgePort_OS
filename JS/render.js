/* =========================================
   BridgePort OS - 视图渲染层 (render.js)
   ========================================= */

// 全局渲染触发器
function renderAll() {
  renderDashboard();
  renderWorkbench();
  renderRfqs();
  renderQuotes();
  renderSamples();
  renderOrders();
  renderPurchasing();
  renderShipping();
  renderCustomsExport();
  renderCustomsImport();
  renderCustomsDecl();
  renderQcRecords();
  renderLoadMaster();
  renderFinance();
  renderAnalytics();
  renderProducts();
  renderClients();
  renderSuppliers();
  renderSettings();
}

// 1. 控制中心 Dashboard
function renderDashboard() {
  let sumUsd = 0, sumRecUsd = 0, sumRefund = 0, sumProfit = 0;
  db.orders.forEach(o => { 
    const t = getOrderTotals(o); 
    sumUsd += t.amount; 
    sumRecUsd += Number(o.receivedUsd || 0); 
    sumRefund += calcTaxRefund(o); 
    sumProfit += calcOrderProfit(o); 
  });
  
  document.getElementById('dash-total-usd').textContent = '$' + fmt(sumUsd); 
  document.getElementById('dash-received-usd').textContent = '$' + fmt(sumRecUsd); 
  document.getElementById('dash-tax-refund').textContent = '¥' + fmt(sumRefund); 
  document.getElementById('dash-gross-profit').textContent = '¥' + fmt(sumProfit);
  
  document.getElementById('dash-orders-tbody').innerHTML = db.orders.map(o => {
    const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定' };
    return `
      <tr>
        <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
        <td>${client.name}</td>
        <td style="font-weight:bold;color:var(--success);">${o.currency==='RMB'?'¥':'$'}${fmt(getOrderTotals(o).amount)}</td>
        <td>${o.deliveryDate || '尽快'}</td>
        <td><span class="badge badge-blue">正常推进</span></td>
        <td><span class="badge badge-green">${o.status}</span></td>
      </tr>
    `;
  }).join('');
}

// 2. 订单工作台 (履约进度)
function renderWorkbench() {
  document.getElementById('workbench-tbody').innerHTML = db.orders.map(o => {
    const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定' };
    const totals = getOrderTotals(o);
    
    const completedNodes = (o.nodes || []).filter(n => n.status === 'COMPLETED').length;
    const totalNodes = (o.nodes || []).length || 14;
    const progressPct = (completedNodes / totalNodes) * 100;

    return `
      <tr>
        <td>
          <strong class="clickable-link" style="color:var(--blue); cursor:pointer; text-decoration:underline;" onclick="openTrackingModal('${o.id}')">
            ${o.piNumber}
          </strong>
        </td>
        <td><strong>${client.name}</strong></td>
        <td>${o.items.length} 种品类 (共 ${totals.qty} PCS)</td>
        <td style="font-weight:bold;color:var(--success);">${o.currency==='RMB'?'¥':'$'}${fmt(totals.amount)}</td>
        <td><span class="badge badge-purple">${o.status || '生产中'}</span></td>
        <td>
          <div style="background:#e2e8f0; border-radius:999px; height:8px; width:120px; overflow:hidden;">
            <div style="background:var(--accent); width:${progressPct}%; height:100%; transition: width 0.3s;"></div>
          </div>
        </td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('pi', '${o.id}')">PI</button> 
          <button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('purchase_contract', '${o.id}')">购销合同</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. 商机管理 (RFQ)
function renderRfqs() {
  document.getElementById('rfq-table-body').innerHTML = db.rfqs.map(r => {
    const client = db.clients.find(c => c.id === r.clientId) || { name: '未指定' };
    const product = db.products.find(p => p.id === r.productId);
    const prodDisplay = product ? `<span class="badge badge-blue" style="margin-bottom:4px;">${product.model}</span><br>` : '';
    
    return `
      <tr>
        <td><strong style="color:#0f766e;">${r.rfqNo}</strong></td>
        <td><strong>${client.name}</strong></td>
        <td>${r.date}</td>
        <td>${prodDisplay}${r.desc || '-'}</td>
        <td>${r.targetQty} PCS / ${r.targetPrice ? '$'+r.targetPrice : '-'}</td>
        <td><span class="badge badge-amber">${r.status}</span></td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="openRfqModal('${r.id}')">编辑</button> 
          <button class="btn btn-primary btn-sm" onclick="convertRfqToQuote('${r.id}')">⚡ 转报价单</button> 
          <button class="btn btn-danger btn-sm" onclick="deleteRfq('${r.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 4. 报价单 (Quotation)
function renderQuotes() {
  document.getElementById('quotes-table-body').innerHTML = db.quotes.map(q => {
    const client = db.clients.find(c => c.id === q.clientId) || { name: '未指定' }; 
    const total = (q.items || []).reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
    return `
      <tr>
        <td><strong style="color:#0f766e;">${q.quoteNumber}</strong></td>
        <td><strong>${client.name}</strong></td>
        <td>${q.quoteDate} <br><small style="color:var(--text-muted);">有效至: ${q.validUntil || '-'}</small></td>
        <td><small>${q.leadTime || '25-30 days'}<br>${q.paymentTerms || '30% T/T'}</small></td>
        <td><span class="badge badge-amber">${q.currency || 'USD'}</span> ${q.tradeTerms}</td>
        <td class="text-right" style="color:var(--success);font-weight:700;">${q.currency==='RMB'?'¥':'$'}${fmt(total)}</td>
        <td class="text-center"><span class="badge badge-blue">${q.status || '已报价'}</span></td>
        <td class="text-center">
          <button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('quotation', '${q.id}')">📄 预览</button> 
          <button class="btn btn-outline btn-sm" onclick="openQuoteModal('${q.id}')">编辑</button> 
          <button class="btn btn-primary btn-sm" onclick="convertQuoteToOrder('${q.id}')">⚡ 转PI</button> 
          <button class="btn btn-danger btn-sm" onclick="deleteQuote('${q.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. 样品管理
function renderSamples() {
  document.getElementById('samples-table-body').innerHTML = db.samples.map(s => {
    const client = db.clients.find(c => c.id === s.clientId) || { name: '未指定' };
    return `
      <tr>
        <td><strong>${s.sampleNo}</strong></td>
        <td>${client.name}</td>
        <td>${s.model}</td>
        <td>${s.courier} - <span style="font-family:monospace;">${s.tracking}</span></td>
        <td>${s.date}</td>
        <td>$${s.fee}</td>
        <td><span class="badge badge-purple">${s.status}</span></td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="openSampleModal('${s.id}')">编辑</button> 
          <button class="btn btn-danger btn-sm" onclick="deleteSample('${s.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 6. 订单管理 (PI)
function renderOrders() {
  document.getElementById('orders-table-body').innerHTML = db.orders.map(o => {
    const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定' }; 
    const totals = getOrderTotals(o);
    return `
      <tr>
        <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
        <td><strong>${client.name}</strong></td>
        <td>${o.items.length} 种品类 (共 ${totals.qty} PCS)</td>
        <td class="text-right" style="color:var(--success);font-weight:700;">${o.currency==='RMB'?'¥':'$'}${fmt(totals.amount)}</td>
        <td>${o.tradeTerms} | ${o.deliveryDate || '尽快'}</td>
        <td class="text-center">
          <button class="btn btn-primary btn-sm" onclick="generateAndShowDoc('pi', '${o.id}')">📄 生成 PI</button>
        </td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="openOrderModal('${o.id}')">编辑</button> 
          <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}')">删除</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 7 & 8. 采购管理 (购销合同 & PO)
function renderPurchasing() {
  document.getElementById('purchasing-contract-tbody').innerHTML = db.orders.map(o => `
    <tr>
      <td><strong>${o.purchaseContract?.contractNo || (o.piNumber + '-CG')}</strong></td>
      <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
      <td><strong>${(db.suppliers.find(s=>s.id===o.supplierId)||{}).name||''}</strong></td>
      <td class="text-right" style="font-weight:700;color:#dc2626;">¥${fmt(o.cnyPurchaseCost)}</td>
      <td>${o.purchaseContract?.deliveryDeadline || '合同签订后30天内'}</td>
      <td class="text-center">
        <button class="btn btn-primary btn-sm" onclick="generateAndShowDoc('purchase_contract', '${o.id}')">📄 预览购销合同</button>
      </td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="openPurchaseEditModal('${o.id}')">编辑</button>
      </td>
    </tr>
  `).join('');
  
  document.getElementById('purchasing-po-tbody').innerHTML = db.orders.map(o => `
    <tr>
      <td><strong>${o.productionOrder?.poNo || (o.piNumber + '-PO')}</strong></td>
      <td><strong style="color:var(--blue);">${o.piNumber}-CG</strong></td>
      <td><strong>${(db.suppliers.find(s=>s.id===o.supplierId)||{}).name||''}</strong></td>
      <td><strong>${getOrderTotals(o).qty}</strong> PCS</td>
      <td>${o.deliveryDate || '尽快'}</td>
      <td class="text-center">
        <button class="btn btn-primary btn-sm" onclick="generateAndShowDoc('po', '${o.id}')">📋 预览生产任务单</button>
      </td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="openPoEditModal('${o.id}')">编辑</button>
      </td>
    </tr>
  `).join('');
}

// 9. 订舱管理 (Shipping Order)
function renderShipping() {
  document.getElementById('shipping-table-body').innerHTML = db.orders.map(o => { 
    const t = getOrderTotals(o); 
    const bk = o.bookingData || {}; // 获取订舱数据
    const fclInfo = bk.qty20 ? `20GPx${bk.qty20}` : (bk.qty40hq ? `40HQx${bk.qty40hq}` : (bk.isLcl ? 'LCL拼箱' : '未定柜型'));

    return `
      <tr>
        <td><strong style="color:var(--indigo);">${o.piNumber}-SHP</strong></td>
        <td><strong>${o.piNumber}</strong></td>
        <td>${o.loadingPort} ➔ <strong>${o.destinationPort}</strong></td>
        <td>
          ${t.ctns} 箱 | ${t.gw} KG | ${t.cbm} M³<br>
          <span class="badge badge-amber" style="font-size:9px; margin-top:4px;">${fclInfo}</span>
        </td>
        <td class="text-center">
          <button class="btn btn-primary btn-sm" onclick="generateAndShowDoc('booking', '${o.id}')">📄 生成订舱单 (SO)</button>
        </td>
        <td class="text-right">
          <button class="btn btn-outline btn-sm" onclick="openBookingModal('${o.id}')">编辑托书信息</button>
        </td>
      </tr>
    `; 
  }).join('');
}

// 10. 出口报关单据套件
function renderCustomsExport() {
  const targetOrders = db.orders.filter(o => o.customsType !== 'client'); // 过滤掉客户自行报关的订单
  document.getElementById('export-customs-tbody').innerHTML = targetOrders.map(o => `
    <tr>
      <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
      <td>${o.loadingPort} 海关 | ${o.tradeTerms}</td>
      <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('customs_decl', '${o.id}')">Declaration Draft</button></td>
      <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('customs_inv', '${o.id}')">Commercial Invoice</button></td>
      <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('customs_cont', '${o.id}')">Sales Contract</button></td>
      <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('customs_pl', '${o.id}')">Packing List</button></td>
      <td class="text-right"><button class="btn btn-outline btn-sm" onclick="openCustomsModal('${o.id}')">编辑清关外销单据</button></td>
    </tr>
  `).join('') || `<tr><td colspan="7" class="text-center" style="color:#94a3b8; padding:15px;">暂无需要我司代办报关的订单</td></tr>`;
}

// 10.1 报关草单信息补录
function renderCustomsDecl() {
  const targetOrders = db.orders.filter(o => o.customsType !== 'client');
  document.getElementById('decl-tbody').innerHTML = targetOrders.map(o => {
    const dd = getDeclData(o);
    return `
      <tr>
        <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
        <td>${dd.shipper}</td>
        <td>${dd.port}</td>
        <td>${dd.country}</td>
        <td>${dd.tradeTerms}</td>
        <td class="text-right"><button class="btn btn-outline btn-sm" onclick="openDeclModal('${o.id}')">编辑报关信息</button></td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="6" class="text-center" style="color:#94a3b8; padding:15px;">暂无需要报关草单的订单</td></tr>`;
}

// 11. 目的港清关资料套件
function renderCustomsImport() {
  const targetOrders = db.orders.filter(o => o.customsType !== 'client');
  document.getElementById('import-customs-tbody').innerHTML = targetOrders.map(o => {
    const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定' };
    return `
      <tr>
        <td><strong style="color:var(--blue);">${o.piNumber}</strong></td>
        <td>${client.name}</td>
        <td><strong>${o.destinationPort}</strong></td>
        <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('clear_inv', '${o.id}')">Commercial Invoice</button></td>
        <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('clear_cont', '${o.id}')">Sales Contract</button></td>
        <td class="text-center"><button class="btn btn-outline btn-sm" onclick="generateAndShowDoc('clear_pl', '${o.id}')">Packing List</button></td>
        <td class="text-right"><button class="btn btn-outline btn-sm" onclick="openCustomsModal('${o.id}')">编辑清关外销单据</button></td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="7" class="text-center" style="color:#94a3b8; padding:15px;">暂无需要代办清关资料的订单</td></tr>`;
}

// 12. QC 质量检验
function renderQcRecords() {
  document.getElementById('qc-table-body').innerHTML = db.qcRecords.map(q => {
    const order = db.orders.find(o => o.id === q.orderId) || { piNumber: '未关联' }; 
    const statusBadge = q.status === 'Passed' ? 'badge-green' : (q.status === 'Failed' ? 'badge-danger' : 'badge-amber');
    return `
      <tr>
        <td><strong style="color:var(--indigo);">${q.qcNo}</strong></td>
        <td><strong>${order.piNumber}</strong></td>
        <td>${q.date}</td>
        <td>${q.inspector}</td>
        <td><small>${q.type}</small></td>
        <td>${q.checked} / <span style="color:var(--success);font-weight:bold;">${q.passed}</span> / <span style="color:var(--danger);font-weight:bold;">${q.failed}</span></td>
        <td><strong style="color:${parseFloat(q.defectRate)>3?'var(--danger)':'var(--success)'};">${q.defectRate}</strong></td>
        <td class="text-center"><span class="badge ${statusBadge}">${q.status}</span></td>
        <td class="text-center"><button class="btn btn-outline btn-sm" onclick="viewQcReport('${q.id}')">📋 报告详情</button></td>
        <td class="text-right"><button class="btn btn-danger btn-sm" onclick="deleteQc('${q.id}')">删除</button></td>
      </tr>
    `;
  }).join('');
}

// 13. LoadMaster 装柜测算
function renderLoadMaster() {
  document.getElementById('loadmaster-calc-area').innerHTML = db.orders.map(o => {
    const t = getOrderTotals(o); 
    const tcbm = parseFloat(t.cbm); 
    const u20 = ((tcbm / 28) * 100).toFixed(1); 
    const u40 = ((tcbm / 68) * 100).toFixed(1);
    return `
      <div class="kpi-card" style="margin-bottom:1rem;">
        <div style="font-weight:bold; margin-bottom:8px;">📦 订单 ${o.piNumber} 配载测算 (总计: ${t.ctns} 箱 | ${t.cbm} CBM)</div>
        <div class="kpi-grid">
          <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
            <div>20GP (限容 28 CBM)</div>
            <div style="font-size:1.2rem; font-weight:bold; color:${u20>100?'var(--danger)':'var(--success)'};">${u20}% 装载率</div>
          </div>
          <div style="background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #e2e8f0;">
            <div>40HQ (限容 68 CBM)</div>
            <div style="font-size:1.2rem; font-weight:bold; color:var(--indigo);">${u40}% 装载率</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 14. 财务核算
function renderFinance() {
  document.getElementById('finance-table-body').innerHTML = db.orders.map(o => {
    const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定' }; 
    const t = getOrderTotals(o); 
    const profit = calcOrderProfit(o);
    return `
      <tr>
        <td><strong>${o.piNumber}</strong><br><small style="color:var(--text-muted);">${client.name}</small></td>
        <td class="text-right" style="font-weight:700;color:var(--success);">${o.currency==='RMB'?'¥':'$'}${fmt(t.amount)}</td>
        <td class="text-right" style="color:#2563eb;">${o.currency==='RMB'?'¥':'$'}${fmt(o.receivedUsd)}</td>
        <td class="text-right">${o.exchangeRate || 7.20}</td>
        <td class="text-right">¥${fmt(o.cnyPurchaseCost)}</td>
        <td class="text-right" style="color:var(--accent-hover);font-weight:600;">¥${fmt(calcTaxRefund(o))}</td>
        <td class="text-right">¥${fmt(o.inlandFreight)}</td>
        <td class="text-right">¥${fmt(o.portCharges)}</td>
        <td class="text-right">$${fmt(o.seaFreightUsd)}</td>
        <td class="text-right" style="font-weight:800;color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">¥${fmt(profit)}</td>
        <td class="text-center"><button class="btn btn-primary btn-sm" onclick="openFinanceModal('${o.id}')">编辑核算</button></td>
      </tr>
    `;
  }).join('');
}

// 15. BI 多维数据分析
function renderAnalytics() {
  let sumUsd = 0, sumProfit = 0; 
  db.orders.forEach(o => { 
    sumUsd += getOrderTotals(o).amount; 
    sumProfit += calcOrderProfit(o); 
  });
  document.getElementById('bi-sales-content').innerHTML = `
    <div>累计外销开单: <strong>$${fmt(sumUsd)}</strong></div>
    <div>综合结汇利润: <strong>¥${fmt(sumProfit)}</strong></div>
    <div>平均订单利润率: <strong>${sumUsd>0 ? ((sumProfit / (sumUsd*7.2))*100).toFixed(1)+'%' : '0%'}</strong></div>
  `;
  document.getElementById('bi-clients-content').innerHTML = db.clients.map(c => `<div>• <strong>${c.name}</strong> (${c.country})</div>`).join('') || '暂无数据';
  document.getElementById('bi-suppliers-content').innerHTML = db.suppliers.map(s => `<div>• <strong>${s.name}</strong> (${s.city})</div>`).join('') || '暂无数据';
  document.getElementById('bi-products-content').innerHTML = db.products.map(p => `<div>• <strong>${p.model}</strong>: 售价 $${p.priceUsd} | 成本 ¥${p.costCny}</div>`).join('') || '暂无数据';
}

// 16. CRM 客户管理
function renderClients() {
  document.getElementById('clients-table-body').innerHTML = db.clients.map(c => `
    <tr>
      <td><strong class="clickable-link" onclick="openContactsModal('client', '${c.id}')">${c.name}</strong></td>
      <td>${c.country}</td>
      <td>${c.destinationPort}</td>
      <td>${c.mainProducts}</td>
      <td>${c.website}</td>
      <td>${(c.contacts||[]).length} 人</td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="openClientModal('${c.id}')">编辑</button> 
        <button class="btn btn-danger btn-sm" onclick="deleteClient('${c.id}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// 17. 产品数据库
function renderProducts() {
  document.getElementById('products-table-body').innerHTML = db.products.map(p => {
    const supplier = db.suppliers.find(s => s.id === p.supplierId) || { name: '未绑定供应商' };
    const netDim = p.prodDimL ? `${p.prodDimL}×${p.prodDimW}×${p.prodDimH}` : '-';
    const boxDim = p.boxDimL ? `${p.boxDimL}×${p.boxDimW}×${p.boxDimH}` : '-';
    const ctnDim = p.dimL ? `${p.dimL}×${p.dimW}×${p.dimH}` : '-';
    
    return `
    <tr>
      <td><img src="${p.img || (typeof SAMPLE_IMG_SCALE !=='undefined'?SAMPLE_IMG_SCALE:'')}" class="prod-thumb" style="object-fit:contain; width:45px; height:45px;"></td>
      <td>
        <strong>${p.model}</strong><br>
        <span class="badge badge-amber" style="font-size:9px; margin-top:4px;">${supplier.name}</span>
      </td>
      <td>
        <strong>${p.nameEn}</strong><br>
        <small>${p.nameCn}</small>
        <div style="font-size:10px; color:#64748b; margin-top:6px; padding-top:6px; border-top:1px dashed #cbd5e1; white-space:pre-wrap; line-height:1.4;">${p.spec || '<span style="color:#cbd5e1;">暂无规格描述</span>'}</div>
      </td>
      <td><span style="font-family:monospace;">${p.hsCode}</span></td>
      <td style="font-size:11px; line-height:1.6; color:#475569;">
        <div>产品: ${netDim}</div>
        <div>彩盒: ${boxDim}</div>
        <div>外箱: ${ctnDim}</div>
      </td>
      <td style="font-size:11px; line-height:1.6; color:#475569;">
        <div>重量: ${p.pcsPerCtn}只 / ${p.nwPerCtn}kg / ${p.gwPerCtn}kg</div>
        <div style="color:var(--primary); font-weight:bold;">装柜: ${p.qty20GP||'-'} / ${p.qty40GP||'-'} / ${p.qty40HQ||'-'}</div>
      </td>
      <td class="text-right">¥${p.costCny}</td>
      <td class="text-right">$${p.priceUsd}</td>
      <td class="text-right" style="min-width:100px;">
        <button class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')">编辑</button> 
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">删除</button>
      </td>
    </tr>
  `}).join('');
}

// 18. 供应商管理
function renderSuppliers() {
  document.getElementById('suppliers-table-body').innerHTML = db.suppliers.map(s => `
    <tr>
      <td><strong class="clickable-link" onclick="openContactsModal('supplier', '${s.id}')">${s.name}</strong></td>
      <td>${s.city}</td>
      <td>${s.mainProducts}</td>
      <td>${s.bankName} - ${s.bankAccount}</td>
      <td>${(s.contacts||[]).length} 人</td>
      <td class="text-right">
        <button class="btn btn-outline btn-sm" onclick="openSupplierModal('${s.id}')">编辑</button> 
        <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${s.id}')">删除</button>
      </td>
    </tr>
  `).join('');
}

// 联系人弹窗表格渲染 (复用函数)
function renderContactsTable() {
  const type = document.getElementById('contact-owner-type').value; 
  const ownerId = document.getElementById('contact-owner-id').value;
  const owner = type === 'client' ? db.clients.find(x => x.id === ownerId) : db.suppliers.find(x => x.id === ownerId);
  const contacts = owner?.contacts || [];
  
  document.getElementById('contacts-table-body').innerHTML = contacts.map((c, idx) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.title || '-'}</td>
      <td>${c.email || '-'}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.im || '-'}</td>
      <td class="text-center">
        <button class="btn btn-danger btn-sm" onclick="removeContactItem(${idx})">删除</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center" style="padding:15px;color:var(--text-muted);">暂无联系人</td></tr>`;
}

// 19. 系统设置与权限中心
function renderSettings() {
  document.getElementById('set-comp-cn').value = db.company.nameCn || '';
  document.getElementById('set-comp-en').value = db.company.nameEn || '';
  document.getElementById('set-addr-cn').value = db.company.addressCn || '';
  document.getElementById('set-addr-en').value = db.company.addressEn || '';
  document.getElementById('set-tel').value = db.company.tel || '';
  document.getElementById('set-email').value = db.company.email || '';
  
  document.getElementById('set-usd-rate').value = db.finance.usdRate || 7.20;
  document.getElementById('set-tax-rate').value = db.finance.taxRate || 13.0;
  document.getElementById('set-payment').value = db.templates.payment || '';
  document.getElementById('set-arbitration').value = db.templates.arbitration || '';

  document.getElementById('set-banks-tbody').innerHTML = db.banks.map(b => `
    <tr>
      <td><span class="badge badge-blue">${b.type}</span></td>
      <td><strong>${b.name}</strong></td>
      <td><span style="font-family:monospace;">${b.account}</span></td>
      <td><span style="font-size:11px;color:var(--text-muted);">${b.swift || '-'} ${b.note ? '<br>'+b.note : ''}</span></td>
      <td class="text-center">
        <button class="btn btn-outline btn-sm" onclick="openBankModal('${b.id}')">编辑</button>
        <button class="btn btn-danger btn-sm" onclick="removeSetBank('${b.id}')">删</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="text-center" style="color:#94a3b8; padding:15px;">暂无收款路线数据，请添加</td></tr>`;

  document.getElementById('set-users-tbody').innerHTML = db.users.map((u, idx) => `
    <tr>
      <td><input type="text" class="inline-input u-name" value="${u.name}"></td>
      <td><input type="text" class="inline-input u-role" value="${u.role}" placeholder="如 业务/QC"></td>
      <td class="text-center"><input type="checkbox" class="u-cost" ${u.hideCost ? 'checked' : ''}></td>
      <td class="text-center"><input type="checkbox" class="u-fac" ${u.hideFactory ? 'checked' : ''}></td>
      <td class="text-center">
        <button class="btn btn-danger btn-sm" onclick="removeSetUser(${idx})">删</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('set-logs-tbody').innerHTML = db.logs.map(l => `
    <tr>
      <td style="color:#64748b; font-size:11px;">${l.time}</td>
      <td><strong style="color:var(--primary);">${l.user}</strong></td>
      <td>${l.action}</td>
    </tr>
  `).join('') || `<tr><td colspan="3" class="text-center" style="color:#94a3b8;">暂无操作日志</td></tr>`;
}