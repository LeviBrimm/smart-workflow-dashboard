import { pool } from '../lib/db.js';

export interface CognitoUserPayload {
  id: string;
  email?: string;
  cognitoSub: string;
}

export const syncCognitoUser = async ({ id, email, cognitoSub }: CognitoUserPayload) => {
  await pool.query(
    `INSERT INTO users (id, email, cognito_sub)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET email = COALESCE($2, users.email),
           cognito_sub = EXCLUDED.cognito_sub`,
    [id, email ?? null, cognitoSub]
  );
};
