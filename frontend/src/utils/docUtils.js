// 单据生成共享工具函数
import { ElMessage } from 'element-plus'

// 人民币金额转中文大写
export function numberToChineseRMB(n) {
  if (isNaN(n) || n === null || n === '') return '零元整'
  const fraction = ['角', '分']
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']]
  let head = n < 0 ? '欠' : ''
  n = Math.abs(n)
  let s = ''
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '')
  }
  s = s || '整'
  n = Math.floor(n)
  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = ''
    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p
      n = Math.floor(n / 10)
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s
  }
  return head + s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整')
}

// 金额转英文大写
export function numberToEnglishWords(num) {
  if (isNaN(num)) return ''
  const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN ']
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  function inWords(n) {
    if ((n = n.toString()).length > 9) return 'OVERFLOW'
    let nArray = ('000000000' + n).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
    if (!nArray) return ''
    let str = ''
    str += (nArray[1] != 0) ? (a[Number(nArray[1])] || b[nArray[1][0]] + ' ' + a[nArray[1][1]]) + 'CRORE ' : ''
    str += (nArray[2] != 0) ? (a[Number(nArray[2])] || b[nArray[2][0]] + ' ' + a[nArray[2][1]]) + 'LAKH ' : ''
    str += (nArray[3] != 0) ? (a[Number(nArray[3])] || b[nArray[3][0]] + ' ' + a[nArray[3][1]]) + 'THOUSAND ' : ''
    str += (nArray[4] != 0) ? (a[Number(nArray[4])] || b[nArray[4][0]] + ' ' + a[nArray[4][1]]) + 'HUNDRED ' : ''
    str += (nArray[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(nArray[5])] || b[nArray[5][0]] + ' ' + a[nArray[5][1]]) : ''
    return str.trim()
  }
  const parts = Number(num || 0).toFixed(2).split('.')
  const integerPart = parseInt(parts[0], 10)
  const decimalPart = parseInt(parts[1], 10)
  let words = inWords(integerPart)
  if (!words) words = 'ZERO'
  let result = words
  if (decimalPart > 0) result += ` AND CENTS ${inWords(decimalPart)}`
  return result
}

// 金额格式化（千分位 + 两位小数）
export function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 订单汇总计算
export function getOrderTotals(order) {
  let qty = 0, amount = 0, ctns = 0, nw = 0, gw = 0, cbm = 0
  ;(order.items || []).forEach(it => {
    const q = Number(it.qty || 0)           // 报价单 MOQ（订单场景 qty = MOQ）
    const p = Number(it.price || 0)
    const pcs = Number(it.pcs_per_ctn || 1) // 件/箱
    // 件数 = MOQ ÷ 件/箱（与 groupItemsByHs 保持一致）
    const itemCtns = pcs > 0 ? q / pcs : 0
    qty += q
    amount += q * p
    ctns += itemCtns
    nw += itemCtns * Number(it.nw_per_ctn || 0)
    gw += itemCtns * Number(it.gw_per_ctn || 0)
    cbm += itemCtns * Number(it.cbm_per_ctn || 0)
  })
  return { qty, amount, ctns: Number(ctns.toFixed(2)), nw: Number(nw.toFixed(2)), gw: Number(gw.toFixed(2)), cbm: Number(cbm.toFixed(3)) }
}

// 通用打印函数
export function printDocument(html, title) {
  const win = window.open('', '_blank', 'width=1200,height=900')
  if (!win) {
    ElMessage.error('弹窗被浏览器拦截，请允许弹出窗口后重试')
    return
  }
  win.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; }
      .doc-page { padding: 35px 40px; font-size: 11px; color: #0f172a; line-height: 1.5; }
      .doc-page table { font-size: 11px; margin: 10px 0; width: 100%; border-collapse: collapse; }
      .doc-page th, .doc-page td { border: 1px solid #cbd5e1; padding: 6px 8px; }
      .doc-page th { background: #f8fafc; }
      .doc-badge-title { font-size: 15pt; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; }
      .doc-title-section { text-align: center; margin: 12px 0; padding: 8px 0; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
      img { max-width: 100%; }
      @media print { body { margin: 0; } }
    </style></head><body>${html}</body></html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

// 通用 Excel 导出
export function exportExcel(html, filename) {
  const excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>${html}</body></html>`
  const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
