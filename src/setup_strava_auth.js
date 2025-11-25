import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  let clientId = process.env.STRAVA_CLIENT_ID;
  let clientSecret = process.env.STRAVA_CLIENT_SECRET;

  console.log('\n=== Strava 認証セットアップ ===\n');

  if (!clientId) {
    clientId = await askQuestion('Strava Client ID を入力してください: ');
  }
  if (!clientSecret) {
    clientSecret = await askQuestion('Strava Client Secret を入力してください: ');
  }

  if (!clientId || !clientSecret) {
    console.error('エラー: Client ID と Client Secret は必須です。');
    rl.close();
    process.exit(1);
  }

  // scope=activity:read_all is crucial here
  const authUrl = `http://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=activity:read_all`;

  console.log('\n1. ブラウザで以下のURLを開いてください:');
  console.log(`\x1b[36m${authUrl}\x1b[0m`); // URLはシアン色で表示
  console.log('\n2. "Authorize"（許可する）をクリックしてください。');
  console.log('3. "http://localhost/exchange_token?state=&code=...&scope=..." のようなURLにリダイレクトされます。');
  console.log('   (「このサイトにアクセスできません」等のエラーが表示される場合がありますが、問題ありません。アドレスバーを確認してください。)');
  console.log('4. アドレスバーのURLから "code" パラメータの値をコピーしてください。');

  const code = await askQuestion('\nここにコードを貼り付けてください: ');

  if (!code) {
    console.error('コードが入力されませんでした。');
    rl.close();
    return;
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();

    if (data.errors || !data.refresh_token) {
      console.error('トークンの交換中にエラーが発生しました:', data);
    } else {
      console.log('\n成功！トークンを取得しました。');
      
      // Update .env file if exists or create new one
      let envContent = '';
      if (fs.existsSync('.env')) {
        envContent = fs.readFileSync('.env', 'utf8');
      }
      
      // Helper to replace or append
      const updateEnvVar = (key, value) => {
        const regex = new RegExp(`${key}=.*`);
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      };

      updateEnvVar('STRAVA_CLIENT_ID', clientId);
      updateEnvVar('STRAVA_CLIENT_SECRET', clientSecret);
      updateEnvVar('STRAVA_REFRESH_TOKEN', data.refresh_token);
      updateEnvVar('ACCESS_TOKEN', data.access_token);

      fs.writeFileSync('.env', envContent.trim());
      console.log('.env ファイルを更新（または作成）しました。');
      
      console.log('\n=== GitHub Secrets 設定用情報 ===');
      console.log('以下の値を GitHub リポジトリの Secrets に設定してください:');
      console.log(`STRAVA_REFRESH_TOKEN: ${data.refresh_token}`);
      console.log('=====================================\n');

      console.log('これで "node generate_svg.js" を再実行できます。');
    }

  } catch (error) {
    console.error('ネットワークエラー:', error);
  }
  
  rl.close();
}

main();
