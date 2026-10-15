import glob
import logging
import os
import threading
from typing import Dict, List, Optional, Tuple

import numpy as np

# Try importing the new google-genai SDK
try:
    from google import genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

# Try importing the groq SDK
try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

logger = logging.getLogger("demeure.rag")

MAX_QUERY_CHARS = 1000


class RAGService:
    """Loads the embedding model and index in a background thread.

    ``status`` is one of: "disabled", "loading", "ready", "failed".
    """

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.chunks: List[Dict] = []
        self.embeddings: np.ndarray = np.array([])
        self.embedder = None
        self.status = "disabled"
        self.error: Optional[str] = None

    def start_background_load(self) -> None:
        self.status = "loading"
        threading.Thread(target=self._load, name="rag-loader", daemon=True).start()

    def _load(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading embedding model (first run downloads it)...")
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
            self._load_and_index_documents()
            self.status = "ready"
        except Exception as e:  # keep the API up even if the model cannot load
            logger.exception("RAG initialisation failed")
            self.error = str(e)
            self.status = "failed"

    @property
    def ready(self) -> bool:
        return self.status == "ready"

    def _load_and_index_documents(self):
        """Loads all markdown files and chunks them into paragraphs."""
        logger.info("Loading rulebooks from %s", self.data_dir)
        file_paths = glob.glob(os.path.join(self.data_dir, "*.md"))
        
        texts = []
        for path in file_paths:
            filename = os.path.basename(path)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # One chunk per "## " section, prefixed with the document title so a section such as
            # "Section 1: Operating Hours" is still recognisably about the mess. Title-only
            # fragments carry no policy text and are skipped.
            title = content.split("\n", 1)[0].lstrip("# ").strip()
            for section in content.split('\n## ')[1:]:
                body = section.split("\n# ", 1)[0].strip()  # stop at the next top-level heading
                if len(body.splitlines()) < 2:
                    continue
                text_chunk = f"{title}: {body}"
                self.chunks.append({"source": filename, "text": text_chunk})
                texts.append(text_chunk)
                    
        if texts:
            logger.info("Embedding %d chunks...", len(texts))
            self.embeddings = self.embedder.encode(texts)
            logger.info("Indexing complete.")
        else:
            logger.warning("No documents found to index.")

    def _retrieve(self, query: str, top_k: int = 3) -> List[Dict]:
        """Finds the most relevant chunks using cosine similarity."""
        if len(self.embeddings) == 0:
            return []
            
        query_embedding = self.embedder.encode([query])[0]
        # Calculate cosine similarities
        similarities = np.dot(self.embeddings, query_embedding) / (
            np.linalg.norm(self.embeddings, axis=1) * np.linalg.norm(query_embedding)
        )
        
        # Get top k indices
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        # Keep chunks that are reasonably similar and not far behind the best match, so a weakly
        # related second rulebook is not passed to the model (or cited).
        best = similarities[top_indices[0]]
        return [self.chunks[idx] for idx in top_indices
                if similarities[idx] > 0.2 and similarities[idx] >= best - 0.12]

    def query(self, question: str) -> Tuple[str, List[str]]:
        """Answers a question based on the rulebooks."""
        question = question.strip()[:MAX_QUERY_CHARS]
        relevant_chunks = self._retrieve(question)
        
        if not relevant_chunks:
            return "I'm sorry, but I couldn't find any information regarding that in the hostel handbooks.", []
            
        context_texts = "\n\n".join([f"[{c['source']}] {c['text'][:1500]}..." if len(c['text']) > 1500 else f"[{c['source']}] {c['text']}" for c in relevant_chunks])
        citations = list(dict.fromkeys(c['source'] for c in relevant_chunks))  # best match first

        api_key = os.environ.get("GEMINI_API_KEY")
        groq_api_key = os.environ.get("GROQ_API_KEY")

        prompt = f"""You are the Demeure AI Virtual Assistant for a university hostel.
Based ONLY on the following policy excerpts, answer the student's question clearly and professionally.
Do not make up rules. If the answer is not in the context, say so.

CONTEXT:
{context_texts}

QUESTION:
{question}
"""
        
        # If we have Groq setup, generate a synthesized response (lightning fast)
        if HAS_GROQ and groq_api_key:
            try:
                client = Groq(api_key=groq_api_key)
                response = client.chat.completions.create(
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
                )
                return response.choices[0].message.content.strip(), citations
            except Exception as e:
                logger.warning("Groq API error: %s", e)

        # If we have Gemini setup, generate a synthesized response
        if HAS_GEMINI and api_key:
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
                    contents=prompt
                )
                return response.text.strip(), citations
            except Exception as e:
                # Fall back to direct retrieval if the API fails
                logger.warning("Gemini API error: %s", e)
                
        # Fallback if no API key or error: return the raw retrieved context
        # No LLM configured or reachable: return the retrieved policy text verbatim.
        return f"Based on the official policies, here is the most relevant information I found:\n\n{context_texts}", citations
