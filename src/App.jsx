import React, { useState, useMemo } from "react";
import {
  ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

/*
 * 아파트 시장 모니터링 대시보드 (프로토타입 v2)
 * 데이터 출처: 한국부동산원 부동산통계 조회 서비스 (data.go.kr/data/15134761)
 *   - 실거래가격지수: 공동주택 실거래가격지수 (월: 시·도 / 분기: 시·군·구)
 *   - 거래현황: 부동산거래현황 (행정구역별 아파트 매매거래호수)
 * 원칙: 모든 변동률·집계·리스크 판정은 결정적 로직(백엔드 Python)에서.
 *       LLM(Alli)은 'AI 브리핑' 텍스트 생성에만 사용 — 숫자 계산은 LLM이 만지지 않음.
 */

const C = {
  ink: "#161A22", sub: "#5B6472", faint: "#9AA3B2", line: "#E6E8EE",
  paper: "#F4F6F9", brand: "#1F3A5F",
  up: "#C5283D", down: "#1F6FD8", flat: "#7A8494",
  warnBg: "#FCEDEE", warnFg: "#A21B2B",
  cautBg: "#FFF6E6", cautFg: "#9A6B00",
  okBg: "#EAF4EC", okFg: "#2E7D43",
};

const SIDO = [
  ["서울",178.4,0.41,4180,6.2],["경기",142.7,0.28,8640,4.1],
  ["인천",131.5,0.19,2310,-1.4],["부산",121.3,-0.12,1880,-3.0],
  ["대구",108.9,-0.34,1240,-5.6],["대전",126.8,0.22,980,2.8],
  ["광주",112.4,-0.08,760,-2.1],["울산",118.6,0.15,540,1.2],
  ["세종",134.2,0.52,410,9.4],["강원",109.7,0.06,690,0.3],
  ["충북",114.1,0.11,720,1.9],["충남",116.5,0.18,910,2.4],
  ["전북",107.2,-0.21,580,-3.8],["전남",105.8,-0.15,520,-2.6],
  ["경북",104.3,-0.29,870,-4.7],["경남",110.6,-0.05,1130,-1.1],
  ["제주",122.9,0.09,240,0.7],
].map(([name,idx,chg,vol,volChg])=>({name,idx,chg,vol,volChg}));

const MONTHS=["'24.07","'24.08","'24.09","'24.10","'24.11","'24.12","'25.01","'25.02","'25.03","'25.04","'25.05"];
const NAT_IDX=[148.1,148.6,148.9,149.4,150.1,150.8,151.0,151.5,152.2,152.9,153.4];
const NAT_VOL=[21500,23800,25100,24600,22900,20800,22400,25900,28200,27100,26600];

// 시군구 분기 데이터 (일부 시도) — [구, 분기지수, 분기변동률, 거래호수]
const SIGUNGU={
  서울:[["강남",192.3,1.10,520],["서초",188.7,0.80,410],["송파",181.2,0.60,480],["용산",184.5,0.95,210],["마포",172.4,0.30,360],["노원",158.9,-0.40,290],["강북",151.3,-0.70,180]],
  경기:[["과천",171.2,0.85,90],["성남",165.1,0.70,610],["용인",146.9,0.40,580],["수원",148.3,0.20,720],["고양",141.7,-0.10,540],["부천",138.2,-0.30,430]],
  인천:[["연수",139.8,0.45,420],["서구",132.1,0.10,510],["남동",128.4,-0.20,380],["미추홀",124.9,-0.55,260]],
  부산:[["해운대",132.6,0.20,310],["수영",128.9,0.05,180],["부산진",118.2,-0.35,290],["사하",112.4,-0.60,210]],
};

const won=(n)=>n.toLocaleString("ko-KR");
const pct=(n)=>`${n>0?"+":""}${n.toFixed(2)}%`;
const colorFor=(n)=>(n>0.02?C.up:n<-0.02?C.down:C.flat);
const font=`-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", system-ui, sans-serif`;

// 결정적 리스크 판정 (백엔드 Python에서 수행할 로직의 프로토타입)
function riskOf(d){
  if(d.chg<-0.2 && d.volChg<-3) return {tier:"경고",bg:C.warnBg,fg:C.warnFg,
    reason:"가격 하락 + 거래 위축 동반 — 담보가치·환금성 동반 약화 신호"};
  if(d.chg<0 || d.volChg<-2) return {tier:"주의",bg:C.cautBg,fg:C.cautFg,
    reason:d.chg<0?"가격지수 하락 전환":"거래량 위축"};
  return {tier:"안정",bg:C.okBg,fg:C.okFg,reason:"가격·거래 동반 양호"};
}

export default function Dashboard(){
  const [tab,setTab]=useState("개요");
  const tabs=["개요","지역 분석","리스크 모니터"];
  return(
    <div style={{fontFamily:font,background:C.paper,color:C.ink,minHeight:"100%",padding:20}}>
      <div style={{maxWidth:1080,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12,marginBottom:14}}>
          <div>
            <div style={{fontSize:12,letterSpacing:"0.14em",color:C.brand,fontWeight:700,marginBottom:4}}>APARTMENT MARKET MONITOR</div>
            <h1 style={{fontSize:25,fontWeight:800,margin:0,letterSpacing:"-0.02em"}}>아파트 시장 모니터링</h1>
          </div>
          <div style={{textAlign:"right",fontSize:12,color:C.sub,lineHeight:1.7}}>
            <div><b style={{color:C.ink}}>한국부동산원</b> 부동산통계 조회 서비스</div>
            <div>실거래가격지수 ’25.05 · 거래현황 ’25.05 공표 기준</div>
          </div>
        </div>

        {/* 탭 */}
        <div style={{display:"flex",gap:4,borderBottom:`1px solid ${C.line}`,marginBottom:16}}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              fontSize:13.5,fontWeight:700,padding:"9px 16px",cursor:"pointer",
              border:"none",background:"none",color:tab===t?C.brand:C.faint,
              borderBottom:`2px solid ${tab===t?C.brand:"transparent"}`,marginBottom:-1}}>{t}</button>
          ))}
        </div>

        {tab==="개요" && <Overview/>}
        {tab==="지역 분석" && <Regional/>}
        {tab==="리스크 모니터" && <RiskMonitor/>}

        <div style={{fontSize:11,color:C.faint,marginTop:14,lineHeight:1.6}}>
          집계기준: 한국부동산원 부동산거래현황(기집계 통계) — 국토부 실거래가 공개시스템과 집계·공개 기준 상이.
          상승=빨강 / 하락=파랑. 프로토타입 / 표시 수치는 목업.
        </div>
      </div>
    </div>
  );
}

/* ─────────── 탭 1: 개요 ─────────── */
function Overview(){
  const nationalVol=SIDO.reduce((s,d)=>s+d.vol,0);
  const combo=MONTHS.map((m,i)=>({ym:m,index:NAT_IDX[i],vol:NAT_VOL[i],provisional:i>=MONTHS.length-1}));
  return(
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
        <Kpi label="전국 아파트 실거래가격지수" value="153.4" sub="2017.11 = 100" chip="+0.37%" chipColor={C.up} note="전월비"/>
        <Kpi label="아파트 매매거래호수 (전국·월)" value={won(nationalVol)} sub="단위: 호" chip="+3.1%" chipColor={C.up} note="전월비"/>
        <Kpi label="상승 지역 / 하락 지역" value="9 / 8" sub="17개 시·도 중" chip="혼조" chipColor={C.flat} note="지수변동률 기준"/>
        <Kpi label="최고 변동 지역" value="세종" sub="+0.52%" chip="과열주의" chipColor={C.up} note="지수 상승률 1위"/>
      </div>

      <Card>
        <CardHead title="가격지수 vs 거래량" right={<span style={{fontSize:11,color:C.faint}}>디커플링 = 시장 전환 신호</span>}/>
        <div style={{height:250,marginTop:6}}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combo} margin={{top:10,right:8,left:-8,bottom:0}}>
              <CartesianGrid stroke={C.line} vertical={false}/>
              <XAxis dataKey="ym" tick={{fontSize:10.5,fill:C.faint}} axisLine={false} tickLine={false} interval={1}/>
              <YAxis yAxisId="L" tick={{fontSize:10.5,fill:C.faint}} axisLine={false} tickLine={false} domain={[146,156]}/>
              <YAxis yAxisId="R" orientation="right" tick={{fontSize:10.5,fill:C.faint}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{fontFamily:font,fontSize:12,borderRadius:8,border:`1px solid ${C.line}`}}/>
              <Legend wrapperStyle={{fontSize:11.5,fontFamily:font}}/>
              <Bar yAxisId="R" dataKey="vol" name="거래호수" fill="#D7DEE8" radius={[3,3,0,0]} barSize={16}/>
              <Line yAxisId="L" type="monotone" dataKey="index" name="가격지수" stroke={C.brand} strokeWidth={2.4} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{fontSize:11,color:C.faint,marginTop:4}}>최근월 거래량은 신고지연으로 <b style={{color:C.sub}}>잠정치</b> (계약 후 30일 내 신고).</div>
      </Card>

      <div style={{height:14}}/>
      <Card accent>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontSize:11,fontWeight:800,letterSpacing:"0.08em",color:C.brand,background:"#E8EEF6",padding:"3px 8px",borderRadius:6}}>AI 시장 브리핑</span>
          <span style={{fontSize:11,color:C.faint}}>on-prem LLM (Alli) 생성 · 수치는 룰엔진 계산값 인용</span>
        </div>
        <p style={{fontSize:13.5,lineHeight:1.75,margin:0}}>
          ’25년 5월 전국 아파트 실거래가격지수는 <b>153.4</b>(전월비 <b style={{color:C.up}}>+0.37%</b>)로 5개월 연속 상승했습니다.
          거래량은 다소 둔화돼 가격 상승세 대비 거래가 따라오지 못하는 <b>완만한 디커플링</b>이 관찰됩니다.
          수도권이 상승을 견인한 반면 대구·경북 등 지방은 가격 하락과 거래 위축이 겹쳐 <b style={{color:C.up}}>리스크 모니터</b> 점검이 필요합니다.
        </p>
      </Card>
    </>
  );
}

/* ─────────── 탭 2: 지역 분석 (시도→시군구 드릴다운) ─────────── */
function Regional(){
  const [sido,setSido]=useState("서울");
  const [metric,setMetric]=useState("vol");
  const sorted=useMemo(()=>{
    const a=[...SIDO];
    a.sort((x,y)=>metric==="vol"?y.vol-x.vol:y.chg-x.chg);
    return a;
  },[metric]);
  const maxVol=Math.max(...SIDO.map(d=>d.vol));
  const maxAbs=Math.max(...SIDO.map(d=>Math.abs(d.chg)));
  const gu=SIGUNGU[sido];

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <CardHead title="시·도별 현황 (월)" right={
          <div style={{display:"flex",gap:6}}>
            <Mini label="거래호수" active={metric==="vol"} onClick={()=>setMetric("vol")}/>
            <Mini label="지수변동률" active={metric==="chg"} onClick={()=>setMetric("chg")}/>
          </div>}/>
        <div style={{marginTop:8,maxHeight:330,overflowY:"auto",paddingRight:4}}>
          {sorted.map(d=>{
            const isVol=metric==="vol";
            const w=isVol?(d.vol/maxVol)*100:(Math.abs(d.chg)/maxAbs)*100;
            const col=isVol?C.brand:colorFor(d.chg);
            const has=!!SIGUNGU[d.name];
            return(
              <div key={d.name} onClick={()=>has&&setSido(d.name)}
                style={{display:"grid",gridTemplateColumns:"58px 1fr 64px",alignItems:"center",gap:8,padding:"5px 0",cursor:has?"pointer":"default",opacity:has?1:0.85}}>
                <span style={{fontSize:12.5,fontWeight:sido===d.name?800:600,color:sido===d.name?C.brand:C.ink}}>
                  {d.name}{has&&<span style={{fontSize:9,color:C.faint}}> ▸</span>}
                </span>
                <div style={{background:"#EEF1F5",borderRadius:5,height:16,overflow:"hidden"}}>
                  <div style={{width:`${w}%`,height:"100%",background:col,borderRadius:5,transition:"width .3s"}}/>
                </div>
                <span style={{fontSize:12,textAlign:"right",fontVariantNumeric:"tabular-nums",color:isVol?C.sub:col,fontWeight:600}}>
                  {isVol?won(d.vol):pct(d.chg)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHead title={`${sido} 시·군·구 (분기)`} right={<span style={{fontSize:11,color:C.faint}}>기준 2017.4Q=100</span>}/>
        {gu?(
          <div style={{marginTop:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 64px",gap:8,fontSize:10.5,color:C.faint,fontWeight:600,padding:"0 0 6px",borderBottom:`1px solid ${C.line}`}}>
              <span>지역</span><span style={{textAlign:"right"}}>지수</span><span style={{textAlign:"right"}}>분기변동</span><span style={{textAlign:"right"}}>거래호수</span>
            </div>
            {gu.slice().sort((a,b)=>b[1]-a[1]).map(([n,idx,chg,vol])=>(
              <div key={n} style={{display:"grid",gridTemplateColumns:"1fr 70px 70px 64px",gap:8,fontSize:12.5,padding:"7px 0",borderBottom:`1px solid #F2F4F7`,fontVariantNumeric:"tabular-nums"}}>
                <span style={{fontWeight:600}}>{n}</span>
                <span style={{textAlign:"right"}}>{idx.toFixed(1)}</span>
                <span style={{textAlign:"right",color:colorFor(chg),fontWeight:600}}>{pct(chg)}</span>
                <span style={{textAlign:"right",color:C.sub}}>{won(vol)}</span>
              </div>
            ))}
          </div>
        ):(
          <div style={{marginTop:30,textAlign:"center",fontSize:12.5,color:C.faint}}>
            {sido}는 시·군·구 분기 데이터 준비 중입니다.<br/>
            <span style={{fontSize:11}}>좌측에서 ▸ 표시된 시·도를 선택하세요.</span>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─────────── 탭 3: 리스크 모니터 ─────────── */
function RiskMonitor(){
  const scored=SIDO.map(d=>({...d,risk:riskOf(d)}));
  const order={경고:0,주의:1,안정:2};
  scored.sort((a,b)=>order[a.risk.tier]-order[b.risk.tier]);
  const counts=scored.reduce((m,d)=>{m[d.risk.tier]=(m[d.risk.tier]||0)+1;return m;},{});

  return(
    <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
        <RiskCount tier="경고" n={counts["경고"]||0} bg={C.warnBg} fg={C.warnFg} desc="가격↓ + 거래 위축"/>
        <RiskCount tier="주의" n={counts["주의"]||0} bg={C.cautBg} fg={C.cautFg} desc="가격 또는 거래 약화"/>
        <RiskCount tier="안정" n={counts["안정"]||0} bg={C.okBg} fg={C.okFg} desc="동반 양호"/>
      </div>

      <Card>
        <CardHead title="지역별 시장 신호" right={<span style={{fontSize:11,color:C.faint}}>담보가치·환금성 모니터링 관점</span>}/>
        <div style={{marginTop:8}}>
          {scored.map(d=>(
            <div key={d.name} style={{display:"grid",gridTemplateColumns:"56px 64px 1fr 88px",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid #F2F4F7`}}>
              <span style={{fontSize:13,fontWeight:700}}>{d.name}</span>
              <span style={{fontSize:11,fontWeight:700,textAlign:"center",padding:"3px 0",borderRadius:6,background:d.risk.bg,color:d.risk.fg}}>{d.risk.tier}</span>
              <span style={{fontSize:12,color:C.sub}}>{d.risk.reason}</span>
              <span style={{fontSize:11.5,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>
                <span style={{color:colorFor(d.chg)}}>{pct(d.chg)}</span>
                <span style={{color:C.faint}}> / 거래 </span>
                <span style={{color:d.volChg<0?C.down:C.up}}>{d.volChg>0?"+":""}{d.volChg}%</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:C.faint,marginTop:10,lineHeight:1.6}}>
          판정 로직(결정적): 지수 전월비 &lt; −0.2% <b>그리고</b> 거래 전월비 &lt; −3% → 경고. 임계치는 RegConfig처럼 외부화하여 운영 중 조정 가능.
          시장 모니터링 신호이며 개별 여신 판단을 대체하지 않습니다.
        </div>
      </Card>
    </>
  );
}

/* ─────────── 공통 컴포넌트 ─────────── */
function Card({children,accent}){return(
  <div style={{background:"#fff",border:`1px solid ${accent?"#D9E2EF":"#EAEDF2"}`,borderRadius:14,padding:16,boxShadow:"0 1px 2px rgba(20,24,34,0.03)"}}>{children}</div>
);}
function CardHead({title,right}){return(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
    <h3 style={{fontSize:14,fontWeight:700,margin:0}}>{title}</h3>{right}
  </div>
);}
function Kpi({label,value,sub,chip,chipColor,note}){return(
  <div style={{background:"#fff",border:"1px solid #EAEDF2",borderRadius:14,padding:"14px 15px"}}>
    <div style={{fontSize:11.5,color:"#5B6472",marginBottom:8,fontWeight:600}}>{label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
      <span style={{fontSize:24,fontWeight:800,letterSpacing:"-0.02em",fontVariantNumeric:"tabular-nums"}}>{value}</span>
      <span style={{fontSize:11,color:chipColor,fontWeight:700}}>{chip}</span>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
      <span style={{fontSize:10.5,color:"#9AA3B2"}}>{sub}</span>
      <span style={{fontSize:10.5,color:"#9AA3B2"}}>{note}</span>
    </div>
  </div>
);}
function RiskCount({tier,n,bg,fg,desc}){return(
  <div style={{background:bg,borderRadius:14,padding:"14px 16px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
      <span style={{fontSize:13,fontWeight:800,color:fg}}>{tier}</span>
      <span style={{fontSize:26,fontWeight:800,color:fg,fontVariantNumeric:"tabular-nums"}}>{n}</span>
    </div>
    <div style={{fontSize:11,color:fg,opacity:0.8,marginTop:2}}>{desc}</div>
  </div>
);}
function Mini({label,active,onClick}){return(
  <button onClick={onClick} style={{fontSize:11.5,fontWeight:600,padding:"4px 9px",borderRadius:7,cursor:"pointer",
    border:`1px solid ${active?"#1F3A5F":"#E6E8EE"}`,background:active?"#EEF3F9":"#fff",color:active?"#1F3A5F":"#9AA3B2"}}>{label}</button>
);}
