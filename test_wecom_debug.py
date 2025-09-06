#!/usr/bin/env python3
"""
测试企业微信回调验证 - 使用真实的参数进行调试
"""

import hashlib
import base64
import urllib.parse
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad
import os

# 真实的参数（来自服务器日志）
REAL_SIGNATURE = "b72f57f2880573b6ffb12148b1bb31e361283d33"
REAL_TIMESTAMP = "1757169997" 
REAL_NONCE = "1756995668"
REAL_ECHOSTR = "+BIK52/kQqXFBz/hZGf8AkoVImaX9S5h8cLsFNNF97JmFucneLo47BzxdUEClGPhtMuZMfxnj66NhF0QhPTWPA=="

# 配置（你需要提供这些值）
TOKEN = "your_token_here"  # 请替换为你的实际token
ENCODING_AES_KEY = "your_encoding_aes_key_here"  # 请替换为你的实际encoding_aes_key
CORP_ID = "your_corp_id_here"  # 请替换为你的实际corp_id

def test_signature_verification():
    """测试签名验证"""
    print("=== 测试签名验证 ===")
    print(f"真实签名: {REAL_SIGNATURE}")
    print(f"时间戳: {REAL_TIMESTAMP}")
    print(f"随机数: {REAL_NONCE}")
    print(f"原始echostr: {REAL_ECHOSTR}")
    
    # URL解码 echostr
    echostr_decoded = urllib.parse.unquote(REAL_ECHOSTR)
    print(f"URL解码后的echostr: {echostr_decoded}")
    
    # 方法1: 只使用token、timestamp、nonce（URL验证阶段）
    tmp_list_1 = [TOKEN, REAL_TIMESTAMP, REAL_NONCE]
    tmp_list_1.sort()
    tmp_str_1 = "".join(tmp_list_1)
    sha1_1 = hashlib.sha1(tmp_str_1.encode("utf-8")).hexdigest()
    print(f"方法1（三参数）签名: {sha1_1}")
    print(f"方法1验证结果: {'通过' if sha1_1 == REAL_SIGNATURE else '失败'}")
    
    # 方法2: 使用token、timestamp、nonce、echostr_decoded
    tmp_list_2 = [TOKEN, REAL_TIMESTAMP, REAL_NONCE, echostr_decoded]
    tmp_list_2.sort()
    tmp_str_2 = "".join(tmp_list_2)
    sha1_2 = hashlib.sha1(tmp_str_2.encode("utf-8")).hexdigest()
    print(f"方法2（四参数）签名: {sha1_2}")
    print(f"方法2验证结果: {'通过' if sha1_2 == REAL_SIGNATURE else '失败'}")
    
    # 方法3: 使用token、timestamp、nonce、原始echostr（未解码）
    tmp_list_3 = [TOKEN, REAL_TIMESTAMP, REAL_NONCE, REAL_ECHOSTR]
    tmp_list_3.sort()
    tmp_str_3 = "".join(tmp_list_3)
    sha1_3 = hashlib.sha1(tmp_str_3.encode("utf-8")).hexdigest()
    print(f"方法3（四参数+原始echostr）签名: {sha1_3}")
    print(f"方法3验证结果: {'通过' if sha1_3 == REAL_SIGNATURE else '失败'}")
    
    return sha1_1 == REAL_SIGNATURE or sha1_2 == REAL_SIGNATURE or sha1_3 == REAL_SIGNATURE

def test_decryption():
    """测试解密"""
    print("\n=== 测试解密 ===")
    try:
        # URL解码
        encrypted_msg_decoded = urllib.parse.unquote(REAL_ECHOSTR)
        print(f"URL解码后的加密消息: {encrypted_msg_decoded}")
        
        # Base64解码
        encrypted_data = base64.b64decode(encrypted_msg_decoded)
        print(f"Base64解码后的数据长度: {len(encrypted_data)}")
        
        # 获取AES密钥和IV
        aes_key = base64.b64decode(ENCODING_AES_KEY + "=")
        iv = aes_key[:16]
        print(f"AES密钥长度: {len(aes_key)}")
        print(f"IV长度: {len(iv)}")
        
        # AES解密
        cipher = AES.new(aes_key, AES.MODE_CBC, iv)
        decrypted_data = cipher.decrypt(encrypted_data)
        print(f"解密后的数据长度: {len(decrypted_data)}")
        
        # 去除填充
        decrypted_data = unpad(decrypted_data, AES.block_size)
        print(f"去除填充后的数据长度: {len(decrypted_data)}")
        
        # 提取消息内容
        content = decrypted_data[16:]  # 去掉前16随机字节
        msg_len = int.from_bytes(content[0:4], "big")
        msg_content = content[4:4 + msg_len]
        receive_id = content[4 + msg_len:].decode("utf-8")
        
        final_content = msg_content.decode("utf-8")
        print(f"解密后的明文: {final_content}")
        print(f"接收ID: {receive_id}")
        
        return final_content
        
    except Exception as e:
        print(f"解密失败: {e}")
        return None

if __name__ == "__main__":
    print("企业微信回调验证调试工具")
    print("=" * 50)
    
    # 请确保填入正确的配置
    if TOKEN == "your_token_here" or ENCODING_AES_KEY == "your_encoding_aes_key_here":
        print("错误：请先设置正确的TOKEN、ENCODING_AES_KEY和CORP_ID")
        print("请从环境变量或配置文件中获取这些值")
        exit(1)
    
    # 测试签名验证
    sig_valid = test_signature_verification()
    
    # 测试解密
    decrypted_content = test_decryption()
    
    print("\n" + "=" * 50)
    print("总结:")
    print(f"签名验证: {'通过' if sig_valid else '失败'}")
    print(f"解密: {'成功' if decrypted_content else '失败'}")
    if decrypted_content:
        print(f"解密内容: {decrypted_content}")