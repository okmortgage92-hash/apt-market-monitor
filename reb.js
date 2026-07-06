// ───────────────────────────────────────────────────────────────
// AI 리포트 심부름꾼 (Vercel 서버리스 함수)  ─  POST /api/report
// 대시보드가 '코드로 이미 계산해둔 수치'를 받아, Claude에게 "이 숫자로
// 보고서 문장을 써라"고만 시킵니다. 숫자 계산·판정은 절대 AI가 하지 않음.
// API 키는 환경변수 ANTHROPIC_API_KEY 에 숨겨둡니다.
// ───────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-5"; // 최신 모델명은 docs.claude.com 참고해 교체 가능

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." });

  try {
    const d = req.body; // { latestMonth, nationalIndex, nationalVol, series, regions }

    // 코드가 계산한 값들을 '사실'로 정리 (AI는 이 값만 사용, 재계산 금지)
    const up = d.regions.filter((r) => r.chg > 0);
    const down = d.regions.filter((r) => r.chg < 0);
    const topUp = [...d.regions].filter(r=>r.idx!=null).sort((a, b) => b.chg - a.chg).slice(0, 3);
    const topDown = [...d.regions].filter(r=>r.idx!=null).sort((a, b) => a.chg - b.chg).slice(0, 3);
    const risk = d.regions.filter((r) => r.chg < -0.2 && r.volChg < -3);

    const facts = {
      기준월: d.latestMonth,
      전국_실거래가격지수: d.nationalIndex,
      전국_매매거래호수: d.nationalVol,
      상승지역수: up.length,
      하락지역수: down.length,
      상승상위: topUp.map((r) => `${r.name} ${r.chg > 0 ? "+" : ""}${r.chg}%`),
      하락상위: topDown.map((r) => `${r.name} ${r.chg}%`),
      리스크경고지역: risk.map((r) => `${r.name}(지수 ${r.chg}%, 거래 ${r.volChg}%)`),
      시계열: d.series.map((s) => `${s.ym}: 지수 ${s.index}, 거래 ${s.vol}호`),
    };

    const prompt = `당신은 저축은행 여신부의 부동산시장 애널리스트입니다.
아래는 코드가 이미 정확히 계산한 한국부동산원 아파트 시장 지표입니다. 이 수치를 그대로 인용해 보고서를 작성하세요.

[규칙]
- 주어진 숫자만 사용하고, 새로운 수치를 계산하거나 지어내지 마세요.
- 상승=빨강/하락=파랑 같은 표시는 언급하지 말고 내용에 집중.
- 담보가치·환금성 관점의 시사점을 포함하되, 개별 여신 승인 판단은 하지 마세요.
- 과장·투자권유 표현 금지. 사실 기반의 절제된 톤.

[확정 수치]
${JSON.stringify(facts, null, 2)}

[출력 형식]
아래 4개 섹션으로 나눠 JSON 배열로만 응답하세요. 다른 텍스트·마크다운·백틱 없이 JSON만:
[
  {"heading": "시장 요약", "body": "..."},
  {"heading": "지역별 동향", "body": "..."},
  {"heading": "리스크 진단", "body": "..."},
  {"heading": "종합 의견", "body": "..."}
]
각 body는 2~4문장의 한국어 서술.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await resp.json();
    if (data.error) return res.status(502).json({ error: data.error.message || "Claude API 오류" });

    const text = (data.content || []).map((c) => c.text || "").join("").trim();
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let sections;
    try {
      sections = JSON.parse(clean);
    } catch {
      // 혹시 JSON 파싱 실패 시 통짜 텍스트로 폴백
      sections = [{ heading: "AI 시장 리포트", body: clean }];
    }

    res.status(200).json({ latestMonth: d.latestMonth, sections });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
