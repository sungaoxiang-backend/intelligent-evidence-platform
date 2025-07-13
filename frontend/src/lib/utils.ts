import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 获取文件图标
export function getFileIcon(extension: string): string {
  const ext = extension.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
    return "🖼️";
  } else if (["pdf"].includes(ext)) {
    return "📄";
  } else if (["doc", "docx"].includes(ext)) {
    return "📝";
  } else if (["xls", "xlsx"].includes(ext)) {
    return "📊";
  } else if (["ppt", "pptx"].includes(ext)) {
    return "📽️";
  } else if (["txt"].includes(ext)) {
    return "📄";
  } else if (["zip", "rar", "7z"].includes(ext)) {
    return "🗜️";
  } else {
    return "📎";
  }
}

// 判断是否为图片文件
export function isImageFile(extension: string): boolean {
  const ext = extension.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext);
}
