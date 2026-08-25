/* =========================================
   BridgePort OS - 系统入口与全局导航 (main.js)
   ========================================= */

// 1. 全局菜单与页面切换逻辑 (修复缺失的部分)
function switchNav(navKey, ev) {
  // 隐藏所有页面面板
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  // 移除所有菜单的高亮状态
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  
  // 显示目标面板
  const targetPane = document.getElementById('pane-' + navKey); 
  if (targetPane) targetPane.classList.add('active');
  
  // 高亮当前点击的菜单项
  const btn = ev ? ev.currentTarget : document.querySelector(`.nav-item button[onclick*="'${navKey}'"]`); 
  if (btn) btn.classList.add('active');
  
  // 切换页面时，按需触发特定的渲染函数刷新数据
  if (navKey === 'dashboard') renderDashboard();
  if (navKey === 'orders_workbench') renderWorkbench();
  if (navKey === 'loadmaster') renderLoadMaster();
  if (navKey === 'analytics') renderAnalytics();
  if (navKey === 'customs_decl') renderCustomsDecl();
  if (navKey === 'settings') fillCompanyForm();
}

// 2. 当所有的 HTML 和其他 JS 模块文件加载完毕后，触发数据库加载与初始渲染
window.addEventListener('DOMContentLoaded', loadDB);