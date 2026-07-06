// ───────────────────────────────────────────────────────────────
// 심부름꾼 (Vercel 서버리스 함수)  ─  /api/reb
// 브라우저는 보안(CORS)상 부동산원에 직접 못 물어보므로 이 함수가 대신 호출합니다.
// 인증키는 Vercel 환경변수(REB_KEY)에 숨겨두고, 화면 코드엔 절대 노출하지 않습니다.
// 하는 일: ① 최신 공표월 자동 탐색 ② 최근 N개월 데이터 수집
//          ③ 시도별 정리·전월비 계산 ④ 차트용 전국 시계열 생성
// ───────────────────────────────────────────────────────────────

const BASE = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do";
const STATBL = {
  index: "A_2024_00178", // (월) 지역별 매매지수_아파트
  trade: "A_2024_00554", // (월) 행정구역별 아파트매매거래현황
};
const SIDO_ORDER = [
  "서울","경기","인천","부산","대구","대전","광주","울산","세종",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];
const WINDOW = 7; // 차트에 보여줄 개월 수

async function fetchMonth(statblId, ym, key) {
  const url = `${BASE}?KEY=${key}&Type=xml&STATBL_ID=${statblId}&DTACYCLE_CD=MM&WRTTIME_IDTFR_ID=${ym}&pIndex=1&pSize=1000`;
  const res = await fetch(url);
  const xml = await res.text();
  return parseRows(xml);
}

function parseRows(xml) {
  const rows = [];
  const blocks = xml.split("<row>").slice(1);
  for (const b of blocks) {
    const body = b.split("</row>")[0];
    const get = (t) => {
      const m = body.match(new RegExp(`<${t}>([^<]*)</${t}>`));
      return m ? m[1].trim() : "";
    };
    rows.push({
      CLS_NM: get("CLS_NM"),
      CLS_FULLNM: get("CLS_FULLNM"),
      DTA_VAL: get("DTA_VAL"),
    });
  }
  return rows;
}

const ymOf = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymLabel = (ym) => `'${ym.slice(2, 4)}.${ym.slice(4)}`;
const round2 = (v) => Math.round(parseFloat(v) * 100) / 100;

async function findLatestMonth(key) {
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const rows = await fetchMonth(STATBL.index, ymOf(d), key);
    if (rows.length > 0) return ymOf(d);
  }
  return null;
}

// 시도 단위만 추출 ('>'가 없는 행 = 시도 자체. 전국·수도권 등 묶음은 SIDO_ORDER로 거름)
function sidoMap(rows) {
  const m = {};
  for (const r of rows) {
    if (r.CLS_FULLNM.includes(">")) continue;
    if (!SIDO_ORDER.includes(r.CLS_NM)) continue;
    m[r.CLS_NM] = round2(r.DTA_VAL);
  }
  return m;
}
function national(rows) {
  const r = rows.find((x) => x.CLS_NM === "전국" && !x.CLS_FULLNM.includes(">"));
  return r ? round2(r.DTA_VAL) : null;
}

export default async function handler(req, res) {
  const key = process.env.REB_KEY;
  if (!key) return res.status(500).json({ error: "REB_KEY 환경변수가 설정되지 않았습니다." });

  try {
    const latest = await findLatestMonth(key);
    if (!latest) return res.status(502).json({ error: "최근 공표 데이터를 찾지 못했습니다." });

    // 최신월부터 과거로 WINDOW개월의 'YYYYMM' 목록
    const baseDate = new Date(+latest.slice(0, 4), +latest.slice(4) - 1, 1);
    const months = [];
    for (let i = WINDOW - 1; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      months.push(ymOf(d));
    }

    // 모든 달의 지수·거래현황을 한꺼번에 수집
    const idxByMonth = {};
    const trByMonth = {};
    await Promise.all(
      months.flatMap((ym) => [
        fetchMonth(STATBL.index, ym, key).then((r) => (idxByMonth[ym] = r)),
        fetchMonth(STATBL.trade, ym, key).then((r) => (trByMonth[ym] = r)),
      ])
    );

    // 차트용 전국 시계열
    const series = months.map((ym, i) => ({
      ym: ymLabel(ym),
      index: national(idxByMonth[ym] || []),
      vol: national(trByMonth[ym] || []),
      provisional: i === months.length - 1, // 최신월은 잠정
    }));

    // 시도별 현황 + 전월비 (결정적 계산)
    const prev = months[months.length - 2];
    const idxNow = sidoMap(idxByMonth[latest]);
    const idxPrev = sidoMap(idxByMonth[prev] || []);
    const trNow = sidoMap(trByMonth[latest]);
    const trPrev = sidoMap(trByMonth[prev] || []);

    const regions = SIDO_ORDER.map((name) => {
      const idx = idxNow[name] ?? null, idxP = idxPrev[name] ?? null;
      const vol = trNow[name] ?? null, volP = trPrev[name] ?? null;
      return {
        name, idx, vol,
        chg: idx && idxP ? +(((idx - idxP) / idxP) * 100).toFixed(2) : 0,
        volChg: vol && volP ? +(((vol - volP) / volP) * 100).toFixed(1) : 0,
      };
    });

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({
      latestMonth: ymLabel(latest).replace("'", "20"),
      nationalIndex: national(idxByMonth[latest]),
      nationalVol: national(trByMonth[latest]),
      series,
      regions,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
