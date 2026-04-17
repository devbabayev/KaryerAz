"""
ai_engine.py — AI ядро (async версия для FastAPI)
DeepSeek API, OpenAI-совместимый формат
"""
import json
import re
from pathlib import Path
from typing import Dict, List
from openai import AsyncOpenAI
from core.config import get_settings

settings = get_settings()

class CareerAIEngine:
    def __init__(self, jobs_data_path: str = "jobs_data.json"):
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com"
        )
        self.model = "deepseek-chat"
        self.jobs_data = self._load_jobs_data(jobs_data_path)

    async def _call_api(self, prompt: str, max_tokens: int = 1000) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()

    def _load_jobs_data(self, path: str) -> Dict:
        p = Path(path)
        if not p.exists():
            p = Path(__file__).parent.parent / "jobs_data.json"
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        return self._get_demo_jobs_data()

    def _get_demo_jobs_data(self) -> Dict:
        return {
            "python_developer": {"name": "Python Developer", "top_skills": ["Python","Django","FastAPI","PostgreSQL","Git","Docker","REST API","SQL","Linux","Redis","pytest","asyncio","SQLAlchemy","Celery","AWS"]},
            "data_analyst": {"name": "Data Analyst", "top_skills": ["Python","SQL","pandas","numpy","matplotlib","Excel","Power BI","Tableau","statistics","Machine Learning","scikit-learn","Jupyter","PostgreSQL","A/B testing","ETL"]},
            "frontend_developer": {"name": "Frontend Developer", "top_skills": ["JavaScript","React","HTML","CSS","TypeScript","Vue.js","Git","REST API","Webpack","Node.js","SASS","Redux","Jest","Figma","responsive design"]}
        }

    async def analyze_resume(self, resume_text: str) -> Dict:
        market_context = self._build_market_context()
        prompt = f"""Sən karyera eksperti və HR mütəxəssisisən. CV-ni analiz et və YALNIZ etibarlı JSON qaytar.

CV:
{resume_text}

BAZARI KONTEKST:
{market_context}

JSON formatı (markdown olmadan, yalnız JSON):
{{
  "name": "namizədin adı və ya 'Namizəd'",
  "detected_specialization": "python_developer | data_analyst | frontend_developer",
  "specialization_confidence": 0.0-1.0,
  "current_skills": ["bacarıq1", "bacarıq2"],
  "experience_level": "junior | middle | senior | student",
  "education": "təhsil haqqında qısa məlumat",
  "key_strengths": ["güclü tərəf 1", "güclü tərəf 2"],
  "summary": "namizəd haqqında 2-3 cümlə"
}}"""
        raw = await self._call_api(prompt, max_tokens=1000)
        raw = re.sub(r'```json\s*|\s*```', '', raw).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"name": "Namizəd", "detected_specialization": "python_developer", "specialization_confidence": 0.5, "current_skills": [], "experience_level": "student", "education": "Müəyyən edilmədi", "key_strengths": [], "summary": raw[:200]}

    def generate_gap_analysis(self, resume_analysis: Dict) -> Dict:
        spec_key = resume_analysis.get("detected_specialization", "python_developer")
        spec_data = self.jobs_data.get(spec_key, {})
        market_skills = spec_data.get("top_skills", [])
        user_skills = [s.lower() for s in resume_analysis.get("current_skills", [])]
        matched, missing = [], []
        for skill in market_skills:
            if any(skill.lower() in us or us in skill.lower() for us in user_skills):
                matched.append(skill)
            else:
                missing.append(skill)
        score = round((len(matched) / max(len(market_skills), 1)) * 100)
        return {"specialization": spec_key, "specialization_name": spec_data.get("name", spec_key), "market_skills": market_skills, "matched_skills": matched, "missing_skills": missing, "readiness_score": score}

    async def generate_quiz(self, resume_analysis: Dict, gap_analysis: Dict) -> List[Dict]:
        spec_name = gap_analysis["specialization_name"]
        missing_skills = gap_analysis["missing_skills"][:8]
        matched_skills = gap_analysis["matched_skills"][:5]
        prompt = f"""Sən texniki müsahibəçisisən. Bilik səviyyəsini qiymətləndirmək üçün test yarat.

İxtisas: {spec_name}
Namizədin bacarıqları: {', '.join(matched_skills)}
Bilik boşluqları: {', '.join(missing_skills)}
Səviyyə: {resume_analysis.get('experience_level', 'junior')}

6 sual yarat. YALNIZ etibarlı JSON qaytar (markdown olmadan):
[
  {{
    "id": 1,
    "topic": "mövzu adı",
    "question": "sual mətni",
    "options": ["A) variant1", "B) variant2", "C) variant3", "D) variant4"],
    "correct": "A",
    "explanation": "düzgün cavabın qısa izahı",
    "difficulty": "easy | medium | hard",
    "skill_tested": "yoxlanan bacarıq"
  }}
]
Tələblər:
- 2 sual mövcud bacarıqlar üzrə
- 4 sual bilik boşluqları üzrə
- Praktik suallar
- Dil: Azərbaycan"""
        raw = await self._call_api(prompt, max_tokens=2000)
        raw = re.sub(r'```json\s*|\s*```', '', raw).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return self._get_fallback_quiz(spec_name)

    def calculate_final_score(self, quiz: List[Dict], user_answers: Dict[int, str], gap_analysis: Dict) -> Dict:
        correct_count = 0
        quiz_results = []
        for question in quiz:
            q_id = question["id"]
            user_answer = user_answers.get(q_id, "")
            is_correct = user_answer.upper() == question.get("correct", "").upper()
            if is_correct:
                correct_count += 1
            quiz_results.append({"question": question["question"], "topic": question["topic"], "user_answer": user_answer, "correct_answer": question.get("correct"), "is_correct": is_correct, "explanation": question.get("explanation", ""), "skill_tested": question.get("skill_tested", "")})
        quiz_score = round((correct_count / max(len(quiz), 1)) * 100)
        resume_score = gap_analysis["readiness_score"]
        final_score = round(resume_score * 0.4 + quiz_score * 0.6)
        return {"quiz_score": quiz_score, "resume_score": resume_score, "final_score": final_score, "correct_answers": correct_count, "total_questions": len(quiz), "quiz_results": quiz_results, "level": self._score_to_level(final_score)}

    async def generate_roadmap(self, gap_analysis: Dict, scores: Dict) -> Dict:
        missing_skills = gap_analysis["missing_skills"][:10]
        spec_name = gap_analysis["specialization_name"]
        final_score = scores["final_score"]
        prompt = f"""Sən tələbələr üçün karyera məşqçisisən. Fərdi öyrənmə planı yarat.

İxtisas: {spec_name}
Cari səviyyə: {final_score}%
Bilik boşluqları: {', '.join(missing_skills)}

YALNIZ etibarlı JSON qaytar (markdown olmadan):
{{
  "summary": "namizədin vəziyyəti haqqında 2 cümlə",
  "time_to_ready": "bazara hazır olma müddəti (məs: 3-4 ay)",
  "phases": [
    {{
      "phase": 1,
      "title": "mərhələ adı",
      "duration": "2-3 həftə",
      "goal": "mərhələnin məqsədi",
      "topics": ["mövzu1", "mövzu2", "mövzu3"]
    }}
  ],
  "free_resources": [
    {{
      "title": "resurs adı",
      "url": "real link",
      "type": "course | video | docs | practice",
      "topic": "hansı mövzunu əhatə edir"
    }}
  ],
  "weekly_goal": "bu həftəyə konkret məqsəd"
}}
Tələblər:
- 3 öyrənmə mərhələsi
- 6-8 pulsuz real resurs (YouTube, sənədlər, Stepik)
- Həftədə 10-15 saat üçün real vaxt çərçivəsi"""
        raw = await self._call_api(prompt, max_tokens=2000)
        raw = re.sub(r'```json\s*|\s*```', '', raw).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"summary": "Roadmap hazırlandı", "phases": [], "free_resources": [], "time_to_ready": "3-6 ay"}

    async def analyze_and_generate_quiz(self, resume_text: str) -> Dict:
        """Unified call to analyze resume and generate quiz in one go for 2x speed."""
        market_context = self._build_market_context()
        prompt = f"""Sən HR və texniki müsahibəçisən. CV-ni analiz et və bilik boşluqlarına əsasən 6 test sualı yarat.
YALNIZ JSON qaytar.

CV MƏTNİ:
{resume_text}

BAZAR KONTEKSTİ:
{market_context}

JSON formatı:
{{
  "resume_analysis": {{
    "name": "Namizəd", 
    "detected_specialization": "python_developer",
    "experience_level": "junior",
    "current_skills": ["S1"],
    "summary": "Xülasə"
  }},
  "quiz": [
    {{
      "id": 1, "topic": "T1", "question": "Q1", 
      "options": ["A) V1", "B) V2", "C) V3", "D) V4"], 
      "correct": "A", "explanation": "E1", "difficulty": "easy", "skill_tested": "S1"
    }}
  ]
}}

Tələblər:
- 6 praktik test sualı (Azərbaycan dilində)
- CV-dən bütün bacarıqları tam çıxar
- Dil: Azərbaycan"""

        raw = await self._call_api(prompt, max_tokens=3000)
        raw = re.sub(r'```json\s*|\s*```', '', raw).strip()
        try:
            data = json.loads(raw)
            # Add gap analysis locally to save AI time
            resume_analysis = data.get("resume_analysis", {})
            gap_analysis = self.generate_gap_analysis(resume_analysis)
            return {
                "resume_analysis": resume_analysis,
                "gap_analysis": gap_analysis,
                "quiz": data.get("quiz", [])
            }
        except Exception as e:
            logger.error(f"Unified analysis error: {e}")
            # Fallback
            res = await self.analyze_resume(resume_text)
            gap = self.generate_gap_analysis(res)
            qz = await self.generate_quiz(res, gap)
            return {"resume_analysis": res, "gap_analysis": gap, "quiz": qz}

    def _build_market_context(self) -> str:
        return '\n'.join([f"{sd.get('name',k)}: {', '.join(sd.get('top_skills',[])[:10])}" for k, sd in self.jobs_data.items()])

    def _score_to_level(self, score: int) -> str:
        if score >= 80: return "Bazara hazırsınız 🟢"
        elif score >= 60: return "Demək olar hazırsınız 🟡"
        elif score >= 40: return "Hazırlaşma prosesindəsiniz 🟠"
        else: return "Əsas hazırlıq tələb olunur 🔴"

    def _get_fallback_quiz(self, spec_name: str) -> List[Dict]:
        return [{"id": 1, "topic": "Əsaslar", "question": f"{spec_name} sahəsini nə vaxtdan öyrənirsiniz?", "options": ["A) 3 aydan az", "B) 3-6 ay", "C) 6-12 ay", "D) 1 ildən çox"], "correct": "C", "explanation": "Junior vəzifə üçün 6-12 aylıq praktika kifayətdir", "difficulty": "easy", "skill_tested": "Təcrübə"}]
