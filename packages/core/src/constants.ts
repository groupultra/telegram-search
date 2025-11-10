// 消息处理批次大小
// 对于包含大量媒体的消息，应该使用较小的批次以避免内存占用过高
export const MESSAGE_PROCESS_BATCH_SIZE = 20
export const MESSAGE_PROCESS_LIMIT = 2

// 媒体处理批次大小 - 用于有媒体的消息
// 由于媒体文件（图片、贴纸等）占用内存较大，使用更小的批次
export const MEDIA_PROCESS_BATCH_SIZE = 5
