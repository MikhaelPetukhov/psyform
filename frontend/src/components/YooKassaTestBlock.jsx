import React, { useEffect } from 'react';

const YooKassaTestBlock = () => {
  useEffect(() => {
    const cssHref = 'https://yookassa.ru/integration/simplepay/css/yookassa_construct_form.css?v=1.26.0';
    let cssLink = document.querySelector(`link[href="${cssHref}"]`);
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = cssHref;
      document.head.appendChild(cssLink);
    }

    const scriptSrc = 'https://yookassa.ru/integration/simplepay/js/yookassa_construct_form.js?v=1.26.0';
    let scriptTag = document.querySelector(`script[src="${scriptSrc}"]`);
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.src = scriptSrc;
      scriptTag.async = true;
      document.body.appendChild(scriptTag);
    }

    // Не удаляем ресурсы при размонтировании, чтобы при возврате на страницу они уже были загружены
  }, []);

  return (
    <form
      className="yoomoney-payment-form"
      action="https://yookassa.ru/integration/simplepay/payment"
      method="post"
      acceptCharset="utf-8"
    >
      <input name="customerNumber" type="hidden" value="Образование" />

      <div className="ym-payment-btn-block">
        <div className="ym-input-icon-rub ym-display-none">
          <input
            name="sum"
            placeholder="0.00"
            className="ym-input ym-sum-input ym-required-input"
            type="number"
            step="any"
            defaultValue="10"
          />
        </div>
        <button data-text="Оплатить " className="ym-btn-pay ym-result-price" type="submit">
          <span className="ym-text-crop">Оплатить </span>
          <span className="ym-price-output"> 10,00&nbsp;₽</span>
        </button>
        <img
          src="https://yookassa.ru/integration/simplepay/img/iokassa-gray.svg?v=1.26.0"
          className="ym-logo"
          width="114"
          height="27"
          alt="ЮKassa"
        />
      </div>
      <input name="shopId" type="hidden" value="373200" />
    </form>
  );
};

export default YooKassaTestBlock;
