/**
 * 处理API错误
 * @param {Object} error 错误对象
 * @param {Function} showMessage 消息显示函数
 */
export function handleApiError(error, showMessage = console.error) {
  if (error.response) {
    const { code, msg } = error.response.data || {};

    switch (code) {
      case -1:
        showMessage(`操作失败: ${msg}`);
        break;
      default:
        showMessage(`未知错误: ${msg || error.message}`);
    }
  } else if (error.request) {
    showMessage('网络错误，请检查连接');
  } else if (error.success === false) {
    showMessage(error.msg || error.error || '请求失败');
  } else {
    showMessage(`请求配置错误: ${error.message}`);
  }
}

/**
 * 显示成功消息
 * @param {string|Object} message 消息内容或响应对象
 * @param {Function} showMessage 消息显示函数
 */
export function showSuccess(message, showMessage = console.log) {
  if (typeof message === 'object' && message.msg) {
    showMessage(`成功: ${message.msg}`);
  } else {
    showMessage(`成功: ${message}`);
  }
}

export default {
  handleApiError,
  showSuccess
};
