import React, { useState, useEffect, useRef } from 'react';
import BottomNav from './components/BottomNav';
import { Bell, Search, Cloud, ChevronRight, Edit3, FileText, Map, Briefcase, MapPin, Clock, ArrowLeft, Star, TrendingUp, Award, BookOpen, ExternalLink } from 'lucide-react';
import { analyzeCV, submitQuiz, fetchJobs } from './lib/api';
import './App.css';

// ─── Animations CSS (injected once) ─────────────────────────────────────────
const ANIM_CSS = `
@keyframes fadeSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
@keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
@keyframes scaleIn { from{transform:scale(0.85);opacity:0;} to{transform:scale(1);opacity:1;} }
@keyframes spin { to{transform:rotate(360deg);} }
@keyframes countUp { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
@keyframes progressFill { from{width:0%;} to{width:var(--target-w);} }
.anim-fadeup { animation: fadeSlideUp 0.4s cubic-bezier(0.4,0,0.2,1) both; }
.anim-scalein { animation: scaleIn 0.35s cubic-bezier(0.4,0,0.2,1) both; }
.anim-fadein { animation: fadeIn 0.3s ease both; }
.anim-delay-1 { animation-delay: 0.05s; }
.anim-delay-2 { animation-delay: 0.10s; }
.anim-delay-3 { animation-delay: 0.15s; }
.anim-delay-4 { animation-delay: 0.20s; }
.anim-delay-5 { animation-delay: 0.25s; }
.spinner { width:36px;height:36px;border:3px solid rgba(43,127,255,0.15);border-top-color:#2b7fff;border-radius:50%;animation:spin 0.8s linear infinite; }
.skeleton { background:linear-gradient(90deg,#1e2533 25%,#253044 50%,#1e2533 75%);background-size:200% 100%;animation:shimmer 1.4s infinite; border-radius:8px; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const LOGO_COLORS = ['#2b7fff','#10b981','#8b5cf6','#f59e0b','#06b6d4','#ef4444','#ec4899'];
function logoColor(str) { let h=0; for(let c of (str||'')) h=(h*31+c.charCodeAt(0))&0xffffffff; return LOGO_COLORS[Math.abs(h)%LOGO_COLORS.length]; }

function formatSalary(from, to, currency) {
  const c = currency === 'RUR' ? '₽' : (currency ?? '');
  if (from && to) return `${(from/1000).toFixed(0)}k–${(to/1000).toFixed(0)}k ${c}`;
  if (from) return `${(from/1000).toFixed(0)}k+ ${c}`;
  if (to) return `≤${(to/1000).toFixed(0)}k ${c}`;
  return 'Maaş göstərilməyib';
}

function stripHtml(s) { return (s||'').replace(/<[^>]+>/g,''); }

// ─── Animated Score Ring ─────────────────────────────────────────────────────
function ScoreRing({ score, size=120, stroke=8 }) {
  const [displayed, setDisplayed] = useState(0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  useEffect(() => {
    let start = null;
    const duration = 900;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setDisplayed(Math.round(p * score));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score]);
  const dash = (displayed / 100) * circ;
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} style={{transition:'stroke-dasharray 0.05s'}}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="central"
        style={{fill:'#fff',fontSize:size*0.22,fontWeight:800,transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`}}>
        {displayed}%
      </text>
    </svg>
  );
}

// ─── Skill Badge ─────────────────────────────────────────────────────────────
function SkillBadge({ skill, delay=0 }) {
  return (
    <span className="badge anim-scalein" style={{animationDelay:`${delay}s`}}>{skill}</span>
  );
}

// ─── HOME VIEW ───────────────────────────────────────────────────────────────
const HomeView = ({ profileData, onJobClick, jobs }) => {
  const name = profileData?.resumeAnalysis?.name ?? 'Sarah Chen';
  const firstName = name.split(' ')[0];
  const skills = profileData?.resumeAnalysis?.current_skills ?? [];
  const spec = profileData?.gapAnalysis?.specialization_name ?? null;
  const score = profileData?.gapAnalysis?.readiness_score ?? null;
  const level = profileData?.resumeAnalysis?.experience_level ?? null;
  const summary = profileData?.resumeAnalysis?.summary ?? null;
  const analysisReady = !!profileData?.scores;

  const topJobs = (jobs || []).slice(0, 3);

  return (
    <div className="view-content fade-in">
      <div className="header anim-fadeup">
        <div className="user-profile-sm">
          <div className="avatar-square">{firstName[0]?.toUpperCase()}</div>
          <div className="user-info">
            <p className="greeting">Salam, {firstName}</p>
            <p className="sub-greeting">{spec ? `${spec} · ${level?.toUpperCase()}` : 'Karyera mərkəzinizə xoş gəldiniz'}</p>
          </div>
        </div>
        <button className="icon-btn-circle"><Bell size={20}/></button>
      </div>

      {/* Analysis result card */}
      {analysisReady && (
        <div className="glass-card anim-fadeup anim-delay-1" style={{display:'flex',alignItems:'center',gap:'20px',marginBottom:'20px'}}>
          <ScoreRing score={profileData.scores.final_score} size={80} stroke={6}/>
          <div style={{flex:1}}>
            <p style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'}}>Bazar hazırlığı</p>
            <p style={{fontSize:'16px',fontWeight:'700',marginBottom:'4px'}}>{profileData.scores.level}</p>
            <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>Test: {profileData.scores.quiz_score}% · CV: {profileData.scores.resume_score}%</p>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && !analysisReady && (
        <div className="glass-card anim-fadeup anim-delay-1" style={{marginBottom:'16px',borderLeft:'3px solid #2b7fff'}}>
          <p style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:'1.6'}}>{summary}</p>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="glass-card anim-fadeup anim-delay-2" style={{marginBottom:'16px'}}>
          <h3 style={{marginBottom:'12px'}}>🎯 Bacarıqlarınız</h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
            {skills.slice(0,8).map((s,i) => <SkillBadge key={s} skill={s} delay={i*0.04}/>)}
          </div>
        </div>
      )}

      {/* Score if analyzed but no quiz yet */}
      {score !== null && !analysisReady && (
        <div className="glass-card anim-fadeup anim-delay-2" style={{marginBottom:'16px',textAlign:'center'}}>
          <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'8px'}}>CV Hazırlıq Balı</p>
          <div style={{display:'flex',justifyContent:'center'}}><ScoreRing score={score} size={100} stroke={7}/></div>
          <p style={{fontSize:'13px',marginTop:'8px',color:'var(--text-secondary)'}}>Dəqiq nəticə üçün testi keçin</p>
        </div>
      )}

      {/* Top jobs */}
      {topJobs.length > 0 && (
        <>
          <div className="section-title anim-fadeup anim-delay-3"><h3>Tövsiyə olunan vakansiyalar</h3></div>
          {topJobs.map((job, i) => (
            <div key={job.id} className="job-card glass-card anim-fadeup" style={{animationDelay:`${0.15+i*0.05}s`,cursor:'pointer'}} onClick={()=>onJobClick(job)}>
              <div className="job-header">
                <div className="company-logo" style={{background:logoColor(job.employer)}}>{job.employer?.[0]?.toUpperCase()}</div>
                <div className="job-meta">
                  <h4>{job.name}</h4>
                  <p className="company-name">{job.employer}</p>
                  <p className="job-location">📍 {job.area}</p>
                </div>
              </div>
              <div className="job-footer">
                <p className="salary">{formatSalary(job.salary_from,job.salary_to,job.currency)}</p>
                <span style={{fontSize:'12px',padding:'4px 10px',borderRadius:'100px',background:'rgba(43,127,255,0.1)',color:'#2b7fff',border:'1px solid rgba(43,127,255,0.2)'}}>{job.spec_name}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty state */}
      {skills.length === 0 && !analysisReady && (
        <div className="empty-state glass-card anim-fadeup anim-delay-2">
          <TrendingUp size={48} className="empty-icon"/>
          <h3>Analiz üçün CV yükləyin</h3>
          <p>CV-nizi yükləyin, AI bacarıqlarınızı analiz etsin və karyera yolunuzu müəyyən etsin.</p>
        </div>
      )}
    </div>
  );
};

// ─── JOBS VIEW ───────────────────────────────────────────────────────────────
const SPEC_FILTERS = [
  {label:'Hamısı', value:null},
  {label:'Python', value:'python_developer'},
  {label:'Frontend', value:'frontend_developer'},
  {label:'Data', value:'data_analyst'},
];

const JobsView = ({ onJobClick, jobs, loading }) => {
  const [activeFilter, setActiveFilter] = useState(null);
  const [search, setSearch] = useState('');

  // Pick 20 diverse jobs
  const TOP20 = (jobs||[]).slice(0,20);

  const filtered = TOP20.filter(v => {
    const matchSpec = !activeFilter || v.specialization === activeFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || v.name?.toLowerCase().includes(q) || v.employer?.toLowerCase().includes(q);
    return matchSpec && matchSearch;
  });

  return (
    <div className="view-content fade-in">
      <h1 className="anim-fadeup">Vakansiyalar</h1>
      <div className="search-container anim-fadeup anim-delay-1">
        <div className="search-bar glass-card">
          <Search size={20} className="search-icon"/>
          <input type="text" placeholder="Vakansiya, şirkət axtar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>
      <div className="filter-scroll anim-fadeup anim-delay-2">
        {SPEC_FILTERS.map(f=>(
          <span key={f.label} className={`filter-chip ${activeFilter===f.value?'active':''}`} onClick={()=>setActiveFilter(f.value)} style={{cursor:'pointer'}}>{f.label}</span>
        ))}
      </div>

      {loading ? (
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:'120px',borderRadius:'24px'}}/>)}
        </div>
      ) : (
        <div className="job-list">
          {filtered.length === 0 && (
            <div className="empty-state glass-card"><Search size={40} className="empty-icon"/><h3>Nəticə tapılmadı</h3></div>
          )}
          {filtered.map((job,i)=>(
            <div key={job.id} className="job-card glass-card anim-fadeup" style={{animationDelay:`${i*0.04}s`,cursor:'pointer'}} onClick={()=>onJobClick(job)}>
              <div className="job-header">
                <div className="company-logo" style={{background:logoColor(job.employer)}}>{job.employer?.[0]?.toUpperCase()}</div>
                <div className="job-meta">
                  <h4>{job.name}</h4>
                  <p className="company-name">{job.employer}</p>
                  <p className="job-location">📍 {job.area}</p>
                </div>
                <button className="bookmark-btn" onClick={e=>e.stopPropagation()}>🔖</button>
              </div>
              {job.requirement && <p style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'12px',lineHeight:'1.5'}}>{stripHtml(job.requirement).slice(0,110)}...</p>}
              <div className="job-footer">
                <p className="salary">{formatSalary(job.salary_from,job.salary_to,job.currency)}</p>
                <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${logoColor(job.employer)}22`,color:logoColor(job.employer),border:`1px solid ${logoColor(job.employer)}44`}}>{job.experience}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── JOB DETAIL ──────────────────────────────────────────────────────────────
const JobDetailView = ({ job, onBack, userSkills }) => (
  <div className="view-content detail-view fade-in">
    <div className="detail-header">
      <button className="back-btn" onClick={onBack}><ArrowLeft size={24}/></button>
      <div className="detail-company">
        <div className="logo-large" style={{background:logoColor(job.employer)}}>{job.employer?.[0]?.toUpperCase()}</div>
        <h2>{job.name}</h2>
        <p>{job.employer}</p>
      </div>
    </div>
    <div className="detail-stats">
      <div className="detail-stat"><MapPin size={18}/><span>{job.area}</span></div>
      <div className="detail-stat"><Briefcase size={18}/><span>{job.employment||'Tam ştat'}</span></div>
      <div className="detail-stat"><Clock size={18}/><span>{job.experience||'Təcrübəsiz'}</span></div>
    </div>
    <div className="description-section glass-card">
      <h3>Tələblər</h3>
      <p>{stripHtml(job.requirement)||'Məlumat yoxdur'}</p>
    </div>
    <div className="description-section glass-card">
      <h3>Maaş</h3>
      <p style={{fontSize:'20px',fontWeight:'700',color:'#10b981'}}>{formatSalary(job.salary_from,job.salary_to,job.currency)}</p>
    </div>
    {job.url && (
      <a href={job.url} target="_blank" rel="noopener noreferrer" style={{display:'block',margin:'0 0 100px'}}>
        <button className="apply-btn-large">Müraciət et <ExternalLink size={16} style={{display:'inline',marginLeft:'8px'}}/></button>
      </a>
    )}
  </div>
);

// ─── CV VIEW ─────────────────────────────────────────────────────────────────
const QUIZ_STEP = { UPLOAD:'upload', ANALYZING:'analyzing', PREVIEW:'preview', QUIZ:'quiz', CALCULATING:'calculating', RESULTS:'results' };

const CVView = ({ onAnalysisComplete }) => {
  const [step, setStep] = useState(QUIZ_STEP.UPLOAD);
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileReady, setFileReady] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [scores, setScores] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [selectedOpt, setSelectedOpt] = useState(null);
  const fileRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;
    setFileName(file.name);
    setFileReady(false);
    setExtracting(true);
    setError('');
    setResumeText('');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const ab = e.target.result;
        let text = '';

        if (file.name.toLowerCase().endsWith('.pdf')) {
          console.log('Processing PDF with FileReader...');
          const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
          if (!pdfjsLib) throw new Error('PDF library not found (pdfjsLib)');
          
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          
          const loadingTask = pdfjsLib.getDocument({ data: ab });
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += strings.join(' ') + '\n';
          }
          text = fullText;
        } 
        else if (file.name.toLowerCase().endsWith('.docx')) {
          console.log('Processing DOCX with FileReader...');
          const mammoth = window.mammoth;
          if (!mammoth) throw new Error('DOCX library not found (mammoth)');
          
          const result = await mammoth.extractRawText({ arrayBuffer: ab });
          text = result.value;
        } 
        else {
          // Fallback for .txt and others
          const textReader = new FileReader();
          textReader.onload = (te) => {
            const t = te.target.result;
            if (t && t.trim()) {
              setResumeText(t);
              setFileReady(true);
              setExtracting(false);
            } else {
              setError('Fayl boşdur və ya oxuna bilmir.');
              setExtracting(false);
            }
          };
          textReader.readAsText(file);
          return; // textReader uses its own state management
        }

        if (text && text.trim()) {
          setResumeText(text);
          setFileReady(true);
        } else {
          throw new Error('Mətn çıxarıla bilmədi (nəticə boşdur)');
        }
      } catch (err) {
        console.error('File processing error:', err);
        setError(`Xəta baş verdi: ${err.message}. Zəhmət olmasa mətni əl ilə yapışdırın.`);
      } finally {
        setExtracting(false);
      }
    };

    reader.onerror = () => {
      setError('Fayl oxunarkən xəta baş verdi.');
      setExtracting(false);
    };

    if (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    const text = resumeText.trim();
    if (!text) { setError('Zəhmət olmasa CV mətnini daxil edin'); return; }
    setError(''); setStep(QUIZ_STEP.ANALYZING);
    try {
      const data = await analyzeCV(text);
      setResumeAnalysis(data.resume_analysis);
      setGapAnalysis(data.gap_analysis);
      setQuiz(data.quiz);
      onAnalysisComplete?.({ resumeAnalysis: data.resume_analysis, gapAnalysis: data.gap_analysis });
      setStep(QUIZ_STEP.PREVIEW);
    } catch (e) { setError(`Xəta: ${e.message}`); setStep(QUIZ_STEP.UPLOAD); }
  };

  const handleAnswer = () => {
    if (selectedOpt === null) return;
    const q = quiz[currentQ];
    const keys = ['A','B','C','D'];
    const newAnswers = { ...userAnswers, [String(q.id)]: keys[selectedOpt] ?? 'A' };
    setUserAnswers(newAnswers); setSelectedOpt(null);
    if (currentQ + 1 >= quiz.length) handleSubmit(newAnswers);
    else setCurrentQ(c => c+1);
  };

  const handleSubmit = async (answers) => {
    setStep(QUIZ_STEP.CALCULATING);
    try {
      const data = await submitQuiz(quiz, answers, gapAnalysis);
      setScores(data.scores); setRoadmap(data.roadmap);
      onAnalysisComplete?.({ resumeAnalysis, gapAnalysis, roadmap: data.roadmap, scores: data.scores });
      setStep(QUIZ_STEP.RESULTS);
    } catch(e) { setError(`Xəta: ${e.message}`); setStep(QUIZ_STEP.PREVIEW); }
  };

  const reset = () => {
    setStep(QUIZ_STEP.UPLOAD); setResumeText(''); setFileName('');
    setFileReady(false); setExtracting(false); setError('');
    setResumeAnalysis(null); setGapAnalysis(null); setQuiz([]);
    setScores(null); setRoadmap(null); setCurrentQ(0);
    setUserAnswers({}); setSelectedOpt(null);
  };

  const PrimaryBtn = ({onClick,children,disabled=false}) => (
    <button onClick={onClick} disabled={disabled} style={{width:'100%',padding:'15px',borderRadius:'14px',border:'none',fontSize:'16px',fontWeight:'700',cursor:disabled?'not-allowed':'pointer',background:disabled?'rgba(255,255,255,0.05)':'linear-gradient(135deg,#2fb1ff,#316cf4)',color:'white',marginTop:'12px',opacity:disabled?0.5:1,transition:'all 0.2s',boxShadow:disabled?'none':'0 8px 20px rgba(43,127,255,0.25)'}}>
      {children}
    </button>
  );

  // UPLOAD
  if (step === QUIZ_STEP.UPLOAD) return (
    <div className="view-content fade-in">
      <h1 className="anim-fadeup">CV-m</h1>
      <div className="anim-fadeup anim-delay-1">
        <input type="file" ref={fileRef} style={{display:'none'}} accept=".pdf,.txt,.docx"
          onChange={e=>{ if(e.target.files[0]) handleFileSelect(e.target.files[0]); }}/>

        {/* Upload box */}
        <div className="upload-box-dashed" onClick={()=>!extracting && fileRef.current.click()}
          style={{marginBottom:'20px', borderColor: fileReady ? '#10b981' : extracting ? '#2b7fff' : undefined, cursor: extracting ? 'wait' : 'pointer'}}>
          {extracting
            ? <div className="spinner" style={{marginBottom:'16px'}}/>
            : <Cloud size={48} className="upload-cloud" style={{color: fileReady ? '#10b981' : undefined}}/>
          }
          <p className="upload-title">
            {extracting ? 'Fayl oxunur...' : fileReady ? fileName : 'PDF, DOCX və ya TXT yükləyin'}
          </p>
          <p className="upload-subtitle">
            {extracting ? 'Zəhmət olmasa gözləyin...'
              : fileReady ? '✅ Fayl hazırdır — aşağıdakı düyməyə basın'
              : 'Faylı seçmək üçün klikləyin'}
          </p>
        </div>

        {/* Divider */}
        <div style={{position:'relative',marginBottom:'20px'}}>
          <div style={{position:'absolute',top:'50%',left:0,right:0,height:'1px',background:'var(--glass-border)'}}/>
          <span style={{position:'relative',background:'var(--bg-color)',padding:'0 12px',color:'var(--text-secondary)',fontSize:'13px',display:'block',width:'fit-content',margin:'0 auto'}}>və ya mətni yapışdırın</span>
        </div>

        <textarea value={resumeText} onChange={e=>{ setResumeText(e.target.value); setFileReady(!!e.target.value.trim()); }}
          placeholder={"Ad Soyad\nPython Developer\n\nBacarıqlar: Python, Django, SQL..."} rows={7}
          style={{width:'100%',padding:'16px',borderRadius:'16px',border:'1px solid var(--glass-border)',background:'var(--surface-color)',color:'var(--text-primary)',fontSize:'14px',resize:'vertical',boxSizing:'border-box',lineHeight:'1.6',outline:'none'}}/>

        {error && <p style={{color:'#ef4444',fontSize:'13px',marginTop:'8px'}}>{error}</p>}

        <PrimaryBtn onClick={handleAnalyze} disabled={(!fileReady && !resumeText.trim()) || extracting}>
          {extracting ? '⏳ Fayl oxunur...' : '🔍 Analizi Başlat'}
        </PrimaryBtn>
      </div>
    </div>
  );

  // ANALYZING / CALCULATING
  if (step === QUIZ_STEP.ANALYZING || step === QUIZ_STEP.CALCULATING) return (
    <div className="view-content fade-in" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',textAlign:'center'}}>
      <div className="spinner" style={{marginBottom:'28px'}}/>
      <h2 style={{marginBottom:'12px'}}>{step===QUIZ_STEP.ANALYZING ? 'CV analiz edilir...' : 'Nəticə hesablanır...'}</h2>
      <p style={{color:'var(--text-secondary)',fontSize:'14px',lineHeight:'1.6',maxWidth:'260px'}}>
        {step===QUIZ_STEP.ANALYZING ? 'AI CV-nizi oxuyur və bazarla müqayisə edir' : 'Cavablarınız qiymətləndirilir, yol xəritəsi hazırlanır'}
      </p>
    </div>
  );

  // PREVIEW
  if (step === QUIZ_STEP.PREVIEW && resumeAnalysis && gapAnalysis) return (
    <div className="view-content fade-in">
      <h2 className="anim-fadeup">👋 Salam, {resumeAnalysis.name ?? 'Namizəd'}!</h2>
      {resumeAnalysis.summary && <p className="anim-fadeup anim-delay-1" style={{color:'var(--text-secondary)',marginBottom:'24px',lineHeight:'1.6'}}>{resumeAnalysis.summary}</p>}
      <div className="glass-card anim-fadeup anim-delay-1" style={{textAlign:'center',marginBottom:'16px'}}>
        <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'12px'}}>Bazar Hazırlığı</p>
        <div style={{display:'flex',justifyContent:'center',marginBottom:'8px'}}><ScoreRing score={gapAnalysis.readiness_score} size={110} stroke={8}/></div>
        <p style={{fontSize:'14px',fontWeight:'600'}}>{gapAnalysis.specialization_name}</p>
      </div>
      <div className="glass-card anim-fadeup anim-delay-2" style={{marginBottom:'12px'}}>
        <h4 style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:'#10b981'}}>✅</span> Mövcud bacarıqlar</h4>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {gapAnalysis.matched_skills.map((s,i)=><SkillBadge key={s} skill={s} delay={i*0.03}/>)}
          {gapAnalysis.matched_skills.length===0 && <p style={{color:'var(--text-secondary)',fontSize:'13px'}}>Heç biri aşkar edilmədi</p>}
        </div>
      </div>
      <div className="glass-card anim-fadeup anim-delay-3" style={{marginBottom:'24px'}}>
        <h4 style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}><span style={{color:'#ef4444'}}>🔴</span> Bazarın tələb etdiyi bacarıqlar</h4>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {gapAnalysis.missing_skills.slice(0,8).map((s,i)=>(
            <span key={s} className="badge anim-scalein" style={{animationDelay:`${i*0.03}s`,background:'rgba(239,68,68,0.08)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)'}}>{s}</span>
          ))}
        </div>
      </div>
      <PrimaryBtn onClick={()=>setStep(QUIZ_STEP.QUIZ)}>❓ Testi Başlat ({quiz.length} sual)</PrimaryBtn>
    </div>
  );

  // QUIZ
  if (step === QUIZ_STEP.QUIZ && quiz.length > 0) {
    const q = quiz[currentQ];
    const progress = (currentQ / quiz.length) * 100;
    return (
      <div className="view-content fade-in">
        <div className="anim-fadeup" style={{marginBottom:'24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}>
            <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Sual {currentQ+1} / {quiz.length}</span>
            <span style={{fontSize:'12px',padding:'3px 10px',borderRadius:'100px',background:'rgba(43,127,255,0.1)',color:'#2b7fff'}}>{q.difficulty}</span>
          </div>
          <div style={{height:'5px',background:'rgba(255,255,255,0.06)',borderRadius:'3px',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#06b6d4,#2b7fff)',borderRadius:'3px',transition:'width 0.4s ease'}}/>
          </div>
        </div>
        <div className="glass-card anim-fadeup anim-delay-1" style={{marginBottom:'20px'}}>
          <p style={{fontSize:'11px',color:'#2b7fff',marginBottom:'8px',fontWeight:'600'}}>{q.topic} · {q.skill_tested}</p>
          <p style={{fontSize:'17px',fontWeight:'700',lineHeight:'1.5'}}>{q.question}</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'20px'}}>
          {(q.options||[]).map((opt,i)=>(
            <button key={i} onClick={()=>setSelectedOpt(i)} className="anim-fadeup" style={{animationDelay:`${0.1+i*0.04}s`,padding:'14px 18px',borderRadius:'14px',border:selectedOpt===i?'2px solid #2b7fff':'1px solid var(--glass-border)',background:selectedOpt===i?'rgba(43,127,255,0.1)':'var(--surface-color)',color:'white',textAlign:'left',fontSize:'14px',cursor:'pointer',fontWeight:selectedOpt===i?'600':'400',transition:'all 0.15s'}}>
              {opt}
            </button>
          ))}
        </div>
        <PrimaryBtn onClick={handleAnswer} disabled={selectedOpt===null}>
          {currentQ+1===quiz.length ? 'Testi Bitir ✓' : 'Növbəti →'}
        </PrimaryBtn>
      </div>
    );
  }

  // RESULTS
  if (step === QUIZ_STEP.RESULTS && scores) return (
    <div className="view-content fade-in">
      <div className="anim-scalein" style={{textAlign:'center',marginBottom:'28px'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:'12px'}}><ScoreRing score={scores.final_score} size={130} stroke={9}/></div>
        <p style={{fontSize:'20px',fontWeight:'700'}}>{scores.level}</p>
        {roadmap?.summary && <p style={{color:'var(--text-secondary)',fontSize:'13px',marginTop:'8px',lineHeight:'1.6'}}>{roadmap.summary}</p>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'20px'}}>
        {[{l:'CV Balı',v:`${scores.resume_score}%`},{l:'Test Balı',v:`${scores.quiz_score}%`},{l:'Düzgün cavab',v:`${scores.correct_answers}/${scores.total_questions}`},{l:'Bazara qədər',v:roadmap?.time_to_ready??'3-6 ay'}].map((m,i)=>(
          <div key={m.l} className="glass-card anim-fadeup" style={{textAlign:'center',animationDelay:`${i*0.06}s`}}>
            <p style={{fontSize:'22px',fontWeight:'800',color:'#2b7fff'}}>{m.v}</p>
            <p style={{fontSize:'11px',color:'var(--text-secondary)',marginTop:'4px'}}>{m.l}</p>
          </div>
        ))}
      </div>
      <div className="glass-card anim-fadeup anim-delay-3" style={{background:'rgba(43,127,255,0.06)',borderLeft:'3px solid #2b7fff',marginBottom:'20px'}}>
        <p style={{fontSize:'13px',color:'#60a5fa',fontWeight:'600'}}>🗺️ Yol xəritəsi hazırlandı!</p>
        <p style={{fontSize:'13px',marginTop:'4px',color:'var(--text-secondary)'}}>Roadmap bölməsinə keçin — fərdi öyrənmə planınız orada göstəriləcək.</p>
      </div>
      {/* Quiz breakdown */}
      <h3 style={{marginBottom:'16px'}} className="anim-fadeup">📋 Cavabların analizi</h3>
      {scores.quiz_results?.map((r,i)=>(
        <div key={i} className="glass-card anim-fadeup" style={{animationDelay:`${i*0.05}s`,marginBottom:'10px',borderLeft:`3px solid ${r.is_correct?'#10b981':'#ef4444'}`}}>
          <p style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'}}>{r.topic}</p>
          <p style={{fontWeight:'600',fontSize:'14px',marginBottom:'6px'}}>{r.question}</p>
          {!r.is_correct && <p style={{fontSize:'12px',color:'#f87171'}}>{r.explanation}</p>}
          <span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'100px',background:r.is_correct?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)',color:r.is_correct?'#10b981':'#f87171'}}>{r.is_correct?'✓ Düzgün':'✗ Yanlış'}</span>
        </div>
      ))}
      <button onClick={reset} style={{width:'100%',padding:'14px',borderRadius:'14px',background:'rgba(255,255,255,0.04)',border:'1px solid var(--glass-border)',color:'var(--text-secondary)',fontSize:'15px',fontWeight:'600',cursor:'pointer',marginTop:'8px'}}>
        🔄 Yenidən başla
      </button>
    </div>
  );

  return null;
};

// ─── ROADMAP VIEW ─────────────────────────────────────────────────────────────
const RoadmapView = ({ roadmap, scores, onViewCoupons }) => {
  if (!roadmap) return (
    <div className="view-content fade-in">
      <div className="roadmap-header anim-fadeup"><div className="roadmap-icon-box"><Map size={32} color="#06b6d4"/></div><h1>Karyera Yolunuz</h1></div>
      <p className="roadmap-subtitle anim-fadeup anim-delay-1">CV analizinə əsaslanan inkişaf planı</p>
      <div className="empty-state glass-card anim-fadeup anim-delay-2">
        <Map size={48} className="empty-icon" style={{color:'#06b6d4'}}/>
        <h3>Yol Xəritənizi Açın</h3>
        <p>CV-niz analiz olunduqdan və test keçildikdən sonra fərdi inkişaf planınız burada görünəcək.</p>
      </div>
    </div>
  );

  return (
    <div className="view-content fade-in">
      <div className="roadmap-header anim-fadeup" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:'16px'}}>
          <div className="roadmap-icon-box"><Map size={32} color="#06b6d4"/></div>
          <h1>Karyera Yolunuz</h1>
        </div>
        <button className="icon-btn-circle" onClick={onViewCoupons} title="Hədiyyə kuponları" style={{borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.05)', flexShrink:0}}>
          <span style={{fontSize:'20px'}}>🎁</span>
        </button>
      </div>

      {scores && (
        <div className="glass-card roadmap-summary-card anim-fadeup anim-delay-2">
          <div className="progress-text"><span>Ümumi hazırlıq</span><span className="percent-blue">{scores.final_score}%</span></div>
          <div className="progress-bar-container"><div className="progress-fill" style={{width:`${scores.final_score}%`}}/></div>
          <div className="progress-stats"><span>{scores.level}</span><span>{roadmap.time_to_ready??'3-6 ay'}</span></div>
        </div>
      )}

      {roadmap.weekly_goal && (
        <div className="glass-card anim-fadeup anim-delay-3" style={{background:'rgba(6,182,212,0.06)',borderLeft:'3px solid #06b6d4',marginBottom:'24px'}}>
          <p style={{fontSize:'12px',color:'#06b6d4',fontWeight:'700',marginBottom:'4px'}}>🎯 Bu həftənin məqsədi</p>
          <p style={{fontSize:'14px'}}>{roadmap.weekly_goal}</p>
        </div>
      )}

      {roadmap.phases?.length > 0 && (
        <div className="roadmap-timeline">
          {roadmap.phases.map((phase, idx) => (
            <div key={phase.phase} className={`timeline-item ${idx===0?'active':idx<1?'completed':'locked'} anim-fadeup`} style={{animationDelay:`${0.2+idx*0.08}s`}}>
              <div className="timeline-indicator">
                <div className="circle">{idx===0?'▶':phase.phase}</div>
                {idx < roadmap.phases.length-1 && <div className="line"/>}
              </div>
              <div className="glass-card timeline-card">
                <div className="card-header">
                  <h4>{phase.title}</h4>
                  <p>{phase.goal}</p>
                  <p style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'6px'}}>📚 {phase.topics?.join(', ')}</p>
                </div>
                <div className="card-footer">
                  <span>🕒 {phase.duration}</span>
                  <button className={`status-btn ${idx===0?'start':'locked'}`}>{idx===0?'Başla':'Kilidli'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid Courses Section */}
      <h3 style={{margin:'32px 0 16px'}} className="anim-fadeup">🚀 Pullu kurslar (Tövsiyə)</h3>
      <div style={{display:'flex',flexDirection:'column',gap:'12px',marginBottom:'24px'}}>
        <a href="https://www.coursera.org" target="_blank" rel="noopener noreferrer" style={{textDecoration:'none'}} className="anim-fadeup">
          <div className="glass-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderLeft:'4px solid #2b7fff'}}>
            <div style={{display:'flex',alignItems:'center',gap:'15px'}}>
              <div style={{width:'40px',height:'40px',background:'rgba(43,127,255,0.1)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>🎓</div>
              <div>
                <p style={{fontWeight:'700',fontSize:'15px',marginBottom:'2px'}}>Professional Sertifikat Proqramı</p>
                <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>Coursera · İş tapmaq zəmanəti</p>
              </div>
            </div>
            <ExternalLink size={18} style={{color:'var(--text-secondary)'}}/>
          </div>
        </a>
        <a href="https://www.udemy.com" target="_blank" rel="noopener noreferrer" style={{textDecoration:'none', animationDelay:'0.1s'}} className="anim-fadeup">
          <div className="glass-card" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 20px',borderLeft:'4px solid #8b5cf6'}}>
            <div style={{display:'flex',alignItems:'center',gap:'15px'}}>
              <div style={{width:'40px',height:'40px',background:'rgba(139,92,246,0.1)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>💻</div>
              <div>
                <p style={{fontWeight:'700',fontSize:'15px',marginBottom:'2px'}}>Full-stack Mastery Kursu</p>
                <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>Udemy · ən çox satılan</p>
              </div>
            </div>
            <ExternalLink size={18} style={{color:'var(--text-secondary)'}}/>
          </div>
        </a>
      </div>

      {roadmap.free_resources?.length > 0 && (
        <>
          <h3 style={{margin:'24px 0 16px'}} className="anim-fadeup">🎓 Pulsuz resurslar</h3>
          {roadmap.free_resources.map((res,i)=>(
            <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none', animationDelay:`${i*0.05}s`}} className="anim-fadeup">
              <div className="glass-card" style={{marginBottom:'10px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px'}}>
                <div>
                  <p style={{fontWeight:'600',fontSize:'14px',marginBottom:'2px'}}>{res.title}</p>
                  <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>{res.topic}</p>
                </div>
                <ExternalLink size={16} style={{color:'var(--text-secondary)',flexShrink:0}}/>
              </div>
            </a>
          ))}
        </>
      )}
    </div>
  );
};

// ─── GIFT COUPONS VIEW ────────────────────────────────────────────────────────
const GiftCouponsView = ({ onBack }) => {
  const coupons = [
    { code: 'KARYERA10', discount: '10%', title: 'İlk kurs üçün', color: '#2b7fff' },
    { code: 'GIFT25', discount: '25%', title: 'Hədiyyə paketi', color: '#10b981' },
    { code: 'SPECIAL50', discount: '50%', title: 'Premium abunə', color: '#f59e0b' },
  ];

  return (
    <div className="view-content fade-in">
      <div style={{display:'flex', alignItems:'center', gap:'16px', marginBottom:'32px'}}>
        <button className="back-btn" style={{position:'static'}} onClick={onBack}><ArrowLeft size={24}/></button>
        <h1 style={{margin:0}}>Hədiyyə Kuponları</h1>
      </div>
      
      <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
        {coupons.map((c, i) => (
          <div key={c.code} className="glass-card anim-fadeup" style={{animationDelay:`${i*0.1}s`, padding:'24px', borderLeft:`4px solid ${c.color}`, position:'relative', overflow:'hidden'}}>
            <div style={{position:'absolute', right:'-20px', top:'-20px', fontSize:'80px', opacity:0.1, pointerEvents:'none'}}>🎁</div>
            <p style={{fontSize:'14px', color:'var(--text-secondary)', marginBottom:'4px'}}>{c.title}</p>
            <h3 style={{fontSize:'24px', marginBottom:'16px'}}>{c.discount} Endirim</h3>
            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
              <code style={{background:'rgba(255,255,255,0.05)', padding:'8px 16px', borderRadius:'8px', fontSize:'18px', fontWeight:'700', border:'1px dashed var(--glass-border)', color:c.color}}>
                {c.code}
              </code>
              <button className="badge" style={{background:c.color, border:'none', padding:'10px 16px', cursor:'pointer'}} onClick={() => {
                navigator.clipboard.writeText(c.code);
                alert('Kupon kopyalandı!');
              }}>Kopyala</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
const ProfileView = ({ profileData, onFileSelect }) => {
  const name = profileData?.resumeAnalysis?.name ?? 'Sarah Chen';
  const spec = profileData?.gapAnalysis?.specialization_name ?? 'Profilinizi tamamlayın';
  const skills = profileData?.resumeAnalysis?.current_skills ?? [];
  const strengths = profileData?.resumeAnalysis?.key_strengths ?? [];
  const level = profileData?.resumeAnalysis?.experience_level ?? null;
  const education = profileData?.resumeAnalysis?.education ?? null;

  return (
    <div className="view-content fade-in">
      <div className="profile-header-centered anim-scalein">
        <div className="avatar-large-wrapper">
          <div className="avatar-large">{name[0]?.toUpperCase()}</div>
          <button className="edit-badge"><Edit3 size={14}/></button>
        </div>
        <h2>{name}</h2>
        <p className="profile-title">{spec}</p>
        {level && <span style={{marginTop:'8px',padding:'4px 14px',borderRadius:'100px',background:'rgba(43,127,255,0.1)',color:'#2b7fff',fontSize:'12px',fontWeight:'600'}}>{level.toUpperCase()}</span>}
      </div>

      <div className="stats-grid anim-fadeup anim-delay-1">
        <div className="stat-box glass-card"><div className="stat-icon-blue">💼</div><span className="stat-value">0</span><p className="stat-label">Müraciət</p></div>
        <div className="stat-box glass-card"><div className="stat-icon-blue">🔖</div><span className="stat-value">0</span><p className="stat-label">Saxlanılan</p></div>
        <div className="stat-box glass-card"><div className="stat-icon-blue">🏅</div><span className="stat-value">{skills.length}</span><p className="stat-label">Bacarıq</p></div>
      </div>

      {skills.length > 0 && (
        <div className="glass-card anim-fadeup anim-delay-2" style={{marginBottom:'16px'}}>
          <h3 style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}><Award size={18} color="#2b7fff"/> Bacarıqlarım</h3>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
            {skills.map((s,i)=><SkillBadge key={s} skill={s} delay={i*0.03}/>)}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="glass-card anim-fadeup anim-delay-3" style={{marginBottom:'16px'}}>
          <h3 style={{marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}><Star size={18} color="#f59e0b"/> Güclü tərəflərim</h3>
          {strengths.map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#f59e0b',flexShrink:0}}/>
              <span style={{fontSize:'14px'}}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {education && (
        <div className="glass-card anim-fadeup anim-delay-4" style={{marginBottom:'16px'}}>
          <h3 style={{marginBottom:'8px',display:'flex',alignItems:'center',gap:'8px'}}><BookOpen size={18} color="#10b981"/> Təhsil</h3>
          <p style={{fontSize:'14px',color:'var(--text-secondary)'}}>{education}</p>
        </div>
      )}

      <div className="menu-group anim-fadeup anim-delay-5">
        <p className="menu-group-label">Hesab</p>
        <div className="menu-item glass-card"><div className="menu-icon-label"><Bell size={20} className="menu-icon"/><span>Bildirişlər</span></div><ChevronRight size={20}/></div>
        <div className="menu-item glass-card"><div className="menu-icon-label"><span className="menu-icon">⚙️</span><span>Parametrlər</span></div><ChevronRight size={20}/></div>
      </div>
      <div className="menu-item glass-card logout-item anim-fadeup anim-delay-5">
        <div className="menu-icon-label"><span className="menu-icon">🚪</span><span>Çıxış</span></div><ChevronRight size={20}/>
      </div>
    </div>
  );
};

// ─── APP ─────────────────────────────────────────────────────────────────────
function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showCoupons, setShowCoupons] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = ANIM_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    fetchJobs()
      .then(d => setJobs(d.vacancies || []))
      .catch(()=>setJobs([]))
      .finally(()=>setJobsLoading(false));
  }, []);

  useEffect(() => { setSelectedJob(null); setShowCoupons(false); }, [activeTab]);

  const handleAnalysisComplete = (data) => {
    setProfileData(prev => ({ ...prev, ...data }));
    if (data.roadmap) setTimeout(() => setActiveTab('roadmap'), 1800);
  };

  const handleJobClick = (job) => setSelectedJob(job);

  const renderContent = () => {
    if (selectedJob) return <JobDetailView job={selectedJob} onBack={()=>setSelectedJob(null)} userSkills={profileData?.resumeAnalysis?.current_skills??[]}/>;
    if (showCoupons) return <GiftCouponsView onBack={() => setShowCoupons(false)}/>;
    switch(activeTab) {
      case 'home':    return <HomeView profileData={profileData} onJobClick={handleJobClick} jobs={jobs}/>;
      case 'jobs':    return <JobsView onJobClick={handleJobClick} jobs={jobs} loading={jobsLoading}/>;
      case 'cv':      return <CVView onAnalysisComplete={handleAnalysisComplete}/>;
      case 'roadmap': return <RoadmapView roadmap={profileData?.roadmap} scores={profileData?.scores} onViewCoupons={() => setShowCoupons(true)}/>;
      case 'profile': return <ProfileView profileData={profileData}/>;
      default:        return <HomeView profileData={profileData} onJobClick={handleJobClick} jobs={jobs}/>;
    }
  };

  return (
    <div className="device-frame">
      <div className="app-container">
        {renderContent()}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab}/>
      </div>
    </div>
  );
}

export default App;
