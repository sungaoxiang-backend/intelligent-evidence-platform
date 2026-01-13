import sys
import os
import asyncio
from pathlib import Path
from sqlalchemy.orm import selectinload
from sqlalchemy import select

# Add project root to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal
from app.cases.models import Case, CaseInfoCommit, CaseAnalysisReport, CaseStatus, CaseType
from app.users.models import User
from app.evidences.models import Evidence

async def verify_models():
    async with SessionLocal() as db:
        user = None
        try:
            # Create a test User
            user = User(name="Test Verification User")
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
            print(f"Created User ID: {user.id}")

            # Create a Case
            case = Case(
                user_id=user.id,
                case_type=CaseType.DEBT,
                case_status=CaseStatus.DRAFT,
                description="Test Case for Models"
            )
            db.add(case)
            await db.commit()
            await db.refresh(case)
            print(f"Created Case ID: {case.id}")
            
            # Create CaseInfoCommit
            commit = CaseInfoCommit(
                case_id=case.id,
                statement="User says they are owed money.",
                materials=[{"type": "image", "path": "/tmp/img.png"}]
            )
            db.add(commit)
            await db.commit()
            await db.refresh(commit)
            print(f"Created CaseInfoCommit ID: {commit.id}")
            
            # Create CaseAnalysisReport
            report = CaseAnalysisReport(
                case_id=case.id,
                content={"summary": "Valid claim", "confidence": 0.9}
            )
            db.add(report)
            await db.commit()
            await db.refresh(report)
            print(f"Created CaseAnalysisReport ID: {report.id}")
            
            # Verify Relationships
            # Use selectinload to eagerly load relationships in async context
            result = await db.execute(
                select(Case)
                .options(selectinload(Case.case_info_commits), selectinload(Case.case_analysis_reports))
                .where(Case.id == case.id)
            )
            loaded_case = result.scalar_one()
            
            commits = loaded_case.case_info_commits
            reports = loaded_case.case_analysis_reports
            
            print(f"Commits found: {len(commits)}")
            print(f"Reports found: {len(reports)}")
            
            assert len(commits) == 1
            assert len(reports) == 1
            
            assert commits[0].statement == "User says they are owed money."
            assert reports[0].content["summary"] == "Valid claim"
            
            print("Model Relationships Verification Successful!")
            
            # Test Cascade Delete
            await db.delete(loaded_case)
            await db.commit()
            
            # Check if they are gone
            # Case
            result = await db.execute(select(Case).where(Case.id == case.id))
            assert result.scalar_one_or_none() is None
            
            # Commit
            result = await db.execute(select(CaseInfoCommit).where(CaseInfoCommit.id == commit.id))
            assert result.scalar_one_or_none() is None
            
            # Report
            result = await db.execute(select(CaseAnalysisReport).where(CaseAnalysisReport.id == report.id))
            assert result.scalar_one_or_none() is None
            
            print("Cascade Delete Verification Successful!")
            
            # Cleanup User
            await db.delete(user)
            await db.commit()
            print("Cleanup Successful!")

        except Exception as e:
            print(f"Verification Failed: {e}")
            await db.rollback()
            try:
                if user:
                    await db.delete(user)
                    await db.commit()
            except:
                pass
            raise e

if __name__ == "__main__":
    asyncio.run(verify_models())
