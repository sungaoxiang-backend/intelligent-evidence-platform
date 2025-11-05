from enum import Enum
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy import Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text, Float, Boolean, JSON, DateTime, Table, Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB  # 使用JSONB替代JSON以获得更好的性能
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.cases.models import VaildationStatus

class EvidenceStatus(str, Enum):
    """证据状态"""
    UPLOADED = "uploaded"          # 已上传
    CLASSIFIED = "classified"      # 已分类
    FEATURES_EXTRACTED = "features_extracted"  # 特征已提取
    CHECKED = "checked"        # 已审核
    
class EvidenceRole(str, Enum):
    """证据角色"""
    CREDITOR = "creditor"
    DEBTOR = "debtor"

class Evidence(Base):
    """证据模型"""    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence_status: Mapped[str] = mapped_column(String(20), default=EvidenceStatus.UPLOADED)
    validation_status: Mapped[str] = mapped_column(String(20), default=VaildationStatus.PENDING)
    evidence_role: Mapped[str] = mapped_column(String(20), nullable=True, default=None)
    
    # 分类元数据
    classification_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    classification_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    classification_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    classified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    
    # 特征提取元数据
    evidence_features: Mapped[Optional[List[Dict]]] = mapped_column(JSONB, nullable=True)
    features_extracted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    
    # 关系
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="evidences")

    # 证据通过关联表关联到卡片（多对多关系）
    evidence_cards = relationship(
        "EvidenceCard", 
        secondary=lambda: evidence_card_evidence_association,
        back_populates="evidences"
    )

    async def get_associated_cards(
        self,
        db,
        filters: Optional[Dict] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List["EvidenceCard"]:
        """
        获取该证据参与铸造过的卡片列表（支持筛选）
        
        用于前端页面：选中证据时，可选的筛选其参与铸造过的卡片的列表。
        
        Args:
            db: 数据库会话（AsyncSession）
            filters: 筛选条件字典，支持以下字段：
                - card_type: 卡片类型（从 card_info 中提取）
                - card_is_associated: 是否关联提取（从 card_info 中提取）
                - updated_times_min: 更新次数最小值
                - updated_times_max: 更新次数最大值
                - created_after: 创建时间之后（datetime）
                - created_before: 创建时间之前（datetime）
            skip: 跳过记录数（分页）
            limit: 返回记录数限制（分页）
            
        Returns:
            List[EvidenceCard]: 关联的卡片列表
        """
        from sqlalchemy import select, and_, func, cast, Text
        
        # 构建基础查询：从关联表中查找与该证据关联的卡片
        query = select(EvidenceCard).join(
            evidence_card_evidence_association,
            EvidenceCard.id == evidence_card_evidence_association.c.evidence_card_id
        ).where(
            evidence_card_evidence_association.c.evidence_id == self.id
        )
        
        # 应用筛选条件
        if filters:
            conditions = []
            
            # 筛选 card_type（从 card_info JSONB 中提取）
            if card_type := filters.get("card_type"):
                conditions.append(
                    func.jsonb_extract_path_text(EvidenceCard.card_info, cast('card_type', Text)) == card_type
                )
            
            # 筛选 card_is_associated（从 card_info JSONB 中提取）
            if card_is_associated := filters.get("card_is_associated"):
                if isinstance(card_is_associated, bool):
                    conditions.append(
                        func.jsonb_extract_path_text(EvidenceCard.card_info, cast('card_is_associated', Text)) == str(card_is_associated).lower()
                    )
            
            # 筛选 updated_times
            if updated_times_min := filters.get("updated_times_min"):
                conditions.append(EvidenceCard.updated_times >= updated_times_min)
            if updated_times_max := filters.get("updated_times_max"):
                conditions.append(EvidenceCard.updated_times <= updated_times_max)
            
            # 筛选创建时间
            if created_after := filters.get("created_after"):
                conditions.append(EvidenceCard.created_at >= created_after)
            if created_before := filters.get("created_before"):
                conditions.append(EvidenceCard.created_at <= created_before)
            
            if conditions:
                query = query.where(and_(*conditions))
        
        # 应用分页和排序（按创建时间降序）
        query = query.order_by(EvidenceCard.created_at.desc()).offset(skip).limit(limit)
        
        # 执行查询
        result = await db.execute(query)
        return list(result.scalars().unique().all())


# 证据卡片与证据的多对多关联表（证据外键关联卡片）
# 支持引用证据的顺序管理（sequence_number）
evidence_card_evidence_association = Table(
    "evidence_card_evidence_association",
    Base.metadata,
    Column("evidence_card_id", Integer, ForeignKey("evidence_cards.id", ondelete="CASCADE"), primary_key=True),
    Column("evidence_id", Integer, ForeignKey("evidences.id", ondelete="CASCADE"), primary_key=True),
    Column("sequence_number", Integer, nullable=False, default=0, comment="引用证据的顺序序号，从0开始"),
)


class EvidenceCard(Base):
    """证据卡片（快照）模型
    
    一个卡片可以引用1到多个原始证据来构成卡片。
    支持两种场景：
    - 单个证据提取：card_is_associated=False，引用一个证据
    - 关联证据提取：card_is_associated=True，引用多个证据（如微信聊天记录）
    
    card_info 结构（Dict类型）：
    {
        "card_type": "微信个人主页",
        "card_is_associated": False,
        "card_features": [...]
    }
    """
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    card_info: Mapped[Optional[Dict]] = mapped_column(JSONB, nullable=True)  # 改为 Dict 类型
    updated_times: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 多对多关系：一个卡片可以关联多个证据
    evidences = relationship(
        "Evidence", 
        secondary=evidence_card_evidence_association,
        back_populates="evidence_cards"
    )

    async def get_associated_evidences(
        self,
        db,
        filters: Optional[Dict] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List["Evidence"]:
        """
        获取该卡片关联的原始证据列表（支持筛选）
        
        用于前端页面：选中卡片时，可选的筛选其关联的原始证据。
        
        Args:
            db: 数据库会话（AsyncSession）
            filters: 筛选条件字典，支持以下字段：
                - case_id: 案件ID
                - evidence_status: 证据状态
                - evidence_role: 证据角色
                - classification_category: 分类类别
                - file_extension: 文件扩展名
            skip: 跳过记录数（分页）
            limit: 返回记录数限制（分页）
            
        Returns:
            List[Evidence]: 关联的证据列表
        """
        from sqlalchemy import select, and_
        
        # 构建基础查询：从关联表中查找与该卡片关联的证据
        query = select(Evidence).join(
            evidence_card_evidence_association,
            Evidence.id == evidence_card_evidence_association.c.evidence_id
        ).where(
            evidence_card_evidence_association.c.evidence_card_id == self.id
        )
        
        # 应用筛选条件
        if filters:
            conditions = []
            
            if case_id := filters.get("case_id"):
                conditions.append(Evidence.case_id == case_id)
            if evidence_status := filters.get("evidence_status"):
                conditions.append(Evidence.evidence_status == evidence_status)
            if evidence_role := filters.get("evidence_role"):
                conditions.append(Evidence.evidence_role == evidence_role)
            if classification_category := filters.get("classification_category"):
                conditions.append(Evidence.classification_category == classification_category)
            if file_extension := filters.get("file_extension"):
                conditions.append(Evidence.file_extension == file_extension)
            
            if conditions:
                query = query.where(and_(*conditions))
        
        # 应用分页
        query = query.offset(skip).limit(limit)
        
        # 执行查询
        result = await db.execute(query)
        return list(result.scalars().unique().all())

    @classmethod
    async def update_or_create(
        cls,
        db,
        evidence_ids: List[int],
        card_info: Optional[Dict],
    ) -> "EvidenceCard":
        """
        更新或创建证据卡片
        
        如果存在完全相同的卡片快照（相同的 evidence_ids 和 card_info），
        则更新其时间戳（updated_at）和更新次数（updated_times）；否则创建新卡片。
        
        注意：在比较 card_info 时，会自动排除白名单中的字段（如 updated_at, 
        updated_times, created_at, id 等），因为这些字段始终是变动的，不应该参与
        卡片快照的一致性比较。
        
        card_info 结构：
        {
            "card_type": "微信个人主页",
            "card_is_associated": False,
            "card_features": [...]
        }
        
        此方法将业务逻辑内聚到模型层，确保卡片快照的唯一性约束。
        
        Args:
            db: 数据库会话（AsyncSession）
            evidence_ids: 证据ID列表（支持1到多个证据）
            card_info: 卡片信息（JSONB Dict），包含类型、特征等信息
            
        Returns:
            EvidenceCard: 更新或创建的卡片实例
        """
        from sqlalchemy import select, func
        from sqlalchemy.ext.asyncio import AsyncSession
        from datetime import datetime
        import pytz
        
        # 标准化 evidence_ids（排序以便比较）
        sorted_evidence_ids = sorted(set(evidence_ids))  # 去重并排序
        
        if not sorted_evidence_ids:
            raise ValueError("evidence_ids 不能为空")
        
        # 查找关联了这些 evidence_ids 的所有卡片
        # 需要找到关联的证据数量与传入的 evidence_ids 数量相同的卡片
        # 然后检查它们关联的证据ID是否完全相同
        from sqlalchemy.orm import selectinload
        
        result = await db.execute(
            select(cls)
            .options(selectinload(cls.evidences))  # 预加载 evidences 关系
            .join(
                evidence_card_evidence_association,
                cls.id == evidence_card_evidence_association.c.evidence_card_id
            ).where(
                evidence_card_evidence_association.c.evidence_id.in_(sorted_evidence_ids)
            ).group_by(cls.id).having(
                func.count(evidence_card_evidence_association.c.evidence_id.distinct()) == len(sorted_evidence_ids)
            )
        )
        candidate_cards = result.scalars().unique().all()

        # 查找是否存在完全相同的卡片（比较 card_info 和 evidence_ids）
        matched_card = None
        for card in candidate_cards:
            # 获取卡片关联的所有 evidence_ids（已经通过 selectinload 预加载）
            card_evidence_ids = sorted([ev.id for ev in card.evidences])
            
            # 比较 evidence_ids 和 card_info
            if card_evidence_ids == sorted_evidence_ids:
                # 处理 None 值的情况
                if card.card_info is None and card_info is None:
                    matched_card = card
                    break
                elif card.card_info is not None and card_info is not None:
                    if cls._deep_compare_dict(card.card_info, card_info):
                        matched_card = card
                        break
        
        if matched_card:
            # 找到相同的卡片，更新时间戳和更新次数
            shanghai_tz = pytz.timezone('Asia/Shanghai')
            matched_card.updated_at = datetime.now(shanghai_tz)
            matched_card.updated_times = (matched_card.updated_times or 0) + 1
            await db.commit()
            # 刷新时需要加载关系
            await db.refresh(matched_card, ["evidences"])
            return matched_card
        else:
            # 没有找到相同的卡片，创建新卡片
            new_card = cls(
                card_info=card_info
            )
            db.add(new_card)
            await db.flush()  # 先刷新以获取 card.id
            
            # 验证证据是否存在
            evidences_result = await db.execute(
                select(Evidence).where(Evidence.id.in_(sorted_evidence_ids))
            )
            evidences = evidences_result.scalars().all()
            
            if len(evidences) != len(sorted_evidence_ids):
                missing_ids = set(sorted_evidence_ids) - {ev.id for ev in evidences}
                raise ValueError(f"找不到以下证据ID: {missing_ids}")
            
            # 直接向关联表插入记录，避免通过 relationship 属性设置（会触发懒加载）
            from sqlalchemy import insert
            association_records = [
                {
                    "evidence_card_id": new_card.id,
                    "evidence_id": ev_id
                }
                for ev_id in sorted_evidence_ids
            ]
            await db.execute(
                insert(evidence_card_evidence_association).values(association_records)
            )
            await db.flush()  # 刷新以保存关联关系
            
            await db.commit()
            # 刷新时需要加载关系
            await db.refresh(new_card, ["evidences"])
            return new_card
    
    # 需要排除的比较字段（白名单保护层）
    # 这些字段始终是变动的，不应该参与卡片快照的一致性比较
    _EXCLUDED_COMPARISON_FIELDS = {
        'updated_at',
        'updated_times',
        'created_at',
        'id',  # ID 字段也不需要比较
    }
    
    
    @classmethod
    def _deep_compare_dict(cls, dict1: Dict, dict2: Dict) -> bool:
        """
        深度比较两个字典是否完全相同
        
        在比较时会排除白名单中的字段（如 updated_at, updated_times, created_at 等），
        因为这些字段始终是变动的，不应该参与卡片快照的一致性比较。
        
        对于列表比较，会忽略顺序（使用集合比较），但对于 card_features 列表，
        会根据关键字段（slot_name, slot_value等）进行匹配比较。
        
        Args:
            dict1: 第一个字典
            dict2: 第二个字典
            
        Returns:
            bool: 如果字典完全一致则返回True
        """
        # 类型签名保证参数是 Dict 类型，但为了防御性编程使用 assert
        assert isinstance(dict1, dict) and isinstance(dict2, dict), \
            f"Expected Dict, got {type(dict1)} and {type(dict2)}"
        
        # 过滤掉需要排除的字段后，获取实际需要比较的键
        keys1 = {k for k in dict1.keys() if k not in cls._EXCLUDED_COMPARISON_FIELDS}
        keys2 = {k for k in dict2.keys() if k not in cls._EXCLUDED_COMPARISON_FIELDS}
        
        # 检查过滤后的键是否相同
        if keys1 != keys2:
            return False
        
        # 递归比较每个键的值（排除不需要比较的字段）
        for key in keys1:
            val1 = dict1[key]
            val2 = dict2[key]
            
            # 如果值都是字典，递归比较
            if isinstance(val1, dict) and isinstance(val2, dict):
                if not cls._deep_compare_dict(val1, val2):
                    return False
            # 如果值都是列表，深度比较列表（支持无序比较）
            elif isinstance(val1, list) and isinstance(val2, list):
                if not cls._deep_compare_list(val1, val2):
                    return False
            # 其他类型直接比较
            else:
                if val1 != val2:
                    return False
        
        return True
    
    @classmethod
    def _deep_compare_list(cls, list1: list, list2: list) -> bool:
        """
        深度比较两个列表是否完全相同
        
        对于 card_features 列表，会根据关键字段进行匹配比较，
        忽略列表顺序和某些非关键字段（如 reasoning 的细微差异）。
        
        Args:
            list1: 第一个列表
            list2: 第二个列表
            
        Returns:
            bool: 如果列表完全一致则返回True
        """
        if len(list1) != len(list2):
            return False
        
        # 如果列表为空，直接返回 True
        if len(list1) == 0:
            return True
        
        # 检查列表元素类型
        # 如果第一个元素是字典，使用字典匹配比较
        if isinstance(list1[0], dict) and isinstance(list2[0], dict):
            # 为每个列表创建一个用于匹配的"指纹"集合
            # 对于 card_features，使用 slot_name, slot_value, slot_value_type 等关键字段作为指纹
            def get_feature_key(item: dict) -> tuple:
                """生成特征的关键字段元组，用于匹配"""
                return (
                    item.get("slot_name", ""),
                    item.get("slot_value", ""),
                    item.get("slot_value_type", ""),
                )
            
            # 将列表转换为以特征键为键的字典，便于匹配
            items1 = {get_feature_key(item): item for item in list1}
            items2 = {get_feature_key(item): item for item in list2}
            
            # 检查特征键是否相同
            if items1.keys() != items2.keys():
                return False
            
            # 对每个匹配的特征进行深度比较（排除 reasoning 和 confidence 的微小差异）
            for key in items1.keys():
                item1 = items1[key]
                item2 = items2[key]
                
                # 比较关键字段
                if item1.get("slot_name") != item2.get("slot_name"):
                    return False
                if item1.get("slot_value") != item2.get("slot_value"):
                    return False
                if item1.get("slot_value_type") != item2.get("slot_value_type"):
                    return False
                
                # 比较 slot_group_info（需要深度比较）
                slot_group_info1 = item1.get("slot_group_info")
                slot_group_info2 = item2.get("slot_group_info")
                if slot_group_info1 != slot_group_info2:
                    # 如果都是列表，进行深度比较
                    if isinstance(slot_group_info1, list) and isinstance(slot_group_info2, list):
                        if len(slot_group_info1) != len(slot_group_info2):
                            return False
                        # 对每个分组信息进行匹配比较
                        groups1 = {(g.get("group_name", ""), tuple(sorted(g.get("reference_evidence_ids", [])))) 
                                  for g in slot_group_info1}
                        groups2 = {(g.get("group_name", ""), tuple(sorted(g.get("reference_evidence_ids", [])))) 
                                  for g in slot_group_info2}
                        if groups1 != groups2:
                            return False
                    else:
                        return False
                
                # confidence 和 reasoning 字段的差异不影响卡片一致性
                # （这些字段可能在多次提取时有微小差异，但不影响业务逻辑）
        else:
            # 非字典列表，直接按顺序比较
            for v1, v2 in zip(list1, list2):
                if isinstance(v1, dict) and isinstance(v2, dict):
                    if not cls._deep_compare_dict(v1, v2):
                        return False
                elif isinstance(v1, list) and isinstance(v2, list):
                    if not cls._deep_compare_list(v1, v2):
                        return False
                elif v1 != v2:
                    return False
        
        return True


class EvidenceCardSlotAssignment(Base):
    """证据卡片槽位关联模型
    
    记录某个案件、某个模板、某个槽位与卡片的关联关系。
    这是一个快照机制，用于保存用户将卡片拖拽到槽位后的状态。
    """
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    template_id: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="模板ID，如：民间借贷纠纷-微信聊天记录主证据-个人-个人-卡片槽位模板")
    slot_id: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="槽位ID，格式：slot::{role}::{cardType}::{index}")
    card_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("evidence_cards.id", ondelete="SET NULL"), nullable=True, comment="关联的卡片ID，null表示该槽位未放置卡片")
    
    # 关系
    case = relationship("Case", backref="card_slot_assignments")
    card = relationship("EvidenceCard", backref="slot_assignments")
    
    # 唯一约束：同一个案件、模板、槽位的组合只能有一个关联记录
    __table_args__ = (
        UniqueConstraint('case_id', 'template_id', 'slot_id', name='uq_case_template_slot'),
        {"comment": "证据卡片槽位关联表，记录卡片在槽位模板中的快照状态"},
    )
    
    @classmethod
    async def get_snapshot(
        cls,
        db,
        case_id: int,
        template_id: str,
    ) -> Dict[str, Optional[int]]:
        """
        获取某个案件、某个模板的槽位快照
        
        Returns:
            Dict[str, Optional[int]]: 槽位ID到卡片ID的映射，例如 {"slot::creditor::身份证::0": 123, ...}
        """
        from sqlalchemy import select
        
        result = await db.execute(
            select(cls)
            .where(cls.case_id == case_id)
            .where(cls.template_id == template_id)
        )
        assignments = result.scalars().all()
        
        return {assignment.slot_id: assignment.card_id for assignment in assignments}
    
    @classmethod
    async def update_assignment(
        cls,
        db,
        case_id: int,
        template_id: str,
        slot_id: str,
        card_id: Optional[int],
    ) -> "EvidenceCardSlotAssignment":
        """
        更新或创建槽位关联
        
        Args:
            db: 数据库会话
            case_id: 案件ID
            template_id: 模板ID
            slot_id: 槽位ID
            card_id: 卡片ID（None表示移除关联）
            
        Returns:
            EvidenceCardSlotAssignment: 更新或创建的关联记录
        """
        from sqlalchemy import select
        
        # 查找现有记录
        result = await db.execute(
            select(cls)
            .where(cls.case_id == case_id)
            .where(cls.template_id == template_id)
            .where(cls.slot_id == slot_id)
        )
        assignment = result.scalar_one_or_none()
        
        if assignment:
            # 更新现有记录
            assignment.card_id = card_id
        else:
            # 创建新记录
            assignment = cls(
                case_id=case_id,
                template_id=template_id,
                slot_id=slot_id,
                card_id=card_id,
            )
            db.add(assignment)
        
        await db.commit()
        await db.refresh(assignment)
        return assignment
    
    @classmethod
    async def reset_snapshot(
        cls,
        db,
        case_id: int,
        template_id: str,
    ) -> int:
        """
        重置某个案件、某个模板的所有槽位关联（删除所有关联记录）
        
        Returns:
            int: 删除的记录数
        """
        from sqlalchemy import delete
        
        result = await db.execute(
            delete(cls)
            .where(cls.case_id == case_id)
            .where(cls.template_id == template_id)
        )
        await db.commit()
        return result.rowcount
    