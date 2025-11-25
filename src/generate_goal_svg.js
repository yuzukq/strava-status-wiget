import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const accessToken = process.env.ACCESS_TOKEN;
const monthlyGoalKm = parseFloat(process.env.MONTHLY_GOAL_KM) || 200; // デフォルト200km

if (!accessToken) {
  console.error('エラー: 環境変数 ACCESS_TOKEN が見つかりません。');
  process.exit(1);
}

async function getMonthActivities() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const afterTimestamp = Math.floor(firstDay.getTime() / 1000);

  const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterTimestamp}&per_page=200`;
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

function generateSVG(currentDistance, goalDistance) {
  const width = 300;
  const height = 100;
  const progress = Math.min(currentDistance / goalDistance, 1.0);
  const percentage = Math.floor((currentDistance / goalDistance) * 100);
  const isGoalReached = currentDistance >= goalDistance;
  
  const barWidth = 260;
  const progressWidth = barWidth * progress;
  const remaining = Math.max(goalDistance - currentDistance, 0).toFixed(1);
  
  const progressBarColor = isGoalReached ? "#4CAF50" : "#FC4C02"; // 達成したら緑,未達成ならオレンジ

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 14px; font-weight: bold; fill: #666; }
    .status { font-size: 12px; fill: #333; }
    .percentage { font-size: 24px; font-weight: bold; fill: ${progressBarColor}; }
    .goal-text { font-size: 10px; fill: #999; }
    @media (prefers-color-scheme: dark) {
      .title { fill: #aaa; }
      .status { fill: #eee; }
    }
  </style>
  
  <rect width="100%" height="100%" fill="none" />
  
  <text x="20" y="25" class="title text">Monthly Goal</text>
  <text x="280" y="25" text-anchor="end" class="percentage text">${percentage}%</text>
  
  <!-- プログレスバー背景 -->
  <rect x="20" y="40" width="${barWidth}" height="12" rx="6" fill="#eee" />
  
  <!-- プログレスバー本体 -->
  <rect x="20" y="40" width="0" height="12" rx="6" fill="${progressBarColor}">
    <animate attributeName="width" from="0" to="${progressWidth}" dur="1s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
  </rect>
  
  <text x="20" y="70" class="status text">${currentDistance.toFixed(1)} km / ${goalDistance} km</text>
  <text x="280" y="70" text-anchor="end" class="goal-text text">${isGoalReached ? 'Goal Reached! 🎉' : `${remaining} km to go`}</text>
</svg>
`;
  return svg.trim();
}

async function main() {
  try {
    const activities = await getMonthActivities();
    
    let currentDistance = 0;
    activities.forEach(activity => {
      if (activity.type === 'Ride') {
        currentDistance += activity.distance;
      }
    });
    
    // m -> km
    currentDistance = currentDistance / 1000;

    console.log(`Current Month Distance: ${currentDistance.toFixed(1)}km / Goal: ${monthlyGoalKm}km`);

    const svgContent = generateSVG(currentDistance, monthlyGoalKm);
    fs.writeFileSync('widgets/monthly_goal.svg', svgContent);
    console.log('widgets/monthly_goal.svg を生成しました。');

  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
