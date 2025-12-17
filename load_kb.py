from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

def load():
    print("Loading Smart Doc Gen Knowledge Base...")
    smart_doc_gen_kb.load(recreate=True)
    print("Knowledge Base loaded successfully.")

if __name__ == "__main__":
    load()
