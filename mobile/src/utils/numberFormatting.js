/**
 * Number formatting utilities to ensure Arabic numerals (0-9) are used
 * instead of Hindi/Indic numerals (٠-٩)
 */

/**
 * Convert any string to use Arabic numerals (0-9)
 * @param {string} str - Input string that may contain Hindi numerals
 * @returns {string} - String with Arabic numerals
 */
export const toArabicNumerals = (str) => {
  if (!str) return str;
  
  const hindiToArabic = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  
  return str.replace(/[٠-٩]/g, (match) => hindiToArabic[match] || match);
};

/**
 * Format time to Arabic numerals with specific locale
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time with Arabic numerals
 */
export const formatTimeWithArabicNumerals = (date, options = {}) => {
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  };
  
  const formatted = new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  return toArabicNumerals(formatted);
};

/**
 * Format date to Arabic numerals with specific locale
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date with Arabic numerals
 */
export const formatDateWithArabicNumerals = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  const formatted = new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  return toArabicNumerals(formatted);
};

/**
 * Format date and time to Arabic numerals
 * @param {Date} date - Date object
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date and time with Arabic numerals
 */
export const formatDateTimeWithArabicNumerals = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  };
  
  const formatted = new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  return toArabicNumerals(formatted);
};

/**
 * Format a number to Arabic numerals
 * @param {number} num - Number to format
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} - Formatted number with Arabic numerals
 */
export const formatNumberWithArabicNumerals = (num, options = {}) => {
  const formatted = new Intl.NumberFormat('en-US', options).format(num);
  return toArabicNumerals(formatted);
};

/**
 * Simple time formatter that always uses Arabic numerals
 * @param {Date} date - Date object
 * @returns {string} - Time in HH:MM format with Arabic numerals
 */
export const formatTimeSimple = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Simple date formatter that always uses Arabic numerals
 * @param {Date} date - Date object
 * @returns {string} - Date in YYYY-MM-DD format with Arabic numerals
 */
export const formatDateSimple = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
