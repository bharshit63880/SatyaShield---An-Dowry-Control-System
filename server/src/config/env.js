import dotenv from 'dotenv';

dotenv.config();

const requiredVariables = [
  'MONGODB_URI',
  'JWT_SECRET',
  'LOCATION_ENCRYPTION_KEY',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD'
];

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

if (process.env.LOCATION_ENCRYPTION_KEY.length < 16) {
  throw new Error('LOCATION_ENCRYPTION_KEY must be at least 16 characters long.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI,
  serverPublicUrl: process.env.SERVER_PUBLIC_URL?.trim() || '',
  uploadsDir: process.env.UPLOADS_DIR?.trim() || 'uploads',
  jwtSecret: process.env.JWT_SECRET,
  jwtIssuer: process.env.JWT_ISSUER?.trim() || 'dahej-control-system',
  jwtAudience: process.env.JWT_AUDIENCE?.trim() || 'dahej-control-system-admin',
  locationEncryptionKey: process.env.LOCATION_ENCRYPTION_KEY,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  adminEmail: process.env.ADMIN_EMAIL.toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD,
  clientUrls: (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini'
};

export const isProduction = env.nodeEnv === 'production';
