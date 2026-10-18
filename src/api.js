/** HTTP API 封装 */
const base = '';

async function jfetch(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(base + url, opts);
  let data = null;
  try { data = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((data && data.error) || ('请求失败 ' + r.status));
  return data;
}

export const api = {
  health: () => jfetch('GET', '/api/health'),
  config: () => jfetch('GET', '/api/config'),
  register: (username) => jfetch('POST', '/api/auth/register', { username }),
  login: (username) => jfetch('POST', '/api/auth/login', { username }),
  loginAdmin: (username, password) => jfetch('POST', '/api/auth/admin', { username, password }),
  me: () => jfetch('GET', '/api/auth/me'),
  logout: () => jfetch('POST', '/api/auth/logout', {}),
  pins: () => jfetch('GET', '/api/pins'),
  createPin: (position) => jfetch('POST', '/api/pins', position),
  movePin: (id, position) => jfetch('PUT', '/api/pins/' + encodeURIComponent(id), position),
  deletePin: (id) => jfetch('DELETE', '/api/pins/' + encodeURIComponent(id)),
  uploadPinPhoto: (id, file) => {
    const fd = new FormData();
    fd.append('photo', file, 'pin-photo.jpg');
    return jfetch('POST', '/api/pins/' + encodeURIComponent(id) + '/photo', fd);
  },
  adminPins: () => jfetch('GET', '/api/admin/pins'),
  updateSettings: (settings) => jfetch('PUT', '/api/admin/settings', settings),
  floors: () => jfetch('GET', '/api/floors'),
  rooms: () => jfetch('GET', '/api/rooms'),
  createRoom: (name) => jfetch('POST', '/api/rooms', { name }),

  uploadPhoto: (file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return jfetch('POST', '/api/upload', fd);
  },
  generate: (body) => jfetch('POST', '/api/generate', body),
  genStatus: (taskId) => jfetch('GET', '/api/generate/' + taskId),

  listObjects: (room) => jfetch('GET', '/api/objects?room=' + encodeURIComponent(room || '')),
  placeObject: (body) => jfetch('POST', '/api/objects', body),
  moveObject: (id, body) => jfetch('PUT', '/api/objects/' + id, body),
  deleteObject: (id, actor) => jfetch('DELETE', '/api/objects/' + id, { actor }),

  adminLogin: (password) => jfetch('POST', '/api/admin/login', { password }),
};
