import json, logging, io
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document
from services.ai_engine import CareerAIEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["career"])
engine = CareerAIEngine()

_jobs_path = Path(__file__).parent.parent / "jobs_data.json"
with open(_jobs_path, "r", encoding="utf-8") as f:
    JOBS_DATA = json.load(f)

class AnalyzeRequest(BaseModel):
    resume_text: str

class SubmitQuizRequest(BaseModel):
    quiz: list
    user_answers: dict[str, str]
    gap_analysis: dict

@router.post("/cv/analyze")
async def analyze_cv(request: AnalyzeRequest):
    if not request.resume_text.strip():
        raise HTTPException(400, "resume_text boş ola bilməz")
    try:
        # Use unified call for 2x speed
        data = await engine.analyze_and_generate_quiz(request.resume_text)
        return data
    except Exception as e:
        logger.error(f"Analiz xətası: {e}")
        raise HTTPException(500, str(e))

@router.post("/cv/submit-quiz")
async def submit_quiz(request: SubmitQuizRequest):
    if not request.quiz:
        raise HTTPException(400, "quiz boş ola bilməz")
    try:
        answers = {int(k): v for k, v in request.user_answers.items()}
        scores = engine.calculate_final_score(request.quiz, answers, request.gap_analysis)
        roadmap = await engine.generate_roadmap(request.gap_analysis, scores)
        return {"scores": scores, "roadmap": roadmap}
    except Exception as e:
        logger.error(f"Quiz xətası: {e}")
        raise HTTPException(500, str(e))

@router.get("/jobs")
async def get_jobs():
    result = []
    for spec_key, spec_data in JOBS_DATA.items():
        for v in spec_data.get("vacancies", []):
            salary = v.get("salary") or {}
            req = ((v.get("snippet") or {}).get("requirement") or "").replace("<highlighttext>","").replace("</highlighttext>","")
            result.append({
                "id": v.get("id"), "name": v.get("name"), "employer": v.get("employer"),
                "area": v.get("area"), "salary_from": salary.get("from"), "salary_to": salary.get("to"),
                "currency": salary.get("currency", "RUR"), "experience": v.get("experience"),
                "employment": v.get("employment"), "requirement": req[:200],
                "url": v.get("url"), "specialization": spec_key, "spec_name": spec_data.get("name", spec_key),
            })
    return {"vacancies": result, "total": len(result)}

@router.post("/cv/extract-text")
async def extract_text(file: UploadFile = File(...)):
    name = file.filename.lower()
    content = await file.read()
    text = ""
    
    logger.info(f"Extracting text from: {name} (size: {len(content)} bytes)")
    
    try:
        if name.endswith(".pdf"):
            logger.info("Processing PDF...")
            reader = PdfReader(io.BytesIO(content))
            for i, page in enumerate(reader.pages):
                logger.info(f"Reading page {i+1}")
                text += (page.extract_text() or "") + "\n"
        elif name.endswith(".docx"):
            logger.info("Processing DOCX...")
            doc = Document(io.BytesIO(content))
            text = "\n".join([p.text for p in doc.paragraphs])
        else:
            text = content.decode("utf-8", errors="ignore")
            
        if not text.strip():
            raise HTTPException(400, "Fayldan mətn çıxarıla bilmədi")
            
        return {"text": text}
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        raise HTTPException(500, f"Fayl oxunarkən xəta: {str(e)}")

@router.get("/cv/health")
async def health():
    return {"status": "ok", "model": engine.model}
