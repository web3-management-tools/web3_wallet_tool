import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL || 'http://localhost:3000';
const PWD_DECRYPT_KEY = import.meta.env.VITE_APP_PWD_DECRYPT_KEY || 'default_secure_key';

const te = new TextEncoder();

// IV = b'0000000000000000' -> ASCII '0' (0x30) * 16
const IV = new Uint8Array(16).fill(0x30);

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

async function sha256Key(password) {
  const keyBytes = await crypto.subtle.digest("SHA-256", te.encode(password));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
}

// 加密pwd函数 - 与后端AES-256-CBC匹配
async function encryptPwd(pwd) {
  if (!pwd) return pwd;

  const key = await sha256Key(PWD_DECRYPT_KEY);
  const data = te.encode(pwd); // 不手动 padding，让 WebCrypto 自动 PKCS7
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-CBC", iv: IV }, key, data);
  const result = bytesToBase64(new Uint8Array(ctBuf));

  return result;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  async config => {
    // 自动加密pwd字段
    if (config.data && typeof config.data.pwd === 'string') {
      config.data.pwd = await encryptPwd(config.data.pwd);
    }
    // 处理GET请求的pwd参数
    if (config.method === 'get' && config.params && typeof config.params.pwd === 'string') {
      config.params.pwd = await encryptPwd(config.params.pwd);
    }
    return config;
  },
  error => Promise.reject(error)
);

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    const { code, data, msg } = response.data;
    if (code === 20000) {
      return { success: true, data, msg };
    } else {
      return { success: false, data, msg, code };
    }
  },
  error => {
    if (error.response) {
      const { code, msg } = error.response.data || {};
      return { success: false, code, msg, error: error.message };
    } else if (error.request) {
      return { success: false, error: '网络错误，请检查连接' };
    } else {
      return { success: false, error: error.message };
    }
  }
);

export default apiClient;
