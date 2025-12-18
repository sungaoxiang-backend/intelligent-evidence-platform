import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

def main():
    print("Reloading Knowledge Base...")
    smart_doc_gen_kb.load(recreate=True)
    print("Knowledge Base reloaded successfully.")

if __name__ == "__main__":
    main()
