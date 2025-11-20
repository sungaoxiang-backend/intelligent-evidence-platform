#!/usr/bin/env python3
"""
清理生产数据库中的测试用户数据

警告：此脚本会删除数据，请谨慎使用！
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select as sql_select, delete as sql_delete
from app.core.config import settings
from app.users.models import User
from app.cases.models import Case as CaseModel


async def cleanup_test_users():
    """清理测试用户数据"""
    
    # 连接数据库
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        # 查找测试用户（根据名称模式匹配）
        test_patterns = [
            "%test_user%",
            "%占位符测试用户%",
            "%导出用户%",
            "%测试模板用户%",
        ]
        
        total_deleted_users = 0
        total_deleted_cases = 0
        
        for pattern in test_patterns:
            # 查找匹配的用户
            stmt = sql_select(User).where(User.name.like(pattern))
            result = await session.execute(stmt)
            test_users = result.scalars().all()
            
            if test_users:
                print(f"\n找到 {len(test_users)} 个匹配 '{pattern}' 的用户:")
                for user in test_users:
                    print(f"  - ID: {user.id}, Name: {user.name}, Phone: {user.phone}")
                
                # 询问确认
                confirm = input(f"\n是否删除这些用户及其关联的案件? (yes/no): ").strip().lower()
                
                if confirm == 'yes':
                    # 删除关联的案件
                    for user in test_users:
                        # 查找该用户的案件
                        case_stmt = sql_select(CaseModel).where(CaseModel.user_id == user.id)
                        case_result = await session.execute(case_stmt)
                        user_cases = case_result.scalars().all()
                        
                        if user_cases:
                            print(f"  删除用户 {user.name} 的 {len(user_cases)} 个案件...")
                            for case in user_cases:
                                await session.delete(case)
                                total_deleted_cases += 1
                        
                        # 删除用户
                        await session.delete(user)
                        total_deleted_users += 1
                    
                    await session.commit()
                    print(f"✅ 成功删除 {len(test_users)} 个用户")
                else:
                    print(f"⏭️  跳过删除")
        
        print(f"\n{'='*60}")
        print(f"清理完成:")
        print(f"  - 删除用户: {total_deleted_users}")
        print(f"  - 删除案件: {total_deleted_cases}")
        print(f"{'='*60}")
    
    await engine.dispose()


async def list_suspicious_users():
    """列出可疑的测试用户（仅查看，不删除）"""
    
    engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI))
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with async_session() as session:
        # 查找测试用户
        test_patterns = [
            "%test_user%",
            "%占位符%",
            "%测试%",
        ]
        
        all_suspicious = []
        
        for pattern in test_patterns:
            stmt = sql_select(User).where(User.name.like(pattern))
            result = await session.execute(stmt)
            users = result.scalars().all()
            
            for user in users:
                if user.id not in [u.id for u in all_suspicious]:
                    all_suspicious.append(user)
        
        if all_suspicious:
            print(f"\n找到 {len(all_suspicious)} 个可疑的测试用户:")
            print(f"{'ID':<10} {'姓名':<30} {'手机号':<15} {'创建时间'}")
            print("="*80)
            for user in all_suspicious:
                print(f"{user.id:<10} {user.name:<30} {user.phone:<15} {user.created_at}")
        else:
            print("\n✅ 未找到可疑的测试用户")
    
    await engine.dispose()


async def main():
    """主函数"""
    print("\n" + "="*60)
    print("清理测试用户数据工具")
    print("="*60)
    
    print("\n选项:")
    print("1. 查看可疑的测试用户（仅查看）")
    print("2. 清理测试用户（会删除数据）")
    print("3. 退出")
    
    choice = input("\n请选择操作 (1/2/3): ").strip()
    
    if choice == "1":
        await list_suspicious_users()
    elif choice == "2":
        print("\n⚠️  警告：此操作会删除数据，请确保已备份！")
        confirm = input("是否继续? (yes/no): ").strip().lower()
        if confirm == "yes":
            await cleanup_test_users()
        else:
            print("已取消操作")
    elif choice == "3":
        print("退出")
    else:
        print("无效选择")


if __name__ == "__main__":
    asyncio.run(main())

