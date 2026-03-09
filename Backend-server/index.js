const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;
// 开启 CORS，允许咱们运行在 5173 端口的 React 前端来访问
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routers/auth'));
app.use('/api/user', require('./routers/user'));
app.use('/api/badges', require('./routers/badges'));
app.use('/api/life-game', require('./routers/game/lifeGame'));
app.use('/api/precise-word', require('./routers/game/preciseWord'));
app.use('/api/arrow-maze', require('./routers/game/arrowMaze'));
app.use('/api/sheep-game',require('./routers/game/sheepGame'));

app.listen(PORT, () => console.log(`🚀 高级后端服务器已启动：http://localhost:${PORT}`));
