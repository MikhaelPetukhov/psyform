import React from 'react';
import { FaTelegramPlane, FaWhatsapp } from 'react-icons/fa';
import { FiPhone } from 'react-icons/fi';

const ContactIcon = ({ method }) => {
  if (method === 'telegram') {
    return <FaTelegramPlane className="contact-icon tg" title="Telegram" />;
  }
  if (method === 'whatsapp') {
    return <FaWhatsapp className="contact-icon wa" title="WhatsApp" />;
  }
  return <FiPhone className="contact-icon ph" title="Телефон" />;
};

export default ContactIcon;
