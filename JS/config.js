/* =========================================
   BridgePort OS - 全局配置与常量 (config.js)
   ========================================= */

// 1. 默认的产品图片占位符 (Base64 SVG)
const SAMPLE_IMG_SCALE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' rx='8' fill='%23f8fafc'/><rect x='10' y='25' width='80' height='45' rx='4' fill='%2394a3b8'/><rect x='15' y='30' width='70' height='35' rx='2' fill='%23e2e8f0'/><text x='50' y='50' font-size='12' fill='white' text-anchor='middle'>IMG</text></svg>";

// 2. 报价单 (Quotation) 默认备注条款
const DEFAULT_QUOTE_REMARK = `REMARK:
1.THE PRICE ARE BASED ON CURRENT COST OF RAW MATERIAL AND CURRENT EXCHANGE RATE.
2. MOQ is 20GP CONTIANER`;

// 3. PI 与商业合同通用的国际仲裁条款
const ARBITRATION_TEXT = "All disputes arising from the execution of, or in connection with this contract, shall be settled amicably through friendly negotiation. In case no settlement can be reached, the dispute shall be submitted to the China International Economic and Trade Arbitration Commission (CIETAC) for arbitration in accordance with its rules of arbitration in effect at the time of applying. The arbitral award is final and binding upon both parties.";