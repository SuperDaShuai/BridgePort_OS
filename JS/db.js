/* =========================================
   BridgePort OS - 数据层 (db.js)
   ========================================= */

const DEFAULT_NODES = [
  { code: 'N01', group: 'BANK', tag: '银行收款', name: '外商定金水单到账 (USD)', role: '财务/外商', status: 'PENDING', date: '', note: '' },
  { code: 'N02', group: 'FACTORY', tag: '工厂采购', name: '向工厂支付定金 (RMB)', role: '财务/工厂', status: 'PENDING', date: '', note: '' },
  { code: 'N03', group: 'FACTORY', tag: '工厂采购', name: '工序中期质检与技术图纸锁定', role: '驻场QC', status: 'PENDING', date: '', note: '' },
  { code: 'N04', group: 'SHIP', tag: '海运订舱', name: '订舱与 3D 装箱配载确认', role: '单证/货代', status: 'PENDING', date: '', note: '' },
  { code: 'N05', group: 'FACTORY', tag: '工厂采购', name: '成品完工与出厂质量报告', role: 'QC/业务', status: 'PENDING', date: '', note: '' },
  { code: 'N06', group: 'BANK', tag: '银行收款', name: '【风控核心】外商尾款结清到账', role: '财务/外商', status: 'PENDING', date: '', note: '' },
  { code: 'N07', group: 'SHIP', tag: '海运订舱', name: '集装箱装柜与封签存证', role: '仓储/QC', status: 'PENDING', date: '', note: '' },
  { code: 'N08', group: 'SHIP', tag: '海运订舱', name: '海关申报放行与大船离港 (ETD)', role: '报关行', status: 'PENDING', date: '', note: '' },
  { code: 'N09', group: 'FACTORY', tag: '工厂采购', name: '向工厂结清采购尾款', role: '财务/工厂', status: 'PENDING', date: '', note: '' },
  { code: 'N10', group: 'TAX', tag: '国税退税', name: '取得工厂 13% 进项增值税专票并认证', role: '工厂/财务', status: 'PENDING', date: '', note: '' },
  { code: 'N11', group: 'SHIP', tag: '海运订舱', name: '正本提单寄送或向船东申请电放', role: '单证/船司', status: 'PENDING', date: '', note: '' },
  { code: 'N12', group: 'TAX', tag: '国税退税', name: '电子口岸结关数据下载与退税申报', role: '财务/税局', status: 'PENDING', date: '', note: '' },
  { code: 'N13', group: 'TAX', tag: '国税退税', name: '国税局出口退税款核准到账', role: '财务/国税', status: 'PENDING', date: '', note: '' },
  { code: 'N14', group: 'BANK', tag: '项目归档', name: '收汇/税票/杂费核销与净利润结案', role: '管理层', status: 'PENDING', date: '', note: '' }
];

let db = {
  // 企业基本抬头
  company: {
    nameEn: 'BALPRIME FUTURE TRADING CO., LIMITED', nameCn: '永康百普瑞国际贸易有限公司',
    addressEn: 'Yongkang Hardware Industrial Zone, Jinhua, Zhejiang, China', addressCn: '浙江省金华市永康市五金工业区',
    tel: '+86 579 8711 0000', email: 'sales@balprime.com'
  },
  // 核心设置参数
  finance: { usdRate: 7.20, taxRate: 13.0 },
  templates: { payment: '30% T/T Deposit, 70% Before Shipment', arbitration: 'All disputes arising from the execution of, or in connection with this contract, shall be settled amicably...' },
  banks: [
    { id: 'b1', type: 'USD 美元公账', name: 'BANK OF CHINA, YONGKANG BRANCH', account: '3883 7261 9901 0029', swift: 'BKCHCNBJ920' },
    { id: 'b2', type: 'RMB 国内公账', name: '浙江泰隆商业银行', account: '3302 9918 0001 2291', swift: '对公付款' }
  ],
  users: [
    { id: 'u1', name: 'Lynn (Admin)', role: '超级管理员', hideCost: false, hideFactory: false }
  ],
  logs: [], // 操作日志记录
  
  // 业务数据
  rfqs: [], quotes: [], samples: [], orders: [], qcRecords: [], products: [], clients: [], suppliers: []
};

let activeExportData = null;

function initSeedData() {
  db.products = [{ id: 'p1', model: 'BP-ACS-30', hsCode: '84238120', nameEn: 'Waterproof Price Computing Scale', nameCn: 'IP68防水电子计价秤', spec: 'IP68 Waterproof, 30kg/5g', costCny: 68, priceUsd: 18.5, pcsPerCtn: 4, nwPerCtn: 14, gwPerCtn: 15.5, dimL: 56, dimW: 38, dimH: 36, cbmPerCtn: 0.076, img: typeof SAMPLE_IMG_SCALE !== 'undefined' ? SAMPLE_IMG_SCALE : '' }];
  db.clients = [{ id: 'c1', name: 'GLOBAL METROLOGY INSTRUMENTS LLC', country: 'United Arab Emirates', destinationPort: 'Jebel Ali, Dubai', mainProducts: 'Commercial Scales', website: 'https://www.gmi.ae', address: 'Plot 204, Dubai, UAE', contacts: [] }];
  db.suppliers = [{ id: 's1', name: '永康市铭乐工贸有限公司', city: '浙江永康', mainProducts: '防水计价秤', address: '永康市经济开发区', bankName: '浙江永康农村商业银行', bankAccount: '2010 0001', contacts: [] }];
  db.orders = [{
    id: 'ord-101', piNumber: 'BP-2026-001', orderDate: '2026-08-18', clientId: 'c1', supplierId: 's1', currency: 'USD', tradeTerms: 'FOB', loadingPort: 'Ningbo, China', destinationPort: 'Jebel Ali, Dubai', paymentTerms: '30% T/T Deposit', deliveryDate: '2026-09-25', packaging: 'Standard Cartons', specialReq: 'Standard quality check', showSpecialReq: true, showStamp: true, status: '生产中', receivedUsd: 5000, exchangeRate: 7.22, cnyPurchaseCost: 34000, taxRefundRate: 13, inlandFreight: 1200, portCharges: 800, seaFreightUsd: 0,
    nodes: JSON.parse(JSON.stringify(DEFAULT_NODES)),
    items: [{ productId: 'p1', model: 'BP-ACS-30', nameEn: 'Waterproof Price Computing Scale', nameCn: 'IP68防水电子计价秤', spec: 'IP68 Waterproof', hsCode: '84238120', pcsPerCtn: 4, ctns: 125, qty: 500, unit: '台', price: 18.5, costCny: 68, nwPerCtn: 14, gwPerCtn: 15.5, cbmPerCtn: 0.076, img: typeof SAMPLE_IMG_SCALE !== 'undefined' ? SAMPLE_IMG_SCALE : '' }]
  }];
}

function sanitizeData(raw) {
  if (!raw || typeof raw !== 'object') { initSeedData(); return; }
  db.company = Object.assign({ nameEn: '', nameCn: '', addressEn: '', addressCn: '', tel: '', email: '' }, raw.company);
  db.finance = Object.assign({ usdRate: 7.20, taxRate: 13.0 }, raw.finance);
  db.templates = Object.assign({ payment: '', arbitration: '' }, raw.templates);
  db.banks = Array.isArray(raw.banks) ? raw.banks : [];
  db.users = Array.isArray(raw.users) ? raw.users : [{ id: 'u1', name: 'Lynn (Admin)', role: '超级管理员', hideCost: false, hideFactory: false }];
  db.logs = Array.isArray(raw.logs) ? raw.logs : [];
  db.rfqs = Array.isArray(raw.rfqs) ? raw.rfqs : [];
  db.quotes = Array.isArray(raw.quotes) ? raw.quotes : [];
  db.samples = Array.isArray(raw.samples) ? raw.samples : [];
  db.orders = Array.isArray(raw.orders) ? raw.orders : [];
  db.qcRecords = Array.isArray(raw.qcRecords) ? raw.qcRecords : [];
  db.products = Array.isArray(raw.products) ? raw.products : [];
  db.clients = Array.isArray(raw.clients) ? raw.clients : [];
  db.suppliers = Array.isArray(raw.suppliers) ? raw.suppliers : [];

  db.orders.forEach(o => { if (!o.nodes) o.nodes = JSON.parse(JSON.stringify(DEFAULT_NODES)); });
}

function loadDB() {
  try { 
    let stored = localStorage.getItem('BRIDGEPORT_OS_V16_3'); 
    if (!stored) stored = localStorage.getItem('BRIDGEPORT_OS_V16_2');
    if (!stored) stored = localStorage.getItem('BRIDGEPORT_OS_V16');
    
    if (stored) { 
      let parsedData = JSON.parse(stored);
      if (!parsedData.orders || parsedData.orders.length === 0) initSeedData();
      else sanitizeData(parsedData); 
    } else initSeedData(); 
  } catch (e) { initSeedData(); }
  saveDB();
  if (typeof renderAll === 'function') renderAll(); 
}

function saveDB() { localStorage.setItem('BRIDGEPORT_OS_V16_3', JSON.stringify(db)); }