/* =========================================
   BridgePort OS - 弹窗与交互逻辑 (modals.js)
   100% 修复无错版
   ========================================= */

function openModal(id) { const el = document.getElementById(id); if (el) { el.style.display = 'flex'; el.classList.add('open'); } }
function closeModal(id) { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.classList.remove('open'); } }

// ================== 商机管理 (RFQ) ==================
function openRfqModal(id = null) {
  const clientSelect = document.getElementById('rfq-client-select');
  const productSelect = document.getElementById('rfq-product-select');
  if (clientSelect) clientSelect.innerHTML = db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (productSelect) productSelect.innerHTML = `<option value="">-- 手动输入描述，或从产品库选择 --</option>` + db.products.map(p => `<option value="${p.id}">${p.model} - ${p.nameCn}</option>`).join('');
  if (id) {
    const r = db.rfqs.find(x => x.id === id); 
    if(r) {
      document.getElementById('rfq-edit-id').value = r.id; document.getElementById('rfq-no').value = r.rfqNo; document.getElementById('rfq-date').value = r.date; 
      if(clientSelect) clientSelect.value = r.clientId; if(productSelect) productSelect.value = r.productId || ''; 
      document.getElementById('rfq-desc').value = r.desc; document.getElementById('rfq-qty').value = r.targetQty; document.getElementById('rfq-target-price').value = r.targetPrice; document.getElementById('rfq-status').value = r.status;
    }
  } else {
    document.getElementById('rfq-edit-id').value = ''; document.getElementById('rfq-no').value = 'RFQ-' + new Date().getFullYear() + '-' + String(db.rfqs.length + 1).padStart(3, '0'); 
    document.getElementById('rfq-date').value = new Date().toISOString().split('T')[0]; if(productSelect) productSelect.value = ''; 
    document.getElementById('rfq-desc').value = ''; document.getElementById('rfq-qty').value = '500'; document.getElementById('rfq-target-price').value = '';
  }
  openModal('modal-rfq');
}
function onRfqProductChange(selectEl) {
  const p = db.products.find(x => x.id === selectEl.value);
  if (p) { document.getElementById('rfq-desc').value = `${p.model} - ${p.nameEn} (${p.nameCn})\n规格: ${p.spec || ''}`; document.getElementById('rfq-target-price').value = p.priceUsd || ''; }
}
function saveRfqData() {
  const editId = document.getElementById('rfq-edit-id').value; const productSelect = document.getElementById('rfq-product-select');
  const obj = { id: editId || ('rfq-' + Date.now()), rfqNo: document.getElementById('rfq-no').value, date: document.getElementById('rfq-date').value, clientId: document.getElementById('rfq-client-select').value, productId: productSelect ? productSelect.value : '', desc: document.getElementById('rfq-desc').value, targetQty: Number(document.getElementById('rfq-qty').value || 500), targetPrice: Number(document.getElementById('rfq-target-price').value || 0), status: document.getElementById('rfq-status').value };
  if (editId) { const idx = db.rfqs.findIndex(x => x.id === editId); if (idx >= 0) db.rfqs[idx] = obj; else db.rfqs.push(obj); } else db.rfqs.unshift(obj);
  saveDB(); if(typeof renderRfqs==='function') renderRfqs(); closeModal('modal-rfq');
}
function deleteRfq(id) { if (confirm('确定删除该询盘吗？')) { db.rfqs = db.rfqs.filter(x => x.id !== id); saveDB(); if(typeof renderRfqs==='function') renderRfqs(); } }
function convertRfqToQuote(rfqId) { const r = db.rfqs.find(x => x.id === rfqId); if (!r) return; openQuoteModal(); document.getElementById('quote-client-select').value = r.clientId; }

// ================== 报价单管理 (QUOTATION) ==================
function openQuoteModal(id = null) {
  document.getElementById('quote-client-select').innerHTML = db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('quote-items-table-body').innerHTML = '';
  if (id) {
    const q = db.quotes.find(x => x.id === id); 
    document.getElementById('quote-edit-id').value = q.id; document.getElementById('quote-number').value = q.quoteNumber; document.getElementById('quote-date').value = q.quoteDate; document.getElementById('quote-valid-date').value = q.validUntil || ''; document.getElementById('quote-client-select').value = q.clientId; document.getElementById('quote-currency').value = q.currency || 'USD'; document.getElementById('quote-trade-terms').value = q.tradeTerms || 'FOB'; document.getElementById('quote-lead-time').value = q.leadTime || '25-30 days'; document.getElementById('quote-payment-terms').value = q.paymentTerms || ''; document.getElementById('quote-loading-port').value = q.loadingPort || ''; document.getElementById('quote-dest-port').value = q.destinationPort || ''; document.getElementById('quote-remark').value = q.remark || (typeof DEFAULT_QUOTE_REMARK !== 'undefined' ? DEFAULT_QUOTE_REMARK : '');
    (q.items || []).forEach(it => addQuoteItemRow(it));
  } else {
    document.getElementById('quote-edit-id').value = ''; document.getElementById('quote-number').value = 'BP-QT-' + new Date().getFullYear() + '-' + String(db.quotes.length + 1).padStart(3, '0'); document.getElementById('quote-date').value = new Date().toISOString().split('T')[0]; document.getElementById('quote-valid-date').value = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]; document.getElementById('quote-remark').value = typeof DEFAULT_QUOTE_REMARK !== 'undefined' ? DEFAULT_QUOTE_REMARK : ''; addQuoteItemRow();
  }
  openModal('modal-quote');
}
function addQuoteItemRow(item = null) {
  const tbody = document.getElementById('quote-items-table-body'); const tr = document.createElement('tr');
  let productOptions = `<option value="">-- 选择产品 --</option>` + db.products.map(p => `<option value="${p.id}" ${item && item.productId === p.id ? 'selected' : ''}>${p.model} - ${p.nameCn}</option>`).join('');
  const imgData = typeof SAMPLE_IMG_SCALE !== 'undefined' ? SAMPLE_IMG_SCALE : '';
  tr.innerHTML = `<td class="text-center q-idx"></td><td><select class="form-control q-prod-select" onchange="onQuoteProductChange(this)">${productOptions}</select><input type="hidden" class="q-model" value="${item ? item.model : ''}"><input type="hidden" class="q-name-en" value="${item ? item.nameEn : ''}"><input type="hidden" class="q-name-cn" value="${item ? item.nameCn : ''}"><input type="hidden" class="q-hscode" value="${item ? item.hsCode : ''}"></td><td><img class="prod-thumb q-img-preview" src="${item && item.img ? item.img : imgData}"><input type="hidden" class="q-img-base64" value="${item ? (item.img || '') : imgData}"></td><td><textarea class="form-control q-spec" rows="2" style="font-size:11px;">${item ? (item.spec || item.nameEn) : ''}</textarea></td><td><textarea class="form-control q-packing" rows="2" style="font-size:10px; line-height:1.3;">${item ? (item.packing || '') : ''}</textarea><input type="hidden" class="q-cbm" value="${item ? (item.cbmPerCtn || 0.05) : 0.05}"><input type="hidden" class="q-pcs" value="${item ? (item.pcsPerCtn || 1) : 1}"></td><td><input type="number" step="0.01" class="form-control q-price" value="${item ? item.price : 0}" oninput="calcQuoteRow(this)"></td><td><input type="number" class="form-control q-qty" value="${item ? item.qty : 500}" oninput="calcQuoteRow(this)"></td><td style="font-size:10px; color:#1e40af;" class="q-container-info">-</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove(); reindexQuoteRows();">✕</button></td>`;
  tbody.appendChild(tr); if (!item && db.products.length > 0) { const select = tr.querySelector('.q-prod-select'); select.value = db.products[0].id; onQuoteProductChange(select); } else if (item) { updateContainerInfo(tr); }
  reindexQuoteRows();
}
function reindexQuoteRows() { document.querySelectorAll('#quote-items-table-body tr').forEach((tr, idx) => { tr.querySelector('.q-idx').textContent = idx + 1; }); }
function onQuoteProductChange(el) {
  const tr = el.closest('tr'); const p = db.products.find(x => x.id === el.value);
  if (p) { tr.querySelector('.q-model').value = p.model; tr.querySelector('.q-name-en').value = p.nameEn; tr.querySelector('.q-name-cn').value = p.nameCn; tr.querySelector('.q-hscode').value = p.hsCode; tr.querySelector('.q-spec').value = p.spec || `${p.nameEn} (${p.nameCn})`; tr.querySelector('.q-price').value = p.priceUsd; tr.querySelector('.q-pcs').value = p.pcsPerCtn || 1; tr.querySelector('.q-cbm').value = p.cbmPerCtn || 0.05; tr.querySelector('.q-packing').value = `${p.pcsPerCtn || 1} PCS/CTN\n${p.dimL||50}x${p.dimW||35}x${p.dimH||30}cm\nGW: ${p.gwPerCtn||12}kg`; tr.querySelector('.q-img-base64').value = p.img || ''; tr.querySelector('.q-img-preview').src = p.img || ''; updateContainerInfo(tr); }
}
function updateContainerInfo(tr) { if(typeof calcContainerQty !== 'function') return; const cbm = Number(tr.querySelector('.q-cbm').value || 0.05); const pcs = Number(tr.querySelector('.q-pcs').value || 1); const res = calcContainerQty(cbm, pcs); tr.querySelector('.q-container-info').innerHTML = `20GP: ${res.qty20}<br>40HQ: ${res.qty40hq}`; }
function calcQuoteRow(el) { updateContainerInfo(el.closest('tr')); }
function saveQuoteData() {
  const editId = document.getElementById('quote-edit-id').value;
  const items = Array.from(document.querySelectorAll('#quote-items-table-body tr')).map(tr => ({ productId: tr.querySelector('.q-prod-select').value, model: tr.querySelector('.q-model').value, nameEn: tr.querySelector('.q-name-en').value, nameCn: tr.querySelector('.q-name-cn').value, spec: tr.querySelector('.q-spec').value, hsCode: tr.querySelector('.q-hscode').value, packing: tr.querySelector('.q-packing').value, qty: Number(tr.querySelector('.q-qty').value || 0), price: Number(tr.querySelector('.q-price').value || 0), pcsPerCtn: Number(tr.querySelector('.q-pcs').value || 1), cbmPerCtn: Number(tr.querySelector('.q-cbm').value || 0.05), img: tr.querySelector('.q-img-base64').value }));
  const obj = { id: editId || ('qt-' + Date.now()), quoteNumber: document.getElementById('quote-number').value, quoteDate: document.getElementById('quote-date').value, validUntil: document.getElementById('quote-valid-date').value, clientId: document.getElementById('quote-client-select').value, currency: document.getElementById('quote-currency').value, tradeTerms: document.getElementById('quote-trade-terms').value, leadTime: document.getElementById('quote-lead-time').value, paymentTerms: document.getElementById('quote-payment-terms').value, loadingPort: document.getElementById('quote-loading-port').value, destinationPort: document.getElementById('quote-dest-port').value, remark: document.getElementById('quote-remark').value, status: '已报价', items: items };
  if (editId) { const idx = db.quotes.findIndex(x => x.id === editId); if (idx >= 0) db.quotes[idx] = obj; else db.quotes.push(obj); } else db.quotes.unshift(obj);
  saveDB(); if(typeof renderQuotes==='function') renderQuotes(); closeModal('modal-quote');
}
function deleteQuote(id) { if (confirm('确定删除吗？')) { db.quotes = db.quotes.filter(x => x.id !== id); saveDB(); if(typeof renderQuotes==='function') renderQuotes(); } }

function convertQuoteToOrder(id) {
  const q = db.quotes.find(x => x.id === id); if (!q) return;
  const freshNodes = typeof DEFAULT_NODES !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_NODES)) : [];
  const newOrder = { 
    id: 'ord-' + Date.now(), piNumber: 'BP-' + new Date().getFullYear() + '-' + String(db.orders.length + 1).padStart(3, '0'), orderDate: document.getElementById('order-date').value || q.quoteDate, clientId: q.clientId, supplierId: db.suppliers[0]?.id || '', currency: q.currency || 'USD', tradeTerms: q.tradeTerms, customsType: 'company', bankId: db.banks[0] ? db.banks[0].id : '', loadingPort: q.loadingPort, destinationPort: q.destinationPort, paymentTerms: q.paymentTerms, deliveryDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], packaging: 'Standard Neutral Export Cartons', specialReq: 'Standard quality check', showSpecialReq: true, showStamp: true, status: '生产中', receivedUsd: 0, exchangeRate: 7.20, taxRefundRate: 13, inlandFreight: 0, portCharges: 0, seaFreightUsd: 0, nodes: freshNodes, bookingData: {},
    items: q.items.map(it => { const prod = db.products.find(p => p.id === it.productId) || {}; const pcs = it.pcsPerCtn || prod.pcsPerCtn || 1; const ctns = Math.ceil(it.qty / pcs); return { productId: it.productId, model: it.model, nameEn: it.nameEn, nameCn: it.nameCn, spec: it.spec, hsCode: it.hsCode, pcsPerCtn: pcs, ctns: ctns, qty: ctns * pcs, unit: '台', price: it.price, costCny: prod.costCny || 0, nwPerCtn: it.nwPerCtn || prod.nwPerCtn || 10, gwPerCtn: it.gwPerCtn || prod.gwPerCtn || 12, cbmPerCtn: it.cbmPerCtn || prod.cbmPerCtn || 0.05, img: it.img || '' }; })
  };
  newOrder.cnyPurchaseCost = newOrder.items.reduce((s, it) => s + (it.qty * it.costCny), 0); q.status = '已转PI'; db.orders.unshift(newOrder); saveDB(); if(typeof renderAll === 'function') renderAll(); if(typeof switchNav === 'function') switchNav('orders', null); alert(`报价单已转为正式 PI: ${newOrder.piNumber}`);
}

// ================== 外贸订单管理 (PROFORMA INVOICE) ==================
function openOrderModal(id = null) {
  document.getElementById('order-client-select').innerHTML = db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); 
  document.getElementById('order-supplier-select').innerHTML = db.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join(''); 
  document.getElementById('order-bank-select').innerHTML = db.banks.map(b => `<option value="${b.id}">${b.name} (${b.type})</option>`).join('');
  document.getElementById('order-items-table-body').innerHTML = '';
  
  if (id) {
    const o = db.orders.find(x => x.id === id); 
    document.getElementById('order-edit-id').value = o.id; 
    document.getElementById('order-pi-number').value = o.piNumber; 
    document.getElementById('order-date').value = o.orderDate; 
    document.getElementById('order-client-select').value = o.clientId; 
    document.getElementById('order-supplier-select').value = o.supplierId; 
    document.getElementById('order-currency').value = o.currency || 'USD'; 
    document.getElementById('order-trade-terms').value = o.tradeTerms || 'FOB'; 
    document.getElementById('order-customs-type').value = o.customsType || 'company'; 
    document.getElementById('order-bank-select').value = o.bankId || (db.banks[0] ? db.banks[0].id : '');
    document.getElementById('order-loading-port').value = o.loadingPort || ''; 
    document.getElementById('order-dest-port').value = o.destinationPort || ''; 
    document.getElementById('order-payment-terms').value = o.paymentTerms || ''; 
    document.getElementById('order-delivery-date').value = o.deliveryDate || ''; 
    document.getElementById('order-packaging').value = o.packaging || ''; 
    document.getElementById('order-special-req').value = o.specialReq || ''; 
    document.getElementById('order-show-special').checked = o.showSpecialReq !== false; 
    document.getElementById('order-show-stamp').checked = o.showStamp !== false;
    (o.items || []).forEach(it => addOrderItemRow(it));
  } else {
    document.getElementById('order-edit-id').value = ''; 
    document.getElementById('order-pi-number').value = 'BP-' + new Date().getFullYear() + '-' + String(db.orders.length + 1).padStart(3, '0'); 
    document.getElementById('order-date').value = new Date().toISOString().split('T')[0]; 
    document.getElementById('order-customs-type').value = 'company'; 
    document.getElementById('order-bank-select').value = db.banks[0] ? db.banks[0].id : '';
    document.getElementById('order-special-req').value = 'Standard requirements.'; 
    document.getElementById('order-show-special').checked = true; 
    document.getElementById('order-show-stamp').checked = true; 
    addOrderItemRow();
  }
  openModal('modal-order');
}

function addOrderItemRow(item = null) {
  const tbody = document.getElementById('order-items-table-body'); const tr = document.createElement('tr');
  let productOptions = `<option value="">-- 选择产品 --</option>` + db.products.map(p => `<option value="${p.id}" ${item && item.productId === p.id ? 'selected' : ''}>${p.model} - ${p.nameCn}</option>`).join('');
  const imgData = typeof SAMPLE_IMG_SCALE !== 'undefined' ? SAMPLE_IMG_SCALE : '';
  tr.innerHTML = `<td class="text-center o-idx"></td><td><select class="form-control o-prod-select" onchange="onOrderProductChange(this)">${productOptions}</select><input type="hidden" class="o-model" value="${item ? item.model : ''}"><input type="hidden" class="o-name-en" value="${item ? item.nameEn : ''}"><input type="hidden" class="o-name-cn" value="${item ? item.nameCn : ''}"><input type="hidden" class="o-hscode" value="${item ? item.hsCode : ''}"></td><td><img class="prod-thumb o-img-preview" src="${item && item.img ? item.img : imgData}"><input type="hidden" class="o-img-base64" value="${item ? (item.img || '') : imgData}"></td><td><textarea class="form-control o-spec" rows="2" style="font-size:11px;">${item ? (item.spec || item.nameEn) : ''}</textarea></td><td><input type="number" class="form-control o-pcs" value="${item ? (item.pcsPerCtn || 4) : 4}" oninput="calcOrderRow(this)"></td><td><input type="number" class="form-control o-ctns" value="${item ? (item.ctns || 100) : 100}" oninput="calcOrderRow(this)"></td><td><input type="number" class="form-control o-qty" value="${item ? item.qty : 400}" readonly style="background:#f1f5f9;font-weight:bold;"></td><td><input type="number" step="0.01" class="form-control o-price" value="${item ? (item.price || item.priceUsd) : 0}" oninput="calcOrderRow(this)"><input type="hidden" class="o-cost" value="${item ? (item.costCny || 0) : 0}"><input type="hidden" class="o-unit" value="${item ? (item.unit || '台') : '台'}"><input type="hidden" class="o-nw" value="${item ? (item.nwPerCtn || 10) : 10}"><input type="hidden" class="o-gw" value="${item ? (item.gwPerCtn || 12) : 12}"><input type="hidden" class="o-cbm" value="${item ? (item.cbmPerCtn || 0.05) : 0.05}"></td><td class="text-right o-subtotal" style="font-weight:bold;color:var(--success);">$${typeof fmt==='function'?fmt((item ? item.qty : 400) * (item ? (item.price || item.priceUsd) : 0)):0}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove(); reindexOrderRows();">✕</button></td>`;
  tbody.appendChild(tr); if (!item && db.products.length > 0) { const select = tr.querySelector('.o-prod-select'); select.value = db.products[0].id; onOrderProductChange(select); }
  reindexOrderRows();
}

function reindexOrderRows() { document.querySelectorAll('#order-items-table-body tr').forEach((tr, idx) => { tr.querySelector('.o-idx').textContent = idx + 1; }); }

function onOrderProductChange(el) {
  const tr = el.closest('tr'); const p = db.products.find(x => x.id === el.value);
  if (p) { tr.querySelector('.o-model').value = p.model; tr.querySelector('.o-name-en').value = p.nameEn; tr.querySelector('.o-name-cn').value = p.nameCn; tr.querySelector('.o-hscode').value = p.hsCode; tr.querySelector('.o-spec').value = p.spec || `${p.nameEn} (${p.nameCn})`; tr.querySelector('.o-pcs').value = p.pcsPerCtn || 4; tr.querySelector('.o-price').value = p.priceUsd; tr.querySelector('.o-cost').value = p.costCny; tr.querySelector('.o-nw').value = p.nwPerCtn || 10; tr.querySelector('.o-gw').value = p.gwPerCtn || 12; tr.querySelector('.o-cbm').value = p.cbmPerCtn || 0.05; tr.querySelector('.o-img-base64').value = p.img || ''; tr.querySelector('.o-img-preview').src = p.img || ''; calcOrderRow(el); }
}

function calcOrderRow(el) { 
  const tr = el.closest('tr'); const pcs = Number(tr.querySelector('.o-pcs').value || 1); const ctns = Number(tr.querySelector('.o-ctns').value || 1); const price = Number(tr.querySelector('.o-price').value || 0); const qty = pcs * ctns; 
  tr.querySelector('.o-qty').value = qty; tr.querySelector('.o-subtotal').textContent = '$' + (typeof fmt==='function'?fmt(qty * price):qty*price); 
}

function saveOrderData() {
  const editId = document.getElementById('order-edit-id').value; 
  const piNumber = document.getElementById('order-pi-number').value.trim();
  if(!piNumber) return alert("PI编号不能为空！");
  const rows = document.querySelectorAll('#order-items-table-body tr');
  if(rows.length === 0) return alert("请至少添加一行商品！");
  
  const items = Array.from(rows).map(tr => ({ productId: tr.querySelector('.o-prod-select').value, model: tr.querySelector('.o-model').value, nameEn: tr.querySelector('.o-name-en').value, nameCn: tr.querySelector('.o-name-cn').value, spec: tr.querySelector('.o-spec').value, hsCode: tr.querySelector('.o-hscode').value, pcsPerCtn: Number(tr.querySelector('.o-pcs').value || 1), ctns: Number(tr.querySelector('.o-ctns').value || 0), qty: Number(tr.querySelector('.o-qty').value || 0), unit: tr.querySelector('.o-unit') ? tr.querySelector('.o-unit').value : '台', price: Number(tr.querySelector('.o-price').value || 0), costCny: Number(tr.querySelector('.o-cost').value || 0), nwPerCtn: Number(tr.querySelector('.o-nw').value || 10), gwPerCtn: Number(tr.querySelector('.o-gw').value || 12), cbmPerCtn: Number(tr.querySelector('.o-cbm').value || 0.05), img: tr.querySelector('.o-img-base64').value }));
  const totalPurchaseCny = items.reduce((s, it) => s + (it.qty * it.costCny), 0);
  const existing = editId ? db.orders.find(x => x.id === editId) : null;
  const freshNodes = typeof DEFAULT_NODES !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULT_NODES)) : [];

  const orderObj = { 
    id: editId || ('ord-' + Date.now()), piNumber: piNumber, orderDate: document.getElementById('order-date').value, clientId: document.getElementById('order-client-select').value, supplierId: document.getElementById('order-supplier-select').value, currency: document.getElementById('order-currency').value, tradeTerms: document.getElementById('order-trade-terms').value, customsType: document.getElementById('order-customs-type').value, bankId: document.getElementById('order-bank-select').value, loadingPort: document.getElementById('order-loading-port').value, destinationPort: document.getElementById('order-dest-port').value, paymentTerms: document.getElementById('order-payment-terms').value, deliveryDate: document.getElementById('order-delivery-date').value, packaging: document.getElementById('order-packaging').value, specialReq: document.getElementById('order-special-req').value, showSpecialReq: document.getElementById('order-show-special').checked, showStamp: document.getElementById('order-show-stamp').checked, status: existing ? existing.status : '生产中', receivedUsd: existing ? existing.receivedUsd : 0, exchangeRate: existing ? existing.exchangeRate : 7.20, cnyPurchaseCost: totalPurchaseCny, taxRefundRate: existing ? existing.taxRefundRate : 13, inlandFreight: existing ? existing.inlandFreight : 0, portCharges: existing ? existing.portCharges : 0, seaFreightUsd: existing ? existing.seaFreightUsd : 0, nodes: existing && existing.nodes ? existing.nodes : freshNodes, purchaseContract: existing?.purchaseContract || { contractNo: piNumber + '-CG', signDate: document.getElementById('order-date').value, deliveryDeadline: '合同签订后30天内完成生产交货', deliveryLocation: '送至买方指定出口监管仓库', paymentTerms: '预付定金30%，出货前买方QC验货合格，供方开具13%增值税专用发票后结清70%余款。', qualityReq: '外销全检出厂标准', packingReq: '海运中性纸箱', penaltyReq: '日万分之五违约金+质量全赔', disputeReq: '需方所在地法院起诉' }, productionOrder: existing?.productionOrder || { poNo: piNumber + '-PO', techReq: '严格按照外销技术要求生产', markReq: '包装双坑中性外箱' }, items: items, bookingData: existing?.bookingData || {} 
  };
  if (editId) { const idx = db.orders.findIndex(x => x.id === editId); if (idx >= 0) db.orders[idx] = orderObj; else db.orders.push(orderObj); } else { db.orders.unshift(orderObj); }
  saveDB(); if(typeof renderAll === 'function') renderAll(); closeModal('modal-order');
}

function deleteOrder(id) { if (confirm('确定要删除该订单吗？')) { db.orders = db.orders.filter(x => x.id !== id); saveDB(); if(typeof renderAll === 'function') renderAll(); } }

// ================== 订舱托书专属编辑逻辑 (Booking Note) ==================
function openBookingModal(orderId) {
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;
  const client = db.clients.find(c => c.id === order.clientId) || {};
  const primaryClientContact = (client.contacts && client.contacts.length > 0) ? client.contacts[0] : {};
  const totals = typeof getOrderTotals === 'function' ? getOrderTotals(order) : { ctns: 0, cbm: 0, gw: 0 };

  const bk = order.bookingData || {};
  document.getElementById('bk-order-id').value = order.id;
  
  document.getElementById('bk-shipper').value = bk.shipper || `${db.company.nameEn}\n${db.company.addressEn}\nTEL: ${db.company.tel}`;
  document.getElementById('bk-consignee').value = bk.consignee || `${client.name || ''}\n${client.address || ''}\nATTN: ${primaryClientContact.name || ''} ${primaryClientContact.phone || ''}`;
  
  document.getElementById('bk-loading-port').value = bk.loadingPort || order.loadingPort || 'Ningbo, China';
  document.getElementById('bk-discharge-port').value = bk.dischargePort || order.destinationPort || '';
  document.getElementById('bk-delivery-port').value = bk.deliveryPort || order.destinationPort || '';
  document.getElementById('bk-trade-terms').value = bk.tradeTerms || order.tradeTerms || 'FOB';
  document.getElementById('bk-freight-term').value = bk.freightTerm || (['FOB', 'EXW', 'FCA'].includes(order.tradeTerms) ? 'Collect' : 'Prepaid');
  
  document.getElementById('bk-vessel').value = bk.vessel || '';
  document.getElementById('bk-bl-type').value = bk.blType || 'Original (正本提单)';
  document.getElementById('bk-20gp').value = bk.qty20 || '';
  document.getElementById('bk-40gp').value = bk.qty40 || '';
  document.getElementById('bk-40hq').value = bk.qty40hq || '';
  document.getElementById('bk-lcl').checked = bk.isLcl || false;

  document.getElementById('bk-marks').value = bk.marks || 'N/M';
  document.getElementById('bk-ctns').value = bk.ctns !== undefined ? bk.ctns : totals.ctns;
  document.getElementById('bk-gw').value = bk.gw !== undefined ? bk.gw : totals.gw;
  document.getElementById('bk-cbm').value = bk.cbm !== undefined ? bk.cbm : totals.cbm;
  
  const defaultDesc = order.items.map(it => `${it.nameEn} (${it.model}) - ${it.qty} PCS`).join('\n');
  document.getElementById('bk-desc').value = bk.desc || defaultDesc;
  document.getElementById('bk-remarks').value = bk.remarks || 'Please arrange the earliest vessel.';

  openModal('modal-booking-edit');
}

function saveBookingData() {
  const orderId = document.getElementById('bk-order-id').value;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;
  
  order.bookingData = {
    shipper: document.getElementById('bk-shipper').value.trim(),
    consignee: document.getElementById('bk-consignee').value.trim(),
    loadingPort: document.getElementById('bk-loading-port').value.trim(),
    dischargePort: document.getElementById('bk-discharge-port').value.trim(),
    deliveryPort: document.getElementById('bk-delivery-port').value.trim(),
    tradeTerms: document.getElementById('bk-trade-terms').value.trim(),
    freightTerm: document.getElementById('bk-freight-term').value,
    vessel: document.getElementById('bk-vessel').value.trim(),
    blType: document.getElementById('bk-bl-type').value,
    qty20: document.getElementById('bk-20gp').value,
    qty40: document.getElementById('bk-40gp').value,
    qty40hq: document.getElementById('bk-40hq').value,
    isLcl: document.getElementById('bk-lcl').checked,
    marks: document.getElementById('bk-marks').value.trim(),
    ctns: Number(document.getElementById('bk-ctns').value || 0),
    gw: Number(document.getElementById('bk-gw').value || 0),
    cbm: Number(document.getElementById('bk-cbm').value || 0),
    desc: document.getElementById('bk-desc').value.trim(),
    remarks: document.getElementById('bk-remarks').value.trim()
  };
  saveDB();
  if(typeof renderShipping === 'function') renderShipping();
  closeModal('modal-booking-edit');
  alert('订舱托书编辑内容已保存！');
}

function saveBookingData() {
  const orderId = document.getElementById('bk-order-id').value;
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return;
  
  order.bookingData = {
    shipper: document.getElementById('bk-shipper').value.trim(),
    consignee: document.getElementById('bk-consignee').value.trim(),
    loadingPort: document.getElementById('bk-loading-port').value.trim(),
    destPort: document.getElementById('bk-dest-port').value.trim(),
    tradeTerms: document.getElementById('bk-trade-terms').value.trim(),
    freightTerm: document.getElementById('bk-freight-term').value,
    vessel: document.getElementById('bk-vessel').value.trim(),
    blType: document.getElementById('bk-bl-type').value,
    qty20: document.getElementById('bk-20gp').value,
    qty40: document.getElementById('bk-40gp').value,
    qty40hq: document.getElementById('bk-40hq').value,
    isLcl: document.getElementById('bk-lcl').checked,
    marks: document.getElementById('bk-marks').value.trim(),
    ctns: Number(document.getElementById('bk-ctns').value || 0),
    gw: Number(document.getElementById('bk-gw').value || 0),
    cbm: Number(document.getElementById('bk-cbm').value || 0),
    desc: document.getElementById('bk-desc').value.trim(),
    remarks: document.getElementById('bk-remarks').value.trim()
  };
  saveDB();
  if(typeof renderShipping === 'function') renderShipping();
  closeModal('modal-booking-edit');
  alert('订舱托书编辑内容已保存！');
}

// ================== 履约追踪节点控制 (Tracking Nodes) ==================
function openTrackingModal(orderId) {
  const o = db.orders.find(item => item.id === orderId); if (!o) return;
  const client = db.clients.find(c => c.id === o.clientId) || { name: '未指定客户' };
  document.getElementById('tracking-title').innerText = `履约进度追踪: ${o.piNumber} (${client.name})`;
  let nodesHtml = (o.nodes || []).map((n, idx) => {
      let badgeClass = 'badge-bank'; if (n.group === 'FACTORY') badgeClass = 'badge-factory'; if (n.group === 'TAX') badgeClass = 'badge-tax'; if (n.group === 'SHIP') badgeClass = 'badge-ship';
      return `<tr><td style="font-weight:bold; width:45px;">${n.code}</td><td style="width:75px;"><span class="badge ${badgeClass}">${n.tag}</span></td><td style="width:200px;"><strong>${n.name}</strong><br><span style="color:#64748B; font-size:11px;">责任: ${n.role}</span></td><td style="width:110px;"><select class="status-select" onchange="updateNodeStatus('${o.id}', ${idx}, this.value)"><option value="PENDING" ${n.status === 'PENDING' ? 'selected' : ''}>⏳ 待执行</option><option value="IN_PROGRESS" ${n.status === 'IN_PROGRESS' ? 'selected' : ''}>🔄 进行中</option><option value="WARNING" ${n.status === 'WARNING' ? 'selected' : ''}>⚠️ 有异常</option><option value="COMPLETED" ${n.status === 'COMPLETED' ? 'selected' : ''}>✅ 已完成</option></select></td><td style="width:110px;"><input type="date" class="inline-input" value="${n.date || ''}" onchange="updateNodeDate('${o.id}', ${idx}, this.value)"></td><td><input type="text" class="inline-input" placeholder="输入备注/凭证单号..." value="${n.note || ''}" onchange="updateNodeNote('${o.id}', ${idx}, this.value)"></td></tr>`;
  }).join('');
  document.getElementById('tracking-content').innerHTML = `<table class="node-table"><thead><tr><th>编码</th><th>板块</th><th>履约阶段与责任</th><th>执行状态</th><th>完成日期</th><th>环节备注 / 凭据号</th></tr></thead><tbody>${nodesHtml}</tbody></table>`;
  openModal('modal-tracking');
}
function updateNodeStatus(orderId, idx, status) { const o = db.orders.find(item => item.id === orderId); o.nodes[idx].status = status; if (status === 'COMPLETED' && !o.nodes[idx].date) o.nodes[idx].date = new Date().toISOString().split('T')[0]; saveDB(); openTrackingModal(orderId); if(typeof renderWorkbench === 'function') renderWorkbench(); }
function updateNodeDate(orderId, idx, date) { const o = db.orders.find(item => item.id === orderId); o.nodes[idx].date = date; saveDB(); }
function updateNodeNote(orderId, idx, note) { const o = db.orders.find(item => item.id === orderId); o.nodes[idx].note = note; saveDB(); }

// ================== 下方所有附属模块 (采购/清关/质检等) ==================
function openPurchaseEditModal(id) { const order = db.orders.find(x => x.id === id); if (!order) return; document.getElementById('pur-order-id').value = order.id; document.getElementById('pur-supplier-select').innerHTML = db.suppliers.map(s => `<option value="${s.id}" ${s.id===order.supplierId?'selected':''}>${s.name}</option>`).join(''); const pc = order.purchaseContract || {}; document.getElementById('pur-contract-no').value = pc.contractNo || order.piNumber + '-CG'; document.getElementById('pur-date').value = pc.signDate || order.orderDate; document.getElementById('pur-delivery-date').value = pc.deliveryDeadline || '30天内'; document.getElementById('pur-delivery-location').value = pc.deliveryLocation || '宁波港'; document.getElementById('pur-quality-req').value = pc.qualityReq || ''; document.getElementById('pur-packing-req').value = pc.packingReq || ''; document.getElementById('pur-payment-terms').value = pc.paymentTerms || ''; document.getElementById('pur-penalty-req').value = pc.penaltyReq || ''; document.getElementById('pur-dispute-req').value = pc.disputeReq || ''; const tbody = document.getElementById('pur-items-table-body'); tbody.innerHTML = ''; order.items.forEach(it => addPurchaseItemRow(it)); openModal('modal-purchase-edit'); }
function addPurchaseItemRow(item = null) { const tbody = document.getElementById('pur-items-table-body'); const tr = document.createElement('tr'); tr.innerHTML = `<td class="text-center pur-idx"></td><td><input type="text" class="form-control pur-model" value="${item ? item.model : ''}"></td><td><input type="text" class="form-control pur-name-cn" value="${item ? item.nameCn : ''}"></td><td><input type="number" class="form-control pur-qty" value="${item ? item.qty : 100}" oninput="calcPurchaseRow(this)"></td><td><input type="text" class="form-control pur-unit" value="${item ? (item.unit || '台') : '台'}" style="padding:4px 6px;"></td><td><input type="number" step="0.01" class="form-control pur-cost" value="${item ? (item.costCny || 0) : 0}" oninput="calcPurchaseRow(this)"></td><td class="text-right pur-subtotal" style="font-weight:bold;color:#dc2626;">¥${typeof fmt==='function'?fmt((item ? item.qty : 100) * (item ? (item.costCny || 0) : 0)):0}</td><td class="text-center"><button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove(); reindexPurchaseRows();">✕</button></td>`; tbody.appendChild(tr); reindexPurchaseRows(); }
function reindexPurchaseRows() { document.querySelectorAll('#pur-items-table-body tr').forEach((tr, idx) => { tr.querySelector('.pur-idx').textContent = idx + 1; }); }
function calcPurchaseRow(el) { const tr = el.closest('tr'); const q = Number(tr.querySelector('.pur-qty').value || 0); const c = Number(tr.querySelector('.pur-cost').value || 0); tr.querySelector('.pur-subtotal').textContent = '¥' + (typeof fmt==='function'?fmt(q * c):q*c); }
function savePurchaseContractData() { const order = db.orders.find(x => x.id === document.getElementById('pur-order-id').value); if (!order) return; order.supplierId = document.getElementById('pur-supplier-select').value; order.purchaseContract = { contractNo: document.getElementById('pur-contract-no').value, signDate: document.getElementById('pur-date').value, deliveryDeadline: document.getElementById('pur-delivery-date').value, deliveryLocation: document.getElementById('pur-delivery-location').value, qualityReq: document.getElementById('pur-quality-req').value, packingReq: document.getElementById('pur-packing-req').value, paymentTerms: document.getElementById('pur-payment-terms').value, penaltyReq: document.getElementById('pur-penalty-req').value, disputeReq: document.getElementById('pur-dispute-req').value }; let total = 0; Array.from(document.querySelectorAll('#pur-items-table-body tr')).forEach((tr, idx) => { const qty = Number(tr.querySelector('.pur-qty').value || 0); const cost = Number(tr.querySelector('.pur-cost').value || 0); total += qty * cost; if (order.items[idx]) { order.items[idx].model = tr.querySelector('.pur-model').value; order.items[idx].nameCn = tr.querySelector('.pur-name-cn').value; order.items[idx].qty = qty; order.items[idx].unit = tr.querySelector('.pur-unit').value; order.items[idx].costCny = cost; } }); order.cnyPurchaseCost = total; saveDB(); if(typeof renderPurchasing==='function') renderPurchasing(); closeModal('modal-purchase-edit'); alert('购销合同已保存！'); }
function openPoEditModal(id) { const order = db.orders.find(x => x.id === id); if (!order) return; const supplier = db.suppliers.find(s => s.id === order.supplierId) || {}; document.getElementById('po-order-id').value = order.id; document.getElementById('po-factory-name').value = supplier.name || ''; const po = order.productionOrder || {}; document.getElementById('po-no').value = po.poNo || order.piNumber + '-PO'; document.getElementById('po-delivery-date').value = order.deliveryDate || ''; document.getElementById('po-port').value = order.loadingPort || '宁波港'; document.getElementById('po-tech-req').value = po.techReq || ''; document.getElementById('po-mark-req').value = po.markReq || ''; openModal('modal-po-edit'); }
function savePoTaskData() { const order = db.orders.find(x => x.id === document.getElementById('po-order-id').value); if (!order) return; order.deliveryDate = document.getElementById('po-delivery-date').value; order.loadingPort = document.getElementById('po-port').value; order.productionOrder = { poNo: document.getElementById('po-no').value, techReq: document.getElementById('po-tech-req').value, markReq: document.getElementById('po-mark-req').value }; saveDB(); if(typeof renderPurchasing==='function') renderPurchasing(); closeModal('modal-po-edit'); alert('PO 已保存！'); }
function openCustomsModal(orderId) { const order = db.orders.find(o => o.id === orderId); if (!order) return; document.getElementById('cust-client-select').innerHTML = db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); const cd = typeof getCustomsData==='function' ? getCustomsData(order) : {}; document.getElementById('cust-order-id').value = order.id; document.getElementById('cust-client-select').value = cd.clientId || order.clientId; document.getElementById('cust-sc-no').value = cd.scNo||''; document.getElementById('cust-inv-no').value = cd.invNo||''; document.getElementById('cust-date').value = cd.date||''; document.getElementById('cust-payment').value = cd.paymentTerms||''; document.getElementById('cust-price-terms').value = cd.priceTerms||''; document.getElementById('cust-ship-method').value = cd.shippingMethod||''; document.getElementById('cust-loading-time').value = cd.loadingTime||''; document.getElementById('cust-loading-port').value = cd.loadingPort||''; document.getElementById('cust-dest-port').value = cd.destPort||''; document.getElementById('cust-ship-mark').value = cd.shippingMark||''; document.getElementById('cust-total-en').value = cd.totalAmountEn||''; document.getElementById('cust-items-table-body').innerHTML = (cd.items||[]).map((it, idx) => `<tr><td class="text-center">${idx + 1}</td><td><input type="text" class="form-control c-prod" value="${it.product}" placeholder="产品名称/规格"></td><td><input type="number" class="form-control c-qty" value="${it.qty}" oninput="calcCustRow(this)"></td><td><input type="number" class="form-control c-ctn" value="${it.ctn}"></td><td><input type="number" step="0.1" class="form-control c-nw" value="${it.nw}"></td><td><input type="number" step="0.1" class="form-control c-gw" value="${it.gw}"></td><td><input type="number" step="0.001" class="form-control c-cbm" value="${it.cbm}"></td><td><input type="text" class="form-control c-mark" value="${it.shippingMark||'N/M'}"></td><td><input type="number" step="0.01" class="form-control c-price" value="${it.price}" oninput="calcCustRow(this)"></td><td><input type="number" step="0.01" class="form-control c-total" value="${it.total}"></td></tr>`).join(''); openModal('modal-customs-edit'); }
function calcCustRow(el) { const tr = el.closest('tr'); const qty = Number(tr.querySelector('.c-qty').value || 0); const price = Number(tr.querySelector('.c-price').value || 0); tr.querySelector('.c-total').value = (qty * price).toFixed(2); }
function saveCustomsData() { const orderId = document.getElementById('cust-order-id').value; const order = db.orders.find(o => o.id === orderId); if (!order) return; const items = Array.from(document.querySelectorAll('#cust-items-table-body tr')).map(tr => ({ product: tr.querySelector('.c-prod').value, qty: Number(tr.querySelector('.c-qty').value || 0), ctn: Number(tr.querySelector('.c-ctn').value || 0), nw: Number(tr.querySelector('.c-nw').value || 0), gw: Number(tr.querySelector('.c-gw').value || 0), cbm: Number(tr.querySelector('.c-cbm').value || 0), shippingMark: tr.querySelector('.c-mark').value, price: Number(tr.querySelector('.c-price').value || 0), total: Number(tr.querySelector('.c-total').value || 0) })); order.customsData = { clientId: document.getElementById('cust-client-select').value, scNo: document.getElementById('cust-sc-no').value, invNo: document.getElementById('cust-inv-no').value, date: document.getElementById('cust-date').value, paymentTerms: document.getElementById('cust-payment').value, priceTerms: document.getElementById('cust-price-terms').value, loadingTime: document.getElementById('cust-loading-time').value, loadingPort: document.getElementById('cust-loading-port').value, destPort: document.getElementById('cust-dest-port').value, shippingMethod: document.getElementById('cust-ship-method').value, shippingMark: document.getElementById('cust-ship-mark').value, totalAmountEn: document.getElementById('cust-total-en').value, items: items }; saveDB(); if(typeof renderCustomsExport==='function') renderCustomsExport(); if(typeof renderCustomsImport==='function') renderCustomsImport(); closeModal('modal-customs-edit'); alert('清关及外销单据编辑已保存！'); }
function openDeclModal(orderId) { const order = db.orders.find(o => o.id === orderId); if (!order) return; const dd = typeof getDeclData==='function' ? getDeclData(order) : {}; document.getElementById('decl-order-id').value = order.id; document.getElementById('decl-port').value = dd.port||''; document.getElementById('decl-shipper').value = dd.shipper||''; document.getElementById('decl-consignee').value = dd.consignee||''; document.getElementById('decl-country').value = dd.country||''; document.getElementById('decl-trade-terms').value = dd.tradeTerms||''; document.getElementById('decl-items-table-body').innerHTML = (dd.items||[]).map((it, idx) => `<tr><td class="text-center">${idx + 1}</td><td><input type="text" class="form-control d-hs" value="${it.hsCode}"></td><td><input type="text" class="form-control d-name" value="${it.name}"></td><td><div style="display:flex;"><input type="number" class="form-control d-qty" value="${it.qty}" oninput="calcDeclRow(this)"><input type="text" class="form-control d-unit" value="${it.unit}" style="width:50px;margin-left:4px;"></div></td><td><input type="number" step="0.01" class="form-control d-price" value="${it.price}" oninput="calcDeclRow(this)"></td><td><input type="number" step="0.01" class="form-control d-total" value="${it.total}"></td></tr>`).join(''); openModal('modal-decl-edit'); }
function calcDeclRow(el) { const tr = el.closest('tr'); const qty = Number(tr.querySelector('.d-qty').value || 0); const price = Number(tr.querySelector('.d-price').value || 0); tr.querySelector('.d-total').value = (qty * price).toFixed(2); }
function saveDeclData() { const orderId = document.getElementById('decl-order-id').value; const order = db.orders.find(o => o.id === orderId); if (!order) return; const items = Array.from(document.querySelectorAll('#decl-items-table-body tr')).map(tr => ({ hsCode: tr.querySelector('.d-hs').value, name: tr.querySelector('.d-name').value, qty: Number(tr.querySelector('.d-qty').value || 0), unit: tr.querySelector('.d-unit').value, price: Number(tr.querySelector('.d-price').value || 0), total: Number(tr.querySelector('.d-total').value || 0) })); order.declData = { port: document.getElementById('decl-port').value, shipper: document.getElementById('decl-shipper').value, consignee: document.getElementById('decl-consignee').value, country: document.getElementById('decl-country').value, tradeTerms: document.getElementById('decl-trade-terms').value, items: items }; saveDB(); if(typeof renderCustomsDecl==='function') renderCustomsDecl(); closeModal('modal-decl-edit'); alert('报关单草单数据已保存！'); }
function openSampleModal(id = null) { document.getElementById('smp-client-select').innerHTML = db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); if (id) { const s = db.samples.find(x => x.id === id); document.getElementById('sample-edit-id').value = s.id; document.getElementById('smp-no').value = s.sampleNo; document.getElementById('smp-date').value = s.date; document.getElementById('smp-client-select').value = s.clientId; document.getElementById('smp-model').value = s.model; document.getElementById('smp-courier').value = s.courier; document.getElementById('smp-tracking').value = s.tracking; document.getElementById('smp-fee').value = s.fee; document.getElementById('smp-status').value = s.status; } else { document.getElementById('sample-edit-id').value = ''; document.getElementById('smp-no').value = 'SMP-' + new Date().getFullYear() + '-' + String(db.samples.length + 1).padStart(3, '0'); document.getElementById('smp-date').value = new Date().toISOString().split('T')[0]; document.getElementById('smp-model').value = ''; document.getElementById('smp-courier').value = 'DHL'; document.getElementById('smp-tracking').value = ''; document.getElementById('smp-fee').value = 0; } openModal('modal-sample'); }
function saveSampleData() { const editId = document.getElementById('sample-edit-id').value; const obj = { id: editId || ('smp-' + Date.now()), sampleNo: document.getElementById('smp-no').value, date: document.getElementById('smp-date').value, clientId: document.getElementById('smp-client-select').value, model: document.getElementById('smp-model').value, courier: document.getElementById('smp-courier').value, tracking: document.getElementById('smp-tracking').value, fee: Number(document.getElementById('smp-fee').value || 0), status: document.getElementById('smp-status').value }; if (editId) { const idx = db.samples.findIndex(x => x.id === editId); if (idx >= 0) db.samples[idx] = obj; else db.samples.push(obj); } else db.samples.unshift(obj); saveDB(); if(typeof renderSamples==='function') renderSamples(); closeModal('modal-sample'); }
function deleteSample(id) { if (confirm('确定删除吗？')) { db.samples = db.samples.filter(x => x.id !== id); saveDB(); if(typeof renderSamples==='function') renderSamples(); } }
function openQcModal() { document.getElementById('qc-order-select').innerHTML = db.orders.map(o => `<option value="${o.id}">${o.piNumber}</option>`).join(''); document.getElementById('qc-no').value = 'QC-' + new Date().getFullYear() + '-' + String(db.qcRecords.length + 1).padStart(3, '0'); document.getElementById('qc-date').value = new Date().toISOString().split('T')[0]; document.getElementById('qc-inspector').value = 'Alex Zhang'; document.getElementById('qc-checked').value = 80; document.getElementById('qc-passed').value = 78; document.getElementById('qc-failed').value = 2; calcDefectRate(); openModal('modal-qc'); }
function calcDefectRate() { const checked = Number(document.getElementById('qc-checked').value || 0); const failed = Number(document.getElementById('qc-failed').value || 0); document.getElementById('qc-defect-rate').value = checked > 0 ? ((failed / checked) * 100).toFixed(2) + '%' : '0.00%'; }
function handleQcImg(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(evt) { document.getElementById('qc-img-preview').src = evt.target.result; document.getElementById('qc-img-preview').style.display='block'; document.getElementById('qc-img-base64').value = evt.target.result; }; reader.readAsDataURL(file); }
function saveQcData() { const obj = { id: 'qc-' + Date.now(), qcNo: document.getElementById('qc-no').value, orderId: document.getElementById('qc-order-select').value, date: document.getElementById('qc-date').value, inspector: document.getElementById('qc-inspector').value, type: document.getElementById('qc-type').value, checked: Number(document.getElementById('qc-checked').value || 0), passed: Number(document.getElementById('qc-passed').value || 0), failed: Number(document.getElementById('qc-failed').value || 0), defectRate: document.getElementById('qc-defect-rate').value, photos: document.getElementById('qc-img-base64').value || (typeof SAMPLE_IMG_SCALE !=='undefined'?SAMPLE_IMG_SCALE:''), videos: document.getElementById('qc-video-link').value, report: document.getElementById('qc-report').value, status: document.getElementById('qc-status').value }; db.qcRecords.unshift(obj); saveDB(); if(typeof renderQcRecords==='function') renderQcRecords(); closeModal('modal-qc'); }
function deleteQc(id) { if (confirm('确定删除该质检档案吗？')) { db.qcRecords = db.qcRecords.filter(x => x.id !== id); saveDB(); if(typeof renderQcRecords==='function') renderQcRecords(); } }
function viewQcReport(qcId) { const q = db.qcRecords.find(x => x.id === qcId); if (!q) return; const order = db.orders.find(o => o.id === q.orderId) || { piNumber: 'N/A' }; alert(`【QC 质量检验报告】\nQC编号: ${q.qcNo}\n关联订单: ${order.piNumber}\n验货员: ${q.inspector}\n抽检数: ${q.checked} | 合格: ${q.passed} | 不合格: ${q.failed}\n不良率: ${q.defectRate}\n检验结论: ${q.status}\n\n报告详情:\n${q.report}`); }
function openFinanceModal(id) { const o = db.orders.find(x => x.id === id); if (!o) return; document.getElementById('fin-order-id').value = o.id; document.getElementById('fin-received-usd').value = o.receivedUsd || 0; document.getElementById('fin-exchange-rate').value = o.exchangeRate || 7.20; document.getElementById('fin-purchase-cost').value = o.cnyPurchaseCost || 0; document.getElementById('fin-tax-refund-rate').value = o.taxRefundRate || 13; document.getElementById('fin-inland-freight').value = o.inlandFreight || 0; document.getElementById('fin-port-charges').value = o.portCharges || 0; document.getElementById('fin-sea-freight').value = o.seaFreightUsd || 0; openModal('modal-finance'); }
function saveFinanceData() { const o = db.orders.find(x => x.id === document.getElementById('fin-order-id').value); if (o) { o.receivedUsd = Number(document.getElementById('fin-received-usd').value || 0); o.exchangeRate = Number(document.getElementById('fin-exchange-rate').value || 7.20); o.cnyPurchaseCost = Number(document.getElementById('fin-purchase-cost').value || 0); o.taxRefundRate = Number(document.getElementById('fin-tax-refund-rate').value || 13); o.inlandFreight = Number(document.getElementById('fin-inland-freight').value || 0); o.portCharges = Number(document.getElementById('fin-port-charges').value || 0); o.seaFreightUsd = Number(document.getElementById('fin-sea-freight').value || 0); saveDB(); if(typeof renderAll==='function') renderAll(); } closeModal('modal-finance'); }

// ================== 产品库管理 (Products) ==================
function autoCalcCbm() { 
  const l = Number(document.getElementById('prod-dim-l').value || 0); 
  const w = Number(document.getElementById('prod-dim-w').value || 0); 
  const h = Number(document.getElementById('prod-dim-h').value || 0); 
  if (l > 0 && w > 0 && h > 0) {
    document.getElementById('prod-cbm').value = ((l * w * h) / 1000000).toFixed(3); 
    autoCalcContainerQty(); 
  }
}

function autoCalcContainerQty() {
  const cbm = Number(document.getElementById('prod-cbm').value || 0);
  const pcs = Number(document.getElementById('prod-pcs').value || 1);
  if(cbm > 0) {
    document.getElementById('prod-20gp').value = Math.floor(28 / cbm) * pcs + " PCS";
    document.getElementById('prod-40gp').value = Math.floor(58 / cbm) * pcs + " PCS";
    document.getElementById('prod-40hq').value = Math.floor(68 / cbm) * pcs + " PCS";
  }
}

function handleProductImg(e) { 
  const file = e.target.files[0]; 
  if (!file) return; 
  const reader = new FileReader(); 
  reader.onload = function(evt) { 
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 400; 
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('prod-img-preview').src = compressedBase64; 
      document.getElementById('prod-img-base64').value = compressedBase64; 
    };
    img.src = evt.target.result;
  }; 
  reader.readAsDataURL(file); 
}

function openProductModal(id = null) {
  document.getElementById('prod-supplier').innerHTML = '<option value="">-- 选择供应商工厂 --</option>' + db.suppliers.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');
  if (id) {
    const p = db.products.find(x => x.id === id); 
    document.getElementById('modal-product-title').textContent = '编辑产品'; 
    document.getElementById('prod-id').value = p.id; 
    document.getElementById('prod-model').value = p.model || ''; 
    document.getElementById('prod-hscode').value = p.hsCode || ''; 
    document.getElementById('prod-supplier').value = p.supplierId || ''; 
    document.getElementById('prod-name-en').value = p.nameEn || ''; 
    document.getElementById('prod-name-cn').value = p.nameCn || ''; 
    document.getElementById('prod-spec').value = p.spec || ''; 
    document.getElementById('prod-dim-l-net').value = p.prodDimL || '';
    document.getElementById('prod-dim-w-net').value = p.prodDimW || '';
    document.getElementById('prod-dim-h-net').value = p.prodDimH || '';
    document.getElementById('prod-dim-l-box').value = p.boxDimL || '';
    document.getElementById('prod-dim-w-box').value = p.boxDimW || '';
    document.getElementById('prod-dim-h-box').value = p.boxDimH || '';
    document.getElementById('prod-dim-l').value = p.dimL || ''; 
    document.getElementById('prod-dim-w').value = p.dimW || ''; 
    document.getElementById('prod-dim-h').value = p.dimH || ''; 
    document.getElementById('prod-cbm').value = p.cbmPerCtn || ''; 
    document.getElementById('prod-pcs').value = p.pcsPerCtn || 1; 
    document.getElementById('prod-nw').value = p.nwPerCtn || ''; 
    document.getElementById('prod-gw').value = p.gwPerCtn || ''; 
    document.getElementById('prod-cost-cny').value = p.costCny || ''; 
    document.getElementById('prod-price-usd').value = p.priceUsd || ''; 
    document.getElementById('prod-20gp').value = p.qty20GP || '';
    document.getElementById('prod-40gp').value = p.qty40GP || '';
    document.getElementById('prod-40hq').value = p.qty40HQ || '';
    document.getElementById('prod-img-base64').value = p.img || ''; 
    document.getElementById('prod-img-preview').src = p.img || (typeof SAMPLE_IMG_SCALE !=='undefined'?SAMPLE_IMG_SCALE:''); 
  } else {
    document.getElementById('modal-product-title').textContent = '添加新产品'; 
    document.getElementById('prod-id').value = ''; 
    document.getElementById('prod-model').value = ''; 
    document.getElementById('prod-hscode').value = ''; 
    document.getElementById('prod-supplier').value = ''; 
    document.getElementById('prod-name-en').value = ''; 
    document.getElementById('prod-name-cn').value = ''; 
    document.getElementById('prod-spec').value = ''; 
    document.getElementById('prod-dim-l-net').value = '';
    document.getElementById('prod-dim-w-net').value = '';
    document.getElementById('prod-dim-h-net').value = '';
    document.getElementById('prod-dim-l-box').value = '';
    document.getElementById('prod-dim-w-box').value = '';
    document.getElementById('prod-dim-h-box').value = '';
    document.getElementById('prod-dim-l').value = ''; 
    document.getElementById('prod-dim-w').value = ''; 
    document.getElementById('prod-dim-h').value = ''; 
    document.getElementById('prod-cbm').value = ''; 
    document.getElementById('prod-pcs').value = '1'; 
    document.getElementById('prod-nw').value = ''; 
    document.getElementById('prod-gw').value = ''; 
    document.getElementById('prod-cost-cny').value = ''; 
    document.getElementById('prod-price-usd').value = ''; 
    document.getElementById('prod-20gp').value = '';
    document.getElementById('prod-40gp').value = '';
    document.getElementById('prod-40hq').value = '';
    document.getElementById('prod-img-base64').value = ''; 
    document.getElementById('prod-img-preview').src = typeof SAMPLE_IMG_SCALE !=='undefined'?SAMPLE_IMG_SCALE:''; 
  }
  openModal('modal-product');
}

function saveProductData() {
  const editId = document.getElementById('prod-id').value; 
  const model = document.getElementById('prod-model').value.trim(); 
  if (!model) return alert('请输入产品型号 (Art No.)'); 
  const obj = { 
    id: editId || ('p_' + Date.now()), 
    model: model, 
    hsCode: document.getElementById('prod-hscode').value.trim(), 
    supplierId: document.getElementById('prod-supplier').value,
    nameEn: document.getElementById('prod-name-en').value.trim(), 
    nameCn: document.getElementById('prod-name-cn').value.trim(), 
    spec: document.getElementById('prod-spec').value.trim(), 
    costCny: Number(document.getElementById('prod-cost-cny').value || 0), 
    priceUsd: Number(document.getElementById('prod-price-usd').value || 0), 
    pcsPerCtn: Number(document.getElementById('prod-pcs').value || 1), 
    nwPerCtn: Number(document.getElementById('prod-nw').value || 0), 
    gwPerCtn: Number(document.getElementById('prod-gw').value || 0), 
    prodDimL: Number(document.getElementById('prod-dim-l-net').value || 0),
    prodDimW: Number(document.getElementById('prod-dim-w-net').value || 0),
    prodDimH: Number(document.getElementById('prod-dim-h-net').value || 0),
    boxDimL: Number(document.getElementById('prod-dim-l-box').value || 0),
    boxDimW: Number(document.getElementById('prod-dim-w-box').value || 0),
    boxDimH: Number(document.getElementById('prod-dim-h-box').value || 0),
    dimL: Number(document.getElementById('prod-dim-l').value || 0), 
    dimW: Number(document.getElementById('prod-dim-w').value || 0), 
    dimH: Number(document.getElementById('prod-dim-h').value || 0), 
    cbmPerCtn: Number(document.getElementById('prod-cbm').value || 0), 
    qty20GP: document.getElementById('prod-20gp').value,
    qty40GP: document.getElementById('prod-40gp').value,
    qty40HQ: document.getElementById('prod-40hq').value,
    img: document.getElementById('prod-img-base64').value || (typeof SAMPLE_IMG_SCALE !=='undefined'?SAMPLE_IMG_SCALE:'') 
  }; 
  try {
    if (editId) { const idx = db.products.findIndex(x => x.id === editId); if (idx >= 0) db.products[idx] = obj; else db.products.push(obj); } else { db.products.push(obj); }
    saveDB(); if(typeof renderProducts==='function') renderProducts(); closeModal('modal-product'); 
  } catch (err) { alert("保存失败！可能是图片过大导致浏览器存储满了，请压缩图片后重试。"); }
}

function deleteProduct(id) { if (confirm('确定删除该产品吗？')) { db.products = db.products.filter(x => x.id !== id); saveDB(); if(typeof renderProducts==='function') renderProducts(); } }

// ================== CRM 管理 ==================
function openClientModal(id = null) { document.getElementById('client-id').value = id || ''; if (id) { const c = db.clients.find(x => x.id === id); document.getElementById('cli-name').value = c.name || ''; document.getElementById('cli-country').value = c.country || ''; document.getElementById('cli-port').value = c.destinationPort || ''; document.getElementById('cli-main-products').value = c.mainProducts || ''; document.getElementById('cli-website').value = c.website || ''; document.getElementById('cli-address').value = c.address || ''; } else { document.getElementById('cli-name').value = ''; document.getElementById('cli-country').value = ''; document.getElementById('cli-port').value = ''; document.getElementById('cli-main-products').value = ''; document.getElementById('cli-website').value = ''; document.getElementById('cli-address').value = ''; } openModal('modal-client'); }
function saveClientData() { const editId = document.getElementById('client-id').value; const name = document.getElementById('cli-name').value.trim(); if (!name) return alert('请输入客户公司英文全称'); const existing = editId ? db.clients.find(x => x.id === editId) : null; const obj = { id: editId || ('c_' + Date.now()), name: name, country: document.getElementById('cli-country').value.trim(), destinationPort: document.getElementById('cli-port').value.trim(), mainProducts: document.getElementById('cli-main-products').value.trim(), website: document.getElementById('cli-website').value.trim(), address: document.getElementById('cli-address').value.trim(), contacts: existing ? (existing.contacts || []) : [] }; if (editId) { const idx = db.clients.findIndex(x => x.id === editId); if (idx >= 0) db.clients[idx] = obj; else db.clients.push(obj); } else db.clients.push(obj); saveDB(); if(typeof renderClients==='function') renderClients(); closeModal('modal-client'); }
function deleteClient(id) { if (confirm('确定删除该客户吗？')) { db.clients = db.clients.filter(x => x.id !== id); saveDB(); if(typeof renderClients==='function') renderClients(); } }
function openSupplierModal(id = null) { document.getElementById('supplier-id').value = id || ''; if (id) { const s = db.suppliers.find(x => x.id === id); document.getElementById('sup-name').value = s.name || ''; document.getElementById('sup-city').value = s.city || ''; document.getElementById('sup-main-products').value = s.mainProducts || ''; document.getElementById('sup-address').value = s.address || ''; document.getElementById('sup-bank-name').value = s.bankName || ''; document.getElementById('sup-bank-acc').value = s.bankAccount || ''; } else { document.getElementById('sup-name').value = ''; document.getElementById('sup-city').value = ''; document.getElementById('sup-main-products').value = ''; document.getElementById('sup-address').value = ''; document.getElementById('sup-bank-name').value = ''; document.getElementById('sup-bank-acc').value = ''; } openModal('modal-supplier'); }
function saveSupplierData() { const editId = document.getElementById('supplier-id').value; const name = document.getElementById('sup-name').value.trim(); if (!name) return alert('请输入供应商名称'); const existing = editId ? db.suppliers.find(x => x.id === editId) : null; const obj = { id: editId || ('s_' + Date.now()), name: name, city: document.getElementById('sup-city').value.trim(), mainProducts: document.getElementById('sup-main-products').value.trim(), address: document.getElementById('sup-address').value.trim(), bankName: document.getElementById('sup-bank-name').value.trim(), bankAccount: document.getElementById('sup-bank-acc').value.trim(), contacts: existing ? (existing.contacts || []) : [] }; if (editId) { const idx = db.suppliers.findIndex(x => x.id === editId); if (idx >= 0) db.suppliers[idx] = obj; else db.suppliers.push(obj); } else db.suppliers.push(obj); saveDB(); if(typeof renderSuppliers==='function') renderSuppliers(); closeModal('modal-supplier'); }
function deleteSupplier(id) { if (confirm('确定删除吗？')) { db.suppliers = db.suppliers.filter(x => x.id !== id); saveDB(); if(typeof renderSuppliers==='function') renderSuppliers(); } }
function openContactsModal(type, ownerId) { document.getElementById('contact-owner-type').value = type; document.getElementById('contact-owner-id').value = ownerId; const owner = type === 'client' ? db.clients.find(x => x.id === ownerId) : db.suppliers.find(x => x.id === ownerId); document.getElementById('modal-contacts-title').textContent = `联系人管理 - ${owner?.name || ''}`; document.getElementById('ct-name').value = ''; document.getElementById('ct-title').value = ''; document.getElementById('ct-email').value = ''; document.getElementById('ct-phone').value = ''; document.getElementById('ct-im').value = ''; if(typeof renderContactsTable==='function') renderContactsTable(); openModal('modal-contacts'); }
function addContactItem() { const name = document.getElementById('ct-name').value.trim(); if (!name) return alert('请输入姓名'); const type = document.getElementById('contact-owner-type').value; const ownerId = document.getElementById('contact-owner-id').value; const owner = type === 'client' ? db.clients.find(x => x.id === ownerId) : db.suppliers.find(x => x.id === ownerId); if (!owner.contacts) owner.contacts = []; owner.contacts.push({ id: 'ct_' + Date.now(), name: name, title: document.getElementById('ct-title').value.trim(), email: document.getElementById('ct-email').value.trim(), phone: document.getElementById('ct-phone').value.trim(), im: document.getElementById('ct-im').value.trim() }); saveDB(); if(typeof renderContactsTable==='function') renderContactsTable(); if(typeof renderClients==='function') renderClients(); if(typeof renderSuppliers==='function') renderSuppliers(); }
function removeContactItem(idx) { const type = document.getElementById('contact-owner-type').value; const ownerId = document.getElementById('contact-owner-id').value; const owner = type === 'client' ? db.clients.find(x => x.id === ownerId) : db.suppliers.find(x => x.id === ownerId); owner.contacts.splice(idx, 1); saveDB(); if(typeof renderContactsTable==='function') renderContactsTable(); if(typeof renderClients==='function') renderClients(); if(typeof renderSuppliers==='function') renderSuppliers(); }

// ================== 系统设置与权限 ==================
function addSysLog(actionDetail) { const currentUser = document.getElementById('topbar-user-badge') ? document.getElementById('topbar-user-badge').innerText : 'System'; db.logs.unshift({ time: new Date().toLocaleString('zh-CN', { hour12: false }), user: currentUser, action: actionDetail }); if (db.logs.length > 50) db.logs.pop(); saveDB(); }
function saveSetCompany() { db.company.nameCn = document.getElementById('set-comp-cn').value.trim(); db.company.nameEn = document.getElementById('set-comp-en').value.trim(); db.company.addressCn = document.getElementById('set-addr-cn').value.trim(); db.company.addressEn = document.getElementById('set-addr-en').value.trim(); db.company.tel = document.getElementById('set-tel').value.trim(); db.company.email = document.getElementById('set-email').value.trim(); addSysLog('修改了企业抬头与基础资料'); if(typeof renderSettings==='function') renderSettings(); alert('企业基础资料已保存！'); }
function saveSetFinAndTemp() { db.finance.usdRate = Number(document.getElementById('set-usd-rate').value || 7.20); db.finance.taxRate = Number(document.getElementById('set-tax-rate').value || 13.0); db.templates.payment = document.getElementById('set-payment').value.trim(); db.templates.arbitration = document.getElementById('set-arbitration').value.trim(); addSysLog('更新了财税参数及条款模板'); if(typeof renderSettings==='function') renderSettings(); alert('财务参数与默认外贸条款已保存！'); }
function openBankModal(id = null) { if (id) { const b = db.banks.find(x => x.id === id); document.getElementById('modal-bank-title').innerText = '编辑收款路线'; document.getElementById('bank-edit-id').value = b.id; document.getElementById('bank-type').value = b.type || 'USD 美元付款路线'; document.getElementById('bank-name').value = b.name || ''; document.getElementById('bank-acc').value = b.account || ''; document.getElementById('bank-swift').value = b.swift || ''; document.getElementById('bank-note').value = b.note || ''; } else { document.getElementById('modal-bank-title').innerText = '添加收款路线'; document.getElementById('bank-edit-id').value = ''; document.getElementById('bank-type').value = 'USD 美元付款路线'; document.getElementById('bank-name').value = ''; document.getElementById('bank-acc').value = ''; document.getElementById('bank-swift').value = ''; document.getElementById('bank-note').value = ''; } openModal('modal-bank'); }
function saveBankData() { const editId = document.getElementById('bank-edit-id').value; const name = document.getElementById('bank-name').value.trim(); if (!name) return alert('请输入银行名称'); const obj = { id: editId || ('b_' + Date.now()), type: document.getElementById('bank-type').value, name: name, account: document.getElementById('bank-acc').value.trim(), swift: document.getElementById('bank-swift').value.trim(), note: document.getElementById('bank-note').value.trim() }; if (editId) { const idx = db.banks.findIndex(x => x.id === editId); if (idx >= 0) db.banks[idx] = obj; else db.banks.push(obj); } else { db.banks.push(obj); } addSysLog(editId ? `修改了收款路线：${obj.type}` : `新增了收款路线：${obj.type}`); saveDB(); if(typeof renderSettings==='function') renderSettings(); closeModal('modal-bank'); }
function removeSetBank(id) { if (confirm('确定删除该收款路线档案吗？')) { db.banks = db.banks.filter(x => x.id !== id); addSysLog('删除了一条收款路线记录'); saveDB(); if(typeof renderSettings==='function') renderSettings(); } }
function addSetUser() { db.users.push({ id: 'u_' + Date.now(), name: '新操作员', role: '业务员', hideCost: false, hideFactory: false }); saveDB(); if(typeof renderSettings==='function') renderSettings(); }
function removeSetUser(idx) { if (confirm('确定删除该操作员权限吗？')) { db.users.splice(idx, 1); addSysLog('删除了一个系统操作员账号'); saveDB(); if(typeof renderSettings==='function') renderSettings(); } }
function autoSaveDynamicSettings() { const userRows = document.querySelectorAll('#set-users-tbody tr'); db.users = Array.from(userRows).map(tr => ({ id: 'u_' + Math.random(), name: tr.querySelector('.u-name').value, role: tr.querySelector('.u-role').value, hideCost: tr.querySelector('.u-cost').checked, hideFactory: tr.querySelector('.u-fac').checked })); saveDB(); }
document.addEventListener('focusout', function(e) { if(e.target && e.target.classList.contains('inline-input') && e.target.closest('#set-users-tbody')) { autoSaveDynamicSettings(); } });
document.addEventListener('change', function(e) { if(e.target && (e.target.classList.contains('u-cost') || e.target.classList.contains('u-fac'))) { autoSaveDynamicSettings(); addSysLog('更改了操作员机密隔离权限'); if(typeof renderSettings==='function') renderSettings(); } });
function exportBackup() { addSysLog('执行了一键全库 JSON 导出备份'); if(typeof renderSettings==='function') renderSettings(); const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `BridgePort_OS_安全备份_${new Date().toISOString().split('T')[0]}.json`; a.click(); }
function importBackup(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(evt) { try { const imported = JSON.parse(evt.target.result); sanitizeData(imported); addSysLog('成功执行了一键全库数据恢复'); saveDB(); if(typeof renderAll==='function') renderAll(); alert('数据安全恢复成功！'); } catch(err) { alert('恢复失败，备份文件格式不正确。'); } }; reader.readAsText(file); }