import os
from datetime import datetime
from typing import BinaryIO, Optional

from qcloud_cos import CosConfig, CosS3Client

from app.core.config import settings


class COSService:
    """腾讯云对象存储服务"""

    def __init__(self):
        config = CosConfig(
            Region=settings.COS_REGION,
            SecretId=settings.COS_SECRET_ID,
            SecretKey=settings.COS_SECRET_KEY,
        )
        self.client = CosS3Client(config)
        self.bucket = settings.COS_BUCKET

    def upload_file(
        self, file: BinaryIO, filename: str, folder: Optional[str] = None
    ) -> str:
        """上传文件到COS

        Args:
            file: 文件对象
            filename: 文件名
            folder: 文件夹路径

        Returns:
            文件的URL
        """
        # 生成唯一文件名
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        _, ext = os.path.splitext(filename)
        unique_filename = f"{timestamp}_{filename}"

        # 构建对象键
        if folder:
            object_key = f"{folder}/{unique_filename}"
        else:
            object_key = unique_filename

        # 上传文件
        self.client.put_object(
            Bucket=self.bucket,
            Body=file,
            Key=object_key,
            StorageClass="STANDARD",
            EnableMD5=False,
        )

        # 返回文件URL
        return f"https://{self.bucket}.cos.{settings.COS_REGION}.myqcloud.com/{object_key}"

    def delete_file(self, object_key: str) -> bool:
        """从COS删除文件

        Args:
            object_key: 对象键

        Returns:
            是否删除成功
        """
        try:
            self.client.delete_object(Bucket=self.bucket, Key=object_key)
            return True
        except Exception:
            return False


# 创建COS服务实例
cos_service = COSService()