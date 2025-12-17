import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.getcwd())

from app.core.config_manager import config_manager
from app.agentic.agents.smart_doc_gen_agent import generate_document_for_case

async def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/verify_smart_doc_gen.py <case_id> <template_path> [output_path]")
        return

    case_id = int(sys.argv[1])
    template_path = sys.argv[2]
    output_path = sys.argv[3] if len(sys.argv) > 3 else "output.docx"

    # Setup DB
    # Assuming config_manager or env vars have DB URL.
    # We might need to look at app/db/base.py or similar to get the engine string.
    # For now, let's try to get it from config if available or standard env.
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/intelligent_evidence_platform")
    
    engine = create_async_engine(database_url, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            print(f"Generating document for Case ID: {case_id}")
            print(f"Template: {template_path}")
            print(f"Output: {output_path}")
            
            result = await generate_document_for_case(session, case_id, template_path, output_path)
            print("-" * 30)
            print("Result:")
            print(result)
            print("-" * 30)
            
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
