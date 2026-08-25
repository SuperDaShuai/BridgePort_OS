/* =========================================
   BridgePort OS - 工具函数与核心算法 (utils.js)
   ========================================= */

// 1. 人民币金额转中文大写
function numberToChineseRMB(n) {
  if (isNaN(n) || n === null || n === '') return '零元整';
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
  let head = n < 0 ? '欠' : ''; 
  n = Math.abs(n); 
  let s = '';
  for (let i = 0; i < fraction.length; i++) { 
    s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, ''); 
  }
  s = s || '整'; 
  n = Math.floor(n);
  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = '';
    for (let j = 0; j < unit[1].length && n > 0; j++) { 
      p = digit[n % 10] + unit[1][j] + p; 
      n = Math.floor(n / 10); 
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }
  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
}

// 2. 美金金额转英文大写
function numberToEnglishWords(num) {
  if (isNaN(num)) return '';
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'OVERFLOW';
    let nArray = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArray) return ''; 
    let str = '';
    str += (nArray[1] != 0) ? (a[Number(nArray[1])] || b[nArray[1][0]] + ' ' + a[nArray[1][1]]) + 'CRORE ' : '';
    str += (nArray[2] != 0) ? (a[Number(nArray[2])] || b[nArray[2][0]] + ' ' + a[nArray[2][1]]) + 'LAKH ' : '';
    str += (nArray[3] != 0) ? (a[Number(nArray[3])] || b[nArray[3][0]] + ' ' + a[nArray[3][1]]) + 'THOUSAND ' : '';
    str += (nArray[4] != 0) ? (a[Number(nArray[4])] || b[nArray[4][0]] + ' ' + a[nArray[4][1]]) + 'HUNDRED ' : '';
    str += (nArray[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(nArray[5])] || b[nArray[5][0]] + ' ' + a[nArray[5][1]]) : '';
    return str.trim();
  }
  const parts = Number(num || 0).toFixed(2).split('.');
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);
  let words = inWords(integerPart); 
  if (!words) words = 'ZERO';
  let result = words; 
  if (decimalPart > 0) result += ` AND CENTS ${inWords(decimalPart)}`;
  return result;
}

// 3. 数字格式化 (保留两位小数，千分位逗号)
function fmt(n) { 
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
}

// 4. 核心订单数据计算：汇总数量、金额、箱数、毛重、净重、体积
function getOrderTotals(order) {
  let qty = 0, amount = 0, ctns = 0, nw = 0, gw = 0, cbm = 0;
  (order.items || []).forEach(it => {
    const q = Number(it.qty || 0); 
    const p = Number(it.price || 0); 
    const itemCtns = Number(it.ctns || Math.ceil(q / (it.pcsPerCtn || 1)));
    qty += q; 
    amount += q * p; 
    ctns += itemCtns; 
    nw += itemCtns * Number(it.nwPerCtn || 0); 
    gw += itemCtns * Number(it.gwPerCtn || 0); 
    cbm += itemCtns * Number(it.cbmPerCtn || 0);
  });
  return { 
    qty, 
    amount, 
    usd: amount, 
    ctns, 
    nw: nw.toFixed(1), 
    gw: gw.toFixed(1), 
    cbm: cbm.toFixed(3) 
  };
}

// 5. 测算国税退税额
function calcTaxRefund(order) { 
  return (Number(order.cnyPurchaseCost || 0) / 1.13) * (Number(order.taxRefundRate || 13) / 100); 
}

// 6. 测算订单综合毛利润
function calcOrderProfit(order) {
  const totals = getOrderTotals(order); 
  const rate = Number(order.exchangeRate || 7.20);
  const incomeCny = (order.currency === 'RMB' ? totals.amount : ((Number(order.receivedUsd) || totals.amount) * rate));
  const refund = calcTaxRefund(order);
  return incomeCny + refund - Number(order.cnyPurchaseCost || 0) - Number(order.inlandFreight || 0) - Number(order.portCharges || 0) - (Number(order.seaFreightUsd || 0) * rate);
}

// 7. LoadMaster 智能装柜/拼柜测算
function calcContainerQty(cbmPerCtn, pcsPerCtn) {
  const cbm = Number(cbmPerCtn || 0.05); 
  const pcs = Number(pcsPerCtn || 1);
  if (cbm <= 0) return { qty20: '-', qty40: '-', qty40hq: '-' };
  return { 
    qty20: (Math.floor(28 / cbm) * pcs).toLocaleString() + ' PCS', 
    qty40: (Math.floor(58 / cbm) * pcs).toLocaleString() + ' PCS', 
    qty40hq: (Math.floor(68 / cbm) * pcs).toLocaleString() + ' PCS' 
  };
}

// 8. 构造用于外销和清关的聚合数据对象
function getCustomsData(o) {
  if (o.customsData) return o.customsData;
  const client = db.clients.find(c => c.id === o.clientId) || {};
  const totals = getOrderTotals(o);
  return {
    clientId: o.clientId,
    scNo: o.piNumber + '-SC',
    invNo: o.piNumber + '-INV',
    date: o.orderDate,
    paymentTerms: o.paymentTerms || '',
    priceTerms: o.tradeTerms || 'FOB',
    loadingTime: o.deliveryDate || '',
    loadingPort: o.loadingPort || '',
    destPort: o.destinationPort || '',
    shippingMethod: 'BY SEA',
    shippingMark: 'N/M',
    totalAmountEn: 'SAY TOTAL US DOLLARS ' + numberToEnglishWords(totals.amount) + ' ONLY',
    items: (o.items || []).map(it => ({
      product: it.nameEn + ' (' + it.model + ')',
      qty: it.qty,
      ctn: Math.ceil(it.qty / (it.pcsPerCtn || 1)),
      nw: Math.ceil(it.qty / (it.pcsPerCtn || 1)) * (it.nwPerCtn || 10),
      gw: Math.ceil(it.qty / (it.pcsPerCtn || 1)) * (it.gwPerCtn || 12),
      cbm: (Math.ceil(it.qty / (it.pcsPerCtn || 1)) * (it.cbmPerCtn || 0.05)).toFixed(3),
      shippingMark: 'N/M',
      price: it.price || 0,
      total: it.qty * (it.price || 0)
    }))
  };
}

// 9. 构造出口报关单草单据数据对象
function getDeclData(o) {
  if (o.declData) return o.declData;
  const client = db.clients.find(c => c.id === o.clientId) || {};
  return {
    port: o.loadingPort || '',
    shipper: db.company.nameCn,
    consignee: client.name || '',
    country: client.country || '',
    tradeTerms: o.tradeTerms || 'FOB',
    items: (o.items || []).map(it => ({
      hsCode: it.hsCode,
      name: it.nameCn + ' (型号: ' + it.model + ')',
      qty: it.qty,
      unit: it.unit || '台',
      price: it.price || 0,
      total: it.qty * (it.price || 0)
    }))
  };
}