"""
文件名处理工具模块
用于在上传文件时清理文件名，确保后续多模态LLM调用不会出错
"""
import re
import uuid
from typing import Tuple
from loguru import logger


def sanitize_filename_for_llm(filename: str) -> str:
    """
    清理文件名，使其符合多模态LLM的要求
    只处理特殊字符，保持文件名可读性
    
    Args:
        filename: 原始文件名
        
    Returns:
        清理后的文件名
    """
    if not filename:
        return filename
    
    # 分离文件名和扩展名
    name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
    
    # 只清理明显有问题的字符，保持文件名可读性
    # 1. 移除括号及其内容
    name = re.sub(r'\([^)]*\)', '', name)
    
    # 2. 替换连续的下划线为单个下划线
    name = re.sub(r'_+', '_', name)
    
    # 3. 移除开头和结尾的下划线
    name = name.strip('_')
    
    # 4. 替换空格为下划线
    name = name.replace(' ', '_')
    
    # 5. 确保文件名不为空
    if not name.strip():
        name = f"file_{uuid.uuid4().hex[:8]}"
    
    # 6. 限制文件名长度
    if len(name) > 100:
        name = name[:100]
    
    # 重新组合文件名
    if ext:
        return f"{name}.{ext}"
    else:
        return name


def validate_filename_for_llm(filename: str) -> Tuple[bool, str]:
    """
    验证文件名是否适合多模态LLM处理
    
    Args:
        filename: 要验证的文件名
        
    Returns:
        (是否有效, 错误信息)
    """
    if not filename:
        return False, "文件名为空"
    
    # 检查问题字符模式
    problematic_patterns = [
        r'\([^)]*\)',  # 括号
        r'_\d+_',      # 下划线数字下划线
    ]
    
    for pattern in problematic_patterns:
        if re.search(pattern, filename):
            return False, f"文件名包含问题字符模式: {pattern}"
    
    # 检查文件名长度
    if len(filename) > 150:
        return False, "文件名过长"
    
    return True, ""


# 测试函数
def test_filename_utils():
    """测试文件名处理工具"""
    test_cases = [
        "转账电子凭证 (1)_00_副本.png",
        "转账电子凭证副本.png", 
        "test_file(1)_00_copy.jpg",
        "正常文件名.pdf",
        "file with spaces.docx"
    ]
    
    print("文件名处理测试:")
    for filename in test_cases:
        safe_name = sanitize_filename_for_llm(filename)
        is_valid, error = validate_filename_for_llm(filename)
        
        print(f"\n原始: {filename}")
        print(f"清理后: {safe_name}")
        print(f"是否有效: {is_valid}")
        if not is_valid:
            print(f"错误: {error}")


if __name__ == "__main__":
    test_filename_utils()