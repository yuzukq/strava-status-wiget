import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const refreshToken = process.env.STRAVA_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error('エラー: 環境変数が不足しています (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN)。');
  process.exit(1);
}

const url = 'https://www.strava.com/oauth/token';
const params = new URLSearchParams();
params.append('client_id', clientId);
params.append('client_secret', clientSecret);
params.append('grant_type', 'refresh_token');
params.append('refresh_token', refreshToken);

try {
  const response = await fetch(url, { method: 'POST', body: params });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }
  const data = await response.json();
  
  console.log('アクセストークンのリフレッシュに成功しました。');
  
  // GitHub Actions 環境用の出力先
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `access_token=${data.access_token}\n`);
  } else {
    // ローカル実行時のフォールバック
    console.log(`access_token=${data.access_token}`);
  }

} catch (error) {
  console.error('トークンのリフレッシュ中にエラーが発生しました:', error);
  process.exit(1);
}
