// const crypto = require('crypto');
// const Captcha = require('../models/Captcha');

// class CaptchaService {
//   // Generate random CAPTCHA text
//   static generateCaptchaText(length = 6) {
//     const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
//     let captcha = '';
//     for (let i = 0; i < length; i++) {
//       captcha += chars.charAt(Math.floor(Math.random() * chars.length));
//     }
//     return captcha;
//   }

//   // Generate session ID
//   static generateSessionId() {
//     return crypto.randomBytes(16).toString('hex');
//   }

//   // Create new CAPTCHA
//   static async createCaptcha() {
//     const sessionId = this.generateSessionId();
//     const captchaText = this.generateCaptchaText();
//     const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

//     const captcha = new Captcha({
//       sessionId,
//       captchaText,
//       expiresAt
//     });

//     await captcha.save();

//     return {
//       sessionId,
//       captchaText,
//       expiresAt
//     };
//   }

//   // Verify CAPTCHA
//   static async verifyCaptcha(sessionId, userInput) {
//     const captcha = await Captcha.findOne({ sessionId });

//     if (!captcha) {
//       return { success: false, message: 'CAPTCHA expired or invalid session' };
//     }

//     if (captcha.expiresAt < new Date()) {
//       await captcha.deleteOne();
//       return { success: false, message: 'CAPTCHA expired' };
//     }

//     if (captcha.attempts >= 5) {
//       await captcha.deleteOne();
//       return { success: false, message: 'Too many attempts' };
//     }

//     captcha.attempts += 1;

//     if (captcha.captchaText !== userInput.toUpperCase()) {
//       await captcha.save();
//       return { success: false, message: 'Invalid CAPTCHA' };
//     }

//     captcha.isVerified = true;
//     await captcha.save();

//     return { success: true, message: 'CAPTCHA verified successfully' };
//   }

//   // Clean up expired CAPTCHAs
//   static async cleanupExpired() {
//     const result = await Captcha.deleteMany({ expiresAt: { $lt: new Date() } });
//     return result.deletedCount;
//   }
// }

// module.exports = CaptchaService;



const crypto = require('crypto');
const svgCaptcha = require('svg-captcha');
const Captcha = require('../models/Captcha');

class CaptchaService {

  // Generate session ID
  static generateSessionId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Create new CAPTCHA
   * - Generates random text + SVG image
   * - Stores text in MongoDB
   * - Returns image + sessionId to frontend
   */
  static async createCaptcha() {
    try {
      const sessionId = this.generateSessionId();

      // Generate SVG captcha
      const captcha = svgCaptcha.create({
        size: 5,        // number of characters
        noise: 3,       // noise lines
        color: true,    // colored text
        background: '#f4f6f8'
      });

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store captcha text in DB
      await Captcha.create({
        sessionId,
        captchaText: captcha.text.toUpperCase(),
        expiresAt,
        attempts: 0,
        isVerified: false
      });

      return {
        sessionId,
        captchaText: captcha.text, // for internal use (not sent to frontend)
        captchaImage: captcha.data, // SVG image
        expiresAt
      };

    } catch (error) {
      console.error('Captcha creation error:', error);
      throw error;
    }
  }

  /**
   * Verify CAPTCHA
   */
  static async verifyCaptcha(sessionId, userInput) {
    try {
      if (!sessionId || !userInput) {
        return { success: false, message: 'Session ID and CAPTCHA required' };
      }

      const captcha = await Captcha.findOne({ sessionId });

      // Check if exists
      if (!captcha) {
        return {
          success: false,
          message: 'CAPTCHA expired or invalid session'
        };
      }

      // Check expiry
      if (captcha.expiresAt < new Date()) {
        await captcha.deleteOne();
        return { success: false, message: 'CAPTCHA expired' };
      }

      // Check max attempts
      if (captcha.attempts >= 5) {
        await captcha.deleteOne();
        return { success: false, message: 'Too many attempts' };
      }

      // Increment attempt count
      captcha.attempts += 1;

      // Case-insensitive comparison
      if (captcha.captchaText !== userInput.toUpperCase()) {
        await captcha.save();
        return { success: false, message: 'Invalid CAPTCHA' };
      }

      // Mark verified and remove (one-time use)
      captcha.isVerified = true;
      await captcha.deleteOne();

      return {
        success: true,
        message: 'CAPTCHA verified successfully'
      };

    } catch (error) {
      console.error('Captcha verification error:', error);
      return { success: false, message: 'Error verifying CAPTCHA' };
    }
  }

  /**
   * Cleanup expired CAPTCHAs (can run as cron job)
   */
  static async cleanupExpired() {
    try {
      const result = await Captcha.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      return result.deletedCount;
    } catch (error) {
      console.error('Captcha cleanup error:', error);
    }
  }
}

module.exports = CaptchaService;
