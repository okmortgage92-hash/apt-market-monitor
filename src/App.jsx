import React, { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

/*
 * 아파트 시장 모니터링 대시보드
 * 데이터: 한국부동산원 R-ONE Open API (심부름꾼 /api/reb 경유)
 *   - (월) 지역별 매매지수_아파트  A_2024_00178
 *   - (월) 행정구역별 아파트매매거래현황  A_2024_00554
 * 시군구 분기 드릴다운은 아직 샘플(목업) — 추후 A_2024_00018 연동 예정.
 */

const C = {
  ink:"#161A22", sub:"#5B6472", faint:"#9AA3B2", line:"#E6E8EE",
  paper:"#F4F6F9", brand:"#1F3A5F",
  up:"#C5283D", down:"#1F6FD8", flat:"#7A8494",
  warnBg:"#FCEDEE", warnFg:"#A21B2B", cautBg:"#FFF6E6", cautFg:"#9A6B00", okBg:"#EAF4EC", okFg:"#2E7D43",
};
const font = `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", system-ui, sans-serif`;

// 시군구 분기 지수 — 아직 샘플 (지역 분석 탭 드릴다운용)
const SIGUNGU = {
  서울:[["강남",192.3,1.10,520],["서초",188.7,0.80,410],["송파",181.2,0.60,480],["용산",184.5,0.95,210],["마포",172.4,0.30,360],["노원",158.9,-0.40,290]],
  경기:[["과천",171.2,0.85,90],["성남",165.1,0.70,610],["용인",146.9,0.40,580],["수원",148.3,0.20,720],["고양",141.7,-0.10,540]],
  인천:[["연수",139.8,0.45,420],["서구",132.1,0.10,510],["남동",128.4,-0.20,380]],
  부산:[["해운대",132.6,0.20,310],["수영",128.9,0.05,180],["부산진",118.2,-0.35,290]],
};

const won = (n) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const pct = (n) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const pct1 = (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const colorFor = (n) => (n > 0.02 ? C.up : n < -0.02 ? C.down : C.flat);

function riskOf(d) {
  if (d.chg < -0.2 && d.volChg < -3) return { tier:"경고", bg:C.warnBg, fg:C.warnFg, reason:"가격 하락 + 거래 위축 동반 — 담보가치·환금성 약화 신호" };
  if (d.chg < 0 || d.volChg < -2) return { tier:"주의", bg:C.cautBg, fg:C.cautFg, reason: d.chg < 0 ? "가격지수 하락 전환" : "거래량 위축" };
  return { tier:"안정", bg:C.okBg, fg:C.okFg, reason:"가격·거래 동반 양호" };
}

export default function App() {
  const [state, setState] = useState({ loading: true, error: null, d: null });
  const [tab, setTab] = useState("개요");

  useEffect(() => {
    fetch("/api/reb")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setState({ loading: false, error: d.error, d: null });
        else setState({ loading: false, error: null, d });
      })
      .catch((e) => setState({ loading: false, error: String(e), d: null }));
  }, []);

  const { loading, error, d } = state;
  const tabs = ["개요", "지역 분석", "리스크 모니터"];

  return (
    <div style={{ fontFamily: font, background: C.paper, color: C.ink, minHeight: "100vh", padding: 20 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:12, letterSpacing:"0.14em", color:C.brand, fontWeight:700, marginBottom:4 }}>APARTMENT MARKET MONITOR</div>
            <h1 style={{ fontSize:25, fontWeight:800, margin:0, letterSpacing:"-0.02em" }}>아파트 시장 모니터링</h1>
          </div>
          <div style={{ textAlign:"right", fontSize:12, color:C.sub, lineHeight:1.7 }}>
            <div><b style={{ color:C.ink }}>한국부동산원</b> R-ONE 실시간 연동</div>
            <div>{d ? `${d.latestMonth} 공표 기준` : "데이터 불러오는 중…"}</div>
          </div>
        </div>

        {loading && <Splash text="부동산원에서 최신 자료를 불러오는 중…" />}
        {error && <ErrorBox msg={error} />}

        {d && (
          <>
            <div style={{ display:"flex", gap:4, borderBottom:`1px solid ${C.line}`, marginBottom:16 }}>
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  fontSize:13.5, fontWeight:700, padding:"9px 16px", cursor:"pointer", border:"none", background:"none",
                  color: tab===t ? C.brand : C.faint, borderBottom:`2px solid ${tab===t ? C.brand : "transparent"}`, marginBottom:-1 }}>{t}</button>
              ))}
            </div>

            {tab==="개요" && <Overview d={d} />}
            {tab==="지역 분석" && <Regional d={d} />}
            {tab==="리스크 모니터" && <RiskMonitor d={d} />}

            <div style={{ fontSize:11, color:C.faint, marginTop:14, lineHeight:1.6 }}>
              집계기준: 한국부동산원 부동산거래현황(기집계) — 국토부 실거래가 공개시스템과 집계기준 상이.
              상승=빨강 / 하락=파랑. 최신월은 신고지연으로 잠정치. 시군구 분기 데이터는 일부 샘플.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ d }) {
  const upCount = d.regions.filter((r) => r.chg > 0).length;
  const downCount = d.regions.filter((r) => r.chg < 0).length;
  const top = [...d.regions].filter(r=>r.idx!=null).sort((a, b) => b.chg - a.chg)[0];

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12, marginBottom:14 }}>
        <Kpi label="전국 아파트 실거래가격지수" value={d.nationalIndex?.toFixed(1) ?? "—"} sub="2017.11 = 100" note="최신 공표"/>
        <Kpi label="아파트 매매거래 (전국·월)" value={won(d.nationalVol)} sub="단위: 호" note="최신 공표"/>
        <Kpi label="상승 / 하락 지역" value={`${upCount} / ${downCount}`} sub="17개 시·도 중" chip={upCount>downCount?"상승우세":downCount>upCount?"하락우세":"혼조"} chipColor={C.flat} note="지수 전월비"/>
        <Kpi label="최고 상승 지역" value={top?.name ?? "—"} sub={top?pct(top.chg):""} chip="상승률 1위" chipColor={C.up} note="지수 전월비"/>
      </div>

      <Card>
        <CardHead title="가격지수 vs 거래량" right={<span style={{ fontSize:11, color:C.faint }}>디커플링 = 시장 전환 신호</span>}/>
        <div style={{ height:250, marginTop:6 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={d.series} margin={{ top:10, right:8, left:-8, bottom:0 }}>
              <CartesianGrid stroke={C.line} vertical={false}/>
              <XAxis dataKey="ym" tick={{ fontSize:10.5, fill:C.faint }} axisLine={false} tickLine={false}/>
              <YAxis yAxisId="L" tick={{ fontSize:10.5, fill:C.faint }} axisLine={false} tickLine={false} domain={["auto","auto"]}/>
              <YAxis yAxisId="R" orientation="right" tick={{ fontSize:10.5, fill:C.faint }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ fontFamily:font, fontSize:12, borderRadius:8, border:`1px solid ${C.line}` }}/>
              <Legend wrapperStyle={{ fontSize:11.5, fontFamily:font }}/>
              <Bar yAxisId="R" dataKey="vol" name="거래호수" fill="#D7DEE8" radius={[3,3,0,0]} barSize={16}/>
              <Line yAxisId="L" type="monotone" dataKey="index" name="가격지수" stroke={C.brand} strokeWidth={2.4} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize:11, color:C.faint, marginTop:4 }}>최근월 거래량은 신고지연으로 <b style={{ color:C.sub }}>잠정치</b>.</div>
      </Card>
    </>
  );
}

function Regional({ d }) {
  const [sido, setSido] = useState("서울");
  const [metric, setMetric] = useState("vol");
  const valid = d.regions.filter((r) => (metric==="vol" ? r.vol!=null : r.idx!=null));
  const sorted = useMemo(() => [...valid].sort((a,b)=> metric==="vol" ? b.vol-a.vol : b.chg-a.chg), [metric, d]);
  const maxVol = Math.max(...valid.map((r)=>r.vol||0), 1);
  const maxAbs = Math.max(...valid.map((r)=>Math.abs(r.chg)||0), 0.1);
  const gu = SIGUNGU[sido];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <Card>
        <CardHead title="시·도별 현황 (월)" right={
          <div style={{ display:"flex", gap:6 }}>
            <Mini label="거래호수" active={metric==="vol"} onClick={()=>setMetric("vol")}/>
            <Mini label="지수변동률" active={metric==="chg"} onClick={()=>setMetric("chg")}/>
          </div>}/>
        <div style={{ marginTop:8, maxHeight:330, overflowY:"auto", paddingRight:4 }}>
          {sorted.map((r) => {
            const isVol = metric==="vol";
            const w = isVol ? (r.vol/maxVol)*100 : (Math.abs(r.chg)/maxAbs)*100;
            const col = isVol ? C.brand : colorFor(r.chg);
            const has = !!SIGUNGU[r.name];
            return (
              <div key={r.name} onClick={()=>has&&setSido(r.name)} style={{ display:"grid", gridTemplateColumns:"58px 1fr 64px", alignItems:"center", gap:8, padding:"5px 0", cursor:has?"pointer":"default" }}>
                <span style={{ fontSize:12.5, fontWeight:sido===r.name?800:600, color:sido===r.name?C.brand:C.ink }}>{r.name}{has&&<span style={{ fontSize:9, color:C.faint }}> ▸</span>}</span>
                <div style={{ background:"#EEF1F5", borderRadius:5, height:16, overflow:"hidden" }}>
                  <div style={{ width:`${w}%`, height:"100%", background:col, borderRadius:5, transition:"width .3s" }}/>
                </div>
                <span style={{ fontSize:12, textAlign:"right", fontVariantNumeric:"tabular-nums", color:isVol?C.sub:col, fontWeight:600 }}>{isVol?won(r.vol):pct(r.chg)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead title={`${sido} 시·군·구 (분기)`} right={<span style={{ fontSize:11, color:C.faint }}>샘플 데이터</span>}/>
        {gu ? (
          <div style={{ marginTop:8 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 64px", gap:8, fontSize:10.5, color:C.faint, fontWeight:600, padding:"0 0 6px", borderBottom:`1px solid ${C.line}` }}>
              <span>지역</span><span style={{textAlign:"right"}}>지수</span><span style={{textAlign:"right"}}>분기변동</span><span style={{textAlign:"right"}}>거래호수</span>
            </div>
            {gu.slice().sort((a,b)=>b[1]-a[1]).map(([n,idx,chg,vol]) => (
              <div key={n} style={{ display:"grid", gridTemplateColumns:"1fr 70px 70px 64px", gap:8, fontSize:12.5, padding:"7px 0", borderBottom:"1px solid #F2F4F7", fontVariantNumeric:"tabular-nums" }}>
                <span style={{fontWeight:600}}>{n}</span>
                <span style={{textAlign:"right"}}>{idx.toFixed(1)}</span>
                <span style={{textAlign:"right", color:colorFor(chg), fontWeight:600}}>{pct(chg)}</span>
                <span style={{textAlign:"right", color:C.sub}}>{won(vol)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop:30, textAlign:"center", fontSize:12.5, color:C.faint }}>
            {sido}는 시·군·구 샘플이 아직 없어요.<br/><span style={{ fontSize:11 }}>좌측에서 ▸ 표시된 시·도를 선택하세요.</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function RiskMonitor({ d }) {
  const scored = d.regions.filter(r=>r.idx!=null).map((r) => ({ ...r, risk: riskOf(r) }));
  const order = { 경고:0, 주의:1, 안정:2 };
  scored.sort((a,b)=>order[a.risk.tier]-order[b.risk.tier]);
  const counts = scored.reduce((m,d)=>{ m[d.risk.tier]=(m[d.risk.tier]||0)+1; return m; }, {});

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
        <RiskCount tier="경고" n={counts["경고"]||0} bg={C.warnBg} fg={C.warnFg} desc="가격↓ + 거래 위축"/>
        <RiskCount tier="주의" n={counts["주의"]||0} bg={C.cautBg} fg={C.cautFg} desc="가격 또는 거래 약화"/>
        <RiskCount tier="안정" n={counts["안정"]||0} bg={C.okBg} fg={C.okFg} desc="동반 양호"/>
      </div>
      <Card>
        <CardHead title="지역별 시장 신호" right={<span style={{ fontSize:11, color:C.faint }}>담보가치·환금성 모니터링 관점</span>}/>
        <div style={{ marginTop:8 }}>
          {scored.map((r) => (
            <div key={r.name} style={{ display:"grid", gridTemplateColumns:"56px 64px 1fr 92px", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #F2F4F7" }}>
              <span style={{ fontSize:13, fontWeight:700 }}>{r.name}</span>
              <span style={{ fontSize:11, fontWeight:700, textAlign:"center", padding:"3px 0", borderRadius:6, background:r.risk.bg, color:r.risk.fg }}>{r.risk.tier}</span>
              <span style={{ fontSize:12, color:C.sub }}>{r.risk.reason}</span>
              <span style={{ fontSize:11.5, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>
                <span style={{ color:colorFor(r.chg) }}>{pct(r.chg)}</span>
                <span style={{ color:C.faint }}> / 거래 </span>
                <span style={{ color:r.volChg<0?C.down:C.up }}>{pct1(r.volChg)}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.faint, marginTop:10, lineHeight:1.6 }}>
          판정(결정적): 지수 전월비 &lt; −0.2% <b>그리고</b> 거래 전월비 &lt; −3% → 경고. 시장 모니터링 신호이며 개별 여신 판단을 대체하지 않습니다.
        </div>
      </Card>
    </>
  );
}

function Splash({ text }) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.line}`, borderRadius:14, padding:"50px 20px", textAlign:"center", color:C.sub, fontSize:13.5 }}>
      <div style={{ width:26, height:26, border:`3px solid ${C.line}`, borderTopColor:C.brand, borderRadius:"50%", margin:"0 auto 14px", animation:"spin 0.8s linear infinite" }}/>
      {text}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function ErrorBox({ msg }) {
  return (
    <div style={{ background:C.warnBg, border:`1px solid #F0C9CE`, borderRadius:14, padding:"18px 20px", color:C.warnFg, fontSize:13 }}>
      데이터를 불러오지 못했어요. Vercel 환경변수 <b>REB_KEY</b>가 설정됐는지 확인해 주세요.<br/>
      <span style={{ fontSize:11, opacity:0.8 }}>상세: {msg}</span>
    </div>
  );
}
function Card({ children, accent }) { return <div style={{ background:"#fff", border:`1px solid ${accent?"#D9E2EF":"#EAEDF2"}`, borderRadius:14, padding:16, boxShadow:"0 1px 2px rgba(20,24,34,0.03)" }}>{children}</div>; }
function CardHead({ title, right }) { return <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>{title}</h3>{right}</div>; }
function Kpi({ label, value, sub, chip, chipColor, note }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #EAEDF2", borderRadius:14, padding:"14px 15px" }}>
      <div style={{ fontSize:11.5, color:"#5B6472", marginBottom:8, fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
        <span style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.02em", fontVariantNumeric:"tabular-nums" }}>{value}</span>
        {chip && <span style={{ fontSize:11, color:chipColor, fontWeight:700 }}>{chip}</span>}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        <span style={{ fontSize:10.5, color:"#9AA3B2" }}>{sub}</span>
        <span style={{ fontSize:10.5, color:"#9AA3B2" }}>{note}</span>
      </div>
    </div>
  );
}
function RiskCount({ tier, n, bg, fg, desc }) {
  return (
    <div style={{ background:bg, borderRadius:14, padding:"14px 16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
        <span style={{ fontSize:13, fontWeight:800, color:fg }}>{tier}</span>
        <span style={{ fontSize:26, fontWeight:800, color:fg, fontVariantNumeric:"tabular-nums" }}>{n}</span>
      </div>
      <div style={{ fontSize:11, color:fg, opacity:0.8, marginTop:2 }}>{desc}</div>
    </div>
  );
}
function Mini({ label, active, onClick }) {
  return <button onClick={onClick} style={{ fontSize:11.5, fontWeight:600, padding:"4px 9px", borderRadius:7, cursor:"pointer", border:`1px solid ${active?"#1F3A5F":"#E6E8EE"}`, background:active?"#EEF3F9":"#fff", color:active?"#1F3A5F":"#9AA3B2" }}>{label}</button>;
}
