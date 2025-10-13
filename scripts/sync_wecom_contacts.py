#!/usr/bin/env python3
"""
企微外部联系人数据同步脚本

使用方法:
    python scripts/sync_wecom_contacts.py --mode full          # 全量同步
    python scripts/sync_wecom_contacts.py --mode incremental    # 增量同步
    python scripts/sync_wecom_contacts.py --mode status         # 查看同步状态
    python scripts/sync_wecom_contacts.py --mode test           # 测试模式（只获取数据，不写入数据库）
"""

import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.wecom.sync_service import sync_service
from app.core.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f'logs/wecom_sync_{datetime.now().strftime("%Y%m%d")}.log')
    ]
)

logger = logging.getLogger(__name__)


class WeComSyncScript:
    """企微数据同步脚本"""
    
    def __init__(self):
        self.sync_service = sync_service
    
    async def run_full_sync(self):
        """执行全量同步"""
        logger.info("=" * 60)
        logger.info("开始执行企微外部联系人全量同步")
        logger.info("=" * 60)
        
        try:
            # 执行全量同步
            result = await self.sync_service.sync_all_contacts(force_full_sync=True)
            
            # 输出同步结果
            self._print_sync_result(result)
            
            if result["error_contacts"] > 0:
                logger.warning(f"同步完成，但有 {result['error_contacts']} 个联系人处理失败")
                return 1
            else:
                logger.info("全量同步完成，无错误")
                return 0
                
        except Exception as e:
            logger.error(f"全量同步失败: {e}")
            return 1
    
    async def run_incremental_sync(self):
        """执行增量同步"""
        logger.info("=" * 60)
        logger.info("开始执行企微外部联系人增量同步")
        logger.info("=" * 60)
        
        try:
            # 执行增量同步
            result = await self.sync_service.sync_all_contacts(force_full_sync=False)
            
            # 输出同步结果
            self._print_sync_result(result)
            
            if result["error_contacts"] > 0:
                logger.warning(f"增量同步完成，但有 {result['error_contacts']} 个联系人处理失败")
                return 1
            else:
                logger.info("增量同步完成，无错误")
                return 0
                
        except Exception as e:
            logger.error(f"增量同步失败: {e}")
            return 1
    
    async def show_sync_status(self):
        """显示同步状态"""
        logger.info("=" * 60)
        logger.info("企微外部联系人同步状态")
        logger.info("=" * 60)
        
        try:
            status = await self.sync_service.get_sync_status()
            
            if "error" in status:
                logger.error(f"获取同步状态失败: {status['error']}")
                return 1
            
            logger.info(f"总外部联系人数量: {status['total_contacts']}")
            logger.info(f"活跃会话数量: {status['active_sessions']}")
            logger.info(f"员工数量: {status['total_staff']}")
            logger.info(f"最后同步时间: {status['last_sync_time']}")
            
            return 0
            
        except Exception as e:
            logger.error(f"获取同步状态失败: {e}")
            return 1
    
    async def run_test_mode(self):
        """运行测试模式（只获取数据，不写入数据库）"""
        logger.info("=" * 60)
        logger.info("企微外部联系人数据获取测试模式")
        logger.info("=" * 60)
        
        try:
            # 1. 获取基础数据
            all_contacts = await self.sync_service._fetch_all_contacts()
            logger.info(f"从企微API获取到 {len(all_contacts)} 个外部联系人")
            
            # 2. 获取员工列表
            staff_userids = await self.sync_service._get_staff_userids()
            logger.info(f"获取到 {len(staff_userids)} 个员工，准备批量获取客户详情")
            
            # 3. 批量获取客户详情
            detailed_contacts = await self.sync_service._batch_get_detailed_contacts(staff_userids)
            logger.info(f"批量获取到 {len(detailed_contacts)} 条详细客户信息")
            
            # 4. 合并数据
            enriched_contacts = self.sync_service._merge_contact_data(all_contacts, detailed_contacts)
            logger.info(f"合并后得到 {len(enriched_contacts)} 条完整客户信息")
            
            logger.info(f"测试模式完成，共获取到 {len(all_contacts)} 个外部联系人")
            
            # 统计客户和非客户数量
            customers = [c for c in all_contacts if c.get("is_customer", False)]
            non_customers = [c for c in all_contacts if not c.get("is_customer", False)]
            
            logger.info(f"客户数量: {len(customers)}")
            logger.info(f"非客户外部联系人数量: {len(non_customers)}")
            
            # 显示前几个联系人信息（包含详细信息）
            logger.info("前5个联系人信息示例:")
            for i, contact in enumerate(enriched_contacts[:5]):
                detailed_info = contact.get("detailed_info", {})
                external_contact = detailed_info.get("external_contact", {})
                real_name = external_contact.get("name", contact.get("name", "N/A"))
                
                logger.info(f"  {i+1}. is_customer: {contact.get('is_customer')}, "
                           f"name: {real_name}, "
                           f"external_userid: {contact.get('external_userid', 'N/A')[:10]}...")
            
            return 0
            
        except Exception as e:
            logger.error(f"测试模式失败: {e}")
            return 1
    
    def _print_sync_result(self, result: dict):
        """打印同步结果"""
        logger.info("=" * 60)
        logger.info("同步结果统计")
        logger.info("=" * 60)
        logger.info(f"总获取数量: {result['total_fetched']}")
        logger.info(f"总处理数量: {result['total_processed']}")
        logger.info(f"新增联系人: {result['new_contacts']}")
        logger.info(f"更新联系人: {result['updated_contacts']}")
        logger.info(f"跳过联系人: {result['skipped_contacts']}")
        logger.info(f"错误联系人: {result['error_contacts']}")
        logger.info(f"同步耗时: {result['sync_duration']:.2f} 秒")
        
        if result['errors']:
            logger.warning(f"错误详情 (前10个):")
            for i, error in enumerate(result['errors'][:10]):
                logger.warning(f"  {i+1}. {error}")
            
            if len(result['errors']) > 10:
                logger.warning(f"  ... 还有 {len(result['errors']) - 10} 个错误")


async def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="企微外部联系人数据同步脚本")
    parser.add_argument(
        "--mode", 
        choices=["full", "incremental", "status", "test"],
        default="incremental",
        help="同步模式: full(全量), incremental(增量), status(状态), test(测试)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="详细输出"
    )
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 检查环境变量
    required_env_vars = [
        "WECOM_CORP_ID", "WECOM_CORP_SECRET", "WECOM_AGENT_ID",
        "WECOM_TOKEN", "WECOM_ENCODING_AES_KEY"
    ]
    
    missing_vars = [var for var in required_env_vars if not getattr(settings, var, None)]
    if missing_vars:
        logger.error(f"缺少必要的环境变量: {', '.join(missing_vars)}")
        return 1
    
    # 创建脚本实例
    script = WeComSyncScript()
    
    # 根据模式执行相应操作
    if args.mode == "full":
        return await script.run_full_sync()
    elif args.mode == "incremental":
        return await script.run_incremental_sync()
    elif args.mode == "status":
        return await script.show_sync_status()
    elif args.mode == "test":
        return await script.run_test_mode()
    else:
        logger.error(f"未知的同步模式: {args.mode}")
        return 1


if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        logger.info("用户中断同步操作")
        sys.exit(1)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)


