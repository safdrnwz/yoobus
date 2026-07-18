import { PLATFORM_DEFAULTS } from '../common/config/platform-defaults';

// Default values come from the single source of truth (platform-defaults); environment
// variables override them. No config literal is duplicated here.
const D = PLATFORM_DEFAULTS;

export default () => ({
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  app: {
    name: process.env.APP_NAME || 'Yoo Bus',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    publicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:3000/api/v1',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    appUrl: process.env.APP_FRONTEND_URL || 'http://app.localhost:5173',
    maxBodySize: process.env.MAX_BODY_SIZE || '1mb',
    loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10),
    loginLockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES ?? '15', 10),
    corsOrigins: process.env.CORS_ORIGINS || '*',
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '1d',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Yoo Bus <no-reply@yoobus.in>',
    devMode: process.env.EMAIL_DEV_MODE !== 'false',
  },
  billing: {
    setupFeePerBus: parseFloat(process.env.SETUP_FEE_PER_BUS ?? String(D.PAYMENT.setupFeePerBus)),
    defaultCommissionRate: parseFloat(process.env.DEFAULT_COMMISSION_RATE ?? String(D.PAYMENT.defaultCommissionRate)),
  },
  notify: {
    whatsappEnabled: process.env.NOTIFY_WHATSAPP_ENABLED === 'true',
    smsEnabled: process.env.NOTIFY_SMS_ENABLED === 'true',
  },
  messaging: {
    smsEnabled: process.env.NOTIFY_SMS_ENABLED === 'true',
    whatsappEnabled: process.env.NOTIFY_WHATSAPP_ENABLED === 'true',
    msg91AuthKey: process.env.MSG91_AUTHKEY,
    msg91Sender: process.env.MSG91_SENDER,
    whatsappToken: process.env.WHATSAPP_TOKEN,
    whatsappPhoneId: process.env.WHATSAPP_PHONE_ID,
  },
  loyalty: {
    referrerReward: parseFloat(process.env.LOYALTY_REFERRER_REWARD ?? '50'),
    refereeReward: parseFloat(process.env.LOYALTY_REFEREE_REWARD ?? '25'),
    pointsPerRupee: parseFloat(process.env.LOYALTY_POINTS_PER_RUPEE ?? '0.1'),
    rupeePerPoint: parseFloat(process.env.LOYALTY_RUPEE_PER_POINT ?? '0.25'),
  },
  fareFreeze: {
    fee: parseFloat(process.env.FARE_FREEZE_FEE ?? '49'),
    hours: parseInt(process.env.FARE_FREEZE_HOURS ?? '6', 10),
  },
  pricing: {
    dynamicEnabled: process.env.DYNAMIC_PRICING_ENABLED === 'true',
  },
  insurance: {
    premiumPerPassenger: parseFloat(process.env.INSURANCE_PREMIUM ?? String(D.PAYMENT.insurancePremiumPerPassenger)),
    gstRate: parseFloat(process.env.INSURANCE_GST_RATE ?? String(D.PAYMENT.insuranceGstRate)),
  },
  tax: {
    fareGstRate: parseFloat(process.env.FARE_GST_RATE ?? String(D.PAYMENT.fareGstRate)),
    commissionGstRate: parseFloat(process.env.COMMISSION_GST_RATE ?? String(D.PAYMENT.commissionGstRate)),
    tcsRate: parseFloat(process.env.TCS_RATE ?? String(D.PAYMENT.tcsRate)),
    tdsRate: parseFloat(process.env.TDS_RATE ?? String(D.PAYMENT.tdsRate)),
  },
});
