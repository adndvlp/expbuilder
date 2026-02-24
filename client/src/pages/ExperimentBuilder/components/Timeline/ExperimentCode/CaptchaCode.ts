/**
 * Returns the JS snippet (as a string) that injects a CAPTCHA gate
 * supporting hCaptcha and reCAPTCHA v2 (Google).
 *
 * Usage in generated code:
 *   await _showCaptchaGate(siteKey, provider)
 *     provider: 'hcaptcha' | 'recaptcha'
 *     Resolves with the verified token once the user passes the challenge.
 */
export function captchaCode(): string {
  return `
  // --- CAPTCHA gate (hCaptcha or reCAPTCHA v2) ---
  function _showCaptchaGate(siteKey, provider) {
    return new Promise((resolve) => {
      provider = provider || 'hcaptcha';

      // Read body background at call time to match canvas styles
      const _bgColor = (getComputedStyle(document.body).backgroundColor || '').trim();
      const _captchaBg = _bgColor && _bgColor !== 'rgba(0, 0, 0, 0)' && _bgColor !== 'transparent' ? _bgColor : '#fff';

      // Load the appropriate script once
      if (!document.getElementById('captcha-script')) {
        const s = document.createElement('script');
        s.id = 'captcha-script';
        s.async = true;
        s.defer = true;
        window._captchaReady = function() { window._captchaAPIReady = true; };
        if (provider === 'recaptcha') {
          s.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=_captchaReady';
        } else {
          s.src = 'https://js.hcaptcha.com/1/api.js?onload=_captchaReady&render=explicit';
        }
        document.head.appendChild(s);
      }

      // Build overlay
      const overlay = document.createElement('div');
      overlay.id = 'jspsych-captcha-overlay';
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:10000',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'background:' + _captchaBg, 'gap:24px',
        'font-family:sans-serif'
      ].join(';');
      overlay.innerHTML = \`
        <p style="margin:0;color:#333;font-size:17px;font-weight:600">
          Please verify you are human
        </p>
        <div id="captcha-widget"></div>
      \`;
      document.body.appendChild(overlay);

      function _renderWidget() {
        if (provider === 'recaptcha') {
          if (typeof grecaptcha === 'undefined' || !window._captchaAPIReady) {
            setTimeout(_renderWidget, 100);
            return;
          }
          grecaptcha.render('captcha-widget', {
            sitekey: siteKey,
            theme: 'light',
            callback: function(token) {
              const el = document.getElementById('jspsych-captcha-overlay');
              if (el) el.remove();
              resolve(token);
            },
            'error-callback': function() { grecaptcha.reset(); }
          });
        } else {
          // hCaptcha
          if (typeof hcaptcha === 'undefined' || !window._captchaAPIReady) {
            setTimeout(_renderWidget, 100);
            return;
          }
          hcaptcha.render('captcha-widget', {
            sitekey: siteKey,
            theme: 'light',
            callback: function(token) {
              const el = document.getElementById('jspsych-captcha-overlay');
              if (el) el.remove();
              resolve(token);
            },
            'error-callback': function() { hcaptcha.reset(); }
          });
        }
      }

      _renderWidget();
    });
  }
`;
}
