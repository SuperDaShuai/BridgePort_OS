/* =========================================
   BridgePort OS - 单据打印与 Excel 导出 (export.js)
   ========================================= */

// ================== 生成预览 HTML 单据 ==================
function generateAndShowDoc(docType, id) {
  activeExportData = { docType, id };
  const container = document.getElementById('print-modal-area');
  const modalTitle = document.getElementById('print-view-modal-title');

  const order = db.orders.find(x => x.id === id);
  if (!order && docType !== 'quotation') return; 
  
  if (docType === 'quotation') {
    const q = db.quotes.find(x => x.id === id);
    if (!q) return;
    const client = db.clients.find(c => c.id === q.clientId) || {};
    const primaryContact = (client.contacts && client.contacts.length > 0) ? client.contacts[0] : {};
    const totalAmount = q.items.reduce((s, it) => s + (it.qty * it.price), 0);
    const currSign = q.currency === 'RMB' ? '¥' : '$';

    modalTitle.textContent = `QUOTATION - ${q.quoteNumber}`;

    container.innerHTML = `
      <div style="padding-bottom: 10px; display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h1 style="font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#0f172a;">${db.company.nameEn}</h1>
          <p style="font-size:12px; font-weight:bold; color:#334155;">${db.company.nameCn}</p>
          <p style="font-size:10px; color:#64748b; margin-top:2px;">${db.company.addressEn}</p>
          <p style="font-size:10px; color:#64748b;">TEL: ${db.company.tel} | EMAIL: ${db.company.email}</p>
        </div>
        <div style="text-align:right; font-size:10px; color:#64748b;">
          <div>DATE: ${q.quoteDate}</div>
          <div>VALIDITY: ${q.validUntil || '-'}</div>
        </div>
      </div>

      <div class="doc-title-section">
        <span class="doc-badge-title">QUOTATION</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:12px; font-size:11px;">
        <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px;">
          <strong>TO:</strong><br>
          <strong>${client.name || ''}</strong><br>${client.address || ''}<br>
          Attn: ${primaryContact.name || ''} | Tel: ${primaryContact.phone || ''}
        </div>
        <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
          <strong>QUOTATION NO.:</strong> ${q.quoteNumber}<br>
          <strong>PRICE TERMS:</strong> ${q.tradeTerms} ${q.loadingPort}<br>
          <strong>LEAD TIME:</strong> ${q.leadTime || '25-30 days'}<br>
          <strong>PAYMENT TERMS:</strong> ${q.paymentTerms || '30% T/T'}<br>
          <strong>DESTINATION:</strong> ${q.destinationPort || '-'}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:30px; text-align:center;">No.</th>
            <th style="width:11%; text-align:center;">Art No.</th>
            <th style="width:90px; text-align:center;">Photo</th>
            <th style="width:28%; text-align:center;">Product Name & Spec</th>
            <th style="width:14%; text-align:center;">Packing</th>
            <th style="width:12%; text-align:center;">Price (${q.currency})</th>
            <th style="width:9%; text-align:center;">MOQ</th>
            <th style="width:12%; text-align:center;">Load Qty</th>
          </tr>
        </thead>
        <tbody>
          ${q.items.map((it, idx) => {
            const cont = typeof calcContainerQty==='function' ? calcContainerQty(it.cbmPerCtn, it.pcsPerCtn) : {qty20:'-', qty40hq:'-'};
            return `
              <tr>
                <td style="text-align:center;">${idx + 1}</td>
                <td><strong>${it.model}</strong></td>
                <td style="text-align:center;">${it.img ? `<img src="${it.img}" style="width:80px;height:80px;object-fit:contain;border-radius:2px;display:block;margin:0 auto;">` : '-'}</td>
                <td style="line-height:1.4;"><strong>${it.nameEn}</strong>${it.spec ? `<br><span style="font-size:9.5px; color:#475569; white-space:pre-wrap;">${it.spec}</span>` : ''}</td>
                <td style="font-size:10px; color:#475569; white-space:pre-line;">${it.packing || 'Standard'}</td>
                <td style="text-align:right; font-weight:bold;">${currSign}${typeof fmt==='function'?fmt(it.price):it.price}</td>
                <td style="text-align:right;">${it.qty} PCS</td>
                <td style="font-size:9px; color:#1e40af; text-align:center;">20GP:${cont.qty20}<br>40HQ:${cont.qty40hq}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:bold; background:#f8fafc;">
            <td colspan="6" style="text-align:right;">TOTAL AMOUNT (${q.currency}):</td>
            <td style="text-align:right; color:#059669;">${currSign}${typeof fmt==='function'?fmt(totalAmount):totalAmount}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:15px; background:#f8fafc; border:1px solid #e2e8f0; padding:10px; border-radius:4px; font-size:10px; font-family:monospace; line-height:1.5; white-space:pre-wrap;">${q.remark || ''}</div>
      <div style="margin-top:20px; display:flex; justify-content:space-between; font-size:11px;">
        <div><p><strong>PREPARED BY:</strong> ${db.company.nameEn}</p></div>
        <div style="text-align:right;"><p><strong>AUTHORIZED SIGNATURE:</strong></p><div style="margin-top:30px; border-bottom:1px solid #94a3b8; width:160px; display:inline-block;"></div></div>
      </div>
    `;
    openModal('modal-print-view');
    return;
  }

  const client = db.clients.find(c => c.id === order.clientId) || {};
  const supplier = db.suppliers.find(s => s.id === order.supplierId) || {};
  const primaryClientContact = (client.contacts && client.contacts.length > 0) ? client.contacts[0] : {};
  const totals = typeof getOrderTotals==='function'?getOrderTotals(order):{ctns:0, cbm:0, gw:0, qty:0, amount:0};
  const currSign = order.currency === 'RMB' ? '¥' : '$';

  let selectedBank = db.banks.find(b => b.id === order.bankId);
  if (!selectedBank) {
      selectedBank = db.banks[0] || { name: db.company.bankName, account: db.company.bankAccount, swift: db.company.swiftCode, note: '' };
  }

  const cd = typeof getCustomsData==='function'?getCustomsData(order):{};
  const dd = typeof getDeclData==='function'?getDeclData(order):{};
  const docClient = db.clients.find(c => c.id === cd.clientId) || client;

  let headerTitle = 'DOCUMENT';
  if (docType === 'pi') headerTitle = 'PROFORMA INVOICE';
  if (docType === 'purchase_contract') headerTitle = '购 销 合 同';
  if (docType === 'po') headerTitle = 'PRODUCTION ORDER (PO)';
  if (docType === 'booking') headerTitle = 'SHIPPING ORDER (S/O)';
  if (docType === 'customs_decl') headerTitle = 'DECLARATION DRAFT';
  if (docType.includes('inv')) headerTitle = 'COMMERCIAL INVOICE';
  if (docType.includes('cont')) headerTitle = 'SALES CONTRACT';
  if (docType.includes('pl')) headerTitle = 'PACKING LIST';

  modalTitle.textContent = `${headerTitle} - ${order.piNumber}`;

  let docHeader = `
    <div style="padding-bottom: 10px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h1 style="font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#0f172a;">${db.company.nameEn}</h1>
        <p style="font-size:12px; font-weight:bold; color:#334155;">${db.company.nameCn}</p>
        <p style="font-size:10px; color:#64748b; margin-top:2px;">${db.company.addressEn}</p>
        <p style="font-size:10px; color:#64748b;">TEL: ${db.company.tel} | EMAIL: ${db.company.email}</p>
      </div>
      <div style="text-align:right; font-size:10px; color:#64748b;">
        <div>DATE: ${cd.date}</div>
        <div>REF: ${order.piNumber}</div>
      </div>
    </div>
    <div class="doc-title-section"><span class="doc-badge-title">${headerTitle}</span></div>
  `;

  if (docType === 'pi') {
    const totalWords = typeof numberToEnglishWords==='function'?numberToEnglishWords(totals.amount):'';
    container.innerHTML = docHeader + `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:12px; font-size:11px;">
        <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px;">
          <strong>BUYER / CONSIGNEE:</strong><br>
          <strong>${client.name || ''}</strong><br>${client.address || ''}<br>
          Attn: ${primaryClientContact.name || ''} | Tel: ${primaryClientContact.phone || ''}
        </div>
        <div style="border:1px solid #cbd5e1; padding:8px; border-radius:4px; line-height:1.6;">
          <strong>PI NO.:</strong> ${order.piNumber}<br>
          <strong>TRADE TERMS:</strong> ${order.tradeTerms} ${order.loadingPort}<br>
          <strong>DESTINATION PORT:</strong> ${order.destinationPort}<br>
          <strong>PAYMENT TERMS:</strong> ${order.paymentTerms}<br>
          <strong>ESTIMATED DELIVERY:</strong> ${order.deliveryDate || 'Within 30 days'}
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px; text-align:center;">NO.</th>
          <th style="width:9%; text-align:center;">Art No.</th>
          <th style="width:90px; text-align:center;">Photo</th>
          <th style="width:30%; text-align:center;">Product Name & Specification</th>
          <th style="width:8%; text-align:center;">PCS/CTN</th>
          <th style="width:8%; text-align:center;">CTNS</th>
          <th style="width:10%; text-align:center;">Total Qty (pcs)</th>
          <th style="width:10%; text-align:center;">Price</th>
          <th style="width:12%; text-align:center;">Amount</th>
        </tr></thead>
        <tbody>
          ${order.items.map((it, idx) => `<tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${it.model}</strong></td>
            <td style="text-align:center; padding:4px;">${it.img ? `<img src="${it.img}" style="width:80px;height:80px;object-fit:contain;display:block;margin:0 auto;">` : '-'}</td>
            <td style="line-height:1.4;"><strong>${it.nameEn}</strong>${it.spec ? `<br><span style="font-size:9.5px; color:#475569; white-space:pre-wrap;">${it.spec}</span>` : ''}</td>
            <td style="text-align:center;">${it.pcsPerCtn}</td>
            <td style="text-align:center;">${it.ctns}</td>
            <td style="text-align:right; font-weight:bold;">${it.qty}</td>
            <td style="text-align:right;">${currSign}${typeof fmt==='function'?fmt(it.price):it.price}</td>
            <td style="text-align:right; font-weight:bold;">${currSign}${typeof fmt==='function'?fmt(it.qty * it.price):it.qty*it.price}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="font-weight:bold; background:#f8fafc;"><td colspan="5" style="text-align:right;">TOTAL:</td><td style="text-align:center;">${totals.ctns}</td><td style="text-align:right;">${totals.qty}</td><td></td><td style="text-align:right; color:#059669;">${currSign}${typeof fmt==='function'?fmt(totals.amount):totals.amount}</td></tr></tfoot>
      </table>
      
      <div style="margin-top:6px; font-weight:bold; font-size:10px;">
        ${order.currency === 'RMB' ? 'SAY TOTAL CHINESE YUAN ' : 'SAY TOTAL US DOLLARS '}${totalWords} ONLY
      </div>
      
      <div style="margin-top:12px; font-size:11px; line-height:1.8;">
        <div><strong>TOTAL PACKAGES:</strong> ${totals.ctns} CARTONS</div><div><strong>TOTAL MEASUREMENT:</strong> ${totals.cbm} CBM</div><div><strong>TOTAL GROSS WEIGHT:</strong> ${totals.gw} KGS</div>
      </div>
      
      ${order.showSpecialReq && order.specialReq ? `<div style="margin-top:12px; font-size:10.5px; line-height:1.5;"><div style="font-weight:bold; margin-bottom:4px; color:var(--primary);">SPECIAL REQUIREMENTS:</div><div style="white-space:pre-wrap; color:#334155;">${order.specialReq}</div></div>` : ''}
      
      <div style="margin-top:16px; font-size:11px; border-top:1px solid #e2e8f0; padding-top:12px;">
        <div style="padding-bottom:8px;">
          <strong>BENEFICIARY BANK DETAILS:</strong><br>
          Bank Name: ${selectedBank.name}<br>
          Account No: ${selectedBank.account}<br>
          Swift Code: ${selectedBank.swift || '-'}<br>
          ${selectedBank.note ? `Routing / Beneficiary: ${selectedBank.note}` : `Beneficiary: ${db.company.nameEn}`}
        </div>
      </div>
      
      <div style="margin-top:12px; font-size:9.5px; color:#475569; line-height:1.4;">
        <strong>ARBITRATION CLAUSE:</strong><br>${typeof ARBITRATION_TEXT!=='undefined'?ARBITRATION_TEXT:''}
      </div>
      
      <div style="margin-top:40px; display:flex; justify-content:space-between; font-size:11px;">
        <div style="text-align:left;">
          <p><strong>ACCEPTED & CONFIRMED BY BUYER:</strong><br>${client.name || 'BUYER'}</p>
          <div style="margin-top:35px; border-bottom:1px solid #94a3b8; width:180px;"></div>
          <p style="margin-top:4px; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>
        </div>
        <div style="text-align:right;">
          <p><strong>FOR AND ON BEHALF OF SELLER:</strong><br>${db.company.nameEn}</p>
          ${order.showStamp ? `<div style="margin-top:8px; display:inline-block; border:2px solid #ef4444; color:#ef4444; padding:4px 10px; border-radius:4px; font-weight:bold; transform:rotate(-5deg);">★ BALPRIME FUTURE TRADING ★<br><span style="font-size:9px;">AUTHORIZED SIGNATURE</span></div>` : `<div style="margin-top:35px; border-bottom:1px solid #94a3b8; width:180px; display:inline-block;"></div><br><p style="margin-top:4px; color:#64748b; font-size:9px;">Authorized Signature & Chop</p>`}
        </div>
      </div>
    `;
  } else if (docType === 'purchase_contract') {
    const pc = order.purchaseContract || {}; const cnyTotal = order.cnyPurchaseCost || 0;
    container.innerHTML = `
      <div class="doc-title-section" style="margin-top:0;"><span class="doc-badge-title">购 销 合 同</span></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; font-size:11px;"><div><strong>需方（买方）：</strong>${db.company.nameCn}</div><div><strong>合同编号：</strong>${pc.contractNo || (order.piNumber + '-CG')}</div><div><strong>供方（卖方）：</strong>${supplier.name || '供方工厂'}</div><div><strong>签订日期：</strong>${pc.signDate || order.orderDate}</div><div><strong>交货地点：</strong>${pc.deliveryLocation || '送至买方指定出口监管仓库'}</div><div><strong>交货期限：</strong>${pc.deliveryDeadline || '合同签订后30天内'}</div></div>
      <table>
        <thead><tr><th style="width:35px; text-align:center;">序号</th><th style="width:18%;">产品型号</th><th style="width:28%;">货物名称及规格</th><th style="width:12%; text-align:right;">采购数量</th><th style="width:8%; text-align:center;">单位</th><th style="width:15%; text-align:right;">含税单价(元)</th><th style="width:16%; text-align:right;">金额小计(元)</th></tr></thead>
        <tbody>${order.items.map((it, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td><strong>${it.model}</strong></td><td>${it.nameCn}</td><td style="text-align:right;">${it.qty}</td><td style="text-align:center;">${it.unit || '台'}</td><td style="text-align:right;">¥${typeof fmt==='function'?fmt(it.costCny):it.costCny}</td><td style="text-align:right; font-weight:bold;">¥${typeof fmt==='function'?fmt(it.qty * it.costCny):it.qty*it.costCny}</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:bold; background:#f8fafc;"><td colspan="3" style="text-align:right;">合计金额（小写）：</td><td style="text-align:right;">${totals.qty}</td><td></td><td></td><td style="text-align:right; color:#dc2626;">¥${typeof fmt==='function'?fmt(cnyTotal):cnyTotal}</td></tr></tfoot>
      </table>
      <div style="margin-top:8px; padding:8px 12px; background:#f8fafc; border:1px solid #cbd5e1; font-weight:bold; font-size:11px;">合计总金额（大写）：人民币 ${typeof numberToChineseRMB==='function'?numberToChineseRMB(cnyTotal):cnyTotal}</div>
      <div style="font-size:10px; margin-top:14px; line-height:1.7;"><strong>一、质量标准：</strong>${pc.qualityReq || ''}<br><strong>二、包装要求：</strong>${pc.packingReq || ''}<br><strong>三、结算方式及发票：</strong>${pc.paymentTerms || ''}<br><strong>四、违约责任：</strong>${pc.penaltyReq || ''}<br><strong>五、争议解决：</strong>${pc.disputeReq || ''}</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:25px; font-size:11px; border-top:1px solid #cbd5e1; padding-top:14px;"><div><strong>需方（盖章）：</strong>${db.company.nameCn}<br>法定代表/代理人：________________<br>开户银行：${db.company.bankName}<br>银行账号：${db.company.bankAccount}</div><div><strong>供方（盖章）：</strong>${supplier.name}<br>法定代表/代理人：________________<br>开户银行：${supplier.bankName}<br>银行账号：${supplier.bankAccount}</div></div>
    `;
  } else if (docType === 'booking') {
    const dateToday = new Date().toISOString().split('T')[0];
    const bk = order.bookingData || {};
    
    const client = db.clients.find(c => c.id === order.clientId) || {};
    const primaryClientContact = (client.contacts && client.contacts.length > 0) ? client.contacts[0] : {};
    
    const defaultShipper = `${db.company.nameEn}\n${db.company.addressEn}\nTEL: ${db.company.tel}`;
    const defaultConsignee = `${client.name || ''}\n${client.address || ''}\nATTN: ${primaryClientContact.name || ''} ${primaryClientContact.phone || ''}`;
    
    // 【核心修复】：加上 white-space:pre-wrap 确保用户手动换行的长地址能够完美折行
    const shipperHtml = (bk.shipper ? bk.shipper : defaultShipper).replace(/\n/g, '<br>');
    const consigneeHtml = (bk.consignee ? bk.consignee : defaultConsignee).replace(/\n/g, '<br>');
    
    const freightTerm = bk.freightTerm || (['FOB', 'EXW', 'FCA'].includes(order.tradeTerms) ? 'Collect' : 'Prepaid');
    const freightTermHtml = freightTerm === 'Collect' ? '[ ] Prepaid (预付) &nbsp;&nbsp;&nbsp;&nbsp; [√] Collect (到付)' : '[√] Prepaid (预付) &nbsp;&nbsp;&nbsp;&nbsp; [ ] Collect (到付)';
    
    const totals = typeof getOrderTotals === 'function' ? getOrderTotals(order) : {ctns:0, cbm:0, gw:0};
    const finalCtns = bk.ctns !== undefined && bk.ctns !== '' ? bk.ctns : totals.ctns;
    const finalGw = bk.gw !== undefined && bk.gw !== '' ? bk.gw : totals.gw;
    const finalCbm = bk.cbm !== undefined && bk.cbm !== '' ? bk.cbm : totals.cbm;
    
    const defaultDesc = order.items.map(it => `${it.nameEn} (${it.model}) - ${it.qty} PCS`).join('\n');
    const productsDescHtml = (bk.desc ? bk.desc : defaultDesc).replace(/\n/g, '<br>');

    const vessel = bk.vessel || '';
    const tradeTerms = bk.tradeTerms || order.tradeTerms || 'FOB';
    const loadingPort = bk.loadingPort || order.loadingPort || 'Ningbo, China';
    const dischargePort = bk.dischargePort || order.destinationPort || '';
    const deliveryPort = bk.deliveryPort || order.destinationPort || '';
    const blType = bk.blType || 'Original (正本提单)';
    const marks = bk.marks || 'N/M';
    const remarks = bk.remarks || 'Please arrange the earliest vessel.';

    let fclText = `- FCL (整柜): [ ${bk.qty20 ? '√' : '&nbsp;&nbsp;'} ] 20'GP x <u>&nbsp;${bk.qty20 || ' '}&nbsp;</u> &nbsp;&nbsp; [ ${bk.qty40 ? '√' : '&nbsp;&nbsp;'} ] 40'GP x <u>&nbsp;${bk.qty40 || ' '}&nbsp;</u> &nbsp;&nbsp; [ ${bk.qty40hq ? '√' : '&nbsp;&nbsp;'} ] 40'HQ x <u>&nbsp;${bk.qty40hq || ' '}&nbsp;</u><br>- LCL (拼箱): [ ${bk.isLcl ? '√' : '&nbsp;&nbsp;'} ] Yes`;
    let blText = `[ ${blType.includes('Original') ? '√' : '&nbsp;&nbsp;'} ] Original (正本提单) &nbsp;&nbsp;&nbsp;&nbsp; [ ${blType.includes('Telex') ? '√' : '&nbsp;&nbsp;'} ] Telex Release (电放提单) &nbsp;&nbsp;&nbsp;&nbsp; [ ${blType.includes('Waybill') ? '√' : '&nbsp;&nbsp;'} ] Sea Waybill (海运单)`;

    const bookingHtml = `
      <style>
        .bk-table { width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
        .bk-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; line-height: 1.5; word-break: break-word; }
        .bk-title { font-size: 18px; font-weight: bold; text-align: center; background-color: #e2e8f0; vertical-align: middle; height: 35px; }
        .bk-sec-title { background-color: #f1f5f9; font-weight: bold; font-size: 12px; }
      </style>
      <table class="bk-table" id="export-booking-table">
        <tr><td colspan="6" class="bk-title">BOOKING NOTE (海运订舱委托书)</td></tr>
        
        <tr>
          <td colspan="3" style="min-height:75px;"><strong>Shipper (发货人)</strong><br><div style="white-space: pre-wrap; margin-top:4px;">${shipperHtml}</div></td>
          <td colspan="3">
            <div style="border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:6px;"><strong>Reference No. (客户单号):</strong> ${order.piNumber}-SHP</div>
            <div><strong>Booking Date (订舱日期):</strong> ${dateToday}</div>
          </td>
        </tr>
        <tr>
          <td colspan="3" style="min-height:75px;"><strong>Consignee (收货人)</strong><br><div style="white-space: pre-wrap; margin-top:4px;">${consigneeHtml}</div></td>
          <td colspan="3"><strong>Port of Loading (起运港 - POL)</strong><br>${loadingPort}</td>
        </tr>
        <tr>
          <td colspan="3" style="min-height:60px;"><strong>Notify Party (通知人)</strong><br>SAME AS CONSIGNEE</td>
          <td colspan="3"><strong>Port of Discharge (卸货港 - POD)</strong><br>${dischargePort}</td>
        </tr>
        <tr>
          <td colspan="3"><strong>Port of Delivery (目的地 - Delivery)</strong><br>${deliveryPort}</td>
          <td colspan="3"><strong>Forwarder / Agent (代理/货代)</strong><br>Direct Booking</td>
        </tr>

        <tr><td colspan="6" class="bk-sec-title"> Route & Terms (航线及条款)</td></tr>
        <tr>
          <td colspan="2"><strong>Service Term (运输条款)</strong></td>
          <td>CY/CY</td>
          <td colspan="2"><strong>Freight Term (运费条款)</strong></td>
          <td>${freightTermHtml}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Incoterms (贸易条款)</strong></td>
          <td>${tradeTerms}</td>
          <td colspan="2"><strong>Target Vessel/Voyage (指定船期)</strong></td>
          <td>${vessel}</td>
        </tr>

        <tr><td colspan="6" class="bk-sec-title"> Cargo Details (货物详情)</td></tr>
        <tr style="text-align:center; font-weight:bold; background-color:#f8fafc;">
          <td>Marks & Nos<br>(唛头)</td>
          <td colspan="2">Description of Goods<br>(货物描述)</td>
          <td>Quantity & Pkg<br>(件数及包装)</td>
          <td>Gross Weight<br>(毛重 - KGS)</td>
          <td>Measurement<br>(体积 - CBM)</td>
        </tr>
        <tr style="text-align:center;">
          <td>${marks}</td>
          <td colspan="2" style="text-align:left; white-space: pre-wrap;">${productsDescHtml}</td>
          <td>${finalCtns} CTNS</td>
          <td>${finalGw}</td>
          <td>${finalCbm}</td>
        </tr>
        <tr style="font-weight:bold; background-color:#f8fafc;">
          <td colspan="3" style="text-align:right;">TOTAL (合计):</td>
          <td style="text-align:center;">${finalCtns} CTNS</td>
          <td style="text-align:center;">${finalGw}</td>
          <td style="text-align:center;">${finalCbm}</td>
        </tr>

        <tr><td colspan="6" class="bk-sec-title"> Equipment & Special Requirements (要求)</td></tr>
        <tr>
          <td colspan="2"><strong>Container Type & Qty<br>(柜型柜量)</strong></td>
          <td colspan="4">${fclText}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Cargo Type<br>(货物类型)</strong></td>
          <td colspan="4">[√] General Cargo (普通货物)</td>
        </tr>
        <tr>
          <td colspan="2"><strong>B/L Type<br>(出单方式)</strong></td>
          <td colspan="4">${blText}</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Remarks<br>(备注说明)</strong></td>
          <td colspan="4" style="height:60px; white-space: pre-wrap;">${remarks}</td>
        </tr>
      </table>
    `;
    container.innerHTML = bookingHtml;
    window.currentBookingHtml = bookingHtml; 
  }
  
  
  openModal('modal-print-view');
}

// ================== 导出 Excel 逻辑 ==================
function exportActiveDocToExcel() {
  if (!activeExportData) return;
  const { docType, id } = activeExportData;
  const order = db.orders.find(x => x.id === id);
  if (!order && docType !== 'quotation') return; 

  if (docType === 'booking') {
    let excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
        <style>
          table { font-family: Arial, sans-serif; font-size: 10pt; }
        </style>
      </head>
      <body>
        ${window.currentBookingHtml}
      </body>
      </html>
    `;
    downloadBlob(excelHtml, `Booking_Note_${order.piNumber}.xls`);
    return;
  }

  if (docType === 'quotation') {
    const q = db.quotes.find(x => x.id === id); if (!q) return;
    let excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table><tr><td colspan="7">QUOTATION: ${q.quoteNumber}</td></tr></table></body></html>`;
    downloadBlob(excelHtml, `Quotation_${q.quoteNumber}.xls`); return;
  }

  let excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table><tr><td colspan="7">DOC: ${order.piNumber}</td></tr></table></body></html>`;
  downloadBlob(excelHtml, `${order.piNumber}_${docType.toUpperCase()}.xls`);
}

function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; 
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}