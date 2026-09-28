import { resolve } from 'node:path';
import { config } from 'dotenv';
import { OAuth2Client } from 'google-auth-library';

config({
  path: resolve(process.cwd(), '../../.env'),
});

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

if (!clientId) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
}

if (!clientSecret) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set');
}

if (!redirectUri) {
  throw new Error('GOOGLE_REDIRECT_URI environment variable is not set');
}

export const googleOAuthClient = new OAuth2Client(
  clientId,
  clientSecret,
  redirectUri,
);
