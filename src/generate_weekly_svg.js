import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const accessToken = process.env.ACCESS_TOKEN;

if (!accessToken) {
  console.error('エラー: 環境変数 ACCESS_TOKEN が見つかりません。');
  process.exit(1);
}

async function getActivities() {
  // 過去7日間のアクティビティを取得する
  // Strava API: /athlete/activities（エンドポイント）
  const before = Math.floor(Date.now() / 1000);
  const after = before - (7 * 24 * 60 * 60);
  
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API エラー: ${response.status} ${text}`);
  }

  return await response.json();
}

function generateSVG(stats) {
  const width = 300;
  const height = 150;
  const barMax = 200; // 棒グラフの最大幅（px）
  
  // 棒グラフ用に値を正規化（表示のための最大目標を仮定）
  // 環境変数から目標値を取得（デフォルト: 100km, 10時間）
  const maxDist = parseFloat(process.env.WEEKLY_GOAL_KM) || 100; 
  const maxTime = parseFloat(process.env.WEEKLY_GOAL_HOURS) || 10;
  
  // 棒が最大幅を超えないようにする
  const distWidth = Math.min(barMax, (stats.distance / maxDist) * barMax);
  const timeWidth = Math.min(barMax, (stats.time / maxTime) * barMax);

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      fill: #333;
    }
    .label {
      font-size: 12px;
      fill: #666;
    }
    .value {
      font-size: 18px;
      font-weight: bold;
      fill: #FC4C02; /* Strava Orange */
    }
    @media (prefers-color-scheme: dark) {
      .text { fill: #eee; }
      .label { fill: #aaa; }
    }
  </style>
  
  <!-- 背景（透明） -->
  <rect width="100%" height="100%" fill="none" />
  
  <!-- タイトル -->
  <text x="20" y="30" class="text" style="font-size: 16px; font-weight: bold;">Weekly Ride Effort</text>
  
  <!-- 距離 -->
  <text x="20" y="60" class="label">Distance</text>
  <text x="280" y="60" class="value" text-anchor="end">${stats.distance.toFixed(1)} km</text>
  <rect x="20" y="70" width="${barMax}" height="10" rx="5" fill="#ddd" />
  <rect x="20" y="70" width="0" height="10" rx="5" fill="#FC4C02">
    <animate attributeName="width" from="0" to="${distWidth}" dur="1s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
  </rect>

  <!-- 時間 -->
  <text x="20" y="100" class="label">Time</text>
  <text x="280" y="100" class="value" text-anchor="end">${stats.time.toFixed(1)} h</text>
  <rect x="20" y="110" width="${barMax}" height="10" rx="5" fill="#ddd" />
  <rect x="20" y="110" width="0" height="10" rx="5" fill="#FC4C02">
    <animate attributeName="width" from="0" to="${timeWidth}" dur="1s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
  </rect>
  
  <text x="20" y="140" class="label" style="font-size: 10px;">Last 7 Days</text>
</svg>
`;
  return svg.trim();
}

async function main() {
  try {
    const activities = await getActivities();
    
    let totalDistance = 0; // メートル
    let totalTime = 0; // 秒
    
    if (Array.isArray(activities)) {
        activities.forEach(activity => {
        if (activity.type === 'Ride' || activity.type === 'VirtualRide') {
            totalDistance += activity.distance;
            totalTime += activity.moving_time;
        }
        });
    } else {
        console.error('予期しないAPIレスポンス:', activities);
    }
    
    const stats = {
      distance: totalDistance / 1000, // km
      time: totalTime / 3600 // 時間
    };
    
    console.log('統計情報:', stats);
    
    const svgContent = generateSVG(stats);
    fs.writeFileSync('widgets/weekly_stats.svg', svgContent);
    console.log('widgets/weekly_stats.svg を生成しました。');
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

main();
