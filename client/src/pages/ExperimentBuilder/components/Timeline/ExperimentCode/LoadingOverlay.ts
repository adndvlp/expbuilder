/**
 * Returns the JS snippet (as a string) that injects a full-screen loading
 * overlay into the experiment page.
 *
 * Usage in generated code:
 *   _setLoadingMsg('Some message…')   – update the status text
 *   _hideLoading()                    – remove the overlay
 */
export function loadingOverlayCode(): string {
  return `
  // --- Loading overlay ---
  const _loadingOverlay = document.createElement('div');
  _loadingOverlay.id = 'jspsych-loading-overlay';
  _loadingOverlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9999',
    'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center',
    'background:#fff', 'gap:20px',
    'font-family:sans-serif'
  ].join(';');
  _loadingOverlay.innerHTML = \`
    <div style="width:48px;height:48px;border:5px solid #e0e0e0;border-top-color:#555;border-radius:50%;animation:_spin 0.8s linear infinite"></div>
    <p id="jspsych-loading-msg" style="margin:0;color:#555;font-size:15px">Initializing experiment\u2026</p>
    <style>@keyframes _spin{to{transform:rotate(360deg)}}</style>
  \`;
  document.body.appendChild(_loadingOverlay);

  function _setLoadingMsg(msg) {
    const el = document.getElementById('jspsych-loading-msg');
    if (el) el.textContent = msg;
  }

  function _hideLoading() {
    const el = document.getElementById('jspsych-loading-overlay');
    if (el) el.remove();
  }

  function _showSuccess() {
    _hideLoading();
    const overlay = document.createElement('div');
    overlay.id = 'jspsych-loading-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'background:#fff', 'gap:16px',
      'font-family:sans-serif'
    ].join(';');
    overlay.innerHTML = \`
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="#22c55e"/>
        <polyline points="18,33 28,43 46,22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p style="margin:0;color:#111;font-size:18px;font-weight:600">Experiment complete. Thank you!</p>
      <p style="margin:0;color:#555;font-size:14px">You can now close this window.</p>
    \`;
    document.body.appendChild(overlay);
  }

  function _showLoading(msg) {
    _hideLoading();
    const overlay = document.createElement('div');
    overlay.id = 'jspsych-loading-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'background:#fff', 'gap:20px',
      'font-family:sans-serif'
    ].join(';');
    overlay.innerHTML = \`
      <div style="width:48px;height:48px;border:5px solid #e0e0e0;border-top-color:#555;border-radius:50%;animation:_spin 0.8s linear infinite"></div>
      <p id="jspsych-loading-msg" style="margin:0;color:#555;font-size:15px">\${msg || 'Please wait\u2026'}</p>
      <style>@keyframes _spin{to{transform:rotate(360deg)}}</style>
    \`;
    document.body.appendChild(overlay);
  }
`;
}
