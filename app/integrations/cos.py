import os
from datetime import datetime
from typing import BinaryIO, Dict, List, Optional, Tuple, Union

from fastapi import UploadFile
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
        self, file: BinaryIO, filename: str, folder: Optional[str] = None, disposition: str = 'inline'
    ) -> str:
        """上传文件到COS

        Args:
            file: 文件对象
            filename: 文件名
            folder: 文件夹路径

        Returns:
            文件的URL
        """
        from loguru import logger
        import mimetypes
        
        logger.debug(f"COS服务开始上传文件: {filename}, 文件夹: {folder}")
        
        try:
            # 检查文件对象是否有效
            if not file:
                logger.error(f"文件对象为空: {filename}")
                raise ValueError("文件对象为空")
            
            # 检查文件内容
            current_position = file.tell()
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)
            
            if file_size == 0:
                logger.error(f"文件大小为0: {filename}")
                raise ValueError("文件大小为0")
                
            logger.debug(f"文件大小: {file_size} 字节")
            
            # 读取前10个字节检查内容
            first_bytes = file.read(10)
            file.seek(0)
            
            if not first_bytes:
                logger.error(f"文件内容为空: {filename}")
                raise ValueError("文件内容为空")
            
            # 获取内容类型
            content_type = mimetypes.guess_type(filename)[0]
            if not content_type:
                if filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif filename.lower().endswith('.png'):
                    content_type = 'image/png'
                else:
                    content_type = 'application/octet-stream'
            
            # 生成唯一文件名
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            _, ext = os.path.splitext(filename)
            unique_filename = f"{timestamp}_{filename}"
            logger.debug(f"生成唯一文件名: {unique_filename}")
    
            # 构建对象键
            if folder:
                object_key = f"{folder}/{unique_filename}"
            else:
                object_key = unique_filename
            logger.debug(f"对象键: {object_key}")
    
            # 读取文件内容
            file_content = file.read()
            file.seek(0)
            
            # 上传文件
            logger.debug(f"开始上传到COS: Bucket={self.bucket}, Key={object_key}, disposition={disposition}")
            self.client.put_object(
                Bucket=self.bucket,
                Body=file_content,
                Key=object_key,
                StorageClass="MAZ_STANDARD",
                EnableMD5=False,
                ContentType=content_type,
                ContentDisposition=disposition
            )
            logger.debug(f"COS上传成功: {object_key}")
    
            # 返回文件URL
            file_url = f"{settings.COS_BUCKET_SERVICE}/{object_key}"
            logger.debug(f"生成文件URL: {file_url}")
            return file_url
        except Exception as e:
            logger.error(f"COS上传失败: {filename}, 错误: {str(e)}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
            raise

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
            
    async def batch_upload_files(
        self, files: List[UploadFile], folder: Optional[str] = None
    ) -> Dict[str, List]:
        """批量上传文件到COS

        Args:
            files: FastAPI UploadFile对象列表
            folder: 文件夹路径

        Returns:
            上传结果字典，包含成功和失败的上传
        """
        from app.schemas.evidence import FileUploadResponse
        import os
        from loguru import logger
        
        logger.info(f"开始批量上传文件: 文件数量={len(files)}, 目标文件夹={folder if folder else '自动确定'}")
        
        successful = []
        failed = []
        
        for index, file in enumerate(files):
            try:
                logger.debug(f"处理第{index+1}个文件: {file.filename}, 内容类型={file.content_type}")
                
                # 获取文件扩展名
                _, file_extension = os.path.splitext(file.filename)
                file_extension = file_extension.lower().lstrip(".")
                logger.debug(f"文件扩展名: {file_extension}")
                
                # 根据文件扩展名确定存储文件夹
                if file_extension in ["pdf", "doc", "docx", "txt", "xls", "xlsx"]:
                    file_folder = "documents"
                elif file_extension in ["jpg", "jpeg", "png", "gif", "bmp"]:
                    file_folder = "images"
                elif file_extension in ["mp3", "wav", "ogg", "flac"]:
                    file_folder = "audios"
                elif file_extension in ["mp4", "avi", "mov", "wmv"]:
                    file_folder = "videos"
                else:
                    file_folder = "others"
                
                # 使用指定的文件夹或根据文件类型确定的文件夹
                target_folder = folder if folder else file_folder
                logger.debug(f"目标存储文件夹: {target_folder}")
                
                # 获取文件大小和内容
                logger.debug(f"开始读取文件内容: {file.filename}")
                file_content = await file.read()
                file_size = len(file_content)
                logger.debug(f"文件大小: {file_size} 字节")
                
                # 检查文件内容是否为空
                if file_size == 0:
                    logger.warning(f"文件内容为空: {file.filename}")
                    failed.append(f"{file.filename}: 文件内容为空")
                    continue
                
                # 创建一个内存文件对象
                import io
                file_obj = io.BytesIO(file_content)
                logger.debug(f"创建内存文件对象成功: {file.filename}")
                
                # 上传文件到COS
                logger.debug(f"开始上传文件到COS: {file.filename}")
                file_url = self.upload_file(file_obj, file.filename, target_folder)
                logger.debug(f"文件上传成功: {file.filename}, URL: {file_url}")
                
                # 添加到成功列表
                successful.append(FileUploadResponse(
                    file_url=file_url,
                    file_name=file.filename,
                    file_size=file_size,
                    file_extension=file_extension,
                ))
                logger.debug(f"文件处理成功: {file.filename}")
            except Exception as e:
                # 添加到失败列表
                logger.error(f"文件处理失败: {file.filename}, 错误: {str(e)}")
                import traceback
                logger.error(f"错误详情: {traceback.format_exc()}")
                failed.append(f"{file.filename}: {str(e)}")
        
        logger.info(f"批量上传文件完成: 成功={len(successful)}, 失败={len(failed)}")
        return {"successful": successful, "failed": failed}
        
    def batch_delete_files(self, object_keys: List[str]) -> Dict[str, List[str]]:
        """批量删除COS文件

        Args:
            object_keys: 对象键列表

        Returns:
            删除结果，包含成功和失败的对象键
        """
        if not object_keys:
            return {"successful": [], "failed": []}
            
        try:
            # 构建批量删除请求格式
            objects = [{"Key": key} for key in object_keys]
            response = self.client.delete_objects(
                Bucket=self.bucket,
                Delete={"Objects": objects, "Quiet": False}
            )
            
            # 处理响应结果
            successful = [item.get("Key") for item in response.get("Deleted", [])]
            
            # 提取失败的对象键和错误信息
            failed_items = response.get("Error", [])
            failed = []
            for item in failed_items:
                key = item.get("Key")
                code = item.get("Code")
                message = item.get("Message")
                failed.append(f"{key}: {code} - {message}")
            
            return {"successful": successful, "failed": failed}
        except Exception as e:
            # 如果整个请求失败，将所有对象键标记为失败
            return {
                "successful": [], 
                "failed": [f"{key}: RequestError - {str(e)}" for key in object_keys]
            }


# 创建COS服务实例
cos_service = COSService()