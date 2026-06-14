import os
import glob
from typing import List, Dict, Tuple
from sentence_transformers import SentenceTransformer
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

class RAGService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.chunks: List[Dict] = []
        self.embeddings: np.ndarray = np.array([])
        
        print("Loading embedding model (this may take a moment on first run)...")
        # We use a lightweight local model for fast embedding
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self._load_and_index_documents()

    def _load_and_index_documents(self):
        """Loads all markdown files and chunks them into paragraphs."""
        print(f"Loading rulebooks from {self.data_dir}...")
        file_paths = glob.glob(os.path.join(self.data_dir, "*.md"))
        
        texts = []
        for path in file_paths:
            filename = os.path.basename(path)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Simple chunking by sections
            sections = content.split('\n## ')
            for i, section in enumerate(sections):
                text_chunk = section if i == 0 else f"## {section}"
                text_chunk = text_chunk.strip()
                if len(text_chunk) > 10:
                    self.chunks.append({
                        "source": filename,
                        "text": text_chunk
                    })
                    texts.append(text_chunk)
                    
        if texts:
            print(f"Embedding {len(texts)} chunks...")
            self.embeddings = self.embedder.encode(texts)
            print("Indexing complete.")
        else:
            print("Warning: No documents found to index.")

    def _retrieve(self, query: str, top_k: int = 2) -> List[Dict]:
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
        
        results = []
        for idx in top_indices:
            # Only include if similarity is reasonable
            if similarities[idx] > 0.2:
                results.append(self.chunks[idx])
        return results

    def query(self, question: str) -> Tuple[str, List[str]]:
        """Answers a question based on the rulebooks."""
        relevant_chunks = self._retrieve(question)
        
        if not relevant_chunks:
            return "I'm sorry, but I couldn't find any information regarding that in the hostel handbooks.", []
            
        context_texts = "\n\n".join([f"[{c['source']}] {c['text'][:1500]}..." if len(c['text']) > 1500 else f"[{c['source']}] {c['text']}" for c in relevant_chunks])
        citations = list(set([c['source'] for c in relevant_chunks]))

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
                    model="llama-3.1-8b-instant",
                )
                return response.choices[0].message.content.strip(), citations
            except Exception as e:
                print(f"Groq API Error: {e}")
                pass

        # If we have Gemini setup, generate a synthesized response
        if HAS_GEMINI and api_key:
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                return response.text.strip(), citations
            except Exception as e:
                print(f"Gemini API Error: {e}")
                # Fallback to direct retrieval if API fails
                pass
                
        # Fallback if no API key or error: return the raw retrieved context
        fallback_response = f"Based on the official policies, here is the most relevant information I found:\n\n{context_texts}\n\n*(Note: Provide a GROQ_API_KEY or GEMINI_API_KEY in backend/.env for AI synthesis)*"
        return fallback_response, citations

# Singleton instance initialized in main.py
rag_service = None
