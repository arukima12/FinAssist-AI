import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from docling.datamodel.base_models import InputFormat
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.pipeline.simple_pipeline import SimplePipeline
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama
from langchain_core.prompts import ChatPromptTemplate

# 1. Initialize FastAPI Application Instance
app = FastAPI(title="FinAssist AI Backend")

# 2. Enable CORS (Crucial for when we hook up the Frontend later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Global Configurations & Models Initialization
DB_DIR = "./chroma_db"
embeddings = OllamaEmbeddings(model="deepseek-r1:1.5b") 
llm = Ollama(model="deepseek-r1:1.5b")
vector_store = None

class QueryRequest(BaseModel):
    question: str

@app.get("/")
def root():
    return {"status": "FinAssist AI Backend is Running"}


# 4. ENDPOINT 1: Memory-Optimized Document Ingestion & Vectorization
@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    global vector_store
    temp_path = f"temp_{file.filename}"
    try:
        # Save uploaded file temporarily to disk
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        # --- FIXES STD::BAD_ALLOC CRASH ---
        # Using SimplePipeline skips heavy vision models, keeping RAM footprint extremely low
        pipeline = SimplePipeline()
        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline=pipeline)
            }
        )
        
        # Convert document to Markdown (keeps layouts/tables organized for financial data)
        result = converter.convert(temp_path)
        extracted_text = result.document.export_to_markdown()
        
        # Instantly remove temp file once read
        os.remove(temp_path)

        # Chunk the text into manageable semantic context windows
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, 
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = text_splitter.split_text(extracted_text)

        # Build and persist the vector indexing database locally on your drive
        vector_store = Chroma.from_texts(
            texts=chunks,
            embedding=embeddings,
            persist_directory=DB_DIR
        )
        
        return {"message": f"Successfully processed {file.filename}", "chunks_created": len(chunks)}

    except Exception as e:
        # Emergency cleanup of temp file if it crashes mid-run
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))


# 5. ENDPOINT 2: Token-by-Token Streaming Query Retrieval
@app.post("/api/query")
async def query_document(payload: QueryRequest):
    global vector_store
    
    # Reload existing Chroma DB from disk if the server restarted
    if vector_store is None:
        if os.path.exists(DB_DIR):
            vector_store = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
        else:
            raise HTTPException(status_code=400, detail="No documents have been uploaded and indexed yet.")
            
    try:
        # Extract the top 3 most textually relevant blocks
        docs = vector_store.similarity_search(payload.question, k=3)
        context = "\n---\n".join([doc.page_content for doc in docs])
        
        # Strict prompting structure to stop the local model from drifting or making up numbers
        prompt_template = ChatPromptTemplate.from_messages([
            ("system", (
                "You are FinAssist AI, an expert financial analyst. "
                "Answer the user's question using ONLY the provided verified context. "
                "If the answer cannot be found in the context, say 'I cannot find that specific metric in the uploaded documents.' "
                "Do not invent data or use outside knowledge.\n\n"
                "Verified Document Context:\n{context}"
            )),
            ("human", "{question}")
        ])
        
        chain = prompt_template | llm

        # Token generator function to stream content back live
        def generate_tokens():
            for chunk in chain.stream({"context": context, "question": payload.question}):
                yield chunk

        return StreamingResponse(generate_tokens(), media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))