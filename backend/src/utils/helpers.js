const crypto = require('crypto');

class Helpers {
  // Generate random string
  static generateRandomString(length = 10) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  // Format currency
  static formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Format date
  static formatDate(date, format = 'DD/MM/YYYY HH:mm') {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year)
      .replace('HH', hours)
      .replace('mm', minutes);
  }

  // Calculate commission
  static calculateCommission(amount, percentage = 5) {
    return (amount * percentage) / 100;
  }

  // Paginate array
  static paginate(array, page = 1, limit = 10) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    
    return {
      data: array.slice(startIndex, endIndex),
      pagination: {
        page,
        limit,
        total: array.length,
        pages: Math.ceil(array.length / limit)
      }
    };
  }

  // Validate email
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // Generate transaction ID
  static generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `TXN${timestamp}${random}`.toUpperCase();
  }

  // Deep clone object
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Delay function
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get current timestamp
  static getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }
}

module.exports = Helpers;