import sys
import os

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.agentic.knowledge.smart_doc_gen_kb import smart_doc_gen_kb

def main():
    print("Reloading Knowledge Base...")
    
    # 清除现有内容 (相当于 recreate=True)
    try:
        smart_doc_gen_kb.vector_db.delete()
        smart_doc_gen_kb.vector_db.create()
    except Exception as e:
        print(f"Warning during DB reset: {e}")

    # 获取所有 Markdown 文件
    from app.agentic.knowledge.smart_doc_gen_kb import kb_docs_dir
    
    markdown_files = []
    if kb_docs_dir.exists():
        for file_path in kb_docs_dir.rglob("*.md"):
            markdown_files.append(str(file_path))
    
    if markdown_files:
        print(f"Found {len(markdown_files)} markdown files. Loading...")
        try:
            smart_doc_gen_kb.add_contents(paths=markdown_files)
            print("Successfully added contents.")
        except Exception as e:
            print(f"Error adding contents: {e}")
    else:
        print(f"No markdown files found in {kb_docs_dir}")

    print("Knowledge Base reloaded process completed.")

if __name__ == "__main__":
    main()
