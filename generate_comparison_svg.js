import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';

const accessToken = process.env.ACCESS_TOKEN;

if (!accessToken) {
  console.error('エラー: 環境変数 ACCESS_TOKEN が見つかりません。');
  process.exit(1);
}

async function getActivities(afterTimestamp) {
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

function getLast4WeeksRanges() {
  const now = new Date();
  
  // Stravaの仕様に合わせて月曜日始まり・日曜日終わりの週を計算する
  const dayOfWeek = now.getDay(); // 0(Sun) - 6(Sat)
  
  // 今週の日曜日（週の終わり）を計算
  // 今日が日曜(0)なら、今日が週の終わり (0日後)
  // 今日が月曜(1)なら、あと6日で日曜
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  
  const endOfThisWeek = new Date(now);
  endOfThisWeek.setDate(now.getDate() + daysUntilSunday);
  endOfThisWeek.setHours(23, 59, 59, 999);

  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const end = new Date(endOfThisWeek);
    end.setDate(endOfThisWeek.getDate() - (i * 7));
    
    const start = new Date(end);
    start.setDate(end.getDate() - 6); // 日曜日の6日前は月曜日
    start.setHours(0, 0, 0, 0);
    
    // 配列の先頭が一番古い週になるようにunshift
    weeks.unshift({ start, end, distance: 0 });
  }
  return weeks;
}

function generateSVG(weeks) {
  const width = 400;
  const height = 200;
  const padding = 40;
  const barWidth = 40;
  const gap = 30;
  const chartHeight = 120;
  
  // 最大距離依存で動的スケール
  const maxDistance = Math.max(...weeks.map(w => w.distance), 10); // min10kmのバッファ
  const scale = chartHeight / maxDistance;

  const bars = weeks.map((week, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = week.distance * scale;
    const y = height - padding - barHeight;
    const dateLabel = `${week.start.getMonth() + 1}/${week.start.getDate()}`;
    
    // アニメーション用の遅延
    const delay = index * 0.2;

    return `
      <!-- Bar for ${dateLabel} -->
      <g transform="translate(${x}, 0)">
        <text x="${barWidth/2}" y="${y - 5}" text-anchor="middle" class="value">${week.distance.toFixed(1)}</text>
        <rect y="${height - padding}" width="${barWidth}" height="0" fill="#FC4C02" rx="4">
          <animate attributeName="height" from="0" to="${barHeight}" dur="0.8s" begin="${delay}s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
          <animate attributeName="y" from="${height - padding}" to="${y}" dur="0.8s" begin="${delay}s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
        </rect>
        <text x="${barWidth/2}" y="${height - padding + 15}" text-anchor="middle" class="label">${dateLabel}</text>
      </g>
    `;
  }).join('');

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 16px; font-weight: bold; fill: #333; }
    .label { font-size: 12px; fill: #666; }
    .value { font-size: 12px; font-weight: bold; fill: #333; }
    @media (prefers-color-scheme: dark) {
      .title { fill: #eee; }
      .label { fill: #aaa; }
      .value { fill: #eee; }
    }
  </style>
  
  <rect width="100%" height="100%" fill="none" />
  
  <text x="${width/2}" y="20" text-anchor="middle" class="title text">Last 4 Weeks Distance (km)</text>
  
  ${bars}
  
  <!-- X軸の線 -->
  <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ccc" stroke-width="1" />
</svg>
`;
  return svg.trim();
}

async function main() {
  try {
    const weeks = getLast4WeeksRanges();
    // 一番古い週の開始日時（Unix Timestamp）
    const afterTimestamp = Math.floor(weeks[0].start.getTime() / 1000);
    
    const activities = await getActivities(afterTimestamp);
    
    // アクティビティを集計
    activities.forEach(activity => {
      if (activity.type === 'Ride') {
        const activityDate = new Date(activity.start_date);
        // どの週に属するか判定
        for (const week of weeks) {
          if (activityDate >= week.start && activityDate <= week.end) {
            week.distance += activity.distance / 1000; // m -> km
            break;
          }
        }
      }
    });

    console.log('Weekly Distances:', weeks.map(w => `${w.start.toLocaleDateString()}: ${w.distance.toFixed(1)}km`));

    const svgContent = generateSVG(weeks);
    fs.writeFileSync('four_week_comparison.svg', svgContent);
    console.log('four_week_comparison.svg を生成しました。');

  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
